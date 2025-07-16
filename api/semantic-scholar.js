import { handleSemanticScholarSearch } from '../shared/api-handlers/semantic-scholar-logic.js';

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