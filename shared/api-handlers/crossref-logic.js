/**
 * CrossRef API ロジック
 */
import { fetchWithRetry } from '../utils/fetch-with-retry.js';
import { formatCrossRefResponse } from '../utils/unifiedResponseFormatter.mjs';

// CrossRefレート制限管理
let lastCrossRefRequestTime = 0;

/**
 * CrossRef APIを呼び出し、検索結果を取得
 */
export async function handleCrossRefSearch(query, rows = 10, doi = null) {
  let url;
  if (doi) {
    // DOI検索
    url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
    console.log(`🔍 CrossRef DOI検索: "${doi}"`);
  } else if (query) {
    // テキスト検索  
    url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${rows}&mailto=scriba@psycholo.studio`;
    console.log(`🔍 CrossRef検索: "${query}" (最大${rows}件)`);
  } else {
    throw new Error('Query or DOI parameter is required');
  }

  console.log(`🌐 CrossRef API Request: ${url}`);

  // レート制限：前回のリクエストから3秒間隔を確保（順次処理の確実性向上）
  const now = Date.now();
  const timeSinceLastRequest = now - lastCrossRefRequestTime;
  const minInterval = 3000; // 3秒に延長
  
  if (timeSinceLastRequest < minInterval) {
    const waitTime = minInterval - timeSinceLastRequest;
    console.log(`⏳ CrossRef レート制限: ${waitTime}ms 待機中...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastCrossRefRequestTime = Date.now();
  console.log(`🔒 CrossRef レート制限完了 - API呼び出し開始`);

  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'CitationChecker/1.0 (https://github.com/psycholo-studio/citation-checker; mailto:psycholo.studio@gmail.com)'
    }
  });

  if (!response.ok) {
    console.error(`❌ CrossRef API error: ${response.status} ${response.statusText}`);
    throw new Error(`CrossRef API error: ${response.status} ${response.statusText}`);
  }

  console.log(`✅ CrossRef API レスポンス成功: ${response.status}`);
  const data = await response.json();
  
  console.log(`📄 CrossRef レスポンス構造:`, {
    hasMessage: !!data.message,
    hasItems: !!data.message?.items,
    itemCount: data.message?.items?.length || 0
  });
  
  const resultCount = doi ? (data.message ? 1 : 0) : (data.message?.items?.length || 0);
  console.log(`📊 CrossRef API レスポンス: ${resultCount}件受信`);
  
  // Convert to unified format
  if (doi && data.message) {
    // Single DOI result - create structure expected by formatter
    const singleItemData = {
      message: { 
        items: [data.message]
      },
      query: { doi, query, rows }
    };
    return formatCrossRefResponse(singleItemData);
  } else if (data.message?.items) {
    // Search results
    const searchData = {
      ...data,
      query: { doi, query, rows }
    };
    return formatCrossRefResponse(searchData);
  }
  
  // Fallback for empty results
  return formatCrossRefResponse({ message: { items: [] }, query: { doi, query, rows } });
}