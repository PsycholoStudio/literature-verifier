/**
 * 国会図書館検索API プロキシ
 * Vercel Serverless Function
 */

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
    
    if (!title) {
      return res.status(400).json({ error: 'タイトルパラメータが必要です' });
    }

    console.log('🏛️ NDL検索リクエスト:', { title, creator });

    // 国会図書館SRU APIのベースURL
    const baseUrl = 'https://ndlsearch.ndl.go.jp/api/sru';
    
    // SRU検索クエリの構築
    let sruQuery = `title="${title}"`;
    if (creator) {
      sruQuery += ` AND creator="${creator}"`;
    }
    
    // 検索パラメータの構築
    const searchParams = new URLSearchParams({
      operation: 'searchRetrieve',
      maximumRecords: '20',
      query: sruQuery
    });

    const ndlUrl = `${baseUrl}?${searchParams.toString()}`;
    console.log('🔗 NDL API URL:', ndlUrl);

    // 国会図書館APIへのリクエスト
    const response = await fetch(ndlUrl, {
      headers: {
        'User-Agent': 'Literature-Verifier/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`NDL API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.text();
    console.log('📄 NDL SRU API レスポンス取得済み');

    // SRU XMLレスポンスをパース
    const results = parseNDLSRUResponse(data);
    
    console.log(`✅ NDL検索完了: ${results.length}件の結果`);
    
    return res.status(200).json({
      results,
      source: 'ndl',
      query: { title, creator }
    });

  } catch (error) {
    console.error('❌ NDL API エラー:', error);
    return res.status(500).json({ 
      error: 'NDL検索でエラーが発生しました',
      details: error.message 
    });
  }
}

/**
 * NDL SRU APIのXMLレスポンスを解析
 */
function parseNDLSRUResponse(xmlData) {
  try {
    const items = [];
    
    // SRU形式：<srw:record>内の<srw:recordData>を抽出
    const recordRegex = /<srw:recordData>([\s\S]*?)<\/srw:recordData>/g;
    let match;
    
    while ((match = recordRegex.exec(xmlData)) !== null) {
      const recordXml = match[1];
      
      // Dublin Core形式のメタデータを抽出
      const title = extractXmlField(recordXml, 'dc:title') || 
                   extractXmlField(recordXml, 'dcterms:title') || '';
      const creator = extractXmlField(recordXml, 'dc:creator') || 
                     extractXmlField(recordXml, 'dcterms:creator') || '';
      const publisher = extractXmlField(recordXml, 'dc:publisher') || 
                       extractXmlField(recordXml, 'dcterms:publisher') || '';
      const date = extractXmlField(recordXml, 'dc:date') || 
                  extractXmlField(recordXml, 'dcterms:date') || '';
      const identifier = extractXmlField(recordXml, 'dc:identifier') || '';
      
      // 年度の抽出
      const yearMatch = date.match(/(\d{4})/);
      const year = yearMatch ? yearMatch[1] : '';
      
      // 著者名のクリーニング（NDL形式の著者情報から名前部分を抽出）
      const cleanAuthors = creator.split(/[;,]/)
        .map(author => author.replace(/\[.*?\]/g, '').replace(/\d+\-\d+/g, '').trim())
        .filter(author => author.length > 0);

      if (title) {
        items.push({
          title: title.trim(),
          authors: cleanAuthors,
          year: year,
          publisher: publisher.trim(),
          url: identifier.includes('http') ? identifier.trim() : '',
          source: '国会図書館',
          isBook: true,
          originalData: {
            title,
            creator,
            publisher,
            date,
            identifier
          }
        });
      }
    }
    
    return items;
    
  } catch (error) {
    console.error('❌ NDL SRU XML解析エラー:', error);
    return [];
  }
}

/**
 * XMLから指定フィールドの値を抽出
 */
function extractXmlField(xml, fieldName) {
  const regex = new RegExp(`<${fieldName}[^>]*>(.*?)<\/${fieldName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') : '';
}