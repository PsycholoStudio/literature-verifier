/**
 * 実際の本番環境のAPI探索戦略テスト
 * 段階的検索戦略を完全に再現してテスト
 */

const fs = require('fs');
const path = require('path');

// 引用文献パーサー（本番環境ベース）
function parseCitation(citation) {
  const isJapanese = /[\u4E00-\u9FAF\u3040-\u309F\u30A0-\u30FF]/.test(citation);
  
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
    pages: '',
    isBook: false
  };

  // 年度の抽出
  const yearMatch = citation.match(/\((\d{4})\)|（(\d{4})）|\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    parsed.year = yearMatch[1] || yearMatch[2] || yearMatch[3];
  }

  // 日本語文献のパース
  if (isJapanese) {
    const bookMatch = citation.match(/『([^』]+)』/);
    if (bookMatch) {
      parsed.type = 'book';
      parsed.title = bookMatch[1];
      parsed.isBook = true;
      
      const publisherMatch = citation.match(/』[\s\S]*?([^。、\s]+社|[^。、\s]+書房|[^。、\s]+堂|[^。、\s]+館)/);
      if (publisherMatch) {
        parsed.publisher = publisherMatch[1];
      }
    } else if (citation.includes('「') && citation.includes('」')) {
      parsed.type = 'article';
      const titleMatch = citation.match(/「([^」]+)」/);
      if (titleMatch) {
        parsed.title = titleMatch[1];
      }
    }

    const beforeYear = citation.split(/\(|（/)[0];
    const authorMatch = beforeYear.match(/^([^『「]+?)[\s　]*[『「]/);
    if (authorMatch) {
      parsed.authors = authorMatch[1].split(/[、・]/).map(a => a.trim()).filter(a => a);
    }
  }
  // 英語文献のパース  
  else {
    if (citation.includes('University Press') || citation.includes('Books') || 
        citation.includes('Publishers') || /\w+\.\s*$/.test(citation)) {
      parsed.type = 'book';
      parsed.isBook = true;
    } else if (citation.includes('Journal') || citation.includes('Nature') || 
               citation.includes('Science') || /\d+\(\d+\)/.test(citation)) {
      parsed.type = 'article';
      
      const journalMatch = citation.match(/\.\s+([^,]+),\s*\d+/);
      if (journalMatch) {
        parsed.journal = journalMatch[1];
      }
    }

    const afterYear = citation.split(/\(\d{4}\)/)[1];
    if (afterYear) {
      const titleMatch = afterYear.match(/^\.\s*([^.]+)\./);
      if (titleMatch) {
        parsed.title = titleMatch[1];
      }
    }

    const beforeYear = citation.split(/\(\d{4}\)/)[0];
    if (beforeYear) {
      parsed.authors = beforeYear.split(',').map(a => a.trim()).filter(a => a);
    }
  }

  return parsed;
}

// 実際のAPIハンドラー（本番環境の段階的検索戦略を再現）
class ProductionAPITester {
  constructor() {
    this.API_ENDPOINTS = {
      crossref: 'http://localhost:3001/api/crossref',
      semanticScholar: 'http://localhost:3001/api/semantic-scholar',
      cinii: 'http://localhost:3001/api/cinii',
      ndl: 'http://localhost:3001/api/ndl-search',
      googleBooks: 'http://localhost:3001/api/google-books'
    };
  }

  // CrossRef段階的検索戦略
  async searchCrossRef(parsed) {
    const strategies = [];
    const cleanTitle = parsed.title.replace(/[:;,()[\]"'\.…]/g, ' ').replace(/\s+/g, ' ').trim();
    
    // 段階1: タイトルのみ
    if (cleanTitle) {
      strategies.push({
        query: cleanTitle,
        description: '段階1: タイトルのみ',
        priority: 1
      });
    }
    
    // 段階2: タイトル + 著者
    if (cleanTitle && parsed.authors?.length > 0) {
      const authorName = parsed.authors[0];
      if (parsed.isBook) {
        // 書籍の場合：著者名のバリエーション
        const authorVariations = [authorName];
        if (!/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(authorName)) {
          const nameParts = authorName.split(/[,\s]+/).filter(p => p.trim());
          if (nameParts.length > 1) {
            const lastName = nameParts.includes(',') ? nameParts[0] : nameParts[nameParts.length - 1];
            if (lastName.length > 2) {
              authorVariations.push(lastName);
            }
          }
        }
        
        authorVariations.forEach(authorVar => {
          strategies.push({
            query: `"${cleanTitle}" "${authorVar}"`,
            description: `段階2 (書籍): タイトル+著者 (${authorVar})`,
            priority: 2
          });
        });
      } else {
        strategies.push({
          query: `"${cleanTitle}" "${authorName}"`,
          description: `段階2: タイトル+著者`,
          priority: 2
        });
      }
    }
    
    // 段階3: タイトル + 著者 + 掲載誌
    if (cleanTitle && parsed.authors?.length > 0 && parsed.journal) {
      const authorName = parsed.authors[0];
      strategies.push({
        query: `"${cleanTitle}" "${authorName}" "${parsed.journal}"`,
        description: `段階3: タイトル+著者+掲載誌`,
        priority: 3
      });
    }
    
    // 段階4: 著者中心検索（書籍専用）
    if (parsed.isBook && parsed.authors?.length > 0) {
      const authorName = parsed.authors[0];
      const authorParts = authorName.split(/[,\s]+/).filter(p => p.trim());
      let primaryAuthor = authorName;
      
      if (!/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(authorName) && authorParts.length > 1) {
        primaryAuthor = authorParts.includes(',') ? authorParts[0] : authorParts[authorParts.length - 1];
      }
      
      const titleWords = cleanTitle.split(/\\s+/);
      const shortTitle = titleWords.length > 5 ? titleWords.slice(0, 5).join(' ') : cleanTitle;
      
      strategies.push({
        query: `"${primaryAuthor}" "${shortTitle}"`,
        description: `段階4 (書籍): 著者中心検索`,
        priority: 4
      });
    }

    return await this.executeStrategies('crossref', strategies);
  }

  // Google Books段階的検索戦略
  async searchGoogleBooks(parsed) {
    const strategies = [];
    const cleanTitle = parsed.title.replace(/[:;,()[\]"'\.…]/g, ' ').replace(/\s+/g, ' ').trim();
    
    // 戦略1: フィールド指定による精密検索
    if (parsed.authors?.length > 0) {
      const primaryAuthor = parsed.authors[0];
      const authorVariations = [primaryAuthor];
      
      if (!/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(primaryAuthor)) {
        const nameParts = primaryAuthor.split(/[,\s]+/);
        if (nameParts.length > 1) {
          const lastName = nameParts.includes(',') ? nameParts[0] : nameParts[nameParts.length - 1];
          if (lastName.length > 2) {
            authorVariations.push(lastName);
          }
        }
      }
      
      // 戦略1A: タイトルフィールド + 著者フィールド
      authorVariations.forEach(author => {
        strategies.push({
          query: `intitle:"${cleanTitle}" inauthor:"${author}"`,
          description: `戦略1A: フィールド指定検索 (${author})`,
          priority: 1
        });
      });
      
      // 戦略1B: 著者フィールドのみ
      authorVariations.forEach(author => {
        strategies.push({
          query: `inauthor:"${author}"`,
          description: `戦略1B: 著者フィールド検索 (${author})`,
          priority: 1
        });
      });
    }
    
    // 戦略2: タイトルのみ
    strategies.push({
      query: `intitle:"${cleanTitle}"`,
      description: `戦略2: タイトル完全一致`,
      priority: 2
    });
    
    // 戦略3: 言語特化検索
    const isJapaneseTitle = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(cleanTitle);
    if (isJapaneseTitle) {
      strategies.push({
        query: `"${cleanTitle}"`,
        description: `戦略3A: 日本語全文検索`,
        priority: 3
      });
      
      if (parsed.authors?.length > 0) {
        const primaryAuthor = parsed.authors[0];
        strategies.push({
          query: `"${cleanTitle}" "${primaryAuthor}"`,
          description: `戦略3B: 日本語タイトル+著者検索`,
          priority: 3
        });
      }
    } else {
      const titleWords = cleanTitle.split(/\\s+/);
      if (titleWords.length > 3) {
        const shortTitle = titleWords.slice(0, Math.min(5, titleWords.length)).join(' ');
        strategies.push({
          query: `intitle:"${shortTitle}"`,
          description: `戦略3C: 英語タイトル部分検索`,
          priority: 3
        });
      }
    }

    return await this.executeStrategies('googleBooks', strategies);
  }

  // NDL段階的検索戦略
  async searchNDL(parsed) {
    const strategies = [];
    const cleanTitle = parsed.title.replace(/[:：。]/g, '').replace(/\s+/g, ' ').trim();
    
    // 戦略1: タイトル + 著者
    if (cleanTitle && parsed.authors?.length > 0) {
      const author = parsed.authors[0];
      strategies.push({
        params: { title: cleanTitle, creator: author },
        description: `戦略1: タイトル+著者検索 (${author})`,
        priority: 1
      });
    }
    
    // 戦略2: タイトルのみ
    if (cleanTitle) {
      strategies.push({
        params: { title: cleanTitle },
        description: `戦略2: タイトルのみ検索`,
        priority: 2
      });
    }

    return await this.executeNDLStrategies(strategies);
  }

  // Semantic Scholar検索戦略
  async searchSemanticScholar(parsed) {
    const cleanTitle = parsed.title.replace(/[:;,()[\]"'\.…]/g, ' ').replace(/\s+/g, ' ').trim();
    
    let query = cleanTitle;
    const isShortTitle = cleanTitle.length <= 20;
    
    if (isShortTitle && parsed.journal) {
      query = `${cleanTitle} ${parsed.journal}`;
    }

    const strategies = [{
      query: query,
      description: isShortTitle && parsed.journal ? 
        'タイトル+掲載誌名検索' : 'タイトル検索',
      priority: 1
    }];

    return await this.executeStrategies('semanticScholar', strategies);
  }

  // CiNii検索戦略
  async searchCiNii(parsed) {
    const cleanTitle = parsed.title.replace(/[:;,()[\]"'\.…]/g, ' ').replace(/\s+/g, ' ').trim();
    
    const strategies = [{
      query: cleanTitle,
      description: 'タイトル検索',
      priority: 1
    }];

    return await this.executeStrategies('cinii', strategies);
  }

  // 戦略実行エンジン
  async executeStrategies(apiName, strategies) {
    const results = [];
    const allResults = [];
    
    for (const strategy of strategies) {
      const startTime = Date.now();
      let found = false;
      let resultCount = 0;
      let error = null;
      
      try {
        let url;
        switch(apiName) {
          case 'crossref':
            url = `${this.API_ENDPOINTS.crossref}?query=${encodeURIComponent(strategy.query)}&rows=5`;
            break;
          case 'semanticScholar':
            url = `${this.API_ENDPOINTS.semanticScholar}?query=${encodeURIComponent(strategy.query)}&limit=5`;
            break;
          case 'cinii':
            url = `${this.API_ENDPOINTS.cinii}?q=${encodeURIComponent(strategy.query)}&count=5`;
            break;
          case 'googleBooks':
            url = `${this.API_ENDPOINTS.googleBooks}?q=${encodeURIComponent(strategy.query)}&maxResults=5`;
            break;
        }

        const response = await fetch(url);
        const responseTime = Date.now() - startTime;

        if (response.ok) {
          const contentType = response.headers.get('content-type');
          
          if (contentType && contentType.includes('json')) {
            const data = await response.json();
            
            if (apiName === 'crossref' && data.message?.items) {
              resultCount = data.message.items.length;
              found = resultCount > 0;
            } else if (apiName === 'semanticScholar' && data.data) {
              resultCount = data.data.length;
              found = resultCount > 0;
            } else if (apiName === 'googleBooks' && data.items) {
              resultCount = data.items.length;
              found = resultCount > 0;
            }
          } else if (contentType && contentType.includes('xml')) {
            const xml = await response.text();
            found = xml.includes('<item>');
            resultCount = (xml.match(/<item>/g) || []).length;
          }
        } else {
          error = `HTTP ${response.status}`;
        }

        results.push({
          strategy: strategy.description,
          query: strategy.query,
          priority: strategy.priority,
          found,
          resultCount,
          responseTime,
          error
        });

        // 実際の戦略では、結果が見つかったら次の戦略に進む
        if (found) {
          allResults.push(...Array(resultCount).fill(null));
          // 十分な結果が得られた場合は停止
          if (allResults.length >= 10) break;
        }
        
      } catch (e) {
        results.push({
          strategy: strategy.description,
          query: strategy.query,
          priority: strategy.priority,
          found: false,
          resultCount: 0,
          responseTime: Date.now() - startTime,
          error: e.message
        });
      }
      
      // レート制限考慮
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
      api: apiName,
      strategies: results,
      totalResults: allResults.length
    };
  }

  // NDL専用戦略実行
  async executeNDLStrategies(strategies) {
    const results = [];
    const allResults = [];
    
    for (const strategy of strategies) {
      const startTime = Date.now();
      let found = false;
      let resultCount = 0;
      let error = null;
      
      try {
        const params = new URLSearchParams(strategy.params);
        const url = `${this.API_ENDPOINTS.ndl}?${params}`;

        const response = await fetch(url);
        const responseTime = Date.now() - startTime;

        if (response.ok) {
          const data = await response.json();
          if (data.results) {
            resultCount = data.results.length;
            found = resultCount > 0;
          }
        } else {
          error = `HTTP ${response.status}`;
        }

        results.push({
          strategy: strategy.description,
          params: strategy.params,
          priority: strategy.priority,
          found,
          resultCount,
          responseTime,
          error
        });

        if (found) {
          allResults.push(...Array(resultCount).fill(null));
          if (allResults.length >= 10) break;
        }
        
      } catch (e) {
        results.push({
          strategy: strategy.description,
          params: strategy.params,
          priority: strategy.priority,
          found: false,
          resultCount: 0,
          responseTime: Date.now() - startTime,
          error: e.message
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
      api: 'ndl',
      strategies: results,
      totalResults: allResults.length
    };
  }

  // 文献タイプ別検索順序の決定
  determineSearchOrder(parsed) {
    const { type, isJapanese } = parsed;
    
    if (type === 'book') {
      if (isJapanese) {
        return ['ndl', 'cinii', 'googleBooks'];
      } else {
        return ['googleBooks', 'cinii'];
      }
    } else if (type === 'article') {
      if (isJapanese) {
        return ['cinii', 'crossref', 'ndl'];
      } else {
        return ['crossref', 'semanticScholar', 'cinii'];
      }
    }
    
    return isJapanese ? 
      ['cinii', 'ndl', 'crossref', 'googleBooks'] :
      ['crossref', 'semanticScholar', 'googleBooks', 'cinii'];
  }
}

// メインテスト関数
async function testProductionAPIStrategy() {
  const tester = new ProductionAPITester();
  
  // テストデータの読み込み
  const citations = fs.readFileSync(
    path.join(__dirname, 'test_citations.txt'), 
    'utf-8'
  ).split('\n').filter(line => line.trim() && !line.match(/^\d+$/));

  console.log(`📚 ${citations.length}件の文献で本番環境の段階的検索戦略をテスト開始\n`);

  // ログファイル準備
  const logFile = path.join(__dirname, 'api-strategy-test.log');
  const resultFile = path.join(__dirname, 'api-strategy-results.jsonl');
  
  // ログファイルを初期化（追記モード）
  if (!fs.existsSync(logFile)) {
    fs.writeFileSync(logFile, `=== API戦略テスト開始 ${new Date().toISOString()} ===\n`);
  } else {
    fs.appendFileSync(logFile, `=== API戦略テスト再開 ${new Date().toISOString()} ===\n`);
  }
  
  if (!fs.existsSync(resultFile)) {
    fs.writeFileSync(resultFile, '');
  }

  const strategyStats = {};
  const results = [];

  // 既に処理済みの件数を確認
  let startIndex = 0;
  if (fs.existsSync(resultFile)) {
    const existingLines = fs.readFileSync(resultFile, 'utf-8').split('\n').filter(line => line.trim());
    startIndex = existingLines.length;
    console.log(`📋 既に${startIndex}件処理済み、${startIndex + 1}件目から再開します`);
  }

  // 各文献をテスト
  for (let i = startIndex; i < citations.length; i++) { // 全件テスト
    const citation = citations[i];
    console.log(`\n📖 [${i + 1}] ${citation.substring(0, 80)}...`);
    
    const parsed = parseCitation(citation);
    console.log(`   タイプ: ${parsed.type} | 言語: ${parsed.isJapanese ? '日本語' : '英語'} | 書籍: ${parsed.isBook}`);
    
    const searchOrder = tester.determineSearchOrder(parsed);
    console.log(`   検索順序: ${searchOrder.join(' → ')}`);
    
    const citationResult = {
      citation: citation.substring(0, 100),
      parsed: {
        type: parsed.type,
        language: parsed.isJapanese ? 'ja' : 'en',
        isBook: parsed.isBook,
        title: parsed.title,
        authors: parsed.authors
      },
      searchOrder,
      apiResults: []
    };

    // 各APIで段階的検索を実行
    for (const api of searchOrder) {
      console.log(`\n🔍 ${api} API 段階的検索開始:`);
      
      let apiResult;
      switch(api) {
        case 'crossref':
          apiResult = await tester.searchCrossRef(parsed);
          break;
        case 'googleBooks':
          apiResult = await tester.searchGoogleBooks(parsed);
          break;
        case 'ndl':
          apiResult = await tester.searchNDL(parsed);
          break;
        case 'semanticScholar':
          apiResult = await tester.searchSemanticScholar(parsed);
          break;
        case 'cinii':
          apiResult = await tester.searchCiNii(parsed);
          break;
      }
      
      citationResult.apiResults.push(apiResult);
      
      // 戦略別統計の更新
      if (!strategyStats[api]) {
        strategyStats[api] = {
          totalExecutions: 0,
          strategiesUsed: {},
          totalResults: 0
        };
      }
      
      strategyStats[api].totalExecutions++;
      strategyStats[api].totalResults += apiResult.totalResults;
      
      // 各戦略の実行統計
      apiResult.strategies.forEach(strategy => {
        const key = `${strategy.priority}_${strategy.strategy}`;
        if (!strategyStats[api].strategiesUsed[key]) {
          strategyStats[api].strategiesUsed[key] = {
            executions: 0,
            hits: 0,
            totalTime: 0
          };
        }
        
        strategyStats[api].strategiesUsed[key].executions++;
        if (strategy.found) {
          strategyStats[api].strategiesUsed[key].hits++;
        }
        strategyStats[api].strategiesUsed[key].totalTime += strategy.responseTime;
        
        const status = strategy.found ? 
          `✅ ${strategy.resultCount}件 (${strategy.responseTime}ms)` : 
          `❌ 0件 (${strategy.responseTime}ms)`;
        console.log(`     ${strategy.strategy}: ${status}`);
      });
      
      console.log(`   📊 ${api} 総結果: ${apiResult.totalResults}件`);
    }
    
    // 結果をJSONL形式で即座にファイルに書き込み（メモリ節約）
    fs.appendFileSync(resultFile, JSON.stringify(citationResult) + '\n');
    
    // ログファイルにも進捗情報を記録
    const logEntry = `[${new Date().toISOString()}] ${i + 1}/${citations.length} completed: ${citation.substring(0, 50)}...\n`;
    fs.appendFileSync(logFile, logEntry);
    
    // メモリ使用量を抑えるため、結果配列には最小限の情報のみ保持
    results.push({
      index: i + 1,
      citation: citation.substring(0, 50),
      type: citationResult.parsed.type,
      language: citationResult.parsed.language,
      totalApis: citationResult.apiResults.length,
      totalResults: citationResult.apiResults.reduce((sum, api) => sum + api.totalResults, 0)
    });
    
    // レート制限を考慮
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 結果の分析
  console.log('\n\n📊 === 本番環境段階的検索戦略分析結果 ===\n');
  
  // API別戦略分析
  console.log('🔍 API別戦略分析:');
  for (const [api, stats] of Object.entries(strategyStats)) {
    console.log(`\n${api}:`);
    console.log(`  - 実行回数: ${stats.totalExecutions}`);
    console.log(`  - 平均結果数: ${(stats.totalResults / stats.totalExecutions).toFixed(1)}`);
    console.log(`  - 戦略別詳細:`);
    
    for (const [strategyKey, strategyStats] of Object.entries(stats.strategiesUsed)) {
      const hitRate = ((strategyStats.hits / strategyStats.executions) * 100).toFixed(1);
      const avgTime = Math.round(strategyStats.totalTime / strategyStats.executions);
      const [priority, description] = strategyKey.split('_', 2);
      
      console.log(`    P${priority} ${description}: ${strategyStats.hits}/${strategyStats.executions} (${hitRate}%) ${avgTime}ms`);
    }
  }
  
  // 段階的検索の効果分析と無駄の検出
  console.log('\n\n💡 段階的検索の効果分析と無駄の検出:');
  
  let totalWastedExecutions = 0;
  let totalWastedTime = 0;
  const wasteAnalysis = {};
  
  // JSONLファイルから結果を読み込んで分析
  const resultLines = fs.readFileSync(resultFile, 'utf-8').split('\n').filter(line => line.trim());
  
  for (const line of resultLines) {
    const result = JSON.parse(line);
    console.log(`\n📖 ${result.citation}...`);
    
    for (const apiResult of result.apiResults) {
      const api = apiResult.api;
      const strategies = apiResult.strategies;
      
      if (strategies.length > 1) {
        console.log(`  ${api}:`);
        
        let cumulativeResults = 0;
        let wastedExecutions = 0;
        let wastedTime = 0;
        
        strategies.forEach((strategy, index) => {
          const prevCumulativeResults = cumulativeResults;
          cumulativeResults += strategy.resultCount;
          
          const contribution = strategy.resultCount > 0 ? 
            `+${strategy.resultCount}件` : '0件';
          
          // 無駄の判定
          let wasteReason = '';
          let isWasted = false;
          
          if (index > 0) {
            // 既に十分な結果が得られている場合
            if (prevCumulativeResults >= 10) {
              wasteReason = ' [無駄: 既に十分な結果]';
              isWasted = true;
            }
            // 新しい結果が得られなかった場合
            else if (strategy.resultCount === 0) {
              wasteReason = ' [無駄: 新規結果なし]';
              isWasted = true;
            }
            // 最初の段階で十分な結果が得られていた場合
            else if (strategies[0].resultCount >= 5 && index > 1) {
              wasteReason = ' [無駄: 初期段階で十分]';
              isWasted = true;
            }
          }
          
          if (isWasted) {
            wastedExecutions++;
            wastedTime += strategy.responseTime;
            totalWastedExecutions++;
            totalWastedTime += strategy.responseTime;
          }
          
          console.log(`    ${index + 1}. ${strategy.strategy}: ${contribution} (累計: ${cumulativeResults}件, ${strategy.responseTime}ms)${wasteReason}`);
        });
        
        // API別の無駄統計
        if (!wasteAnalysis[api]) {
          wasteAnalysis[api] = {
            totalExecutions: 0,
            wastedExecutions: 0,
            totalTime: 0,
            wastedTime: 0
          };
        }
        
        wasteAnalysis[api].totalExecutions += strategies.length;
        wasteAnalysis[api].wastedExecutions += wastedExecutions;
        wasteAnalysis[api].totalTime += strategies.reduce((sum, s) => sum + s.responseTime, 0);
        wasteAnalysis[api].wastedTime += wastedTime;
        
        // 段階的検索の効果測定
        const firstStageResults = strategies[0]?.resultCount || 0;
        const totalResults = cumulativeResults;
        const additionalResults = totalResults - firstStageResults;
        
        if (additionalResults > 0) {
          console.log(`    📈 段階的検索効果: +${additionalResults}件 (${((additionalResults / totalResults) * 100).toFixed(1)}%)`);
        }
        
        if (wastedExecutions > 0) {
          console.log(`    ⚠️  無駄な実行: ${wastedExecutions}/${strategies.length} (${wastedTime}ms)`);
        }
      }
    }
  }
  
  // 無駄の統計サマリー
  console.log('\n\n⚠️  === 無駄な実行の統計 ===');
  console.log(`\n全体統計:`);
  console.log(`  - 総無駄実行数: ${totalWastedExecutions}`);
  console.log(`  - 総無駄時間: ${totalWastedTime}ms (${(totalWastedTime / 1000).toFixed(1)}秒)`);
  
  console.log(`\nAPI別無駄統計:`);
  for (const [api, stats] of Object.entries(wasteAnalysis)) {
    const wasteRate = ((stats.wastedExecutions / stats.totalExecutions) * 100).toFixed(1);
    const timeWasteRate = ((stats.wastedTime / stats.totalTime) * 100).toFixed(1);
    
    console.log(`\n${api}:`);
    console.log(`  - 無駄実行率: ${stats.wastedExecutions}/${stats.totalExecutions} (${wasteRate}%)`);
    console.log(`  - 無駄時間率: ${stats.wastedTime}ms/${stats.totalTime}ms (${timeWasteRate}%)`);
    console.log(`  - 平均無駄時間: ${stats.wastedExecutions > 0 ? Math.round(stats.wastedTime / stats.wastedExecutions) : 0}ms`);
  }
  
  // 改善提案
  console.log('\n\n🔧 === 改善提案 ===');
  
  for (const [api, stats] of Object.entries(wasteAnalysis)) {
    const wasteRate = (stats.wastedExecutions / stats.totalExecutions) * 100;
    
    if (wasteRate > 30) {
      console.log(`\n${api} (無駄率: ${wasteRate.toFixed(1)}%):`);
      console.log(`  - 早期終了条件の導入を検討`);
      console.log(`  - 初期段階での結果数閾値を下げる`);
      console.log(`  - 低効果戦略の除去を検討`);
    }
  }
  
  // 最適化された戦略の提案
  console.log('\n\n💡 === 最適化された戦略の提案 ===');
  
  for (const line of resultLines) {
    const result = JSON.parse(line);
    for (const apiResult of result.apiResults) {
      const api = apiResult.api;
      const strategies = apiResult.strategies;
      
      if (strategies.length > 1) {
        const effectiveStrategies = [];
        let cumulativeResults = 0;
        
        for (const strategy of strategies) {
          const prevResults = cumulativeResults;
          cumulativeResults += strategy.resultCount;
          
          // 効果的な戦略の判定
          if (strategy.resultCount > 0 || prevResults < 5) {
            effectiveStrategies.push(strategy);
          }
          
          // 十分な結果が得られたら停止
          if (cumulativeResults >= 10) {
            break;
          }
        }
        
        if (effectiveStrategies.length < strategies.length) {
          console.log(`\n${api} (文献: ${result.citation.substring(0, 50)}...):`);
          console.log(`  現在: ${strategies.length}段階 → 最適化: ${effectiveStrategies.length}段階`);
          console.log(`  削減可能: ${strategies.length - effectiveStrategies.length}段階`);
          
          const originalTime = strategies.reduce((sum, s) => sum + s.responseTime, 0);
          const optimizedTime = effectiveStrategies.reduce((sum, s) => sum + s.responseTime, 0);
          const timeSaving = originalTime - optimizedTime;
          
          if (timeSaving > 0) {
            console.log(`  時間短縮: ${timeSaving}ms (${((timeSaving / originalTime) * 100).toFixed(1)}%)`);
          }
        }
      }
    }
  }
  
  // 結果保存
  const outputPath = path.join(__dirname, 'production-api-strategy-results.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    testDate: new Date().toISOString(),
    summary: {
      totalCitations: results.length,
      strategyStats,
      wasteAnalysis
    },
    basicResults: results
  }, null, 2));
  
  console.log(`\n\n✅ 詳細な結果を保存:`);
  console.log(`   - サマリー: ${outputPath}`);
  console.log(`   - 詳細結果: ${resultFile}`);
  console.log(`   - 実行ログ: ${logFile}`);
  console.log(`\n📊 テスト完了: ${results.length}件の文献をテスト`);
}

// プロキシサーバーチェック
async function checkProxyServer() {
  try {
    const response = await fetch('http://localhost:3001/api/crossref?query=test&rows=1');
    return response.ok || response.status === 400;
  } catch (e) {
    return false;
  }
}

// メイン実行
(async () => {
  console.log('🚀 本番環境API段階的検索戦略テストを開始します...\n');
  
  console.log('🔍 プロキシサーバーの確認中...');
  const proxyRunning = await checkProxyServer();
  
  if (!proxyRunning) {
    console.error('❌ プロキシサーバーが起動していません。');
    console.error('   別のターミナルで `npm run dev-proxy` を実行してください。');
    process.exit(1);
  }
  
  console.log('✅ プロキシサーバーが稼働中\n');
  
  await testProductionAPIStrategy();
})();