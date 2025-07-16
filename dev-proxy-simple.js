const express = require('express');
const cors = require('cors');
const { parseString } = require('xml2js');

// Import unified formatters (note: using require for CommonJS compatibility)
const { formatCrossRefResponse } = require('./shared/utils/unifiedResponseFormatter.js');
const { formatGoogleBooksResponse } = require('./shared/utils/unifiedResponseFormatter.js');
const { formatSemanticScholarResponse } = require('./shared/utils/unifiedResponseFormatter.js');
const { formatCiNiiResponse } = require('./shared/utils/unifiedResponseFormatter.js');

// Enhanced NDL logic will be implemented inline due to CommonJS/ES6 compatibility

const app = express();
const PORT = 3001;

// CrossRefレート制限管理
let lastCrossRefRequestTime = 0;

// CORS設定
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

// Inline implementations to avoid import issues
// These match the production implementations exactly

// リトライ機能付きfetch関数
async function fetchWithRetry(url, options = {}, maxRetries = 3, retryDelay = 4000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒タイムアウト
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // 成功またはクライアントエラー（400系、429を除く）の場合はリトライしない
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
        return response;
      }
      
      // 503エラーのRetry-Afterヘッダー処理
      if (response.status === 503 && attempt < maxRetries) {
        const retryAfterHeader = response.headers.get('Retry-After');
        if (retryAfterHeader) {
          const retryAfterSeconds = parseInt(retryAfterHeader, 10);
          if (!isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
            const waitTime = retryAfterSeconds * 1000; // 秒をミリ秒に変換
            console.log(`⏳ 503 Retry-After: ${retryAfterSeconds}秒後に再試行 (${attempt}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
      }
      
      // 429エラー（Too Many Requests）のハンドリング
      if (response.status === 429 && attempt < maxRetries) {
        const retryAfterHeader = response.headers.get('Retry-After');
        let waitTime = 5000; // デフォルト5秒
        
        if (retryAfterHeader) {
          const retryAfterSeconds = parseInt(retryAfterHeader, 10);
          if (!isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
            waitTime = retryAfterSeconds * 1000;
          }
        }
        
        console.log(`⏳ 429 Too Many Requests: ${waitTime/1000}秒後に再試行 (${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // その他のサーバーエラー（500系）の場合のみリトライ
      if (attempt < maxRetries && response.status >= 500) {
        console.log(`🔄 API リトライ ${attempt}/${maxRetries} (${response.status}) - ${retryDelay/1000}秒後に再試行`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      
      return response;
      
    } catch (error) {
      // タイムアウトやネットワークエラーの場合もリトライ
      if (attempt < maxRetries) {
        console.log(`🔄 API リトライ ${attempt}/${maxRetries} (${error.message}) - ${retryDelay/1000}秒後に再試行`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      throw error;
    }
  }
}

// Production-equivalent API handlers
async function handleCrossRefSearch(query, rows = 10, doi = null) {
  try {
  let url;
  if (doi) {
    // DOI検索
    url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
    console.log(`🔍 CrossRef DOI検索: "${doi}"`);
  } else if (query) {
    // テキスト検索  
    url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${rows}&mailto=scriba@psycholo.studio`;
    console.log(`🔍 CrossRef検索: "${query}" (最大${rows}件)`);
  } else {
    throw new Error('Query or DOI parameter is required');
  }

  console.log(`🌐 CrossRef API Request: ${url}`);

  // レート制限：前回のリクエストから2秒間隔を確保
  const now = Date.now();
  const timeSinceLastRequest = now - lastCrossRefRequestTime;
  const minInterval = 2000; // 2秒
  
  if (timeSinceLastRequest < minInterval) {
    const waitTime = minInterval - timeSinceLastRequest;
    console.log(`⏳ CrossRef レート制限: ${waitTime}ms 待機中...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastCrossRefRequestTime = Date.now();

  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'CitationChecker/1.0 (https://github.com/psycholo-studio/citation-checker; mailto:psycholo.studio@gmail.com)'
    }
  });

  if (!response.ok) {
    console.error(`❌ CrossRef API error: ${response.status} ${response.statusText}`);
    throw new Error(`CrossRef API error: ${response.status} ${response.statusText}`);
  }

  console.log(`✅ CrossRef API レスポンス成功: ${response.status}`);
  const data = await response.json();
  
  console.log(`📄 CrossRef レスポンス構造:`, {
    hasMessage: !!data.message,
    hasItems: !!data.message?.items,
    itemCount: data.message?.items?.length || 0
  });
  
  const resultCount = doi ? (data.message ? 1 : 0) : (data.message?.items?.length || 0);
  console.log(`📊 CrossRef API レスポンス: ${resultCount}件受信`);
  
  // Convert to unified format
  if (doi && data.message) {
    const singleItemData = {
      message: { items: [data.message] },
      query: { doi, query, rows }
    };
    return formatCrossRefResponse(singleItemData);
  } else if (data.message?.items) {
    const searchData = { ...data, query: { doi, query, rows } };
    return formatCrossRefResponse(searchData);
  }
  
  return formatCrossRefResponse({ message: { items: [] }, query: { doi, query, rows } });
  
  } catch (error) {
    console.error('❌ CrossRef検索処理エラー:', error);
    console.error('❌ 検索パラメータ:', { query, rows, doi });
    throw error; // エラーを再スローして上位でキャッチ
  }
}

// CiNii検索関数（統一JSONフォーマット対応）
async function handleCiNiiSearch(q, count = 10, start = 1, lang = 'ja', format = 'rss') {
  if (!q) {
    throw new Error('Query parameter (q) is required');
  }

  console.log(`🔍 CiNii検索: "${q}" (件数:${count}, 開始:${start}, 言語:${lang})`);

  const searchParams = new URLSearchParams({
    q: q,
    count: count.toString(),
    start: start.toString(),
    lang,
    format
  });

  const url = `https://cir.nii.ac.jp/opensearch/articles?${searchParams.toString()}`;
  console.log(`🌐 CiNii API Request: ${url}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/rss+xml, application/xml, text/xml',
      'User-Agent': 'LiteratureVerifier/1.0'
    }
  });

  if (!response.ok) {
    console.error(`❌ CiNii API error: ${response.status} ${response.statusText}`);
    throw new Error(`CiNii API error: ${response.status} ${response.statusText}`);
  }

  const xmlText = await response.text();
  console.log(`📊 CiNii API レスポンス: ${xmlText.length}バイト受信`);

  // XMLをパースして統一JSONフォーマットに変換
  const results = parseCiNiiXmlResponse(xmlText);
  console.log(`📚 CiNii パース結果: ${results.length}件`);

  return {
    results: results,
    source: 'CiNii',
    query: { q, count, start, lang, format }
  };
}

// CiNii XMLパーサー
function parseCiNiiXmlResponse(xmlText) {
  try {
    const results = [];
    
    // <item>要素を抽出
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
    let match;
    
    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemXml = match[1];
      
      // 基本情報を抽出
      const titles = extractXmlField(itemXml, 'title');
      const title = titles[0] || '';
      
      // 著者情報を抽出 (dc:creator)
      const creators = extractXmlField(itemXml, 'dc:creator');
      const authors = normalizeAuthors(creators);
      
      // 掲載誌名を抽出 (prism:publicationName)
      const journalFields = extractXmlField(itemXml, 'prism:publicationName');
      const journal = journalFields[0] || '';
      
      // 出版年を抽出
      let year = '';
      const dateSelectors = ['prism:publicationDate', 'dc:date', 'prism:datePublished', 'pubDate'];
      
      for (const selector of dateSelectors) {
        const dateFields = extractXmlField(itemXml, selector);
        if (dateFields.length > 0) {
          const yearMatch = dateFields[0].match(/\d{4}/);
          if (yearMatch) {
            year = yearMatch[0];
            break;
          }
        }
      }
      
      // URL, DOI, 出版社, 巻号情報を抽出
      const linkFields = extractXmlField(itemXml, 'link');
      const url = linkFields[0] || '';
      
      const identifierFields = extractXmlField(itemXml, 'dc:identifier');
      const doi = Array.isArray(identifierFields) ? 
        identifierFields.find(id => id && id.includes('doi.org')) || '' : '';
      
      let publisher = '';
      const publisherSelectors = ['dc:publisher', 'prism:publisher'];
      for (const selector of publisherSelectors) {
        const publisherFields = extractXmlField(itemXml, selector);
        if (publisherFields.length > 0) {
          publisher = publisherFields[0];
          break;
        }
      }
      
      if (title) {
        results.push({
          title,
          authors,
          year,
          doi,
          journal,
          publisher,
          url,
          source: 'CiNii'
        });
      }
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ CiNii XML パースエラー:', error);
    return [];
  }
}

// XMLフィールド抽出関数
function extractXmlField(xml, fieldName) {
  const regex = new RegExp(`<${fieldName}[^>]*>(.*?)<\\/${fieldName}>`, 'gi');
  const matches = xml.match(regex);
  if (!matches) return [];
  
  return matches.map(match => 
    match.replace(/<[^>]+>/g, '').replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim()
  );
}

// 著者名正規化関数
function normalizeAuthors(authorArray) {
  if (!Array.isArray(authorArray)) return [];
  
  return authorArray
    .filter(author => author && typeof author === 'string')
    .map(author => {
      let cleanAuthor = author
        .replace(/\[.*?\]/g, '') // 役割表記を削除
        .replace(/・\d{4}-?[\d]*$/, '') // 生年を削除
        .replace('／', '') // スラッシュを削除
        .trim();
      
      // 「MILLER G. A.」形式 - ファミリーネーム＋イニシャル（カンマなし）
      if (cleanAuthor.match(/^[A-Z][A-Z\s]+\s+[A-Z]\.\s*[A-Z]\.?\s*$/)) {
        console.log(`📝 ファミリーネーム＋イニシャル形式: "${cleanAuthor}"`);
        const parts = cleanAuthor.split(/\s+/);
        const lastName = parts[0];
        const initials = parts.slice(1).join(' ');
        const result = `${initials} ${lastName}`;
        console.log(`📝 処理結果: "${result}"`);
        return result;
      }
      
      return cleanAuthor;
    })
    .filter(author => author.length > 0);
}

async function handleSemanticScholarSearch(query, fields = 'title,url,publicationTypes,publicationDate,venue,journal,authors,abstract,citationCount,externalIds', limit = 10) {
  if (!query) {
    throw new Error('Query parameter is required');
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
    throw new Error(`Semantic Scholar API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // Convert to unified format
  const queryData = {
    ...data,
    query: { query, fields, limit }
  };
  
  return formatSemanticScholarResponse(queryData);
}

// Publisher name cleaning for dev proxy
function cleanPublisherNameDevProxy(publisher) {
  if (!publisher || typeof publisher !== 'string') return '';
  
  // 「地名 : 出版社名」パターンを処理
  const cleaned = publisher
    .replace(/^[^:：]+[：:]\s*/, '') // 地名部分を削除（例：「東京 : 大法輪閣」→「大法輪閣」）
    .replace(/^\s*\[.*?\]\s*/, '') // 先頭の角括弧を削除
    .replace(/\s*\[.*?\]\s*$/, '') // 末尾の角括弧を削除
    .trim();
  
  // console.log(`📍 出版社名クリーニング (dev-proxy): "${publisher}" → "${cleaned}"`);
  return cleaned || publisher; // クリーニング後が空の場合は元の値を返す
}

// Journal name cleaning - remove English translation after "="
function cleanJournalName(journalName) {
  if (!journalName) return '';
  
  // "= 英語名" の部分を削除
  const cleanedName = journalName.split(' = ')[0].trim();
  
  // 余分な記号や空白を削除
  return cleanedName
    .replace(/\s+/g, ' ')  // 連続スペースを単一スペースに
    .trim();
}

// Author normalization utilities
function splitAndNormalizeAuthors(authorsString) {
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
}

function normalizeAuthorName(authorName) {
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
      // 日本語の場合
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
  
  // 5. 生年・生没年を削除
  cleanAuthor = cleanAuthor.replace(/・\d{4}-?[\d]*$/, '').trim();
  
  // 6. 単独著者（姓／名形式）
  if (cleanAuthor.includes('／')) {
    cleanAuthor = cleanAuthor.replace('／', '');
  }
  
  // 7. 中黒で区切られた名前（日本語のみ結合）
  if (cleanAuthor.includes('・') && /[\u4E00-\u9FAF\u3040-\u309F\u30A0-\u30FF]/.test(cleanAuthor)) {
    // 複数著者でない場合のみ結合
    if (!cleanAuthor.match(/[^・]+・[^・]+・[^・]+/)) {
      cleanAuthor = cleanAuthor.replace(/・/g, '');
    }
  }
  
  // 8. 日本語スペース区切り（姓 名）
  if (cleanAuthor.match(/^[\u4E00-\u9FAF\u3040-\u309F\u30A0-\u30FF]+\s+[\u4E00-\u9FAF\u3040-\u309F\u30A0-\u30FF]+$/)) {
    cleanAuthor = cleanAuthor.replace(/\s+/g, '');
  }
  
  return cleanAuthor.trim();
}

// XML field extraction
function extractXmlField(xml, fieldName) {
  const regex = new RegExp(`<${fieldName}[^>]*>(.*?)<\\/${fieldName}>`, 'gi');
  const match = xml.match(regex);
  if (match && match[0]) {
    return match[0].replace(/<[^>]+>/g, '').replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
  }
  return '';
}

// Full NDL handler with production-level XML parsing
async function handleNDLSearch(title, creator = null) {
  if (!title) {
    throw new Error('タイトルパラメータが必要です');
  }

  console.log('🏛️ NDL検索リクエスト:', { title, creator });

  const baseUrl = 'https://ndlsearch.ndl.go.jp/api/opensearch';
  const searchParams = new URLSearchParams({
    cnt: '20'
  });
  
  if (title) {
    searchParams.append('title', title);
  }
  
  if (creator) {
    searchParams.append('creator', creator);
  }

  const ndlUrl = `${baseUrl}?${searchParams.toString()}`;
  console.log('🔗 NDL API URL:', ndlUrl);

  const response = await fetch(ndlUrl, {
    headers: {
      'User-Agent': 'Literature-Verifier/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`NDL API error: ${response.status} ${response.statusText}`);
  }

  const xmlData = await response.text();
  console.log('📄 NDL SRU API レスポンス取得済み');
  console.log(`📄 XML長さ: ${xmlData.length}バイト`);
  console.log(`📄 XMLサンプル（最初の1000文字）:`, xmlData.substring(0, 1000));

  // Production-level XML parsing with deduplication
  const items = [];
  const seenISBNs = new Set(); // ISBN重複チェック用
  const seenTitleAuthor = new Set(); // タイトル+著者の重複チェック用
  
  console.log('🔍 NDL OpenSearch XML解析開始');
  
  // OpenSearch形式：<item>要素を抽出
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
  let match;
  let recordCount = 0;
  
  while ((match = itemRegex.exec(xmlData)) !== null) {
    recordCount++;
    const itemXml = match[1];
    
    console.log(`🔍 NDL項目 ${recordCount} を処理中...`);
    
    // Dublin Core形式のメタデータを抽出
    const title = extractXmlField(itemXml, 'dc:title') || 
                 extractXmlField(itemXml, 'title') || '';
    const creator = extractXmlField(itemXml, 'dc:creator') || 
                   extractXmlField(itemXml, 'author') || '';
    const publisher = extractXmlField(itemXml, 'dc:publisher') || '';
    
    // カテゴリ情報（記事 vs 図書の判定用）
    const category = extractXmlField(itemXml, 'category') || '';
    
    // 説明情報（掲載誌記事の場合の掲載誌情報）
    const description = extractXmlField(itemXml, 'dc:description') || '';
    
    // 年度情報の優先順位での取得
    const dcDate = extractXmlField(itemXml, 'dc:date') || '';
    const dctermsIssued = extractXmlField(itemXml, 'dcterms:issued') || '';
    
    // console.log(`📚 NDL項目解析:`, {
    //   title: title.substring(0, 50),
    //   creator: creator.substring(0, 50),
    //   publisher: publisher,
    //   dcDate: dcDate,
    //   dctermsIssued: dctermsIssued
    // });
    
    // 年度の抽出（優先順位: dc:date → dcterms:issued）
    let year = '';
    if (dcDate) {
      const yearMatch = dcDate.match(/(\d{4})/);
      year = yearMatch ? yearMatch[1] : '';
    }
    
    // dc:dateが空またはパターンにマッチしない場合、dcterms:issuedから抽出
    if (!year && dctermsIssued) {
      const yearMatch = dctermsIssued.match(/(\d{4})/);
      year = yearMatch ? yearMatch[1] : '';
    }
    
    const link = extractXmlField(itemXml, 'link') || '';
    const guid = extractXmlField(itemXml, 'guid') || '';
    
    // 記事か図書かの判定
    const isArticle = category.includes('記事');
    
    // デバッグ情報を出力
    console.log(`🔍 NDL項目解析: "${title.substring(0, 30)}"`, {
      category,
      isArticle,
      description: description ? description.substring(0, 100) : 'なし'
    });
    
    // ISBN情報を取得・検証
    let isbn = '';
    const isbnCandidates = [
      extractXmlField(itemXml, 'dc:identifier'),
      extractXmlField(itemXml, 'identifier')
    ].filter(Boolean);
    
    for (const candidate of isbnCandidates) {
      // ISBN形式の検証（10桁または13桁）
      const isbnMatch = candidate.match(/(?:ISBN[:\s]*)?(\d{9}[\dX]|\d{13})/i);
      if (isbnMatch) {
        const cleanISBN = isbnMatch[1];
        if (!seenISBNs.has(cleanISBN)) {
          isbn = cleanISBN;
          seenISBNs.add(cleanISBN);
          break;
        } else {
          continue;
        }
      }
    }
    
    // 掲載誌記事の場合の掲載誌情報解析
    let journal = '';
    let volume = '';
    let pages = '';
    
    if (isArticle && description) {
      // NDLの実際のパターンに基づく掲載誌情報抽出（後ろから解析）
      const patterns = [
        // 基本パターン：掲載誌：掲載誌名 巻号 p.ページ
        /掲載誌[：:](.+?)\s+(\d+)\s+p\.?([0-9p\-\~～]+)$/,
        // 通号パターン：掲載誌：掲載誌名(通号 番号) p.ページ
        /掲載誌[：:](.+?)\(通号\s*(\d+)\)\s+p\.?([0-9p\-\~～]+)$/,
        // 年度パターン：掲載誌：掲載誌名 年度 p.ページ
        /掲載誌[：:](.+?)\s+(\d{4})\s+p\.?([0-9\-\~～]+)$/,
        // 0巻パターン：掲載誌：掲載誌名 0 年度 p.ページ (学会論文集など)
        /掲載誌[：:](.+?)\s+0\s+(\d{4})\s+p\.?([0-9A-Za-z\-\~～]+)$/,
        // ページのみパターン：掲載誌：掲載誌名 p.ページ
        /掲載誌[：:](.+?)\s+p\.?([0-9\-\~～]+)$/,
        // 編者パターン：掲載誌：掲載誌名 / 編者 [編] p.ページ
        /掲載誌[：:](.+?)\s*\/\s*[^[]+\[編\]\s+p\.?([0-9\-\~～]+)$/
      ];
      
      for (const pattern of patterns) {
        const match = description.match(pattern);
        if (match) {
          const rawJournal = match[1].trim();
          journal = cleanJournalName(rawJournal); // 掲載誌名クリーニング
          
          if (match.length === 4) {
            // 巻号・年度・通号がある場合
            volume = match[2];
            pages = match[3].replace(/^p+/, '');
          } else if (match.length === 3) {
            // ページのみの場合
            pages = match[2].replace(/^p+/, '');
          }
          
          console.log(`📰 NDL掲載誌記事解析成功: "${journal}" vol.${volume || 'なし'} p.${pages}`);
          break;
        }
      }
      
      // パターンマッチに失敗した場合のログ
      if (!journal && description.includes('掲載誌')) {
        console.log(`⚠️ NDL掲載誌記事パターン未対応: "${description}"`);
      }
    }
    
    
    // 著者名のクリーニング
    // console.log(`📝 著者フィールド処理開始: "${creator}"`);
    const cleanAuthors = splitAndNormalizeAuthors(creator);
    // console.log(`📝 著者名クリーニング完了: "${creator}" → [${cleanAuthors.join(', ')}]`);

    // タイトル+著者による重複チェック
    const titleAuthorKey = `${title.trim()}_${cleanAuthors.join('_')}`;
    if (seenTitleAuthor.has(titleAuthorKey)) {
      // console.log(`⚠️ タイトル+著者の重複のためスキップ: ${title} / ${cleanAuthors.join(', ')}`);
      continue;
    }
    seenTitleAuthor.add(titleAuthorKey);

    if (title && title.trim().length > 0) {
      items.push({
        title: title.trim(),
        authors: cleanAuthors,
        year: year,
        doi: '', // NDLはDOIを提供しない
        journal: isArticle ? journal : '', // 記事の場合は掲載誌名、書籍の場合は空
        publisher: isArticle ? '' : publisher.trim(), // 記事の場合は空、書籍の場合は出版社
        volume: volume,
        issue: '', // NDLでは号の情報は通常取得できない
        pages: pages,
        url: link || guid || '',
        isbn: isbn,
        source: 'NDL',
        isBook: !isArticle,
        isBookChapter: false,
        bookTitle: '',
        editors: [],
        originalData: {
          title,
          creator,
          publisher,
          dcDate,
          dctermsIssued,
          link,
          guid,
          isbn,
          category,
          description,
          isArticle
        }
      });
      
      const displayInfo = isArticle ? journal : publisher.trim();
      console.log(`✅ NDL項目追加: "${title.trim()}" (${year}) - ${displayInfo} ${isArticle ? '[記事]' : '[図書]'}`);
    }
  }
  
  console.log(`📊 NDL OpenSearch解析完了: ${items.length}件`);
  
  return {
    results: items,
    source: 'ndl',
    query: { title, creator }
  };
}

async function handleGoogleBooksSearch(q, maxResults = 20, startIndex = 0) {
  if (!q) {
    throw new Error('Query parameter "q" is required');
  }

  console.log(`🔍 Google Books検索: "${q}"`);

  const baseUrl = 'https://www.googleapis.com/books/v1/volumes';
  const params = new URLSearchParams({
    q: q,
    maxResults: Math.min(parseInt(maxResults), 40),
    startIndex: parseInt(startIndex),
    fields: 'items(id,selfLink,volumeInfo(title,subtitle,authors,publishedDate,publisher,industryIdentifiers,pageCount,categories,language,description))',
    printType: 'books'
  });

  const requestUrl = `${baseUrl}?${params}`;
  console.log(`🌐 Google Books API Request: ${requestUrl}`);

  const response = await fetchWithRetry(requestUrl, {
    headers: {
      'User-Agent': 'Literature-Verifier/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`Google Books API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // 詳細情報を取得するため、各アイテムのselfLinkを使用
  if (data.items && data.items.length > 0) {
    console.log(`📚 Google Books: selfLinkを使って詳細情報を取得中... (${data.items.length}件)`);
    
    const detailPromises = data.items.slice(0, 10).map(async (item, index) => {
      try {
        console.log(`🔍 項目 ${index + 1}: selfLink確認中...`);
        // console.log(`   - ID: ${item.id}`);
        console.log(`   - selfLink: ${item.selfLink || 'なし'}`);
        console.log(`   - 元の出版社: ${item.volumeInfo?.publisher || 'なし'}`);
        
        if (item.selfLink) {
          console.log(`🌐 詳細API呼び出し: ${item.selfLink}`);
          const detailResponse = await fetchWithRetry(item.selfLink, {
            headers: {
              'User-Agent': 'Literature-Verifier/1.0'
            }
          });
          
          // console.log(`📡 詳細APIレスポンス: ${detailResponse.status} ${detailResponse.statusText}`);
          
          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            // console.log(`📖 詳細取得成功: "${detailData.volumeInfo?.title}" - 出版社: ${detailData.volumeInfo?.publisher || 'なし'}`);
            // console.log(`📊 詳細情報フィールド:`, {
            //   publisher: detailData.volumeInfo?.publisher,
            //   publishedDate: detailData.volumeInfo?.publishedDate,
            //   industryIdentifiers: detailData.volumeInfo?.industryIdentifiers?.length || 0,
            //   pageCount: detailData.volumeInfo?.pageCount
            // });
            return detailData;
          } else {
            console.log(`⚠️ 詳細取得失敗: ${item.selfLink} (${detailResponse.status})`);
            return item; // 詳細取得失敗時は元のデータを返す
          }
        } else {
          console.log(`⚠️ selfLinkが存在しません`);
          return item;
        }
      } catch (error) {
        console.error(`❌ 詳細情報取得エラー (項目 ${index + 1}): ${error.message}`);
        return item; // エラー時は元のデータを返す
      }
    });
    
    // 全ての詳細情報取得を待つ
    console.log(`⏳ 全ての詳細情報取得を待機中...`);
    const detailedItems = await Promise.all(detailPromises);
    data.items = detailedItems;
    console.log(`✅ 詳細情報取得完了: ${detailedItems.length}件`);
  } else {
    console.log(`⚠️ Google Books: アイテムが見つかりません`);
  }
  
  console.log(`📊 Google Books APIレスポンス: ${data.items?.length || 0}件`);

  // Convert to unified format
  const queryData = {
    ...data,
    query: { q, maxResults, startIndex }
  };
  
  return formatGoogleBooksResponse(queryData);
}

// CrossRef API
app.get('/api/crossref', async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    const { query, rows = 10, doi } = req.query;
    const data = await handleCrossRefSearch(query, rows, doi);
    res.status(200).json(data);

  } catch (error) {
    console.error('❌ CrossRef API Error:', error);
    console.error('❌ CrossRef エラー詳細:', {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
    res.status(500).json({ 
      error: 'CrossRef検索でエラーが発生しました', 
      details: error.message 
    });
  }
});

// Semantic Scholar API
app.get('/api/semantic-scholar', async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

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
});

// CiNii API - 統一JSONフォーマット対応
app.get('/api/cinii', async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    const { q, count = 10, start = 1, lang = 'ja', format = 'rss' } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Query parameter (q) is required' });
    }

    const data = await handleCiNiiSearchNew(q, count, start, lang, format);
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

// 新しいCiNii API関数（xml2jsベース、記事+書籍統合検索）
async function handleCiNiiSearchNew(q, count = 10, start = 1, lang = 'ja', format = 'rss') {
  console.log(`🔍 CiNii統合検索: "${q}" (件数:${count}, 開始:${start}, 言語:${lang})`);

  const searchParams = new URLSearchParams({
    q: q,
    count: count.toString(),
    start: start.toString(),
    lang,
    format
  });

  const url = `https://cir.nii.ac.jp/opensearch/all?${searchParams.toString()}`;
  console.log(`🌐 CiNii API Request (all): ${url}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/rss+xml, application/xml, text/xml',
      'User-Agent': 'LiteratureVerifier/1.0'
    }
  });

  if (!response.ok) {
    console.error(`❌ CiNii API error: ${response.status} ${response.statusText}`);
    throw new Error(`CiNii API error: ${response.status} ${response.statusText}`);
  }

  const xmlText = await response.text();
  console.log(`📊 CiNii API レスポンス: ${xmlText.length}バイト受信`);

  return new Promise((resolve, reject) => {
    parseString(xmlText, { explicitArray: true }, (err, result) => {
      if (err) {
        console.error('❌ CiNii XML パースエラー:', err);
        reject(err);
        return;
      }

      try {
        const results = [];
        
        if (result && result['rdf:RDF'] && result['rdf:RDF'].item) {
          const items = result['rdf:RDF'].item;
          console.log(`📊 CiNii アイテム数: ${items.length}件`);
          
          for (const item of items) {
            const title = item.title && item.title[0] ? item.title[0] : '';
            if (!title) continue;
            
            // dc:typeフィールドで記事/書籍を判別
            const dcType = item['dc:type'] && item['dc:type'][0] || '';
            const isBook = dcType === 'Book';
            const isArticle = dcType === 'Article';
            
            console.log(`🔍 CiNii項目解析: "${title.substring(0, 30)}" - dc:type: "${dcType}" (${isBook ? '書籍' : '記事'})`);
            
            const creators = item['dc:creator'] || [];
            const authors = creators.map(creator => creator.trim()).filter(author => author.length > 0);
            
            const publicationDate = item['prism:publicationDate'] && item['prism:publicationDate'][0] || '';
            const year = publicationDate.match(/\d{4}/) ? publicationDate.match(/\d{4}/)[0] : '';
            
            const url = item.link && item.link[0] ? item.link[0] : '';
            const rawPublisher = item['dc:publisher'] && item['dc:publisher'][0] || '';
            const publisher = cleanPublisherNameDevProxy(rawPublisher);
            
            // 掲載誌名を抽出 (prism:publicationName を優先)
            const publicationName = item['prism:publicationName'] && item['prism:publicationName'][0] || '';
            
            // 巻号・ページ情報を抽出
            const volume = item['prism:volume'] && item['prism:volume'][0] || '';
            const issue = item['prism:number'] && item['prism:number'][0] || '';
            const startPage = item['prism:startingPage'] && item['prism:startingPage'][0] || '';
            const endPage = item['prism:endingPage'] && item['prism:endingPage'][0] || '';
            
            // ページ範囲を構築
            let pages = '';
            if (startPage && endPage && startPage !== endPage && startPage !== '-') {
              pages = `${startPage}-${endPage}`;
            } else if (startPage && startPage !== '-') {
              pages = startPage;
            }
            
            const identifiers = item['dc:identifier'] || [];
            let doi = '';
            for (const identifier of identifiers) {
              // xml2jsではidentifierが文字列またはオブジェクトの可能性がある
              const idString = typeof identifier === 'string' ? identifier : (identifier._ || identifier);
              if (idString && typeof idString === 'string' && (idString.includes('doi.org') || idString.startsWith('10.'))) {
                doi = idString;
                break;
              }
            }
            
            results.push({
              title,
              authors,
              year,
              doi,
              journal: isArticle ? (publicationName || publisher) : '', // 記事の場合は掲載誌名
              publisher: isBook ? publisher : '', // 書籍の場合は出版社
              volume,
              issue,
              pages,
              url,
              isbn: '', // CiNiiは通常ISBNを提供しない
              source: 'CiNii',
              isBook,
              isBookChapter: false,
              bookTitle: '',
              editors: [],
              originalData: {
                title,
                creators,
                publisher,
                rawPublisher,
                publicationName,
                volume,
                issue,
                pages,
                url,
                doi,
                publicationDate,
                dcType,
                isBook,
                isArticle
              }
            });
            
            // console.log(`✅ CiNii項目追加: "${title.substring(0, 50)}..." (${year}) - ${publisher}`);
          }
        }
        
        console.log(`📊 CiNii XML解析完了: ${results.length}件の結果を抽出`);
        resolve({
          results: results,
          source: 'CiNii',
          query: { q, count, start, lang, format }
        });
        
      } catch (error) {
        console.error('❌ CiNii 結果処理エラー:', error);
        reject(error);
      }
    });
  });
}

// NDL Search API  
app.get('/api/ndl-search', async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    const { title, creator } = req.query;
    const data = await handleNDLSearch(title, creator);
    res.status(200).json(data);

  } catch (error) {
    console.error('❌ NDL API エラー:', error);
    res.status(500).json({ 
      error: 'NDL検索でエラーが発生しました',
      details: error.message 
    });
  }
});

// Google Books API
app.get('/api/google-books', async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    const { q, maxResults = 20, startIndex = 0 } = req.query;
    const data = await handleGoogleBooksSearch(q, maxResults, startIndex);
    res.status(200).json(data);

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
  console.log('🔄 Loading shared API handlers...');
});