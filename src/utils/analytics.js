/**
 * Google Analytics 4 イベント送信ユーティリティ
 */

// Google Analytics イベント送信関数
export const sendGAEvent = (eventName, parameters = {}) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, parameters);
    console.log(`📊 GA Event: ${eventName}`, parameters);
  }
};

// 引用検証開始イベント
export const trackCitationVerificationStart = (citationCount) => {
  sendGAEvent('citation_verification_start', {
    event_category: 'citation_verification',
    citation_count: citationCount,
    value: citationCount
  });
};

// 引用検証完了イベント
export const trackCitationVerificationComplete = (citationCount, foundCount, similarCount, notFoundCount) => {
  sendGAEvent('citation_verification_complete', {
    event_category: 'citation_verification',
    citation_count: citationCount,
    found_count: foundCount,
    similar_count: similarCount,
    not_found_count: notFoundCount,
    success_rate: Math.round(((foundCount + similarCount) / citationCount) * 100)
  });
};

// データベース検索イベント
export const trackDatabaseSearch = (database, resultCount, searchType = 'automatic') => {
  sendGAEvent('database_search', {
    event_category: 'database_search',
    database_name: database,
    result_count: resultCount,
    search_type: searchType
  });
};

// 引用形式変更イベント
export const trackCitationFormatChange = (oldFormat, newFormat) => {
  sendGAEvent('citation_format_change', {
    event_category: 'citation_format',
    old_format: oldFormat,
    new_format: newFormat
  });
};

// 引用コピーイベント
export const trackCitationCopy = (citationFormat, citationCount) => {
  sendGAEvent('citation_copy', {
    event_category: 'citation_format',
    citation_format: citationFormat,
    citation_count: citationCount
  });
};

// エラートラッキング
export const trackError = (errorType, errorMessage, component = '') => {
  sendGAEvent('app_error', {
    event_category: 'error',
    error_type: errorType,
    error_message: errorMessage.substring(0, 100), // 最初の100文字のみ
    component: component
  });
};

// パフォーマンストラッキング
export const trackPerformance = (actionType, duration, citationCount = 0) => {
  sendGAEvent('performance_timing', {
    event_category: 'performance',
    action_type: actionType,
    duration_ms: duration,
    citation_count: citationCount,
    value: duration
  });
};