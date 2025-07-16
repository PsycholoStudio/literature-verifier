import express from 'express';
import cors from 'cors';

// 共通ロジックをimport
import { handleCrossRefSearch } from './shared/api-handlers/crossref-logic.js';
import { handleGoogleBooksSearch } from './shared/api-handlers/google-books-logic.js';
import { handleNDLSearch } from './shared/api-handlers/ndl-logic.js';
import { handleSemanticScholarSearch } from './shared/api-handlers/semantic-scholar-logic.js';
import { handleCiNiiSearch } from './shared/api-handlers/cinii-logic.js';
import { formatCiNiiResponse } from './shared/utils/unifiedResponseFormatter.mjs';

const app = express();
const PORT = 3001;

// CORS設定
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

// CrossRef API（共通ロジックを使用）
app.get('/api/crossref', async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    const { query, rows = 10, doi } = req.query;
    const data = await handleCrossRefSearch(query, rows, doi);
    res.json(data);
  } catch (error) {
    console.error('CrossRef API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

// Semantic Scholar API（共通ロジックを使用）
app.get('/api/semantic-scholar', async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    const { query, fields = 'title,url,publicationTypes,publicationDate,venue,journal,authors,abstract,citationCount,externalIds', limit = 10 } = req.query;
    const data = await handleSemanticScholarSearch(query, fields, limit);
    res.json(data);
  } catch (error) {
    console.error('Semantic Scholar API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

// CiNii API（共通ロジックを使用）
app.get('/api/cinii', async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

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
});

// NDL API（共通ロジックを使用）
app.get('/api/ndl-search', async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

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
});

// Google Books API（共通ロジックを使用）
app.get('/api/google-books', async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    const { q, maxResults = 20, startIndex = 0 } = req.query;
    const data = await handleGoogleBooksSearch(q, maxResults, startIndex);
    res.json(data);
  } catch (error) {
    console.error('Google Books API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`API Proxy server running on http://localhost:${PORT}`);
  console.log('API endpoints:');
  console.log(`  - CrossRef: http://localhost:${PORT}/api/crossref`);
  console.log(`  - Semantic Scholar: http://localhost:${PORT}/api/semantic-scholar`);
  console.log(`  - CiNii: http://localhost:${PORT}/api/cinii`);
  console.log(`  - NDL: http://localhost:${PORT}/api/ndl-search`);
  console.log(`  - Google Books: http://localhost:${PORT}/api/google-books`);
});