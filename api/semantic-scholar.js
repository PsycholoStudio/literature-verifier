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
      'User-Agent': 'LiteratureVerifier/1.0'
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
      const title = item.title || '';
      const authors = item.authors?.map(author => author.name || '').filter(name => name) || [];
      
      // 出版年を抽出
      const publicationDate = item.publicationDate || '';
      const yearMatch = publicationDate.match(/(\d{4})/);
      const year = yearMatch ? yearMatch[1] : '';
      
      // DOI取得
      const doi = item.externalIds?.DOI || '';
      
      // 雑誌・会議名
      const journal = item.venue || item.journal?.name || '';
      
      const url = item.url || '';
      
      // 論文タイプ判定
      const publicationTypes = item.publicationTypes || [];
      const isBook = publicationTypes.includes('Book');
      const isBookChapter = publicationTypes.includes('BookSection');
      
      results.push({
        title,
        authors,
        year,
        doi,
        journal: isBook || isBookChapter ? '' : journal,
        publisher: isBook || isBookChapter ? journal : '',
        volume: '',
        issue: '',
        pages: '',
        url,
        isbn: '',
        source: 'Semantic Scholar',
        isBook,
        isBookChapter,
        bookTitle: isBookChapter ? journal : '',
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