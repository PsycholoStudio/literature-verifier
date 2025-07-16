import React, { useState, useEffect } from 'react';

// コンポーネント
import Header from './components/Header';
import CitationInput from './components/CitationInput';
import ProcessingStatus from './components/ProcessingStatus';
import StatisticsDisplay from './components/StatisticsDisplay';
import SearchResults from './components/SearchResults';
import Footer from './components/Footer';
import FloatingProgressPopup from './components/FloatingProgressPopup';

// カスタムフック
import { useSearch } from './hooks/useSearch';
import useElementVisibility from './hooks/useElementVisibility';

// 定数
import { CITATION_STYLES } from './constants';

const LiteratureVerifier = () => {
  const [inputText, setInputText] = useState('');
  const [citationStyle, setCitationStyle] = useState(CITATION_STYLES.APA);

  const {
    results,
    isProcessing,
    currentProcessing,
    currentLiterature,
    statistics,
    apiStatus,
    processLiteratureList,
    clearResults
  } = useSearch();

  // 進捗状況カードの可視性を検知
  const [progressStatusRef, isProgressStatusVisible] = useElementVisibility({
    threshold: 0.1,
    rootMargin: '0px'
  });

  // 進捗状況カードが存在しない場合の処理
  const hasProgressStatus = isProcessing || (apiStatus && Object.keys(apiStatus).length > 0);
  // カードが存在しない場合は見えているとみなす（true）
  // カードが存在する場合は実際の可視性を使用
  const effectiveProgressVisibility = hasProgressStatus ? isProgressStatusVisible : true;
  
  // デバッグログ
  useEffect(() => {
    console.log('LiteratureVerifier - Progress visibility:', {
      hasProgressStatus,
      isProgressStatusVisible,
      effectiveProgressVisibility,
      isProcessing,
      apiStatusKeys: apiStatus ? Object.keys(apiStatus) : []
    });
  }, [hasProgressStatus, isProgressStatusVisible, effectiveProgressVisibility, isProcessing, apiStatus]);

  const handleVerification = async () => {
    if (!inputText.trim() || isProcessing) return;
    
    await processLiteratureList(inputText, citationStyle);
  };

  const handleCopy = (text) => {
    console.log('引用がコピーされました:', text);
  };

  const handleClear = () => {
    setInputText('');
    clearResults();
  };

  const totalItems = inputText.split('\n').filter(line => line.trim()).length;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Header />

        <CitationInput
          inputText={inputText}
          onInputChange={setInputText}
          onSubmit={handleVerification}
          isProcessing={isProcessing}
          citationStyle={citationStyle}
          onCitationStyleChange={setCitationStyle}
        />

        <div ref={progressStatusRef} style={{ minHeight: hasProgressStatus ? 'auto' : '0' }}>
          {(isProcessing || (apiStatus && Object.keys(apiStatus).length > 0)) && (
            <ProcessingStatus
              isProcessing={isProcessing}
              currentProcessing={currentProcessing}
              totalItems={totalItems}
              apiStatus={apiStatus}
              currentLiterature={currentLiterature}
            />
          )}
        </div>

        <StatisticsDisplay statistics={statistics} />

        <SearchResults
          results={results}
          citationStyle={citationStyle}
          onCopy={handleCopy}
        />

        {results.length > 0 && !isProcessing && (
          <div className="mt-6 text-center">
            <button
              onClick={handleClear}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              結果をクリア
            </button>
          </div>
        )}
      </div>
      
      <Footer />

      {/* フローティング進捗ポップアップ */}
      <FloatingProgressPopup
        isProcessing={isProcessing}
        currentProcessing={currentProcessing}
        totalItems={totalItems}
        apiStatus={apiStatus}
        currentLiterature={currentLiterature}
        isOriginalVisible={effectiveProgressVisibility}
      />
    </div>
  );
};

export default LiteratureVerifier;