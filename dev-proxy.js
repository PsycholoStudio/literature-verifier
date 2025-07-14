const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const path = require('path');

// 著者名正規化関数（ES6 importが使えないためインライン実装）
const splitAndNormalizeAuthors = (authorsString) => {
  if (!authorsString || typeof authorsString !== 'string') {
    return [];
  }

  const cleanString = authorsString.replace(/\[.*?\]/g, '').trim();
  
  // 「姓, 名, 生没年」形式の場合は分割しない
  if (cleanString.match(/^[^,]+,\s*[^,]+,\s*\d{4}-?[\d]*$/)) {
    const parts = cleanString.split(/,\s*/);
    return [parts[0] + parts[1]];
  }
  
  // 複数著者パターンのチェック（中黒区切りで、生年がない場合）
  if (cleanString.includes('・') && !cleanString.match(/・\d{4}-?[\d]*$/)) {
    // 姓・名・生年パターンでない場合は複数著者として分割
    if (!cleanString.match(/^[^・]+・[^・]+・\d{4}-?[\d]*$/)) {
      const authors = cleanString.split('・');
      return authors.map(author => normalizeAuthorName(author)).filter(author => author.length > 0);
    }
  }
  
  // 単一著者として処理
  const normalized = normalizeAuthorName(cleanString);
  return normalized ? [normalized] : [];
};

const normalizeAuthorName = (authorName) => {
  if (!authorName || typeof authorName !== 'string') {
    return '';
  }

  let cleanAuthor = authorName.trim();
  
  // 役割表記を削除
  cleanAuthor = cleanAuthor.replace(/\[.*?\]/g, '').trim();
  
  // 1. 「姓・名・生年」パターン
  if (cleanAuthor.match(/^[^・]+・[^・]+・\d{4}-?[\d]*$/)) {
    const parts = cleanAuthor.split('・');
    return parts[0] + parts[1];
  }
  
  // 2. 「姓／名・生年」パターン
  if (cleanAuthor.match(/^[^／]+／[^・]+・\d{4}-?[\d]*$/)) {
    return cleanAuthor
      .replace(/・\d{4}-?[\d]*$/, '')
      .replace('／', '');
  }
  
  // 3. カンマ形式（姓, 名, 生没年）
  if (cleanAuthor.match(/^[^,]+,\s*[^,]+,\s*\d{4}-?[\d]*$/)) {
    const parts = cleanAuthor.split(/,\s*/);
    return parts[0] + parts[1];
  }
  
  // 4. カンマ形式（姓, 名）
  if (cleanAuthor.match(/^[^,]+,\s*[^,]+$/)) {
    const parts = cleanAuthor.split(/,\s*/);
    if (/[\u4E00-\u9FAF\u3040-\u309F\u30A0-\u30FF]/.test(cleanAuthor)) {
      return parts[0] + parts[1];
    } else {
      // 欧米の複合姓をチェック
      const lastName = parts[0];
      const firstName = parts[1];
      
      if (lastName.match(/\b(Le|La|De|Del|Della|Van|Van der|Van den|Von|Von der|Mac|Mc|O'|St\.|San|Santa|Da|Das|Dos|Du|El|Al-|Ben-)\s/i)) {
        return `${firstName} ${lastName}`.trim();
      }
      
      return `${firstName} ${lastName}`.trim();
    }
  }
  
  // 5. 生年削除
  cleanAuthor = cleanAuthor.replace(/・\d{4}-?[\d]*$/, '').trim();
  
  // 6. スラッシュ処理
  if (cleanAuthor.includes('／')) {
    cleanAuthor = cleanAuthor.replace('／', '');
  }
  
  // 7. 中黒処理（日本語のみ）
  if (cleanAuthor.includes('・') && /[\u4E00-\u9FAF\u3040-\u309F\u30A0-\u30FF]/.test(cleanAuthor)) {
    if (!cleanAuthor.match(/[^・]+・[^・]+・[^・]+/)) {
      cleanAuthor = cleanAuthor.replace(/・/g, '');
    }
  }
  
  // 8. 日本語スペース区切り
  if (cleanAuthor.match(/^[\u4E00-\u9FAF\u3040-\u309F\u30A0-\u30FF]+\s+[\u4E00-\u9FAF\u3040-\u309F\u30A0-\u30FF]+$/)) {
    cleanAuthor = cleanAuthor.replace(/\s+/g, '');
  }
  
  return cleanAuthor.trim();
};

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

// NDL API プロキシ（カスタムハンドラー）
app.get('/api/ndl-search', async (req, res) => {
  try {
    const { title, creator } = req.query;
    
    if (!title) {
      return res.status(400).json({ error: 'タイトルパラメータが必要です' });
    }

    console.log('🏛️ NDL検索リクエスト:', { title, creator });

    // 国会図書館OpenSearch APIのベースURL
    const baseUrl = 'https://ndlsearch.ndl.go.jp/api/opensearch';
    
    // 検索パラメータの構築
    const searchParams = new URLSearchParams({
      title: title,
      cnt: '20' // 最大20件取得
    });
    
    // 著者が指定されている場合は追加
    if (creator) {
      searchParams.append('creator', creator);
    }
    
    const ndlUrl = `${baseUrl}?${searchParams.toString()}`;
    console.log('🔗 NDL API URL:', ndlUrl);

    // 国会図書館APIへのリクエスト
    const response = await fetch(ndlUrl, {
      headers: {
        'User-Agent': 'Literature-Verifier/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`NDL API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.text();
    console.log('📄 NDL OpenSearch API レスポンス取得済み');

    // OpenSearch XMLレスポンスをパース
    const results = parseNDLOpenSearchResponse(data);
    
    console.log(`✅ NDL検索完了: ${results.length}件の結果`);
    
    return res.json({
      results,
      source: 'ndl',
      query: { title, creator }
    });

  } catch (error) {
    console.error('❌ NDL API エラー:', error);
    return res.status(500).json({ 
      error: 'NDL検索でエラーが発生しました',
      details: error.message 
    });
  }
});

/**
 * NDL OpenSearch APIのXMLレスポンスを解析
 */
function parseNDLOpenSearchResponse(xmlData) {
  try {
    const items = [];
    const seenISBNs = new Set(); // ISBN重複チェック用
    const seenTitleAuthor = new Set(); // タイトル+著者の重複チェック用
    
    console.log('🔍 NDL OpenSearch XML解析開始 - データサイズ:', xmlData.length);
    
    // OpenSearch形式：<item>要素を抽出
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
    let match;
    let recordCount = 0;
    
    while ((match = itemRegex.exec(xmlData)) !== null) {
      recordCount++;
      const itemXml = match[1];
      
      console.log(`📝 レコード${recordCount}処理中...`);
      
      // 各フィールドを抽出
      const title = extractXmlField(itemXml, 'dc:title') || 
                   extractXmlField(itemXml, 'title') || '';
      const creator = extractXmlField(itemXml, 'dc:creator') || 
                     extractXmlField(itemXml, 'creator') || '';
      const publisher = extractXmlField(itemXml, 'dc:publisher') || 
                       extractXmlField(itemXml, 'publisher') || '';
      const date = extractXmlField(itemXml, 'dc:date') || '';
      const issued = extractXmlField(itemXml, 'dcterms:issued') || '';
      const link = extractXmlField(itemXml, 'link') || '';
      const isbn = extractXmlField(itemXml, 'dc:identifier') || '';
      
      console.log(`📝 抽出結果 - Title: "${title}", Creator: "${creator}", Publisher: "${publisher}"`);
      console.log(`📝 日付フィールド - dc:date: "${date}", dcterms:issued: "${issued}"`);
      
      // ISBN重複チェック
      if (isbn && isbn.includes('ISBN')) {
        const isbnMatch = isbn.match(/ISBN[:\s]*([\d\-X]+)/i);
        if (isbnMatch) {
          const cleanISBN = isbnMatch[1].replace(/-/g, '');
          if (seenISBNs.has(cleanISBN)) {
            console.log(`⚠️ ISBN重複のためスキップ: ${cleanISBN}`);
            continue;
          }
          seenISBNs.add(cleanISBN);
        }
      }
      
      // 年度の抽出（複数のフィールドから試みる）
      const dateStr = date || issued || '';
      const yearMatch = dateStr.match(/(\d{4})/);
      const year = yearMatch ? yearMatch[1] : '';
      
      console.log(`📝 抽出された年: "${year}"`);
      
      // 著者名のクリーニング（NDL形式の著者情報から名前部分を抽出）
      console.log(`📝 著者フィールド処理開始: "${creator}"`);
      const cleanAuthors = splitAndNormalizeAuthors(creator);
      console.log(`📝 著者名クリーニング完了: "${creator}" → [${cleanAuthors.join(', ')}]`);

      // タイトル+著者による重複チェック
      const titleAuthorKey = `${title.trim()}_${cleanAuthors.join('_')}`;
      if (seenTitleAuthor.has(titleAuthorKey)) {
        console.log(`⚠️ タイトル+著者の重複のためスキップ: ${title} / ${cleanAuthors.join(', ')}`);
        continue;
      }
      seenTitleAuthor.add(titleAuthorKey);

      if (title) {
        const item = {
          title: title.trim(),
          authors: cleanAuthors,
          year: year,
          publisher: publisher.trim(),
          url: link.trim(),
          isbn: isbn,
          source: '国会図書館',
          isBook: true,
          originalData: {
            title,
            creator,
            publisher,
            date,
            issued,
            link,
            isbn
          }
        };
        items.push(item);
        console.log(`✅ アイテム追加:`, item.title, `(${item.year})`);
      } else {
        console.log(`⚠️ タイトルなしのためスキップ`);
      }
    }
    
    console.log(`🔍 NDL OpenSearch XML解析完了 - ${recordCount}件のレコードを処理、${items.length}件のアイテムを抽出`);
    return items;
    
  } catch (error) {
    console.error('❌ NDL OpenSearch XML解析エラー:', error);
    return [];
  }
}

/**
 * XMLから指定フィールドの値を抽出
 */
function extractXmlField(xml, fieldName) {
  const regex = new RegExp(`<${fieldName}[^>]*>(.*?)<\\/${fieldName}>`, 'gi');
  const match = xml.match(regex);
  if (match && match[0]) {
    return match[0].replace(/<[^>]+>/g, '').replace(/<!\\[CDATA\\[(.*?)\\]\\]>/g, '$1').trim();
  }
  return '';
}

app.listen(PORT, () => {
  console.log(`API Proxy server running on http://localhost:${PORT}`);
  console.log('API endpoints:');
  console.log(`  - CrossRef: http://localhost:${PORT}/api/crossref`);
  console.log(`  - Semantic Scholar: http://localhost:${PORT}/api/semantic-scholar`);
  console.log(`  - CiNii: http://localhost:${PORT}/api/cinii`);
  console.log(`  - NDL: http://localhost:${PORT}/api/ndl-search`);
});