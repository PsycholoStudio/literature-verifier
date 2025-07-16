/**
 * Google Books API ロジック
 */
import { fetchWithRetry } from '../utils/fetch-with-retry.js';
import { formatGoogleBooksResponse } from '../utils/unifiedResponseFormatter.mjs';

/**
 * Google Books APIを呼び出し、書籍検索結果を取得
 * selfLinkを使った詳細情報取得も含む
 */
export async function handleGoogleBooksSearch(q, maxResults = 20, startIndex = 0) {
  if (!q) {
    throw new Error('Query parameter "q" is required');
  }

  console.log(`🔍 Google Books検索: "${q}" (最大${maxResults}件)`);

  // Google Books API URL構築（検索用）
  const baseUrl = 'https://www.googleapis.com/books/v1/volumes';
  const params = new URLSearchParams({
    q: q,
    maxResults: Math.min(parseInt(maxResults), 40), // 最大40件
    startIndex: parseInt(startIndex),
    fields: 'items(id,selfLink,volumeInfo(title,subtitle,authors,publishedDate,publisher,industryIdentifiers,pageCount,categories,language,description))',
    printType: 'books' // 書籍のみに限定
  });

  const requestUrl = `${baseUrl}?${params}`;
  console.log(`🌐 Google Books API Request: ${requestUrl}`);

  // Google Books APIを呼び出し（検索）
  const response = await fetchWithRetry(requestUrl, {
    headers: {
      'User-Agent': 'Literature-Verifier/1.0'
    }
  });

  if (!response.ok) {
    console.error(`Google Books API error: ${response.status} ${response.statusText}`);
    throw new Error(`Google Books API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // 詳細情報を取得するため、各アイテムのselfLinkを使用
  if (data.items && data.items.length > 0) {
    console.log(`📚 Google Books: selfLinkを使って詳細情報を取得中... (${data.items.length}件)`);
    
    const detailPromises = data.items.slice(0, 10).map(async (item, index) => {
      try {
        console.log(`🔍 項目 ${index + 1}: selfLink確認中...`);
        console.log(`   - ID: ${item.id}`);
        console.log(`   - selfLink: ${item.selfLink || 'なし'}`);
        console.log(`   - 元の出版社: ${item.volumeInfo?.publisher || 'なし'}`);
        
        if (item.selfLink) {
          console.log(`🌐 詳細API呼び出し: ${item.selfLink}`);
          const detailResponse = await fetchWithRetry(item.selfLink, {
            headers: {
              'User-Agent': 'Literature-Verifier/1.0'
            }
          });
          
          // console.log(`📡 詳細APIレスポンス: ${detailResponse.status} ${detailResponse.statusText}`);
          
          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            // console.log(`📖 詳細取得成功: "${detailData.volumeInfo?.title}" - 出版社: ${detailData.volumeInfo?.publisher || 'なし'}`);
            // console.log(`📊 詳細情報フィールド:`, {
            //   publisher: detailData.volumeInfo?.publisher,
            //   publishedDate: detailData.volumeInfo?.publishedDate,
            //   industryIdentifiers: detailData.volumeInfo?.industryIdentifiers?.length || 0,
            //   pageCount: detailData.volumeInfo?.pageCount
            // });
            return detailData;
          } else {
            console.log(`⚠️ 詳細取得失敗: ${item.selfLink} (${detailResponse.status})`);
            return item; // 詳細取得失敗時は元のデータを返す
          }
        } else {
          console.log(`⚠️ selfLinkが存在しません`);
          return item;
        }
      } catch (error) {
        console.error(`❌ 詳細情報取得エラー (項目 ${index + 1}): ${error.message}`);
        return item; // エラー時は元のデータを返す
      }
    });
    
    // 全ての詳細情報取得を待つ
    console.log(`⏳ 全ての詳細情報取得を待機中...`);
    const detailedItems = await Promise.all(detailPromises);
    data.items = detailedItems;
    console.log(`✅ 詳細情報取得完了: ${detailedItems.length}件`);
  } else {
    console.log(`⚠️ Google Books: アイテムが見つかりません`);
  }
  
  console.log(`📊 Google Books APIレスポンス:`);
  console.log(`   取得件数: ${data.items?.length || 0}件`);
  console.log(`   総利用可能件数: ${data.totalItems || 0}件`);

  // デバッグ用：実際の書籍タイトルを表示
  if (data.items?.length > 0) {
    console.log(`📚 Google Books検索結果タイトル一覧:`);
    data.items.slice(0, 5).forEach((item, index) => {
      const volumeInfo = item.volumeInfo || {};
      const title = volumeInfo.title || 'タイトルなし';
      const subtitle = volumeInfo.subtitle || '';
      const fullTitle = subtitle ? `${title}: ${subtitle}` : title;
      const year = volumeInfo.publishedDate ? volumeInfo.publishedDate.substring(0, 4) : '不明';
      console.log(`  ${index + 1}. "${fullTitle}" (年: ${year})`);
    });
  }

  // Convert to unified format
  const queryData = {
    ...data,
    query: { q, maxResults, startIndex }
  };
  
  return formatGoogleBooksResponse(queryData);
}