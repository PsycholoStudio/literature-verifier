/**
 * XML解析ユーティリティ
 * NDL OpenSearch APIレスポンス等のXML解析機能
 */

/**
 * XMLから指定フィールドの値を抽出
 */
export function extractXmlField(xml, fieldName) {
  const regex = new RegExp(`<${fieldName}[^>]*>(.*?)<\\/${fieldName}>`, 'gi');
  const match = xml.match(regex);
  if (match && match[0]) {
    return match[0].replace(/<[^>]+>/g, '').replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
  }
  return '';
}

/**
 * NDL OpenSearch APIのXMLレスポンスを解析
 */
export function parseNDLOpenSearchResponse(xmlData, splitAndNormalizeAuthors) {
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
      
      // Dublin Core形式のメタデータを抽出
      const title = extractXmlField(itemXml, 'dc:title') || 
                   extractXmlField(itemXml, 'title') || '';
      const creator = extractXmlField(itemXml, 'dc:creator') || 
                     extractXmlField(itemXml, 'author') || '';
      const publisher = extractXmlField(itemXml, 'dc:publisher') || '';
      
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
      const isbn = extractXmlField(itemXml, 'dc:identifier') || '';
      
      // ISBN重複チェック（dev版の機能を移植）
      if (isbn && isbn.includes('ISBN')) {
        const isbnMatch = isbn.match(/ISBN[:\s]*([\d\-X]+)/i);
        if (isbnMatch) {
          const cleanISBN = isbnMatch[1].replace(/-/g, '');
          if (seenISBNs.has(cleanISBN)) {
            // console.log(`⚠️ ISBN重複のためスキップ: ${cleanISBN}`);
            continue;
          }
          seenISBNs.add(cleanISBN);
        }
      }
      
      // 著者名のクリーニング
      // console.log(`📝 著者フィールド処理開始: "${creator}"`);
      const cleanAuthors = splitAndNormalizeAuthors(creator);
      // console.log(`📝 著者名クリーニング完了: "${creator}" → [${cleanAuthors.join(', ')}]`);

      // タイトル+著者による重複チェック（dev版の機能を移植）
      const titleAuthorKey = `${title.trim()}_${cleanAuthors.join('_')}`;
      // if (seenTitleAuthor.has(titleAuthorKey)) {
      //   console.log(`⚠️ タイトル+著者の重複のためスキップ: ${title} / ${cleanAuthors.join(', ')}`);
      //   continue;
      // }
      seenTitleAuthor.add(titleAuthorKey);

      if (title && title.trim().length > 0) {
        items.push({
          title: title.trim(),
          authors: cleanAuthors,
          year: year,
          publisher: publisher.trim(),
          url: link || guid || '',
          isbn: isbn,
          source: '国会図書館',
          isBook: true,
          originalData: {
            title,
            creator,
            publisher,
            dcDate,
            dctermsIssued,
            link,
            guid,
            isbn
          }
        });
        
        console.log(`✅ NDL項目追加: "${title.trim()}" (${year}) - ${publisher.trim()}`);
      }
    }
    
    console.log(`📊 NDL OpenSearch解析完了: ${items.length}件`);
    return items;
    
  } catch (error) {
    console.error('❌ NDL OpenSearch XML解析エラー:', error);
    return [];
  }
}