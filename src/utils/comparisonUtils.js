/**
 * 比較・類似度計算ユーティリティ
 */

// 類似度計算（レーベンシュタイン距離ベース）
export const calculateSimilarity = (str1, str2) => {
  if (!str1 || !str2) return 0;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) {
    return 100;
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
  return ((longer.length - distance) / longer.length) * 100;
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

// 著者名の正規化（改良版）
export const normalizeAuthorName = (name) => {
  if (!name || typeof name !== 'string') return '';
  
  // 基本的なクリーニング
  let normalized = name.trim();
  
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
  } else if (isKorean) {
    // 韓国語名の場合、そのまま保持
    normalized = normalized.toLowerCase().trim();
  } else {
    // 英語名の場合、形式を統一してから正規化
    normalized = normalizeEnglishNameFormat(normalized);
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
  
  if (lastName1 !== lastName2) {
    return false; // 姓が一致しない場合は不一致
  }
  
  // 名前部分のイニシャル一致をチェック
  const firstNames1 = parts1.slice(0, -1);
  const firstNames2 = parts2.slice(0, -1);
  
  // 名前の数が大きく違う場合はスキップ
  if (Math.abs(firstNames1.length - firstNames2.length) > 1) {
    return false;
  }
  
  const maxLength = Math.max(firstNames1.length, firstNames2.length);
  
  for (let i = 0; i < maxLength; i++) {
    const fn1 = firstNames1[i] || '';
    const fn2 = firstNames2[i] || '';
    
    if (!fn1 || !fn2) {
      continue; // どちらかが存在しない場合はスキップ
    }
    
    // ピリオドを除去してチェック
    const clean1 = fn1.replace(/\./g, '');
    const clean2 = fn2.replace(/\./g, '');
    
    // どちらかがイニシャル（1文字）の場合、先頭文字で比較
    if (clean1.length === 1 || clean2.length === 1) {
      if (clean1.charAt(0) !== clean2.charAt(0)) {
        console.log(`  イニシャル不一致: "${clean1}" vs "${clean2}"`);
        return false;
      }
      console.log(`  イニシャル一致: "${clean1}" ~ "${clean2}"`);
    } else {
      // 両方とも完全名の場合は完全一致を要求
      if (clean1 !== clean2) {
        console.log(`  完全名不一致: "${clean1}" vs "${clean2}"`);
        return false;
      }
      console.log(`  完全名一致: "${clean1}" = "${clean2}"`);
    }
  }
  
  return true;
};

// 著者名の比較（改良版 - より柔軟な判定）
export const compareAuthors = (originalAuthors, foundAuthors) => {
  if (!originalAuthors || !foundAuthors || originalAuthors.length === 0 || foundAuthors.length === 0) {
    return false;
  }
  
  // 文字列の場合は配列に変換（セミコロンやカンマで分割）
  const parseAuthorString = (authorStr) => {
    if (typeof authorStr === 'string') {
      return authorStr.split(/[;；,，&]/).map(a => a.trim()).filter(a => a);
    }
    return Array.isArray(authorStr) ? authorStr : [];
  };
  
  const originalArray = Array.isArray(originalAuthors) ? originalAuthors : parseAuthorString(originalAuthors);
  const foundArray = Array.isArray(foundAuthors) ? foundAuthors : parseAuthorString(foundAuthors);
  
  // 両方の著者リストを正規化
  const normalizedOriginal = originalArray.map(author => normalizeAuthorName(author));
  const normalizedFound = foundArray.map(author => normalizeAuthorName(author));
  
  console.log('📝 著者比較詳細:', {
    original: originalArray,
    found: foundArray,
    normalizedOriginal,
    normalizedFound
  });
  
  // より正確な名前比較
  const isNameMatch = (name1, name2) => {
    if (!name1 || !name2 || typeof name1 !== 'string' || typeof name2 !== 'string') {
      return false;
    }
    
    // 正規化された名前を取得
    const normalized1 = name1.toLowerCase().trim();
    const normalized2 = name2.toLowerCase().trim();
    
    // 完全一致の場合
    if (normalized1 === normalized2) {
      console.log(`  完全一致: "${name1}" = "${name2}"`);
      return true;
    }
    
    // 文字の種類を判定
    const isJapanese1 = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(name1);
    const isJapanese2 = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(name2);
    const isKorean1 = /[\uAC00-\uD7AF]/.test(name1);
    const isKorean2 = /[\uAC00-\uD7AF]/.test(name2);
    
    // 異なる言語の場合は一致しない
    if ((isJapanese1 && isKorean2) || (isKorean1 && isJapanese2)) {
      console.log(`  言語不一致: "${name1}" (日本語: ${isJapanese1}, 韓国語: ${isKorean1}) vs "${name2}" (日本語: ${isJapanese2}, 韓国語: ${isKorean2})`);
      return false;
    }
    
    // 日本語名の場合の特別処理
    if (isJapanese1 && isJapanese2) {
      // 日本語同士の場合、比較
      const clean1 = name1.replace(/[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '');
      const clean2 = name2.replace(/[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '');
      const similarity = calculateSimilarity(clean1, clean2);
      console.log(`  日本語名比較: "${clean1}" vs "${clean2}" (類似度: ${similarity.toFixed(1)}%)`);
      return similarity >= 75; // 日本語名の閾値を緩和 85% → 75%
    }
    
    // 英語名の場合
    if (!isJapanese1 && !isJapanese2 && !isKorean1 && !isKorean2) {
      // 英語名同士の場合、形式を統一してから比較
      const clean1 = normalizeEnglishNameFormat(name1);
      const clean2 = normalizeEnglishNameFormat(name2);
      
      if (clean1 === clean2) {
        console.log(`  英語名完全一致: "${clean1}" = "${clean2}"`);
        return true;
      }
      
      // イニシャルと完全名の比較を改善
      if (isInitialMatch(clean1, clean2)) {
        console.log(`  英語名イニシャル一致: "${clean1}" ~ "${clean2}"`);
        return true;
      }
      
      const similarity = calculateSimilarity(clean1, clean2);
      console.log(`  英語名比較: "${clean1}" vs "${clean2}" (類似度: ${similarity.toFixed(1)}%)`);
      return similarity >= 80; // 英語名の閾値を緩和 90% → 80%
    }
    
    return false;
  };
  
  // 各原著者に対して一致する検索結果著者がいるかチェック
  const matchCount = normalizedOriginal.filter(origAuthor => 
    normalizedFound.some(foundAuthor => isNameMatch(origAuthor, foundAuthor))
  ).length;
  
  // より柔軟な著者一致判定：1/3以上または少なくとも1人一致
  const matchRatio = matchCount / normalizedOriginal.length;
  const isMatch = matchRatio >= 0.33 || (matchCount >= 1 && normalizedOriginal.length <= 2);
  
  console.log(`✅ 著者一致判定: ${matchCount}/${normalizedOriginal.length} (${(matchRatio * 100).toFixed(1)}%) → ${isMatch ? '一致' : '不一致'}`);
  
  return isMatch;
};

// 年の比較（±1年の誤差を許容・安全な型チェック版）
export const compareYear = (originalYear, foundYear) => {
  if (!originalYear || !foundYear || typeof originalYear !== 'string' || typeof foundYear !== 'string') {
    return false;
  }
  
  const origNum = parseInt(originalYear);
  const foundNum = parseInt(foundYear);
  
  if (isNaN(origNum) || isNaN(foundNum)) {
    return false;
  }
  
  const diff = Math.abs(origNum - foundNum);
  return diff <= 1;
};

// 総合一致率を計算する
export const calculateOverallSimilarity = (parsedInfo, result) => {
  if (!result.title) {
    return 0;
  }

  let totalScore = 0;
  let weightSum = 0;

  // タイトル類似度（重み: 50%） 
  const titleSimilarity = calculateSimilarity(parsedInfo.title, result.title);
  totalScore += titleSimilarity * 0.5;
  weightSum += 0.5;

  // 著者一致度（重み: 15%） 
  if (parsedInfo.authors && result.authors) {
    const authorMatch = compareAuthors(parsedInfo.authors, result.authors);
    const authorScore = authorMatch ? 100 : 30; // 不一致でも30点を付与（完全0点を避ける）
    totalScore += authorScore * 0.15;
    weightSum += 0.15;
  }

  // 年の一致度（重み: 20%） - 原著論文発見のため重み増加
  if (parsedInfo.year && result.year) {
    const yearMatch = compareYear(parsedInfo.year, result.year);
    const yearScore = yearMatch ? 100 : Math.max(0, 100 - Math.abs(parseInt(parsedInfo.year) - parseInt(result.year)) * 2); // 年差に応じて減点
    totalScore += yearScore * 0.2;
    weightSum += 0.2;
  }

  // 雑誌名類似度（重み: 15%） - 原著論文発見のため重み維持
  if (parsedInfo.journal && result.journal) {
    const journalSimilarity = calculateSimilarity(parsedInfo.journal, result.journal);
    totalScore += journalSimilarity * 0.15;
    weightSum += 0.15;
  }

  // 重み付き平均を計算
  const overallSimilarity = weightSum > 0 ? totalScore / weightSum : 0;

  return {
    overall: overallSimilarity,
    title: titleSimilarity,
    author: parsedInfo.authors && result.authors ? (compareAuthors(parsedInfo.authors, result.authors) ? 100 : 0) : null,
    year: parsedInfo.year && result.year ? (compareYear(parsedInfo.year, result.year) ? 100 : 0) : null,
    journal: parsedInfo.journal && result.journal ? calculateSimilarity(parsedInfo.journal, result.journal) : null
  };
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