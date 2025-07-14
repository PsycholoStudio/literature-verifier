import React, { useState } from 'react';

// コンポーネント
import Header from './components/Header';
import CitationInput from './components/CitationInput';
import ProcessingStatus from './components/ProcessingStatus';
import StatisticsDisplay from './components/StatisticsDisplay';
import SearchResults from './components/SearchResults';
import Footer from './components/Footer';

// カスタムフック
import { useSearch } from './hooks/useSearch';

// 定数
import { CITATION_STYLES } from './constants';

const LiteratureVerifier = () => {
  const [inputText, setInputText] = useState('');
  const [citationStyle, setCitationStyle] = useState(CITATION_STYLES.APA);

  const {
    results,
    isProcessing,
    currentProcessing,
    statistics,
    apiStatus,
    processLiteratureList,
    clearResults
  } = useSearch();

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

        {(isProcessing || apiStatus) && (
          <ProcessingStatus
            isProcessing={isProcessing}
            currentProcessing={currentProcessing}
            totalItems={totalItems}
            apiStatus={apiStatus}
          />
        )}

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
    </div>
  );
};

export default LiteratureVerifier;