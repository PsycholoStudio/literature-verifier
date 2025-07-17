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
      // 和文書籍: CiNii → NDL → Google Books → Google Scholar
      linkOrder = ['CINII', 'NDL', 'GOOGLE_BOOKS', 'GOOGLE_SCHOLAR'];
    } else {
      // 欧文書籍: CrossRef → Google Books → Google Scholar → PubMed → CiNii
      linkOrder = ['CROSSREF', 'GOOGLE_BOOKS', 'GOOGLE_SCHOLAR', 'PUBMED', 'CINII'];
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
// 日本語テキストの文字種境界に+を挿入する関数（NDL用）
export const addJapaneseBoundaryPlus = (text) => {
  if (!text) return text;
  
  return text
    // 漢字とひらがな/カタカナの境界
    .replace(/([一-龯])([ぁ-んァ-ヴー])/g, '$1+$2')
    // ひらがな/カタカナと漢字の境界
    .replace(/([ぁ-んァ-ヴー])([一-龯])/g, '$1+$2')
    // ひらがなとカタカナの境界
    .replace(/([ぁ-ん])([ァ-ヴー])/g, '$1+$2')
    .replace(/([ァ-ヴー])([ぁ-ん])/g, '$1+$2')
    // 日本語と英数字の境界
    .replace(/([一-龯ぁ-んァ-ヴー])([a-zA-Z0-9])/g, '$1+$2')
    .replace(/([a-zA-Z0-9])([一-龯ぁ-んァ-ヴー])/g, '$1+$2')
    // 複数の+を1つに統一
    .replace(/\++/g, '+')
    // 先頭と末尾の+を除去
    .replace(/^\+|\+$/g, '');
};

export const optimizeSearchQuery = (parsedInfo, searchLink) => {
  const { title, authors, year, journal, isBook, isBookChapter, bookTitle } = parsedInfo;
  
  // デバッグログ
  console.log(`🔧 ${searchLink.name} optimizeSearchQuery:`, {
    title,
    bookTitle,
    journal,
    isBookChapter,
    authors,
    editors: parsedInfo.editors
  });
  
  // Book Chapterの場合でも、タイトル検索リンクは章タイトルを使用
  // （書籍タイトルの検索リンクは別途UI側で追加）
  
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
      // タイトルが短い場合のみ著者名を追加（日本語6文字以内、英語4単語以内）
      if (authors && Array.isArray(authors) && authors.length > 0) {
        const titleLength = title.length;
        const isJapanese = /[ひらがなカタカナ漢字]/.test(title);
        const shouldAddAuthor = isJapanese 
          ? titleLength <= 6 
          : title.split(/\s+/).length <= 4;
        
        if (shouldAddAuthor) {
          parts.push(authors[0]);
        }
      }
      return parts.join(' ');
      
    case 'NDL Search':
      // NDLは書籍検索に特化（文字種境界に+を追加）
      if (isBook && authors && Array.isArray(authors) && authors.length > 0) {
        // 書籍タイトル（サブタイトルなし）+ 著者で検索
        const cleanTitle = title.replace(/[""「」『』]/g, '').replace(/[ー—‐−–].*/g, '').trim();
        const cleanAuthor = authors[0].replace(/[""「」『』]/g, '').trim();
        return `${addJapaneseBoundaryPlus(cleanTitle)} ${addJapaneseBoundaryPlus(cleanAuthor)}`;
      }
      // 書籍タイトル（サブタイトルなし）のみ
      const cleanTitle = title.replace(/[""「」『』]/g, '').replace(/[ー—‐−–].*/g, '').trim();
      return addJapaneseBoundaryPlus(cleanTitle);
      
    case 'Google Books':
      // Google Booksは書籍に特化
      if (authors && Array.isArray(authors) && authors.length > 0) {
        // 書籍タイトル（サブタイトルなし）+ 著者で検索
        const cleanTitle = title.replace(/[""「」『』]/g, '').replace(/[ー—‐−–].*/g, '').trim();
        const cleanAuthor = authors[0].replace(/[""「」『』]/g, '').trim();
        return `${cleanTitle} ${cleanAuthor}`;
      }
      // 書籍タイトル（サブタイトルなし）のみ
      return title.replace(/[""「」『』]/g, '').replace(/[ー—‐−–].*/g, '').trim();
      
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