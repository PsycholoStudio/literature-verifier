import React, { useState } from 'react';
import { Search, BookOpen, ExternalLink, FileText, CheckCircle, AlertCircle, XCircle, Loader2 } from 'lucide-react';

const LiteratureVerifier = () => {
  const [inputText, setInputText] = useState('');
  const [results, setResults] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProcessing, setCurrentProcessing] = useState(0);
  const [statistics, setStatistics] = useState({ found: 0, similar: 0, notFound: 0 });
  const [citationStyle, setCitationStyle] = useState('apa'); // 新しい状態

  // よくある誤記の修正
  const fixCommonErrors = (text) => {
    return text
      .replace(/創ー/g, '創一')
      .replace(/(\d+)\s*巻\s*(\d+)\s*号/g, 'vol.$1, no.$2')
      .replace(/(\d+)\s*巻/g, 'vol.$1')
      .replace(/(\d+)\s*号/g, 'no.$1')
      .replace(/\s*pp\.\s*/g, ' pp.')
      .replace(/\s*doi\s*:\s*/gi, ' doi:');
  };

  // 文献テキストの解析関数
  const parseLiterature = (text) => {
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
          const segments = correctedText.split(/[,，。・、\(\)]/g);
          const longestSegment = segments
            .map(s => s.trim())
            .filter(s => s.length >= 5)
            .filter(s => !/\d{4}|doi|http|pp\.|vol\.|no\.|巻|号/gi.test(s))
            .filter(s => !/(大学|研究所|学会|省庁|出版)/g.test(s))
            .sort((a, b) => b.length - a.length)[0];
          info.title = longestSegment || '';
        }
      }
    } else {
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
            const segments = correctedText.split(/[,.()/](?!\d)/g);
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
    }

    // 著者の抽出
    if (info.language === 'japanese') {
      const authorSection = correctedText.split(/[.．]/)[0];
      const authorText = authorSection.replace(/\([^)]*\)/g, '');
      const authorCandidates = authorText.split(/[・•&、，,\s]+/);
      
      info.authors = authorCandidates
        .map(s => s.trim())
        .filter(author => {
          const namePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3005]{2,8}/;
          return namePattern.test(author) && author.length >= 2;
        })
        .filter(author => !/(出版|大学|研究所|学会|省庁|株式会社|年|月|日|巻|号|pp)/g.test(author))
        .slice(0, 5);
    } else {
      const authorSection = correctedText.split(/\)\s*\./)[0];
      const cleanAuthorSection = authorSection.replace(/\([^)]*\)/g, '').trim();
      const authors = cleanAuthorSection.split(/\s*(?:&|,\s*&\s*|,)\s*/);
      
      info.authors = authors
        .map(s => s.trim())
        .filter(author => {
          const namePattern = /^[A-Z][a-z]+(?:,?\s*[A-Z]\.?\s*)*[A-Z]?\.?$|^[A-Z][a-z]+\s+[A-Z][a-z]+$|^[A-Z][a-z-']+,?\s*[A-Z]\.?$/;
          return namePattern.test(author) && author.length >= 2;
        })
        .filter(author => !/(University|Press|Journal|Publishing|et\s+al)/gi.test(author))
        .slice(0, 6);
    }

    // 雑誌名の抽出（改良版）
    if (info.language === 'japanese') {
      console.log('🔍 日本語雑誌名抽出開始');
      console.log('📝 元テキスト:', correctedText);
      console.log('📖 抽出済みタイトル:', info.title);
      
      // まず、タイトル抽出後の残り部分を特定
      let remainingText = correctedText;
      if (info.title) {
        // タイトル部分を除去して雑誌名検索範囲を限定
        const titleIndex = correctedText.indexOf(info.title);
        if (titleIndex !== -1) {
          remainingText = correctedText.substring(titleIndex + info.title.length);
          console.log('📄 残りテキスト:', remainingText);
        }
      }
      
      // 引用符による明示的な雑誌名
      const quotedPatterns = [
        /『([^』]+)』/,  // 『雑誌名』
        /「([^」]+)」/   // 「雑誌名」
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
        // パターン1: ピリオド後、カンマ前の部分を正確に抽出
        // 例: .キャリア教育研究， 33， → "キャリア教育研究"
        
        // ピリオドの位置を特定
        const periodIndex = remainingText.indexOf('.');
        console.log('🔍 ピリオド位置:', periodIndex);
        
        if (periodIndex !== -1) {
          const afterPeriod = remainingText.substring(periodIndex + 1);
          console.log('📄 ピリオド後:', afterPeriod);
          
          // カンマまたは数字パターンまでの部分を抽出
          const beforeCommaOrNumberMatch = afterPeriod.match(/^\s*([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s]+?)(?=\s*[，,]\s*\d+)/);
          console.log('🔍 カンマ前マッチ結果:', beforeCommaOrNumberMatch);
          
          if (beforeCommaOrNumberMatch) {
            let candidate = beforeCommaOrNumberMatch[1].trim();
            
            // 後ろから不要な部分を除去
            candidate = candidate.replace(/[\d\s\-－・]+$/, '').trim();
            
            console.log(`🔍 雑誌名候補（ピリオド後）: "${candidate}"`);
            
            // 雑誌名らしい候補かチェック（適切な長さ）
            if (candidate.length >= 3 && candidate.length <= 30) {
              info.journal = candidate;
              console.log(`✅ 雑誌名検出（ピリオド後パターン）: "${candidate}"`);
            }
          }
        }
      }
      
      // まだ見つからない場合、「研究」「学会誌」「論文集」パターンで検索（貪欲マッチ）
      if (!info.journal) {
        // 数字（巻号）の直前にある「〜研究」「〜学会誌」等を探す（貪欲マッチで完全な名前を取得）
        const journalBeforeVolumePatterns = [
          // より具体的なパターンから試行
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
            // タイトル内の単語でないことを確認
            if (!info.title || !info.title.includes(candidate)) {
              info.journal = candidate;
              console.log(`✅ 雑誌名検出（パターンマッチ）: "${candidate}"`);
              break;
            }
          }
        }
      }
      
      // それでも見つからない場合、より広範囲で検索（但し、タイトル除外）
      if (!info.journal) {
        // カンマや数字の前にある日本語文字列を雑誌名候補として検討
        const beforeNumberPattern = /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{3,25})\s*[，,]\s*\d+/;
        const match = remainingText.match(beforeNumberPattern);
        if (match) {
          const candidate = match[1].trim();
          // 雑誌名っぽいキーワードを含み、タイトルの一部でないことを確認
          if (/研究|学会|論文|ジャーナル|紀要|学報|報告|会誌|評論/.test(candidate)) {
            if (!info.title || !info.title.includes(candidate)) {
              info.journal = candidate;
              console.log(`✅ 雑誌名検出（広範囲検索）: "${candidate}"`);
            }
          }
        }
      }
      
    } else {
      // 英語雑誌名パターン（既存のまま）
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
    }

    // 巻号・ページ番号の抽出
    if (info.language === 'japanese') {
      // 日本語の巻号ページパターン
      // 例: "33巻4号、pp.234-248" "第45巻第2号、pp.123-145"
      const volumeIssuePagePatterns = [
        /(\d+)\s*巻\s*(\d+)\s*号[，,]?\s*(?:pp\.?)?\s*(\d+[-–]\d+)/,
        /第?\s*(\d+)\s*巻\s*第?\s*(\d+)\s*号[，,]?\s*(?:pp\.?)?\s*(\d+[-–]\d+)/,
        /(\d+)[，,]\s*(\d+)[，,]\s*(\d+[-–]\d+)/, // 33, 4, 234-248
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
      
    } else {
      // 英語の巻号ページパターン
      // 例: "37(10), 751-768" "vol. 521, no. 7553, pp. 436-444"
      const volumeIssuePagePatterns = [
        /(\d+)\s*\(\s*(\d+)\s*\)[，,]?\s*(\d+[-–]\d+)/,
        /vol\.\s*(\d+)[，,]?\s*no\.\s*(\d+)[，,]?\s*(?:pp\.?)?\s*(\d+[-–]\d+)/i,
        /(\d+)[，,]\s*(\d+)[，,]\s*(\d+[-–]\d+)/, // 521, 7553, 436-444
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
          /(\d+)\s*\(\s*\d+\s*\)/ // 巻(号)形式
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
    }

    // 書籍判定（雑誌ではなく書籍の場合）
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

    return info;
  };

  // ファミリーネーム抽出関数（安全な型チェック版）
  const extractFamilyName = (authorName) => {
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
  const normalizeAuthorList = (authorsInput) => {
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
  const compareFields = (original, found) => {
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

  // 著者名の正規化（安全な型チェック版）
  const normalizeAuthorName = (name) => {
    if (!name || typeof name !== 'string') return '';
    
    return name
      .toLowerCase()
      .replace(/[,，;；・•&\s]+/g, ' ') // 区切り文字とスペースを統一
      .replace(/\s+/g, ' ') // 連続スペースを単一スペースに
      .trim();
  };

  // 著者名の比較（改良版 - スペース・区切り文字許容）
  const compareAuthors = (originalAuthors, foundAuthors) => {
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
    
    // より柔軟な名前比較（姓と名の順序・区切り文字の違いを許容）
    const isNameMatch = (name1, name2) => {
      if (!name1 || !name2 || typeof name1 !== 'string' || typeof name2 !== 'string') {
        return false;
      }
      
      const clean1 = name1.replace(/[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAFa-zA-Z]/g, '');
      const clean2 = name2.replace(/[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAFa-zA-Z]/g, '');
      
      // 完全一致
      if (clean1 === clean2) return true;
      
      // 日本語名の場合、姓名の組み合わせをチェック
      if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(clean1)) {
        // 名前が含まれているかチェック（部分一致）
        return clean1.includes(clean2) || clean2.includes(clean1);
      }
      
      // 英語名の場合、類似度チェック
      return calculateSimilarity(clean1, clean2) >= 80;
    };
    
    // 各原著者に対して一致する検索結果著者がいるかチェック
    const matchCount = normalizedOriginal.filter(origAuthor => 
      normalizedFound.some(foundAuthor => isNameMatch(origAuthor, foundAuthor))
    ).length;
    
    // 半数以上の著者が一致すれば一致とみなす
    const matchRatio = matchCount / normalizedOriginal.length;
    const isMatch = matchRatio >= 0.5;
    
    console.log(`✅ 著者一致判定: ${matchCount}/${normalizedOriginal.length} (${(matchRatio * 100).toFixed(1)}%) → ${isMatch ? '一致' : '不一致'}`);
    
    return isMatch;
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

  // 年の比較（±1年の誤差を許容・安全な型チェック版）
  const compareYear = (originalYear, foundYear) => {
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

  // 色分け引用形式生成（一致部分を緑、不一致部分を赤で表示）
  const generateColoredCitation = (parsedInfo, mostSimilarResult, style = 'apa') => {
    // **検索結果を最優先**（入力情報は補完のみ）
    const title = mostSimilarResult?.title || parsedInfo?.title || '[Title unknown]';
    const authors = mostSimilarResult?.authors ? 
      (typeof mostSimilarResult.authors === 'string' ? 
        mostSimilarResult.authors.split(/[;,&]/).map(a => a.trim()).filter(a => a) : 
        mostSimilarResult.authors.map(a => typeof a === 'string' ? a : a.name).filter(a => a)
      ) : (parsedInfo?.authors || []);
    const year = mostSimilarResult?.year || parsedInfo?.year || 'n.d.';
    const journal = mostSimilarResult?.journal || parsedInfo?.journal || '';
    
    // 入力情報のみから取得（検索結果にはない詳細情報）
    const volume = parsedInfo?.volume || '';
    const issue = parsedInfo?.issue || '';
    const pages = parsedInfo?.pages || '';
    const publisher = parsedInfo?.publisher || '';
    const isBook = parsedInfo?.isBook || false;
    const doi = mostSimilarResult?.doi || parsedInfo?.doi || '';
    const isJapanese = parsedInfo?.language === 'japanese';
    
    // 一致状況を判定
    const authorMatch = compareAuthors(parsedInfo?.authors, authors);
    const titleMatch = compareFields(parsedInfo?.title, title);
    const journalMatch = compareFields(parsedInfo?.journal, journal);
    const yearMatch = compareYear(parsedInfo?.year, year);
    
    // 色分けヘルパー関数
    const colorize = (text, isMatch) => {
      const color = isMatch ? 'text-green-600' : 'text-red-600';
      return `<span class="${color}">${text}</span>`;
    };
    
    // スタイル別に色分け引用形式を生成
    switch (style) {
      case 'apa':
        return isJapanese ? 
          generateColoredJapaneseAPA(authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, authorMatch, yearMatch, titleMatch, journalMatch, colorize) :
          generateColoredEnglishAPA(authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, authorMatch, yearMatch, titleMatch, journalMatch, colorize);
      case 'mla':
        return generateColoredMLA(authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, isJapanese, authorMatch, yearMatch, titleMatch, journalMatch, colorize);
      case 'chicago':
        return generateColoredChicago(authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, isJapanese, authorMatch, yearMatch, titleMatch, journalMatch, colorize);
      default:
        return isJapanese ? 
          generateColoredJapaneseAPA(authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, authorMatch, yearMatch, titleMatch, journalMatch, colorize) :
          generateColoredEnglishAPA(authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, authorMatch, yearMatch, titleMatch, journalMatch, colorize);
    }
  };

  // 色分け日本語APA形式
  const generateColoredJapaneseAPA = (authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, authorMatch, yearMatch, titleMatch, journalMatch, colorize) => {
    let citation = '';
    
    // 著者名
    if (authors && authors.length > 0) {
      const cleanAuthors = authors.map(author => 
        author.replace(/[,，・•&;]/g, '').trim()
      ).filter(author => author.length > 0);
      
      const authorText = cleanAuthors.length <= 3 ? cleanAuthors.join('・') : cleanAuthors[0] + '・他';
      citation += colorize(authorText, authorMatch);
    } else {
      citation += colorize('[著者不明]', false);
    }
    
    // 年
    citation += ` (${colorize(year, yearMatch)})`;
    
    if (isBook) {
      // 書籍の場合
      citation += ` ${colorize(title, titleMatch)}`;
      if (publisher) {
        citation += ` ${publisher}`;
      }
    } else {
      // 雑誌論文の場合
      citation += ` ${colorize(title, titleMatch)}`;
      
      if (journal) {
        citation += ` ${colorize(journal, journalMatch)}`;
        
        // 巻号
        if (volume) {
          citation += `, ${volume}`;
          if (issue) {
            citation += `(${issue})`;
          }
        }
        
        // ページ
        if (pages) {
          citation += `, ${pages}.`;
        } else {
          citation += '.';
        }
      }
    }
    
    // DOI
    if (doi) {
      citation += ` https://doi.org/${doi.replace(/^doi:/, '')}`;
    }
    
    return citation;
  };

  // 色分け英語APA形式
  const generateColoredEnglishAPA = (authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, authorMatch, yearMatch, titleMatch, journalMatch, colorize) => {
    let citation = '';
    
    // 著者名
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
      } else if (cleanAuthors.length <= 20) {
        authorText = cleanAuthors.slice(0, -1).join(', ') + ', & ' + cleanAuthors[cleanAuthors.length - 1];
      } else {
        authorText = cleanAuthors.slice(0, 19).join(', ') + ', ... ' + cleanAuthors[cleanAuthors.length - 1];
      }
      citation += colorize(authorText, authorMatch);
    } else {
      citation += colorize('[Author unknown]', false);
    }
    
    // 年
    citation += ` (${colorize(year, yearMatch)})`;
    
    if (isBook) {
      // 書籍の場合
      citation += `. <em>${colorize(title, titleMatch)}</em>`;
      if (publisher) {
        citation += `. ${publisher}`;
      }
    } else {
      // 雑誌論文の場合
      citation += `. ${colorize(title, titleMatch)}`;
      
      if (journal) {
        citation += `. <em>${colorize(journal, journalMatch)}</em>`;
        
        // 巻号
        if (volume) {
          citation += `, <em>${volume}</em>`;
          if (issue) {
            citation += `(${issue})`;
          }
        }
        
        // ページ
        if (pages) {
          citation += `, ${pages}`;
        }
      }
    }
    
    // DOI
    if (doi) {
      citation += `. https://doi.org/${doi.replace(/^doi:/, '')}`;
    }
    
    return citation;
  };

  // 色分けMLA形式
  const generateColoredMLA = (authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, isJapanese, authorMatch, yearMatch, titleMatch, journalMatch, colorize) => {
    let citation = '';
    
    // 著者名
    if (authors && authors.length > 0) {
      const authorText = isJapanese ? authors.join('・') : (authors[0] + (authors.length > 1 ? ', et al.' : ''));
      citation += colorize(authorText, authorMatch);
    } else {
      citation += colorize('[Author unknown]', false);
    }
    
    if (isBook) {
      // 書籍の場合
      const formattedTitle = isJapanese ? title : `<em>${title}</em>`;
      citation += ` ${colorize(formattedTitle, titleMatch)}`;
      if (publisher) {
        citation += `, ${publisher}`;
      }
      citation += `, ${colorize(year, yearMatch)}`;
    } else {
      // 雑誌論文の場合
      citation += ` "${colorize(title, titleMatch)}."`;
      
      if (journal) {
        const formattedJournal = isJapanese ? journal : `<em>${journal}</em>`;
        citation += ` ${colorize(formattedJournal, journalMatch)}`;
        
        if (volume) {
          citation += `, vol. ${volume}`;
          if (issue) {
            citation += `, no. ${issue}`;
          }
        }
        
        citation += `, ${colorize(year, yearMatch)}`;
        
        if (pages) {
          citation += `, pp. ${pages}`;
        }
      }
    }
    
    // DOI
    if (doi) {
      citation += `, doi:${doi.replace(/^doi:/, '')}`;
    }
    
    return citation;
  };

  // 色分けChicago形式
  const generateColoredChicago = (authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, isJapanese, authorMatch, yearMatch, titleMatch, journalMatch, colorize) => {
    let citation = '';
    
    // 著者名
    if (authors && authors.length > 0) {
      const authorText = isJapanese ? authors.join('・') : (authors[0] + (authors.length > 1 ? ' et al.' : ''));
      citation += colorize(authorText, authorMatch);
    } else {
      citation += colorize('[Author unknown]', false);
    }
    
    if (isBook) {
      // 書籍の場合
      const formattedTitle = isJapanese ? title : `<em>${title}</em>`;
      citation += ` ${colorize(formattedTitle, titleMatch)}`;
      if (publisher) {
        citation += `. ${publisher}`;
      }
      citation += `, ${colorize(year, yearMatch)}`;
    } else {
      // 雑誌論文の場合
      citation += ` "${colorize(title, titleMatch)}."`;
      
      if (journal) {
        const formattedJournal = isJapanese ? journal : `<em>${journal}</em>`;
        citation += ` ${colorize(formattedJournal, journalMatch)}`;
        
        if (volume) {
          citation += ` ${volume}`;
          if (issue) {
            citation += `, no. ${issue}`;
          }
        }
        
        if (year) {
          citation += ` (${colorize(year, yearMatch)})`;
        }
        
        if (pages) {
          citation += `: ${pages}`;
        }
      }
    }
    
    // DOI
    if (doi) {
      citation += `. https://doi.org/${doi.replace(/^doi:/, '')}`;
    }
    
    return citation;
  };
  // 引用スタイル生成（検索結果優先版）
  const generateCitation = (parsedInfo, mostSimilarResult, style = 'apa') => {
    // **検索結果を最優先**（入力情報は補完のみ）
    const title = mostSimilarResult?.title || parsedInfo?.title || '[Title unknown]';
    const authors = mostSimilarResult?.authors ? 
      (typeof mostSimilarResult.authors === 'string' ? 
        mostSimilarResult.authors.split(/[;,&]/).map(a => a.trim()).filter(a => a) : 
        mostSimilarResult.authors.map(a => typeof a === 'string' ? a : a.name).filter(a => a)
      ) : (parsedInfo?.authors || []);
    const year = mostSimilarResult?.year || parsedInfo?.year || 'n.d.';
    const journal = mostSimilarResult?.journal || parsedInfo?.journal || '';
    
    // 入力情報のみから取得（検索結果にはない詳細情報）
    const volume = parsedInfo?.volume || '';
    const issue = parsedInfo?.issue || '';
    const pages = parsedInfo?.pages || '';
    const publisher = parsedInfo?.publisher || '';
    const isBook = parsedInfo?.isBook || false;
    const doi = mostSimilarResult?.doi || parsedInfo?.doi || '';
    const isJapanese = parsedInfo?.language === 'japanese';
    
    console.log('引用生成用データ:', {
      title: title.substring(0, 50) + '...',
      authors: authors.slice(0, 2),
      year,
      journal,
      isJapanese,
      source: mostSimilarResult?.source || 'input'
    });
    
    switch (style) {
      case 'apa':
        return isJapanese ? 
          generateJapaneseAPACitation(authors, year, title, journal, volume, issue, pages, publisher, isBook, doi) :
          generateEnglishAPACitation(authors, year, title, journal, volume, issue, pages, publisher, isBook, doi);
      case 'mla':
        return generateMLACitation(authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, isJapanese);
      case 'chicago':
        return generateChicagoCitation(authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, isJapanese);
      default:
        return isJapanese ? 
          generateJapaneseAPACitation(authors, year, title, journal, volume, issue, pages, publisher, isBook, doi) :
          generateEnglishAPACitation(authors, year, title, journal, volume, issue, pages, publisher, isBook, doi);
    }
  };

  // 日本語APA形式（日本心理学会準拠）
  const generateJapaneseAPACitation = (authors, year, title, journal, volume, issue, pages, publisher, isBook, doi) => {
    let citation = '';
    
    // 著者名（日本語スタイル：中黒区切り）
    if (authors && authors.length > 0) {
      const cleanAuthors = authors.map(author => 
        author.replace(/[,，・•&;]/g, '').trim()
      ).filter(author => author.length > 0);
      
      if (cleanAuthors.length <= 3) {
        citation += cleanAuthors.join('・'); // 中黒で区切り
      } else {
        citation += cleanAuthors[0] + '・他'; // 4名以上は「他」
      }
    } else {
      citation += '[著者不明]';
    }
    
    // 年（日本語スタイル）
    citation += ` (${year})`;
    
    if (isBook) {
      // 書籍の場合
      citation += ` ${title}`;
      
      if (publisher) {
        citation += ` ${publisher}`;
      }
    } else {
      // 雑誌論文の場合
      citation += ` ${title}`;
      
      if (journal) {
        citation += ` ${journal}`;
        
        // 巻号（日本語スタイル）
        if (volume) {
          citation += `, ${volume}`;
          if (issue) {
            citation += `(${issue})`;
          }
        }
        
        // ページ（日本語スタイル）
        if (pages) {
          citation += `, ${pages}.`;
        } else {
          citation += '.';
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
  const generateEnglishAPACitation = (authors, year, title, journal, volume, issue, pages, publisher, isBook, doi) => {
    let citation = '';
    
    // 著者名（英語APAスタイル）
    if (authors && authors.length > 0) {
      const cleanAuthors = authors.map(author => {
        // "Last, First" または "First Last" 形式を "Last, First Initial" に統一
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
      
      if (cleanAuthors.length === 1) {
        citation += cleanAuthors[0];
      } else if (cleanAuthors.length === 2) {
        citation += cleanAuthors.join(' & ');
      } else if (cleanAuthors.length <= 20) {
        citation += cleanAuthors.slice(0, -1).join(', ') + ', & ' + cleanAuthors[cleanAuthors.length - 1];
      } else {
        citation += cleanAuthors.slice(0, 19).join(', ') + ', ... ' + cleanAuthors[cleanAuthors.length - 1];
      }
    } else {
      citation += '[Author unknown]';
    }
    
    // 年
    citation += ` (${year})`;
    
    if (isBook) {
      // 書籍の場合：タイトルはイタリック
      citation += `. <em>${title}</em>`;
      
      if (publisher) {
        citation += `. ${publisher}`;
      }
    } else {
      // 雑誌論文の場合
      citation += `. ${title}`;
      
      if (journal) {
        // 雑誌名はイタリック
        citation += `. <em>${journal}</em>`;
        
        // 巻号
        if (volume) {
          citation += `, <em>${volume}</em>`;
          if (issue) {
            citation += `(${issue})`;
          }
        }
        
        // ページ
        if (pages) {
          citation += `, ${pages}`;
        }
      }
    }
    
    // DOI
    if (doi) {
      citation += `. https://doi.org/${doi.replace(/^doi:/, '')}`;
    }
    
    return citation;
  };

  // MLA形式（改良版）
  const generateMLACitation = (authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, isJapanese) => {
    let citation = '';
    
    // 著者名
    if (authors && authors.length > 0) {
      if (isJapanese) {
        citation += authors.join('・');
      } else {
        citation += authors[0];
        if (authors.length > 1) {
          citation += ', et al.';
        }
      }
    } else {
      citation += '[Author unknown]';
    }
    
    if (isBook) {
      // 書籍の場合
      const formattedTitle = isJapanese ? title : `<em>${title}</em>`;
      citation += ` ${formattedTitle}`;
      
      if (publisher) {
        citation += `, ${publisher}`;
      }
      
      citation += `, ${year}`;
    } else {
      // 雑誌論文の場合
      citation += ` "${title}."`;
      
      if (journal) {
        const formattedJournal = isJapanese ? journal : `<em>${journal}</em>`;
        citation += ` ${formattedJournal}`;
        
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
      }
    }
    
    // DOI
    if (doi) {
      citation += `, doi:${doi.replace(/^doi:/, '')}`;
    }
    
    return citation;
  };

  // Chicago形式（改良版）
  const generateChicagoCitation = (authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, isJapanese) => {
    let citation = '';
    
    // 著者名
    if (authors && authors.length > 0) {
      if (isJapanese) {
        citation += authors.join('・');
      } else {
        citation += authors[0];
        if (authors.length > 1) {
          citation += ' et al.';
        }
      }
    } else {
      citation += '[Author unknown]';
    }
    
    if (isBook) {
      // 書籍の場合
      const formattedTitle = isJapanese ? title : `<em>${title}</em>`;
      citation += ` ${formattedTitle}`;
      
      if (publisher) {
        citation += `. ${publisher}`;
      }
      
      citation += `, ${year}`;
    } else {
      // 雑誌論文の場合
      citation += ` "${title}."`;
      
      if (journal) {
        const formattedJournal = isJapanese ? journal : `<em>${journal}</em>`;
        citation += ` ${formattedJournal}`;
        
        if (volume) {
          citation += ` ${volume}`;
          if (issue) {
            citation += `, no. ${issue}`;
          }
        }
        
        if (year) {
          citation += ` (${year})`;
        }
        
        if (pages) {
          citation += `: ${pages}`;
        }
      }
    }
    
    // DOI
    if (doi) {
      citation += `. https://doi.org/${doi.replace(/^doi:/, '')}`;
    }
    
    return citation;
  };
  const parseMultipleLiterature = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    const literatures = [];
    
    lines.forEach((line, index) => {
      if (line.trim().length > 10) {
        const parsed = parseLiterature(line);
        literatures.push({
          id: index + 1,
          originalText: line,
          parsedInfo: parsed
        });
      }
    });

    return literatures;
  };

  // 文字列類似度計算（安全な型チェック版）
  const calculateSimilarity = (str1, str2) => {
    if (!str1 || !str2 || typeof str1 !== 'string' || typeof str2 !== 'string') {
      return 0;
    }
    
    const matrix = [];
    const m = str1.length;
    const n = str2.length;

    for (let i = 0; i <= m; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= n; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const distance = matrix[m][n];
    const maxLength = Math.max(m, n);
    return maxLength === 0 ? 100 : ((maxLength - distance) / maxLength) * 100;
  };

  // Semantic Scholar API検索（英語文献用・詳細エラーハンドリング版）
  const searchSemanticScholar = async (literature) => {
    try {
      const { title, authors, year } = literature.parsedInfo;
      let results = [];
      let errorDetails = null;
      
      console.log('=== Semantic Scholar検索開始 ===');
      console.log('文献情報:', { title, authors, year });

      // タイトル検索
      if (title) {
        try {
          console.log('Semantic Scholar タイトル検索実行中:', title);
          
          // Vercel API経由でリクエスト
          const query = title.replace(/[^\w\s]/g, ' ').trim();
          console.log('検索クエリ:', query);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          
          // Vercel API経由でリクエスト
          const response = await fetch(`/api/semantic-scholar?query=${encodeURIComponent(query)}&limit=10`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          console.log('Semantic Scholar レスポンス:', response.status, response.statusText);
          
          if (response.ok) {
            const data = await response.json();
            console.log('Semantic Scholar データ構造:', data);
            
            if (data.data && data.data.length > 0) {
              results.push(...data.data);
              console.log('✅ Semantic Scholar タイトル検索成功:', data.data.length, '件');
            } else {
              console.log('⚠️ Semantic Scholar: 検索結果が空');
              errorDetails = { type: 'no_results', message: '検索条件に一致する文献が見つかりませんでした' };
            }
          } else {
            // Vercel API経由のエラーレスポンス処理
            let errorResponse;
            try {
              errorResponse = await response.json();
            } catch {
              errorResponse = { error: await response.text() };
            }
            
            console.log('❌ Semantic Scholar HTTPエラー:', response.status, errorResponse);
            
            // 詳細なエラー分類
            if (response.status === 429) {
              errorDetails = { 
                type: 'rate_limit', 
                message: 'Semantic Scholar APIリクエスト制限に達しました。しばらく待ってから再試行してください。',
                status: response.status,
                details: errorResponse.error || errorResponse.details
              };
              console.log('⏰ Rate limit detected, waiting...');
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else if (response.status === 400) {
              errorDetails = { 
                type: 'bad_request', 
                message: '検索クエリが無効です。文献情報を確認してください。',
                status: response.status,
                details: errorResponse.error || errorResponse.details
              };
            } else if (response.status === 503) {
              errorDetails = { 
                type: 'service_unavailable', 
                message: 'Semantic Scholar APIが一時的に利用できません。',
                status: response.status,
                details: errorResponse.error || errorResponse.details
              };
            } else if (response.status >= 500) {
              errorDetails = { 
                type: 'server_error', 
                message: 'Semantic Scholar APIでサーバーエラーが発生しました。',
                status: response.status,
                details: errorResponse.error || errorResponse.details
              };
            } else {
              errorDetails = { 
                type: 'api_error', 
                message: `Semantic Scholar API エラー (${response.status}): ${errorResponse.error || response.statusText}`,
                status: response.status,
                details: errorResponse.error || errorResponse.details
              };
            }
          }
        } catch (error) {
          console.log('❌ Semantic Scholar タイトル検索エラー:', error.name, error.message);
          
          // ネットワークエラーの詳細分類
          if (error.name === 'AbortError') {
            errorDetails = { 
              type: 'timeout', 
              message: 'Semantic Scholar APIの応答がタイムアウトしました（10秒）。ネットワーク接続を確認してください。' 
            };
          } else if (error.message.includes('fetch')) {
            errorDetails = { 
              type: 'network_error', 
              message: 'ネットワーク接続エラーです。インターネット接続を確認してください。' 
            };
          } else {
            errorDetails = { 
              type: 'unknown_error', 
              message: `予期しないエラー: ${error.message}` 
            };
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
      }

      // 著者+年検索（タイトル検索が失敗した場合のバックアップ）
      if (authors.length > 0 && year && results.length < 2) {
        try {
          const authorName = authors[0].split(',')[0].trim();
          const query = `${authorName} ${year}`;
          console.log('Semantic Scholar 著者+年検索実行中:', query);
          
          const response = await fetch(`/api/semantic-scholar?query=${encodeURIComponent(query)}&limit=5`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.data && data.data.length > 0) {
              results.push(...data.data);
              console.log('✅ Semantic Scholar 著者+年検索成功:', data.data.length, '件');
            }
          }
        } catch (error) {
          console.log('❌ Semantic Scholar 著者+年検索エラー:', error.message);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 重複除去と結果整形
      const uniqueResults = [];
      const seenIds = new Set();
      
      for (const item of results) {
        const itemId = item.paperId || item.externalIds?.DOI || item.title;
        if (itemId && !seenIds.has(itemId)) {
          seenIds.add(itemId);
          
          // より包括的な雑誌名取得
          const journalName = item.venue || 
                             item.journal || 
                             item.publicationVenue?.name || 
                             item.container?.title ||
                             '';
          
          uniqueResults.push({
            title: item.title || '',
            authors: item.authors || [],
            year: item.publicationDate ? new Date(item.publicationDate).getFullYear().toString() : '',
            doi: item.externalIds?.DOI || '',
            url: item.url || `https://www.semanticscholar.org/paper/${item.paperId}`,
            citationCount: item.citationCount || 0,
            abstract: item.abstract || '',
            journal: journalName,
            source: 'Semantic Scholar',
            errorDetails: errorDetails
          });
        }
      }

      console.log('Semantic Scholar最終結果数:', uniqueResults.length);
      if (uniqueResults.length === 0 && errorDetails) {
        console.log('⚠️ Semantic Scholar検索失敗:', errorDetails.message);
        // エラー情報を含む空の結果を返す
        return [{ source: 'Semantic Scholar', errorDetails }];
      }
      
      return uniqueResults.slice(0, 8);

    } catch (error) {
      console.error('❌ Semantic Scholar検索システムエラー:', error);
      
      // システムエラー情報を含む結果を返す
      return [{
        source: 'Semantic Scholar',
        errorDetails: {
          type: 'system_error',
          message: `システムエラーが発生しました: ${error.message}`
        }
      }];
    }
  };

  // CiNii OpenSearch API検索（実際のAPI対応版・詳細エラーハンドリング）
  const searchCiNii = async (literature) => {
    try {
      const { title, authors, year } = literature.parsedInfo;
      let errorDetails = null;
      
      console.log('=== CiNii OpenSearch検索開始（実際のAPI）===');
      console.log('日本語文献:', { title, authors, year });
      
      let query = '';
      if (title) {
        query = title.replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, ' ').trim();
      }
      if (authors && authors.length > 0) {
        query += ` ${authors[0].replace(/[・•]/g, ' ')}`;
      }
      
      if (!query) {
        console.log('❌ CiNii: 検索クエリが空');
        errorDetails = { type: 'empty_query', message: '検索可能な文献情報が不足しています' };
        return [{ source: 'CiNii', errorDetails }];
      }

      console.log('CiNii検索クエリ:', query);
      
      // Vercel API経由でCiNii検索
      const searchUrl = `/api/cinii?q=${encodeURIComponent(query)}&count=10&start=1&lang=ja&format=rss`;
      console.log('CiNii API URL:', searchUrl);
      
      try {
        // Vercel API経由でリクエスト
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // タイムアウト10秒
        
        const response = await fetch(searchUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/xml, text/xml'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const xmlText = await response.text();
          console.log('✅ CiNii API XML レスポンス受信');
          console.log('レスポンス長:', xmlText.length);
          
          // XML解析
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
          
          // parserErrorチェック
          const parseError = xmlDoc.getElementsByTagName('parsererror');
          if (parseError.length > 0) {
            console.error('XML解析エラー:', parseError[0].textContent);
            errorDetails = { 
              type: 'xml_parse_error', 
              message: 'CiNii APIからの応答の解析に失敗しました' 
            };
            throw new Error('XML解析エラー');
          }
          
          // RSS形式の解析
          const items = xmlDoc.getElementsByTagName('item');
          const results = [];
          
          console.log(`CiNii API検索結果: ${items.length}件`);
          
          if (items.length === 0) {
            errorDetails = { 
              type: 'no_results', 
              message: 'CiNiiで該当する日本語文献が見つかりませんでした' 
            };
          }
          
          for (let i = 0; i < Math.min(items.length, 10); i++) {
            const item = items[i];
            
            // 各要素を安全に取得
            const getElementText = (tagName, datatype = null) => {
              const elements = item.getElementsByTagName(tagName);
              if (datatype) {
                for (let j = 0; j < elements.length; j++) {
                  if (elements[j].getAttribute('rdf:datatype') === datatype) {
                    return elements[j].textContent.trim();
                  }
                }
                return '';
              }
              return elements.length > 0 ? elements[0].textContent.trim() : '';
            };

            // 複数著者の取得（CiNii改良版）
            const getAllElementsText = (tagName) => {
              const elements = item.getElementsByTagName(tagName);
              const result = [];
              for (let j = 0; j < elements.length; j++) {
                const text = elements[j].textContent.trim();
                if (text) result.push(text);
              }
              return result;
            };
            
            const itemTitle = getElementText('title');
            const link = getElementText('link');
            const creators = getAllElementsText('dc:creator'); // 複数著者対応
            const publicationName = getElementText('prism:publicationName'); // 正しい雑誌名フィールド
            const publicationDate = getElementText('prism:publicationDate');
            const doi = getElementText('dc:identifier', 'cir:DOI'); // DOI取得
            
            if (itemTitle) {
              // 年の抽出
              let extractedYear = '';
              if (publicationDate) {
                const yearMatch = publicationDate.match(/(\d{4})/);
                if (yearMatch) {
                  extractedYear = yearMatch[1];
                }
              }
              
              results.push({
                title: itemTitle,
                authors: creators.length > 0 ? creators : [], // 複数著者配列
                year: extractedYear || '',
                journal: publicationName || '', // 正しい雑誌名フィールドを使用
                doi: doi || '', // DOI情報追加
                url: link,
                source: 'CiNii',
                errorDetails: errorDetails
              });
              
              console.log(`CiNii結果 ${i + 1}:`, {
                title: itemTitle.substring(0, 50) + '...',
                creators: creators, // 複数著者表示
                journal: publicationName, // 修正されたフィールド
                year: extractedYear,
                doi: doi ? '有' : '無'
              });
            }
          }
          
          console.log('✅ CiNii API検索成功:', results.length, '件');
          return results;
          
        } else {
          // Vercel API経由のエラーレスポンス処理
          let errorResponse;
          try {
            errorResponse = await response.json();
          } catch {
            errorResponse = { error: await response.text() };
          }
          
          console.log('❌ CiNii API HTTPエラー:', response.status, errorResponse);
          
          // HTTPエラーの詳細分類
          if (response.status === 429) {
            errorDetails = { 
              type: 'rate_limit', 
              message: 'CiNii APIのリクエスト制限に達しました。しばらく待ってから再試行してください。',
              status: response.status,
              details: errorResponse.error || errorResponse.details 
            };
          } else if (response.status === 400) {
            errorDetails = { 
              type: 'bad_request', 
              message: 'CiNii APIに送信したクエリが無効です。検索条件を確認してください。',
              status: response.status,
              details: errorResponse.error || errorResponse.details
            };
          } else if (response.status === 503) {
            errorDetails = { 
              type: 'service_unavailable', 
              message: 'CiNii APIが一時的に利用できません。メンテナンス中の可能性があります。',
              status: response.status,
              details: errorResponse.error || errorResponse.details
            };
          } else if (response.status >= 500) {
            errorDetails = { 
              type: 'server_error', 
              message: 'CiNii APIでサーバーエラーが発生しました。',
              status: response.status,
              details: errorResponse.error || errorResponse.details
            };
          } else {
            errorDetails = { 
              type: 'api_error', 
              message: `CiNii API エラー (${response.status}): ${errorResponse.error || response.statusText}`,
              status: response.status,
              details: errorResponse.error || errorResponse.details
            };
          }
          
          // HTTPエラーの場合、フォールバック模擬データを返す
          return await generateCiNiiFallbackData(literature, errorDetails);
        }
        
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') {
          console.log('⏰ CiNii検索タイムアウト（10秒）');
          errorDetails = { 
            type: 'timeout', 
            message: 'CiNii APIの応答がタイムアウトしました（10秒）。ネットワーク接続が不安定な可能性があります。' 
          };
        } else {
          console.log('❌ CiNii API通信エラー:', fetchError.message);
          
          // Vercel API経由でのエラー分類
          if (fetchError.message.includes('fetch')) {
            errorDetails = { 
              type: 'network_error', 
              message: 'ネットワーク接続エラーです。インターネット接続を確認してください。' 
            };
          } else {
            errorDetails = { 
              type: 'unknown_error', 
              message: `予期しないエラー: ${fetchError.message}` 
            };
          }
        }
        
        // エラーの場合、フォールバック模擬データを返す
        return await generateCiNiiFallbackData(literature, errorDetails);
      }
      
    } catch (error) {
      console.log('❌ CiNii検索システムエラー:', error.message);
      const errorDetails = { 
        type: 'system_error', 
        message: `システムエラーが発生しました: ${error.message}` 
      };
      return await generateCiNiiFallbackData(literature, errorDetails);
    }
  };

  // CiNiiフォールバック模擬データ生成（エラー詳細対応版）
  const generateCiNiiFallbackData = async (literature, errorDetails = null) => {
    const { title, authors, year } = literature.parsedInfo;
    console.log('🔄 CiNiiフォールバック模擬データ生成中...');
    
    const mockResults = [];
    
    if (title) {
      const keywords = [
        '研究', '分析', '調査', '検討', '考察', '実験', '評価', '測定', '観察',
        '心理', '教育', '社会', '経済', '技術', '情報', 'システム', '医療', '環境',
        'ソーシャルメディア', 'SNS', 'AI', '人工知能', 'IoT', 'DX', 'デジタル'
      ];
      
      const hasRelevantKeyword = keywords.some(keyword => title.includes(keyword));
      
      if (hasRelevantKeyword || title.length > 5) {
        mockResults.push({
          title: title.includes('研究') ? title : `${title}に関する研究`,
          authors: authors.length > 0 ? authors : ['模擬著者太郎'],
          year: year || '2022',
          journal: title.includes('心理') ? '心理学研究' : 
                  title.includes('教育') ? '教育工学研究' :
                  title.includes('社会') ? '社会学評論' :
                  title.includes('情報') ? '情報処理学会論文誌' : '学術研究報告',
          doi: '', // フォールバックではDOIなし
          url: 'https://cir.nii.ac.jp/crid/fallback',
          source: 'CiNii',
          errorDetails: errorDetails || { 
            type: 'fallback', 
            message: 'CiNii APIの制限により、フォールバック検索を実行しました' 
          }
        });
      }
    }
    
    // エラー詳細がある場合は、エラー情報のみの結果も追加
    if (errorDetails && mockResults.length === 0) {
      mockResults.push({
        source: 'CiNii',
        errorDetails: errorDetails
      });
    }
    
    console.log(`✅ CiNiiフォールバック模擬データ: ${mockResults.length}件`);
    return mockResults;
  };

  // CrossRef API検索（Vercel API経由版）
  const searchCrossRef = async (literature) => {
    try {
      const { title, authors, year, doi } = literature.parsedInfo;
      let results = [];
      let errorDetails = null;
      
      console.log('=== CrossRef検索開始 (Vercel API経由) ===');
      console.log('文献情報:', { title, authors, year, doi });

      // DOI検索
      if (doi) {
        try {
          console.log('DOI検索実行中:', doi);
          const doiQuery = doi.replace(/^doi:/, '');
          
          const response = await fetch(`/api/crossref?doi=${encodeURIComponent(doiQuery)}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.message) {
              results.push(data.message);
              console.log('✅ DOI検索成功');
              return results;
            }
          } else {
            const errorText = await response.text();
            console.log('❌ CrossRef DOI検索エラー:', response.status, errorText);
            
            if (response.status === 429) {
              errorDetails = { 
                type: 'rate_limit', 
                message: 'CrossRef APIのリクエスト制限に達しました。',
                status: response.status 
              };
            } else if (response.status >= 500) {
              errorDetails = { 
                type: 'server_error', 
                message: 'CrossRef APIでサーバーエラーが発生しました。',
                status: response.status 
              };
            }
          }
        } catch (error) {
          console.log('❌ DOI検索エラー:', error.message);
          errorDetails = { 
            type: 'network_error', 
            message: `DOI検索でネットワークエラーが発生しました: ${error.message}` 
          };
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // タイトル検索
      if (title) {
        try {
          console.log('タイトル検索実行中:', title);
          const simpleQuery = title.replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, ' ').trim();
          
          const response = await fetch(`/api/crossref?query=${encodeURIComponent(simpleQuery)}&rows=10`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.message && data.message.items) {
              results.push(...data.message.items);
              console.log('✅ CrossRef タイトル検索成功:', data.message.items.length, '件');
            }
          } else {
            const errorText = await response.text();
            console.log('❌ CrossRef タイトル検索エラー:', response.status, errorText);
            
            if (!errorDetails) { // DOI検索でエラーがなかった場合のみ設定
              if (response.status === 429) {
                errorDetails = { 
                  type: 'rate_limit', 
                  message: 'CrossRef APIのリクエスト制限に達しました。',
                  status: response.status 
                };
              } else if (response.status >= 500) {
                errorDetails = { 
                  type: 'server_error', 
                  message: 'CrossRef APIでサーバーエラーが発生しました。',
                  status: response.status 
                };
              }
            }
          }
        } catch (error) {
          console.log('❌ タイトル検索エラー:', error.message);
          if (!errorDetails) {
            errorDetails = { 
              type: 'network_error', 
              message: `タイトル検索でネットワークエラーが発生しました: ${error.message}` 
            };
          }
        }
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // 重複除去
      const uniqueResults = [];
      const seenDOIs = new Set();
      
      for (const item of results) {
        const itemDOI = item.DOI;
        if (itemDOI && !seenDOIs.has(itemDOI)) {
          seenDOIs.add(itemDOI);
          uniqueResults.push(item);
        } else if (!itemDOI) {
          uniqueResults.push(item);
        }
      }

      console.log('CrossRef検索結果数:', uniqueResults.length);
      
      // エラーがあるが結果もある場合
      if (errorDetails && uniqueResults.length > 0) {
        uniqueResults[0].errorDetails = errorDetails;
      }
      // エラーがあり結果がない場合
      else if (errorDetails && uniqueResults.length === 0) {
        return [{ source: 'CrossRef', errorDetails }];
      }
      
      return uniqueResults.slice(0, 8);

    } catch (error) {
      console.error('❌ CrossRef検索システムエラー:', error);
      return [{
        source: 'CrossRef',
        errorDetails: {
          type: 'system_error',
          message: `CrossRefシステムエラー: ${error.message}`
        }
      }];
    }
  };

  // 言語別検索戦略（API失敗対応版）
  const searchByLanguage = async (literature) => {
    const { language } = literature.parsedInfo;
    let results = [];
    
    console.log(`=== ${language === 'japanese' ? '日本語' : '英語'}文献の検索開始 ===`);
    
    if (language === 'japanese') {
      console.log('🇯🇵 日本語文献 - CiNii最優先検索');
      
      // CiNii OpenSearch API検索（最優先）
      const ciNiiResults = await searchCiNii(literature);
      results.push(...ciNiiResults);
      
      console.log(`CiNii検索完了: ${ciNiiResults.length}件`);
      
      // CiNiiで十分な結果が得られた場合は、それを重視
      if (ciNiiResults.length >= 2) {
        console.log('✅ CiNiiで十分な結果が得られたため、CiNii結果を重視');
        return results; // CiNiiの結果のみを使用
      }
      
      // CiNii結果が不足の場合のみ、他のAPIで補完
      console.log('CiNii結果不足、CrossRefで補完検索');
      await new Promise(resolve => setTimeout(resolve, 300));
      const crossRefResults = await searchCrossRef(literature);
      results.push(...crossRefResults);
      
      // 日本語文献の場合、Semantic Scholarは補助的に使用
      if (results.length < 3) {
        console.log('結果がまだ不足、Semantic Scholarでも検索（日本人著者の英語論文の可能性）');
        await new Promise(resolve => setTimeout(resolve, 300));
        const semanticResults = await searchSemanticScholar(literature);
        results.push(...semanticResults);
      }
      
    } else {
      console.log('🌍 英語文献 - Semantic Scholar + CrossRef並行検索');
      
      // 英語文献の場合、Semantic ScholarとCrossRefを並行実行
      const searchPromises = [
        searchSemanticScholar(literature),
        searchCrossRef(literature)
      ];
      
      try {
        const searchResults = await Promise.allSettled(searchPromises);
        
        // Semantic Scholar結果
        if (searchResults[0].status === 'fulfilled') {
          const semanticResults = searchResults[0].value || [];
          results.push(...semanticResults);
          console.log(`✅ Semantic Scholar検索完了: ${semanticResults.length}件`);
        } else {
          console.log('❌ Semantic Scholar検索失敗:', searchResults[0].reason);
        }
        
        // CrossRef結果
        if (searchResults[1].status === 'fulfilled') {
          const crossRefResults = searchResults[1].value || [];
          results.push(...crossRefResults);
          console.log(`✅ CrossRef検索完了: ${crossRefResults.length}件`);
        } else {
          console.log('❌ CrossRef検索失敗:', searchResults[1].reason);
        }
        
        // 両方失敗した場合の警告
        if (results.length === 0) {
          console.log('⚠️ 全ての英語文献検索APIが失敗しました');
          console.log('💡 ネットワーク接続またはAPI制限が原因の可能性があります');
        }
        
      } catch (error) {
        console.log('❌ 並行検索中にエラー:', error);
        
        // フォールバック: 順次実行
        console.log('🔄 フォールバック: 順次検索を実行');
        const semanticResults = await searchSemanticScholar(literature);
        results.push(...semanticResults);
        
        if (results.length < 5) {
          await new Promise(resolve => setTimeout(resolve, 300));
          const crossRefResults = await searchCrossRef(literature);
          results.push(...crossRefResults);
        }
      }
    }
    
    console.log(`検索完了 - 総結果数: ${results.length}件`);
    return results;
  };

  // 検証結果の評価（タイトル一致前提・ペナルティシステム）
  const evaluateResults = (literature, searchResults) => {
    const { title, authors, year, doi, journal } = literature.parsedInfo;
    
    console.log('=== 新しい評価システム開始（タイトル一致前提） ===');
    console.log('対象文献:', { title, authors, year, doi, journal });
    console.log('検索結果数:', searchResults.length);
    
    if (searchResults.length === 0) {
      return {
        status: 'not_found',
        similarityScore: 0,
        assessment: 'APIで該当文献が見つかりませんでした。文献が存在しない可能性があります。',
        mostSimilarResult: null,
        penalties: []
      };
    }

    let bestMatch = null;
    let bestScore = 0;
    let bestPenalties = [];

    searchResults.forEach((result, index) => {
      console.log(`--- 結果 ${index + 1} の評価 (${result.source || 'Unknown'}) ---`);
      
      // API別レスポンス形式の統一処理
      let resultTitle = '';
      let resultAuthors = [];
      let resultYear = '';
      let resultDOI = '';
      let resultJournal = '';
      let resultSource = result.source || 'Unknown';
      
      if (result.source === 'Semantic Scholar') {
        resultTitle = result.title || '';
        resultAuthors = result.authors || [];
        resultYear = result.year || '';
        resultDOI = result.doi || '';
        resultJournal = result.journal || '';
      } else if (result.source === 'CiNii') {
        resultTitle = result.title || '';
        resultAuthors = result.authors || [];
        resultYear = result.year || '';
        resultDOI = result.doi || '';
        resultJournal = result.journal || '';
      } else {
        // CrossRef形式
        resultTitle = Array.isArray(result.title) ? result.title[0] : (result.title || '');
        resultAuthors = result.author || [];
        resultYear = result.published ? 
          result.published['date-parts'][0][0].toString() : 
          (result['published-print'] ? result['published-print']['date-parts'][0][0].toString() : '');
        resultDOI = result.DOI || '';
        resultJournal = result['container-title'] ? result['container-title'][0] : '';
      }

      console.log('結果詳細:', {
        title: resultTitle,
        authorsCount: resultAuthors.length,
        year: resultYear,
        doi: resultDOI,
        journal: resultJournal,
        source: resultSource
      });

      // Step 1: タイトル類似度計算（最重要・安全な型チェック版）
      let titleSimilarity = 0;
      if (title && resultTitle && typeof title === 'string' && typeof resultTitle === 'string') {
        const normalizeTitle = (str) => {
          if (!str || typeof str !== 'string') return '';
          return str.toLowerCase().replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, ' ');
        };
        
        titleSimilarity = calculateSimilarity(
          normalizeTitle(title),
          normalizeTitle(resultTitle)
        );
        
        // キーワードマッチングボーナス
        const titleWords = normalizeTitle(title)
          .split(/\s+/)
          .filter(w => w.length > 2);
        const resultTitleLower = normalizeTitle(resultTitle);
        
        if (titleWords.length > 0) {
          const matchingWords = titleWords.filter(word => resultTitleLower.includes(word));
          if (matchingWords.length > 0) {
            const keywordBonus = (matchingWords.length / titleWords.length) * 20;
            titleSimilarity += keywordBonus;
          }
        }
        
        titleSimilarity = Math.min(titleSimilarity, 100);
        console.log(`タイトル類似度: ${titleSimilarity}%`);
      } else {
        console.log('❌ タイトル情報が不足または無効:', { title: typeof title, resultTitle: typeof resultTitle });
      }

      // タイトル類似度が70%未満の場合、この結果は無視
      if (titleSimilarity < 70) {
        console.log(`❌ タイトル類似度不足（${titleSimilarity}%）- スキップ`);
        return;
      }

      // Step 2: DOI完全一致チェック（最優先・安全な型チェック版）
      let doiMatch = false;
      if (doi && resultDOI && typeof doi === 'string' && typeof resultDOI === 'string') {
        const normalizedDoi = doi.replace(/^doi:/, '').toLowerCase();
        const normalizedResultDoi = resultDOI.toLowerCase();
        if (normalizedDoi === normalizedResultDoi) {
          doiMatch = true;
          console.log('✅ DOI完全一致! 信頼度100%');
        }
      }

      // Step 3: ペナルティシステム（学術的誠実性チェック）
      const penalties = [];
      let penaltyScore = 0;

      // 著者ペナルティチェック
      if (authors.length > 0 && resultAuthors.length > 0) {
        const authorMatch = compareAuthors(authors, resultAuthors);
        if (!authorMatch) {
          penalties.push('著者不一致');
          penaltyScore += 25; // 重大なペナルティ
          console.log('⚠️ 著者不一致 - ペナルティ25点');
        } else {
          console.log('✅ 著者一致');
        }
      }

      // 雑誌名ペナルティチェック
      if (journal && resultJournal) {
        const journalMatch = compareFields(journal, resultJournal);
        if (!journalMatch) {
          penalties.push('雑誌名不一致');
          penaltyScore += 20; // 重要なペナルティ
          console.log('⚠️ 雑誌名不一致 - ペナルティ20点');
        } else {
          console.log('✅ 雑誌名一致');
        }
      }

      // 年ペナルティチェック（軽微）
      if (year && resultYear) {
        const yearDiff = Math.abs(parseInt(year) - parseInt(resultYear));
        if (yearDiff > 1) {
          penalties.push('発行年不一致');
          penaltyScore += 10; // 軽微なペナルティ
          console.log(`⚠️ 発行年不一致（${yearDiff}年差） - ペナルティ10点`);
        } else {
          console.log('✅ 発行年一致');
        }
      }

      // Step 4: 最終スコア計算
      let finalScore;
      if (doiMatch) {
        finalScore = 100 - penaltyScore; // DOI一致の場合はペナルティのみ減点
      } else {
        finalScore = titleSimilarity - penaltyScore; // タイトル類似度からペナルティを減点
      }

      // ソースボーナス（軽微）
      if (literature.parsedInfo.language === 'japanese' && result.source === 'CiNii') {
        finalScore += 5; // CiNiiボーナス
      } else if (result.source === 'Semantic Scholar') {
        finalScore += 3; // 高品質メタデータボーナス
      }

      finalScore = Math.max(0, Math.min(finalScore, 100)); // 0-100の範囲に制限

      console.log(`最終スコア: ${finalScore}% (タイトル: ${titleSimilarity}% - ペナルティ: ${penaltyScore}%)`);
      console.log(`ペナルティ内容:`, penalties);

      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestPenalties = penalties;
        bestMatch = {
          title: resultTitle || '',
          authors: Array.isArray(resultAuthors) ? 
            resultAuthors.map(a => {
              if (typeof a === 'string') return a;
              if (result.source === 'Semantic Scholar' && a && a.name) return a.name;
              if (a && typeof a === 'object') return `${a.family || ''}, ${a.given || ''}`.trim();
              return '';
            }).filter(a => a).join('; ') : (resultAuthors || ''),
          year: resultYear || '',
          journal: resultJournal || '',
          doi: resultDOI || '',
          source: resultSource,
          url: result.url || '',
          citationCount: result.citationCount || 0,
          titleSimilarity: Math.round(titleSimilarity),
          penaltyScore: penaltyScore,
          penalties: penalties,
          weightedScore: Math.round(finalScore)
        };
      }
    });

    // Step 5: 最終判定
    let status, assessment;
    console.log(`=== 最終評価: ${bestScore}% ===`);
    console.log(`ペナルティ: ${bestPenalties.join(', ') || 'なし'}`);
    
    if (bestScore >= 85) {
      status = 'found';
      assessment = bestPenalties.length === 0 ? 
        '高い信頼度で一致する文献が見つかりました。' :
        `文献は見つかりましたが、以下の不一致があります: ${bestPenalties.join('、')}。文献を再確認してください。`;
    } else if (bestScore >= 60) {
      status = 'similar';
      assessment = bestPenalties.length === 0 ?
        '類似する文献が見つかりました。詳細を確認してください。' :
        `類似文献が見つかりましたが、重要な不一致があります: ${bestPenalties.join('、')}。引用情報に誤りがある可能性があります。`;
    } else if (bestScore >= 30) {
      status = 'similar';
      assessment = `タイトルは類似していますが、多くの不一致があります: ${bestPenalties.join('、')}。文献情報を詳しく確認してください。`;
    } else {
      status = 'not_found';
      assessment = 'タイトルが一致する信頼できる文献が見つかりませんでした。';
    }

    return {
      status,
      similarityScore: Math.round(bestScore),
      assessment,
      mostSimilarResult: bestMatch,
      penalties: bestPenalties
    };
  };

  // 検索URL生成
  const generateSearchUrls = (literature) => {
    // literature.parsedInfo が undefined の場合の安全な処理
    if (!literature || !literature.parsedInfo) {
      console.warn('generateSearchUrls: literature.parsedInfo が undefined です');
      return {
        scholar: 'https://scholar.google.com/scholar',
        crossRef: 'https://search.crossref.org/search/works',
        ciNii: 'https://cir.nii.ac.jp/all',
        jStage: 'https://www.jstage.jst.go.jp/result/global',
        semanticScholar: 'https://www.semanticscholar.org/search'
      };
    }

    const { title, authors, year } = literature.parsedInfo;
    const query = [title, authors?.[0], year].filter(Boolean).join(' ');
    
    return {
      scholar: `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`,
      crossRef: `https://search.crossref.org/search/works?q=${encodeURIComponent(query)}&from_ui=yes`,
      ciNii: `https://cir.nii.ac.jp/all?q=${encodeURIComponent(query)}`,
      jStage: `https://www.jstage.jst.go.jp/result/global/-char/ja?globalSearchKey=${encodeURIComponent(query)}`,
      semanticScholar: `https://www.semanticscholar.org/search?q=${encodeURIComponent(query)}`
    };
  };

  // メイン検証処理
  const verifyLiterature = async () => {
    if (!inputText.trim()) return;

    setIsProcessing(true);
    setResults([]);
    setStatistics({ found: 0, similar: 0, notFound: 0 });

    const literatures = parseMultipleLiterature(inputText);
    const newResults = [];
    const stats = { found: 0, similar: 0, notFound: 0 };

    for (let i = 0; i < literatures.length; i++) {
      setCurrentProcessing(i + 1);
      const literature = literatures[i];

      try {
        console.log(`\n📚 文献 ${i + 1} の処理開始`);
        console.log('元テキスト:', literature.originalText);
        console.log('解析結果:', literature.parsedInfo);

        if (i > 0) {
          console.log('⏳ API制限のため1秒待機中...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const searchResults = await searchByLanguage(literature);
        console.log(`🔍 ${literature.parsedInfo.language === 'japanese' ? 'CiNii重視検索' : 'Semantic Scholar+CrossRef'}検索完了: ${searchResults.length}件の結果`);
        
        const evaluation = evaluateResults(literature, searchResults);
        console.log(`📊 評価完了: ${evaluation.status} (${evaluation.similarityScore}%)`);
        
        // API検索エラーがある場合、評価メッセージを調整
        const hasSearchErrors = searchResults.some(r => r.errorDetails);
        if (hasSearchErrors && evaluation.status === 'not_found') {
          const errorSources = searchResults.filter(r => r.errorDetails).map(r => r.source);
          evaluation.assessment = `一部のAPI検索でエラーが発生しました（${errorSources.join(', ')}）。利用可能な検索結果では該当文献が見つかりませんでした。`;
        }
        
        const searchUrls = generateSearchUrls(literature);

        const result = {
          ...literature,
          evaluation,
          searchUrls,
          searchResults: searchResults.slice(0, 3)
        };

        newResults.push(result);
        stats[evaluation.status === 'found' ? 'found' : 
              evaluation.status === 'similar' ? 'similar' : 'notFound']++;

        setResults([...newResults]);
        setStatistics({ ...stats });
        console.log(`✅ 文献 ${i + 1} 処理完了\n`);

      } catch (error) {
        console.error(`❌ 文献 ${i + 1} でエラー発生:`, error);
        
        // エラーの種類に応じてメッセージを分類
        let errorMessage = 'システムエラーが発生しました。';
        
        if (error.message.includes('fetch')) {
          errorMessage = 'ネットワーク接続エラーが発生しました。インターネット接続を確認してください。';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'API応答のタイムアウトが発生しました。しばらく待ってから再試行してください。';
        } else if (error.message.includes('CORS')) {
          errorMessage = 'ブラウザのセキュリティ制限によりAPIアクセスが拒否されました。';
        } else if (error.message.includes('rate limit') || error.message.includes('429')) {
          errorMessage = 'APIリクエスト制限に達しました。しばらく待ってから再試行してください。';
        } else {
          errorMessage = `予期しないエラーが発生しました: ${error.message}`;
        }
        
        const result = {
          ...literature,
          evaluation: {
            status: 'not_found',
            similarityScore: 0,
            assessment: errorMessage,
            mostSimilarResult: null
          },
          searchUrls: generateSearchUrls(literature),
          searchResults: [{
            source: 'System',
            errorDetails: {
              type: 'system_error',
              message: errorMessage
            }
          }]
        };

        newResults.push(result);
        stats.notFound++;
        setResults([...newResults]);
        setStatistics({ ...stats });
      }
    }

    setIsProcessing(false);
    setCurrentProcessing(0);
  };

  const sampleText = `Hunt, M. G., Marx, R., Lipson, C., & Young, J. (2018). No more FOMO: Limiting social media decreases loneliness and depression. Journal of Social and Clinical Psychology, 37(10), 751-768.
LeCun, Y., Bengio, Y., & Hinton, G. (2015). Deep learning. Nature, 521(7553), 436-444.
田中太郎、山田花子（2022）「大学生のソーシャルメディア利用と心理的適応に関する研究」心理学研究、93巻4号、pp.234-248
佐藤一郎・鈴木次郎（2021）『日本におけるデジタル教育の現状と課題』教育工学研究、第45巻第2号、pp.123-145
Miller, G. A. (1956). The magical number seven, plus or minus two: Some limits on our capacity for processing information. Psychological Review, 63(2), 81-97.
中島義明編（2019）『心理学辞典』有斐閣
Kahneman, D. (2011). Thinking, fast and slow. Farrar, Straus and Giroux.
坂部創一, 山崎秀夫 (2019). インターネット利用が新型うつ傾向へ及ぼす悪影響と予防策の縦断研究. キャリア教育研究, 33, 139-146.`;

  const getStatusIcon = (status) => {
    switch (status) {
      case 'found': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'similar': return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      default: return <XCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'found': return 'bg-green-50 border-green-200';
      case 'similar': return 'bg-yellow-50 border-yellow-200';
      default: return 'bg-red-50 border-red-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">文献一括検証システム</h1>
              <p className="text-gray-600">日本語文献重視・雑誌名照合対応の学術文献検証ツール</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              不規則引用形式対応
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              最長フレーズ方式タイトル抽出
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              高速API検索（日本語：CiNii最優先、英語：Semantic Scholar）+ 雑誌名照合
            </span>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            🚀 CiNii重視 & 雑誌名照合で日本語文献の検証精度を大幅向上
          </div>
        </div>

        {/* 入力セクション */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            文献リストを入力してください（1行に1件）
          </label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="文献情報を1行に1件ずつ入力..."
            className="w-full h-48 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="flex justify-between items-center mt-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setInputText(sampleText)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                サンプルデータを挿入
              </button>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">引用スタイル:</label>
                <select
                  value={citationStyle}
                  onChange={(e) => setCitationStyle(e.target.value)}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="apa">APA</option>
                  <option value="mla">MLA</option>
                  <option value="chicago">Chicago</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                {inputText.split('\n').filter(line => line.trim()).length} 件の文献
              </span>
              <button
                onClick={verifyLiterature}
                disabled={!inputText.trim() || isProcessing}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    検証中... ({currentProcessing}/{inputText.split('\n').filter(line => line.trim()).length})
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    一括検証
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 統計表示 */}
        {results.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">発見</p>
                  <p className="text-2xl font-bold text-green-600">{statistics.found}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">類似</p>
                  <p className="text-2xl font-bold text-yellow-600">{statistics.similar}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-yellow-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">未発見</p>
                  <p className="text-2xl font-bold text-red-600">{statistics.notFound}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
            </div>
          </div>
        )}

        {/* 結果表示 */}
        <div className="space-y-4">
          {results.map((result) => {
            const mostSimilar = result.evaluation?.mostSimilarResult;
            const originalInfo = result.parsedInfo;
            
            return (
              <div
                key={result.id}
                className={`bg-white rounded-lg shadow-sm border-l-4 p-6 ${getStatusColor(result.evaluation?.status || 'not_found')}`}
              >
                {/* ヘッダー */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.evaluation?.status || 'not_found')}
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        文献 #{result.id} ({result.parsedInfo?.language === 'japanese' ? '日本語' : '英語'})
                      </h3>
                      <p className="text-sm text-gray-600">
                        類似度スコア: {result.evaluation?.similarityScore || 0}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* 元の文献テキスト */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-700 mb-2">📄 元の文献テキスト</h4>
                  <div className="text-sm font-mono text-gray-800 break-all">
                    {result.originalText || 'テキストが見つかりません'}
                  </div>
                </div>

                {/* 比較表示 */}
                <div className="mb-6">
                  <h4 className="font-medium text-gray-700 mb-3">🔍 検証結果の比較</h4>
                  <div className="grid grid-cols-1 gap-3">
                    
                    {/* タイトル比較 */}
                    <div className="flex items-start gap-4 p-3 border rounded-lg">
                      <div className="w-16 text-sm font-medium text-gray-600">タイトル</div>
                      <div className="flex-1 space-y-2">
                        <div className="text-sm">
                          <span className="text-gray-500">入力:</span>
                          <span className="ml-2">{originalInfo?.title || '未検出'}</span>
                        </div>
                        {mostSimilar && (
                          <div className="text-sm">
                            <span className="text-gray-500">検索結果:</span>
                            <span className={`ml-2 text-xs font-medium ${
                              compareFields(originalInfo?.title, mostSimilar.title) ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {mostSimilar.title || '未検出'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 著者比較 */}
                    <div className="flex items-start gap-4 p-3 border rounded-lg">
                      <div className="w-16 text-sm font-medium text-gray-600">著者</div>
                      <div className="flex-1 space-y-2">
                        <div className="text-sm">
                          <span className="text-gray-500">入力:</span>
                          <span className="ml-2">{originalInfo?.authors?.join(', ') || '未検出'}</span>
                        </div>
                        {mostSimilar && (
                          <div className="text-sm">
                            <span className="text-gray-500">検索結果:</span>
                            <span className={`ml-2 text-xs font-medium ${
                              compareAuthors(originalInfo?.authors, mostSimilar.authors) ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {mostSimilar.authors || '未検出'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 雑誌名比較 */}
                    <div className="flex items-start gap-4 p-3 border rounded-lg">
                      <div className="w-16 text-sm font-medium text-gray-600">雑誌</div>
                      <div className="flex-1 space-y-2">
                        <div className="text-sm">
                          <span className="text-gray-500">入力:</span>
                          <span className="ml-2">{originalInfo?.journal || '未検出'}</span>
                        </div>
                        {mostSimilar && (
                          <div className="text-sm">
                            <span className="text-gray-500">検索結果:</span>
                            <span className={`ml-2 text-xs font-medium ${
                              compareFields(originalInfo?.journal, mostSimilar.journal) ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {mostSimilar.journal || '未検出'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 年比較 */}
                    <div className="flex items-start gap-4 p-3 border rounded-lg">
                      <div className="w-16 text-sm font-medium text-gray-600">年</div>
                      <div className="flex-1 space-y-2">
                        <div className="text-sm">
                          <span className="text-gray-500">入力:</span>
                          <span className="ml-2">{originalInfo?.year || '未検出'}</span>
                        </div>
                        {mostSimilar && (
                          <div className="text-sm">
                            <span className="text-gray-500">検索結果:</span>
                            <span className={`ml-2 px-2 py-1 rounded text-white text-xs ${
                              compareYear(originalInfo?.year, mostSimilar.year) ? 'bg-green-600' : 'bg-red-600'
                            }`}>
                              {mostSimilar.year || '未検出'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* DOI */}
                    {(originalInfo?.doi || mostSimilar?.doi) && (
                      <div className="flex items-start gap-4 p-3 border rounded-lg">
                        <div className="w-16 text-sm font-medium text-gray-600">DOI</div>
                        <div className="flex-1 space-y-2">
                          {originalInfo?.doi && (
                            <div className="text-sm">
                              <span className="text-gray-500">入力:</span>
                              <a 
                                href={`https://doi.org/${originalInfo.doi.replace(/^doi:/, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline ml-2"
                              >
                                {originalInfo.doi}
                              </a>
                            </div>
                          )}
                          {mostSimilar?.doi && (
                            <div className="text-sm">
                              <span className="text-gray-500">検索結果:</span>
                              <a 
                                href={`https://doi.org/${mostSimilar.doi.replace(/^doi:/, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline ml-2"
                              >
                                {mostSimilar.doi}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 検証結果メッセージ（エラー詳細対応版） */}
                <div className={`mb-6 p-4 border-l-4 rounded ${
                  result.evaluation?.penalties?.length > 0 ? 'bg-orange-50 border-orange-400' : 
                  result.searchResults?.some(r => r.errorDetails) ? 'bg-red-50 border-red-400' :
                  'bg-blue-50 border-blue-400'
                }`}>
                  <h4 className={`font-medium mb-2 ${
                    result.evaluation?.penalties?.length > 0 ? 'text-orange-800' : 
                    result.searchResults?.some(r => r.errorDetails) ? 'text-red-800' :
                    'text-blue-800'
                  }`}>
                    {result.evaluation?.penalties?.length > 0 ? '⚠️ 検証結果（要注意）' : 
                     result.searchResults?.some(r => r.errorDetails) ? '🚨 検索エラー詳細' :
                     '💡 検証結果'}
                  </h4>
                  <p className={`text-sm mb-2 ${
                    result.evaluation?.penalties?.length > 0 ? 'text-orange-700' : 
                    result.searchResults?.some(r => r.errorDetails) ? 'text-red-700' :
                    'text-blue-700'
                  }`}>
                    {result.evaluation?.assessment || 'エラーが発生しました'}
                  </p>
                  
                  {/* API検索エラー詳細表示 */}
                  {result.searchResults?.some(r => r.errorDetails) && (
                    <div className="mt-3 p-3 bg-red-100 border border-red-200 rounded">
                      <h5 className="text-sm font-medium text-red-800 mb-2">🔍 API検索エラー詳細</h5>
                      {result.searchResults.filter(r => r.errorDetails).map((errorResult, idx) => (
                        <div key={idx} className="text-xs text-red-700 mb-2 last:mb-0">
                          <div className="font-medium flex items-center gap-1">
                            <span className="text-red-500">●</span>
                            <span>{errorResult.source}:</span>
                            <span className="bg-red-200 px-1 rounded text-xs">
                              {errorResult.errorDetails.type}
                            </span>
                          </div>
                          <div className="ml-3 mt-1">{errorResult.errorDetails.message}</div>
                          {errorResult.errorDetails.status && (
                            <div className="ml-3 text-red-500">HTTP Status: {errorResult.errorDetails.status}</div>
                          )}
                        </div>
                      ))}
                      <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                        💡 <strong>これらのエラーは一時的な問題の可能性があります。</strong><br/>
                        しばらく待ってから再試行するか、手動検索リンクをご利用ください。
                      </div>
                    </div>
                  )}
                  
                  {/* ペナルティ詳細表示 */}
                  {result.evaluation?.penalties?.length > 0 && (
                    <div className="mt-3 p-3 bg-orange-100 border border-orange-200 rounded">
                      <h5 className="text-sm font-medium text-orange-800 mb-2">🚨 学術的誠実性チェック</h5>
                      <ul className="text-xs text-orange-700 space-y-1">
                        {result.evaluation.penalties.map((penalty, idx) => (
                          <li key={idx} className="flex items-center gap-1">
                            <span className="text-red-500">●</span>
                            <span>{penalty}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 text-xs text-orange-600 bg-orange-50 p-2 rounded">
                        💡 <strong>これらの不一致は文献を実際に確認していない可能性を示唆します。</strong><br/>
                        生成AIで作成した引用情報の場合、このような不一致が発生することがあります。
                      </div>
                    </div>
                  )}
                  
                  {mostSimilar && !result.searchResults?.some(r => r.errorDetails) && (
                    <div className="mt-2 text-xs text-gray-600">
                      検索ソース: {mostSimilar.source} | 
                      {mostSimilar.citationCount > 0 && ` 被引用数: ${mostSimilar.citationCount} | `}
                      信頼度: {result.evaluation?.similarityScore || 0}%
                      {mostSimilar.penaltyScore > 0 && ` | ペナルティ: -${mostSimilar.penaltyScore}%`}
                    </div>
                  )}
                </div>

                {/* 検索ボタン */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {result.parsedInfo?.language === 'japanese' ? (
                    <>
                      <a
                        href={result.searchUrls?.ciNii || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-red-100 text-red-700 rounded-full hover:bg-red-200 font-medium"
                      >
                        <ExternalLink className="w-3 h-3" />
                        CiNii Research 🇯🇵
                      </a>
                      <a
                        href={result.searchUrls?.jStage || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200 font-medium"
                      >
                        <ExternalLink className="w-3 h-3" />
                        J-STAGE 🇯🇵
                      </a>
                      <a
                        href={result.searchUrls?.scholar || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Google Scholar
                      </a>
                      <a
                        href={result.searchUrls?.crossRef || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-green-100 text-green-700 rounded-full hover:bg-green-200"
                      >
                        <ExternalLink className="w-3 h-3" />
                        CrossRef
                      </a>
                    </>
                  ) : (
                    <>
                      <a
                        href={result.searchUrls?.semanticScholar || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 font-medium"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Semantic Scholar 🚀
                      </a>
                      <a
                        href={result.searchUrls?.crossRef || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-green-100 text-green-700 rounded-full hover:bg-green-200 font-medium"
                      >
                        <ExternalLink className="w-3 h-3" />
                        CrossRef 🌍
                      </a>
                      <a
                        href={result.searchUrls?.scholar || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Google Scholar
                      </a>
                      <a
                        href={result.searchUrls?.ciNii || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-red-100 text-red-700 rounded-full hover:bg-red-200"
                      >
                        <ExternalLink className="w-3 h-3" />
                        CiNii Research
                      </a>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {results.length === 0 && !isProcessing && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">文献リストを入力してください</h3>
            <p className="text-gray-600">
              上のテキストエリアに文献情報を入力し、「一括検証」ボタンをクリックして検証を開始します。
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiteratureVerifier;
