/**
 * API探索戦略の効果測定テストスクリプト
 * test_citations.txtの文献リストを使用して、各APIの有効性を検証
 */

const fs = require('fs');
const path = require('path');

// 引用文献パーサーのインポート（簡易版）
function parseCitation(citation) {
  const isJapanese = /[\u4E00-\u9FAF\u3040-\u309F\u30A0-\u30FF]/.test(citation);
  
  // 基本的なパース処理
  let parsed = {
    original: citation.trim(),
    isJapanese,
    type: 'unknown',
    title: '',
    authors: [],
    year: '',
    journal: '',
    publisher: '',
    volume: '',
    pages: ''
  };

  // 年度の抽出
  const yearMatch = citation.match(/\((\d{4})\)|（(\d{4})）|\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    parsed.year = yearMatch[1] || yearMatch[2] || yearMatch[3];
  }

  // 日本語文献のパース
  if (isJapanese) {
    // 書籍パターン：『』で囲まれたタイトル
    const bookMatch = citation.match(/『([^』]+)』/);
    if (bookMatch) {
      parsed.type = 'book';
      parsed.title = bookMatch[1];
      
      // 出版社
      const publisherMatch = citation.match(/』[\s\S]*?([^。、\s]+社|[^。、\s]+書房|[^。、\s]+堂|[^。、\s]+館)/);
      if (publisherMatch) {
        parsed.publisher = publisherMatch[1];
      }
    }
    // 論文パターン：「」で囲まれたタイトル
    else if (citation.includes('「') && citation.includes('」')) {
      parsed.type = 'article';
      const titleMatch = citation.match(/「([^」]+)」/);
      if (titleMatch) {
        parsed.title = titleMatch[1];
      }
    }

    // 著者の抽出（年より前の部分）
    const beforeYear = citation.split(/\(|（/)[0];
    const authorMatch = beforeYear.match(/^([^『「]+?)[\s　]*[『「]/);
    if (authorMatch) {
      parsed.authors = authorMatch[1].split(/[、・]/).map(a => a.trim()).filter(a => a);
    }
  }
  // 英語文献のパース
  else {
    // 書籍の判定（イタリック体を想定、出版社名で判定）
    if (citation.includes('University Press') || citation.includes('Books') || 
        citation.includes('Publishers') || /\w+\.\s*$/.test(citation)) {
      parsed.type = 'book';
    }
    // ジャーナル論文の判定
    else if (citation.includes('Journal') || citation.includes('Nature') || 
             citation.includes('Science') || /\d+\(\d+\)/.test(citation)) {
      parsed.type = 'article';
      
      // ジャーナル名の抽出
      const journalMatch = citation.match(/\.\s+([^,]+),\s*\d+/);
      if (journalMatch) {
        parsed.journal = journalMatch[1];
      }
    }

    // タイトルの抽出（年の後、ピリオドまで）
    const afterYear = citation.split(/\(\d{4}\)/)[1];
    if (afterYear) {
      const titleMatch = afterYear.match(/^\.\s*([^.]+)\./);
      if (titleMatch) {
        parsed.title = titleMatch[1];
      }
    }

    // 著者の抽出（年より前）
    const beforeYear = citation.split(/\(\d{4}\)/)[0];
    if (beforeYear) {
      parsed.authors = beforeYear.split(',').map(a => a.trim()).filter(a => a);
    }
  }

  return parsed;
}

// APIエンドポイントの定義
const API_ENDPOINTS = {
  crossref: 'http://localhost:3001/api/crossref',
  semanticScholar: 'http://localhost:3001/api/semantic-scholar',
  cinii: 'http://localhost:3001/api/cinii',
  ndl: 'http://localhost:3001/api/ndl-search',
  googleBooks: 'http://localhost:3001/api/google-books'
};

// API検索戦略の定義（apiService.jsから抽出）
function determineSearchOrder(parsed) {
  const { type, isJapanese } = parsed;
  
  if (type === 'book') {
    if (isJapanese) {
      // 日本語書籍：NDL → CiNii → Google Books
      return ['ndl', 'cinii', 'googleBooks'];
    } else {
      // 英語書籍：Google Books → CiNii
      return ['googleBooks', 'cinii'];
    }
  } else if (type === 'article') {
    if (isJapanese) {
      // 日本語論文：CiNii → CrossRef → NDL
      return ['cinii', 'crossref', 'ndl'];
    } else {
      // 英語論文：CrossRef → Semantic Scholar → CiNii
      return ['crossref', 'semanticScholar', 'cinii'];
    }
  }
  
  // デフォルト
  return isJapanese ? 
    ['cinii', 'ndl', 'crossref', 'googleBooks'] :
    ['crossref', 'semanticScholar', 'googleBooks', 'cinii'];
}

// API呼び出し関数
async function searchAPI(apiName, parsed) {
  const startTime = Date.now();
  let found = false;
  let resultCount = 0;
  let error = null;

  try {
    let url;
    switch(apiName) {
      case 'crossref':
        const crossrefQuery = `${parsed.title} ${parsed.authors.join(' ')}`.trim();
        url = `${API_ENDPOINTS.crossref}?query=${encodeURIComponent(crossrefQuery)}&rows=5`;
        break;
      
      case 'semanticScholar':
        const ssQuery = `${parsed.title} ${parsed.authors.join(' ')}`.trim();
        url = `${API_ENDPOINTS.semanticScholar}?query=${encodeURIComponent(ssQuery)}&limit=5`;
        break;
      
      case 'cinii':
        const ciniiQuery = parsed.title || parsed.authors.join(' ');
        url = `${API_ENDPOINTS.cinii}?q=${encodeURIComponent(ciniiQuery)}&count=5`;
        break;
      
      case 'ndl':
        url = `${API_ENDPOINTS.ndl}?title=${encodeURIComponent(parsed.title)}`;
        if (parsed.authors.length > 0) {
          url += `&creator=${encodeURIComponent(parsed.authors[0])}`;
        }
        break;
      
      case 'googleBooks':
        const gbQuery = `${parsed.title} ${parsed.authors.join(' ')}`.trim();
        url = `${API_ENDPOINTS.googleBooks}?q=${encodeURIComponent(gbQuery)}&maxResults=5`;
        break;
    }

    const response = await fetch(url);
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('json')) {
        const data = await response.json();
        
        // 結果数のカウント
        if (apiName === 'crossref' && data.message?.items) {
          resultCount = data.message.items.length;
          found = resultCount > 0;
        } else if (apiName === 'semanticScholar' && data.data) {
          resultCount = data.data.length;
          found = resultCount > 0;
        } else if (apiName === 'ndl' && data.results) {
          resultCount = data.results.length;
          found = resultCount > 0;
        } else if (apiName === 'googleBooks' && data.items) {
          resultCount = data.items.length;
          found = resultCount > 0;
        }
      } else if (contentType && contentType.includes('xml')) {
        // CiNiiのXMLレスポンス
        const xml = await response.text();
        found = xml.includes('<item>');
        resultCount = (xml.match(/<item>/g) || []).length;
      }
    } else {
      error = `HTTP ${response.status}`;
    }

    return {
      api: apiName,
      found,
      resultCount,
      responseTime,
      error
    };

  } catch (e) {
    return {
      api: apiName,
      found: false,
      resultCount: 0,
      responseTime: Date.now() - startTime,
      error: e.message
    };
  }
}

// メインテスト関数
async function testAPIStrategy() {
  // テストデータの読み込み
  const citations = fs.readFileSync(
    path.join(__dirname, 'test_citations.txt'), 
    'utf-8'
  ).split('\n').filter(line => line.trim() && !line.match(/^\d+$/));

  console.log(`📚 ${citations.length}件の文献をテスト開始\n`);

  const results = [];
  const apiStats = {
    crossref: { searches: 0, found: 0, totalTime: 0, unnecessary: 0 },
    semanticScholar: { searches: 0, found: 0, totalTime: 0, unnecessary: 0 },
    cinii: { searches: 0, found: 0, totalTime: 0, unnecessary: 0 },
    ndl: { searches: 0, found: 0, totalTime: 0, unnecessary: 0 },
    googleBooks: { searches: 0, found: 0, totalTime: 0, unnecessary: 0 }
  };

  // 各文献をテスト
  for (let i = 0; i < citations.length; i++) {
    const citation = citations[i];
    console.log(`\n📖 [${i + 1}/${citations.length}] ${citation.substring(0, 60)}...`);
    
    const parsed = parseCitation(citation);
    console.log(`   タイプ: ${parsed.type} | 言語: ${parsed.isJapanese ? '日本語' : '英語'}`);
    
    const searchOrder = determineSearchOrder(parsed);
    console.log(`   検索順序: ${searchOrder.join(' → ')}`);
    
    const citationResult = {
      citation: citation.substring(0, 100),
      type: parsed.type,
      language: parsed.isJapanese ? 'ja' : 'en',
      searchOrder,
      apiResults: []
    };

    let foundInPrevious = false;

    // 各APIで検索
    for (const api of searchOrder) {
      const result = await searchAPI(api, parsed);
      citationResult.apiResults.push(result);
      
      // 統計の更新
      apiStats[api].searches++;
      apiStats[api].totalTime += result.responseTime;
      
      if (result.found) {
        apiStats[api].found++;
        console.log(`   ✅ ${api}: ${result.resultCount}件 (${result.responseTime}ms)`);
        
        // 既に前のAPIで見つかっていた場合は「不要」としてカウント
        if (foundInPrevious) {
          apiStats[api].unnecessary++;
        }
        foundInPrevious = true;
      } else {
        console.log(`   ❌ ${api}: 0件 (${result.responseTime}ms) ${result.error ? `- ${result.error}` : ''}`);
      }
    }
    
    results.push(citationResult);
    
    // レート制限を考慮して少し待機
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 結果の集計と分析
  console.log('\n\n📊 === API戦略分析結果 ===\n');
  
  // 各APIの統計
  console.log('🔍 API別統計:');
  for (const [api, stats] of Object.entries(apiStats)) {
    if (stats.searches > 0) {
      const hitRate = ((stats.found / stats.searches) * 100).toFixed(1);
      const avgTime = Math.round(stats.totalTime / stats.searches);
      const unnecessaryRate = ((stats.unnecessary / stats.searches) * 100).toFixed(1);
      
      console.log(`\n${api}:`);
      console.log(`  - 検索回数: ${stats.searches}`);
      console.log(`  - ヒット数: ${stats.found} (${hitRate}%)`);
      console.log(`  - 平均応答時間: ${avgTime}ms`);
      console.log(`  - 不要な検索: ${stats.unnecessary} (${unnecessaryRate}%)`);
    }
  }

  // 文献タイプ別の分析
  console.log('\n\n📚 文献タイプ別分析:');
  const typeAnalysis = {};
  
  for (const result of results) {
    const key = `${result.type}_${result.language}`;
    if (!typeAnalysis[key]) {
      typeAnalysis[key] = {
        count: 0,
        foundCount: 0,
        apiHits: {}
      };
    }
    
    typeAnalysis[key].count++;
    
    const found = result.apiResults.some(r => r.found);
    if (found) {
      typeAnalysis[key].foundCount++;
    }
    
    // 最初にヒットしたAPI
    const firstHit = result.apiResults.find(r => r.found);
    if (firstHit) {
      const api = firstHit.api;
      typeAnalysis[key].apiHits[api] = (typeAnalysis[key].apiHits[api] || 0) + 1;
    }
  }

  for (const [key, analysis] of Object.entries(typeAnalysis)) {
    const [type, lang] = key.split('_');
    const typeLabel = type === 'book' ? '書籍' : type === 'article' ? '論文' : '不明';
    const langLabel = lang === 'ja' ? '日本語' : '英語';
    
    console.log(`\n${langLabel}${typeLabel}:`);
    console.log(`  - 総数: ${analysis.count}`);
    console.log(`  - 発見数: ${analysis.foundCount} (${((analysis.foundCount / analysis.count) * 100).toFixed(1)}%)`);
    console.log(`  - 最初にヒットしたAPI:`);
    
    for (const [api, count] of Object.entries(analysis.apiHits)) {
      const percentage = ((count / analysis.foundCount) * 100).toFixed(1);
      console.log(`    - ${api}: ${count}件 (${percentage}%)`);
    }
  }

  // 推奨事項
  console.log('\n\n💡 推奨事項:');
  
  // 不要な検索が多いAPIを特定
  const inefficientAPIs = Object.entries(apiStats)
    .filter(([api, stats]) => stats.searches > 0 && (stats.unnecessary / stats.searches) > 0.5)
    .map(([api]) => api);
  
  if (inefficientAPIs.length > 0) {
    console.log(`\n⚠️  以下のAPIは検索順序の後方に移動を検討:`);
    inefficientAPIs.forEach(api => {
      const stats = apiStats[api];
      const unnecessaryRate = ((stats.unnecessary / stats.searches) * 100).toFixed(1);
      console.log(`  - ${api}: ${unnecessaryRate}%が不要な検索`);
    });
  }

  // ヒット率が低いAPIを特定
  const lowHitAPIs = Object.entries(apiStats)
    .filter(([api, stats]) => stats.searches > 10 && (stats.found / stats.searches) < 0.1)
    .map(([api]) => api);
  
  if (lowHitAPIs.length > 0) {
    console.log(`\n⚠️  以下のAPIはヒット率が低い（10%未満）:`);
    lowHitAPIs.forEach(api => {
      const stats = apiStats[api];
      const hitRate = ((stats.found / stats.searches) * 100).toFixed(1);
      console.log(`  - ${api}: ${hitRate}%`);
    });
  }

  // 結果をJSONファイルに保存
  const outputPath = path.join(__dirname, 'api-strategy-test-results.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    testDate: new Date().toISOString(),
    summary: {
      totalCitations: citations.length,
      apiStats,
      typeAnalysis
    },
    details: results
  }, null, 2));
  
  console.log(`\n\n✅ 詳細な結果を保存: ${outputPath}`);
}

// プロキシサーバーが起動していることを確認
async function checkProxyServer() {
  try {
    const response = await fetch('http://localhost:3001/api/crossref?query=test&rows=1');
    return response.ok || response.status === 400; // 400はパラメータエラーなのでサーバーは動作している
  } catch (e) {
    return false;
  }
}

// メイン実行
(async () => {
  console.log('🚀 API探索戦略テストを開始します...\n');
  
  // プロキシサーバーの確認
  console.log('🔍 プロキシサーバーの確認中...');
  const proxyRunning = await checkProxyServer();
  
  if (!proxyRunning) {
    console.error('❌ プロキシサーバーが起動していません。');
    console.error('   別のターミナルで `npm run dev-proxy` を実行してください。');
    process.exit(1);
  }
  
  console.log('✅ プロキシサーバーが稼働中\n');
  
  // テスト実行
  await testAPIStrategy();
})();