import { useState, useCallback } from 'react';
import { parseLiterature } from '../utils/citationParser';
import { searchAllDatabases } from '../services/apiService';
import { 
  analyzeAndRankCandidates,
  determineResultStatus, 
  updateStatistics 
} from '../utils/comparisonUtils';
import { generateCitation, generateColoredCitation } from '../utils/citationFormatter';

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

    const newResults = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      setCurrentProcessing(i + 1);

      try {
        // 文献情報の解析
        const parsedInfo = parseLiterature(line);
        console.log('解析された文献情報:', parsedInfo);

        // API検索の実行
        setApiStatus({});
        const searchResults = await searchAllDatabases(parsedInfo, (source, status, resultCount) => {
          setApiStatus(prev => ({
            ...prev,
            [source]: { status, resultCount }
          }));
        });

        // 複数候補をランキング分析
        const rankedCandidates = analyzeAndRankCandidates(parsedInfo, searchResults);
        
        // 最も類似した結果を取得（後方互換性）
        const mostSimilarResult = rankedCandidates.length > 0 ? rankedCandidates[0] : null;
        
        // 結果のステータスを決定
        const status = determineResultStatus(parsedInfo, mostSimilarResult);

        // 引用形式を生成
        const correctedCitation = mostSimilarResult ? 
          generateCitation(parsedInfo, mostSimilarResult, citationStyle) : '';
        
        const coloredCitation = mostSimilarResult ?
          generateColoredCitation(parsedInfo, mostSimilarResult, citationStyle) : '';

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
        setResults([...newResults]);

        // 統計を更新
        const newStats = updateStatistics(newResults);
        setStatistics(newStats);

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

    setIsProcessing(false);
    setCurrentProcessing(0);
    setApiStatus(null);
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setStatistics({ found: 0, similar: 0, notFound: 0 });
    setCurrentProcessing(0);
    setApiStatus(null);
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