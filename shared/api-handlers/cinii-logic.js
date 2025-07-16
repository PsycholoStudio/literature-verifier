/**
 * CiNii API ロジック
 * XMLパーサーを使用してXMLレスポンスを統一JSONフォーマットに変換
 */

import { parseString } from 'xml2js';
import { promisify } from 'util';

const parseXMLAsync = promisify(parseString);

/**
 * 著者名正規化（詳細版）
 */
function normalizeAuthors(authorArray) {
  if (!Array.isArray(authorArray)) {
    return typeof authorArray === 'string' ? [normalizeAuthor(authorArray)] : [];
  }
  
  return authorArray
    .filter(author => author && typeof author === 'string')
    .map(normalizeAuthor)
    .filter(author => author.length > 0);
}

/**
 * 単一著者名の正規化
 */
function normalizeAuthor(author) {
  if (!author || typeof author !== 'string') return '';
  
  let cleanAuthor = author
    .replace(/\[.*?\]/g, '') // 役割表記を削除 [編集], [翻訳]など
    .replace(/・\d{4}-?[\d]*$/, '') // 生年を削除 ・1980-2020
    .replace(/（.*?）/g, '') // 括弧内の補足情報を削除
    .replace(/\(.*?\)/g, '') // 英語括弧内の補足情報を削除
    .replace(/／/g, '') // スラッシュを削除
    .replace(/\s+/g, ' ') // 複数スペースを単一スペースに
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
}

/**
 * 出版社名から地名を除去
 */
function cleanPublisherName(publisher) {
  if (!publisher || typeof publisher !== 'string') return '';
  
  // 「地名 : 出版社名」パターンを処理
  const cleaned = publisher
    .replace(/^[^:：]+[：:]\s*/, '') // 地名部分を削除（例：「東京 : 大法輪閣」→「大法輪閣」）
    .replace(/^\s*\[.*?\]\s*/, '') // 先頭の角括弧を削除
    .replace(/\s*\[.*?\]\s*$/, '') // 末尾の角括弧を削除
    .trim();
  
  // console.log(`📍 出版社名クリーニング: "${publisher}" → "${cleaned}"`);
  return cleaned || publisher; // クリーニング後が空の場合は元の値を返す
}

/**
 * 出版年を抽出・正規化
 */
function extractYear(dateString) {
  if (!dateString) return '';
  
  // YYYY-MM, YYYY/MM, YYYY年MM月などの形式から年を抽出
  const yearMatch = dateString.match(/(\d{4})/);
  return yearMatch ? yearMatch[1] : '';
}

/**
 * XMLから安全にテキスト内容を取得
 */
function safeGetText(obj, path) {
  if (!obj) return '';
  
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return '';
    }
  }
  
  if (Array.isArray(current)) {
    return current.length > 0 ? String(current[0]).trim() : '';
  }
  
  return current ? String(current).trim() : '';
}

/**
 * 配列形式でテキスト内容を取得
 */
function safeGetArray(obj, path) {
  if (!obj) return [];
  
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return [];
    }
  }
  
  if (Array.isArray(current)) {
    return current.map(item => String(item).trim()).filter(item => item.length > 0);
  }
  
  return current ? [String(current).trim()] : [];
}

/**
 * CiNii APIを呼び出し、統一JSONフォーマットで結果を取得
 * フィールド指定検索に対応（title, creator, publicationTitle）
 */
export async function handleCiNiiSearch(q, count = 10, start = 1, lang = 'ja', format = 'rss', options = {}) {
  // qまたはoptionsのいずれかが必要
  if (!q && !options.title && !options.creator) {
    throw new Error('Query parameter (q) or field options (title/creator) are required');
  }

  console.log(`🔍 CiNii統合検索: "${q || 'フィールド指定'}" (件数:${count}, 開始:${start}, 言語:${lang})`);
  
  const searchParams = new URLSearchParams({
    appid: 'literature-verifier', // 必須のアプリケーションID
    count: count.toString(),
    start: start.toString(),
    lang,
    format
  });

  // フィールド指定検索の場合
  if (options.title || options.creator || options.publicationTitle) {
    console.log(`🎯 CiNiiフィールド指定検索:`);
    
    if (options.title) {
      searchParams.append('title', options.title);
      console.log(`   タイトル: "${options.title}"`);
    }
    
    if (options.creator) {
      searchParams.append('creator', options.creator);  // 正しいパラメータ名
      console.log(`   著者: "${options.creator}"`);
    }
    
    if (options.publicationTitle) {
      searchParams.append('publicationTitle', options.publicationTitle);
      console.log(`   掲載誌名: "${options.publicationTitle}"`);
    }
    
  } else {
    // 従来のフリーワード検索
    searchParams.append('q', q);
    console.log(`🔍 CiNiiフリーワード検索: "${q}"`);
  }

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
  console.log(`📄 CiNii XML内容サンプル:`, xmlText.substring(0, 1000));

  // XMLをパースして統一JSONフォーマットに変換
  const results = await parseCiNiiXmlResponse(xmlText);
  console.log(`📚 CiNii パース結果: ${results.length}件`);

  return {
    results: results,
    source: 'CiNii',
    query: { q, count, start, lang, format }
  };
}

/**
 * CiNii RSS/XMLレスポンスをXMLパーサーで統一フォーマットにパース
 */
async function parseCiNiiXmlResponse(xmlText) {
  try {
    console.log(`🔍 CiNii XML解析開始: ${xmlText.length}バイト`);
    
    // XMLをパース（名前空間付きXMLに対応）
    const parsedXml = await parseXMLAsync(xmlText, {
      explicitArray: true,
      ignoreAttrs: false,
      mergeAttrs: false,
      tagNameProcessors: [],
      attrNameProcessors: [],
      valueProcessors: [],
      attrValueProcessors: []
    });
    
    console.log('🔍 パースされたXMLの構造:', JSON.stringify(Object.keys(parsedXml || {}), null, 2));
    if (parsedXml && parsedXml['rdf:RDF']) {
      console.log('🔍 rdf:RDF内の構造:', JSON.stringify(Object.keys(parsedXml['rdf:RDF']), null, 2));
    }
    
    const results = [];
    
    // RDF形式のCiNii XMLから項目を抽出
    let items = [];
    if (parsedXml && parsedXml['rdf:RDF']) {
      const rdfData = Array.isArray(parsedXml['rdf:RDF']) ? parsedXml['rdf:RDF'][0] : parsedXml['rdf:RDF'];
      
      if (rdfData.item) {
        items = Array.isArray(rdfData.item) ? rdfData.item : [rdfData.item];
      }
      
      console.log(`📊 CiNii アイテム数: ${items.length}件`);
      
      for (const item of items) {
        try {
          // タイトルを抽出
          const title = safeGetText(item, 'title');
          if (!title) continue;
          
          // 著者情報を抽出 (dc:creator)
          const creators = safeGetArray(item, 'dc:creator');
          const authors = normalizeAuthors(creators);
          
          // 出版年を抽出
          const publicationDate = safeGetText(item, 'prism:publicationDate');
          const dcDate = safeGetText(item, 'dc:date');
          const year = extractYear(publicationDate || dcDate);
          
          // URL を抽出
          const url = safeGetText(item, 'link');
          
          // 出版社情報を抽出
          const rawPublisher = safeGetText(item, 'dc:publisher');
          const publisher = cleanPublisherName(rawPublisher);
          
          // 掲載誌名を抽出 (prism:publicationName を優先、次に出版社)
          const publicationName = safeGetText(item, 'prism:publicationName');
          const journal = publicationName || publisher;
          
          // DOI/識別子を抽出
          const identifiers = safeGetArray(item, 'dc:identifier');
          console.log('🔍 identifiers:', identifiers, 'Type:', typeof identifiers, 'IsArray:', Array.isArray(identifiers));
          let doi = '';
          let isbn = '';
          
          if (Array.isArray(identifiers)) {
            for (const identifier of identifiers) {
              if (identifier && typeof identifier === 'string') {
                if (identifier.includes('doi.org') || identifier.startsWith('10.')) {
                  doi = identifier;
                } else if (identifier.includes('isbn') || /^\d{10,13}$/.test(identifier.replace(/[-\s]/g, ''))) {
                  isbn = identifier;
                }
              }
            }
          }
          
          // 巻号・ページ情報を抽出
          const volume = safeGetText(item, 'prism:volume');
          const issue = safeGetText(item, 'prism:number');
          const startPage = safeGetText(item, 'prism:startingPage');
          const endPage = safeGetText(item, 'prism:endingPage');
          
          // ページ範囲を構築
          let pages = '';
          if (startPage && endPage && startPage !== endPage && startPage !== '-') {
            pages = `${startPage}-${endPage}`;
          } else if (startPage && startPage !== '-') {
            pages = startPage;
          }
          
          // 論文/書籍タイプを判定（dc:typeフィールドで明確に判別）
          const dcType = safeGetText(item, 'dc:type');
          const isBook = dcType === 'Book';
          const isArticle = dcType === 'Article';
          
          console.log(`🔍 CiNii項目解析: "${title.substring(0, 30)}" - dc:type: "${dcType}" (${isBook ? '書籍' : '記事'})`);
          
          const resultItem = {
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
            isbn,
            source: 'CiNii',
            isBook,
            isBookChapter: false,
            bookTitle: '',
            editors: [],
            originalData: {
              title,
              creators,
              journal,
              publisher,
              rawPublisher,
              publicationName,
              volume,
              issue,
              pages,
              url,
              doi,
              isbn,
              dcType,
              isBook,
              isArticle,
              publicationDate,
              dcDate
            }
          };
          
          results.push(resultItem);
          // console.log(`✅ CiNii項目追加: "${title.substring(0, 50)}..." (${year}) - ${journal}`);
          
        } catch (itemError) {
          console.error('❌ CiNii アイテム処理エラー:', itemError);
          continue;
        }
      }
    } else {
      console.warn('⚠️ CiNii XMLの構造が予期される形式ではありません');
      console.log('XMLサンプル:', xmlText.substring(0, 500));
      
      // 別の構造を試す
      if (parsedXml && parsedXml['rdf:RDF']) {
        console.log('🔄 別の構造でアイテムを探索中...');
        console.log('parsedXml[rdf:RDF]:', JSON.stringify(parsedXml['rdf:RDF'], null, 2));
      }
    }
    
    console.log(`📊 CiNii XML解析完了: ${results.length}件の結果を抽出`);
    return results;
    
  } catch (error) {
    console.error('❌ CiNii XML パースエラー:', error);
    console.error('XMLサンプル:', xmlText.substring(0, 500));
    return [];
  }
}