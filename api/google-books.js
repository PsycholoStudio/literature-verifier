/**
 * Google Books API プロキシ関数
 * 書籍検索に特化したAPI
 */

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

    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    console.log(`🔍 Google Books検索: "${q}"`);

    // Google Books API URL構築
    const baseUrl = 'https://www.googleapis.com/books/v1/volumes';
    const params = new URLSearchParams({
      q: q,
      maxResults: Math.min(parseInt(maxResults), 40), // 最大40件
      startIndex: parseInt(startIndex),
      fields: 'items(id,volumeInfo(title,subtitle,authors,publishedDate,publisher,industryIdentifiers,pageCount,categories,language,description))',
      printType: 'books' // 書籍のみに限定
    });

    const requestUrl = `${baseUrl}?${params}`;
    console.log(`🌐 Google Books API Request: ${requestUrl}`);

    // Google Books APIを呼び出し
    const response = await fetch(requestUrl, {
      headers: {
        'User-Agent': 'Literature-Verifier/1.0'
      }
    });

    if (!response.ok) {
      console.error(`Google Books API error: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({ 
        error: `Google Books API error: ${response.status}`,
        details: response.statusText
      });
    }

    const data = await response.json();
    
    console.log(`📊 Google Books APIレスポンス:`);
    console.log(`   取得件数: ${data.items?.length || 0}件`);
    console.log(`   総利用可能件数: ${data.totalItems || 0}件`);

    // デバッグ用：実際の書籍タイトルを表示
    if (data.items?.length > 0) {
      console.log(`📚 Google Books検索結果タイトル一覧:`);
      data.items.slice(0, 5).forEach((item, index) => {
        const volumeInfo = item.volumeInfo || {};
        const title = volumeInfo.title || 'タイトルなし';
        const subtitle = volumeInfo.subtitle || '';
        const fullTitle = subtitle ? `${title}: ${subtitle}` : title;
        const year = volumeInfo.publishedDate ? volumeInfo.publishedDate.substring(0, 4) : '不明';
        console.log(`  ${index + 1}. "${fullTitle}" (年: ${year})`);
      });
    }

    // レスポンスを返す
    res.status(200).json(data);

  } catch (error) {
    console.error('Google Books API proxy error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}