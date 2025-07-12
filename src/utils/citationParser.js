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
  
  // 空文字除去
  authorCandidates = authorCandidates.map(s => s.trim()).filter(s => s);
  console.log('🔍 最終著者候補リスト:', authorCandidates);
  
  console.log('🔍 フィルタリング開始...');
  
  info.authors = [];
  
  for (let i = 0; i < authorCandidates.length; i++) {
    const author = authorCandidates[i].trim();
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
  // カンマで分割して各部分を分析
  const parts = authorSection.split(',').map(part => part.trim());
  const authors = [];
  let currentAuthor = '';
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    if (i === 0) {
      // 最初の部分は必ず姓
      currentAuthor = part;
    } else {
      // 2番目以降：姓なのか名/ミドルネームなのかを判定
      const isLikelySurname = (
        part.length > 2 &&                           // ある程度長い
        !/^[A-Z]\./.test(part) &&                    // イニシャルではない (G. など)
        !/^[A-Z]\s+[A-Z]\./.test(part) &&           // 複数イニシャルではない (G. A. など)
        /^[A-Z][a-z]+/.test(part)                    // 大文字+小文字のパターン
      );
      
      if (isLikelySurname) {
        // 新しい著者の姓と判定
        if (currentAuthor) {
          authors.push(currentAuthor.trim());
        }
        currentAuthor = part;
      } else {
        // 名またはミドルネームと判定 - 現在の著者に追加
        currentAuthor += ', ' + part;
      }
    }
  }
  
  // 最後の著者を追加
  if (currentAuthor) {
    authors.push(currentAuthor.trim());
  }
  
  console.log('🔍 ミドルネーム考慮分割:', {
    '入力': authorSection,
    '分割結果': authors
  });
  
  return authors;
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
    const parts = cleanAuthorSection.split(/\s*&\s*/);
    
    // &の前の部分をカンマで分割して追加
    if (parts.length > 1) {
      const beforeAnd = parts[0].trim();
      const commaAuthors = beforeAnd.split(/,\s+(?=[A-Z])/);
      rawAuthors.push(...commaAuthors.map(a => a.trim()).filter(a => a));
      
      // &の後の著者たち（複数の&がある場合も対応）
      for (let i = 1; i < parts.length; i++) {
        const author = parts[i].trim();
        if (author) rawAuthors.push(author);
      }
    }
  } else {
    // 「&」がない場合は著者間のカンマで分割（ミドルネーム考慮）
    // 「姓, 名 イニシャル」パターンを考慮した分割
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
      const isNotInstitution = !/(University|Press|Journal|Publishing|et\s+al|Inc|Corp|Ltd|vol|no|pp)/gi.test(cleanAuthor);
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
  
  // 巻号のみのパターン
  if (!info.volume) {
    const volumeOnlyPatterns = [
      /(\d+)\s*巻/,
      /第?\s*(\d+)\s*巻/,
      /vol\.\s*(\d+)/i
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
  const bookIndicators = [
    // 日本語
    /出版社/, /出版/, /編/, /著/, /監修/, /翻訳/, /訳/, /社$/,
    // 英語
    /press$/i, /publisher/i, /publishing/i, /books?$/i, /edition/i, /eds?\./i, /editor/i
  ];
  
  const publisherPatterns = [
    // 日本語出版社パターン
    /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+(?:出版|社|書店|出版社))/,
    // 英語出版社パターン
    /([A-Z][A-Za-z\s&]+(?:Press|Publishing|Publishers|Books))/
  ];
  
  // 出版社の抽出
  for (const pattern of publisherPatterns) {
    const match = correctedText.match(pattern);
    if (match) {
      info.publisher = match[1].trim();
      info.isBook = true;
      console.log(`✅ 書籍検出 - 出版社: ${info.publisher}`);
      break;
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
  
  // 雑誌名がない場合は書籍の可能性が高い
  if (!info.journal && !info.isBook && info.title && info.authors.length > 0) {
    info.isBook = true;
    console.log(`✅ 書籍推定（雑誌名なし）`);
  }
};