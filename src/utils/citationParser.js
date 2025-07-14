/**
 * 文献解析ユーティリティ
 */

import { COMMON_ERRORS } from '../constants';

// よくある誤記の修正
export const fixCommonErrors = (text) => {
  let result = text;
  COMMON_ERRORS.forEach(({ pattern, replacement }) => {
    result = result.replace(pattern, replacement);
  });
  return result;
};

// 文献テキストの解析関数
export const parseLiterature = (text) => {
  const cleanText = text.replace(/^[\s]*[•·・*\-\d+.\])]\s*/g, '').trim();
  const correctedText = fixCommonErrors(cleanText);
  
  const info = {
    title: '',
    authors: [],
    year: '',
    doi: '',
    url: '',
    publisher: '',
    journal: '',
    volume: '',
    issue: '',
    pages: '',
    language: 'unknown',
    isBook: false
  };

  // 言語判定
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3005]/;
  info.language = japaneseRegex.test(correctedText) ? 'japanese' : 'english';

  // 年の抽出
  const yearMatch = correctedText.match(/\b(19|20)\d{2}\b/g);
  if (yearMatch) {
    info.year = yearMatch[0];
  }

  // DOIの抽出
  const doiMatch = correctedText.match(/doi:\s*([^\s,]+)|10\.\d+\/[^\s,]+/gi);
  if (doiMatch) {
    info.doi = doiMatch[1] || doiMatch[0];
  }

  // URLの抽出
  const urlMatch = correctedText.match(/https?:\/\/[^\s,]+/g);
  if (urlMatch) {
    info.url = urlMatch[0];
  }

  // タイトルの抽出
  if (info.language === 'japanese') {
    extractJapaneseTitle(correctedText, info);
  } else {
    extractEnglishTitle(correctedText, info);
  }

  // 著者の抽出
  if (info.language === 'japanese') {
    extractJapaneseAuthors(correctedText, info);
  } else {
    extractEnglishAuthors(correctedText, info);
  }

  // 雑誌名の抽出
  if (info.language === 'japanese') {
    extractJapaneseJournal(correctedText, info);
  } else {
    extractEnglishJournal(correctedText, info);
  }

  // 巻号・ページ番号の抽出
  if (info.language === 'japanese') {
    extractJapaneseVolumeIssuePages(correctedText, info);
  } else {
    extractEnglishVolumeIssuePages(correctedText, info);
  }

  // 書籍判定
  detectBook(correctedText, info);

  // タイトルが異常に長い場合（入力テキスト全体が設定されている可能性）のチェック
  if (info.title && info.title.length > 200) {
    console.warn('⚠️ タイトルが異常に長い:', info.title.length, '文字');
    console.warn('⚠️ 元のタイトル:', info.title.substring(0, 100) + '...');
    
    // より厳密なタイトル抽出を試行
    if (info.language === 'english') {
      // 英語の場合：年号後の最初のピリオドまでを抽出
      const yearMatch = correctedText.match(/\(\d{4}\)\s*\.?\s*([^.]+)\./);
      if (yearMatch && yearMatch[1].trim().length < 200) {
        info.title = yearMatch[1].trim();
        console.log('🔧 修正されたタイトル:', info.title);
      }
    }
  }

  return info;
};

// 日本語タイトル抽出
const extractJapaneseTitle = (correctedText, info) => {
  const quotedTitleRegex = /[『「][^』」]+[』」]/g;
  const quotedTitle = correctedText.match(quotedTitleRegex);
  if (quotedTitle) {
    info.title = quotedTitle[0].replace(/[『』「」]/g, '');
  } else {
    const afterPeriod = correctedText.split(/\)[.．]\s*/)[1];
    if (afterPeriod) {
      const segments = afterPeriod.split(/[.．,，]/);
      const titleCandidate = segments[0]?.trim();
      if (titleCandidate && titleCandidate.length >= 5) {
        info.title = titleCandidate;
      }
    }
    
    if (!info.title) {
      const segments = correctedText.split(/[,，。・、()]/g);
      const longestSegment = segments
        .map(s => s.trim())
        .filter(s => s.length >= 5)
        .filter(s => !/\d{4}|doi|http|pp\.|vol\.|no\.|巻|号/gi.test(s))
        .filter(s => !/(大学|研究所|学会|省庁|出版)/g.test(s))
        .sort((a, b) => b.length - a.length)[0];
      info.title = longestSegment || '';
    }
  }
};

// 英語タイトル抽出
const extractEnglishTitle = (correctedText, info) => {
  const quotedTitleRegex = /"[^"]+"/g;
  const quotedTitle = correctedText.match(quotedTitleRegex);
  if (quotedTitle) {
    info.title = quotedTitle[0].replace(/"/g, '');
  } else {
    const titleAfterYearMatch = correctedText.match(/\(\d{4}\)\.\s*([^.]+)\./);
    if (titleAfterYearMatch) {
      info.title = titleAfterYearMatch[1].trim();
    } else {
      const afterAuthors = correctedText.split(/\)\s*\./)[1];
      if (afterAuthors) {
        const segments = afterAuthors.split(/\./);
        const titleCandidate = segments[0]?.trim();
        if (titleCandidate && titleCandidate.split(/\s+/).length >= 3) {
          info.title = titleCandidate;
        }
      }
      
      if (!info.title) {
        const segments = correctedText.split(/[,.()]/g);
        const longestSegment = segments
          .map(s => s.trim())
          .filter(s => s.split(/\s+/g).length >= 3)
          .filter(s => !/\d{4}|doi|http|pp\.|vol\.|no\./gi.test(s))
          .filter(s => !/(University|Press|Journal|Publishing)/gi.test(s))
          .sort((a, b) => b.split(/\s+/g).length - a.split(/\s+/g).length)[0];
        info.title = longestSegment || '';
      }
    }
  }
};

// 日本語著者抽出
const extractJapaneseAuthors = (correctedText, info) => {
  console.log('🔍 日本語著者抽出開始');
  console.log('📄 元テキスト:', correctedText);
  
  // 著者セクションの抽出：年号で明確に区切る
  let authorSection = '';
  
  // 年号で切り分け（年号の直前まで）
  const yearMatch = correctedText.match(/^(.+?)[（(]\d{4}[）)]/);
  if (yearMatch) {
    authorSection = yearMatch[1].trim();
    console.log('📝 著者セクション (年号前で切り分け):', authorSection);
  } else {
    // 年号がない場合は引用符の前まで
    const quoteMatch = correctedText.match(/^(.+?)(?=[「『])/);
    if (quoteMatch) {
      authorSection = quoteMatch[1].trim();
      console.log('📝 著者セクション (引用符前パターン):', authorSection);
    } else {
      // それでもない場合はピリオドまで
      authorSection = correctedText.split(/[.．]/)[0];
      console.log('📝 著者セクション (ピリオド前パターン):', authorSection);
    }
  }
  
  // 年号で既に切り分けているので、残った括弧を処理
  let authorText = authorSection.replace(/[（(][^）)]*[）)]/g, '');
  console.log('📝 括弧除去後:', authorText);
  
  // 「編」「監修」「著」「訳」などの編集者情報を除去
  authorText = authorText.replace(/[編監修著訳]/g, '');
  console.log('📝 編集情報除去後:', authorText);
  
  // 統一的な区切り文字分割（優先順位あり）
  console.log('🔍 区切り文字での分割開始...');
  
  let authorCandidates = [];
  
  // 日本語著者の区切り文字を統一的に処理
  // 一般的な区切り文字を全て含む包括的なパターンで分割
  authorCandidates = authorText.split(/[、，,・•；;＆&\s]+/);
  console.log('  区切り文字分割結果:', authorCandidates);
  
  // 空文字除去と基本クリーニング
  authorCandidates = authorCandidates.map(s => {
    // 前後の空白、ピリオド、引用符を除去
    return s.trim().replace(/^[.,;:"']+|[.,;:"']+$/g, '');
  }).filter(s => s);
  console.log('🔍 分割後の著者候補リスト:', authorCandidates);
  
  // 日本語著者名の誤分割検出・修正
  // 平均文字数が3文字以下の場合は姓名が分割されている可能性
  if (authorCandidates.length >= 2) {
    const totalChars = authorCandidates.reduce((sum, name) => sum + name.length, 0);
    const avgLength = totalChars / authorCandidates.length;
    
    console.log(`📊 分割検証: 候補数=${authorCandidates.length}, 総文字数=${totalChars}, 平均=${avgLength.toFixed(1)}文字`);
    
    if (avgLength <= 3.0) {
      console.log('🔧 姓名分割疑いを検出: 結合処理を実行');
      
      // 連続する短い要素（2-3文字）をペアで結合
      const mergedCandidates = [];
      let i = 0;
      
      while (i < authorCandidates.length) {
        const current = authorCandidates[i];
        const next = authorCandidates[i + 1];
        
        // 現在と次の要素が両方とも短い（1-3文字）場合は結合
        if (current && next && 
            current.length <= 3 && next.length <= 3 && 
            /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(current + next)) {
          
          const merged = current + next;
          console.log(`  🔗 結合: "${current}" + "${next}" → "${merged}"`);
          mergedCandidates.push(merged);
          i += 2; // 2つ消費
        } else {
          mergedCandidates.push(current);
          i += 1; // 1つ消費
        }
      }
      
      // 結合後も再度クリーニング
      authorCandidates = mergedCandidates.map(s => {
        return s.trim().replace(/^[.,;:"']+|[.,;:"']+$/g, '');
      }).filter(s => s);
      console.log('🔧 結合後の著者候補リスト:', authorCandidates);
    }
  }
  
  console.log('🔍 最終著者候補リスト:', authorCandidates);
  
  console.log('🔍 フィルタリング開始...');
  
  info.authors = [];
  
  for (let i = 0; i < authorCandidates.length; i++) {
    // 著者名の最終クリーニング（句読点、引用符、括弧を除去）
    const author = authorCandidates[i]
      .trim()
      .replace(/^[.,;:"'()（）]+|[.,;:"'()（）]+$/g, '') // 前後の句読点・括弧除去
      .replace(/[\.。]+$/g, ''); // 末尾のピリオド・句点除去
    
    console.log(`\n--- 著者${i + 1}: "${author}" ---`);
    
    if (!author || author.length < 2) {
      console.log('  ✗ 長さ不足 (2文字未満)');
      continue;
    }
    
    // 日本語の姓名パターンチェック（より緩い条件）
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3005]/.test(author);
    const onlyEnglish = /^[a-zA-Z\s.]+$/.test(author);
    const hasNumbers = /\d/.test(author);
    
    console.log(`  内容チェック: 日本語含む=${hasJapanese}, 英語のみ=${onlyEnglish}, 数字含む=${hasNumbers}`);
    
    // 基本的な除外条件
    if (hasNumbers) {
      console.log('  ✗ 数字を含むため除外');
      continue;
    }
    
    if (onlyEnglish && !hasJapanese) {
      console.log('  ✗ 英語のみ（日本語文献なので除外）');
      continue;
    }
    
    // 組織名チェック（より具体的、短い日本語名は除外しない）
    const excludePattern = /(出版社|大学院|研究所|学会誌|省庁|株式会社|vol\.|no\.|pp\.|センター|機構)/;
    const isOrganization = excludePattern.test(author);
    
    console.log(`  組織名チェック: ${isOrganization ? '組織名' : '個人名'}`);
    
    if (isOrganization) {
      console.log('  ✗ 組織名として除外');
      continue;
    }
    
    console.log('  ✅ 有効な著者名として採用');
    info.authors.push(author);
    
    if (info.authors.length >= 6) {
      console.log('  ℹ️ 最大6名に達したため停止');
      break;
    }
  }
  
  console.log('\n✅ 最終日本語著者リスト:', info.authors);
  console.log('📊 日本語著者抽出サマリー:', {
    '元テキスト': correctedText.substring(0, 100) + '...',
    '著者セクション': authorSection,
    '処理後テキスト': authorText,
    '候補リスト': authorCandidates,
    '最終結果': info.authors
  });
};

// ミドルネームを考慮した英語著者分割
const splitAuthorsWithMiddleNames = (authorSection) => {
  console.log(`🔍 著者分割開始: "${authorSection}"`);
  
  // &記号を一時的にプレースホルダーに置換
  let text = authorSection.replace(/\s*&\s*/g, '__AND__');
  console.log(`📝 &置換後: "${text}"`);
  
  // 「ファミリーネーム, イニシャル」パターンを認識
  // 例: "Hunt, M. G." や "Young, J." や "Salmela-Aro, K."
  const authorPattern = /([A-Z][a-zA-Z-]*(?:\s+[A-Z][a-zA-Z-]*)*),\s*([A-Z]\.(?:\s*[A-Z]\.)*)/g;
  
  const authors = [];
  let remainingText = text;
  let match;
  
  // パターンマッチングで「姓, イニシャル」形式の著者を抽出
  console.log(`📝 正規表現パターン: ${authorPattern}`);
  
  while ((match = authorPattern.exec(text)) !== null) {
    const fullAuthor = `${match[1]}, ${match[2]}`;
    authors.push(fullAuthor);
    console.log(`📝 著者発見: "${fullAuthor}" (マッチ文字列: "${match[0]}")`);
    
    // マッチした部分を残りテキストから除去
    remainingText = remainingText.replace(match[0], '');
    console.log(`📝 除去後残りテキスト: "${remainingText}"`);
  }
  
  // __AND__も除去し、余分なカンマを除去
  remainingText = remainingText.replace(/__AND__/g, '').replace(/,\s*$/, '').trim();
  
  // 残りがあれば通常の著者名として追加
  if (remainingText) {
    const remaining = remainingText.split(/\s*,\s*/).filter(r => r.trim());
    authors.push(...remaining);
    console.log(`📝 残り著者: [${remaining.join(', ')}]`);
  }
  
  console.log(`🔍 著者分割結果: [${authors.map(a => `"${a}"`).join(', ')}]`);
  const filteredAuthors = authors.filter(a => a && a.trim());
  console.log(`🔍 フィルタ後著者: [${filteredAuthors.map(a => `"${a}"`).join(', ')}]`);
  return filteredAuthors;
};

// 英語著者抽出
const extractEnglishAuthors = (correctedText, info) => {
  console.log('🔍 英語著者抽出開始');
  console.log('📄 元テキスト:', correctedText);
  
  // 年号で切り分け（最後の年号の直前まで）
  let authorSection = '';
  // 最後の年号を探す（貪欲マッチを避けるため）
  const yearMatch = correctedText.match(/^(.+?)\s*\(\d{4}\)/);
  if (yearMatch) {
    authorSection = yearMatch[1].trim();
    console.log('📝 年号前で切り分け:', authorSection);
  } else {
    // 年号がない場合はピリオドまで
    authorSection = correctedText.split(/\)\s*\./)[0];
    console.log('📝 ピリオド前で切り分け:', authorSection);
  }
  
  // 著者セクション内に残った不完全な年号部分を除去
  authorSection = authorSection.replace(/\s*\(\d{0,4}$/, '').trim();
  console.log('📝 不完全年号除去後:', authorSection);
  
  // 残存する括弧を除去（著者名内の括弧など）
  let cleanAuthorSection = authorSection.replace(/\([^)]*\)/g, '').trim();
  
  console.log('📝 英語著者セクション原文:', authorSection);
  console.log('📝 英語著者セクション整理済み:', cleanAuthorSection);
  
  // シンプルな分割アプローチ
  let rawAuthors = [];
  
  // セミコロンを含む場合は、セミコロンでも区切り文字として使用
  if (cleanAuthorSection.includes(';')) {
    // セミコロンを含む場合の分割
    rawAuthors = cleanAuthorSection.split(/[;&,]\s*/).filter(a => a.trim());
  } else if (cleanAuthorSection.includes('&')) {
    // &を含む場合でも、正しい著者分割を使用
    // 例: "Hunt, M. G., Marx, R., Lipson, C., & Young, J."
    rawAuthors = splitAuthorsWithMiddleNames(cleanAuthorSection);
  } else {
    // 「&」がない場合でも、「姓, イニシャル」パターンを考慮した分割
    // 例: "Hunt, M. G., Marx, R., Lipson, C., Young, J." -> 4人の著者
    rawAuthors = splitAuthorsWithMiddleNames(cleanAuthorSection);
  }
  
  console.log('📝 著者分割結果:', rawAuthors);
  
  info.authors = rawAuthors
    .map(s => s.trim())
    .filter(author => {
      if (!author || author.length < 2) {
        console.log(`  "${author}" → 無効 (長さ不足)`);
        return false;
      }
      
      // 不完全な年号や余分な文字を除去
      let cleanAuthor = author.replace(/\(\d{0,4}.*$/, '').replace(/,$/, '').trim();
      
      if (cleanAuthor.length < 2) {
        console.log(`  "${author}" → 無効 (クリーニング後長さ不足)`);
        return false;
      }
      
      // より緩い著者名チェック（英字を含み、著者名らしいパターン）
      const hasLetters = /[A-Za-z]/.test(cleanAuthor);
      const hasBasicPattern = /^[A-Za-z]/.test(cleanAuthor) && /^[A-Za-z\s,.'&-]+$/.test(cleanAuthor);
      const isNotInstitution = !/(University|Press|Journal|Publishing|et\s+al|Inc\.?|Corp\.?|Ltd\.?)/gi.test(cleanAuthor);
      const isValid = hasLetters && hasBasicPattern && isNotInstitution;
      
      console.log(`  "${author}" → "${cleanAuthor}" → ${isValid ? '有効' : '無効'} (letters: ${hasLetters}, pattern: ${hasBasicPattern}, not-inst: ${isNotInstitution})`);
      return isValid;
    })
    .slice(0, 10); // より多くの著者を保持
    
  console.log('✅ 最終英語著者リスト:', info.authors);
  console.log('📊 英語著者抽出サマリー:', {
    '元テキスト': correctedText.substring(0, 100) + '...',
    '著者セクション': authorSection,
    '処理後テキスト': cleanAuthorSection,
    '分割結果': rawAuthors,
    '最終結果': info.authors
  });
};

// 日本語雑誌名抽出
const extractJapaneseJournal = (correctedText, info) => {
  console.log('🔍 日本語雑誌名抽出開始');
  console.log('📝 元テキスト:', correctedText);
  console.log('📖 抽出済みタイトル:', info.title);
  
  // まず、タイトル抽出後の残り部分を特定
  let remainingText = correctedText;
  if (info.title) {
    const titleIndex = correctedText.indexOf(info.title);
    if (titleIndex !== -1) {
      remainingText = correctedText.substring(titleIndex + info.title.length);
      console.log('📄 残りテキスト:', remainingText);
    }
  }
  
  // 引用符による明示的な雑誌名
  const quotedPatterns = [
    /『([^』]+)』/,
    /「([^」]+)」/
  ];
  
  for (const pattern of quotedPatterns) {
    const match = remainingText.match(pattern);
    if (match) {
      info.journal = match[1].trim();
      console.log(`✅ 雑誌名検出（引用符）: "${info.journal}"`);
      break;
    }
  }
  
  // 引用符がない場合、位置ベースで雑誌名を抽出
  if (!info.journal) {
    const periodIndex = remainingText.indexOf('.');
    console.log('🔍 ピリオド位置:', periodIndex);
    
    if (periodIndex !== -1) {
      const afterPeriod = remainingText.substring(periodIndex + 1);
      console.log('📄 ピリオド後:', afterPeriod);
      
      const beforeCommaOrNumberMatch = afterPeriod.match(/^\s*([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s]+?)(?=\s*[，,]\s*\d+)/);
      console.log('🔍 カンマ前マッチ結果:', beforeCommaOrNumberMatch);
      
      if (beforeCommaOrNumberMatch) {
        let candidate = beforeCommaOrNumberMatch[1].trim();
        candidate = candidate.replace(/[\d\s\-－・]+$/, '').trim();
        
        console.log(`🔍 雑誌名候補（ピリオド後）: "${candidate}"`);
        
        if (candidate.length >= 3 && candidate.length <= 30) {
          info.journal = candidate;
          console.log(`✅ 雑誌名検出（ピリオド後パターン）: "${candidate}"`);
        }
      }
    }
  }
  
  // まだ見つからない場合、「研究」「学会誌」「論文集」パターンで検索
  if (!info.journal) {
    const journalBeforeVolumePatterns = [
      /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{1,20}研究)\s*[，,]?\s*\d+/,
      /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{1,20}学会誌)\s*[，,]?\s*\d+/,
      /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{1,20}論文集)\s*[，,]?\s*\d+/,
      /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{1,20}学報)\s*[，,]?\s*\d+/,
      /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{1,20}紀要)\s*[，,]?\s*\d+/,
      /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{1,20}ジャーナル)\s*[，,]?\s*\d+/
    ];
    
    for (const pattern of journalBeforeVolumePatterns) {
      const match = remainingText.match(pattern);
      if (match) {
        const candidate = match[1].trim();
        if (!info.title || !info.title.includes(candidate)) {
          info.journal = candidate;
          console.log(`✅ 雑誌名検出（パターンマッチ）: "${candidate}"`);
          break;
        }
      }
    }
  }
  
  // それでも見つからない場合、より広範囲で検索
  if (!info.journal) {
    const beforeNumberPattern = /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{3,25})\s*[，,]\s*\d+/;
    const match = remainingText.match(beforeNumberPattern);
    if (match) {
      const candidate = match[1].trim();
      if (/研究|学会|論文|ジャーナル|紀要|学報|報告|会誌|評論/.test(candidate)) {
        if (!info.title || !info.title.includes(candidate)) {
          info.journal = candidate;
          console.log(`✅ 雑誌名検出（広範囲検索）: "${candidate}"`);
        }
      }
    }
  }
};

// 英語雑誌名抽出
const extractEnglishJournal = (correctedText, info) => {
  const journalPatterns = [
    /\.\s*([A-Z][A-Za-z\s&]+),?\s*vol/i,
    /\.\s*([A-Z][A-Za-z\s&]+),?\s*\d+\(/i,
    /\.\s*([A-Z][A-Za-z\s&]+),?\s*\d+,/i,
    /In\s+([A-Z][A-Za-z\s&]+)/i
  ];
  
  for (const pattern of journalPatterns) {
    const match = correctedText.match(pattern);
    if (match) {
      info.journal = match[1].trim();
      break;
    }
  }
};

// 日本語巻号ページ抽出
const extractJapaneseVolumeIssuePages = (correctedText, info) => {
  const volumeIssuePagePatterns = [
    /(\d+)\s*巻\s*(\d+)\s*号[，,]?\s*(?:pp\.?)?\s*(\d+[-–]\d+)/,
    /第?\s*(\d+)\s*巻\s*第?\s*(\d+)\s*号[，,]?\s*(?:pp\.?)?\s*(\d+[-–]\d+)/,
    /(\d+)[，,]\s*(\d+)[，,]\s*(\d+[-–]\d+)/,
    /vol\.\s*(\d+)[，,]?\s*no\.\s*(\d+)[，,]?\s*(?:pp\.?)?\s*(\d+[-–]\d+)/i
  ];
  
  for (const pattern of volumeIssuePagePatterns) {
    const match = correctedText.match(pattern);
    if (match) {
      info.volume = match[1];
      info.issue = match[2];
      info.pages = match[3];
      console.log(`✅ 巻号ページ抽出: ${info.volume}巻${info.issue}号、${info.pages}ページ`);
      break;
    }
  }
  
  // 巻号のみのパターン（ページ番号なし）
  if (!info.volume) {
    const volumeIssueOnlyPatterns = [
      // 日本語的な巻号表記: "17 巻 5921 号", "26巻8号", "第17巻第5号" 
      /(?:第\s*)?(\d+)\s*巻\s*(?:第\s*)?(\d+)\s*号/,
      // 従来の巻のみパターン
      /(\d+)\s*巻/,
      /第?\s*(\d+)\s*巻/,
      /vol\.\s*(\d+)/i
    ];
    
    for (const pattern of volumeIssueOnlyPatterns) {
      const match = correctedText.match(pattern);
      if (match) {
        info.volume = match[1];
        // 巻号両方がある場合は号も設定
        if (match[2]) {
          info.issue = match[2];
          console.log(`✅ 巻号抽出: ${info.volume}巻${info.issue}号`);
        } else {
          console.log(`✅ 巻抽出: ${info.volume}巻`);
        }
        break;
      }
    }
  }
  
  // 号のみのパターン（巻が見つからなかった場合）
  if (!info.issue && !info.volume) {
    const issueOnlyPatterns = [
      /(?:第\s*)?(\d+)\s*号/,
      /no\.\s*(\d+)/i,
      /issue\s*(\d+)/i
    ];
    
    for (const pattern of issueOnlyPatterns) {
      const match = correctedText.match(pattern);
      if (match) {
        info.issue = match[1];
        console.log(`✅ 号抽出: ${info.issue}号`);
        break;
      }
    }
  }

  // ページのみのパターン
  if (!info.pages) {
    const pagePatterns = [
      /pp?\.\s*(\d+[-–]\d+)/,
      /(\d+[-–]\d+)\s*ページ/,
      /(\d+[-–]\d+)$/
    ];
    
    for (const pattern of pagePatterns) {
      const match = correctedText.match(pattern);
      if (match) {
        info.pages = match[1];
        break;
      }
    }
  }
};

// 英語巻号ページ抽出
const extractEnglishVolumeIssuePages = (correctedText, info) => {
  const volumeIssuePagePatterns = [
    /(\d+)\s*\(\s*(\d+)\s*\)[，,]?\s*(\d+[-–]\d+)/,
    /vol\.\s*(\d+)[，,]?\s*no\.\s*(\d+)[，,]?\s*(?:pp\.?)?\s*(\d+[-–]\d+)/i,
    /(\d+)[，,]\s*(\d+)[，,]\s*(\d+[-–]\d+)/,
    /volume\s*(\d+)[，,]?\s*issue\s*(\d+)[，,]?\s*(?:pp\.?)?\s*(\d+[-–]\d+)/i
  ];
  
  for (const pattern of volumeIssuePagePatterns) {
    const match = correctedText.match(pattern);
    if (match) {
      info.volume = match[1];
      info.issue = match[2];
      info.pages = match[3];
      console.log(`✅ Volume/Issue/Pages: ${info.volume}(${info.issue}), ${info.pages}`);
      break;
    }
  }
  
  // 巻号のみのパターン
  if (!info.volume) {
    const volumeOnlyPatterns = [
      /vol\.\s*(\d+)/i,
      /volume\s*(\d+)/i,
      /(\d+)\s*\(\s*\d+\s*\)/
    ];
    
    for (const pattern of volumeOnlyPatterns) {
      const match = correctedText.match(pattern);
      if (match) {
        info.volume = match[1];
        break;
      }
    }
  }
  
  // ページのみのパターン
  if (!info.pages) {
    const pagePatterns = [
      /pp?\.\s*(\d+[-–]\d+)/i,
      /pages?\s*(\d+[-–]\d+)/i,
      /(\d+[-–]\d+)$/
    ];
    
    for (const pattern of pagePatterns) {
      const match = correctedText.match(pattern);
      if (match) {
        info.pages = match[1];
        break;
      }
    }
  }
};

// 書籍判定
const detectBook = (correctedText, info) => {
  // まず論文の特徴（巻号ページ番号）をチェック
  // これがあれば確実に論文なので、書籍判定をスキップ
  const journalArticlePatterns = [
    // 日本語パターン: "26(8), 673–689", "24(10), 45–64"
    /\b\d+\s*\(\s*\d+\s*\)\s*[,，]\s*\d+[-–—]\d+/,
    // 英語パターン: "26(8), 673-689", "Vol. 26, No. 8, pp. 673-689"
    /\b(?:vol\.?\s*)?\d+\s*[,，]?\s*(?:no\.?\s*)?\(?(?:\d+)\)?\s*[,，]?\s*(?:pp?\.?\s*)?\d+[-–—]\d+/i,
    // より具体的な学術論文パターン
    /\b\d+\s*\(\s*\d+\s*\)\s*[:：]\s*\d+[-–—]\d+/,
    // "Volume 26, Issue 8, Pages 673-689"スタイル
    /\bvolume\s+\d+[,，]?\s*issue\s+\d+[,，]?\s*pages?\s+\d+[-–—]\d+/i,
    // 日本語的な巻号表記: "17 巻 5921 号", "26巻8号", "第17巻第5号"
    /(?:第\s*)?\d+\s*巻\s*(?:第\s*)?\d+\s*号/,
    // 号のみの日本語表記でもページ範囲があれば論文: "5921号, 123-145"
    /\d+\s*号\s*[,，]\s*\d+[-–—]\d+/,
    // 巻のみでもページ範囲があれば論文: "17巻, 123-145"  
    /\d+\s*巻\s*[,，]\s*\d+[-–—]\d+/
  ];
  
  console.log(`📚 書籍判定開始: "${correctedText}"`);
  
  // 論文の巻号ページ番号パターンをチェック
  for (let i = 0; i < journalArticlePatterns.length; i++) {
    const pattern = journalArticlePatterns[i];
    const isMatch = pattern.test(correctedText);
    console.log(`📄 論文パターン${i + 1}チェック: ${pattern} → ${isMatch ? 'マッチ' : 'マッチせず'}`);
    
    if (isMatch) {
      console.log(`📄 論文パターン検出: パターン${i + 1} → 書籍ではなく論文と判定`);
      info.isBook = false;
      return; // 論文確定なので書籍判定処理をスキップ
    }
  }
  
  console.log(`📄 全論文パターンマッチせず → 書籍判定を続行`);
  
  // 特別テスト: 「17 巻 5921 号」パターンの具体的なチェック
  const testPattern = /(?:第\s*)?\d+\s*巻\s*(?:第\s*)?\d+\s*号/;
  const testResult = testPattern.test(correctedText);
  console.log(`🔍 特別テスト「巻号」パターン: ${testPattern} → ${testResult ? 'マッチ' : 'マッチせず'}`);
  if (testResult) {
    const match = correctedText.match(testPattern);
    console.log(`🔍 マッチした部分: "${match[0]}"`);
  }
  
  // 巻・号・ページが既に抽出されている場合も論文の可能性が高い
  if (info.volume && info.issue && info.pages) {
    console.log(`📄 巻号ページ情報検出: Vol.${info.volume}(${info.issue}), ${info.pages} → 論文と判定`);
    info.isBook = false;
    return;
  }
  
  // 巻とページがある場合も論文の可能性が高い
  if (info.volume && info.pages && !info.publisher) {
    console.log(`📄 巻・ページ情報検出: Vol.${info.volume}, ${info.pages} → 論文と判定`);
    info.isBook = false;
    return;
  }
  
  // 巻と号がある場合も論文の可能性が高い（ページ番号なくても）
  if (info.volume && info.issue) {
    console.log(`📄 巻号情報検出: Vol.${info.volume}(${info.issue}) → 論文と判定`);
    info.isBook = false;
    return;
  }
  
  // 雑誌名が既に抽出されている場合は確実に論文
  if (info.journal && info.journal.trim()) {
    console.log(`📄 雑誌名検出: "${info.journal}" → 論文と判定`);
    info.isBook = false;
    return;
  }
  
  // 雑誌名パターンを直接チェック（抽出されていない場合のフォールバック）
  const journalPatterns = [
    // 英語雑誌名パターン
    /\b(?:International\s+)?Journal\s+of\s+[A-Z][A-Za-z\s&\-]+/i,
    /\b(?:American|European|British|Canadian)\s+Journal\s+of\s+[A-Z][A-Za-z\s&\-]+/i,
    /\b[A-Z][A-Za-z\s&\-]+\s+Journal\b/i,
    /\bProceedings\s+of\s+/i,
    /\bAnnals\s+of\s+/i,
    /\bReview\s+of\s+/i,
    /\bTransactions\s+on\s+/i,
    // 日本語雑誌名パターン
    /[学研究論文誌雑誌学会]$/,
    /学会[誌論文]/,
    /研究[誌会]/,
    /論文[誌集]/,
    /雑誌$/,
    /ジャーナル$/,
    /学報$/,
    /紀要$/,
    /年報$/
  ];
  
  for (const pattern of journalPatterns) {
    if (pattern.test(correctedText)) {
      console.log(`📄 雑誌名パターン検出: ${pattern} → 論文と判定`);
      info.isBook = false;
      return;
    }
  }
  
  const bookIndicators = [
    // 日本語
    /出版社/, /出版/, /編/, /著/, /監修/, /翻訳/, /訳/, /社$/,
    // 英語
    /press$/i, /publisher/i, /publishing/i, /books?$/i, /edition/i, /eds?\./i, /editor/i
  ];
  
  const publisherPatterns = [
    // 日本語出版社パターン（詳細）
    /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+(?:出版|社|書店|出版社|書房|文庫|新書|叢書|選書|シリーズ|ブックス))/,
    
    // 英語圏出版社パターン
    /([A-Z][A-Za-z\s&\-'\.]+(?:Press|Publishing|Publishers|Books|Publications|Media|House|Group))/,
    
    // フランス語出版社パターン（より具体的）- "Les Éditions de Minuit"型
    /(Les\s+(?:Éditions?|Editions?)\s+d[eu]\s+[A-Z][A-Za-z\s&àáâãäåæèéêëìíîïñòóôõöùúûüýÿ\-'\.]+)/i,
    
    // フランス語出版社パターン（一般）
    /((?:Les\s+)?(?:Éditions?|Editions?|Presses?|Librairie)(?:\s+[A-Z][A-Za-z\s&àáâãäåæèéêëìíîïñòóôõöùúûüýÿ\-'\.]+)+)/i,
    
    // ドイツ語出版社パターン
    /([A-Z][A-Za-z\s&äöüß\-'\.]+(?:Verlag|Verlage|Buchverlag))/i,
    
    // イタリア語・スペイン語出版社パターン
    /([A-Z][A-Za-z\s&àáâãäåæèéêëìíîïñòóôõöùúûüýÿ\-'\.]+(?:Editore|Editori|Editorial|Ediciones))/i,
    
    // 大学出版パターン（詳細）
    /([A-Z][A-Za-z\s&\-'\.]+(?:University|College|Institute|Academy)(?:\s+Press|\s+Publishing|\s+Publications)?)/,
    
    // 学術・専門出版社パターン
    /([A-Z][A-Za-z\s&\-'\.]+(?:Academic|Scholarly|Scientific|Research|Institute|Foundation)(?:\s+Press|\s+Publishing|\s+Publications)?)/,
    
    // 企業接尾辞付き出版社パターン
    /([A-Z][A-Za-z\s&\-'\.]+(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC\.?|Co\.?|Company|Group|Holdings))/,
    
    // その他の国際的な出版関連語句
    /([A-Z][A-Za-z\s&\-'\.]+(?:Printing|Print|Publication|Publish|Literary|Literature|文学|学術|研究))/i,
    
    // 韓国語出版社パターン
    /([\uAC00-\uD7AF]+(?:출판|사|서점|북스))/,
    
    // 中国語出版社パターン
    /([\u4E00-\u9FAF]+(?:出版社|书店|文化|图书))/,
    
    // 特殊ケース：よく知られた出版社名（部分マッチ）
    /\b(Penguin|Random\s+House|HarperCollins|Macmillan|Wiley|Springer|Elsevier|Oxford|Cambridge|MIT|Harvard|Yale|Princeton|Stanford|Routledge|Sage|Taylor\s+&\s+Francis|Blackwell|Palgrave|Norton|Vintage|Anchor|Bantam|Dell|Doubleday|Knopf|Scribner|Simon\s+&\s+Schuster|Houghton\s+Mifflin|McGraw\-?Hill|Pearson|Cengage|Bedford|Worth|Freeman|Wadsworth|Addison\-?Wesley)\b/i
  ];
  
  // 出版社の抽出（改良版：文末から検索）
  console.log(`📚 出版社抽出開始 - 対象テキスト: "${correctedText}"`);
  
  // まず、タイトル以降の部分を特定
  let searchText = correctedText;
  
  // タイトルが特定できている場合は、タイトル以降の部分のみを検索対象とする
  if (info.title && info.title.trim()) {
    const titleIndex = correctedText.indexOf(info.title);
    if (titleIndex !== -1) {
      const afterTitle = correctedText.substring(titleIndex + info.title.length);
      if (afterTitle.length > 0) {
        searchText = afterTitle;
        console.log(`📚 タイトル後の検索範囲: "${searchText}"`);
      }
    }
  }
  
  // 文末から逆順で出版社パターンを検索（より正確な抽出のため）
  let publisherFound = false;
  let bestPublisher = '';
  let bestPublisherLength = 0;
  
  // すべてのパターンを試して、最も長い（完全な）マッチを選択
  for (const pattern of publisherPatterns) {
    // グローバルマッチを使用して、すべての候補を取得
    const globalPattern = new RegExp(pattern.source, (pattern.flags || '') + 'g');
    let match;
    
    while ((match = globalPattern.exec(searchText)) !== null) {
      const extractedPublisher = match[1] || match[0];
      console.log(`📚 出版社パターン ${pattern} → マッチ候補: "${extractedPublisher}"`);
      
      // タイトルの一部でないことを確認
      if (!info.title || !info.title.includes(extractedPublisher)) {
        // より長い（完全な）マッチを優先
        if (extractedPublisher.length > bestPublisherLength) {
          bestPublisher = extractedPublisher.trim();
          bestPublisherLength = extractedPublisher.length;
          console.log(`📚 より完全な出版社候補を発見: "${bestPublisher}" (長さ: ${bestPublisherLength})`);
        }
      } else {
        console.log(`⚠️ 出版社候補 "${extractedPublisher}" はタイトルの一部のためスキップ`);
      }
    }
  }
  
  // 最も完全な出版社名を採用
  if (bestPublisher) {
    info.publisher = bestPublisher;
    info.isBook = true;
    console.log(`✅ 書籍検出 - 最終出版社: ${info.publisher}`);
    publisherFound = true;
  }
  
  // フォールバック：明示的な出版社パターンで見つからない場合
  if (!publisherFound && !info.publisher) {
    console.log(`📚 フォールバック出版社検索開始 - 検索範囲: "${searchText}"`);
    
    // 文末近くの大文字で始まる単語/フレーズを出版社候補として検討
    const fallbackPatterns = [
      // 日本語：カタカナ＋漢字の組み合わせ（会社名らしいもの）
      /([\u30A0-\u30FF\u4E00-\u9FAF]{2,})/g,
      // 英語：大文字で始まる2語以上の固有名詞（年号の後）
      /\(\d{4}\).*?([A-Z][a-z]+(?:\s+[A-Z][a-z]*){1,3})(?:\.|$)/,
      // 英語：文末の大文字で始まる単語（改良版）
      /\.?\s*([A-Z][a-z]+(?:\s+[a-z]+)*(?:\s+[A-Z][a-z]*){0,3})\.?\s*$/
    ];
    
    for (const pattern of fallbackPatterns) {
      const matches = searchText.match(pattern);
      if (matches) {
        const candidate = Array.isArray(matches) ? matches[matches.length - 1] : matches[1] || matches[0];
        if (candidate && candidate.length > 2 && candidate.length < 50) {
          // 明らかに出版社でないものを除外
          const excludePatterns = /^(pp?|vol|no|doi|http|www|ed|eds|trans|translated|et\s+al|and|or|in|the|of|for|with|by)$/i;
          // タイトルの一部でないことも確認
          if (!excludePatterns.test(candidate.trim()) && 
              (!info.title || !info.title.includes(candidate))) {
            info.publisher = candidate.trim();
            info.isBook = true;
            console.log(`✅ フォールバック出版社検出: ${info.publisher}`);
            break;
          } else {
            console.log(`⚠️ フォールバック候補 "${candidate}" は除外条件に該当`);
          }
        }
      }
    }
  }
  
  // 書籍指標の検出
  if (!info.isBook) {
    for (const indicator of bookIndicators) {
      if (indicator.test(correctedText)) {
        info.isBook = true;
        console.log(`✅ 書籍検出 - 指標: ${indicator}`);
        break;
      }
    }
  }
  
  // 雑誌名がなく、明確な論文要素もない場合のみ書籍と推定
  if (!info.journal && !info.isBook && !info.volume && !info.issue && info.title && info.authors.length > 0) {
    info.isBook = true;
    console.log(`✅ 書籍推定（雑誌名・巻号なし）`);
  } else if (!info.isBook) {
    // 明示的に書籍判定されていない場合は論文として扱う
    console.log(`📄 論文として扱う（書籍要素なし）`);
  }
};