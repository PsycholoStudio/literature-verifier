/**
 * Google Books API プロキシ関数
 * 書籍検索に特化したAPI
 */

/**
 * Google Books APIを呼び出し、書籍検索結果を取得
 */
async function handleGoogleBooksSearch(q, maxResults = 20, startIndex = 0) {
  if (!q) {
    throw new Error('Query parameter "q" is required');
  }

  console.log(`🔍 Google Books検索: "${q}" (最大${maxResults}件)`);

  // Google Books API URL構築（検索用）
  const baseUrl = 'https://www.googleapis.com/books/v1/volumes';
  const params = new URLSearchParams({
    q: q,
    maxResults: Math.min(parseInt(maxResults), 40), // 最大40件
    startIndex: parseInt(startIndex),
    fields: 'items(id,selfLink,volumeInfo(title,subtitle,authors,publishedDate,publisher,industryIdentifiers,pageCount,categories,language,description))',
    printType: 'books' // 書籍のみに限定
  });

  const requestUrl = `${baseUrl}?${params}`;
  console.log(`🌐 Google Books API Request: ${requestUrl}`);

  // Google Books APIを呼び出し（検索）
  const response = await fetch(requestUrl, {
    headers: {
      'User-Agent': 'Literature-Verifier/1.0'
    }
  });

  if (!response.ok) {
    console.error(`Google Books API error: ${response.status} ${response.statusText}`);
    throw new Error(`Google Books API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  console.log(`📊 Google Books API レスポンス: ${data.items?.length || 0}件受信`);
  
  // 基本的な統一フォーマットに変換
  const results = [];
  const items = data.items || [];
  
  for (const item of items) {
    try {
      const volumeInfo = item.volumeInfo || {};
      const title = volumeInfo.title || '';
      const authors = volumeInfo.authors || [];
      
      // 出版年を抽出
      const publishedDate = volumeInfo.publishedDate || '';
      const yearMatch = publishedDate.match(/(\d{4})/);
      const year = yearMatch ? yearMatch[1] : '';
      
      const publisher = volumeInfo.publisher || '';
      
      // ISBN取得
      const identifiers = volumeInfo.industryIdentifiers || [];
      const isbn13 = identifiers.find(id => id.type === 'ISBN_13')?.identifier || '';
      const isbn10 = identifiers.find(id => id.type === 'ISBN_10')?.identifier || '';
      const isbn = isbn13 || isbn10;
      
      // DOI取得（Google BooksでDOIが提供される場合）
      const doi = identifiers.find(id => id.type === 'DOI')?.identifier || '';
      
      // Google Booksの書籍詳細ページリンクを生成
      const previewLink = volumeInfo.previewLink || '';
      const infoLink = volumeInfo.infoLink || '';
      const canonicalVolumeLink = volumeInfo.canonicalVolumeLink || '';
      
      // 優先順位: DOI > canonicalVolumeLink > infoLink > previewLink
      const url = doi ? `https://doi.org/${doi}` : 
                  (canonicalVolumeLink || infoLink || previewLink || '');
      
      results.push({
        title,
        authors,
        year,
        doi,
        journal: '',
        publisher,
        volume: '',
        issue: '',
        pages: volumeInfo.pageCount ? volumeInfo.pageCount.toString() : '',
        url,
        isbn,
        source: 'Google Books',
        isBook: true,
        isBookChapter: false,
        bookTitle: '',
        editors: [],
        originalData: item
      });
    } catch (error) {
      console.error('Google Books項目処理エラー:', error);
      continue;
    }
  }
  
  return {
    results: results,
    source: 'Google Books',
    query: { q, maxResults, startIndex }
  };
}

export default async function handler(req, res) {
  // CORS ヘッダーを設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONSリクエストの処理
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { q, maxResults = 20, startIndex = 0 } = req.query;
    const data = await handleGoogleBooksSearch(q, maxResults, startIndex);
    res.status(200).json(data);

  } catch (error) {
    console.error('Google Books API proxy error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}