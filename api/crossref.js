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
    const { query, rows = 10, doi } = req.query;
    
    let url;
    if (doi) {
      // DOI検索
      url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
    } else if (query) {
      // テキスト検索
      url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${rows}`;
    } else {
      return res.status(400).json({ error: 'Query or DOI parameter is required' });
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'LiteratureVerifier/1.0 (mailto:contact@example.com)'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `CrossRef API error: ${response.status}`,
        details: response.statusText
      });
    }

    const data = await response.json();
    res.status(200).json(data);

  } catch (error) {
    console.error('CrossRef API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
}