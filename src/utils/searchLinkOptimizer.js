/**
 * 文献の種類と言語に応じて最適な検索リンクの順序を決定するユーティリティ
 * 
 * 検索戦略：
 * 1. 言語適合性の高いAPIデータベースを優先
 * 2. 日本語文献 → CiNii/NDL優先、英語文献 → CrossRef/Semantic Scholar優先
 * 3. 書籍 → Google Books/NDL優先、論文 → CrossRef/Semantic Scholar優先
 * 4. クロス言語検索は十分な結果がない場合のフォールバックとして使用
 * 5. Google Scholar/PubMedは外部リンクとして最後に提供
 */

import { SEARCH_LINKS } from '../constants';

/**
 * 文献情報に基づいて最適な検索リンクの順序を取得
 * @param {Object} parsedInfo - 解析された文献情報
 * @returns {Array} 最適化された検索リンクの配列
 */
export const getOptimizedSearchLinks = (parsedInfo) => {
  const { language, isBook, isBookChapter } = parsedInfo;
  let linkOrder;
  
  if (isBookChapter) {
    // 書籍の章の場合：言語適合性重視
    if (language === 'japanese') {
      // 日本語書籍の章: CiNii → NDL → Google Books → (CrossRef → Semantic Scholar)
      // 括弧内は十分な結果がない場合のフォールバック
      linkOrder = ['CINII', 'NDL', 'GOOGLE_BOOKS', 'CROSSREF', 'SEMANTIC_SCHOLAR'];
    } else {
      // 英語書籍の章: Google Books → Semantic Scholar → CrossRef → (CiNii → NDL)
      linkOrder = ['GOOGLE_BOOKS', 'SEMANTIC_SCHOLAR', 'CROSSREF', 'CINII', 'NDL'];
    }
  } else if (isBook) {
    // 書籍の場合：書籍特化データベース優先
    if (language === 'japanese') {
      // 和文書籍: CiNii → NDL → Google Books
      linkOrder = ['CINII', 'NDL', 'GOOGLE_BOOKS'];
    } else {
      // 欧文書籍: CrossRef → Google Books → PubMed → CiNii
      linkOrder = ['CROSSREF', 'GOOGLE_BOOKS', 'PUBMED', 'CINII'];
    }
  } else {
    // 論文の場合：学術データベース優先
    if (language === 'japanese') {
      // 和文論文: CiNii → NDL → Google Scholar → CrossRef
      linkOrder = ['CINII', 'NDL', 'GOOGLE_SCHOLAR', 'CROSSREF'];
    } else {
      // 欧文論文: CrossRef → Google Scholar → PubMed → CiNii
      linkOrder = ['CROSSREF', 'GOOGLE_SCHOLAR', 'PUBMED', 'CINII'];
    }
  }
  
  // 外部リンクは各カテゴリーの設定に含まれているため、自動追加は不要
  
  // 定義されているリンクのみをフィルタして返す
  return linkOrder
    .map(key => SEARCH_LINKS[key])
    .filter(link => link); // undefined の要素を除外
};

/**
 * 検索クエリを文献情報に基づいて最適化
 * @param {Object} parsedInfo - 解析された文献情報
 * @param {Object} searchLink - 検索リンク情報
 * @returns {string} 最適化された検索クエリ
 */
export const optimizeSearchQuery = (parsedInfo, searchLink) => {
  const { title, authors, year, journal, isBook, isBookChapter, bookTitle } = parsedInfo;
  
  // Book Chapterの場合の特別な処理
  if (isBookChapter) {
    switch (searchLink.name) {
      case 'CrossRef':
        // Book Chapterは書籍名 + 章タイトルで検索
        if (bookTitle || journal) {
          return `${bookTitle || journal} ${title}`;
        }
        return title;
        
      case 'CiNii':
        // CiNiiでは書籍名 + 章タイトルで検索（著者名は除外）
        const ciniiParts = [];
        if (bookTitle || journal) {
          ciniiParts.push(bookTitle || journal);
        }
        ciniiParts.push(title);
        return ciniiParts.join(' ');
        
      case 'Google Scholar':
        // Google Scholarでは包括的検索（書籍名 + 章タイトル + 著者 + 年）
        const gsPartsChapter = [];
        if (bookTitle || journal) {
          gsPartsChapter.push(bookTitle || journal);
        }
        gsPartsChapter.push(title);
        if (authors && Array.isArray(authors) && authors.length > 0) {
          gsPartsChapter.push(authors[0]);
        }
        if (year) {
          gsPartsChapter.push(year);
        }
        return gsPartsChapter.join(' ');
        
      case 'NDL Search':
        // NDLでは書籍名を最優先に検索
        if (bookTitle || journal) {
          const ndlParts = [bookTitle || journal];
          if (authors && Array.isArray(authors) && authors.length > 0) {
            ndlParts.push(authors[0]);
          }
          return ndlParts.join(' ');
        }
        // 書籍名がない場合は章タイトル + 著者
        if (authors && Array.isArray(authors) && authors.length > 0) {
          return `${authors[0]} ${title}`;
        }
        return title;
        
      case 'Google Books':
        // Google Booksでは書籍名を最優先に検索
        if (bookTitle || journal) {
          const gbParts = [bookTitle || journal];
          if (authors && Array.isArray(authors) && authors.length > 0) {
            gbParts.push(authors[0]);
          }
          return gbParts.join(' ');
        }
        // 書籍名がない場合は章タイトル + 著者
        if (authors && Array.isArray(authors) && authors.length > 0) {
          return `${authors[0]} ${title}`;
        }
        return title;
        
      case 'Semantic Scholar':
        // Semantic Scholarでは書籍名 + 章タイトルで検索
        if (bookTitle || journal) {
          return `${bookTitle || journal} ${title}`;
        }
        return title;
        
      case 'PubMed':
        // PubMedでは章タイトルで検索
        return title;
        
      default:
        return title;
    }
  }
  
  // 通常の書籍・論文の場合の処理
  switch (searchLink.name) {
    case 'CrossRef':
      // CrossRefは正確なタイトルマッチが重要
      return title;
      
    case 'CiNii':
      // CiNiiは著者名を含めると結果が表示されないため、タイトルのみで検索
      return title;
      
    case 'Google Scholar':
      // Google Scholarは包括的検索が可能
      const parts = [title];
      if (authors && Array.isArray(authors) && authors.length > 0) {
        parts.push(authors[0]);
      }
      if (year) {
        parts.push(year);
      }
      return parts.join(' ');
      
    case 'NDL Search':
      // NDLは書籍検索に特化
      if (isBook && authors && Array.isArray(authors) && authors.length > 0) {
        return `${title} ${authors[0]}`;
      }
      return title;
      
    case 'Google Books':
      // Google Booksは書籍に特化
      if (authors && Array.isArray(authors) && authors.length > 0) {
        return `${title} ${authors[0]}`;
      }
      return title;
      
    case 'PubMed':
      // PubMedは医学論文に特化
      if (journal) {
        return `${title} ${journal}`;
      }
      return title;
      
    default:
      return title;
  }
};