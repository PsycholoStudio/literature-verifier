/**
 * 国会図書館検索API プロキシ
 * Vercel Serverless Function
 */

/**
 * 国会図書館検索API を呼び出し、書籍データを取得
 */
async function handleNDLSearch(title, creator) {
  if (!title) {
    throw new Error('タイトルパラメータが必要です');
  }

  console.log('🏛️ NDL検索リクエスト:', { title, creator });

  // 国会図書館OpenSearch APIのベースURL（開発環境と同じ）
  const baseUrl = 'https://ndlsearch.ndl.go.jp/api/opensearch';
  
  // OpenSearch検索パラメータの構築
  const searchParams = new URLSearchParams({
    cnt: '20' // 最大取得件数
  });
  
  // タイトル検索パラメータ
  if (title) {
    searchParams.append('title', title);
  }
  
  // 著者検索パラメータ
  if (creator) {
    searchParams.append('creator', creator);
  }

  const url = `${baseUrl}?${searchParams.toString()}`;
  console.log('🔗 NDL API URL:', url);

  // 国会図書館APIへのリクエスト
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CitationChecker/1.0; +https://citation-checker.psycholo.studio)'
    }
  });

  if (!response.ok) {
    console.error(`❌ NDL API error: ${response.status} ${response.statusText}`);
    throw new Error(`NDL API error: ${response.status} ${response.statusText}`);
  }

  const xmlText = await response.text();
  console.log('📄 NDL API レスポンス取得済み');

  // XMLをパースして統一JSONフォーマットに変換
  const results = parseNDLOpenSearchResponse(xmlText);
  console.log(`📚 NDL パース結果: ${results.length}件`);

  return {
    results: results,
    source: 'NDL',
    query: { title, creator }
  };
}

/**
 * XMLから指定フィールドの値を抽出
 */
function extractXmlField(xml, fieldName) {
  const regex = new RegExp(`<${fieldName}[^>]*>(.*?)<\\/${fieldName}>`, 'gi');
  const match = xml.match(regex);
  if (match && match[0]) {
    return match[0].replace(/<[^>]+>/g, '').replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
  }
  return '';
}

/**
 * 著者名正規化（簡易版）
 */
function splitAndNormalizeAuthors(authorString) {
  if (!authorString || typeof authorString !== 'string') {
    return [];
  }

  // 複数の区切り文字で分割
  const separators = /[;；,，\/|・]/;
  const authors = authorString.split(separators);
  
  return authors
    .map(author => {
      let cleanAuthor = author
        .replace(/\[.*?\]/g, '') // 役割表記を削除
        .replace(/・\d{4}-?[\d]*$/, '') // 生年を削除
        .replace('／', '') // スラッシュを削除
        .trim();
      
      return cleanAuthor;
    })
    .filter(author => author.length > 0);
}

/**
 * NDL OpenSearch APIのXMLレスポンスを統一フォーマットにパース
 */
function parseNDLOpenSearchResponse(xmlData) {
  try {
    const items = [];
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
      
      // 年度情報の優先順位での取得
      const dcDate = extractXmlField(itemXml, 'dc:date') || '';
      const dctermsIssued = extractXmlField(itemXml, 'dcterms:issued') || '';
      
      // 年度の抽出（複数のパターンを試行）
      let year = '';
      
      if (dctermsIssued) {
        const yearMatch = dctermsIssued.match(/\d{4}/);
        if (yearMatch) {
          year = yearMatch[0];
          console.log(`📅 年度抽出(dcterms:issued): "${dctermsIssued}" → ${year}`);
        }
      }
      
      if (!year && dcDate) {
        const yearMatch = dcDate.match(/\d{4}/);
        if (yearMatch) {
          year = yearMatch[0];
          console.log(`📅 年度抽出(dc:date): "${dcDate}" → ${year}`);
        }
      }
      
      // リンク情報を取得
      const link = extractXmlField(itemXml, 'link') || '';
      const guid = extractXmlField(itemXml, 'guid') || '';
      
      // 著者名のクリーニング
      const cleanAuthors = splitAndNormalizeAuthors(creator);

      // 記事か図書かの判定
      const isArticle = category.includes('記事');
      
      // デバッグ情報を出力
      console.log(`🔍 NDL項目解析: "${title.substring(0, 30)}"`, {
        category,
        isArticle,
        cleanAuthors: cleanAuthors.join(', ')
      });

      // タイトル+著者による重複チェック
      const titleAuthorKey = `${title.trim()}_${cleanAuthors.join('_')}`;
      if (seenTitleAuthor.has(titleAuthorKey)) {
        continue;
      }
      seenTitleAuthor.add(titleAuthorKey);

      if (title && title.trim().length > 0) {
        items.push({
          title: title.trim(),
          authors: cleanAuthors,
          year: year,
          doi: '', // NDLはDOIを提供しない
          journal: isArticle ? publisher : '', // 記事の場合は出版社を掲載誌として扱う
          publisher: isArticle ? '' : publisher.trim(), // 記事の場合は空、書籍の場合は出版社
          volume: '',
          issue: '',
          pages: '',
          url: link || guid || '',
          isbn: '',
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
            category,
            isArticle
          }
        });
        
        const displayInfo = isArticle ? publisher : publisher.trim();
        console.log(`✅ NDL項目追加: "${title.trim()}" (${year}) - ${displayInfo} ${isArticle ? '[記事]' : '[図書]'}`);
      }
    }
    
    console.log(`📊 NDL OpenSearch解析完了: ${items.length}件`);
    return items;
    
  } catch (error) {
    console.error('❌ NDL XML パースエラー:', error);
    return [];
  }
}

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