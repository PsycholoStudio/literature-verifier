// CrossRefレート制限管理
let lastCrossRefRequestTime = 0;

/**
 * CrossRef APIを呼び出し、検索結果を取得
 */
async function handleCrossRefSearch(query, rows = 10, doi = null, filter = null) {
  let url;
  let decodedQuery = query; // 変数をトップレベルで宣言
  
  if (doi) {
    // DOI検索
    url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
    console.log(`🔍 CrossRef DOI検索: "${doi}"`);
  } else if (query) {
    // テキスト検索
    // 注意: queryパラメータが既にエンコードされている可能性があるため、
    // 一度デコードしてから再エンコードする
    try {
      // 既にエンコードされている場合はデコード
      decodedQuery = decodeURIComponent(query);
    } catch (e) {
      // デコードに失敗した場合は元のクエリを使用
      decodedQuery = query;
    }
    
    const params = new URLSearchParams();
    params.append('query', decodedQuery);
    params.append('rows', rows.toString());
    params.append('mailto', 'scriba@psycholo.studio');
    
    // フィルターが指定されている場合は追加（バリデーション付き）
    if (filter && typeof filter === 'string' && filter.trim()) {
      // 危険な文字をエスケープ
      const safeFilter = filter.replace(/[<>]/g, '');
      params.append('filter', safeFilter);
      console.log(`🔍 CrossRef検索 (フィルター付き): "${decodedQuery}" フィルター: "${safeFilter}" (最大${rows}件)`);
    } else {
      console.log(`🔍 CrossRef検索: "${decodedQuery}" (最大${rows}件)`);
    }
    
    url = `https://api.crossref.org/works?${params.toString()}`;
  } else {
    throw new Error('Query or DOI parameter is required');
  }

  console.log(`🌐 CrossRef API Request: ${url}`);
  
  // デバッグ情報を追加
  console.log(`📝 CrossRef Parameters:`, {
    originalQuery: query,
    decodedQuery: decodedQuery,
    rows: rows,
    doi: doi,
    filter: filter,
    url: url
  });

  // レート制限：前回のリクエストから3秒間隔を確保
  const now = Date.now();
  const timeSinceLastRequest = now - lastCrossRefRequestTime;
  const minInterval = 3000; // 3秒
  
  if (timeSinceLastRequest < minInterval) {
    const waitTime = minInterval - timeSinceLastRequest;
    console.log(`⏳ CrossRef レート制限: ${waitTime}ms 待機中...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastCrossRefRequestTime = Date.now();
  console.log(`🔒 CrossRef レート制限完了 - API呼び出し開始`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; CitationChecker/1.0; +https://citation-checker.psycholo.studio; mailto:scriba@psycholo.studio)'
    }
  });

  if (!response.ok) {
    console.error(`❌ CrossRef API error: ${response.status} ${response.statusText}`);
    console.error(`❌ CrossRef API endpoint: ${url}`);
    throw new Error(`CrossRef API error: ${response.status} ${response.statusText} - Endpoint: ${url}`);
  }

  console.log(`✅ CrossRef API レスポンス成功: ${response.status}`);
  const data = await response.json();
  
  console.log(`📄 CrossRef レスポンス構造:`, {
    hasMessage: !!data.message,
    hasItems: !!data.message?.items,
    itemCount: data.message?.items?.length || 0
  });
  
  const resultCount = doi ? (data.message ? 1 : 0) : (data.message?.items?.length || 0);
  console.log(`📊 CrossRef API レスポンス: ${resultCount}件受信`);
  
  // 基本的な統一フォーマットに変換
  const results = [];
  const items = doi ? (data.message ? [data.message] : []) : (data.message?.items || []);
  
  for (const item of items) {
    try {
      const title = item.title?.[0] || '';
      const authors = item.author?.map(author => {
        if (author.given && author.family) {
          return `${author.given} ${author.family}`;
        }
        return author.name || `${author.family || ''} ${author.given || ''}`.trim();
      }) || [];
      
      const year = item['published-print']?.['date-parts']?.[0]?.[0] || 
                   item['published-online']?.['date-parts']?.[0]?.[0] || '';
      
      const doi = item.DOI || '';
      const url = item.URL || (doi ? `https://doi.org/${doi}` : '');
      
      // タイプ判定
      const type = item.type || '';
      const isBook = type === 'book' || type === 'monograph';
      const isBookChapter = type === 'book-chapter';
      
      results.push({
        title,
        authors,
        year: year.toString(),
        doi,
        journal: isBook || isBookChapter ? '' : (item['container-title']?.[0] || ''),
        publisher: isBook || isBookChapter ? (item.publisher || '') : '',
        volume: item.volume || '',
        issue: item.issue || '',
        pages: item.page || '',
        url,
        source: 'CrossRef',
        isBook,
        isBookChapter,
        bookTitle: isBookChapter ? (item['container-title']?.[0] || '') : '',
        editors: [],
        originalData: item
      });
    } catch (error) {
      console.error('CrossRef項目処理エラー:', error);
      continue;
    }
  }
  
  return {
    results: results,
    source: 'CrossRef',
    query: { doi, query, rows }
  };
}

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { query, rows = 10, doi, filter } = req.query;
    const data = await handleCrossRefSearch(query, rows, doi, filter);
    res.status(200).json(data);

  } catch (error) {
    console.error('CrossRef API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
}