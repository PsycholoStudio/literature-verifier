const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

// CORS設定
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

// CrossRef API プロキシ
app.use('/api/crossref', createProxyMiddleware({
  target: 'https://api.crossref.org',
  changeOrigin: true,
  pathRewrite: {
    '^/api/crossref': '/works'
  },
  onError: (err, req, res) => {
    console.error('CrossRef Proxy Error:', err);
    res.status(500).json({ error: 'CrossRef API Error' });
  }
}));

// Semantic Scholar API プロキシ
app.use('/api/semantic-scholar', createProxyMiddleware({
  target: 'https://api.semanticscholar.org',
  changeOrigin: true,
  pathRewrite: {
    '^/api/semantic-scholar': '/graph/v1/paper/search'
  },
  onError: (err, req, res) => {
    console.error('Semantic Scholar Proxy Error:', err);
    res.status(500).json({ error: 'Semantic Scholar API Error' });
  }
}));

// CiNii API プロキシ
app.use('/api/cinii', createProxyMiddleware({
  target: 'https://cir.nii.ac.jp',
  changeOrigin: true,
  pathRewrite: {
    '^/api/cinii': '/opensearch/articles'
  },
  onError: (err, req, res) => {
    console.error('CiNii Proxy Error:', err);
    res.status(500).json({ error: 'CiNii API Error' });
  }
}));

app.listen(PORT, () => {
  console.log(`API Proxy server running on http://localhost:${PORT}`);
  console.log('API endpoints:');
  console.log(`  - CrossRef: http://localhost:${PORT}/api/crossref`);
  console.log(`  - Semantic Scholar: http://localhost:${PORT}/api/semantic-scholar`);
  console.log(`  - CiNii: http://localhost:${PORT}/api/cinii`);
});