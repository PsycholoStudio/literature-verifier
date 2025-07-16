import { handleCiNiiSearch } from '../shared/api-handlers/cinii-logic.js';
import { formatCiNiiResponse } from '../shared/utils/unifiedResponseFormatter.mjs';

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
    const { q, count = 10, start = 1, lang = 'ja', format = 'rss', title, creator, publicationTitle } = req.query;
    
    // フィールド指定検索のオプション
    const options = {};
    if (title) options.title = title;
    if (creator) options.creator = creator;
    if (publicationTitle) options.publicationTitle = publicationTitle;
    
    // qまたはフィールド指定のいずれかが必要
    if (!q && !title && !creator) {
      return res.status(400).json({ error: 'Query parameter (q) or field options (title/creator) are required' });
    }

    const data = await handleCiNiiSearch(q, count, start, lang, format, options);
    const enhancedData = formatCiNiiResponse(data);
    res.status(200).json(enhancedData);

  } catch (error) {
    console.error('CiNii API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
}