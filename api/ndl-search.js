/**
 * 国会図書館検索API プロキシ
 * Vercel Serverless Function
 */

import { handleNDLSearch } from '../shared/api-handlers/ndl-logic.js';

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