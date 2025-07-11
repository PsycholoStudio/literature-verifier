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
    const { q, count = 10, start = 1, lang = 'ja', format = 'rss' } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Query parameter (q) is required' });
    }

    const searchParams = new URLSearchParams({
      q: q,
      count: count.toString(),
      start: start.toString(),
      lang,
      format
    });

    const url = `https://cir.nii.ac.jp/opensearch/articles?${searchParams.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/rss+xml, application/xml, text/xml',
        'User-Agent': 'LiteratureVerifier/1.0'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `CiNii API error: ${response.status}`,
        details: response.statusText
      });
    }

    const xmlText = await response.text();
    
    // XMLをそのまま返す
    res.setHeader('Content-Type', 'application/xml');
    res.status(200).send(xmlText);

  } catch (error) {
    console.error('CiNii API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
}