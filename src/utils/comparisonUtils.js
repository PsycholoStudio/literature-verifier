/**
 * 比較・類似度計算ユーティリティ
 */

// 出版社名の正規化関数（企業接尾辞を無視）
const normalizePublisher = (text) => {
  if (!text) return '';
  
  console.log(`🔧 出版社正規化開始: "${text}"`);
  
  const result = text
    .trim()
    .toLowerCase()
    // アクセント記号を削除・正規化
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // é → e, à → a など
    // フランス語の出版関連用語を正規化
    .replace(/\beditions?\b/gi, 'editions') // Éditions/Editions → editions
    .replace(/\bpresses?\b/gi, 'presses') // Presses → presses
    .replace(/\blibrairie\b/gi, 'librairie') // Librairie → librairie
    // 英語の出版関連用語を正規化
    .replace(/\bpublisher?s?\b/gi, 'publishers') // Publisher/Publishers → publishers
    .replace(/\bpress\b/gi, 'press') // Press → press
    .replace(/\buniversity\b/gi, 'university') // University → university
    // 一般的な企業接尾辞を削除
    .replace(/\b(inc\.?|corp\.?|ltd\.?|llc\.?|co\.?|company|corporation|limited|incorporated)\b/gi, '')
    // 日本語の企業接尾辞を削除
    .replace(/[株式会社|有限会社]/g, '')
    // 句読点を統一
    .replace(/[\.。]/g, '') // ピリオドを削除
    .replace(/[,，]/g, '') // カンマを削除
    // 連続する空白を一つに正規化
    .replace(/\s+/g, ' ')
    .trim();
    
  console.log(`🔧 出版社正規化完了: "${text}" → "${result}"`);
  return result;
};

// 書籍タイトルの正規化関数（版情報を無視）
const normalizeBookTitle = (text) => {
  if (!text) return '';
  
  return text
    .trim()
    .toLowerCase()
    // 版情報を削除（英語）
    .replace(/\(\s*([0-9]+)(st|nd|rd|th)?\s+(ed\.?|edition)\s*\)/gi, '') // (3rd ed.), (2nd edition)
    .replace(/\b([0-9]+)(st|nd|rd|th)?\s+(ed\.?|edition)\b/gi, '') // 3rd ed., 2nd edition
    .replace(/\(\s*(revised|updated|expanded|new)\s+(ed\.?|edition)\s*\)/gi, '') // (revised edition)
    .replace(/\b(revised|updated|expanded|new)\s+(ed\.?|edition)\b/gi, '') // revised edition
    // 版情報を削除（日本語）
    .replace(/[（）（）]?\s*[第]?[0-9０-９]+[版刊]\s*[（）（）]?/g, '') // 第3版、（第2刊）
    .replace(/[（）（）]?\s*(改訂|新|增補|最新)[版刊]?\s*[（）（）]?/g, '') // 改訂版、新版
    // 連続する空白を一つに正規化
    .replace(/\s+/g, ' ')
    .trim();
};

// 類似度計算（レーベンシュタイン距離ベース + 前方一致最適化）
export const calculateSimilarity = (str1, str2) => {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.trim().toLowerCase();
  const s2 = str2.trim().toLowerCase();
  
  console.log(`📊 類似度計算開始: "${str1}" vs "${str2}"`);
  console.log(`📊 正規化後: "${s1}" vs "${s2}"`);
  
  // 完全一致
  if (s1 === s2) {
    console.log(`📊 完全一致: 100%`);
    return 100;
  }
  
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 100;
  
  // 前方一致チェック（部分タイトルの問題に対応）
  // 短い方が長い方の前方一致で、かつ区切り文字（:, -, など）で終わる場合
  if (longer.startsWith(shorter)) {
    const remainingPart = longer.substring(shorter.length).trim();
    
    // 区切り文字（コロン、ハイフン、ピリオドなど）で始まる場合は高スコア
    if (remainingPart.match(/^[:：\-\.\s]/)) {
      console.log(`🎯 前方一致検出: "${shorter}" → "${longer}" (残り: "${remainingPart}")`);
      // 前方一致の場合は95%の高スコアを与える（書籍タイトル対応）
      return 95;
    }
    
    // 区切り文字がなくても、短い方が長い方の80%以上を占める場合は高スコア
    const ratio = shorter.length / longer.length;
    if (ratio >= 0.8) {
      console.log(`🎯 長さ比率前方一致: "${shorter}" → "${longer}" (比率: ${(ratio * 100).toFixed(1)}%)`);
      return 90;
    }
  }
  
  const editDistance = (s1, s2) => {
    const matrix = [];
    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[s2.length][s1.length];
  };
  
  const distance = editDistance(longer, shorter);
  const similarity = ((longer.length - distance) / longer.length) * 100;
  
  console.log(`📊 レーベンシュタイン距離: ${distance}, 類似度: ${similarity.toFixed(1)}%`);
  return similarity;
};

// ファミリーネーム抽出関数（安全な型チェック版）
export const extractFamilyName = (authorName) => {
  if (!authorName || typeof authorName !== 'string') return '';
  
  const name = authorName.trim();
  
  // "姓, 名" 形式（例: "Smith, John" → "Smith"）
  if (name.includes(',')) {
    return name.split(',')[0].trim();
  }
  
  // スペース区切りの場合、最後の部分をファミリーネームとする
  // "M. Hunt", "John Smith", "Mary Jane Watson" → "Hunt", "Smith", "Watson"
  const parts = name.split(/\s+/);
  if (parts.length > 1) {
    return parts[parts.length - 1].trim();
  }
  
  // 単一の名前の場合はそのまま返す
  return name;
};

// 著者名リストの正規化（セミコロン区切りなど対応）
export const normalizeAuthorList = (authorsInput) => {
  if (!authorsInput) return [];
  
  let authorList = [];
  
  if (Array.isArray(authorsInput)) {
    // 配列の場合
    authorList = authorsInput;
  } else if (typeof authorsInput === 'string') {
    // 文字列の場合、セミコロンまたはアンド記号で分割
    authorList = authorsInput.split(/[;&]|and\s+/).map(a => a.trim());
  }
  
  // 各著者名からファミリーネームを抽出
  return authorList
    .filter(author => author && author.length > 0)
    .map(author => extractFamilyName(author))
    .filter(familyName => familyName && familyName.length >= 2);
};

// 一致/不一致の判定（安全な型チェック版）
export const compareFields = (original, found) => {
  if (!original || !found || typeof original !== 'string' || typeof found !== 'string') {
    return false;
  }
  
  // 基本的な正規化
  const normalize = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.toLowerCase().replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, ' ').trim();
  };
  
  const normalizedOriginal = normalize(original);
  const normalizedFound = normalize(found);
  
  // 完全一致
  if (normalizedOriginal === normalizedFound) return true;
  
  // 包含関係（80%以上の一致）
  const similarity = calculateSimilarity(normalizedOriginal, normalizedFound);
  return similarity >= 80;
};


// 英語名を「名 姓」形式に統一する
const normalizeEnglishNameFormat = (name) => {
  if (!name || typeof name !== 'string') return '';
  
  let normalized = name.trim().toLowerCase();
  
  // 特殊文字を正規化
  normalized = normalizeSpecialChars(normalized);
  
  // 「姓, 名」形式を「名 姓」形式に変換
  if (normalized.includes(',')) {
    const parts = normalized.split(',').map(p => p.trim());
    if (parts.length === 2) {
      // "Miller, G. A." → "G. A. Miller"
      normalized = `${parts[1]} ${parts[0]}`;
    }
  }
  
  // イニシャルを正規化 (G.A. → G. A.)
  normalized = normalized.replace(/([a-z])\.([a-z])/g, '$1. $2');
  
  // フルネームをイニシャルに変換（統一比較のため）
  const parts = normalized.split(/\s+/).filter(p => p.length > 0);
  if (parts.length >= 2) {
    const lastName = parts[parts.length - 1];
    const firstNames = parts.slice(0, -1);
    
    const initials = firstNames.map(firstName => {
      // 既にイニシャル形式の場合はそのまま
      if (firstName.length <= 2 && firstName.includes('.')) {
        return firstName;
      }
      // フルネームの場合はイニシャルに変換
      return firstName.charAt(0) + '.';
    });
    
    normalized = `${initials.join(' ')} ${lastName}`;
  }
  
  // 区切り文字を正規化
  normalized = normalized
    .replace(/[;；・•&]+/g, ' ') // 区切り文字をスペースに変換
    .replace(/\s+/g, ' ') // 連続スペースを単一スペースに
    .trim();
  
  console.log(`🔄 英語名正規化: "${name}" → "${normalized}"`);
  
  return normalized;
};

// 特殊文字を基本文字に変換（ä → a, ö → o など）
const normalizeSpecialChars = (text) => {
  return text
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[ç]/g, 'c')
    .replace(/[ý]/g, 'y')
    .replace(/[ß]/g, 'ss')
    .replace(/[æ]/g, 'ae')
    .replace(/[œ]/g, 'oe')
    .replace(/[ÀÁÂÃÄÅ]/g, 'A')
    .replace(/[ÈÉÊË]/g, 'E')
    .replace(/[ÌÍÎÏ]/g, 'I')
    .replace(/[ÒÓÔÕÖ]/g, 'O')
    .replace(/[ÙÚÛÜ]/g, 'U')
    .replace(/[Ñ]/g, 'N')
    .replace(/[Ç]/g, 'C')
    .replace(/[Ý]/g, 'Y');
};

// 著者名の正規化（改良版）
export const normalizeAuthorName = (name) => {
  if (!name || typeof name !== 'string') return '';
  
  console.log(`🔧 著者名正規化開始: "${name}"`);
  
  // 基本的なクリーニング
  let normalized = name.trim();
  
  // 特殊文字を正規化（ä → a など）
  normalized = normalizeSpecialChars(normalized);
  
  // 言語判定
  const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(normalized);
  const isKorean = /[\uAC00-\uD7AF]/.test(normalized);
  
  if (isJapanese) {
    // 日本語名の場合、区切り文字やスペースを統一・除去
    normalized = normalized
      .replace(/[・•・]/g, '') // 中黒を除去
      .replace(/[,，、]/g, '') // カンマ・読点を除去  
      .replace(/\s+/g, '') // 日本語名からスペースを除去
      .toLowerCase();
    console.log(`🔧 日本語名処理: "${name}" → "${normalized}"`);
  } else if (isKorean) {
    // 韓国語名の場合、そのまま保持
    normalized = normalized.toLowerCase().trim();
    console.log(`🔧 韓国語名処理: "${name}" → "${normalized}"`);
  } else {
    // 英語名の場合、形式を統一してから正規化
    normalized = normalizeEnglishNameFormat(normalized);
    console.log(`🔧 英語名処理: "${name}" → "${normalized}"`);
  }
  
  return normalized;
};

// イニシャルと完全名の一致判定（改良版）
const isInitialMatch = (name1, name2) => {
  const parts1 = name1.split(/\s+/).filter(p => p.length > 0);
  const parts2 = name2.split(/\s+/).filter(p => p.length > 0);
  
  if (parts1.length === 0 || parts2.length === 0) {
    return false;
  }
  
  // 姓（最後の要素）が一致するかチェック
  const lastName1 = parts1[parts1.length - 1];
  const lastName2 = parts2[parts2.length - 1];
  
  console.log(`  姓比較: "${lastName1}" vs "${lastName2}"`);
  
  if (lastName1 !== lastName2) {
    console.log(`  ❌ 姓不一致: "${lastName1}" ≠ "${lastName2}"`);
    return false; // 姓が一致しない場合は不一致
  }
  
  console.log(`  ✅ 姓一致: "${lastName1}"`);
  
  // 名前部分のイニシャル一致をチェック（ミドルネーム対応）
  const firstNames1 = parts1.slice(0, -1);
  const firstNames2 = parts2.slice(0, -1);
  
  console.log(`  名前部分比較: [${firstNames1.join(', ')}] vs [${firstNames2.join(', ')}]`);
  
  // ミドルネームの有無を考慮した柔軟な一致判定
  // 短い方の名前リストのすべての要素が長い方のリストに含まれているかチェック
  const shorterNames = firstNames1.length <= firstNames2.length ? firstNames1 : firstNames2;
  const longerNames = firstNames1.length > firstNames2.length ? firstNames1 : firstNames2;
  
  console.log(`  比較戦略: 短い方 [${shorterNames.join(', ')}] のすべてが [${longerNames.join(', ')}] に含まれるかチェック`);
  
  // 短い方のすべての名前要素が長い方のリストのどこかにあるかチェック
  for (let i = 0; i < shorterNames.length; i++) {
    const shortName = shorterNames[i] || '';
    
    if (!shortName) {
      console.log(`  空の短い名前要素: "${shortName}"`);
      return false;
    }
    
    // 長い方のリスト全体から一致するものを探す（位置に依らない）
    const found = longerNames.some(longName => isNameComponentMatch(shortName, longName));
    
    if (!found) {
      console.log(`  名前要素不一致: "${shortName}" が [${longerNames.join(', ')}] に見つからない`);
      return false;
    }
    
    console.log(`  名前要素一致: "${shortName}" が見つかった`);
  }
  
  console.log(`  ✅ ミドルネーム考慮一致成功`);
  return true;
};

// 個別の名前要素（イニシャル vs フルネーム）の一致判定
const isNameComponentMatch = (name1, name2) => {
  if (!name1 || !name2) return false;
  
  // ピリオドを除去してチェック
  const clean1 = name1.replace(/\./g, '');
  const clean2 = name2.replace(/\./g, '');
  
  // どちらかがイニシャル（1文字）の場合、先頭文字で比較
  if (clean1.length === 1 || clean2.length === 1) {
    return clean1.charAt(0) === clean2.charAt(0);
  } else {
    // 両方とも完全名の場合は完全一致を要求
    return clean1 === clean2;
  }
  
  return true;
};

// 著者名の比較（詳細版 - 完全一致・順序違い・部分一致を区別）
export const compareAuthors = (originalAuthors, foundAuthors) => {
  console.log('\n🎯 compareAuthors 呼び出し:');
  console.log('  originalAuthors:', originalAuthors, '(型:', typeof originalAuthors, ')');
  console.log('  foundAuthors:', foundAuthors, '(型:', typeof foundAuthors, ')');
  
  if (!originalAuthors || !foundAuthors || originalAuthors.length === 0 || foundAuthors.length === 0) {
    console.log('❌ 著者情報なし/空');
    return { type: 'no_match', score: 0, details: '著者情報なし' };
  }
  
  // 配列に変換（文字列の場合もある）
  let originalArray = originalAuthors;
  let foundArray = foundAuthors;
  
  if (!Array.isArray(originalAuthors)) {
    console.log('⚠️ originalAuthorsが配列ではない:', typeof originalAuthors);
    originalArray = [originalAuthors];
  }
  
  if (!Array.isArray(foundAuthors)) {
    console.log('⚠️ foundAuthorsが配列ではない:', typeof foundAuthors);
    foundArray = [foundAuthors];
  }
  
  console.log('📝 著者比較開始:', {
    original: originalArray,
    originalLength: originalArray.length,
    originalType: typeof originalAuthors,
    found: foundArray,
    foundLength: foundArray.length,
    foundType: typeof foundAuthors
  });
  
  // 両方の著者リストを正規化
  const normalizedOriginal = originalArray.map(author => normalizeAuthorName(author));
  const normalizedFound = foundArray.map(author => normalizeAuthorName(author));
  
  console.log('📝 著者比較詳細:', {
    original: originalArray,
    found: foundArray,
    normalizedOriginal,
    normalizedFound,
    normalizedOriginalLength: normalizedOriginal.length,
    normalizedFoundLength: normalizedFound.length
  });
  
  // 各著者の正規化結果を詳細表示
  console.log('🔍 著者正規化結果:');
  originalArray.forEach((orig, i) => {
    console.log(`  Original[${i}]: "${orig}" → "${normalizedOriginal[i]}"`);
  });
  foundArray.forEach((found, i) => {
    console.log(`  Found[${i}]: "${found}" → "${normalizedFound[i]}"`);
  });
  
  // 名前一致判定関数
  const isNameMatch = (name1, name2) => {
    if (!name1 || !name2 || typeof name1 !== 'string' || typeof name2 !== 'string') {
      console.log(`  ❌ 無効な名前入力: "${name1}" (${typeof name1}) vs "${name2}" (${typeof name2})`);
      return false;
    }
    
    const normalized1 = name1.toLowerCase().trim();
    const normalized2 = name2.toLowerCase().trim();
    
    console.log(`  🔍 名前比較: "${name1}" → "${normalized1}" vs "${name2}" → "${normalized2}"`);
    
    if (normalized1 === normalized2) {
      console.log(`  ✅ 完全一致`);
      return true;
    }
    
    // 言語判定
    const isJapanese1 = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(name1);
    const isJapanese2 = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(name2);
    
    if (isJapanese1 && isJapanese2) {
      const clean1 = name1.replace(/[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '');
      const clean2 = name2.replace(/[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '');
      const similarity = calculateSimilarity(clean1, clean2);
      console.log(`  日本語名比較: "${clean1}" vs "${clean2}" (類似度: ${similarity.toFixed(1)}%)`);
      return similarity >= 90; // 厳密化: 75% → 90%
    }
    
    // 英語名の場合
    if (!isJapanese1 && !isJapanese2) {
      const clean1 = normalizeEnglishNameFormat(name1);
      const clean2 = normalizeEnglishNameFormat(name2);
      
      console.log(`  英語名正規化: "${name1}" → "${clean1}" vs "${name2}" → "${clean2}"`);
      
      // 完全一致
      if (clean1 === clean2) {
        console.log(`  → 英語名完全一致`);
        return true;
      }
      
      // イニシャル一致（より厳密に）
      const initialMatch = isInitialMatch(clean1, clean2);
      console.log(`  → 英語名イニシャル一致結果: ${initialMatch}`);
      if (initialMatch) {
        console.log(`  ✅ 英語名イニシャル一致`);
        return true;
      }
      
      // 類似度チェック（厳密化）
      const similarity = calculateSimilarity(clean1, clean2);
      console.log(`  → 英語名類似度: ${similarity.toFixed(1)}%`);
      return similarity >= 95; // 厳密化: 80% → 95%
    }
    
    return false;
  };
  
  // 1. 完全一致チェック（順序も一致）
  if (normalizedOriginal.length === normalizedFound.length) {
    console.log(`🔍 完全一致チェック開始: ${normalizedOriginal.length}名 vs ${normalizedFound.length}名`);
    let exactOrderMatch = true;
    for (let i = 0; i < normalizedOriginal.length; i++) {
      console.log(`  🔍 位置${i}: "${normalizedOriginal[i]}" vs "${normalizedFound[i]}"`);
      const match = isNameMatch(normalizedOriginal[i], normalizedFound[i]);
      console.log(`  → 一致結果: ${match}`);
      if (!match) {
        exactOrderMatch = false;
        break;
      }
    }
    if (exactOrderMatch) {
      console.log(`✅ 完全一致: ${normalizedOriginal.length}名が順序通り一致`);
      return { type: 'exact_match', score: 100, details: `${normalizedOriginal.length}名が順序通り一致` };
    } else {
      console.log(`❌ 順序通り一致失敗`);
    }
  }
  
  // 2. 順序違い一致チェック（同じ著者、順序が違う）
  if (normalizedOriginal.length === normalizedFound.length) {
    const originalMatched = new Set();
    const foundMatched = new Set();
    let matchCount = 0;
    
    for (let i = 0; i < normalizedOriginal.length; i++) {
      for (let j = 0; j < normalizedFound.length; j++) {
        if (!originalMatched.has(i) && !foundMatched.has(j) && 
            isNameMatch(normalizedOriginal[i], normalizedFound[j])) {
          originalMatched.add(i);
          foundMatched.add(j);
          matchCount++;
          break;
        }
      }
    }
    
    if (matchCount === normalizedOriginal.length) {
      console.log(`🔄 順序違い一致: ${matchCount}名が順序違いで一致`);
      return { type: 'order_different', score: 85, details: `${matchCount}名が順序違いで一致` };
    }
    
    // 部分一致は50%以上の一致が必要
    const matchRatio = matchCount / Math.max(normalizedOriginal.length, normalizedFound.length);
    if (matchCount > 0 && matchRatio >= 0.5) {
      const score = Math.round(matchRatio * 70);
      console.log(`🔍 部分一致: ${matchCount}/${normalizedOriginal.length}名が一致 (${(matchRatio * 100).toFixed(1)}%)`);
      return { type: 'partial_match', score, details: `${matchCount}/${normalizedOriginal.length}名が一致` };
    }
  }
  
  // 3. 著者数違いでも部分一致をチェック
  const originalMatched = new Set();
  const foundMatched = new Set();
  let matchCount = 0;
  
  for (let i = 0; i < normalizedOriginal.length; i++) {
    for (let j = 0; j < normalizedFound.length; j++) {
      if (!originalMatched.has(i) && !foundMatched.has(j) && 
          isNameMatch(normalizedOriginal[i], normalizedFound[j])) {
        originalMatched.add(i);
        foundMatched.add(j);
        matchCount++;
        break;
      }
    }
  }
  
  // 著者数違いでも50%以上の一致が必要
  const matchRatio = matchCount / Math.max(normalizedOriginal.length, normalizedFound.length);
  if (matchCount > 0 && matchRatio >= 0.5) {
    const score = Math.round(matchRatio * 60);
    console.log(`🔍 部分一致（著者数違い）: ${matchCount}名が一致 (${(matchRatio * 100).toFixed(1)}%)`);
    return { type: 'partial_match', score, details: `${matchCount}名が一致（著者数: ${normalizedOriginal.length} vs ${normalizedFound.length}）` };
  }
  
  console.log(`❌ 著者不一致: ${normalizedOriginal.length}名 vs ${normalizedFound.length}名、一致数 ${matchCount}`);
  return { type: 'no_match', score: 0, details: `著者の一致なし (${normalizedOriginal.length} vs ${normalizedFound.length}名)` };
};

// 年の比較（論文±1年、書籍±3年の誤差を許容）
export const compareYear = (originalYear, foundYear, isBook = false) => {
  if (!originalYear || !foundYear || typeof originalYear !== 'string' || typeof foundYear !== 'string') {
    return false;
  }
  
  const origNum = parseInt(originalYear);
  const foundNum = parseInt(foundYear);
  
  if (isNaN(origNum) || isNaN(foundNum)) {
    return false;
  }
  
  const diff = Math.abs(origNum - foundNum);
  const tolerance = isBook ? 3 : 1; // 書籍は再版考慮で±3年、論文は±1年
  return diff <= tolerance;
};

// 巻号ページ番号の比較関数
export const compareVolumeIssuePages = (original, found) => {
  const result = {
    volume: false,
    issue: false,
    pages: false,
    overallMatch: false,
    score: 0
  };
  
  if (!original || !found) return result;
  
  let matchCount = 0;
  let totalChecks = 0;
  
  // 巻の比較
  if (original.volume && found.volume) {
    result.volume = original.volume.toString() === found.volume.toString();
    if (result.volume) matchCount++;
    totalChecks++;
  } else if (original.volume || found.volume) {
    // 片方にだけ巻がある場合は不一致として扱う
    result.volume = false;
    totalChecks++;
    console.log(`📊 巻の片側のみ: 入力="${original.volume || 'なし'}" vs 候補="${found.volume || 'なし'}" → 不一致`);
  }
  
  // 号の比較
  if (original.issue && found.issue) {
    result.issue = original.issue.toString() === found.issue.toString();
    if (result.issue) matchCount++;
    totalChecks++;
  } else if (original.issue || found.issue) {
    // 片方にだけ号がある場合は不一致として扱う
    result.issue = false;
    totalChecks++;
    console.log(`📊 号の片側のみ: 入力="${original.issue || 'なし'}" vs 候補="${found.issue || 'なし'}" → 不一致`);
  }
  
  // ページの比較（範囲の重複をチェック）
  if (original.pages && found.pages) {
    result.pages = comparePagesRange(original.pages, found.pages);
    if (result.pages) matchCount++;
    totalChecks++;
  } else if (original.pages || found.pages) {
    // 片方にだけページがある場合は不一致として扱う
    result.pages = false;
    totalChecks++;
    console.log(`📊 ページの片側のみ: 入力="${original.pages || 'なし'}" vs 候補="${found.pages || 'なし'}" → 不一致`);
  }
  
  // 全体的な一致判定とスコア計算
  if (totalChecks > 0) {
    result.score = (matchCount / totalChecks) * 100;
    result.overallMatch = result.score === 100;
  }
  
  console.log(`📊 巻号ページ比較:`, {
    original: { volume: original.volume, issue: original.issue, pages: original.pages },
    found: { volume: found.volume, issue: found.issue, pages: found.pages },
    result
  });
  
  return result;
};

// ページ範囲の比較（"123-145" vs "123-145" または重複チェック）
const comparePagesRange = (pages1, pages2) => {
  if (!pages1 || !pages2) return false;
  
  // 完全一致チェック
  if (pages1 === pages2) return true;
  
  // 範囲の解析
  const parsePageRange = (pageStr) => {
    const match = pageStr.match(/(\d+)[-–—](\d+)/);
    if (match) {
      return {
        start: parseInt(match[1]),
        end: parseInt(match[2])
      };
    }
    // 単一ページの場合
    const singleMatch = pageStr.match(/(\d+)/);
    if (singleMatch) {
      const page = parseInt(singleMatch[1]);
      return { start: page, end: page };
    }
    return null;
  };
  
  const range1 = parsePageRange(pages1);
  const range2 = parsePageRange(pages2);
  
  if (!range1 || !range2) return false;
  
  // 範囲の重複チェック
  const hasOverlap = range1.start <= range2.end && range2.start <= range1.end;
  
  console.log(`📄 ページ範囲比較: "${pages1}" vs "${pages2}"`, {
    range1, range2, hasOverlap
  });
  
  return hasOverlap;
};

// 総合一致率を計算する
export const calculateOverallSimilarity = (parsedInfo, result) => {
  if (!result.title) {
    return 0;
  }

  let totalScore = 0;
  let weightSum = 0;
  
  // 書籍かどうかで重み付けを変更
  const isBook = parsedInfo.isBook || (!parsedInfo.journal && !result.journal);
  
  if (isBook) {
    // 書籍の場合の重み付け
    console.log('📚 書籍として評価');
    
    // タイトル類似度（重み: 50%） - 重要だが年代・出版社も考慮
    const normalizedInputTitle = normalizeBookTitle(parsedInfo.title);
    const normalizedResultTitle = normalizeBookTitle(result.title);
    let titleSimilarity = calculateSimilarity(normalizedInputTitle, normalizedResultTitle);
    
    // サブタイトル付き結果の優先ロジック
    const hasInputSubtitle = /[:：]/.test(parsedInfo.title);
    const hasResultSubtitle = /[:：]/.test(result.title);
    
    if (!hasInputSubtitle && hasResultSubtitle && titleSimilarity >= 85) {
      // 厳密な条件チェック:
      // 1. 入力にサブタイトルなし & 検索結果にサブタイトルあり
      // 2. メインタイトルが85%以上一致
      // 3. 著者が70%以上一致
      // 4. 年度が一致（±1年以内）
      
      let shouldApplyBonus = false;
      
      // 著者一致チェック
      if (parsedInfo.authors && result.authors) {
        const authorResult = compareAuthors(parsedInfo.authors, result.authors);
        const authorMatch = authorResult.score >= 70;
        
        // 年度一致チェック
        const yearMatch = parsedInfo.year && result.year ? 
          compareYear(parsedInfo.year, result.year, false) : true; // 年度不明の場合は通す
        
        if (authorMatch && yearMatch) {
          shouldApplyBonus = true;
          const bonus = Math.min(8, 100 - titleSimilarity); // 最大8%のボーナス
          titleSimilarity = Math.min(100, titleSimilarity + bonus);
          
          console.log(`📚 サブタイトルボーナス適用: +${bonus}% → ${titleSimilarity.toFixed(1)}%`);
          console.log(`   条件: 著者一致=${authorResult.score}%, 年度一致=${yearMatch}, メインタイトル一致=${titleSimilarity - bonus}%`);
          console.log(`   入力: "${parsedInfo.title}" (サブタイトル: なし)`);
          console.log(`   結果: "${result.title}" (サブタイトル: あり)`);
        }
      }
    }
    
    console.log(`📚 書籍タイトル比較: "${normalizedInputTitle}" vs "${normalizedResultTitle}" = ${titleSimilarity.toFixed(1)}%`);
    totalScore += titleSimilarity * 0.5;
    weightSum += 0.5;

    // 著者一致度（重み: 20%） - 書籍では著者が重要
    if (parsedInfo.authors && result.authors) {
      const authorResult = compareAuthors(parsedInfo.authors, result.authors);
      const authorScore = authorResult.score;
      totalScore += authorScore * 0.2;
      weightSum += 0.2;
    }

    // 年の一致度（重み: 15%） - 書籍では再版で年が変わるため重要
    if (parsedInfo.year && result.year) {
      const yearMatch = compareYear(parsedInfo.year, result.year, true); // 書籍モード（±3年許容）
      const yearScore = yearMatch ? 100 : Math.max(0, 100 - Math.abs(parseInt(parsedInfo.year) - parseInt(result.year)) * 1); // 書籍では年差ペナルティ軽減
      console.log(`📚 年度比較: ${parsedInfo.year} vs ${result.year} = ${yearScore}% (一致: ${yearMatch}, 差: ${Math.abs(parseInt(parsedInfo.year) - parseInt(result.year))}年)`);
      totalScore += yearScore * 0.15;
      weightSum += 0.15;
    } else if (parsedInfo.year && !result.year) {
      // 元に年度があるが結果に年度がない場合はペナルティ
      console.log(`📚 年度なし: 元=${parsedInfo.year} vs 結果=n.d. - ペナルティ適用`);
      totalScore += 0; // 0点
      weightSum += 0.15; // 重みは計上する
    }

    // 出版社類似度（重み: 15%） - 書籍では再版で出版社が変わるため重要
    if (parsedInfo.publisher && result.publisher) {
      // 「[Publisher unknown]」などの明示的な不明表記をチェック
      const isUnknownPublisher = (pub) => {
        const lower = pub.toLowerCase();
        return lower.includes('unknown') || lower.includes('不明') || lower.includes('情報なし') || 
               lower.includes('[publisher') || lower.includes('publisher]');
      };
      
      if (isUnknownPublisher(result.publisher)) {
        // 出版社が不明の場合はペナルティ
        console.log(`📚 出版社不明: 元="${parsedInfo.publisher}" vs 結果="${result.publisher}" - ペナルティ適用`);
        totalScore += 0; // 0点
        weightSum += 0.15; // 重みは計上する
      } else {
        // 企業接尾辞を無視した正規化済みの出版社名で比較
        const normalizedInputPublisher = normalizePublisher(parsedInfo.publisher);
        const normalizedResultPublisher = normalizePublisher(result.publisher);
        const publisherSimilarity = calculateSimilarity(normalizedInputPublisher, normalizedResultPublisher);
        console.log(`📚 出版社比較: "${normalizedInputPublisher}" vs "${normalizedResultPublisher}" = ${publisherSimilarity.toFixed(1)}%`);
        totalScore += publisherSimilarity * 0.15;
        weightSum += 0.15;
      }
    } else if (result.publisher) {
      // 出版社があるが元に出版社情報がない場合、候補が書籍である可能性が高い
      totalScore += 80 * 0.15; // ボーナススコア（重みも更新）
      weightSum += 0.15;
    } else if (parsedInfo.publisher) {
      // 元に出版社があるが結果に出版社がない場合はペナルティ
      console.log(`📚 出版社なし: 元="${parsedInfo.publisher}" vs 結果=なし - ペナルティ適用`);
      totalScore += 0; // 0点
      weightSum += 0.15; // 重みは計上する
    }
    
    // 雑誌名がある場合は書評などの可能性が高いので減点
    if (result.journal) {
      console.log('⚠️ 書籍候補だが雑誌名あり（書評の可能性）- 減点');
      totalScore *= 0.7; // 30%減点
    }
    
  } else {
    // 論文の場合の重み付け（巻号ページ番号を追加）
    console.log('📄 論文として評価');
    
    // タイトル類似度（重み: 40%） - 論文では巻号ページ番号も重要なので重みを調整
    let titleSimilarity = calculateSimilarity(parsedInfo.title, result.title);
    
    // サブタイトル付き結果の優先ロジック（論文も同様）
    const hasInputSubtitle = /[:：]/.test(parsedInfo.title);
    const hasResultSubtitle = /[:：]/.test(result.title);
    
    if (!hasInputSubtitle && hasResultSubtitle && titleSimilarity >= 85) {
      // 著者一致チェック
      if (parsedInfo.authors && result.authors) {
        const authorResult = compareAuthors(parsedInfo.authors, result.authors);
        const authorMatch = authorResult.score >= 70;
        
        // 年度一致チェック
        const yearMatch = parsedInfo.year && result.year ? 
          compareYear(parsedInfo.year, result.year, false) : true;
        
        if (authorMatch && yearMatch) {
          const bonus = Math.min(8, 100 - titleSimilarity); // 最大8%のボーナス
          titleSimilarity = Math.min(100, titleSimilarity + bonus);
          
          console.log(`📄 論文サブタイトルボーナス適用: +${bonus}% → ${titleSimilarity.toFixed(1)}%`);
          console.log(`   条件: 著者一致=${authorResult.score}%, 年度一致=${yearMatch}`);
        }
      }
    }
    
    totalScore += titleSimilarity * 0.4;
    weightSum += 0.4;

    // 著者一致度（重み: 15%） 
    if (parsedInfo.authors && result.authors) {
      const authorResult = compareAuthors(parsedInfo.authors, result.authors);
      const authorScore = authorResult.score;
      totalScore += authorScore * 0.15;
      weightSum += 0.15;
    }

    // 年の一致度（重み: 15%）
    if (parsedInfo.year && result.year) {
      const yearMatch = compareYear(parsedInfo.year, result.year, false); // 論文モード（±1年許容）
      const yearScore = yearMatch ? 100 : Math.max(0, 100 - Math.abs(parseInt(parsedInfo.year) - parseInt(result.year)) * 2);
      totalScore += yearScore * 0.15;
      weightSum += 0.15;
    } else if (parsedInfo.year && !result.year) {
      // 元に年度があるが結果に年度がない場合はペナルティ
      console.log(`📄 年度なし: 元=${parsedInfo.year} vs 結果=n.d. - ペナルティ適用`);
      totalScore += 0; // 0点
      weightSum += 0.15; // 重みは計上する
    }

    // 雑誌名類似度（重み: 15%）
    if (parsedInfo.journal && result.journal) {
      const journalSimilarity = calculateSimilarity(parsedInfo.journal, result.journal);
      totalScore += journalSimilarity * 0.15;
      weightSum += 0.15;
    }

    // 巻号ページ番号の一致度（重み: 15%） - 論文の重要な識別子
    const volumeIssueResult = compareVolumeIssuePages(parsedInfo, result);
    if (volumeIssueResult.score > 0) {
      console.log(`📄 巻号ページ比較スコア: ${volumeIssueResult.score}%`);
      totalScore += volumeIssueResult.score * 0.15;
      weightSum += 0.15;
    }
  }

  // 重み付き平均を計算
  let overallSimilarity = weightSum > 0 ? totalScore / weightSum : 0;

  // 著者結果の詳細情報も含める
  const authorResult = parsedInfo.authors && result.authors ? compareAuthors(parsedInfo.authors, result.authors) : null;
  
  // 著者名一致ボーナス・ペナルティを適用
  if (authorResult && authorResult.score === 100) {
    // 著者名が完全一致の場合、大きなボーナス
    const authorBonus = Math.min(8, (100 - overallSimilarity) * 0.15); // 最大8%のボーナス
    const originalScore = overallSimilarity;
    overallSimilarity = Math.min(100, overallSimilarity + authorBonus);
    
    console.log(`🎯 著者完全一致ボーナス適用: 著者100% → 総合${originalScore.toFixed(1)}% + ${authorBonus.toFixed(1)}% = ${overallSimilarity.toFixed(1)}%`);
  } else if (authorResult && authorResult.score >= 90) {
    // 著者名が90%以上一致している場合、小さなボーナス
    const authorBonus = Math.min(5, (100 - overallSimilarity) * 0.1); // 最大5%のボーナス
    const originalScore = overallSimilarity;
    overallSimilarity = Math.min(100, overallSimilarity + authorBonus);
    
    console.log(`🎯 著者高一致ボーナス適用: 著者${authorResult.score}% → 総合${originalScore.toFixed(1)}% + ${authorBonus.toFixed(1)}% = ${overallSimilarity.toFixed(1)}%`);
  } else if (authorResult && authorResult.score === 0) {
    // 著者名が完全不一致の場合、ペナルティを適用
    const authorPenalty = Math.min(15, overallSimilarity * 0.2); // 最大15%のペナルティ、高スコアほど大きなペナルティ
    const originalScore = overallSimilarity;
    overallSimilarity = Math.max(0, overallSimilarity - authorPenalty);
    
    console.log(`⚠️ 著者完全不一致ペナルティ適用: 著者0% → 総合${originalScore.toFixed(1)}% - ${authorPenalty.toFixed(1)}% = ${overallSimilarity.toFixed(1)}%`);
  } else if (authorResult && authorResult.score <= 20) {
    // 著者名が20%以下の低一致の場合、軽いペナルティ
    const authorPenalty = Math.min(8, overallSimilarity * 0.1); // 最大8%のペナルティ
    const originalScore = overallSimilarity;
    overallSimilarity = Math.max(0, overallSimilarity - authorPenalty);
    
    console.log(`⚠️ 著者低一致ペナルティ適用: 著者${authorResult.score}% → 総合${originalScore.toFixed(1)}% - ${authorPenalty.toFixed(1)}% = ${overallSimilarity.toFixed(1)}%`);
  }
  
  // タイトル類似度を取得（書籍・論文共通）
  const titleSimilarity = calculateSimilarity(parsedInfo.title, result.title);
  
  // 出版社類似度を計算（表示用）
  let publisherScore = null;
  if (result.publisher) {
    const isUnknownPublisher = (pub) => {
      const lower = pub.toLowerCase();
      return lower.includes('unknown') || lower.includes('不明') || lower.includes('情報なし') || 
             lower.includes('[publisher') || lower.includes('publisher]');
    };
    
    if (isUnknownPublisher(result.publisher)) {
      publisherScore = 0; // 不明の場合は0%
    } else if (parsedInfo.publisher && parsedInfo.publisher.trim()) {
      // 入力に出版社がある場合は類似度計算
      const normalizedInputPublisher = normalizePublisher(parsedInfo.publisher);
      const normalizedResultPublisher = normalizePublisher(result.publisher);
      console.log(`📚 出版社スコア計算:`);
      console.log(`  入力: "${parsedInfo.publisher}" → 正規化: "${normalizedInputPublisher}"`);
      console.log(`  候補: "${result.publisher}" → 正規化: "${normalizedResultPublisher}"`);
      publisherScore = calculateSimilarity(normalizedInputPublisher, normalizedResultPublisher);
      console.log(`  最終スコア: ${publisherScore.toFixed(1)}%`);
    } else {
      // 入力に出版社がないが候補にはある場合は「出版社情報あり」として表示
      publisherScore = -1; // 特別な値として-1を設定（UIで別処理）
    }
  }

  // 巻号ページ番号スコアの計算（表示用）
  let volumeIssueScore = null;
  if (!isBook) { // 論文の場合のみ
    const volumeIssueResult = compareVolumeIssuePages(parsedInfo, result);
    volumeIssueScore = volumeIssueResult.score > 0 ? volumeIssueResult.score : null;
  }

  const returnValue = {
    overall: overallSimilarity,
    title: titleSimilarity,
    author: authorResult ? authorResult.score : null,
    authorDetails: authorResult,
    year: parsedInfo.year && result.year ? (compareYear(parsedInfo.year, result.year) ? 100 : 0) : null,
    journal: parsedInfo.journal && result.journal ? calculateSimilarity(parsedInfo.journal, result.journal) : null,
    publisher: publisherScore,
    volumeIssuePages: volumeIssueScore,
    isBookEvaluation: isBook
  };
  
  console.log(`📊 詳細スコア計算結果: "${result.title?.substring(0, 30)}..."`, {
    isBook,
    publisherScore,
    originalPublisher: parsedInfo.publisher,
    resultPublisher: result.publisher,
    returnValue
  });
  
  return returnValue;
};

// 複数候補をスコア順に分析・ランキング
export const analyzeAndRankCandidates = (parsedInfo, allResults) => {
  if (!allResults || allResults.length === 0) {
    return [];
  }

  console.log(`🔍 複数候補分析: ${allResults.length}件の候補をランキング`);

  // タイトルがない場合は検索結果なしとみなす
  if (!parsedInfo.title || parsedInfo.title.trim() === '') {
    console.warn('⚠️ タイトルがないため、マッチング不可');
    return [];
  }

  // 各候補を評価してスコア付き結果を生成
  const scoredResults = allResults
    .map((result, index) => {
      if (!result.title) {
        console.log(`  候補${index + 1}: タイトルなし - スキップ`);
        return null;
      }

      const similarities = calculateOverallSimilarity(parsedInfo, result);
      
      console.log(`  候補${index + 1}: "${result.title.substring(0, 40)}..." (総合: ${similarities.overall.toFixed(1)}%)`);
      console.log(`    - タイトル: ${similarities.title.toFixed(1)}%`);
      if (similarities.author !== null) console.log(`    - 著者: ${similarities.author}%`);
      if (similarities.year !== null) console.log(`    - 年: ${similarities.year}%`);
      if (similarities.journal !== null) console.log(`    - 雑誌: ${similarities.journal.toFixed(1)}%`);
      if (similarities.publisher !== null) console.log(`    - 出版社: ${similarities.publisher.toFixed(1)}%`);

      return {
        ...result,
        similarities,
        overallScore: similarities.overall
      };
    })
    .filter(result => result !== null)
    .filter(result => result.overallScore >= 50) // 閾値を緩和 66% → 50%
    .sort((a, b) => b.overallScore - a.overallScore)
    .slice(0, 8); // 上位8件まで表示

  console.log(`📊 ランキング結果: ${scoredResults.length}件（50%以上）`);
  scoredResults.forEach((result, index) => {
    console.log(`  ${index + 1}位: "${result.title.substring(0, 40)}..." (${result.overallScore.toFixed(1)}%)`);
  });

  return scoredResults;
};

// 最も類似した結果を見つける（後方互換性のため）
export const findMostSimilarResult = (parsedInfo, allResults) => {
  const rankedResults = analyzeAndRankCandidates(parsedInfo, allResults);
  return rankedResults.length > 0 ? rankedResults[0] : null;
};

// 結果の状態を決定する（総合スコア戦略）
export const determineResultStatus = (parsedInfo, mostSimilarResult) => {
  if (!mostSimilarResult) {
    return 'not_found';
  }

  // 総合一致度を取得（スコア付き結果の場合）
  const overallScore = mostSimilarResult.overallScore || 
    calculateOverallSimilarity(parsedInfo, mostSimilarResult).overall;
  
  console.log(`📊 ステータス判定: 総合スコア ${overallScore.toFixed(1)}%`);

  // 100%一致の場合
  if (overallScore >= 100) {
    console.log('💯 found: 完全一致');
    return 'found';
  }
  
  // 高精度一致の場合（90%以上）
  if (overallScore >= 90) {
    console.log('✅ found: 高精度一致');
    return 'found';
  }
  
  // 部分一致の場合（66%以上）
  if (overallScore >= 66) {
    console.log('🔍 similar: 部分一致');
    return 'similar';
  }
  
  // スコアが低い場合
  console.log('❌ not_found: スコア不足');
  return 'not_found';
};

// 統計情報を更新する
export const updateStatistics = (results) => {
  return results.reduce(
    (stats, result) => {
      switch (result.status) {
        case 'found':
          stats.found++;
          break;
        case 'similar':
          stats.similar++;
          break;
        default:
          stats.notFound++;
      }
      return stats;
    },
    { found: 0, similar: 0, notFound: 0 }
  );
};