import React, { useState, useEffect, useRef } from 'react';
import { Loader2, CheckCircle, XCircle, ChevronUp, ChevronDown } from 'lucide-react';

const FloatingProgressPopup = ({ 
  isProcessing, 
  currentProcessing, 
  totalItems, 
  apiStatus,
  currentLiterature,
  isOriginalVisible = true
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const [opacity, setOpacity] = useState(0);
  const [forceShow, setForceShow] = useState(false);
  const popupRef = useRef(null);

  // テスト用：キーボードショートカットでポップアップを強制表示
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        setForceShow(!forceShow);
        console.log('Force show popup:', !forceShow);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [forceShow]);

  // ポップアップの表示判定：透明度ベースの滑らかな制御
  useEffect(() => {
    const hasApiStatus = apiStatus && Object.keys(apiStatus).length > 0;
    const hasProcessingInfo = isProcessing || hasApiStatus;
    
    // 基本的な表示条件：進捗情報があるかどうか
    const shouldRender = hasProcessingInfo || forceShow;
    
    // 透明度制御：元のカードが見えない場合に不透明に
    const shouldBeOpaque = (!isOriginalVisible && hasProcessingInfo) || forceShow;
    
    console.log('FloatingProgressPopup - Display Logic:', {
      isOriginalVisible,
      isProcessing,
      apiStatusKeys: apiStatus ? Object.keys(apiStatus) : [],
      hasProcessingInfo,
      forceShow,
      shouldRender,
      shouldBeOpaque
    });
    
    setShouldShow(shouldRender);
    setOpacity(shouldBeOpaque ? 1 : 0);
    
    // 処理が完了し、かつスクロールして戻った場合は数秒後に完全に隠す
    if (!isProcessing && hasProcessingInfo && isOriginalVisible && !forceShow) {
      const timer = setTimeout(() => {
        setShouldShow(false);
        setIsExpanded(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOriginalVisible, isProcessing, apiStatus, forceShow]);

  // ポップアップが非表示の場合はrender しない
  if (!shouldShow) {
    return null;
  }

  const getApiStatusIcon = (status) => {
    switch (status) {
      case 'searching':
        return <Loader2 className="w-3 h-3 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'error':
        return <XCircle className="w-3 h-3 text-red-500" />;
      default:
        return <div className="w-3 h-3 rounded-full bg-gray-300" />;
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

  const progressPercentage = totalItems > 0 ? Math.round((currentProcessing / totalItems) * 100) : 0;

  // テスト用ダミーデータ（forceShow が true の場合）
  const testData = forceShow ? {
    isProcessing: true,
    currentProcessing: 3,
    totalItems: 10,
    currentLiterature: "テスト文献タイトル：サブタイトル例",
    apiStatus: {
      googleBooks: { status: 'completed', resultCount: 5 },
      crossref: { status: 'searching', resultCount: 0 },
      semanticScholar: { status: 'error', resultCount: 0 },
      cinii: { status: 'completed', resultCount: 3 },
      ndl: { status: 'searching', resultCount: 0 }
    }
  } : null;

  // forceShow時はテストデータを使用
  const displayData = testData || {
    isProcessing,
    currentProcessing,
    totalItems,
    currentLiterature,
    apiStatus
  };

  return (
    <div 
      ref={popupRef}
      className={`fixed bottom-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 z-50 transition-all duration-300 ${
        isExpanded ? 'w-80' : 'w-64'
      }`}
      style={{ 
        maxWidth: '90vw',
        opacity: opacity,
        transform: opacity > 0 ? 'translateY(0)' : 'translateY(10px)',
        pointerEvents: opacity > 0 ? 'auto' : 'none'
      }}
    >
      {/* コンパクトヘッダー */}
      <div className="relative">
        <div 
          className="flex items-center justify-between p-3 pr-10 cursor-pointer hover:bg-gray-50 rounded-t-lg"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center space-x-2">
            {displayData.isProcessing && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
            <span className="text-sm font-medium text-gray-800">
              {displayData.isProcessing ? '検証中...' : '検証完了'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {displayData.isProcessing && (
              <span className="text-xs text-gray-600">
                {displayData.currentProcessing}/{displayData.totalItems} ({Math.round((displayData.currentProcessing / displayData.totalItems) * 100)}%)
              </span>
            )}
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>
        
        {/* 閉じるボタン - ヘッダー内に配置 */}
        <button
          onClick={(e) => {
            e.stopPropagation(); // クリックイベントの伝播を停止
            setShouldShow(false);
            setOpacity(0);
          }}
          className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
          aria-label="閉じる"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      {/* プログレスバー（常に表示） */}
      {displayData.isProcessing && (
        <div className="px-3 pb-2">
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div 
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.round((displayData.currentProcessing / displayData.totalItems) * 100)}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* 展開時の詳細情報 */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-gray-100">
          {/* 現在の文献情報 */}
          {displayData.isProcessing && displayData.currentLiterature && (
            <div className="mt-3 p-2 bg-gray-50 rounded text-xs">
              <p className="text-gray-500 mb-1">現在検索中:</p>
              <p className="text-gray-800 font-medium break-all line-clamp-2">
                {displayData.currentLiterature.length > 80 ? `${displayData.currentLiterature.substring(0, 80)}...` : displayData.currentLiterature}
              </p>
            </div>
          )}

          {/* API状況 */}
          {displayData.apiStatus && (
            <div className="mt-3 space-y-1">
              <h4 className="text-xs font-medium text-gray-700 mb-2">データベース状況:</h4>
              {Object.entries(displayData.apiStatus).map(([api, status]) => (
                <div key={api} className="flex items-center space-x-2">
                  {getApiStatusIcon(status.status)}
                  <span className="text-xs text-gray-700">
                    {getApiStatusText(api, status.status, status.resultCount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default FloatingProgressPopup;