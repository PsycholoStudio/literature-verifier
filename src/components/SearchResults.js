import React, { useState } from 'react';
import { CheckCircle, AlertCircle, XCircle, Copy, ExternalLink } from 'lucide-react';
import { formatCandidateCitation } from '../utils/citationFormatter';
import { getOptimizedSearchLinks, optimizeSearchQuery } from '../utils/searchLinkOptimizer';

const SearchResults = ({ results, citationStyle, onCopy }) => {
  const [copiedIndex, setCopiedIndex] = useState(null);

  // HTMLタグとエンティティを完全に除去するヘルパー関数
  const stripHtml = (html) => {
    return html
      .replace(/<\/?[^>]+(>|$)/g, '')     // 全てのHTMLタグを除去
      .replace(/&nbsp;/g, ' ')            // HTMLエンティティを除去
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/\s+/g, ' ')               // 連続する空白を1つに
      .trim();
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'found':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'similar':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'found':
        return '一致';
      case 'similar':
        return '類似';
      default:
        return '未発見';
    }
  };

  const getStatusBgColor = (status) => {
    switch (status) {
      case 'found':
        return 'bg-green-50 border-green-200';
      case 'similar':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-red-50 border-red-200';
    }
  };

  const handleCopy = async (text, index) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      if (onCopy) {
        onCopy(text);
      }
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error('クリップボードへのコピーに失敗しました:', error);
    }
  };

  if (!results || results.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        検証結果がここに表示されます
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {results.map((result, index) => (
        <div
          key={index}
          className={`p-4 rounded-lg border-2 transition-all duration-200 ${getStatusBgColor(result.status)}`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              {getStatusIcon(result.status)}
              <span className="font-medium text-gray-700">
                {getStatusText(result.status)}
              </span>
              {result.mostSimilarResult?.source && (
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                  {result.mostSimilarResult.source}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium text-gray-600 mb-1">入力された引用:</h4>
              <p className="text-sm text-gray-800 bg-white p-2 rounded border">
                {result.originalText}
              </p>
            </div>

            {result.parsedInfo && (
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-1">解析された情報:</h4>
                <div className="bg-blue-50 p-3 rounded border text-xs space-y-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <span className="font-medium text-blue-800">言語:</span>
                      <span className="ml-1 text-blue-700">
                        {result.parsedInfo.language === 'japanese' ? '日本語' : '英語'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-blue-800">種別:</span>
                      <span className="ml-1 text-blue-700">
                        {result.parsedInfo.isBookChapter ? '書籍の章' : 
                         result.parsedInfo.isBook ? '書籍' : '記事'}
                      </span>
                    </div>
                  </div>
                  {result.parsedInfo.title && (
                    <div>
                      <span className="font-medium text-blue-800">タイトル:</span>
                      <span className="ml-1 text-blue-700">{result.parsedInfo.title}</span>
                      {/* 外部検索リンク */}
                      <div className="inline-flex flex-wrap gap-1 ml-2">
                        {getOptimizedSearchLinks(result.parsedInfo).map((link, linkIndex) => {
                          const optimizedQuery = optimizeSearchQuery(result.parsedInfo, link);
                          const searchQuery = encodeURIComponent(optimizedQuery);
                          const searchUrl = link.url + searchQuery + (link.suffix || '');
                          
                          return (
                            <a
                              key={linkIndex}
                              href={searchUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1 px-1 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition-colors duration-200"
                              title={`${link.name}で「${optimizedQuery}」を検索`}
                            >
                              <span className="text-xs">{link.icon}</span>
                              <span className="text-xs">{link.name}</span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {result.parsedInfo.authors && result.parsedInfo.authors.length > 0 && (
                    <div>
                      <span className="font-medium text-blue-800">著者:</span>
                      <span className="ml-1 text-blue-700">{result.parsedInfo.authors.join(', ')}</span>
                    </div>
                  )}
                  {result.parsedInfo.editors && result.parsedInfo.editors.length > 0 && (
                    <div>
                      <span className="font-medium text-blue-800">編者:</span>
                      <span className="ml-1 text-blue-700">{result.parsedInfo.editors.join(', ')}</span>
                    </div>
                  )}
                  {result.parsedInfo.year && (
                    <div>
                      <span className="font-medium text-blue-800">年:</span>
                      <span className="ml-1 text-blue-700">{result.parsedInfo.year}</span>
                    </div>
                  )}
                  {result.parsedInfo.bookTitle && (
                    <div>
                      <span className="font-medium text-blue-800">書籍名:</span>
                      <span className="ml-1 text-blue-700">{result.parsedInfo.bookTitle}</span>
                      {/* 書籍章の場合は書籍タイトルでの検索リンクを追加 */}
                      {result.parsedInfo.isBookChapter && (
                        <div className="inline-flex flex-wrap gap-1 ml-2">
                          {getOptimizedSearchLinks(result.parsedInfo).map((link, linkIndex) => {
                            // 書籍タイトルでの検索クエリを生成
                            const bookTitleQuery = result.parsedInfo.bookTitleWithSubtitle || result.parsedInfo.bookTitle;
                            const cleanBookTitle = bookTitleQuery.replace(/[""「」『』]/g, '').replace(/[ー—‐−–].*/g, '').trim();
                            const searchQuery = encodeURIComponent(cleanBookTitle);
                            const searchUrl = link.url + searchQuery + (link.suffix || '');
                            
                            return (
                              <a
                                key={linkIndex}
                                href={searchUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center space-x-1 px-1 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition-colors duration-200"
                                title={`${link.name}で「${cleanBookTitle}」を検索`}
                              >
                                <span className="text-xs">{link.icon}</span>
                                <span className="text-xs">{link.name}</span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  {result.parsedInfo.journal && (
                    <div>
                      <span className="font-medium text-blue-800">
                        {result.parsedInfo.isBookChapter ? '収録書籍:' : '掲載媒体:'}
                      </span>
                      <span className="ml-1 text-blue-700">{result.parsedInfo.journal}</span>
                      {/* 書籍章の場合は書籍タイトルでの検索リンクを追加（bookTitleフィールドがない場合） */}
                      {result.parsedInfo.isBookChapter && !result.parsedInfo.bookTitle && (
                        <div className="inline-flex flex-wrap gap-1 ml-2">
                          {getOptimizedSearchLinks(result.parsedInfo).map((link, linkIndex) => {
                            // 書籍タイトルでの検索クエリを生成
                            const bookTitleQuery = result.parsedInfo.bookTitleWithSubtitle || result.parsedInfo.journal;
                            const cleanBookTitle = bookTitleQuery.replace(/[""「」『』]/g, '').replace(/[ー—‐−–].*/g, '').trim();
                            const searchQuery = encodeURIComponent(cleanBookTitle);
                            const searchUrl = link.url + searchQuery + (link.suffix || '');
                            
                            return (
                              <a
                                key={linkIndex}
                                href={searchUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center space-x-1 px-1 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition-colors duration-200"
                                title={`${link.name}で「${cleanBookTitle}」を検索`}
                              >
                                <span className="text-xs">{link.icon}</span>
                                <span className="text-xs">{link.name}</span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  {result.parsedInfo.publisher && (
                    <div>
                      <span className="font-medium text-blue-800">出版社:</span>
                      <span className="ml-1 text-blue-700">{result.parsedInfo.publisher}</span>
                    </div>
                  )}
                  {(result.parsedInfo.volume || result.parsedInfo.issue || result.parsedInfo.pages) && (
                    <div>
                      <span className="font-medium text-blue-800">詳細情報:</span>
                      <span className="ml-1 text-blue-700">
                        {result.parsedInfo.volume && `${result.parsedInfo.volume}巻`}
                        {result.parsedInfo.issue && `${result.parsedInfo.issue}号`}
                        {result.parsedInfo.pages && ` ${result.parsedInfo.pages}ページ`}
                      </span>
                    </div>
                  )}
                  {result.parsedInfo.doi && (
                    <div>
                      <span className="font-medium text-blue-800">DOI:</span>
                      <span className="ml-1 text-blue-700">{result.parsedInfo.doi}</span>
                    </div>
                  )}
                </div>
              </div>
            )}


            {result.status !== 'not_found' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-medium text-gray-600">推定された引用 ({citationStyle.toUpperCase()}):</h4>
                  <button
                    onClick={() => handleCopy(stripHtml(result.correctedCitation), `main-${index}`)}
                    className="flex items-center space-x-1 px-2 py-1 text-xs bg-white rounded border hover:bg-gray-50 transition-colors"
                    title="引用をコピー"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedIndex === `main-${index}` ? 'コピー済み' : 'コピー'}</span>
                  </button>
                </div>
                <div 
                  className="text-sm text-gray-800 bg-white p-2 rounded border"
                  dangerouslySetInnerHTML={{ __html: result.coloredCitation }}
                />
              </div>
            )}

            {result.rankedCandidates && result.rankedCandidates.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-2">
                  候補文献（一致率順、上位{Math.min(result.rankedCandidates.length, 5)}件）:
                </h4>
                <div className="space-y-3">
                  {result.rankedCandidates.slice(0, 5).map((candidate, candidateIndex) => {
                    const candidateCitationHTML = formatCandidateCitation(candidate, result.parsedInfo, citationStyle);
                    // ヘルパー関数でHTMLタグを完全に除去
                    const candidateCitationText = stripHtml(candidateCitationHTML);
                    
                    return (
                    <div key={candidateIndex} className={`p-3 rounded border-l-4 ${
                      candidateIndex === 0 
                        ? 'bg-green-50 border-l-green-400' 
                        : 'bg-gray-50 border-l-gray-300'
                    }`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className={`text-xs px-2 py-1 rounded font-medium ${
                              candidateIndex === 0 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              #{candidateIndex + 1}
                            </span>
                            <span className="text-xs font-medium text-gray-600">
                              総合一致率: {candidate.overallScore.toFixed(1)}%
                            </span>
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                              {candidate.source}
                            </span>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleCopy(candidateCitationText, `candidate-${index}-${candidateIndex}`)}
                              className="flex items-center space-x-1 px-2 py-1 text-xs bg-white rounded border hover:bg-gray-50 transition-colors"
                              title="引用をコピー"
                            >
                              <Copy className="w-3 h-3" />
                              <span>{copiedIndex === `candidate-${index}-${candidateIndex}` ? 'コピー済み' : 'コピー'}</span>
                            </button>
                            {candidate.url && (
                              <a
                                href={candidate.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                title="元文献を開く"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>元文献</span>
                              </a>
                            )}
                          </div>
                        </div>
                        
                        {/* 統一された引用形式表示 */}
                        <div className="mb-2">
                          <h5 className="text-xs font-medium text-gray-600 mb-1">候補引用 ({citationStyle.toUpperCase()}):</h5>
                          <div 
                            className="text-sm text-gray-800 bg-white p-2 rounded border"
                            dangerouslySetInnerHTML={{ __html: candidateCitationHTML }}
                          />
                        </div>
                        
                        {/* 詳細スコア表示 */}
                        {candidate.similarities && (
                          <div className="text-xs text-gray-600">
                            <span className="font-medium">詳細スコア: </span>
                            {/* 書籍章の場合の詳細スコア */}
                            {result.parsedInfo.isBookChapter ? (
                              <>
                                タイトル {candidate.similarities.title ? candidate.similarities.title.toFixed(1) : 0}% | 
                                著者 {candidate.similarities.authors ?? 0}% | 
                                年 {candidate.similarities.year ?? 0}%
                                {candidate.similarities.bookTitle ? ` | 書籍名 ${candidate.similarities.bookTitle.toFixed(1)}%` : ''}
                                {candidate.similarities.editors && candidate.similarities.editors > 0 ? ` | 編者 ${candidate.similarities.editors.toFixed(1)}%` : 
                                 (result.parsedInfo.isBookChapter && (!result.parsedInfo.editors || result.parsedInfo.editors.length === 0) ? ' | 編者 <span style="color: #6b7280; font-style: italic;">情報不足</span>' : '')}
                                {candidate.similarities.publisher && candidate.similarities.publisher > 0 ? ` | 出版社 ${candidate.similarities.publisher.toFixed(1)}%` : ''}
                              </>
                            ) : (
                              <>
                                タイトル {candidate.similarities.title ? candidate.similarities.title.toFixed(1) : 0}% | 
                                著者 {candidate.similarities.author ?? 0}% | 
                                年 {candidate.similarities.year ?? 0}%
                                {candidate.similarities.isBookEvaluation ? (
                                  candidate.similarities.publisher !== null && candidate.similarities.publisher !== undefined ? (
                                    candidate.similarities.publisher === -1 ? ' | 出版社 情報あり' : ` | 出版社 ${candidate.similarities.publisher.toFixed(1)}%`
                                  ) : ''
                                ) : (
                                  <>
                                    {candidate.similarities.journal ? ` | 掲載誌 ${candidate.similarities.journal.toFixed(1)}%` : ''}
                                    {candidate.similarities.volumeIssuePages ? ` | 巻号ページ ${candidate.similarities.volumeIssuePages.toFixed(1)}%` : ''}
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SearchResults;