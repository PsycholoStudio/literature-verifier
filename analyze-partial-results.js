/**
 * 現在までの部分的な結果を分析するスクリプト
 */

const fs = require('fs');
const path = require('path');

function analyzePartialResults() {
  const resultFile = path.join(__dirname, 'api-strategy-results.jsonl');
  
  if (!fs.existsSync(resultFile)) {
    console.log('❌ 結果ファイルが見つかりません');
    return;
  }

  const lines = fs.readFileSync(resultFile, 'utf-8').split('\n').filter(line => line.trim());
  
  console.log(`📊 現在までの結果分析 (${lines.length}件の文献)`);
  console.log('=' .repeat(50));
  
  let totalStrategies = 0;
  let totalWastedStrategies = 0;
  let totalTime = 0;
  let totalWastedTime = 0;
  
  const apiStats = {};
  const wasteByApi = {};
  
  // 各結果を分析
  lines.forEach((line, index) => {
    const result = JSON.parse(line);
    
    console.log(`\n📖 [${index + 1}] ${result.citation}`);
    console.log(`   タイプ: ${result.parsed.type} | 言語: ${result.parsed.language} | 検索順序: ${result.searchOrder.join(' → ')}`);
    
    result.apiResults.forEach(apiResult => {
      const api = apiResult.api;
      const strategies = apiResult.strategies;
      
      if (!apiStats[api]) {
        apiStats[api] = { executions: 0, hits: 0, totalTime: 0, results: 0 };
      }
      if (!wasteByApi[api]) {
        wasteByApi[api] = { wastedStrategies: 0, wastedTime: 0 };
      }
      
      if (strategies.length > 0) {
        console.log(`   ${api}:`);
        
        let cumulativeResults = 0;
        let apiWastedStrategies = 0;
        let apiWastedTime = 0;
        
        strategies.forEach((strategy, strategyIndex) => {
          const prevResults = cumulativeResults;
          cumulativeResults += strategy.resultCount;
          
          const status = strategy.found ? '✅' : '❌';
          let wasteInfo = '';
          
          // 無駄の判定
          if (strategyIndex > 0) {
            if (prevResults >= 10) {
              wasteInfo = ' [無駄: 既に十分な結果]';
              apiWastedStrategies++;
              apiWastedTime += strategy.responseTime;
            } else if (strategy.resultCount === 0) {
              wasteInfo = ' [無駄: 新規結果なし]';
              apiWastedStrategies++;
              apiWastedTime += strategy.responseTime;
            }
          }
          
          console.log(`     ${strategyIndex + 1}. ${strategy.strategy}: ${status} ${strategy.resultCount}件 (${strategy.responseTime}ms)${wasteInfo}`);
          
          apiStats[api].executions++;
          apiStats[api].totalTime += strategy.responseTime;
          if (strategy.found) {
            apiStats[api].hits++;
          }
          totalStrategies++;
          totalTime += strategy.responseTime;
        });
        
        apiStats[api].results += apiResult.totalResults;
        wasteByApi[api].wastedStrategies += apiWastedStrategies;
        wasteByApi[api].wastedTime += apiWastedTime;
        totalWastedStrategies += apiWastedStrategies;
        totalWastedTime += apiWastedTime;
        
        console.log(`     📊 ${api} 総結果: ${apiResult.totalResults}件`);
        if (apiWastedStrategies > 0) {
          console.log(`     ⚠️  無駄: ${apiWastedStrategies}戦略 (${apiWastedTime}ms)`);
        }
      }
    });
  });
  
  // 全体統計
  console.log('\n\n📊 === 現在までの統計 ===');
  console.log(`\n全体統計:`);
  console.log(`  - 処理文献数: ${lines.length}件`);
  console.log(`  - 総戦略実行数: ${totalStrategies}`);
  console.log(`  - 無駄戦略数: ${totalWastedStrategies} (${((totalWastedStrategies / totalStrategies) * 100).toFixed(1)}%)`);
  console.log(`  - 総実行時間: ${totalTime}ms (${(totalTime / 1000).toFixed(1)}秒)`);
  console.log(`  - 無駄時間: ${totalWastedTime}ms (${(totalWastedTime / 1000).toFixed(1)}秒, ${((totalWastedTime / totalTime) * 100).toFixed(1)}%)`);
  
  // API別統計
  console.log(`\nAPI別統計:`);
  Object.entries(apiStats).forEach(([api, stats]) => {
    const hitRate = stats.executions > 0 ? (stats.hits / stats.executions * 100).toFixed(1) : 0;
    const avgTime = stats.executions > 0 ? Math.round(stats.totalTime / stats.executions) : 0;
    const wasteRate = stats.executions > 0 ? (wasteByApi[api].wastedStrategies / stats.executions * 100).toFixed(1) : 0;
    
    console.log(`\n${api}:`);
    console.log(`  - 実行数: ${stats.executions}`);
    console.log(`  - ヒット数: ${stats.hits} (${hitRate}%)`);
    console.log(`  - 総結果数: ${stats.results}`);
    console.log(`  - 平均応答時間: ${avgTime}ms`);
    console.log(`  - 無駄実行: ${wasteByApi[api].wastedStrategies} (${wasteRate}%)`);
    console.log(`  - 無駄時間: ${wasteByApi[api].wastedTime}ms (${(wasteByApi[api].wastedTime / 1000).toFixed(1)}秒)`);
  });
  
  // 問題の特定
  console.log('\n\n🔍 === 問題の特定 ===');
  
  // CiNiiの状況
  if (apiStats.cinii) {
    const ciniiHitRate = apiStats.cinii.hits / apiStats.cinii.executions * 100;
    console.log(`\nCiNii分析:`);
    console.log(`  - ヒット率: ${ciniiHitRate.toFixed(1)}%`);
    if (ciniiHitRate < 5) {
      console.log(`  ⚠️  CiNiiは日本語学術論文に特化しているため、このテストセットでは低いヒット率となっています`);
    }
  }
  
  // 無駄が多いAPI
  const wasteThreshold = 30;
  Object.entries(wasteByApi).forEach(([api, waste]) => {
    if (apiStats[api].executions > 0) {
      const wasteRate = (waste.wastedStrategies / apiStats[api].executions) * 100;
      if (wasteRate > wasteThreshold) {
        console.log(`\n⚠️  ${api} は無駄率が高い (${wasteRate.toFixed(1)}%):`);
        console.log(`     - 早期終了条件の導入を検討`);
        console.log(`     - 戦略順序の見直しを検討`);
      }
    }
  });
  
  // パース失敗のケース
  const parseFailures = lines.filter(line => {
    const result = JSON.parse(line);
    return result.parsed.type === 'unknown' || result.parsed.title === '';
  });
  
  if (parseFailures.length > 0) {
    console.log(`\n⚠️  パース失敗: ${parseFailures.length}件`);
    parseFailures.forEach(line => {
      const result = JSON.parse(line);
      console.log(`     - ${result.citation}`);
    });
  }
  
  // 最も効果的なAPI
  const effectiveAPIs = Object.entries(apiStats)
    .filter(([api, stats]) => stats.executions > 0)
    .sort((a, b) => (b[1].hits / b[1].executions) - (a[1].hits / a[1].executions))
    .slice(0, 3);
  
  console.log(`\n✅ 最も効果的なAPI (ヒット率順):`);
  effectiveAPIs.forEach(([api, stats], index) => {
    const hitRate = (stats.hits / stats.executions * 100).toFixed(1);
    console.log(`   ${index + 1}. ${api}: ${hitRate}% (${stats.hits}/${stats.executions})`);
  });
}

analyzePartialResults();