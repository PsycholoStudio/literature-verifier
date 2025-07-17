/**
 * 国会図書館検索API プロキシ
 * Vercel Serverless Function
 */

// 日本語タイトルのサブタイトル分割処理
const splitJapaneseSubtitle = (title) => {
  if (!title) return title;
  
  // 特殊なサブタイトルパターン（「——サブタイトル——」形式）
  const doubleHyphenPattern = /(.+?)――[^―]+――/;
  const doubleHyphenMatch = title.match(doubleHyphenPattern);
  if (doubleHyphenMatch) {
    const mainTitle = doubleHyphenMatch[1].trim();
    if (mainTitle.length >= 5) {
      console.log(`📚 NDL ダブルハイフン形式サブタイトル分離: "${title}" → "${mainTitle}"`);
      return mainTitle;
    }
  }
  
  // サブタイトル区切り文字のパターン（カタカナの長音符以外）
  // カタカナの後の「ー」は正しい長音符なので除外
  const subtitlePattern = /([^ァ-ヴ])([ー—‐−–])/g;
  
  // 区切り文字を検出して最初の部分をメインタイトルとする
  const match = title.match(subtitlePattern);
  if (match) {
    // 最初の区切り文字の位置を見つける
    const firstSeparatorMatch = subtitlePattern.exec(title);
    if (firstSeparatorMatch) {
      const mainTitle = title.substring(0, firstSeparatorMatch.index + 1).trim();
      // メインタイトルが十分な長さがある場合のみ分割
      if (mainTitle.length >= 5) {
        console.log(`📚 NDL 通常サブタイトル分離: "${title}" → "${mainTitle}"`);
        return mainTitle;
      }
    }
  }
  
  return title;
};

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
    cnt: '40' // 最大取得件数（2倍に増量）
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
 * 著者名正規化（詳細版）
 */
function splitAndNormalizeAuthors(authorString) {
  if (!authorString || typeof authorString !== 'string') {
    return [];
  }

  // 日本語姓名の場合：生年を削除してから姓名をマージ
  if (/^[^A-Z]*[ぁ-ん一-龯]/.test(authorString)) {
    // 生年部分を削除 (例: "三島, 由紀夫, 1925-1970" → "三島, 由紀夫", "中島, 義明, 1944-" → "中島, 義明")
    const withoutBirthYear = authorString.replace(/[,／]\s*\d{4}(-\d{2,4})?-?\s*$/, '');
    
    // カンマまたは全角スラッシュで分割して姓名をマージ
    const nameParts = withoutBirthYear.split(/[,／]\s*/).map(part => part.trim()).filter(part => part);
    if (nameParts.length >= 2) {
      return [nameParts.join('')]; // 姓名を結合
    } else if (nameParts.length === 1) {
      return [nameParts[0]];
    }
  }

  // 複数の区切り文字で分割（従来の処理）
  const separators = /[;；,，\/|・]/;
  const authors = authorString.split(separators);
  
  return authors
    .map(author => {
      let cleanAuthor = author
        .replace(/\[.*?\]/g, '') // 役割表記を削除
        .replace(/・\d{4}-?[\d]*$/, '') // 生年を削除 ・1980-2020
        .replace(/^\d{4}(-\d{2,4})?-?$/, '') // 生年のみの要素を削除 1925, 1925-1970, 1925-78, 1944-
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

/**
 * 掲載誌名のクリーニング（英訳除去）
 */
function cleanJournalName(journalName) {
  if (!journalName) return journalName;
  
  // "年報カルチュラルスタディーズ = The annual review of cultural studies" 
  // → "年報カルチュラルスタディーズ"
  return journalName.replace(/\s*=\s*.*$/, '').trim();
}

/**
 * rdfs:seeAlso リンクを抽出する関数
 */
function extractSeeAlsoLinks(xml) {
  const links = [];
  const seeAlsoRegex = /<rdfs:seeAlso[^>]*rdf:resource="([^"]+)"/g;
  let match;
  
  while ((match = seeAlsoRegex.exec(xml)) !== null) {
    links.push(match[1]);
  }
  
  return links;
}

/**
 * CiNii CRIDからRDFデータを取得して追加メタデータを抽出
 */
async function fetchCiNiiRdfData(cridUrl) {
  try {
    // CiNii CRIDのURLを.rdf付きに変換
    const rdfUrl = cridUrl + '.rdf';
    console.log(`🔗 CiNii RDF取得: ${rdfUrl}`);
    
    const response = await fetch(rdfUrl);
    if (!response.ok) {
      console.warn(`⚠️ CiNii RDF取得失敗: ${response.status}`);
      return null;
    }
    
    const rdfXml = await response.text();
    console.log(`📄 CiNii RDF取得成功: ${rdfXml.length}バイト`);
    
    // RDFから追加メタデータを抽出
    const additionalData = parseCiNiiRdf(rdfXml);
    return additionalData;
    
  } catch (error) {
    console.error('❌ CiNii RDF取得エラー:', error);
    return null;
  }
}

/**
 * CiNii RDFを解析して有用なメタデータを抽出
 */
function parseCiNiiRdf(rdfXml) {
  const data = {};
  
  // 掲載誌名の抽出
  const journalMatch = rdfXml.match(/<prism:publicationName[^>]*>([^<]+)<\/prism:publicationName>/);
  if (journalMatch) {
    data.journal = journalMatch[1];
  }
  
  // 巻号の抽出
  const volumeMatch = rdfXml.match(/<prism:volume[^>]*>([^<]+)<\/prism:volume>/);
  if (volumeMatch) {
    data.volume = volumeMatch[1];
  }
  
  const issueMatch = rdfXml.match(/<prism:number[^>]*>([^<]+)<\/prism:number>/);
  if (issueMatch) {
    data.issue = issueMatch[1];
  }
  
  // ページの抽出
  const startPageMatch = rdfXml.match(/<prism:startingPage[^>]*>([^<]+)<\/prism:startingPage>/);
  const endPageMatch = rdfXml.match(/<prism:endingPage[^>]*>([^<]+)<\/prism:endingPage>/);
  if (startPageMatch && endPageMatch) {
    data.pages = `${startPageMatch[1]}-${endPageMatch[1]}`;
  } else if (startPageMatch) {
    data.pages = startPageMatch[1];
  }
  
  // 出版年の抽出
  const yearMatch = rdfXml.match(/<prism:publicationDate[^>]*>(\d{4})-?\d*-?\d*<\/prism:publicationDate>/);
  if (yearMatch) {
    data.year = yearMatch[1];
  }
  
  // DOIの抽出
  const doiMatch = rdfXml.match(/<prism:doi[^>]*>([^<]+)<\/prism:doi>/);
  if (doiMatch) {
    data.doi = doiMatch[1];
  }
  
  // ISSNの抽出
  const issnMatch = rdfXml.match(/<prism:issn[^>]*>([^<]+)<\/prism:issn>/);
  if (issnMatch) {
    data.issn = issnMatch[1];
  }
  
  console.log(`📊 CiNii RDF解析結果:`, data);
  return data;
}

/**
 * NDL結果にCiNii RDFデータを並列取得して補完
 */
async function enhanceWithCiNiiRdfData(items) {
  const itemsWithCrid = items.filter(item => item.originalData?.ciNiiCridUrl);
  
  if (itemsWithCrid.length === 0) {
    console.log(`📝 CiNii CRID付きアイテムなし`);
    return;
  }
  
  console.log(`🔗 CiNii RDF並列取得開始: ${itemsWithCrid.length}件`);
  
  const enhancePromises = itemsWithCrid.map(async (item) => {
    try {
      const additionalData = await fetchCiNiiRdfData(item.originalData.ciNiiCridUrl);
      if (additionalData) {
        // より詳細なデータで補完
        if (additionalData.journal && !item.journal) {
          item.journal = additionalData.journal;
        }
        if (additionalData.volume && !item.volume) {
          item.volume = additionalData.volume;
        }
        if (additionalData.issue && !item.issue) {
          item.issue = additionalData.issue;
        }
        if (additionalData.pages && !item.pages) {
          item.pages = additionalData.pages;
        }
        if (additionalData.year && !item.year) {
          item.year = additionalData.year;
        }
        if (additionalData.doi && !item.doi) {
          item.doi = additionalData.doi;
        }
        
        console.log(`✨ CiNii RDF補完完了: "${item.title.substring(0, 30)}..."`);
      }
    } catch (error) {
      console.error(`❌ CiNii RDF補完エラー: ${item.title.substring(0, 30)}...`, error);
    }
  });
  
  await Promise.all(enhancePromises);
  console.log(`📊 CiNii RDF並列取得完了: ${itemsWithCrid.length}件処理`);
}

/**
 * NDL OpenSearch APIのXMLレスポンスを統一フォーマットにパース
 */
function parseNDLOpenSearchResponse(xmlData) {
  try {
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
      const title = (extractXmlField(itemXml, 'dc:title') || 
                   extractXmlField(itemXml, 'title') || '').replace(/\.$/, ''); // 末尾のピリオドを除去
      const creator = extractXmlField(itemXml, 'dc:creator') || 
                     extractXmlField(itemXml, 'author') || '';
      const publisher = extractXmlField(itemXml, 'dc:publisher') || '';
      
      // カテゴリ情報（記事 vs 図書の判定用）
      const category = extractXmlField(itemXml, 'category') || '';
      
      // 説明情報（掲載誌記事の場合の掲載誌情報）- 複数のdescriptionフィールドを処理
      const descriptions = [];
      const descRegex = /<dc:description[^>]*>(.*?)<\/dc:description>/gi;
      let descMatch;
      while ((descMatch = descRegex.exec(itemXml)) !== null) {
        const descContent = descMatch[1].replace(/<!\\[CDATA\\[(.*?)\\]\\]>/g, '$1').trim();
        if (descContent) {
          descriptions.push(descContent);
        }
      }
      
      // 掲載誌情報を含むdescriptionを優先的に選択
      const description = descriptions.find(desc => desc.includes('掲載誌：')) || descriptions[0] || '';
      
      // rdfs:seeAlso リンクの抽出
      const seeAlsoLinks = extractSeeAlsoLinks(itemXml);
      
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
      
      // 著者名のクリーニング
      const cleanAuthors = splitAndNormalizeAuthors(creator);

      // 書籍章判定のための事前チェック
      const hasBookChapterDescription = description && description.includes('掲載誌：');

      // 記事か図書かの判定
      const isArticle = category.includes('記事');
      
      // デバッグ情報を出力
      console.log(`🔍 NDL項目解析: "${title.substring(0, 30)}"`, {
        category,
        isArticle,
        description: description ? description.substring(0, 100) : 'なし'
      });
      
      // CiNii CRIDの検出（後で並列処理で取得）
      const ciNiiCridUrl = seeAlsoLinks.find(link => link.includes('cir.nii.ac.jp/crid/'));
      if (ciNiiCridUrl) {
        console.log(`🔗 CiNii CRID発見: ${ciNiiCridUrl}`);
      }

      // 掲載誌記事の場合の掲載誌情報解析
      let journal = '';
      let volume = '';
      let pages = '';
      let issue = '';
      let extractedBookTitle = '';
      let extractedPages = '';
      
      // 書籍章の特別パターン：掲載誌フィールドに書籍情報がある場合
      if (hasBookChapterDescription && description.includes('掲載誌：')) {
        console.log(`📚 NDL書籍章パターン解析: "${description}"`);
        
        // 書籍章パターン: 掲載誌：「タイトル」サブタイトル 年度 p.ページ
        // 完全な書籍タイトル（「」内 + それ以降のサブタイトル部分）を抽出
        const bookChapterPattern = /掲載誌[：:]\s*(.+?)\s+(\d{4})\s+p\.?(\d+(?:[-–—]\d+)?)/;
        const bookMatch = description.match(bookChapterPattern);
        if (bookMatch) {
          extractedBookTitle = bookMatch[1].trim();
          extractedPages = bookMatch[3];
          journal = extractedBookTitle; // 書籍章の場合はjournalに書籍名を格納
          pages = extractedPages;
          console.log(`📚 NDL書籍章情報抽出: 書籍="${extractedBookTitle}" ページ="${extractedPages}"`);
        } else {
          console.warn(`⚠️ NDL書籍章パターン未対応: "${description}"`);
        }
      } else if ((isArticle || hasBookChapterDescription) && description) {
        console.log(`📰 NDL掲載誌記事パターン解析: "${description}"`);
        
        // 後ろから情報を抽出するパターン群
        const patterns = [
          // 基本パターン（巻とページ）
          /掲載誌[：:]\s*(.+?)\s+(\d+)\s+p\.?(\d+(?:[-–—]\d+)?)\s*$/,
          // 年度のみパターン
          /掲載誌[：:]\s*(.+?)\s+(\d{4})\s*$/,
          // ページのみパターン
          /掲載誌[：:]\s*(.+?)\s+p\.?(\d+(?:[-–—]\d+)?)\s*$/,
          // 編集者パターン
          /掲載誌[：:]\s*(.+?)\s+([^\s]+編)\s*$/,
          // 「0」で始まるパターン（学会発表など）
          /掲載誌[：:]\s*(.+?)\s+0\s+p\.?(\d+(?:[-–—]\d+)?)\s*$/,
          // 巻(号)パターン
          /掲載誌[：:]\s*(.+?)\s+(\d+)\s*\((\d+)\)\s*p\.?(\d+(?:[-–—]\d+)?)\s*$/,
          // 年度と巻パターン
          /掲載誌[：:]\s*(.+?)\s+(\d{4})\s+(\d+)\s*$/,
          // 巻と号パターン
          /掲載誌[：:]\s*(.+?)\s+(\d+)巻\s*(\d+)号\s*p\.?(\d+(?:[-–—]\d+)?)\s*$/,
          // 巻-号パターン
          /掲載誌[：:]\s*(.+?)\s+(\d+)[-–—](\d+)\s*p\.?(\d+(?:[-–—]\d+)?)\s*$/,
          // 基本的な掲載誌名のみパターン
          /掲載誌[：:]\s*(.+?)\s*$/
        ];
        
        for (const pattern of patterns) {
          const match = description.match(pattern);
          if (match) {
            journal = cleanJournalName(match[1]); // 掲載誌名（英訳除去）
            
            // パターンに応じて情報を抽出
            if (match.length > 2) {
              const secondMatch = match[2];
              const thirdMatch = match[3];
              const fourthMatch = match[4];
              
              // 年度かどうかチェック
              if (secondMatch && /^\d{4}$/.test(secondMatch)) {
                // 年度の場合は巻として扱わない
                if (thirdMatch && /^\d+$/.test(thirdMatch)) {
                  volume = thirdMatch;
                }
              } else if (secondMatch && /^\d+$/.test(secondMatch)) {
                // 巻として扱う
                volume = secondMatch;
                
                // 3番目の要素が号かページかを判定
                if (thirdMatch) {
                  if (fourthMatch) {
                    // 4番目があれば3番目は号、4番目がページ
                    issue = thirdMatch;
                    pages = fourthMatch;
                  } else {
                    // 3番目がページの可能性が高い
                    if (thirdMatch.includes('-') || thirdMatch.includes('–') || thirdMatch.includes('—')) {
                      pages = thirdMatch;
                    } else {
                      // 単一数字の場合は号かページかを判定
                      if (parseInt(thirdMatch) > 500) {
                        pages = thirdMatch; // 大きい数字はページ
                      } else {
                        issue = thirdMatch; // 小さい数字は号
                      }
                    }
                  }
                }
              } else if (secondMatch && secondMatch.includes('p.')) {
                // ページパターン
                pages = secondMatch.replace(/^p\.?/, '');
              } else if (secondMatch && secondMatch.includes('編')) {
                // 編集者パターン - 特別な処理は不要
              }
            }
            
            console.log(`📰 NDL掲載誌記事パターンマッチ: "${journal}" 巻:${volume} 号:${issue} ページ:${pages}`);
            break;
          }
        }
        
        // パターンにマッチしなかった場合の警告
        if (!journal) {
          console.warn(`⚠️ NDL掲載誌記事パターン未対応: "${description}"`);
        }
      }

      // 書籍章判定：記事でない + 巻号なし + ページあり + 出版社あり + 掲載誌あり
      // または、図書カテゴリーで掲載誌情報がある場合（新パターン）
      const isBookChapter = ((!isArticle && !volume && !issue && pages && publisher && journal) || 
                           (category.includes('図書') && hasBookChapterDescription)) ? true : false;
      
      console.log(`🔍 NDL項目解析: "${title.substring(0, 30)}" - タイプ: ${isArticle ? '記事' : isBookChapter ? '書籍章' : '書籍'}`);
      console.log(`🔍 isBookChapter値確認:`, { 
        isBookChapter, 
        type: typeof isBookChapter, 
        extractedBookTitle,
        journal,
        isBookChapterBoolean: !!isBookChapter
      });

      // タイトル+著者による重複チェック
      const titleAuthorKey = `${title.trim()}_${cleanAuthors.join('_')}`;
      if (seenTitleAuthor.has(titleAuthorKey)) {
        continue;
      }
      seenTitleAuthor.add(titleAuthorKey);

      if (title && title.trim().length > 0) {
        items.push({
          title: splitJapaneseSubtitle(title.trim()), // サブタイトル分離後のメインタイトル
          titleWithSubtitle: title.trim(), // 完全なタイトル（サブタイトル含む）
          subtitle: '', // NDLではサブタイトルを別フィールドで提供していないため空
          authors: cleanAuthors,
          year: year,
          doi: '', // NDLはDOIを提供しない
          journal: (isArticle && !isBookChapter) ? journal : '', // 記事の場合のみ掲載誌名、書籍章・書籍の場合は空
          publisher: (isArticle && !isBookChapter) ? '' : publisher.trim(), // 書籍・書籍章の場合は出版社
          volume: volume,
          issue: issue, // パターンマッチングで抽出した号情報
          pages: pages,
          url: link || guid || '',
          isbn: isbn,
          source: 'NDL',
          isBook: !isArticle && !isBookChapter,
          isBookChapter: isBookChapter,
          bookTitle: isBookChapter ? splitJapaneseSubtitle(extractedBookTitle || journal) : '', // 書籍章の場合は抽出された書籍名（サブタイトル分離後）
          bookTitleWithSubtitle: isBookChapter ? extractedBookTitle || journal : '', // 完全な書籍タイトル（サブタイトル含む）
          editors: [], // TODO: NDL descriptionから編者情報を抽出
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
            isArticle,
            isBookChapter,
            journal,
            seeAlsoLinks,
            ciNiiCridUrl
          }
        });
        
        const displayInfo = isArticle ? journal : publisher.trim();
        console.log(`✅ NDL項目追加: "${title.trim()}" (${year}) - ${displayInfo} ${isArticle ? '[記事]' : isBookChapter ? '[書籍章]' : '[図書]'}`);
        
        // 最終データオブジェクトを出力
        console.log(`📝 NDL最終データ:`, {
          isBook: !isArticle && !isBookChapter,
          isBookChapter: isBookChapter,
          journal: (isArticle && !isBookChapter) ? journal : '',
          publisher: (isArticle && !isBookChapter) ? '' : publisher.trim(),
          bookTitle: isBookChapter ? journal : '',
          volume,
          pages,
          extractedBookTitle: extractedBookTitle || 'なし'
        });
      }
    }
    
    console.log(`📊 NDL OpenSearch解析完了: ${items.length}件`);
    
    // デバッグ: 最初のアイテムの構造を確認
    if (items.length > 0) {
      console.log(`🔍 NDL最初のアイテム構造:`, {
        title: items[0].title?.substring(0, 30),
        isBook: items[0].isBook,
        isBookChapter: items[0].isBookChapter,
        journal: items[0].journal,
        publisher: items[0].publisher,
        bookTitle: items[0].bookTitle,
        volume: items[0].volume,
        pages: items[0].pages,
        hasCridUrl: !!items[0].originalData?.ciNiiCridUrl
      });
    }
    
    // CiNii RDFデータを並列取得して補完（一時的に無効化）
    // try {
    //   await enhanceWithCiNiiRdfData(items);
    // } catch (enhanceError) {
    //   console.error('❌ CiNii RDF補完でエラー:', enhanceError);
    //   // エラーが発生してもNDLの基本データは返す
    // }
    console.log('📝 CiNii RDF補完を一時的にスキップ');
    
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