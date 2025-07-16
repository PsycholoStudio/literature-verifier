/**
 * Semantic Scholar API ロジック
 */
import { formatSemanticScholarResponse } from '../utils/unifiedResponseFormatter.mjs';

/**
 * Semantic Scholar APIを呼び出し、学術論文検索結果を取得
 */
export async function handleSemanticScholarSearch(query, fields = 'title,url,publicationTypes,publicationDate,venue,journal,authors,abstract,citationCount,externalIds', limit = 10) {
  if (!query) {
    throw new Error('Query parameter is required');
  }

  console.log(`🔍 Semantic Scholar検索: "${query}" (最大${limit}件)`);

  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=${fields}&limit=${limit}`;
  console.log(`🌐 Semantic Scholar API Request: ${url}`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'LiteratureVerifier/1.0'
    }
  });

  if (!response.ok) {
    console.error(`❌ Semantic Scholar API error: ${response.status} ${response.statusText}`);
    throw new Error(`Semantic Scholar API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const resultCount = data.data?.length || 0;
  console.log(`📊 Semantic Scholar API レスポンス: ${resultCount}件取得`);
  
  // Convert to unified format
  const queryData = {
    ...data,
    query: { query, fields, limit }
  };
  
  return formatSemanticScholarResponse(queryData);
}