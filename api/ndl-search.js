/**
 * 国会図書館検索API プロキシ
 * Vercel Serverless Function
 */

/**
 * 国会図書館検索API を呼び出し、書籍データを取得
 */
async function handleNDLSearch(title, creator) {
  const baseUrl = 'https://iss.ndl.go.jp/api/opensearch';
  const queryParams = new URLSearchParams({
    mediatype: 1, // 図書
    cnt: 20, // 最大20件
    onlyFree: 'false',
    lang: 'ja'
  });

  // タイトル検索
  if (title) {
    queryParams.append('title', title);
  }

  // 著者検索
  if (creator) {
    queryParams.append('creator', creator);
  }

  const url = `${baseUrl}?${queryParams.toString()}`;
  console.log(`🌐 NDL API Request: ${url}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/rss+xml, application/xml, text/xml',
      'User-Agent': 'Mozilla/5.0 (compatible; CitationChecker/1.0; +https://citation-checker.psycholo.studio)'
    }
  });

  if (!response.ok) {
    console.error(`❌ NDL API error: ${response.status} ${response.statusText}`);
    throw new Error(`NDL API error: ${response.status} ${response.statusText}`);
  }

  const xmlText = await response.text();
  console.log(`📊 NDL API レスポンス: ${xmlText.length}バイト受信`);

  // 簡易XMLパースして結果を抽出
  const results = parseNDLXml(xmlText);
  console.log(`📚 NDL パース結果: ${results.length}件`);

  return {
    results: results,
    source: 'NDL',
    query: { title, creator }
  };
}

/**
 * NDL XML レスポンスを解析
 */
function parseNDLXml(xmlText) {
  const results = [];
  
  try {
    // item要素を抽出
    const itemMatches = xmlText.match(/<item[^>]*>[\s\S]*?<\/item>/g);
    if (!itemMatches) return results;

    for (const itemMatch of itemMatches) {
      try {
        const item = {};
        
        // タイトル抽出
        const titleMatch = itemMatch.match(/<title[^>]*>([\s\S]*?)<\/title>/);
        if (titleMatch) {
          item.title = titleMatch[1].trim();
        }

        // 著者抽出
        const authorMatch = itemMatch.match(/<author[^>]*>([\s\S]*?)<\/author>/);
        if (authorMatch) {
          item.authors = [authorMatch[1].trim()];
        } else {
          item.authors = [];
        }

        // 出版年抽出
        const pubDateMatch = itemMatch.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/);
        if (pubDateMatch) {
          const yearMatch = pubDateMatch[1].match(/(\d{4})/);
          item.year = yearMatch ? yearMatch[1] : '';
        } else {
          item.year = '';
        }

        // リンク抽出
        const linkMatch = itemMatch.match(/<link[^>]*>([\s\S]*?)<\/link>/);
        if (linkMatch) {
          item.url = linkMatch[1].trim();
        } else {
          item.url = '';
        }

        // 出版社抽出
        const publisherMatch = itemMatch.match(/<dc:publisher[^>]*>([\s\S]*?)<\/dc:publisher>/);
        if (publisherMatch) {
          item.publisher = publisherMatch[1].trim();
        } else {
          item.publisher = '';
        }

        // 統一フォーマットに変換
        results.push({
          title: item.title || '',
          authors: item.authors || [],
          year: item.year || '',
          doi: '',
          journal: '',
          publisher: item.publisher || '',
          volume: '',
          issue: '',
          pages: '',
          url: item.url || '',
          isbn: '',
          source: 'NDL',
          isBook: true,
          isBookChapter: false,
          bookTitle: '',
          editors: [],
          originalData: item
        });
      } catch (error) {
        console.error('NDL項目処理エラー:', error);
        continue;
      }
    }
  } catch (error) {
    console.error('NDL XMLパースエラー:', error);
  }

  return results;
}

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { title, creator } = req.query;
    const data = await handleNDLSearch(title, creator);
    return res.status(200).json(data);

  } catch (error) {
    console.error('❌ NDL API エラー:', error);
    return res.status(500).json({ 
      error: 'NDL検索でエラーが発生しました',
      details: error.message 
    });
  }
}