/**
 * Semantic Scholar APIを呼び出し、学術論文検索結果を取得
 */
async function handleSemanticScholarSearch(query, fields = 'title,url,publicationTypes,publicationDate,venue,journal,authors,abstract,citationCount,externalIds', limit = 10) {
  if (!query) {
    throw new Error('Query parameter is required');
  }

  console.log(`🔍 Semantic Scholar検索: "${query}" (最大${limit}件)`);

  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=${fields}&limit=${limit}`;
  console.log(`🌐 Semantic Scholar API Request: ${url}`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; CitationChecker/1.0; +https://citation-checker.psycholo.studio)'
    }
  });

  if (!response.ok) {
    console.error(`❌ Semantic Scholar API error: ${response.status} ${response.statusText}`);
    throw new Error(`Semantic Scholar API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const resultCount = data.data?.length || 0;
  console.log(`📊 Semantic Scholar API レスポンス: ${resultCount}件取得`);
  
  // 基本的な統一フォーマットに変換
  const results = [];
  const items = data.data || [];
  
  for (const item of items) {
    try {
      const title = (item.title || '').replace(/\.$/, ''); // 末尾のピリオドを除去
      const authors = item.authors?.map(author => author.name || '').filter(name => name) || [];
      
      // 出版年を抽出
      const publicationDate = item.publicationDate || '';
      const yearMatch = publicationDate.match(/(\d{4})/);
      const year = yearMatch ? yearMatch[1] : '';
      
      // DOI取得
      const doi = item.externalIds?.DOI || '';
      
      // 雑誌・会議名
      const journal = item.venue || item.journal?.name || '';
      
      // 優先順位: DOI > item.url
      const url = doi ? `https://doi.org/${doi}` : (item.url || '');
      
      // 論文タイプ判定
      const publicationTypes = item.publicationTypes || [];
      const isBook = publicationTypes.includes('Book');
      let isBookChapter = publicationTypes.includes('BookSection');
      
      // 追加の書籍章判定: パターンベースの検出
      if (!isBookChapter && !isBook) {
        // 雑誌名がない + タイトルに"In"が含まれている場合は書籍章の可能性
        const hasInTitle = title.toLowerCase().includes('in:') || 
                          title.toLowerCase().includes('in ') ||
                          title.includes('所収') || 
                          title.includes('収録');
        
        // 会議録ではない + 雑誌名がない + "In"関連の表記がある場合は書籍章
        const isConference = publicationTypes.includes('Conference') || 
                            journal.toLowerCase().includes('conference') ||
                            journal.toLowerCase().includes('proceedings');
        
        if (!isConference && !journal && hasInTitle) {
          isBookChapter = true;
        }
      }
      
      console.log(`🔍 Semantic Scholar項目解析: "${title.substring(0, 30)}" - タイプ: ${isBook ? '書籍' : isBookChapter ? '書籍章' : '論文'}`);
      
      results.push({
        title,
        subtitle: '', // Semantic Scholarではサブタイトルを別フィールドで提供していないため空
        authors,
        year,
        doi,
        journal: (isBook || isBookChapter) ? '' : journal,
        publisher: (isBook || isBookChapter) ? journal : '',
        volume: '',
        issue: '',
        pages: '',
        url,
        isbn: '',
        source: 'Semantic Scholar',
        isBook,
        isBookChapter,
        bookTitle: isBookChapter ? journal : '',
        bookTitleWithSubtitle: isBookChapter ? journal : '', // 完全な書籍タイトル
        editors: [],
        originalData: item
      });
    } catch (error) {
      console.error('Semantic Scholar項目処理エラー:', error);
      continue;
    }
  }
  
  return {
    results: results,
    source: 'Semantic Scholar',
    query: { query, fields, limit }
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
    const { query, fields = 'title,url,publicationTypes,publicationDate,venue,journal,authors,abstract,citationCount,externalIds', limit = 10 } = req.query;
    const data = await handleSemanticScholarSearch(query, fields, limit);
    res.status(200).json(data);

  } catch (error) {
    console.error('Semantic Scholar API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
}