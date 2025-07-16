import { handleCrossRefSearch } from '../shared/api-handlers/crossref-logic.js';

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
    const data = await handleCrossRefSearch(query, rows, doi);
    res.status(200).json(data);

  } catch (error) {
    console.error('CrossRef API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
}