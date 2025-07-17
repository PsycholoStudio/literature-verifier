/**
 * 引用形式フォーマッター（統合版）
 */

import { compareAuthors, compareYear } from './comparisonUtils';

// Citation表示用の著者名正規化（大文字小文字を保持）
const normalizeAuthorNameForDisplay = (name, source) => {
  if (!name || typeof name !== 'string') return '';
  
  let normalized = name.trim();
  
  // 「姓, 名」形式を「名 姓」形式に変換
  if (normalized.includes(',')) {
    const parts = normalized.split(',').map(p => p.trim());
    if (parts.length === 2) {
      const lastName = parts[0];
      const firstName = parts[1];
      normalized = `${firstName} ${lastName}`;
    }
  } else {
    // カンマなし形式の処理：CiNiiとNDLのみ対象
    // 「EINSTEIN A.」→「A. EINSTEIN」、「HINTON G. E.」→「G. E. HINTON」
    if (source === 'CiNii' || source === 'NDL') {
      const parts = normalized.split(/\s+/).filter(p => p.length > 0);
      if (parts.length === 2) {
        const [first, second] = parts;
        // 2番目の部分がイニシャル形式の場合の処理
        if (second.match(/^[A-Z]{1,3}\.?$/) && second.length <= 3) {
          // 「SHANNON CE」→「C. E. SHANNON」（連続した大文字を分割）
          if (second.match(/^[A-Z]{2,3}$/)) {
            const initials = second.split('').map(char => `${char}.`).join(' ');
            normalized = `${initials} ${first}`;
          } else {
            normalized = `${second} ${first}`;
          }
        }
        // 「Hinton G.E.」パターン（G.E.が1つのトークンになる場合）
        else if (second.match(/^[A-Z]\.[A-Z]\.?$/)) {
          // 「G.E.」→「G. E.」に分割
          const expandedInitials = second.replace(/([A-Z])\./g, '$1. ').trim();
          normalized = `${expandedInitials} ${first}`;
        }
        // 通常の名前形式（両方ともフルネーム）の場合は変更しない
      } else if (parts.length === 3) {
        // 3つの部分がある場合：「HINTON G. E.」→「G. E. HINTON」
        const [first, second, third] = parts;
        // 2番目と3番目の部分がイニシャル形式（1文字の大文字）の場合のみ
        if (second.match(/^[A-Z]\.?$/) && third.match(/^[A-Z]\.?$/)) {
          normalized = `${second} ${third} ${first}`;
        }
        // 1番目と2番目がイニシャル、3番目が姓の場合：「G. E. HINTON」（既に正しい形式）
        else if (first.match(/^[A-Z]\.?$/) && second.match(/^[A-Z]\.?$/)) {
          // 既に正しい形式なのでそのまま
          normalized = `${first} ${second} ${third}`;
        }
      }
    }
  }
  
  // イニシャルを正規化 (G.A. → G. A.)
  normalized = normalized.replace(/([A-Z])\.([A-Z])/g, '$1. $2');
  
  return normalized;
};

// 著者文字列の正確な解析（姓, 名イニシャル形式対応）
const parseAuthorString = (authorString) => {
  if (!authorString || typeof authorString !== 'string') return [];
  
  // // console.log(`🔍 著者文字列解析: "${authorString}"`);
  
  // &記号を一時的にプレースホルダーに置換
  let text = authorString.replace(/\s*&\s*/g, '__AND__');
  
  // 「姓, イニシャル」パターンを認識
  // 例: "Russell, S." や "Norvig, P."
  const authorPattern = /([A-Z][a-zA-Z-]*(?:\s+[A-Z][a-zA-Z-]*)*),\s*([A-Z]\.\s*(?:[A-Z]\.\s*)*)/g;
  
  const authors = [];
  let remainingText = text;
  let match;
  
  // パターンマッチングで「姓, イニシャル」形式の著者を抽出
  // // console.log(`  📝 正規表現パターン: ${authorPattern}`);
  
  while ((match = authorPattern.exec(text)) !== null) {
    const fullAuthor = `${match[1]}, ${match[2].trim()}`;
    authors.push(fullAuthor);
    // // console.log(`  📝 著者発見: "${fullAuthor}" (マッチ文字列: "${match[0]}")`);
    
    // マッチした部分を残りテキストから除去
    remainingText = remainingText.replace(match[0], '');
    // // console.log(`  📝 除去後残りテキスト: "${remainingText}"`);
  }
  
  // __AND__も除去し、余分なカンマを除去
  remainingText = remainingText.replace(/__AND__/g, '').replace(/,\s*$/, '').trim();
  
  // 残りがあれば通常の著者名として追加
  if (remainingText) {
    const remaining = remainingText.split(/[;]/).map(r => r.trim()).filter(r => r);
    authors.push(...remaining);
    // // console.log(`  📝 残り著者: [${remaining.join(', ')}]`);
  }
  
  // // console.log(`🔍 著者解析結果: [${authors.map(a => `"${a}"`).join(', ')}]`);
  const filteredAuthors = authors.filter(a => a && a.trim());
  // // console.log(`🔍 フィルタ後著者: [${filteredAuthors.map(a => `"${a}"`).join(', ')}]`);
  return filteredAuthors;
};

// 出版社名特有の正規化（企業接尾辞を除去）
const normalizePublisherForComparison = (text) => {
  if (!text) return text;
  
  // // console.log(`📚 出版社正規化開始: "${text}"`);
  
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
    // 一般的な企業接尾辞を除去
    .replace(/\b(inc\.?|corp\.?|ltd\.?|llc\.?|co\.?|company|corporation|limited|incorporated)\b/gi, '')
    // 日本語の企業接尾辞を削除
    .replace(/[株式会社|有限会社]/g, '')
    // 句読点を統一
    .replace(/[\.。]/g, '') // ピリオドを削除
    .replace(/[,，]/g, '') // カンマを削除
    // 連続する空白を一つに正規化
    .replace(/\s+/g, ' ')
    .trim();
    
  // // console.log(`📚 出版社正規化完了: "${text}" → "${result}"`);
  return result;
};

// ハイフン・ダッシュの正規化
const normalizeDashes = (text) => {
  return text
    // 各種ダッシュを標準ハイフンに統一
    .replace(/[—–−]/g, '-') // em dash (—), en dash (–), minus sign (−) → hyphen (-)
    // 連続したハイフンを単一に
    .replace(/-+/g, '-');
};

// 単一部分のハイライト処理
const highlightSinglePart = (original, candidate, isJapanese = false, excludeFromOriginal = '') => {
  if (!original || !candidate) return candidate;
  
  // ハイフン・ダッシュを正規化してから比較
  const originalLower = normalizeDashes(original.toLowerCase());
  const candidateLower = normalizeDashes(candidate.toLowerCase());
  
  // 完全一致の場合は全体を緑に
  if (originalLower === candidateLower) {
    return `<span class="text-green-600 font-medium">${candidate}</span>`;
  }
  
  // 除外すべき文字列がある場合は除外して比較
  let effectiveOriginal = originalLower;
  if (excludeFromOriginal) {
    effectiveOriginal = originalLower.replace(excludeFromOriginal.toLowerCase(), '').trim();
  }
  
  if (isJapanese) {
    // 日本語の場合：文字レベルでの一致判定
    let result = '';
    let i = 0;
    
    while (i < candidate.length) {
      let matchFound = false;
      
      // 現在位置から最長の一致部分を探す（最低2文字以上）
      for (let length = Math.min(candidate.length - i, 10); length >= 2; length--) {
        const substr = candidate.substring(i, i + length);
        const substrLower = normalizeDashes(substr.toLowerCase());
        
        if (effectiveOriginal.includes(substrLower)) {
          result += `<span class="text-green-600 font-medium">${substr}</span>`;
          i += length;
          matchFound = true;
          break;
        }
      }
      
      if (!matchFound) {
        // 一致しない文字は赤で表示
        result += `<span class="text-red-600">${candidate.charAt(i)}</span>`;
        i++;
      }
    }
    
    return result;
  } else {
    // 英語の場合：単語単位での処理
    const originalWords = effectiveOriginal.split(/\s+/).filter(w => w);
    const candidateWords = candidate.split(/\s+/);
    
    return candidateWords.map(word => {
      const wordLower = normalizeDashes(word.toLowerCase());
      const hasMatch = originalWords.some(ow => {
        const owNormalized = normalizeDashes(ow);
        // 短い単語（2文字以下）は完全一致のみ、長い単語は部分一致も許可
        if (owNormalized.length <= 2 || wordLower.length <= 2) {
          return owNormalized === wordLower;
        } else {
          return owNormalized.includes(wordLower) || wordLower.includes(owNormalized);
        }
      });
      
      if (hasMatch) {
        return `<span class="text-green-600 font-medium">${word}</span>`;
      } else {
        return `<span class="text-red-600">${word}</span>`;
      }
    }).join(' ');
  }
};

// 部分一致のハイライト処理（日本語・英語対応）
// サブタイトルを入力テキスト全体と比較してハイライト
const highlightSubtitleAgainstFullText = (fullOriginal, subtitle, mainTitle, isJapanese = false) => {
  if (!fullOriginal || !subtitle) return subtitle;
  
  // ハイフン・ダッシュを正規化してから比較
  const originalLower = normalizeDashes(fullOriginal.toLowerCase());
  const subtitleLower = normalizeDashes(subtitle.toLowerCase());
  const mainTitleLower = normalizeDashes(mainTitle.toLowerCase());
  
  // メインタイトルの部分を除外した入力テキスト
  let effectiveOriginal = originalLower;
  if (mainTitle) {
    effectiveOriginal = originalLower.replace(mainTitleLower, '').trim();
    // コロンや句読点も除去
    effectiveOriginal = effectiveOriginal.replace(/^[：:、，。．\s]+|[：:、，。．\s]+$/g, '');
  }
  
  // サブタイトル全体が残りの入力テキストに含まれている場合
  if (effectiveOriginal.includes(subtitleLower)) {
    return `<span class="text-green-600 font-medium">${subtitle}</span>`;
  }
  
  if (isJapanese) {
    // 日本語の場合：文字レベルでの一致判定
    let result = '';
    let i = 0;
    
    while (i < subtitle.length) {
      let matchFound = false;
      
      // 現在位置から最長の一致部分を探す（最低2文字以上）
      for (let length = Math.min(subtitle.length - i, 10); length >= 2; length--) {
        const substr = subtitle.substring(i, i + length);
        const substrLower = normalizeDashes(substr.toLowerCase());
        
        if (effectiveOriginal.includes(substrLower)) {
          result += `<span class="text-green-600 font-medium">${substr}</span>`;
          i += length;
          matchFound = true;
          break;
        }
      }
      
      if (!matchFound) {
        // 一致しない文字は赤で表示
        result += `<span class="text-red-600">${subtitle.charAt(i)}</span>`;
        i++;
      }
    }
    
    return result;
  } else {
    // 英語の場合：単語単位での処理
    const originalWords = effectiveOriginal.split(/\s+/).filter(w => w);
    const subtitleWords = subtitle.split(/\s+/);
    
    const highlightedWords = subtitleWords.map(word => {
      const wordLower = normalizeDashes(word.toLowerCase());
      const isMatched = originalWords.some(origWord => 
        normalizeDashes(origWord.toLowerCase()) === wordLower
      );
      
      if (isMatched) {
        return `<span class="text-green-600 font-medium">${word}</span>`;
      } else {
        return `<span class="text-red-600">${word}</span>`;
      }
    });
    
    return highlightedWords.join(' ');
  }
};

const highlightPartialMatch = (original, candidate, isJapanese = false) => {
  if (!original || !candidate) return candidate;
  
  // コロン区切りタイトルの検出と分離
  const detectSubtitle = (text) => {
    const patterns = [
      /^([^:]+):\s*(.+)$/, // 英語コロン: "Title: Subtitle"
      /^([^：]+)：\s*(.+)$/ // 日本語コロン: "タイトル：サブタイトル"
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          hasSubtitle: true,
          mainTitle: match[1].trim(),
          subtitle: match[2].trim(),
          separator: text.includes('：') ? '：' : ':'
        };
      }
    }
    
    return { hasSubtitle: false, mainTitle: text, subtitle: '', separator: '' };
  };
  
  const originalParts = detectSubtitle(original);
  const candidateParts = detectSubtitle(candidate);
  
  // サブタイトルがある場合は分離して個別処理
  if (candidateParts.hasSubtitle) {
    const mainTitleHighlight = highlightSinglePart(originalParts.mainTitle, candidateParts.mainTitle, isJapanese);
    
    // サブタイトルの処理を改善
    let subtitleHighlight;
    if (originalParts.hasSubtitle) {
      // 入力にもサブタイトルがある場合：通常通り比較
      subtitleHighlight = highlightSinglePart(originalParts.subtitle, candidateParts.subtitle, isJapanese);
    } else {
      // 入力にサブタイトルがない場合：入力テキスト全体と候補のサブタイトルを比較
      // メインタイトル部分を除外して比較
      subtitleHighlight = highlightSubtitleAgainstFullText(original, candidateParts.subtitle, candidateParts.mainTitle, isJapanese);
    }
    
    return `${mainTitleHighlight}<span class="text-gray-700">${candidateParts.separator} </span>${subtitleHighlight}`;
  } else {
    // サブタイトルがない場合は従来通り
    return highlightSinglePart(original, candidate, isJapanese);
  }
};

// 出版社専用のハイライト処理（正規化を考慮）
const highlightPublisherMatch = (original, candidate, isJapanese = false) => {
  if (!original || !candidate) return candidate;
  
  // 正規化した文字列で比較
  const normalizedOriginal = normalizePublisherForComparison(original);
  const normalizedCandidate = normalizePublisherForComparison(candidate);
  
  // console.log(`📚 出版社正規化比較: "${original}" (→"${normalizedOriginal}") vs "${candidate}" (→"${normalizedCandidate}")`);
  
  // 完全一致の場合は全体を緑に
  if (normalizedOriginal === normalizedCandidate) {
    // // console.log(`📚 出版社完全一致: 緑色表示`);
    return `<span class="text-green-600 font-medium">${candidate}</span>`;
  }
  
  if (isJapanese) {
    // 日本語の場合：文字レベルでの一致判定（正規化済み）
    let result = '';
    let i = 0;
    
    while (i < candidate.length) {
      let matchFound = false;
      
      // 現在位置から最長の一致部分を探す（最低2文字以上）
      for (let length = Math.min(candidate.length - i, 10); length >= 2; length--) {
        const substr = candidate.substring(i, i + length);
        const normalizedSubstr = normalizePublisherForComparison(substr);
        
        if (normalizedOriginal.includes(normalizedSubstr) && normalizedSubstr.length > 0) {
          result += `<span class="text-green-600 font-medium">${substr}</span>`;
          i += length;
          matchFound = true;
          break;
        }
      }
      
      if (!matchFound) {
        // 一致しない文字は赤で表示
        result += `<span class="text-red-600">${candidate.charAt(i)}</span>`;
        i++;
      }
    }
    
    return result;
  } else {
    // 英語の場合：単語単位での処理（正規化を考慮）
    const originalWords = normalizedOriginal.split(/\s+/).filter(w => w);
    const candidateWords = candidate.split(/\s+/);
    
    return candidateWords.map((word, wordIndex) => {
      const normalizedWord = normalizePublisherForComparison(word);
      // // console.log(`📚 出版社単語 #${wordIndex + 1}: "${word}" → 正規化: "${normalizedWord}"`);
      // // console.log(`📚 元の正規化済み単語一覧:`, originalWords);
      
      const hasMatch = originalWords.some((ow, owIndex) => {
        // 短い単語（2文字以下）は完全一致のみ、長い単語は部分一致も許可
        const isExactMatch = ow === normalizedWord;
        const isPartialMatch = (ow.length > 2 && normalizedWord.length > 2) && 
                              (ow.includes(normalizedWord) || normalizedWord.includes(ow));
        const matchResult = isExactMatch || isPartialMatch;
        
        // // console.log(`📚   vs 元単語 #${owIndex + 1}: "${ow}" → 完全一致:${isExactMatch}, 部分一致:${isPartialMatch}, 結果:${matchResult}`);
        return matchResult;
      });
      
      if (hasMatch) {
        // // console.log(`📚 ✅ 出版社単語一致: "${word}" (正規化: "${normalizedWord}") → 緑色`);
        return `<span class="text-green-600 font-medium">${word}</span>`;
      } else {
        // // console.log(`📚 ❌ 出版社単語不一致: "${word}" (正規化: "${normalizedWord}") → 赤色`);
        return `<span class="text-red-600">${word}</span>`;
      }
    }).join(' ');
  }
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
};

// 英語名の姓・名前部分の一致判定（ミドルネーム対応）
const isEnglishNameMatch = (name1, name2) => {
  const parts1 = name1.split(/\s+/).filter(p => p.length > 0);
  const parts2 = name2.split(/\s+/).filter(p => p.length > 0);
  
  if (parts1.length < 2 || parts2.length < 2) return false;
  
  // 姓（最後の要素）が一致するかチェック
  const lastName1 = parts1[parts1.length - 1];
  const lastName2 = parts2[parts2.length - 1];
  
  if (lastName1 !== lastName2) return false;
  
  // 名前部分のイニシャル一致をチェック（ミドルネーム対応）
  const firstNames1 = parts1.slice(0, -1);
  const firstNames2 = parts2.slice(0, -1);
  
  // 短い方のすべての名前要素が長い方のリストのどこかにあるかチェック
  const shorterNames = firstNames1.length <= firstNames2.length ? firstNames1 : firstNames2;
  const longerNames = firstNames1.length > firstNames2.length ? firstNames1 : firstNames2;
  
  // 短い方のすべての名前要素が長い方のリスト全体から一致するものを探す
  for (let i = 0; i < shorterNames.length; i++) {
    const shortName = shorterNames[i] || '';
    
    if (!shortName) return false;
    
    // 長い方のリスト全体から一致するものを探す（位置に依らない）
    const found = longerNames.some(longName => isNameComponentMatch(shortName, longName));
    
    if (!found) return false;
  }
  
  return true;
};

// 特殊文字を基本文字に変換（ä → a, ö → o など）
const normalizeSpecialCharsForDisplay = (text) => {
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

// 英語名正規化（comparisonUtils.jsと同じロジック）
const normalizeEnglishName = (name) => {
  if (!name || typeof name !== 'string') return '';
  
  let normalized = name.trim().toLowerCase();
  
  // アクセント記号を正規化（重要：色分け処理でもアクセント記号を処理）
  normalized = normalizeSpecialCharsForDisplay(normalized);
  
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
  
  return normalized;
};

// 単一著者の一致判定（改良版・ミドルネーム対応）
const isAuthorMatch = (originalAuthor, candidateAuthor) => {
  if (!originalAuthor || !candidateAuthor) return false;
  
  // // console.log(`🎨 著者比較: "${originalAuthor}" vs "${candidateAuthor}"`);
  
  // 日本語名の場合は簡単な正規化
  const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(originalAuthor);
  
  if (isJapanese) {
    const norm1 = originalAuthor.toLowerCase().replace(/[・•・,，、\s]/g, '');
    const norm2 = candidateAuthor.toLowerCase().replace(/[・•・,，、\s]/g, '');
    const result = norm1 === norm2;
    // // console.log(`🎨 日本語名比較: "${norm1}" vs "${norm2}" → ${result}`);
    return result;
  }
  
  // 英語名の場合
  const norm1 = normalizeEnglishName(originalAuthor);
  const norm2 = normalizeEnglishName(candidateAuthor);
  
  // // console.log(`🎨 英語名正規化結果: "${originalAuthor}" → "${norm1}"`);
  // // console.log(`🎨 英語名正規化結果: "${candidateAuthor}" → "${norm2}"`);
  
  // 完全一致チェック
  if (norm1 === norm2) {
    // // console.log(`🎨 英語名完全一致: true`);
    return true;
  }
  
  // ミドルネーム考慮の一致チェック
  const result = isEnglishNameMatch(norm1, norm2);
  // // console.log(`🎨 英語名ミドルネーム考慮一致判定: ${result}`);
  
  return result;
};

// 著者名の比較とハイライト（APAスタイル）
const formatAuthorsWithComparison = (candidateAuthors, originalAuthors, isJapanese, source) => {
  // // console.log(`📝 著者フォーマット開始:`, {candidateAuthors, originalAuthors, isJapanese, source});
  
  if (!candidateAuthors || candidateAuthors.length === 0) return '';
  
  const validAuthors = candidateAuthors.filter(a => a && a.trim());
  if (validAuthors.length === 0) return '';
  
  // // console.log(`📝 有効な著者:`, validAuthors);
  
  let authorText;
  let cleanAuthors; // ここで宣言
  
  if (isJapanese) {
    // 日本語著者：中黒区切り
    cleanAuthors = validAuthors.map(author => 
      author.replace(/[,，・•&;]/g, '').trim()
    ).filter(author => author.length > 0);
    
    if (cleanAuthors.length <= 3) {
      authorText = cleanAuthors.join('・');
    } else {
      authorText = cleanAuthors[0] + '・他';
    }
  } else {
    // 英語著者：APAスタイル（姓, 名イニシャル）- 複合姓対応
    cleanAuthors = validAuthors.map(author => {
      // // console.log(`📝 著者処理開始: "${author}"`);
      
      // 🔧 表示用正規化処理を追加：「EINSTEIN A.」→「A. EINSTEIN」
      const normalizedAuthor = normalizeAuthorNameForDisplay(author, source);
      // console.log(`📝 著者正規化: "${author}" → "${normalizedAuthor}" (出典: ${source})`);
      
      // カンマ形式の場合はそのまま使用（"Le Guin, U. K."）
      if (normalizedAuthor.includes(',')) {
        // // console.log(`📝 カンマ形式のためそのまま使用: "${normalizedAuthor}"`);
        return normalizedAuthor.trim();
      }
      
      // スペース区切りの場合（"Ursula K. Le Guin"）
      const parts = normalizedAuthor.replace(/[,，]/g, '').trim().split(/\s+/);
      // // console.log(`📝 スペース分割: [${parts.join(', ')}]`);
      
      if (parts.length >= 2) {
        // 複合姓の検出（パターン修正）
        const compoundSurnamePattern = /^(Le|La|De|Del|Della|Van|Van der|Van den|Von|Von der|Mac|Mc|O'|St\.|San|Santa|Da|Das|Dos|Du|El|Al-|Ben-)$/i;
        
        // 複合姓を探す（より具体的な検出）
        let surnameStartIndex = parts.length - 1;
        
        // "Le Guin" のような形式を検出
        if (parts.length >= 2) {
          const secondToLast = parts[parts.length - 2];
          // // console.log(`📝 姓の前の単語チェック: "${secondToLast}"`);
          if (compoundSurnamePattern.test(secondToLast)) {
            surnameStartIndex = parts.length - 2;
            // // console.log(`📝 複合姓検出: "${secondToLast} ${parts[parts.length - 1]}" を姓として使用`);
          }
        }
        
        const lastName = parts.slice(surnameStartIndex).join(' ');
        const firstName = parts.slice(0, surnameStartIndex).join(' ');
        
        // // console.log(`📝 分割結果: 姓="${lastName}", 名="${firstName}"`);
        
        if (firstName) { 
          const initial = firstName.split(/\s+/).map(name => 
            name.charAt(0).toUpperCase() + '.'
          ).join(' ');
          const result = `${lastName}, ${initial}`;
          // // console.log(`📝 APA形式結果: "${result}"`);
          return result;
        } else {
          // // console.log(`📝 名前部分なし、姓のみ: "${lastName}"`);
          return lastName;
        }
      }
      
      // // console.log(`📝 処理不可、そのまま返却: "${author}"`);
      return author;
    });
    
    if (cleanAuthors.length === 1) {
      authorText = cleanAuthors[0];
    } else if (cleanAuthors.length === 2) {
      authorText = cleanAuthors.join(' & ');
    } else {
      // 3名以上の場合も全員表示（省略なし）
      authorText = cleanAuthors.slice(0, -1).join(', ') + ', & ' + cleanAuthors[cleanAuthors.length - 1];
    }
  }
  
  if (!originalAuthors || originalAuthors.length === 0) {
    return authorText;
  }
  
  // 著者単位での色分け処理
  // // console.log('🎨 著者色分け:', {
  //   originalAuthors,
  //   validAuthors,
  //   cleanAuthors
  // });
  
  // et al.パターンの検出
  const originalText = originalAuthors ? originalAuthors.join(' ').toLowerCase() : '';
  const hasEtAl = originalText.includes('et al') || originalText.includes('他');
  
  // 各著者に個別に色分けを適用
  const coloredAuthors = cleanAuthors.map((author, index) => {
    let isMatch = false;
    
    if (hasEtAl && index === 0) {
      // et al.パターンで第一著者の場合、第一著者との一致をチェック
      isMatch = originalAuthors && originalAuthors.length > 0 && 
                isAuthorMatch(originalAuthors[0], author);
    } else if (!hasEtAl) {
      // 通常パターンの場合、全著者との一致をチェック
      isMatch = originalAuthors && originalAuthors.some(origAuthor => {
        return isAuthorMatch(origAuthor, author);
      });
    } else {
      // et al.パターンで第一著者以外の場合、存在しない著者として扱う
      // ただし、これらは「et al.」で省略されているので、中性的な色にする
      isMatch = 'neutral';
    }
    
    // // console.log(`🎨 著者${index + 1} "${author}": ${isMatch === true ? '一致' : isMatch === 'neutral' ? '省略' : '不一致'} (et al.: ${hasEtAl})`);
    
    if (isMatch === true) {
      return `<span class="text-green-600 font-medium">${author}</span>`;
    } else if (isMatch === 'neutral') {
      return `<span class="text-gray-600">${author}</span>`; // et al.で省略された著者は灰色
    } else {
      return `<span class="text-red-600">${author}</span>`;
    }
  });
  
  // 色分けされた著者を適切な形式で結合
  if (isJapanese) {
    // 日本語：中黒区切り（省略なし）
    return coloredAuthors.join('・');
  } else {
    // 英語：APAスタイル
    if (coloredAuthors.length === 1) {
      return coloredAuthors[0];
    } else if (coloredAuthors.length === 2) {
      return coloredAuthors.join(' & ');
    } else {
      // 3名以上の場合も全員表示（省略なし）
      return coloredAuthors.slice(0, -1).join(', ') + ', & ' + coloredAuthors[coloredAuthors.length - 1];
    }
  }
};

// 年の比較とハイライト
const formatYearWithComparison = (candidateYear, originalYear) => {
  if (!candidateYear) return 'n.d.';
  
  if (!originalYear) return candidateYear;
  
  const yearDiff = Math.abs(parseInt(originalYear) - parseInt(candidateYear));
  
  if (yearDiff === 0) {
    // 完全一致：緑
    return `<span class="text-green-600 font-medium">${candidateYear}</span>`;
  } else if (yearDiff <= 2) {
    // 1-2年差：オレンジ（惜しい）
    return `<span class="text-yellow-600 font-medium">${candidateYear}</span>`;
  } else {
    // 3年以上差：赤
    return `<span class="text-red-600">${candidateYear}</span>`;
  }
};

// 巻号ページ番号の比較とハイライト
const formatVolumeIssuePagesWithComparison = (candidateData, originalData, isJapanese = false) => {
  let result = '';
  
  // 巻の処理
  if (candidateData.volume) {
    const volumeMatch = originalData?.volume && 
      candidateData.volume.toString() === originalData.volume.toString();
    const volumeText = volumeMatch ? 
      `<span class="text-green-600 font-medium">${candidateData.volume}</span>` :
      `<span class="text-red-600">${candidateData.volume}</span>`;
    result += isJapanese ? `, ${volumeText}` : `, ${volumeText}`;
    
    // 号の処理
    if (candidateData.issue) {
      const issueMatch = originalData?.issue && 
        candidateData.issue.toString() === originalData.issue.toString();
      const issueText = issueMatch ? 
        `<span class="text-green-600 font-medium">${candidateData.issue}</span>` :
        `<span class="text-red-600">${candidateData.issue}</span>`;
      result += `(${issueText})`;
    }
  }
  
  // ページの処理
  if (candidateData.pages) {
    const pagesMatch = originalData?.pages && comparePagesRange(candidateData.pages, originalData.pages);
    const pagesText = pagesMatch ? 
      `<span class="text-green-600 font-medium">${candidateData.pages}</span>` :
      `<span class="text-red-600">${candidateData.pages}</span>`;
    result += `, ${pagesText}`;
  }
  
  return result;
};

// ページ範囲の比較（簡易版）
const comparePagesRange = (pages1, pages2) => {
  if (!pages1 || !pages2) return false;
  
  // 完全一致チェック
  if (pages1 === pages2) return true;
  
  // 範囲の解析と重複チェック（簡略化）
  const parseRange = (pageStr) => {
    const match = pageStr.match(/(\d+)[-–—](\d+)/);
    if (match) {
      return { start: parseInt(match[1]), end: parseInt(match[2]) };
    }
    const singleMatch = pageStr.match(/(\d+)/);
    if (singleMatch) {
      const page = parseInt(singleMatch[1]);
      return { start: page, end: page };
    }
    return null;
  };
  
  const range1 = parseRange(pages1);
  const range2 = parseRange(pages2);
  
  if (!range1 || !range2) return false;
  
  return range1.start <= range2.end && range2.start <= range1.end;
};

// イタリック表示のヘルパー関数
const formatItalic = (text, isJapanese = false) => {
  if (!text) return '';
  // 日本語文献ではイタリックを使用しない
  if (isJapanese) {
    return text;
  }
  // 英語文献ではHTMLのemタグを使用
  return `<em>${text}</em>`;
};

// 候補文献用の引用フォーマット（部分一致表示付き）
export const formatCandidateCitation = (candidate, parsedInfo, style = 'apa') => {
  const isJapanese = parsedInfo?.language === 'japanese';
  
  // 基本情報を取得
  const candidateData = {
    title: getCombinedTitle(candidate), // サブタイトルを組み合わせた完全なタイトル
    // 著者処理を統一（改良版）
    authors: candidate.authors ? 
      (typeof candidate.authors === 'string' ? 
        parseAuthorString(candidate.authors) : 
        candidate.authors.map(a => typeof a === 'string' ? a : a.name).filter(a => a)
      ) : [],
    year: candidate.year || 'n.d.',
    journal: candidate.journal || '',
    volume: candidate.volume || '',
    issue: candidate.issue || '',
    pages: candidate.pages || '',
    publisher: candidate.publisher || '',
    doi: candidate.doi || '',
    isBookChapter: candidate.isBookChapter || false,
    bookTitle: candidate.bookTitle || '',
    editors: candidate.editors || [],
    source: candidate.source || 'Unknown'
  };
  
  // 書籍判定：掲載誌名がないか、明示的にisBookがtrueの場合
  const isBookCandidate = !candidateData.journal || candidate.isBook;
  
  // NDL掲載誌記事デバッグ
  if (candidate.source === 'NDL') {
    // // console.log(`🔍 NDL判定デバッグ:`, {
    //   title: candidateData.title?.substring(0, 30),
    //   journal: candidateData.journal,
    //   publisher: candidateData.publisher,
    //   isBook: candidate.isBook,
    //   isBookCandidate,
    //   willFormatAsJournal: candidateData.journal && !isBookCandidate
    // });
  }
  
  // スタイル別にフォーマット
  switch (style) {
    case 'apa':
      return formatCandidateAPACitation(candidateData, parsedInfo, isJapanese, isBookCandidate);
    case 'mla':
      return formatCandidateMLACitation(candidateData, parsedInfo, isJapanese, isBookCandidate);
    case 'chicago':
      return formatCandidateChicagoCitation(candidateData, parsedInfo, isJapanese, isBookCandidate);
    default:
      return formatCandidateAPACitation(candidateData, parsedInfo, isJapanese, isBookCandidate);
  }
};

// APA形式の候補文献フォーマット
const formatCandidateAPACitation = (candidateData, parsedInfo, isJapanese, isBookCandidate) => {
  let citation = '';
  
  // 著者
  const authorsText = formatAuthorsWithComparison(candidateData.authors, parsedInfo?.authors, isJapanese, candidateData.source);
  if (authorsText) {
    citation += authorsText;
  }
  
  // 年
  const yearText = formatYearWithComparison(candidateData.year, parsedInfo?.year);
  citation += citation ? ` (${yearText}).` : `(${yearText}).`;
  
  // タイトル（部分一致ハイライト）
  const inputTitleForHighlight = parsedInfo?.titleWithSubtitle || parsedInfo?.title;
  const cleanCandidateTitle = isJapanese ? 
    (candidateData.title?.replace(/\.$/, '') || '') : // 日本語の場合は末尾ピリオド除去
    (candidateData.title || ''); // 英語の場合はそのまま
  const highlightedTitle = highlightPartialMatch(inputTitleForHighlight, cleanCandidateTitle, isJapanese);
  
  if (candidateData.isBookChapter) {
    // 書籍の章（APA: Author (Year). Chapter title. In Editor (Ed.), Book title (pp. xx-xx). Publisher.）
    citation += ` ${highlightedTitle}.`;
    
    if (isJapanese) {
      // 日本語APA形式：編者名（編）書籍名（pp. xx-xx）出版社
      if (candidateData.editors && candidateData.editors.length > 0) {
        const editorText = candidateData.editors.slice(0, 3).join('・');
        citation += ` ${editorText}（編）`;
      }
      
      // 書籍名
      if (candidateData.bookTitle || candidateData.journal) {
        const bookTitleHighlighted = highlightPartialMatch(parsedInfo?.bookTitle || parsedInfo?.journal, candidateData.bookTitle || candidateData.journal, isJapanese);
        citation += `　${bookTitleHighlighted}`;
      }
      
      // ページ
      if (candidateData.pages) {
        const pagesMatch = parsedInfo?.pages && comparePagesRange(candidateData.pages, parsedInfo.pages);
        const pagesText = pagesMatch ? 
          `<span class="text-green-600 font-medium">${candidateData.pages}</span>` :
          `<span class="text-red-600">${candidateData.pages}</span>`;
        citation += `（pp.${pagesText}）`;
      }
      
      // 出版社
      if (candidateData.publisher) {
        const publisherHighlighted = highlightPublisherMatch(parsedInfo?.publisher, candidateData.publisher, isJapanese);
        citation += `　${publisherHighlighted}`;
      }
    } else {
      // 英語APA形式：In Editor (Ed.), Book title (pp. xx-xx). Publisher.
      citation += ` In`;
      
      // 編者情報
      if (candidateData.editors && candidateData.editors.length > 0) {
        const editorText = candidateData.editors.slice(0, 3).join(', ');
        citation += ` ${editorText}`;
        citation += candidateData.editors.length === 1 ? ' (Ed.),' : ' (Eds.),';
      }
      
      // 書籍名（イタリック）
      if (candidateData.bookTitle || candidateData.journal) {
        const bookTitleHighlighted = highlightPartialMatch(parsedInfo?.bookTitle || parsedInfo?.journal, candidateData.bookTitle || candidateData.journal, isJapanese);
        citation += ` <em>${bookTitleHighlighted}</em>`;
      }
      
      // ページ
      if (candidateData.pages) {
        const pagesMatch = parsedInfo?.pages && comparePagesRange(candidateData.pages, parsedInfo.pages);
        const pagesText = pagesMatch ? 
          `<span class="text-green-600 font-medium">${candidateData.pages}</span>` :
          `<span class="text-red-600">${candidateData.pages}</span>`;
        citation += ` (pp. ${pagesText})`;
      }
      
      citation += '.';
      
      // 出版社
      if (candidateData.publisher) {
        const publisherHighlighted = highlightPublisherMatch(parsedInfo?.publisher, candidateData.publisher, isJapanese);
        citation += ` ${publisherHighlighted}`;
      }
    }
  } else if (candidateData.journal && !isBookCandidate) {
    // 記事（APA 7th版ではタイトルにクォーテーション不要）
    citation += ` ${highlightedTitle}.`;
    
    const journalHighlighted = highlightPartialMatch(parsedInfo?.journal, candidateData.journal, isJapanese);
    const formattedJournal = isJapanese ? journalHighlighted : `<em>${journalHighlighted}</em>`;
    citation += isJapanese ? `　${formattedJournal}` : ` ${formattedJournal}`;
    
    // 巻号・ページ情報を追加（色分け対応）
    const volumeIssuePages = formatVolumeIssuePagesWithComparison(candidateData, parsedInfo, isJapanese);
    citation += volumeIssuePages;
  } else {
    // 書籍
    const bookTitle = isJapanese ? highlightedTitle : `<em>${highlightedTitle}</em>`;
    citation += ` ${bookTitle}`;
    
    // 書籍の場合は出版社情報を追加
    if (candidateData.publisher) {
      const publisherHighlighted = highlightPublisherMatch(parsedInfo?.publisher, candidateData.publisher, isJapanese);
      citation += isJapanese ? `　${publisherHighlighted}` : `. ${publisherHighlighted}`;
    } else {
      // 出版社情報が不明の場合は明示的に表示
      const unknownPublisher = isJapanese ? '[出版社不明]' : '[Publisher unknown]';
      citation += isJapanese ? `　<span class="text-gray-500 italic">${unknownPublisher}</span>` : `. <span class="text-gray-500 italic">${unknownPublisher}</span>`;
    }
  }
  
  // DOI
  if (candidateData.doi) {
    citation += `. https://doi.org/${candidateData.doi.replace(/^doi:/, '')}`;
  }
  
  return citation;
};

// MLA形式の候補文献フォーマット
const formatCandidateMLACitation = (candidateData, parsedInfo, isJapanese, isBookCandidate) => {
  let citation = '';
  
  // 著者（MLA形式）
  const authorsText = formatMLAAuthorsWithComparison(candidateData.authors, parsedInfo?.authors, isJapanese);
  if (authorsText) {
    citation += authorsText + '.';
  } else {
    citation += '[Author unknown].';
  }
  
  // タイトル（部分一致ハイライト）
  const inputTitleForHighlight = parsedInfo?.titleWithSubtitle || parsedInfo?.title;
  const cleanCandidateTitle = isJapanese ? 
    (candidateData.title?.replace(/\.$/, '') || '') : // 日本語の場合は末尾ピリオド除去
    (candidateData.title || ''); // 英語の場合はそのまま
  const highlightedTitle = highlightPartialMatch(inputTitleForHighlight, cleanCandidateTitle, isJapanese);
  
  if (candidateData.isBookChapter) {
    // 書籍の章（MLA: Author. "Chapter Title." In Book Title, edited by Editor, Publisher, Year, pp. xx-xx.）
    citation += ` ${highlightedTitle}.`;
    
    citation += ` In`;
    
    // 書籍名（イタリック）
    if (candidateData.bookTitle || candidateData.journal) {
      const bookTitleHighlighted = highlightPartialMatch(parsedInfo?.bookTitle || parsedInfo?.journal, candidateData.bookTitle || candidateData.journal, isJapanese);
      const formattedBookTitle = isJapanese ? bookTitleHighlighted : `<em>${bookTitleHighlighted}</em>`;
      citation += ` ${formattedBookTitle},`;
    }
    
    // 編者情報
    if (candidateData.editors && candidateData.editors.length > 0) {
      const editorText = candidateData.editors.slice(0, 3).join(', ');
      citation += ` edited by ${editorText},`;
    }
    
    // 出版社
    if (candidateData.publisher) {
      const publisherHighlighted = highlightPublisherMatch(parsedInfo?.publisher, candidateData.publisher, isJapanese);
      citation += ` ${publisherHighlighted},`;
    }
    
    const yearText = formatYearWithComparison(candidateData.year, parsedInfo?.year);
    citation += ` ${yearText}`;
    
    // ページ
    if (candidateData.pages) {
      const pagesMatch = parsedInfo?.pages && comparePagesRange(candidateData.pages, parsedInfo.pages);
      const pagesText = pagesMatch ? 
        `<span class="text-green-600 font-medium">${candidateData.pages}</span>` :
        `<span class="text-red-600">${candidateData.pages}</span>`;
      citation += `, pp. ${pagesText}`;
    }
    citation += '.';
  } else if (isBookCandidate) {
    // 書籍
    const bookTitle = isJapanese ? highlightedTitle : `<em>${highlightedTitle}</em>`;
    citation += ` ${bookTitle}.`;
    
    if (candidateData.publisher) {
      const publisherHighlighted = highlightPublisherMatch(parsedInfo?.publisher, candidateData.publisher, isJapanese);
      citation += ` ${publisherHighlighted},`;
    }
    
    const yearText = formatYearWithComparison(candidateData.year, parsedInfo?.year);
    citation += ` ${yearText}.`;
  } else {
    // 記事
    citation += ` ${highlightedTitle}.`;
    
    if (candidateData.journal) {
      const journalHighlighted = highlightPartialMatch(parsedInfo?.journal, candidateData.journal, isJapanese);
      const formattedJournal = isJapanese ? journalHighlighted : `<em>${journalHighlighted}</em>`;
      citation += ` ${formattedJournal}`;
      
      if (candidateData.volume) {
        const volumeText = parsedInfo?.volume && candidateData.volume.toString() === parsedInfo.volume.toString() ?
          `<span class="text-green-600 font-medium">${candidateData.volume}</span>` :
          `<span class="text-red-600">${candidateData.volume}</span>`;
        citation += `, vol. ${volumeText}`;
        
        if (candidateData.issue) {
          const issueText = parsedInfo?.issue && candidateData.issue.toString() === parsedInfo.issue.toString() ?
            `<span class="text-green-600 font-medium">${candidateData.issue}</span>` :
            `<span class="text-red-600">${candidateData.issue}</span>`;
          citation += `, no. ${issueText}`;
        }
      }
      
      const yearText = formatYearWithComparison(candidateData.year, parsedInfo?.year);
      citation += `, ${yearText}`;
      
      if (candidateData.pages) {
        const pagesMatch = parsedInfo?.pages && comparePagesRange(candidateData.pages, parsedInfo.pages);
        const pagesText = pagesMatch ? 
          `<span class="text-green-600 font-medium">${candidateData.pages}</span>` :
          `<span class="text-red-600">${candidateData.pages}</span>`;
        citation += `, pp. ${pagesText}`;
      }
      citation += '.';
    }
  }
  
  // DOI
  if (candidateData.doi) {
    citation += ` doi:${candidateData.doi.replace(/^doi:/, '')}.`;
  }
  
  return citation;
};

// Chicago形式の候補文献フォーマット
const formatCandidateChicagoCitation = (candidateData, parsedInfo, isJapanese, isBookCandidate) => {
  let citation = '';
  
  // 著者（Chicago形式）
  const authorsText = formatChicagoAuthorsWithComparison(candidateData.authors, parsedInfo?.authors, isJapanese);
  if (authorsText) {
    citation += authorsText + '.';
  } else {
    citation += '[Author unknown].';
  }
  
  // タイトル（部分一致ハイライト）
  const inputTitleForHighlight = parsedInfo?.titleWithSubtitle || parsedInfo?.title;
  const cleanCandidateTitle = isJapanese ? 
    (candidateData.title?.replace(/\.$/, '') || '') : // 日本語の場合は末尾ピリオド除去
    (candidateData.title || ''); // 英語の場合はそのまま
  const highlightedTitle = highlightPartialMatch(inputTitleForHighlight, cleanCandidateTitle, isJapanese);
  
  if (candidateData.isBookChapter) {
    // 書籍の章（Chicago: Author. "Chapter Title." In Book Title, edited by Editor, pages. Publisher, Year.）
    citation += ` ${highlightedTitle}.`;
    
    citation += ` In`;
    
    // 書籍名（イタリック）
    if (candidateData.bookTitle || candidateData.journal) {
      const bookTitleHighlighted = highlightPartialMatch(parsedInfo?.bookTitle || parsedInfo?.journal, candidateData.bookTitle || candidateData.journal, isJapanese);
      const formattedBookTitle = isJapanese ? bookTitleHighlighted : `<em>${bookTitleHighlighted}</em>`;
      citation += ` ${formattedBookTitle},`;
    }
    
    // 編者情報
    if (candidateData.editors && candidateData.editors.length > 0) {
      const editorText = candidateData.editors.slice(0, 3).join(', ');
      citation += ` edited by ${editorText},`;
    }
    
    // ページ
    if (candidateData.pages) {
      const pagesMatch = parsedInfo?.pages && comparePagesRange(candidateData.pages, parsedInfo.pages);
      const pagesText = pagesMatch ? 
        `<span class="text-green-600 font-medium">${candidateData.pages}</span>` :
        `<span class="text-red-600">${candidateData.pages}</span>`;
      citation += ` ${pagesText}.`;
    } else {
      citation += '.';
    }
    
    // 出版社
    if (candidateData.publisher) {
      const publisherHighlighted = highlightPublisherMatch(parsedInfo?.publisher, candidateData.publisher, isJapanese);
      citation += ` ${publisherHighlighted},`;
    }
    
    const yearText = formatYearWithComparison(candidateData.year, parsedInfo?.year);
    citation += ` ${yearText}.`;
  } else if (isBookCandidate) {
    // 書籍
    const bookTitle = isJapanese ? highlightedTitle : `<em>${highlightedTitle}</em>`;
    citation += ` ${bookTitle}.`;
    
    if (candidateData.publisher) {
      const publisherHighlighted = highlightPublisherMatch(parsedInfo?.publisher, candidateData.publisher, isJapanese);
      citation += ` ${publisherHighlighted},`;
    }
    
    const yearText = formatYearWithComparison(candidateData.year, parsedInfo?.year);
    citation += ` ${yearText}.`;
  } else {
    // 記事
    citation += ` ${highlightedTitle}.`;
    
    if (candidateData.journal) {
      const journalHighlighted = highlightPartialMatch(parsedInfo?.journal, candidateData.journal, isJapanese);
      const formattedJournal = isJapanese ? journalHighlighted : `<em>${journalHighlighted}</em>`;
      citation += ` ${formattedJournal}`;
      
      if (candidateData.volume) {
        const volumeText = parsedInfo?.volume && candidateData.volume.toString() === parsedInfo.volume.toString() ?
          `<span class="text-green-600 font-medium">${candidateData.volume}</span>` :
          `<span class="text-red-600">${candidateData.volume}</span>`;
        citation += ` ${volumeText}`;
        
        if (candidateData.issue) {
          const issueText = parsedInfo?.issue && candidateData.issue.toString() === parsedInfo.issue.toString() ?
            `<span class="text-green-600 font-medium">${candidateData.issue}</span>` :
            `<span class="text-red-600">${candidateData.issue}</span>`;
          citation += `, no. ${issueText}`;
        }
      }
      
      const yearText = formatYearWithComparison(candidateData.year, parsedInfo?.year);
      citation += ` (${yearText})`;
      
      if (candidateData.pages) {
        const pagesMatch = parsedInfo?.pages && comparePagesRange(candidateData.pages, parsedInfo.pages);
        const pagesText = pagesMatch ? 
          `<span class="text-green-600 font-medium">${candidateData.pages}</span>` :
          `<span class="text-red-600">${candidateData.pages}</span>`;
        citation += `: ${pagesText}`;
      }
      citation += '.';
    }
  }
  
  // DOI
  if (candidateData.doi) {
    citation += ` https://doi.org/${candidateData.doi.replace(/^doi:/, '')}.`;
  }
  
  return citation;
};

// MLA形式の著者フォーマット（候補文献用）
const formatMLAAuthorsWithComparison = (candidateAuthors, originalAuthors, isJapanese) => {
  if (!candidateAuthors || candidateAuthors.length === 0) return '';
  
  const validAuthors = candidateAuthors.filter(a => a && a.trim());
  if (validAuthors.length === 0) return '';
  
  let authorText;
  let cleanAuthors;
  
  if (isJapanese) {
    // 日本語著者：中黒区切り
    cleanAuthors = validAuthors.map(author => 
      author.replace(/[,，・•&;]/g, '').trim()
    ).filter(author => author.length > 0);
    authorText = cleanAuthors.join('・');
  } else {
    // 英語著者：MLA形式
    if (validAuthors.length === 1) {
      const parts = validAuthors[0].split(/\s+/);
      if (parts.length >= 2) {
        authorText = parts[parts.length - 1] + ', ' + parts.slice(0, -1).join(' ');
      } else {
        authorText = validAuthors[0];
      }
    } else if (validAuthors.length === 2) {
      const parts1 = validAuthors[0].split(/\s+/);
      const lastName1 = parts1.length >= 2 ? parts1[parts1.length - 1] + ', ' + parts1.slice(0, -1).join(' ') : validAuthors[0];
      authorText = lastName1 + ', and ' + validAuthors[1];
    } else {
      // 3名以上の場合も全員表示
      const parts = validAuthors[0].split(/\s+/);
      const lastName = parts.length >= 2 ? parts[parts.length - 1] + ', ' + parts.slice(0, -1).join(' ') : validAuthors[0];
      const remaining = validAuthors.slice(1).join(', ');
      authorText = lastName + ', ' + remaining;
    }
    cleanAuthors = [authorText]; // MLA形式では全体を一つの文字列として扱う
  }
  
  if (!originalAuthors || originalAuthors.length === 0) {
    return authorText;
  }
  
  // 著者単位での色分け処理（MLA形式向け）
  if (isJapanese) {
    // 日本語の場合は個別著者で色分け
    const coloredAuthors = cleanAuthors.map((author) => {
      const isMatch = originalAuthors && originalAuthors.some(origAuthor => {
        return isAuthorMatch(origAuthor, author);
      });
      
      if (isMatch) {
        return `<span class="text-green-600 font-medium">${author}</span>`;
      } else {
        return `<span class="text-red-600">${author}</span>`;
      }
    });
    return coloredAuthors.join('・');
  } else {
    // 英語の場合は全体として色分け
    const hasAnyMatch = originalAuthors && validAuthors.some(candidateAuthor => {
      return originalAuthors.some(origAuthor => isAuthorMatch(origAuthor, candidateAuthor));
    });
    
    if (hasAnyMatch) {
      return `<span class="text-green-600 font-medium">${authorText}</span>`;
    } else {
      return `<span class="text-red-600">${authorText}</span>`;
    }
  }
};

// Chicago形式の著者フォーマット（候補文献用）
const formatChicagoAuthorsWithComparison = (candidateAuthors, originalAuthors, isJapanese) => {
  if (!candidateAuthors || candidateAuthors.length === 0) return '';
  
  const validAuthors = candidateAuthors.filter(a => a && a.trim());
  if (validAuthors.length === 0) return '';
  
  let authorText;
  let cleanAuthors;
  
  if (isJapanese) {
    // 日本語著者：中黒区切り
    cleanAuthors = validAuthors.map(author => 
      author.replace(/[,，・•&;]/g, '').trim()
    ).filter(author => author.length > 0);
    authorText = cleanAuthors.join('・');
  } else {
    // 英語著者：Chicago形式
    if (validAuthors.length === 1) {
      const parts = validAuthors[0].split(/\s+/);
      if (parts.length >= 2) {
        authorText = parts[parts.length - 1] + ', ' + parts.slice(0, -1).join(' ');
      } else {
        authorText = validAuthors[0];
      }
    } else if (validAuthors.length <= 3) {
      const formattedAuthors = validAuthors.map((author, index) => {
        if (index === 0) {
          const parts = author.split(/\s+/);
          if (parts.length >= 2) {
            return parts[parts.length - 1] + ', ' + parts.slice(0, -1).join(' ');
          }
        }
        return author;
      });
      authorText = formattedAuthors.slice(0, -1).join(', ') + ', and ' + formattedAuthors[formattedAuthors.length - 1];
    } else {
      // 4名以上の場合も全員表示
      const formattedAuthors = validAuthors.map((author, index) => {
        if (index === 0) {
          const parts = author.split(/\s+/);
          if (parts.length >= 2) {
            return parts[parts.length - 1] + ', ' + parts.slice(0, -1).join(' ');
          }
        }
        return author;
      });
      authorText = formattedAuthors.join(', ');
    }
    cleanAuthors = [authorText]; // Chicago形式では全体を一つの文字列として扱う
  }
  
  if (!originalAuthors || originalAuthors.length === 0) {
    return authorText;
  }
  
  // 著者単位での色分け処理（Chicago形式向け）
  if (isJapanese) {
    // 日本語の場合は個別著者で色分け
    const coloredAuthors = cleanAuthors.map((author) => {
      const isMatch = originalAuthors && originalAuthors.some(origAuthor => {
        return isAuthorMatch(origAuthor, author);
      });
      
      if (isMatch) {
        return `<span class="text-green-600 font-medium">${author}</span>`;
      } else {
        return `<span class="text-red-600">${author}</span>`;
      }
    });
    return coloredAuthors.join('・');
  } else {
    // 英語の場合は全体として色分け
    const hasAnyMatch = originalAuthors && validAuthors.some(candidateAuthor => {
      return originalAuthors.some(origAuthor => isAuthorMatch(origAuthor, candidateAuthor));
    });
    
    if (hasAnyMatch) {
      return `<span class="text-green-600 font-medium">${authorText}</span>`;
    } else {
      return `<span class="text-red-600">${authorText}</span>`;
    }
  }
};

// 引用スタイル生成（検索結果のみ使用版）
export const generateCitation = (parsedInfo, mostSimilarResult, style = 'apa') => {
  // **検索結果のみを使用**（混在を完全に回避）
  const title = mostSimilarResult?.title || '[Title unknown]';
  const authors = mostSimilarResult?.authors ? 
    (typeof mostSimilarResult.authors === 'string' ? 
      parseAuthorString(mostSimilarResult.authors) : 
      mostSimilarResult.authors.map(a => typeof a === 'string' ? a : a.name).filter(a => a)
    ) : [];
  const year = mostSimilarResult?.year || 'n.d.';
  const journal = mostSimilarResult?.journal || '';
  
  // 検索結果のみを使用
  const volume = mostSimilarResult?.volume || '';
  const issue = mostSimilarResult?.issue || '';
  const pages = mostSimilarResult?.pages || '';
  const publisher = mostSimilarResult?.publisher || '';
  const isBook = mostSimilarResult?.isBook ?? (parsedInfo?.isBook || false);
  const isBookChapter = parsedInfo?.isBookChapter || mostSimilarResult?.isBookChapter || false;
  const bookTitle = mostSimilarResult?.bookTitle || parsedInfo?.bookTitle || '';
  const editors = mostSimilarResult?.editors || parsedInfo?.editors || [];
  const doi = mostSimilarResult?.doi || '';
  const isJapanese = parsedInfo?.language === 'japanese';
  
  // // console.log('🔍 推定された引用のデータ確認:');
  // // console.log('  mostSimilarResult:', mostSimilarResult);
  // // console.log('  volume:', mostSimilarResult?.volume, '→', volume);
  // // console.log('  issue:', mostSimilarResult?.issue, '→', issue);
  // // console.log('  pages:', mostSimilarResult?.pages, '→', pages);
  
  // // console.log('引用生成用データ:', {
  //   title: title.substring(0, 50) + '...',
  //   authors: authors.slice(0, 2),
  //   year,
  //   journal,
  //   volume,
  //   issue,
  //   pages,
  //   isJapanese,
  //   source: mostSimilarResult?.source || 'input'
  // });
  
  // 推定された引用は最も類似した候補と同じフォーマット関数を使用（比較機能付き）
  return formatCandidateCitation(mostSimilarResult, parsedInfo, style);
};

// 日本語APA形式（日本心理学会準拠）
const generateJapaneseAPACitation = (authors, year, title, journal, volume, issue, pages, publisher, isBook, isBookChapter, bookTitle, editors, doi) => {
  let citation = '';
  
  // 著者名（日本語スタイル：中黒区切り）
  if (authors && authors.length > 0) {
    const cleanAuthors = authors.map(author => 
      author.replace(/[,，・•&;]/g, '').trim()
    ).filter(author => author.length > 0);
    
    // 著者名は省略せずに全て表示
    citation += cleanAuthors.join('・'); // 中黒で区切り
  } else {
    citation += '[著者不明]';
  }
  
  // 年（日本語スタイル）
  citation += ` (${year})`;
  
  if (isBookChapter) {
    // 書籍の章の場合（日本語APA）
    const cleanTitle = title.replace(/\.$/, ''); // 末尾のピリオドを除去
    citation += ` ${cleanTitle}`;
    
    // 編者情報
    if (editors && editors.length > 0) {
      const editorText = editors.slice(0, 3).join('・');
      citation += ` ${editorText}（編）`;
    }
    
    // 書籍名
    if (bookTitle || journal) {
      citation += `${bookTitle || journal}`;
    }
    
    // ページ
    if (pages) {
      citation += `（pp.${pages}）`;
    }
    
    // 出版社
    if (publisher) {
      citation += ` ${publisher}`;
    }
  } else if (isBook) {
    // 書籍の場合
    const cleanTitle = title.replace(/\.$/, ''); // 末尾のピリオドを除去
    citation += ` ${cleanTitle}`;
    
    if (publisher) {
      citation += `　${publisher}`;
    }
  } else {
    // 記事の場合
    const cleanTitle = title.replace(/\.$/, ''); // 末尾のピリオドを除去
    citation += ` ${cleanTitle}`;
    
    if (journal) {
      citation += `　${journal}`;
      
      // 巻号（日本語スタイル）
      if (volume) {
        citation += `, ${volume}`;
        if (issue) {
          citation += `(${issue})`;
        }
      }
      
      // ページ（日本語スタイル）
      if (pages) {
        citation += `, ${pages}`;
      }
    }
  }
  
  // DOI（日本語でも英語形式）
  if (doi) {
    citation += ` https://doi.org/${doi.replace(/^doi:/, '')}`;
  }
  
  return citation;
};

// 英語APA形式（APA 7th edition準拠）
const generateEnglishAPACitation = (authors, year, title, journal, volume, issue, pages, publisher, isBook, isBookChapter, bookTitle, editors, doi) => {
  let citation = '';
  
  // 著者名（APA形式：姓, 名イニシャル）
  if (authors && authors.length > 0) {
    const cleanAuthors = authors.map(author => {
      const parts = author.replace(/[,，]/g, '').trim().split(/\s+/);
      if (parts.length >= 2) {
        const last = parts[parts.length - 1];
        const first = parts.slice(0, -1).join(' ');
        const initial = first.split(/\s+/).map(name => 
          name.charAt(0).toUpperCase() + '.'
        ).join(' ');
        return `${last}, ${initial}`;
      }
      return author;
    });
    
    let authorText;
    if (cleanAuthors.length === 1) {
      authorText = cleanAuthors[0];
    } else if (cleanAuthors.length === 2) {
      authorText = cleanAuthors.join(' & ');
    } else {
      // 3名以上の場合も全員表示（省略なし）
      authorText = cleanAuthors.slice(0, -1).join(', ') + ', & ' + cleanAuthors[cleanAuthors.length - 1];
    }
    citation += authorText;
  } else {
    citation += '[Author unknown]';
  }
  
  // 年
  citation += ` (${year}).`;
  
  if (isBookChapter) {
    // 書籍の章の場合（英語APA: Author (Year). Chapter title. In Editor (Ed.), Book title (pp. xx-xx). Publisher.）
    citation += ` ${title}. In`;
    
    // 編者情報
    if (editors && editors.length > 0) {
      const formattedEditors = editors.slice(0, 3).map(editor => {
        // 編者名をAPA形式に変換（Last, F. M.）
        return editor;
      }).join(', ');
      
      citation += ` ${formattedEditors}`;
      citation += editors.length === 1 ? ' (Ed.),' : ' (Eds.),';
    }
    
    // 書籍名（イタリック）
    if (bookTitle || journal) {
      citation += ` ${formatItalic(bookTitle || journal)}`;
    }
    
    // ページ
    if (pages) {
      citation += ` (pp. ${pages})`;
    }
    
    citation += '.';
    
    // 出版社
    if (publisher) {
      citation += ` ${publisher}.`;
    }
  } else if (isBook) {
    // 書籍の場合
    citation += ` ${formatItalic(title)}.`;
    if (publisher) {
      citation += ` ${publisher}.`;
    }
  } else {
    // 記事の場合
    const cleanTitle = title.replace(/\.$/, ''); // 末尾のピリオドを除去
    citation += ` ${cleanTitle}.`;
    
    if (journal) {
      citation += ` ${formatItalic(journal)}`;
      
      // 巻号（英語スタイル）
      if (volume) {
        citation += `, ${formatItalic(volume)}`;
        if (issue) {
          citation += `(${issue})`;
        }
      }
      
      // ページ
      if (pages) {
        citation += `, ${pages}`;
      }
      citation += '.';
    }
  }
  
  // DOI
  if (doi) {
    citation += ` https://doi.org/${doi.replace(/^doi:/, '')}`;
  }
  
  return citation;
};

// MLA形式（MLA 9th edition準拠）
const generateMLACitation = (authors, year, title, journal, volume, issue, pages, publisher, isBook, isBookChapter, bookTitle, editors, doi, isJapanese) => {
  let citation = '';
  
  // 著者名（MLA形式）
  if (authors && authors.length > 0) {
    if (isJapanese) {
      const cleanAuthors = authors.map(author => 
        author.replace(/[,，・•&;]/g, '').trim()
      ).filter(author => author.length > 0);
      citation += cleanAuthors.join('・');
    } else {
      if (authors.length === 1) {
        const parts = authors[0].split(/\s+/);
        if (parts.length >= 2) {
          citation += parts[parts.length - 1] + ', ' + parts.slice(0, -1).join(' ');
        } else {
          citation += authors[0];
        }
      } else if (authors.length === 2) {
        const parts1 = authors[0].split(/\s+/);
        const lastName1 = parts1.length >= 2 ? parts1[parts1.length - 1] + ', ' + parts1.slice(0, -1).join(' ') : authors[0];
        citation += lastName1 + ', and ' + authors[1];
      } else {
        // 3名以上の場合も全員表示
        const parts1 = authors[0].split(/\s+/);
        const lastName1 = parts1.length >= 2 ? parts1[parts1.length - 1] + ', ' + parts1.slice(0, -1).join(' ') : authors[0];
        const remaining = authors.slice(1).join(', ');
        citation += lastName1 + ', ' + remaining;
      }
    }
    citation += '.';
  } else {
    citation += '[Author unknown].';
  }
  
  if (isBookChapter) {
    // 書籍の章の場合（MLA: Author. "Chapter Title." In Book Title, edited by Editor, Publisher, Year, pp. xx-xx.）
    const cleanTitle = title.replace(/\.$/, ''); // 末尾のピリオドを除去
    citation += isJapanese ? ` ${cleanTitle}` : ` ${cleanTitle}.`;
    
    citation += ` In`;
    
    // 書籍名（イタリック）
    if (bookTitle || journal) {
      citation += ` ${formatItalic(bookTitle || journal, isJapanese)},`;
    }
    
    // 編者情報
    if (editors && editors.length > 0) {
      const editorText = editors.slice(0, 3).join(', ');
      citation += ` edited by ${editorText},`;
    }
    
    // 出版社
    if (publisher) {
      citation += ` ${publisher},`;
    }
    
    citation += ` ${year}`;
    
    // ページ
    if (pages) {
      citation += `, pp. ${pages}`;
    }
    citation += '.';
  } else if (isBook) {
    // 書籍の場合
    const cleanTitle = title.replace(/\.$/, ''); // 末尾のピリオドを除去
    citation += isJapanese ? ` ${formatItalic(cleanTitle, isJapanese)}` : ` ${formatItalic(cleanTitle, isJapanese)}.`;
    if (publisher) {
      citation += ` ${publisher}`;
      citation += isJapanese ? '' : ',';
    }
    citation += isJapanese ? '' : ` ${year}.`;
  } else {
    // 記事の場合
    const cleanTitle = title.replace(/\.$/, ''); // 末尾のピリオドを除去
    citation += isJapanese ? ` ${cleanTitle}` : ` ${cleanTitle}.`;
    
    if (journal) {
      citation += ` ${formatItalic(journal, isJapanese)}`;
      
      if (volume) {
        citation += `, vol. ${volume}`;
        if (issue) {
          citation += `, no. ${issue}`;
        }
      }
      
      citation += `, ${year}`;
      
      if (pages) {
        citation += `, pp. ${pages}`;
      }
      citation += '.';
    }
  }
  
  // DOI
  if (doi) {
    citation += ` doi:${doi.replace(/^doi:/, '')}.`;
  }
  
  return citation;
};

// Chicago形式（Chicago 17th edition準拠）
const generateChicagoCitation = (authors, year, title, journal, volume, issue, pages, publisher, isBook, isBookChapter, bookTitle, editors, doi, isJapanese) => {
  let citation = '';
  
  // 著者名（Chicago形式）
  if (authors && authors.length > 0) {
    if (isJapanese) {
      const cleanAuthors = authors.map(author => 
        author.replace(/[,，・•&;]/g, '').trim()
      ).filter(author => author.length > 0);
      citation += cleanAuthors.join('・');
    } else {
      if (authors.length === 1) {
        const parts = authors[0].split(/\s+/);
        if (parts.length >= 2) {
          citation += parts[parts.length - 1] + ', ' + parts.slice(0, -1).join(' ');
        } else {
          citation += authors[0];
        }
      } else if (authors.length <= 3) {
        const formattedAuthors = authors.map((author, index) => {
          if (index === 0) {
            const parts = author.split(/\s+/);
            if (parts.length >= 2) {
              return parts[parts.length - 1] + ', ' + parts.slice(0, -1).join(' ');
            }
          }
          return author;
        });
        citation += formattedAuthors.slice(0, -1).join(', ') + ', and ' + formattedAuthors[formattedAuthors.length - 1];
      } else {
        const parts = authors[0].split(/\s+/);
        const lastName = parts.length >= 2 ? parts[parts.length - 1] + ', ' + parts.slice(0, -1).join(' ') : authors[0];
        citation += lastName + ' et al.';
      }
    }
    citation += '.';
  } else {
    citation += '[Author unknown].';
  }
  
  if (isBookChapter) {
    // 書籍の章の場合（Chicago: Author. "Chapter Title." In Book Title, edited by Editor, pages. Publisher, Year.）
    const cleanTitle = title.replace(/\.$/, ''); // 末尾のピリオドを除去
    citation += isJapanese ? ` ${cleanTitle}` : ` ${cleanTitle}.`;
    
    citation += ` In`;
    
    // 書籍名（イタリック）
    if (bookTitle || journal) {
      citation += ` ${formatItalic(bookTitle || journal, isJapanese)},`;
    }
    
    // 編者情報
    if (editors && editors.length > 0) {
      const editorText = editors.slice(0, 3).join(', ');
      citation += ` edited by ${editorText},`;
    }
    
    // ページ
    if (pages) {
      citation += ` ${pages}.`;
    } else {
      citation += '.';
    }
    
    // 出版社
    if (publisher) {
      citation += ` ${publisher},`;
    }
    
    citation += ` ${year}.`;
  } else if (isBook) {
    // 書籍の場合
    const cleanTitle = title.replace(/\.$/, ''); // 末尾のピリオドを除去
    citation += isJapanese ? ` ${formatItalic(cleanTitle, isJapanese)}` : ` ${formatItalic(cleanTitle, isJapanese)}.`;
    if (publisher) {
      citation += ` ${publisher}`;
      citation += isJapanese ? '' : ',';
    }
    citation += isJapanese ? '' : ` ${year}.`;
  } else {
    // 記事の場合
    const cleanTitle = title.replace(/\.$/, ''); // 末尾のピリオドを除去
    citation += isJapanese ? ` ${cleanTitle}` : ` ${cleanTitle}.`;
    
    if (journal) {
      citation += ` ${formatItalic(journal, isJapanese)}`;
      
      if (volume) {
        citation += ` ${volume}`;
        if (issue) {
          citation += `, no. ${issue}`;
        }
      }
      
      citation += ` (${year})`;
      
      if (pages) {
        citation += `: ${pages}`;
      }
      citation += '.';
    }
  }
  
  // DOI
  if (doi) {
    citation += ` https://doi.org/${doi.replace(/^doi:/, '')}.`;
  }
  
  return citation;
};

// 候補文献のタイトルとサブタイトルを組み合わせる関数
const getCombinedTitle = (candidate) => {
  if (!candidate.title) return '';
  
  // サブタイトルがある場合は組み合わせる
  if (candidate.subtitle && candidate.subtitle.trim()) {
    return `${candidate.title}: ${candidate.subtitle}`;
  }
  
  return candidate.title;
};

// 色分け引用形式生成（一致部分を緑、不一致部分を赤で表示）
export const generateColoredCitation = (parsedInfo, mostSimilarResult, style = 'apa') => {
  // **検索結果のみを使用**（混在を完全に回避）
  const title = getCombinedTitle(mostSimilarResult); // サブタイトルを組み合わせた完全なタイトル
  const authors = mostSimilarResult?.authors ? 
    (typeof mostSimilarResult.authors === 'string' ? 
      parseAuthorString(mostSimilarResult.authors) : 
      mostSimilarResult.authors.map(a => typeof a === 'string' ? a : a.name).filter(a => a)
    ) : [];
  const year = mostSimilarResult?.year || 'n.d.';
  const journal = mostSimilarResult?.journal || '';
  
  // 検索結果のみを使用（通常の引用と統一）
  const volume = mostSimilarResult?.volume || '';
  const issue = mostSimilarResult?.issue || '';
  const pages = mostSimilarResult?.pages || '';
  const publisher = mostSimilarResult?.publisher || '';
  const doi = mostSimilarResult?.doi || '';
  const isJapanese = parsedInfo?.language === 'japanese';
  
  // 詳細なフォーマッティングを使用
  const candidateData = {
    title: title,
    authors: authors,
    year: year,
    journal: journal,
    volume: volume,
    issue: issue,
    pages: pages,
    publisher: publisher,
    doi: doi,
    source: mostSimilarResult?.source || 'Unknown'
  };
  
  // 書籍判定
  const isBookCandidate = !candidateData.journal || mostSimilarResult?.isBook;
  
  // スタイル別にフォーマット（色分け版）
  switch (style) {
    case 'apa':
      return generateColoredAPACitation(candidateData, parsedInfo, isJapanese, isBookCandidate);
    case 'mla':
      return generateColoredMLACitation(candidateData, parsedInfo, isJapanese, isBookCandidate);
    case 'chicago':
      return generateColoredChicagoCitation(candidateData, parsedInfo, isJapanese, isBookCandidate);
    default:
      return generateColoredAPACitation(candidateData, parsedInfo, isJapanese, isBookCandidate);
  }
};

// APA形式の色分け引用生成
const generateColoredAPACitation = (candidateData, parsedInfo, isJapanese, isBookCandidate) => {
  let citation = '';
  
  // 著者（詳細色分け）
  const authorsText = formatAuthorsWithComparison(candidateData.authors, parsedInfo?.authors, isJapanese, candidateData.source);
  if (authorsText) {
    citation += authorsText;
  }
  
  // 年（詳細比較）
  const yearText = formatYearWithComparison(candidateData.year, parsedInfo?.year);
  citation += citation ? ` (${yearText}).` : `(${yearText}).`;
  
  // タイトル（部分一致ハイライト）- サブタイトル付きタイトルを優先使用
  const inputTitleForHighlight = parsedInfo?.titleWithSubtitle || parsedInfo?.title;
  const highlightedTitle = highlightPartialMatch(inputTitleForHighlight, candidateData.title, isJapanese);
  
  if (candidateData.journal && !isBookCandidate) {
    // 記事
    citation += ` ${highlightedTitle}.`;
    
    const journalHighlighted = highlightPartialMatch(parsedInfo?.journal, candidateData.journal, isJapanese);
    const formattedJournal = isJapanese ? journalHighlighted : `<em>${journalHighlighted}</em>`;
    citation += isJapanese ? `　${formattedJournal}` : ` ${formattedJournal}`;
    
    // 巻号・ページ情報を追加（色分け対応）
    const volumeIssuePages = formatVolumeIssuePagesWithComparison(candidateData, parsedInfo, isJapanese);
    citation += volumeIssuePages;
    
    citation += '.';
  } else {
    // 書籍
    const bookTitle = isJapanese ? highlightedTitle : `<em>${highlightedTitle}</em>`;
    citation += ` ${bookTitle}`;
    
    // 書籍の場合は出版社情報を追加
    if (candidateData.publisher) {
      const publisherHighlighted = highlightPublisherMatch(parsedInfo?.publisher, candidateData.publisher, isJapanese);
      citation += isJapanese ? `　${publisherHighlighted}` : `. ${publisherHighlighted}`;
    } else {
      // 出版社情報が不明の場合は明示的に表示
      const unknownPublisher = isJapanese ? '[出版社不明]' : '[Publisher unknown]';
      citation += isJapanese ? `　<span class="text-gray-500 italic">${unknownPublisher}</span>` : `. <span class="text-gray-500 italic">${unknownPublisher}</span>`;
    }
    
    citation += '.';
  }
  
  // DOI
  if (candidateData.doi) {
    citation += ` https://doi.org/${candidateData.doi.replace(/^doi:/, '')}`;
  }
  
  return citation;
};

// MLA形式の色分け引用生成
const generateColoredMLACitation = (candidateData, parsedInfo, isJapanese, isBookCandidate) => {
  let citation = '';
  
  // 著者（MLA形式）
  const authorsText = formatMLAAuthorsWithComparison(candidateData.authors, parsedInfo?.authors, isJapanese);
  if (authorsText) {
    citation += authorsText + '.';
  } else {
    citation += '[Author unknown].';
  }
  
  // タイトル（部分一致ハイライト）- サブタイトル付きタイトルを優先使用
  const inputTitleForHighlight = parsedInfo?.titleWithSubtitle || parsedInfo?.title;
  const highlightedTitle = highlightPartialMatch(inputTitleForHighlight, candidateData.title, isJapanese);
  
  if (isBookCandidate) {
    // 書籍
    const bookTitle = isJapanese ? highlightedTitle : `<em>${highlightedTitle}</em>`;
    citation += ` ${bookTitle}.`;
    
    if (candidateData.publisher) {
      const publisherHighlighted = highlightPublisherMatch(parsedInfo?.publisher, candidateData.publisher, isJapanese);
      citation += ` ${publisherHighlighted},`;
    }
    
    const yearText = formatYearWithComparison(candidateData.year, parsedInfo?.year);
    citation += ` ${yearText}.`;
  } else {
    // 記事
    citation += ` ${highlightedTitle}.`;
    
    if (candidateData.journal) {
      const journalHighlighted = highlightPartialMatch(parsedInfo?.journal, candidateData.journal, isJapanese);
      const formattedJournal = isJapanese ? journalHighlighted : `<em>${journalHighlighted}</em>`;
      citation += ` ${formattedJournal}`;
      
      if (candidateData.volume) {
        const volumeText = parsedInfo?.volume && candidateData.volume.toString() === parsedInfo.volume.toString() ?
          `<span class="text-green-600 font-medium">${candidateData.volume}</span>` :
          `<span class="text-red-600">${candidateData.volume}</span>`;
        citation += `, vol. ${volumeText}`;
        
        if (candidateData.issue) {
          const issueText = parsedInfo?.issue && candidateData.issue.toString() === parsedInfo.issue.toString() ?
            `<span class="text-green-600 font-medium">${candidateData.issue}</span>` :
            `<span class="text-red-600">${candidateData.issue}</span>`;
          citation += `, no. ${issueText}`;
        }
      }
      
      const yearText = formatYearWithComparison(candidateData.year, parsedInfo?.year);
      citation += `, ${yearText}`;
      
      if (candidateData.pages) {
        const pagesMatch = parsedInfo?.pages && comparePagesRange(candidateData.pages, parsedInfo.pages);
        const pagesText = pagesMatch ? 
          `<span class="text-green-600 font-medium">${candidateData.pages}</span>` :
          `<span class="text-red-600">${candidateData.pages}</span>`;
        citation += `, pp. ${pagesText}`;
      }
      citation += '.';
    }
  }
  
  // DOI
  if (candidateData.doi) {
    citation += ` doi:${candidateData.doi.replace(/^doi:/, '')}.`;
  }
  
  return citation;
};

// Chicago形式の色分け引用生成
const generateColoredChicagoCitation = (candidateData, parsedInfo, isJapanese, isBookCandidate) => {
  let citation = '';
  
  // 著者（Chicago形式）
  const authorsText = formatChicagoAuthorsWithComparison(candidateData.authors, parsedInfo?.authors, isJapanese);
  if (authorsText) {
    citation += authorsText + '.';
  } else {
    citation += '[Author unknown].';
  }
  
  // タイトル（部分一致ハイライト）- サブタイトル付きタイトルを優先使用
  const inputTitleForHighlight = parsedInfo?.titleWithSubtitle || parsedInfo?.title;
  const highlightedTitle = highlightPartialMatch(inputTitleForHighlight, candidateData.title, isJapanese);
  
  if (isBookCandidate) {
    // 書籍
    const bookTitle = isJapanese ? highlightedTitle : `<em>${highlightedTitle}</em>`;
    citation += ` ${bookTitle}.`;
    
    if (candidateData.publisher) {
      const publisherHighlighted = highlightPublisherMatch(parsedInfo?.publisher, candidateData.publisher, isJapanese);
      citation += ` ${publisherHighlighted},`;
    }
    
    const yearText = formatYearWithComparison(candidateData.year, parsedInfo?.year);
    citation += ` ${yearText}.`;
  } else {
    // 記事
    citation += ` ${highlightedTitle}.`;
    
    if (candidateData.journal) {
      const journalHighlighted = highlightPartialMatch(parsedInfo?.journal, candidateData.journal, isJapanese);
      const formattedJournal = isJapanese ? journalHighlighted : `<em>${journalHighlighted}</em>`;
      citation += ` ${formattedJournal}`;
      
      if (candidateData.volume) {
        const volumeText = parsedInfo?.volume && candidateData.volume.toString() === parsedInfo.volume.toString() ?
          `<span class="text-green-600 font-medium">${candidateData.volume}</span>` :
          `<span class="text-red-600">${candidateData.volume}</span>`;
        citation += ` ${volumeText}`;
        
        if (candidateData.issue) {
          const issueText = parsedInfo?.issue && candidateData.issue.toString() === parsedInfo.issue.toString() ?
            `<span class="text-green-600 font-medium">${candidateData.issue}</span>` :
            `<span class="text-red-600">${candidateData.issue}</span>`;
          citation += `, no. ${issueText}`;
        }
      }
      
      const yearText = formatYearWithComparison(candidateData.year, parsedInfo?.year);
      citation += ` (${yearText})`;
      
      if (candidateData.pages) {
        const pagesMatch = parsedInfo?.pages && comparePagesRange(candidateData.pages, parsedInfo.pages);
        const pagesText = pagesMatch ? 
          `<span class="text-green-600 font-medium">${candidateData.pages}</span>` :
          `<span class="text-red-600">${candidateData.pages}</span>`;
        citation += `: ${pagesText}`;
      }
      citation += '.';
    }
  }
  
  // DOI
  if (candidateData.doi) {
    citation += ` https://doi.org/${candidateData.doi.replace(/^doi:/, '')}.`;
  }
  
  return citation;
};