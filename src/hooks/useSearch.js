import { useState, useCallback } from 'react';
import { parseLiterature } from '../utils/citationParser';
import { searchAllDatabases } from '../services/apiService';
import { 
  analyzeAndRankCandidates,
  determineResultStatus, 
  updateStatistics 
} from '../utils/comparisonUtils';
import { generateCitation, formatCandidateCitation, generateColoredCitation } from '../utils/citationFormatter';

export const useSearch = () => {
  const [results, setResults] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProcessing, setCurrentProcessing] = useState(0);
  const [statistics, setStatistics] = useState({ found: 0, similar: 0, notFound: 0 });
  const [apiStatus, setApiStatus] = useState(null);

  const processLiteratureList = useCallback(async (inputText, citationStyle) => {
    if (!inputText.trim()) return;

    const lines = inputText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return;

    setIsProcessing(true);
    setCurrentProcessing(0);
    setResults([]);
    setStatistics({ found: 0, similar: 0, notFound: 0 });
    setApiStatus({});

    const newResults = [];
    console.log(`🚀 文献処理開始: ${lines.length}件の文献を処理します`);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      setCurrentProcessing(i + 1);

      try {
        // 文献情報の解析
        const parsedInfo = parseLiterature(line);
        console.log('解析された文献情報:', parsedInfo);

        // API検索の実行
        console.log(`🔍 文献 ${i + 1}/${lines.length} の検索開始: "${line}"`);
        
        // 🔧 API検索の確実な完了待機
        console.log(`⏳ 文献 ${i + 1}/${lines.length} のAPI検索を確実に完了まで待機中...`);
        const searchResults = await searchAllDatabases(parsedInfo, (source, status, resultCount) => {
          setApiStatus(prev => ({
            ...prev,
            [source]: { status, resultCount }
          }));
        });
        
        // 🔧 API検索完了の確実な確認
        console.log(`✅ 文献 ${i + 1}/${lines.length} の検索完了: ${searchResults.length}件の結果`);
        console.log(`🔒 文献 ${i + 1}/${lines.length} の検索結果を確実に受信済み - 次の処理へ`);

        // 複数候補をランキング分析
        console.log(`🔍 文献 ${i + 1}/${lines.length} の候補分析開始: ${searchResults.length}件の候補`);
        const rankedCandidates = analyzeAndRankCandidates(parsedInfo, searchResults);
        console.log(`✅ 文献 ${i + 1}/${lines.length} の候補分析完了: ${rankedCandidates.length}件の候補`);
        
        // 最も類似した結果を取得（後方互換性）
        const mostSimilarResult = rankedCandidates.length > 0 ? rankedCandidates[0] : null;
        console.log(`🎯 文献 ${i + 1}/${lines.length} の最適候補: ${mostSimilarResult ? `"${mostSimilarResult.title}"` : 'なし'}`);
        
        // 結果のステータスを決定
        const status = determineResultStatus(parsedInfo, mostSimilarResult);
        console.log(`📊 文献 ${i + 1}/${lines.length} の判定結果: ${status}`);

        // 引用形式を生成
        console.log(`📝 文献 ${i + 1}/${lines.length} の引用形式生成開始`);
        const correctedCitation = mostSimilarResult ? 
          formatCandidateCitation(mostSimilarResult, parsedInfo, citationStyle) : '';
        console.log(`📝 文献 ${i + 1}/${lines.length} の通常引用: ${correctedCitation ? '生成完了' : '生成なし'}`);
        
        const coloredCitation = mostSimilarResult ?
          generateColoredCitation(parsedInfo, mostSimilarResult, citationStyle) : '';
        console.log(`🎨 文献 ${i + 1}/${lines.length} の色付き引用: ${coloredCitation ? '生成完了' : '生成なし'}`);

        const result = {
          originalText: line,
          parsedInfo,
          searchResults,
          rankedCandidates,
          mostSimilarResult,
          status,
          correctedCitation,
          coloredCitation
        };

        newResults.push(result);
        console.log(`📋 文献 ${i + 1}/${lines.length} の結果オブジェクト作成完了`);
        
        // 🔧 React状態更新の確実な実行
        console.log(`🔄 文献 ${i + 1}/${lines.length} のReact状態更新開始`);
        setResults([...newResults]);
        
        // 統計を更新
        const newStats = updateStatistics(newResults);
        setStatistics(newStats);
        console.log(`📊 文献 ${i + 1}/${lines.length} の統計更新完了: found=${newStats.found}, similar=${newStats.similar}, not_found=${newStats.notFound}`);
        
        // 🔧 UI更新の確実な完了待機（時間を延長）
        await new Promise(resolve => setTimeout(resolve, 200));
        
        console.log(`✅ 文献 ${i + 1}/${lines.length} の処理完了`);
        console.log(`🔒 文献 ${i + 1}/${lines.length} の結果をUI更新完了 - 次の文献へ`);

      } catch (error) {
        console.error('検索エラー:', error);
        const errorResult = {
          originalText: line,
          parsedInfo: { title: line },
          searchResults: [],
          mostSimilarResult: null,
          status: 'not_found',
          correctedCitation: '',
          coloredCitation: '',
          error: error.message
        };

        newResults.push(errorResult);
        setResults([...newResults]);
      }
    }

    // 🔧 重複除去処理（全ての検索結果処理完了後）
    const deduplicatedResults = removeDuplicates(newResults);
    setResults(deduplicatedResults);
    
    console.log(`🎉 全ての文献処理完了: ${lines.length}件の文献を処理しました`);
    
    setIsProcessing(false);
    setCurrentProcessing(0);
    // APIステータスは保持して完了状態を表示し続ける
  }, []);

  // 重複除去関数（タイトル + 著者 + 年度 + 元文献URL）
  const removeDuplicates = (results) => {
    console.log(`🔄 重複除去開始: ${results.length}件の結果を処理`);
    
    const deduplicatedResults = [];
    const seenCitations = new Map();
    
    for (const result of results) {
      // 重複判定のキーを作成（タイトル + 著者 + 年度 + URL）
      const mostSimilar = result.mostSimilarResult;
      if (!mostSimilar || !mostSimilar.title) {
        // 候補がない場合はそのまま追加
        deduplicatedResults.push(result);
        continue;
      }
      
      const key = `${mostSimilar.title.toLowerCase().trim()}|${(mostSimilar.authors || []).join('|')}|${mostSimilar.year || ''}|${mostSimilar.url || ''}`;
      
      if (seenCitations.has(key)) {
        // 重複発見
        const existingResult = seenCitations.get(key);
        console.log(`🔄 重複発見: "${mostSimilar.title}" (URL: ${mostSimilar.url || 'なし'}) - 元のテキスト: "${result.originalText}"`);
        
        // より高い類似度の結果を保持
        const existingSimilarity = existingResult.mostSimilarResult?.similarity || 0;
        const currentSimilarity = mostSimilar.similarity || 0;
        
        if (currentSimilarity > existingSimilarity) {
          console.log(`🔄 重複置換: 類似度 ${existingSimilarity}% → ${currentSimilarity}%`);
          
          // 既存の結果を削除して新しい結果を追加
          const existingIndex = deduplicatedResults.findIndex(r => r === existingResult);
          if (existingIndex !== -1) {
            deduplicatedResults[existingIndex] = result;
            seenCitations.set(key, result);
          }
        } else {
          console.log(`🔄 重複スキップ: 類似度 ${currentSimilarity}% < ${existingSimilarity}%`);
        }
      } else {
        // 新しい結果
        deduplicatedResults.push(result);
        seenCitations.set(key, result);
      }
    }
    
    console.log(`✅ 重複除去完了: ${results.length}件 → ${deduplicatedResults.length}件 (${results.length - deduplicatedResults.length}件除去)`);
    return deduplicatedResults;
  };

  const clearResults = useCallback(() => {
    setResults([]);
    setStatistics({ found: 0, similar: 0, notFound: 0 });
    setCurrentProcessing(0);
    setApiStatus({});
  }, []);

  return {
    results,
    isProcessing,
    currentProcessing,
    statistics,
    apiStatus,
    processLiteratureList,
    clearResults
  };
};