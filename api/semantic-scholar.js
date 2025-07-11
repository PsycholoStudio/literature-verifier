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
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=${fields}&limit=${limit}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'LiteratureVerifier/1.0'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Semantic Scholar API error: ${response.status}`,
        details: response.statusText
      });
    }

    const data = await response.json();
    res.status(200).json(data);

  } catch (error) {
    console.error('Semantic Scholar API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
}