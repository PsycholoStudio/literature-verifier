/**
 * アプリケーション定数
 */

// 引用スタイル定数
export const CITATION_STYLES = {
  APA: 'apa',
  MLA: 'mla',
  CHICAGO: 'chicago'
};

// 検索結果のステータス
export const RESULT_STATUS = {
  FOUND: 'found',
  SIMILAR: 'similar', 
  NOT_FOUND: 'not_found'
};

// データベースソース
export const DATABASES = {
  CROSSREF: 'CrossRef',
  SEMANTIC_SCHOLAR: 'Semantic Scholar',
  CINII: 'CiNii'
};

// API検索のステータス
export const API_STATUS = {
  IDLE: 'idle',
  SEARCHING: 'searching',
  COMPLETED: 'completed',
  ERROR: 'error'
};

// 検索設定
export const SEARCH_CONFIG = {
  TIMEOUT: 10000, // 10秒
  MAX_RESULTS: 5,
  SIMILARITY_THRESHOLD: 80, // 80%以上で類似とみなす
  AUTHOR_MATCH_THRESHOLD: 0.5 // 半数以上の著者が一致すれば一致とみなす
};

// UI設定
export const UI_CONFIG = {
  COPY_FEEDBACK_DURATION: 2000, // コピー完了メッセージの表示時間（ms）
  DEBOUNCE_DELAY: 300, // デバウンス遅延時間（ms）
  ANIMATION_DURATION: 200 // アニメーション時間（ms）
};

// 文献解析用正規表現パターン
export const PARSING_PATTERNS = {
  // 日本語パターン
  JAPANESE: {
    REGEX: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3005]/,
    QUOTED_TITLE: /[『「][^』」]+[』」]/g,
    JOURNAL_BEFORE_VOLUME: [
      /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{1,20}研究)\s*[，,]?\s*\d+/,
      /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{1,20}学会誌)\s*[，,]?\s*\d+/,
      /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{1,20}論文集)\s*[，,]?\s*\d+/,
      /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{1,20}学報)\s*[，,]?\s*\d+/,
      /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{1,20}紀要)\s*[，,]?\s*\d+/,
      /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{1,20}ジャーナル)\s*[，,]?\s*\d+/
    ],
    VOLUME_ISSUE_PAGE: [
      /(\d+)\s*巻\s*(\d+)\s*号[，,]?\s*(?:pp\.?)?\s*(\d+[-–]\d+)/,
      /第?\s*(\d+)\s*巻\s*第?\s*(\d+)\s*号[，,]?\s*(?:pp\.?)?\s*(\d+[-–]\d+)/,
      /(\d+)[，,]\s*(\d+)[，,]\s*(\d+[-–]\d+)/,
      /vol\.\s*(\d+)[，,]?\s*no\.\s*(\d+)[，,]?\s*(?:pp\.?)?\s*(\d+[-–]\d+)/i
    ]
  },

  // 英語パターン
  ENGLISH: {
    QUOTED_TITLE: /"[^"]+"/g,
    AUTHOR_NAME: /^[A-Z][a-z]+(?:,?\s*[A-Z]\.?\s*)*[A-Z]?\.?$|^[A-Z][a-z]+\s+[A-Z][a-z]+$|^[A-Z][a-z-']+,?\s*[A-Z]\.?$/,
    JOURNAL_PATTERNS: [
      /\.\s*([A-Z][A-Za-z\s&]+),?\s*vol/i,
      /\.\s*([A-Z][A-Za-z\s&]+),?\s*\d+\(/i,
      /\.\s*([A-Z][A-Za-z\s&]+),?\s*\d+,/i,
      /In\s+([A-Z][A-Za-z\s&]+)/i
    ],
    VOLUME_ISSUE_PAGE: [
      /(\d+)\s*\(\s*(\d+)\s*\)[，,]?\s*(\d+[-–]\d+)/,
      /vol\.\s*(\d+)[，,]?\s*no\.\s*(\d+)[，,]?\s*(?:pp\.?)?\s*(\d+[-–]\d+)/i,
      /(\d+)[，,]\s*(\d+)[，,]\s*(\d+[-–]\d+)/,
      /volume\s*(\d+)[，,]?\s*issue\s*(\d+)[，,]?\s*(?:pp\.?)?\s*(\d+[-–]\d+)/i
    ]
  },

  // 共通パターン
  COMMON: {
    YEAR: /\b(19|20)\d{2}\b/g,
    DOI: /doi:\s*([^\s,]+)|10\.\d+\/[^\s,]+/gi,
    URL: /https?:\/\/[^\s,]+/g,
    VOLUME_ONLY: [
      /(\d+)\s*巻/,
      /第?\s*(\d+)\s*巻/,
      /vol\.\s*(\d+)/i,
      /volume\s*(\d+)/i
    ],
    PAGE_ONLY: [
      /pp?\.\s*(\d+[-–]\d+)/i,
      /pages?\s*(\d+[-–]\d+)/i,
      /(\d+[-–]\d+)\s*ページ/,
      /(\d+[-–]\d+)$/
    ]
  }
};

// 書籍判定用パターン
export const BOOK_INDICATORS = {
  JAPANESE: [
    /出版社/, /出版/, /編/, /著/, /監修/, /翻訳/, /訳/, /社$/
  ],
  ENGLISH: [
    /press$/i, /publisher/i, /publishing/i, /books?$/i, /edition/i, /eds?\./i, /editor/i
  ],
  PUBLISHER_PATTERNS: {
    JAPANESE: /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+(?:出版|社|書店|出版社))/,
    ENGLISH: /([A-Z][A-Za-z\s&]+(?:Press|Publishing|Publishers|Books))/
  }
};

// よくある誤記修正パターン
export const COMMON_ERRORS = [
  { pattern: /創ー/g, replacement: '創一' },
  { pattern: /(\d+)\s*巻\s*(\d+)\s*号/g, replacement: 'vol.$1, no.$2' },
  { pattern: /(\d+)\s*巻/g, replacement: 'vol.$1' },
  { pattern: /(\d+)\s*号/g, replacement: 'no.$1' },
  { pattern: /\s*pp\.\s*/g, replacement: ' pp.' },
  { pattern: /\s*doi\s*:\s*/gi, replacement: ' doi:' }
];

// 除外パターン（解析対象外とする文字列）
export const EXCLUDE_PATTERNS = {
  JAPANESE: {
    TITLE: /(大学|研究所|学会|省庁|出版)/g,
    AUTHOR: /(出版|大学|研究所|学会|省庁|株式会社|年|月|日|巻|号|pp)/g
  },
  ENGLISH: {
    TITLE: /(University|Press|Journal|Publishing)/gi,
    AUTHOR: /(University|Press|Journal|Publishing|et\s+al)/gi
  }
};

// 検索リンクURL設定
export const SEARCH_LINKS = {
  GOOGLE_SCHOLAR: {
    name: 'Google Scholar',
    url: 'https://scholar.google.com/scholar?q=',
    icon: '🎓'
  },
  CROSSREF: {
    name: 'CrossRef',
    url: 'https://search.crossref.org/?q=',
    suffix: '&from_ui=yes',
    icon: '🔍'
  },
  CINII: {
    name: 'CiNii',
    url: 'https://cir.nii.ac.jp/all?q=',
    icon: '📚'
  },
  PUBMED: {
    name: 'PubMed',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=',
    icon: '🏥'
  }
};