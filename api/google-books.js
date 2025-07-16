/**
 * Google Books API プロキシ関数
 * 書籍検索に特化したAPI
 */

import { handleGoogleBooksSearch } from '../shared/api-handlers/google-books-logic.js';

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