/**
 * 著者名正規化ユーティリティ
 * 各種APIから取得した著者名を統一的に処理
 */

/**
 * 単一の著者名を正規化
 * @param {string} authorName - 著者名
 * @returns {string} 正規化された著者名
 */
export const normalizeAuthorName = (authorName) => {
  if (!authorName || typeof authorName !== 'string') {
    return '';
  }

  let cleanAuthor = authorName.trim();
  
  // 役割表記を削除（[著]、[編]など）
  cleanAuthor = cleanAuthor.replace(/\[.*?\]/g, '').trim();
  
  // パターン判定と処理
  // 1. 「姓・名・生年」パターン（例：中沢・新一・1950-）
  if (cleanAuthor.match(/^[^・]+・[^・]+・\d{4}-?[\d]*$/)) {
    const parts = cleanAuthor.split('・');
    return parts[0] + parts[1]; // 姓名を結合
  }
  
  // 2. 「姓／名・生年」パターン（例：村上／春樹・1949-）
  if (cleanAuthor.match(/^[^／]+／[^・]+・\d{4}-?[\d]*$/)) {
    return cleanAuthor
      .replace(/・\d{4}-?[\d]*$/, '') // 生年を削除
      .replace('／', ''); // スラッシュを削除
  }
  
  // 3. カンマ形式（姓, 名, 生没年）
  if (cleanAuthor.match(/^[^,]+,\s*[^,]+,\s*\d{4}-?[\d]*$/)) {
    const parts = cleanAuthor.split(/,\s*/);
    return parts[0] + parts[1]; // 姓名を結合
  }
  
  // 4. 「MILLER G. A.」形式 - ファミリーネーム＋イニシャル（カンマなし）
  if (cleanAuthor.match(/^[A-Z][A-Z\s]+\s+[A-Z]\.\s*[A-Z]\.?\s*$/)) {
    console.log(`📝 ファミリーネーム＋イニシャル形式: "${cleanAuthor}"`);
    const parts = cleanAuthor.split(/\s+/);
    const lastName = parts[0];
    const initials = parts.slice(1).join(' ');
    const result = `${initials} ${lastName}`;
    console.log(`📝 処理結果: "${result}"`);
    return result;
  }
  
  // 5. カンマ形式（姓, 名）- 欧米式
  if (cleanAuthor.match(/^[^,]+,\s*[^,]+$/)) {
    const parts = cleanAuthor.split(/,\s*/);
    console.log(`📝 カンマ形式処理: "${cleanAuthor}" → 姓:"${parts[0]}", 名:"${parts[1]}"`);
    
    // 日本語の場合は結合、欧米の場合は順序を逆に
    if (/[\u4E00-\u9FAF\u3040-\u309F\u30A0-\u30FF]/.test(cleanAuthor)) {
      const result = parts[0] + parts[1];
      console.log(`📝 日本語処理結果: "${result}"`);
      return result;
    } else {
      let lastName = parts[0];
      let firstName = parts[1];
      
      // 姓の後の前置詞パターンをチェック（例：Saussure, F. de → de Saussure, F.）
      const postfixNobleMatch = firstName.match(/^([^.]+\.?)\s+(de|von|van|del|della|du|le|la|al|ben|el|das|dos|da)\.?\s*$/i);
      if (postfixNobleMatch) {
        const actualFirstName = postfixNobleMatch[1];
        const nobleParticle = postfixNobleMatch[2];
        lastName = `${nobleParticle} ${lastName}`;
        firstName = actualFirstName;
        console.log(`📝 後置前置詞処理: "${parts[0]}, ${parts[1]}" → "${firstName} ${lastName}"`);
      }
      
      // 姓の前の前置詞パターンをチェック（例：de Saussure, F.）
      const prefixNobleMatch = lastName.match(/^(de|von|van|del|della|du|le|la|al|ben|el|das|dos|da)\s+(.+)$/i);
      if (prefixNobleMatch) {
        console.log(`📝 前置前置詞検出: "${lastName}" → "${prefixNobleMatch[1]} ${prefixNobleMatch[2]}"`);
        lastName = prefixNobleMatch[0]; // 前置詞付き姓をそのまま使用
      }
      
      // 一般的な複合姓パターンをチェック
      const isCompoundSurname = lastName.match(/^(Le|La|De|Del|Della|Van|Van der|Van den|Von|Von der|Mac|Mc|O'|St\.|San|Santa|Da|Das|Dos|Du|El|Al-|Ben-)\s/i);
      console.log(`📝 複合姓チェック: "${lastName}" → ${isCompoundSurname ? '複合姓検出' : '通常姓'}`);
      
      const result = `${firstName} ${lastName}`.trim(); // "Last, First" → "First Last"
      console.log(`📝 処理結果: "${result}"`);
      return result;
    }
  }
  
  // 6. 生年・生没年を削除（末尾の「・1949-」のようなパターン）
  cleanAuthor = cleanAuthor.replace(/・\d{4}-?[\d]*$/, '').trim();
  
  // 7. 単独著者（姓／名形式）
  if (cleanAuthor.includes('／')) {
    cleanAuthor = cleanAuthor.replace('／', '');
  }
  
  // 8. 中黒で区切られた名前（日本語のみ結合）
  if (cleanAuthor.includes('・') && /[\u4E00-\u9FAF\u3040-\u309F\u30A0-\u30FF]/.test(cleanAuthor)) {
    // 複数著者でない場合のみ結合
    if (!cleanAuthor.match(/[^・]+・[^・]+・[^・]+/)) {
      cleanAuthor = cleanAuthor.replace(/・/g, '');
    }
  }
  
  // 9. 日本語スペース区切り（姓 名）
  if (cleanAuthor.match(/^[\u4E00-\u9FAF\u3040-\u309F\u30A0-\u30FF]+\s+[\u4E00-\u9FAF\u3040-\u309F\u30A0-\u30FF]+$/)) {
    cleanAuthor = cleanAuthor.replace(/\s+/g, '');
  }
  
  return cleanAuthor.trim();
};

/**
 * 著者名の配列を正規化
 * @param {Array<string>|string} authors - 著者名の配列または文字列
 * @returns {Array<string>} 正規化された著者名の配列
 */
export const normalizeAuthors = (authors) => {
  if (!authors) {
    return [];
  }

  // 文字列の場合は配列に変換
  if (typeof authors === 'string') {
    // セミコロンで分割（複数著者の区切り）
    const authorList = authors.split(/[;；]/);
    return authorList
      .map(author => normalizeAuthorName(author))
      .filter(author => author.length > 0);
  }

  // 配列の場合
  if (Array.isArray(authors)) {
    return authors
      .map(author => {
        // オブジェクトの場合（例：{name: "Author Name"}）
        if (typeof author === 'object' && author !== null) {
          if (author.name) {
            return normalizeAuthorName(author.name);
          }
          // CrossRef形式（{given: "First", family: "Last"}）
          if (author.given || author.family) {
            const fullName = `${author.given || ''} ${author.family || ''}`.trim();
            return normalizeAuthorName(fullName);
          }
        }
        // 文字列の場合
        if (typeof author === 'string') {
          return normalizeAuthorName(author);
        }
        return '';
      })
      .filter(author => author.length > 0);
  }

  return [];
};

/**
 * 複数著者が含まれる可能性のある文字列を分割して正規化
 * @param {string} authorsString - 著者文字列（例："中沢新一・大森克己"）
 * @returns {Array<string>} 正規化された著者名の配列
 */
export const splitAndNormalizeAuthors = (authorsString) => {
  if (!authorsString || typeof authorsString !== 'string') {
    return [];
  }

  const cleanString = authorsString.replace(/\[.*?\]/g, '').trim();
  
  // 複数著者パターンのチェック（中黒区切りで、生年がない場合）
  if (cleanString.includes('・') && !cleanString.match(/・\d{4}-?[\d]*$/)) {
    // 姓・名・生年パターンでない場合は複数著者として分割
    if (!cleanString.match(/^[^・]+・[^・]+・\d{4}-?[\d]*$/)) {
      const authors = cleanString.split('・');
      return authors
        .map(author => normalizeAuthorName(author))
        .filter(author => author.length > 0);
    }
  }
  
  // 単一著者として処理
  const normalized = normalizeAuthorName(cleanString);
  return normalized ? [normalized] : [];
};