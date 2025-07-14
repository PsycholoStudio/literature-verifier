import React from 'react';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

const ProcessingStatus = ({ 
  isProcessing, 
  currentProcessing, 
  totalItems, 
  apiStatus 
}) => {
  if (!isProcessing && !apiStatus) {
    return null;
  }

  const getApiStatusIcon = (status) => {
    switch (status) {
      case 'searching':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <div className="w-4 h-4 rounded-full bg-gray-300" />;
    }
  };

  const getApiStatusText = (api, status, resultCount) => {
    const apiNames = {
      googleBooks: 'Google Books',
      crossref: 'CrossRef',
      semanticScholar: 'Semantic Scholar', 
      cinii: 'CiNii',
      ndl: '国会図書館'
    };

    switch (status) {
      case 'searching':
        return `${apiNames[api]} 検索中...`;
      case 'completed':
        return `${apiNames[api]} 完了 (${resultCount || 0}件)`;
      case 'error':
        return `${apiNames[api]} エラー`;
      default:
        return apiNames[api];
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center space-x-2 mb-4">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        <h3 className="text-lg font-semibold text-gray-800">処理状況</h3>
      </div>

      {isProcessing && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">
              進行状況: {currentProcessing} / {totalItems}
            </span>
            <span className="text-sm text-gray-600">
              {Math.round((currentProcessing / totalItems) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentProcessing / totalItems) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {apiStatus && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 mb-2">データベース検索状況:</h4>
          {Object.entries(apiStatus).map(([api, status]) => (
            <div key={api} className="flex items-center space-x-2">
              {getApiStatusIcon(status.status)}
              <span className="text-sm text-gray-700">
                {getApiStatusText(api, status.status, status.resultCount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProcessingStatus;