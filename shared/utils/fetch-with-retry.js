/**
 * リトライ機能付きfetch関数
 * サーバーエラー（500系）やネットワークエラーの場合のみリトライを実行
 */
export async function fetchWithRetry(url, options = {}, maxRetries = 3, retryDelay = 4000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000); // 35秒タイムアウト（CrossRef用に延長）
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // 成功またはクライアントエラー（400系、429を除く）の場合はリトライしない
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
        return response;
      }
      
      // 503エラーのRetry-Afterヘッダー処理
      if (response.status === 503 && attempt < maxRetries) {
        const retryAfterHeader = response.headers.get('Retry-After');
        if (retryAfterHeader) {
          const retryAfterSeconds = parseInt(retryAfterHeader, 10);
          if (!isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
            const waitTime = retryAfterSeconds * 1000; // 秒をミリ秒に変換
            console.log(`⏳ 503 Retry-After: ${retryAfterSeconds}秒後に再試行 (${attempt}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
      }
      
      // 429エラー（Too Many Requests）のハンドリング
      if (response.status === 429 && attempt < maxRetries) {
        const retryAfterHeader = response.headers.get('Retry-After');
        let waitTime = 5000; // デフォルト5秒
        
        if (retryAfterHeader) {
          const retryAfterSeconds = parseInt(retryAfterHeader, 10);
          if (!isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
            waitTime = retryAfterSeconds * 1000;
          }
        }
        
        console.log(`⏳ 429 Too Many Requests: ${waitTime/1000}秒後に再試行 (${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // その他のサーバーエラー（500系）の場合のみリトライ
      if (attempt < maxRetries && response.status >= 500) {
        console.log(`🔄 API リトライ ${attempt}/${maxRetries} (${response.status}) - ${retryDelay/1000}秒後に再試行`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      
      return response;
      
    } catch (error) {
      // タイムアウトやネットワークエラーの場合もリトライ
      if (attempt < maxRetries) {
        console.log(`🔄 API リトライ ${attempt}/${maxRetries} (${error.message}) - ${retryDelay/1000}秒後に再試行`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      throw error;
    }
  }
}