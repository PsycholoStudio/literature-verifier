/**
 * 著者名正規化ユーティリティ
 * 日本語・英語の著者名を正規化
 */

/**
 * 著者文字列を複数著者に分割し、正規化する
 */
export function splitAndNormalizeAuthors(authorsString) {
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

/**
 * 単一著者名を正規化する
 */
export function normalizeAuthorName(authorName) {
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