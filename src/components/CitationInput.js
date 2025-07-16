import React from 'react';
import { Search, FileText } from 'lucide-react';

const CitationInput = ({ 
  inputText, 
  onInputChange, 
  onSubmit, 
  isProcessing, 
  citationStyle, 
  onCitationStyleChange 
}) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputText.trim() && !isProcessing) {
      onSubmit();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center space-x-2 mb-4">
        <FileText className="w-6 h-6 text-blue-500" />
        <h2 className="text-xl font-semibold text-gray-800">文献リスト入力</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="citation-input" className="block text-sm font-medium text-gray-700 mb-2">
            検証したい文献リストを入力してください（1行につき1つの文献）
          </label>
          <textarea
            id="citation-input"
            value={inputText}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="例：
田中太郎・佐藤花子 (2023) 文献検索の新手法. 情報処理学会論文誌, 64(3), 123-135.
Smith, J. & Johnson, M. (2022). Advanced citation methods. Journal of Information Science, 45(2), 67-82."
            className="w-full h-40 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
            disabled={isProcessing}
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between space-y-4 sm:space-y-0">
          <div className="sm:w-48">
            <label htmlFor="citation-style" className="block text-sm font-medium text-gray-700 mb-2">
              引用スタイル
            </label>
            <select
              id="citation-style"
              value={citationStyle}
              onChange={(e) => onCitationStyleChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isProcessing}
            >
              <option value="apa">APA形式</option>
              <option value="mla">MLA形式</option>
              <option value="chicago">Chicago形式</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={!inputText.trim() || isProcessing}
            className="inline-flex items-center justify-center px-6 py-2 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                検証中...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                検証開始
              </>
            )}
          </button>
        </div>
      </form>

      <div className="mt-4 text-sm text-gray-600">
        <p>
          <strong>対応形式:</strong> APA, MLA, Chicago形式の日本語・英語文献
        </p>
        <p>
          <strong>検索データベース:</strong> CrossRef, CiNii, Google Books, NDL Search
        </p>
      </div>
    </div>
  );
};

export default CitationInput;