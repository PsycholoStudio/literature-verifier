/**
 * API通信サービス
 */

import { calculateSimilarity } from '../utils/comparisonUtils';
import { normalizeAuthors } from '../utils/authorNormalizer';

// タイトル一致度による検索結果のフィルタリングと順位付け
const filterAndRankByTitle = (results, parsedInfo) => {
  if (!parsedInfo.title || results.length === 0) {
    return results;
  }

  const originalTitle = parsedInfo.title.toLowerCase().trim();
  console.log(`📋 タイトル一致度分析: "${originalTitle}"`);

  // 完全一致を最優先で検索
  const exactMatches = results.filter(result => {
    if (!result.title) return false;
    const resultTitle = result.title.toLowerCase().trim();
    const isExact = resultTitle === originalTitle;
    if (isExact) {
      console.log(`🎯 完全一致発見: "${result.title}"`);
    }
    return isExact;
  });

  // 🔧 完全一致でも早期リターンせず、すべての候補を集めて評価する
  if (exactMatches.length > 0) {
    console.log(`✅ ${exactMatches.length}件の完全一致を発見（早期リターンは無効化）`);
    // return exactMatches; // ← この行をコメントアウト
  }

  // 部分一致の場合、類似度でソートして上位を返す
  const partialMatches = results
    .map(result => {
      if (!result.title) return { ...result, similarity: 0 };
      
      const similarity = calculateSimilarity(originalTitle, result.title.toLowerCase().trim());
      
      // 掲載誌名も考慮してスコアを調整
      let adjustedScore = similarity;
      if (parsedInfo.journal && result.journal) {
        const journalSimilarity = calculateSimilarity(
          parsedInfo.journal.toLowerCase().trim(),
          result.journal.toLowerCase().trim()
        );
        // タイトル80% + 掲載誌名20%の重み付け
        adjustedScore = similarity * 0.8 + journalSimilarity * 0.2;
      }
      
      return { ...result, similarity, adjustedScore };
    })
    .filter(result => result.similarity >= 10) // 閾値を極端緩和 20% → 10% (Miller論文調査用)
    .sort((a, b) => b.adjustedScore - a.adjustedScore)
    .slice(0, 15); // 各データベースから上位15件まで（Miller論文対策）

  // 🔧 重複除去を一時的に無効化（デバッグ用）
  const deduplicatedMatches = partialMatches;
  
  console.log('🚫 重複除去スキップ - 全レコードを表示:');
  deduplicatedMatches.forEach((result, index) => {
    // console.log(`  ${index + 1}. "${result.title}" (類似度: ${result.similarity.toFixed(1)}%, 出版社: ${result.publisher || 'なし'}, 年度: ${result.year || 'なし'}, DOI: ${result.doi || 'なし'}, ISBN: ${result.isbn || 'なし'}, ソース: ${result.source})`);
  });
  
  console.log(`📊 重複除去後: ${deduplicatedMatches.length}件 (${partialMatches.length - deduplicatedMatches.length}件重複除去)`);
  deduplicatedMatches.forEach(result => {
    // console.log(`  - "${result.title}" (類似度: ${result.similarity.toFixed(1)}%, 調整スコア: ${result.adjustedScore.toFixed(1)}%)`);
  });
  
  // 🔍 DEBUG: 10%未満の結果も表示して問題を特定
  const lowSimilarityResults = results
    .map(result => {
      if (!result.title) return { ...result, similarity: 0 };
      
      const similarity = calculateSimilarity(originalTitle, result.title.toLowerCase().trim());
      
      let adjustedScore = similarity;
      if (parsedInfo.journal && result.journal) {
        const journalSimilarity = calculateSimilarity(
          parsedInfo.journal.toLowerCase().trim(),
          result.journal.toLowerCase().trim()
        );
        adjustedScore = similarity * 0.8 + journalSimilarity * 0.2;
      }
      
      return { ...result, similarity, adjustedScore };
    })
    .filter(result => result.similarity < 10 && result.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 10);
    
  if (lowSimilarityResults.length > 0) {
    // console.log(`🔍 DEBUG: 10%未満の候補 (${lowSimilarityResults.length}件):`);
    lowSimilarityResults.forEach(result => {
      // console.log(`  - "${result.title}" (類似度: ${result.similarity.toFixed(1)}%)`);
    });
  }

  return deduplicatedMatches;
};

// API設定
const isDevelopment = process.env.NODE_ENV === 'development';
const API_BASE = isDevelopment ? 'http://localhost:3001' : '';

const API_CONFIG = {
  CROSSREF: {
    endpoint: `${API_BASE}/api/crossref`,
    timeout: 60000  // 60秒に延長（プロキシ経由のため）
  },
  SEMANTIC_SCHOLAR: {
    endpoint: `${API_BASE}/api/semantic-scholar`,
    timeout: 15000  // 15秒に延長
  },
  CINII: {
    endpoint: `${API_BASE}/api/cinii`,
    timeout: 15000  // 15秒に延長
  },
  GOOGLE_BOOKS: {
    endpoint: `${API_BASE}/api/google-books`,
    timeout: 15000  // 15秒に延長
  }
};

// APIリクエストのヘルパー関数
const fetchWithTimeout = async (url, options = {}, timeout = 10000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
};

// 段階的検索戦略：原著論文発見を強化
const executeGradualSearch = async (parsedInfo, searchFunc) => {
  const allResults = [];
  
  // 書籍の場合はより多く取得
  const isBook = parsedInfo.isBook;
  const multiplier = isBook ? 1.5 : 1; // 書籍なら1.5倍
  
  // 🔧 タイトルの特殊文字除去（全段階で使用）
  const cleanTitle = parsedInfo.title ? parsedInfo.title
    .replace(/[:;,()[\]"'\.…]/g, ' ')  // 特殊文字をスペースに置換（省略記号含む）
    .replace(/\s+/g, ' ')  // 連続スペースを1つに
    .trim() : '';
  
  console.log(`🔧 検索用タイトル: 元="${parsedInfo.title}" → クリーン="${cleanTitle}"`);
  
  // 段階1A: タイトル + 掲載誌名フィルター (最も精密)
  if (cleanTitle && parsedInfo.journal) {
    console.log(`🎯 段階1A検索: タイトル+掲載誌フィルター（最高精度）`);
    console.log(`   タイトル: "${cleanTitle}"`);
    console.log(`   掲載誌フィルター: container-title:"${parsedInfo.journal}"`);
    const results1A = await searchFunc(cleanTitle, Math.round(20 * multiplier), true, parsedInfo.journal);
    if (results1A.length > 0) {
      console.log(`✅ 段階1Aで${results1A.length}件発見`);
      allResults.push(...results1A);
    }
  }

  // 段階1B: タイトル + 掲載誌名 (従来のクエリ検索)
  if (cleanTitle && parsedInfo.journal && allResults.length < 5) {
    const query1B = `"${cleanTitle}" "${parsedInfo.journal}"`;
    console.log(`🎯 段階1B検索: タイトル+掲載誌（クエリ検索）`);
    console.log(`   クエリ: ${query1B}`);
    const results1B = await searchFunc(query1B, Math.round(15 * multiplier));
    if (results1B.length > 0) {
      console.log(`✅ 段階1Bで${results1B.length}件発見`);
      const uniqueResults1B = results1B.filter(r1B => 
        !allResults.some(r1 => r1.title === r1B.title)
      );
      allResults.push(...uniqueResults1B);
    }
  }
  
  // 段階2: タイトル + 著者名 (高精度検索) - 書籍では最優先
  if (cleanTitle && parsedInfo.authors?.length > 0) {
    const authorName = parsedInfo.authors[0]; // 第一著者
    
    if (isBook) {
      console.log(`📚 書籍検索: 著者+タイトル戦略を強化`);
      
      // 書籍の場合：著者名を複数のバリエーションで検索
      const authorVariations = [];
      
      // フルネーム
      authorVariations.push(authorName);
      
      // 姓のみ（英語の場合）
      if (!/[ひらがなカタカナ漢字]/.test(authorName)) {
        const nameParts = authorName.split(/[,\s]+/).filter(p => p.trim());
        if (nameParts.length > 1) {
          // "Smith, J." -> "Smith"
          // "John Smith" -> "Smith"
          const lastName = nameParts.includes(',') ? nameParts[0] : nameParts[nameParts.length - 1];
          if (lastName.length > 2) {
            authorVariations.push(lastName);
          }
        }
      }
      
      // 各著者バリエーションで検索
      for (const authorVar of authorVariations) {
        const query2 = `"${cleanTitle}" "${authorVar}"`;
        console.log(`🎯 段階2検索 (書籍強化): タイトル+著者 - "${query2}"`);
        const results2 = await searchFunc(query2, Math.round(15 * multiplier));
        if (results2.length > 0) {
          console.log(`✅ 段階2で${results2.length}件発見 (著者: ${authorVar})`);
          const uniqueResults2 = results2.filter(r2 => 
            !allResults.some(r1 => r1.title === r2.title)
          );
          allResults.push(...uniqueResults2);
        }
      }
    } else {
      // 論文の場合は従来通り
      const query2 = `"${cleanTitle}" "${authorName}"`;
      console.log(`🎯 段階2検索: タイトル+著者 - "${query2}"`);
      const results2 = await searchFunc(query2, Math.round(12 * multiplier));
      if (results2.length > 0) {
        console.log(`✅ 段階2で${results2.length}件発見`);
        const uniqueResults2 = results2.filter(r2 => 
          !allResults.some(r1 => r1.title === r2.title)
        );
        allResults.push(...uniqueResults2);
      }
    }
  }
  
  // 段階3: タイトル + 著者名 + 掲載誌名 (最も具体的)
  if (cleanTitle && parsedInfo.authors?.length > 0 && parsedInfo.journal) {
    const authorName = parsedInfo.authors[0];
    const query3 = `"${cleanTitle}" "${authorName}" "${parsedInfo.journal}"`;
    console.log(`🎯 段階3検索: タイトル+著者+掲載誌 - "${query3}"`);
    const results3 = await searchFunc(query3, Math.round(8 * multiplier));
    if (results3.length > 0) {
      console.log(`✅ 段階3で${results3.length}件発見`);
      const uniqueResults3 = results3.filter(r3 => 
        !allResults.some(r1 => r1.title === r3.title)
      );
      allResults.push(...uniqueResults3);
    }
  }
  
  // 段階4: 著者中心検索（書籍専用） - 部分タイトル問題対応
  if (isBook && parsedInfo.authors?.length > 0 && allResults.length < 10) {
    console.log(`📚 段階4: 書籍専用著者中心検索`);
    
    const authorName = parsedInfo.authors[0];
    const authorParts = authorName.split(/[,\s]+/).filter(p => p.trim());
    let primaryAuthor = authorName;
    
    // 姓のみ抽出（英語の場合）
    if (!/[ひらがなカタカナ漢字]/.test(authorName) && authorParts.length > 1) {
      primaryAuthor = authorParts.includes(',') ? authorParts[0] : authorParts[authorParts.length - 1];
    }
    
    // タイトルの主要部分を抽出（短いタイトルの場合のみ短縮戦略を適用）
    const titleWords = cleanTitle.split(/\s+/);
    const useShortTitle = titleWords.length <= 8; // 8語以下の場合のみ短縮戦略
    const searchTitle = useShortTitle ? cleanTitle : titleWords.slice(0, 5).join(' ');
    
    console.log(`🎯 著者中心検索: "${primaryAuthor}" + "${searchTitle}"${useShortTitle ? '' : ' (短縮)'}`);
    const query4a = `"${primaryAuthor}" "${searchTitle}"`;
    const results4a = await searchFunc(query4a, Math.round(10 * multiplier));
    
    if (results4a.length > 0) {
      console.log(`✅ 著者中心検索で${results4a.length}件発見`);
      const uniqueResults4a = results4a.filter(r4a => 
        !allResults.some(r1 => r1.title === r4a.title)
      );
      allResults.push(...uniqueResults4a);
    }
  }
  
  // 段階5: タイトルのみ (書籍の場合はフィルターありとなしの両方を検索)
  if (cleanTitle) {
    let results5 = [];
    
    if (parsedInfo.isBook) {
      console.log(`📚 書籍検索: フィルターありとなしの両方を実行`);
      
      // フィルターあり（type:book）
      console.log(`🎯 段階5A: 書籍フィルター検索 - "${cleanTitle}"`);
      const bookFilteredResults = await searchFunc(cleanTitle, Math.round(15 * multiplier), false, null, true);
      console.log(`📚 書籍フィルター結果: ${bookFilteredResults.length}件`);
      
      // フィルターなし（全カテゴリ）
      console.log(`🎯 段階5B: 全カテゴリ検索 - "${cleanTitle}"`);
      const allCategoryResults = await searchFunc(cleanTitle, Math.round(15 * multiplier), false, null, false);
      console.log(`🔍 全カテゴリ結果: ${allCategoryResults.length}件`);
      
      // 両結果を結合（重複除去）
      results5 = [...bookFilteredResults];
      const uniqueAllResults = allCategoryResults.filter(ar => 
        !bookFilteredResults.some(br => br.title === ar.title)
      );
      results5.push(...uniqueAllResults);
      console.log(`🔀 結合結果: ${results5.length}件（フィルターあり:${bookFilteredResults.length} + フィルターなし新規:${uniqueAllResults.length}）`);
    } else {
      // 論文の場合は従来通り
      console.log(`🎯 段階5検索: タイトルのみ（大量取得） - "${cleanTitle}"`);
      results5 = await searchFunc(cleanTitle, Math.round(30 * multiplier));
    }
    
    if (results5.length > 0) {
      console.log(`✅ 段階5で${results5.length}件発見`);
      const uniqueResults5 = results5.filter(r5 => 
        !allResults.some(r1 => r1.title === r5.title)
      );
      allResults.push(...uniqueResults5);
    }
  }
  
  
  console.log(`📊 段階的検索完了: 計${allResults.length}件の候補`);
  return allResults;
};

// CrossRef API検索（シンプル統合検索）
const searchCrossRef = async (parsedInfo) => {
  if (!parsedInfo.title || parsedInfo.title.trim() === '') {
    console.warn('CrossRef: タイトルがないため検索をスキップ');
    return [];
  }

  // 🔧 特殊文字除去したparsedInfoを作成
  const cleanParsedInfo = {
    ...parsedInfo,
    title: parsedInfo.title
      .replace(/[:;,()[\]"'\.…]/g, ' ')  // 特殊文字をスペースに置換（省略記号含む）
      .replace(/\s+/g, ' ')  // 連続スペースを1つに
      .trim()
  };

  console.log(`🔍 CrossRef 統合検索開始 - 書籍: ${parsedInfo.isBook ? 'Yes' : 'No'}`);
  console.log(`🔧 CrossRef用クリーンタイトル: "${cleanParsedInfo.title}"`);

  // CrossRef専用の検索実行関数
  const executeSearch = async (query, limit = 10, useFilter = false, journalName = null, useBookFilter = false) => {
    let queryParams = new URLSearchParams({
      query: query,
      rows: limit.toString()
    });

    // 掲載誌名フィルターを使用する場合
    if (useFilter && journalName) {
      queryParams.append('filter', `container-title:"${journalName}"`);
      console.log(`📋 掲載誌名フィルター適用: ${journalName}`);
    }
    
    // 書籍フィルターを明示的に指定された場合のみ
    if (useBookFilter) {
      queryParams.append('filter', 'type:book,type:book-chapter,type:monograph');
      console.log(`📚 書籍フィルター適用: type:book,type:book-chapter,type:monograph`);
    }

    const requestUrl = `${API_CONFIG.CROSSREF.endpoint}?${queryParams}`;
    console.log(`🌐 CrossRef API Request: ${requestUrl}`);
    
    // プロキシ経由での実際のURL
    const actualApiUrl = requestUrl.replace(`${API_BASE}/api/crossref`, 'https://api.crossref.org/works');
    console.log(`🔗 実際のAPI URL: ${actualApiUrl}`);

    try {
    console.log(`⏳ CrossRef API実行中... (タイムアウト: ${API_CONFIG.CROSSREF.timeout}ms)`);
    let response = await fetchWithTimeout(
      requestUrl,
      {},
      API_CONFIG.CROSSREF.timeout
    );

    if (!response.ok) {
      console.error('CrossRef API error:', response.status);
      return [];
    }

    const data = await response.json();
    
    console.log(`📊 CrossRef APIレスポンス:`);
    console.log(`   ステータス: ${response.status}`);
    console.log(`   取得件数: ${data.message?.items?.length || 0}件`);
    console.log(`   総利用可能件数: ${data.message?.['total-results'] || 0}件`);
    
    // 🔍 Miller (1956) 問題調査：実際のタイトルをすべて表示
    if (data.message?.items?.length > 0) {
      console.log(`🔍 MILLER DEBUG: API返却タイトル一覧:`);
      data.message.items.slice(0, 5).forEach((item, index) => {
        console.log(`  ${index + 1}. "${item.title?.[0] || 'タイトルなし'}" (年: ${item.published?.['date-parts']?.[0]?.[0] || '不明'})`);
      });
    }
    
    // Use unified format if available, otherwise fall back to manual conversion
    if (data.results && Array.isArray(data.results)) {
      // タイトル一致度による絞り込み
      return filterAndRankByTitle(data.results, parsedInfo);
    } else if (data.message && data.message.items) {
      // Fallback for older API versions
      const allResults = data.message.items.map(item => {
        // タイトルとサブタイトルを結合
        const title = item.title?.[0] || '';
        const subtitle = item.subtitle?.[0] || '';
        const fullTitle = subtitle ? `${title}: ${subtitle}` : title;
        
        if (subtitle) {
          console.log(`📚 CrossRef結果: "${title}" + サブタイトル: "${subtitle}" → "${fullTitle}"`);
        }
        
        return {
          title: fullTitle,
          authors: normalizeAuthors(item.author || []),
          year: item.published?.['date-parts']?.[0]?.[0]?.toString() || '',
          doi: item.DOI || '',
          journal: item['container-title']?.[0] || '',
          publisher: item.publisher || '',
          volume: item.volume || '',
          issue: item.issue || '',
          pages: item.page || '',
          url: item.URL || '',
          source: 'CrossRef',
          // Book Chapter関連フィールド
          type: item.type || '',
          editors: item.editor ? normalizeAuthors(item.editor || []) : [],
          isBookChapter: item.type === 'book-chapter',
          bookTitle: item.type === 'book-chapter' ? item['container-title']?.[0] || '' : '',
          originalData: item
        };
      });

      // タイトル一致度による絞り込み
      return filterAndRankByTitle(allResults, parsedInfo);
    }
    
    return [];
  } catch (error) {
    console.error('CrossRef API error:', error);
    return [];
    }
  };

  // シンプル統合検索を実行
  // 🔧 タイトル長さに応じた検索戦略を選択
  const limit = 20; // 各戦略で20件ずつ取得
  const useBookFilter = parsedInfo.isBook;
  
  // タイトル長さの分析
  const titleLength = cleanParsedInfo.title.length;
  const wordCount = cleanParsedInfo.title.split(/\s+/).length;
  const isShortTitle = titleLength <= 20 || wordCount <= 3;
  
  console.log(`📏 タイトル分析: 長さ=${titleLength}文字, 単語数=${wordCount}, 短いタイトル=${isShortTitle}`);
  
  try {
    if (isShortTitle) {
      // 🎯 短いタイトルの場合：複合検索を優先
      console.log(`🎯 短いタイトル戦略: 複合検索を優先`);
      
      const allResults = [];
      
      // 戦略1: タイトル + 著者名（最優先）
      if (parsedInfo.authors?.length > 0) {
        const authorName = parsedInfo.authors[0];
        const authorQuery = `"${cleanParsedInfo.title}" "${authorName}"`;
        console.log(`🎯 短いタイトル段階1: タイトル+著者 - ${authorQuery}`);
        
        const authorResults = await executeSearch(authorQuery, limit, false, null, useBookFilter);
        console.log(`✅ 短いタイトル段階1完了: ${authorResults.length}件`);
        allResults.push(...authorResults);
      }
      
      // 戦略2: タイトル + 掲載誌名（補完）
      if (parsedInfo.journal && allResults.length < 10) {
        const journalQuery = `"${cleanParsedInfo.title}" "${parsedInfo.journal}"`;
        console.log(`🎯 短いタイトル段階2: タイトル+掲載誌 - ${journalQuery}`);
        
        const journalResults = await executeSearch(journalQuery, limit, false, null, useBookFilter);
        console.log(`✅ 短いタイトル段階2完了: ${journalResults.length}件`);
        
        // 重複除去してマージ
        journalResults.forEach(result => {
          if (!allResults.some(existing => existing.title === result.title)) {
            allResults.push(result);
          }
        });
      }
      
      // 戦略3: 年度も追加した複合検索（必要に応じて）
      if (parsedInfo.year && allResults.length < 5) {
        const yearQuery = parsedInfo.authors?.length > 0 
          ? `"${cleanParsedInfo.title}" "${parsedInfo.authors[0]}" ${parsedInfo.year}`
          : `"${cleanParsedInfo.title}" ${parsedInfo.year}`;
        console.log(`🎯 短いタイトル段階3: 年度込み - ${yearQuery}`);
        
        const yearResults = await executeSearch(yearQuery, limit, false, null, useBookFilter);
        console.log(`✅ 短いタイトル段階3完了: ${yearResults.length}件`);
        
        // 重複除去してマージ
        yearResults.forEach(result => {
          if (!allResults.some(existing => existing.title === result.title)) {
            allResults.push(result);
          }
        });
      }
      
      return allResults;
      
    } else {
      // 🎯 長いタイトルの場合：タイトル中心検索 + 著者名検索
      console.log(`🎯 長いタイトル戦略: タイトル中心検索 + 著者名検索`);
      
      const allResults = [];
      
      // 戦略1: タイトル + 著者名（高精度優先）
      if (parsedInfo.authors?.length > 0) {
        const authorName = parsedInfo.authors[0];
        const authorQuery = `"${cleanParsedInfo.title}" "${authorName}"`;
        console.log(`🎯 長いタイトル段階1: タイトル+著者 - ${authorQuery}`);
        
        const authorResults = await executeSearch(authorQuery, limit, false, null, useBookFilter);
        console.log(`✅ 長いタイトル段階1完了: ${authorResults.length}件`);
        allResults.push(...authorResults);
      }
      
      // 戦略2: タイトルのみで検索（補完）
      const titleOnlyQuery = `"${cleanParsedInfo.title}"`;
      console.log(`🎯 長いタイトル段階2: タイトルのみ - ${titleOnlyQuery}`);
      
      const titleResults = await executeSearch(titleOnlyQuery, limit, false, null, useBookFilter);
      console.log(`✅ 長いタイトル段階2完了: ${titleResults.length}件`);
      
      // 重複除去してマージ
      titleResults.forEach(result => {
        if (!allResults.some(existing => existing.title === result.title)) {
          allResults.push(result);
        }
      });
      
      return allResults;
    }
    
  } catch (error) {
    console.error('CrossRef段階的検索エラー:', error);
    // タイムアウトエラーの場合は空の結果を返す
    return [];
  }
};

// Semantic Scholar API検索（タイトル中心戦略）  
const searchSemanticScholar = async (parsedInfo) => {
  if (!parsedInfo.title || parsedInfo.title.trim() === '') {
    console.warn('Semantic Scholar: タイトルがないため検索をスキップ');
    return [];
  }

  // 🔧 特殊文字除去
  const cleanTitle = parsedInfo.title
    .replace(/[:;,()[\]"'\.…]/g, ' ')  // 特殊文字をスペースに置換（省略記号含む）
    .replace(/\s+/g, ' ')  // 連続スペースを1つに
    .trim();

  // 🔧 タイトル長さに応じた検索戦略
  const titleLength = cleanTitle.length;
  const wordCount = cleanTitle.split(/\s+/).length;
  const isShortTitle = titleLength <= 20 || wordCount <= 3;
  
  console.log(`🎯 Semantic Scholar検索 - タイトル: "${cleanTitle}" (短い=${isShortTitle})`);

  let query = cleanTitle;
  
  if (isShortTitle) {
    // 短いタイトルの場合は著者名を優先的に追加
    if (parsedInfo.authors?.length > 0) {
      query = `${cleanTitle} ${parsedInfo.authors[0]}`;
      console.log(`📋 短いタイトル - 著者名併用検索: "${query}"`);
    } else if (parsedInfo.journal) {
      query = `${cleanTitle} ${parsedInfo.journal}`;
      console.log(`📋 短いタイトル - 掲載誌名併用検索: "${query}"`);
    }
  }

  const queryParams = new URLSearchParams({
    query: query,
    limit: '15',
    fields: 'title,authors,year,venue,doi,url'
  });

  try {
    const response = await fetchWithTimeout(
      `${API_CONFIG.SEMANTIC_SCHOLAR.endpoint}?${queryParams}`,
      {},
      API_CONFIG.SEMANTIC_SCHOLAR.timeout
    );

    if (!response.ok) {
      console.error('Semantic Scholar API error:', response.status);
      return [];
    }

    const data = await response.json();
    
    // Use unified format if available, otherwise fall back to manual conversion
    if (data.results && Array.isArray(data.results)) {
      // タイトル一致度による絞り込み
      return filterAndRankByTitle(data.results, parsedInfo);
    } else if (data.data) {
      // Fallback for older API versions
      const allResults = data.data.map(item => ({
        title: item.title || '',
        authors: normalizeAuthors(item.authors || []),
        year: item.year?.toString() || '',
        doi: item.doi || '',
        journal: item.venue || '',
        publisher: '', // Semantic Scholarは出版社情報を提供しない
        volume: '', // Semantic Scholarは巻号情報を提供しない
        issue: '',
        pages: '',
        url: item.url || '',
        source: 'Semantic Scholar',
        originalData: item
      }));

      // タイトル一致度による絞り込み
      return filterAndRankByTitle(allResults, parsedInfo);
    }
    
    return [];
  } catch (error) {
    console.error('Semantic Scholar API error:', error);
    return [];
  }
};

// 国会図書館API検索（日本語書籍特化）
const searchNDL = async (parsedInfo) => {
  try {
    console.log('🏛️ 国会図書館検索開始:', {
      title: parsedInfo.title,
      authors: parsedInfo.authors,
      language: parsedInfo.language
    });

    const searchStrategies = [];
    const cleanTitle = parsedInfo.title ? 
      parsedInfo.title.replace(/[:.：。]/g, '').replace(/\s+/g, ' ').trim() : '';

    // 戦略1: タイトル + 著者
    if (cleanTitle && parsedInfo.authors?.length > 0) {
      const author = parsedInfo.authors[0];
      searchStrategies.push({
        query: `title=${encodeURIComponent(cleanTitle)}&creator=${encodeURIComponent(author)}`,
        description: `タイトル+著者検索(${author})`,
        priority: 1
      });
    }

    // 戦略2: タイトルのみ
    if (cleanTitle) {
      searchStrategies.push({
        query: `title=${encodeURIComponent(cleanTitle)}`,
        description: `タイトルのみ検索`,
        priority: 2
      });
    }

    const allResults = [];

    for (const strategy of searchStrategies) {
      try {
        console.log(`🏛️ NDL戦略実行: ${strategy.description}`);
        
        const ndlUrl = `${API_BASE}/api/ndl-search?${strategy.query}`;
        console.log(`🔗 NDL呼び出しURL: ${ndlUrl}`);
        
        const response = await fetch(ndlUrl);
        
        // 開発サーバーでHTMLページが返される場合をチェック
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          console.warn('⚠️ NDL API: 開発サーバーではAPIルートが利用できません。本番環境で動作します。');
          break;
        }
        
        if (!response.ok) {
          console.error(`❌ NDL API HTTP エラー: ${response.status} ${response.statusText}`);
          continue;
        }
        
        const data = await response.json();

        if (data.error) {
          console.error('❌ NDL検索エラー:', data.error);
          continue;
        }

        const results = Array.isArray(data.results) ? data.results : [];
        console.log(`✅ NDL ${strategy.description}: ${results.length}件取得`);

        if (results.length > 0) {
          allResults.push(...results);
          if (allResults.length >= 10) break; // 十分な結果を取得
        }
      } catch (error) {
        // JSONパースエラーは開発サーバーの制限として扱う
        if (error.message.includes('Unexpected token')) {
          console.warn('⚠️ NDL API: 開発サーバーではAPIルートが利用できません。本番環境(Vercel)で動作します。');
          break;
        } else {
          console.error(`❌ NDL戦略エラー (${strategy.description}):`, error);
        }
      }
    }

    console.log(`🏛️ NDL検索完了: 合計${allResults.length}件`);
    return { results: allResults, source: 'ndl' };

  } catch (error) {
    console.error('❌ NDL検索エラー:', error);
    return { results: [], error: error.message, source: 'ndl' };
  }
};

// Google Books API検索（書籍特化戦略）
const searchGoogleBooks = async (parsedInfo) => {
  if (!parsedInfo.title || parsedInfo.title.trim() === '') {
    console.warn('Google Books: タイトルがないため検索をスキップ');
    return [];
  }

  // 🔧 特殊文字除去
  const cleanTitle = parsedInfo.title
    .replace(/[:;,()[\]"'\.…]/g, ' ')  // 特殊文字をスペースに置換（省略記号含む）
    .replace(/\s+/g, ' ')  // 連続スペースを1つに
    .trim();

  console.log(`📚 Google Books 書籍検索開始: "${cleanTitle}"`);

  // 書籍検索用の複数戦略
  const searchStrategies = [];

  // 戦略1: フィールド指定による精密検索
  if (parsedInfo.authors?.length > 0) {
    const primaryAuthor = parsedInfo.authors[0];
    
    // 著者名のバリエーション
    const authorVariations = [primaryAuthor];
    
    // 英語名の場合は姓のみも追加
    if (!/[ひらがなカタカナ漢字]/.test(primaryAuthor)) {
      const nameParts = primaryAuthor.split(/[,\s]+/).filter(p => p.trim());
      if (nameParts.length > 1) {
        const lastName = nameParts.includes(',') ? nameParts[0] : nameParts[nameParts.length - 1];
        if (lastName.length > 2) {
          authorVariations.push(lastName);
        }
      }
    }

    // 戦略1A: タイトルフィールド + 著者フィールド（最高精度）
    authorVariations.forEach(author => {
      searchStrategies.push({
        query: `intitle:"${cleanTitle}" inauthor:"${author}"`,
        description: `フィールド指定検索(${author})`,
        priority: 1
      });
    });
    
    // 戦略1B: 著者フィールドのみ（幅広いタイトルマッチ）
    authorVariations.forEach(author => {
      searchStrategies.push({
        query: `inauthor:"${author}"`,
        description: `著者フィールド検索(${author})`,
        priority: 1
      });
    });
  }

  // 戦略2: タイトルのみ（幅広い検索）
  searchStrategies.push({
    query: `intitle:"${cleanTitle}"`,
    description: `タイトル完全一致`,
    priority: 2
  });

  // 戦略3: 日本語書籍特化検索
  const isJapaneseTitle = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(cleanTitle);
  if (isJapaneseTitle) {
    // 戦略3A: 日本語タイトルでの全文検索（intitleなし）
    searchStrategies.push({
      query: `"${cleanTitle}"`,
      description: `日本語全文検索`,
      priority: 3
    });
    
    // 戦略3B: 著者がいる場合の日本語組み合わせ検索
    if (parsedInfo.authors?.length > 0) {
      const primaryAuthor = parsedInfo.authors[0];
      searchStrategies.push({
        query: `"${cleanTitle}" "${primaryAuthor}"`,
        description: `日本語タイトル+著者検索`,
        priority: 3
      });
    }
  } else {
    // 戦略3C: 英語タイトル部分検索（サブタイトル問題対応）
    const titleWords = cleanTitle.split(/\s+/);
    if (titleWords.length > 3) {
      const shortTitle = titleWords.slice(0, Math.min(5, titleWords.length)).join(' ');
      searchStrategies.push({
        query: `intitle:"${shortTitle}"`,
        description: `短縮タイトル(${shortTitle})`,
        priority: 3
      });
    }
  }

  const allResults = [];

  // 各戦略を順次実行
  for (const strategy of searchStrategies) {
    console.log(`🎯 Google Books戦略: ${strategy.description} - "${strategy.query}"`);

    try {
      const queryParams = new URLSearchParams({
        q: strategy.query,
        maxResults: strategy.priority === 1 ? '15' : '10' // 著者付きはより多く取得
      });

      // Google Books APIを直接呼び出し（CORSサポートされている）
      // 開発環境でCORSエラーが発生する場合のフォールバック対応
      // 開発環境でもプロキシを使用
      const useProxy = true; // プロキシ経由で統一
      const directApiUrl = useProxy
        ? `${API_CONFIG.GOOGLE_BOOKS.endpoint}?${queryParams}` // プロキシ経由
        : `https://www.googleapis.com/books/v1/volumes?${queryParams}`; // 直接呼び出し
      
      console.log(`🌐 Google Books API URL (${useProxy ? 'proxy' : 'direct'}): ${directApiUrl}`);
      
      const response = await fetchWithTimeout(
        directApiUrl,
        {
          method: 'GET',
          mode: 'cors',
          headers: {
            'Accept': 'application/json',
          }
        },
        API_CONFIG.GOOGLE_BOOKS.timeout
      );

      if (!response.ok) {
        console.error(`Google Books API error for "${strategy.description}":`, response.status);
        continue;
      }

      const data = await response.json();
      
      // Use unified format if available
      if (data.results && Array.isArray(data.results)) {
        console.log(`✅ ${strategy.description}で${data.results.length}件発見（統一フォーマット）`);
        const uniqueResults = data.results.filter(unifiedItem => 
          !allResults.some(existingItem => existingItem.title === unifiedItem.title)
        );
        allResults.push(...uniqueResults);
        
        // 十分な結果が得られた場合は早期終了
        if (allResults.length >= 15) {
          console.log(`📚 Google Books: 十分な結果(${allResults.length}件)を取得、検索終了`);
          break;
        }
      } else if (data.items && data.items.length > 0) {
      // Fallback: selfLinkを使って詳細情報を取得
        console.log(`✅ ${strategy.description}で${data.items.length}件発見`);
        console.log(`📚 Google Books: selfLinkを使って詳細情報を取得中... (${data.items.length}件)`);
        
        // 詳細情報を取得するため、各アイテムのselfLinkを使用
        const detailPromises = data.items.slice(0, 10).map(async (item, index) => {
          try {
            if (item.selfLink) {
              console.log(`🔍 項目 ${index + 1}: selfLink呼び出し - ${item.selfLink}`);
              const detailResponse = await fetch(item.selfLink);
              
              if (detailResponse.ok) {
                const detailData = await detailResponse.json();
                // console.log(`📖 詳細取得成功: "${detailData.volumeInfo?.title}" - 出版社: ${detailData.volumeInfo?.publisher || 'なし'}`);
                return detailData;
              } else {
                console.log(`⚠️ 詳細取得失敗: ${item.selfLink} (${detailResponse.status})`);
                return item;
              }
            }
            return item;
          } catch (error) {
            console.error(`❌ 詳細情報取得エラー (項目 ${index + 1}): ${error.message}`);
            return item;
          }
        });
        
        // 全ての詳細情報取得を待つ
        const detailedItems = await Promise.all(detailPromises);
        data.items = detailedItems;
        console.log(`✅ 詳細情報取得完了: ${detailedItems.length}件`);
        
        const strategyResults = data.items.map(item => {
          const volumeInfo = item.volumeInfo || {};
          
          // タイトル + サブタイトル
          const title = volumeInfo.title || '';
          const subtitle = volumeInfo.subtitle || '';
          const fullTitle = subtitle ? `${title}: ${subtitle}` : title;
          
          // 著者情報
          const authors = normalizeAuthors(volumeInfo.authors || []);
          
          // 出版年（YYYY-MM-DD形式から年のみ抽出）
          let year = '';
          if (volumeInfo.publishedDate) {
            const yearMatch = volumeInfo.publishedDate.match(/^\d{4}/);
            year = yearMatch ? yearMatch[0] : '';
          }
          
          // ISBN情報
          let isbn = '';
          if (volumeInfo.industryIdentifiers) {
            const isbn13 = volumeInfo.industryIdentifiers.find(id => id.type === 'ISBN_13');
            const isbn10 = volumeInfo.industryIdentifiers.find(id => id.type === 'ISBN_10');
            isbn = isbn13?.identifier || isbn10?.identifier || '';
          }

          if (subtitle) {
            console.log(`📚 Google Books結果: "${title}" + サブタイトル: "${subtitle}" → "${fullTitle}"`);
          }
          
          // 出版社情報のデバッグログ
          if (volumeInfo.publisher) {
            console.log(`📚 Google Books出版社: "${volumeInfo.publisher}"`);
          } else {
            console.log(`📚 Google Books: 出版社情報なし`);
          }

          return {
            title: fullTitle,
            authors: authors,
            year: year,
            doi: '', // Google Booksは通常DOIを提供しない
            journal: '', // 書籍なので掲載誌名はなし
            publisher: volumeInfo.publisher || '',
            volume: '', // 書籍なので巻はなし
            issue: '', // 書籍なので号はなし
            pages: volumeInfo.pageCount ? volumeInfo.pageCount.toString() : '',
            url: volumeInfo.previewLink || volumeInfo.canonicalVolumeLink || `https://books.google.com/books?id=${item.id}`,
            isbn: isbn,
            source: 'Google Books',
            isBook: true, // Google Booksからの結果は常に書籍
            originalData: item
          };
        });

        // 重複除去を一時的に無効化（デバッグ用）
        const uniqueResults = strategyResults;

        allResults.push(...uniqueResults);
        
        // 十分な結果が得られた場合は早期終了
        if (allResults.length >= 15) {
          console.log(`📚 Google Books: 十分な結果(${allResults.length}件)を取得、検索終了`);
          break;
        }
      } else {
        console.log(`📚 ${strategy.description}: 結果なし`);
      }
    } catch (error) {
      console.error(`Google Books API error for "${strategy.description}":`, error);
      
      // CORSエラーの場合は特別なメッセージを表示
      if (error.name === 'TypeError' && error.message.includes('CORS')) {
        console.warn('🚫 Google Books API: CORSエラーが発生しました。本番環境ではプロキシ経由で動作します。');
      }
      continue;
    }
  }

  console.log(`📊 Google Books検索完了: 計${allResults.length}件の書籍候補`);

  // タイトル一致度による絞り込み
  return filterAndRankByTitle(allResults, parsedInfo);
};

// CiNii API検索（統一フォーマット対応）
const searchCiNii = async (parsedInfo) => {
  console.log('🔍 CiNii検索開始 - parsedInfo:', {
    title: parsedInfo.title,
    language: parsedInfo.language,
    authors: parsedInfo.authors
  });
  
  if (!parsedInfo.title || parsedInfo.title.trim() === '') {
    console.warn('❌ CiNii: タイトルがないため検索をスキップ');
    return [];
  }

  // 🔧 特殊文字除去
  const cleanTitle = parsedInfo.title
    .replace(/[:;,()[\]"'\.…]/g, ' ')  // 特殊文字をスペースに置換（省略記号含む）
    .replace(/\s+/g, ' ')  // 連続スペースを1つに
    .trim();

  console.log(`🎯 CiNii タイトル検索: "${cleanTitle}"`);

  // タイトルを中心とした検索語を構成
  const searchTerm = cleanTitle;

  const queryParams = new URLSearchParams({
    q: searchTerm,
    count: '20',
    start: '1',
    format: 'rss'
  });

  console.log('🌐 CiNii API呼び出し URL:', `${API_CONFIG.CINII.endpoint}?${queryParams}`);
  
  try {
    const response = await fetchWithTimeout(
      `${API_CONFIG.CINII.endpoint}?${queryParams}`,
      {},
      API_CONFIG.CINII.timeout
    );

    if (!response.ok) {
      console.error('❌ CiNii API error:', response.status, response.statusText);
      return [];
    }
    
    console.log('✅ CiNii API response received, status:', response.status);

    const data = await response.json();
    console.log('📊 CiNii 統一フォーマットレスポンス:', data);
    
    // 統一フォーマットのresultsフィールドを使用
    if (data.results && Array.isArray(data.results)) {
      console.log(`📚 CiNii パース結果: ${data.results.length}件`);
      
      // タイトル一致度による絞り込み
      return filterAndRankByTitle(data.results, parsedInfo);
    } else {
      console.warn('⚠️ CiNii: 統一フォーマットのresultsフィールドが見つかりません');
      return [];
    }
  } catch (error) {
    console.error('CiNii API error:', error);
    return [];
  }
};

// 統合検索関数
export const searchAllDatabases = async (parsedInfo, onProgress) => {
  const results = {
    crossref: [],
    semanticScholar: [],
    cinii: [],
    googleBooks: [],
    ndl: []
  };

  console.log(`🌐 検索開始 - 言語: ${parsedInfo.language}, タイトル: ${parsedInfo.title?.substring(0, 30)}...`);

  // 言語に応じて検索順序と対象を変更
  let searchOrder;
  // console.log('🔍 言語判定結果:', parsedInfo.language);
  // console.log('📚 書籍判定結果:', parsedInfo.isBook);
  // console.log('📖 書籍の章判定結果:', parsedInfo.isBookChapter);
  
  if (parsedInfo.isBookChapter) {
    // 📖 書籍の章の場合：書籍データベースを優先
    if (parsedInfo.language === 'japanese') {
      // 日本語書籍の章：NDL → Google Books → CiNii → CrossRef（Semantic Scholar一時停止中）
      searchOrder = ['ndl', 'googleBooks', 'cinii', 'crossref'];
      console.log('📖 日本語書籍の章として検索: NDL → Google Books → CiNii → CrossRef');
    } else {
      // 英語書籍の章：Google Books → NDL → CrossRef → CiNii（Semantic Scholar一時停止中）
      searchOrder = ['googleBooks', 'ndl', 'crossref', 'cinii'];
      console.log('📖 英語書籍の章として検索: Google Books → NDL → CrossRef → CiNii');
    }
  } else if (parsedInfo.isBook) {
    // 📚 書籍の場合：言語別に最適化
    if (parsedInfo.language === 'japanese') {
      // 日本語書籍：国会図書館を最優先、次にCiNii（日本語データベース）、最後にGoogle Books
      searchOrder = ['ndl', 'cinii', 'googleBooks'];
      console.log('📚 日本語書籍として検索: 国会図書館 → CiNii → Google Books');
    } else {
      // 英語書籍：Google Booksを最優先、次にCrossRef（書籍情報も含む）、最後にCiNii
      searchOrder = ['googleBooks', 'crossref', 'cinii'];
      console.log('📚 英語書籍として検索: Google Books → CrossRef → CiNii');
    }
  } else {
    // 📄 論文の場合：言語別に最適化
    if (parsedInfo.language === 'japanese') {
      // 日本語論文：CiNiiを最優先（日本の学術論文）、次にCrossRef（Semantic Scholar一時停止中）
      searchOrder = ['cinii', 'crossref'];
      console.log('📄 日本語論文として検索: CiNii → CrossRef');
    } else {
      // 英語論文：CrossRefを最優先（国際的な学術論文）、次にCiNii（Semantic Scholar一時停止中）
      searchOrder = ['crossref', 'cinii'];
      console.log('📄 英語論文として検索: CrossRef → CiNii');
    }
  }
  
  console.log('📝 検索順序:', searchOrder);

  // すべてのAPIを順次実行（確実に1つずつ完了させる）
  console.log(`⏳ ${searchOrder.length}件のAPIを順次実行開始...`);
  console.log(`🔍 順次実行対象: ${searchOrder.join(' → ')}`);
  
  for (const source of searchOrder) {
    if (onProgress) {
      onProgress(source, 'searching');
    }

    try {
      let searchResults = [];
      
      console.log(`🔍 ${source} 検索開始...`);
      
      switch (source) {
        case 'googleBooks':
          searchResults = await searchGoogleBooks(parsedInfo);
          results.googleBooks = searchResults;
          break;
        case 'crossref':
          searchResults = await searchCrossRef(parsedInfo);
          results.crossref = searchResults;
          break;
        case 'semanticScholar':
          searchResults = await searchSemanticScholar(parsedInfo);
          results.semanticScholar = searchResults;
          break;
        case 'cinii':
          searchResults = await searchCiNii(parsedInfo);
          results.cinii = searchResults;
          break;
        case 'ndl':
          const ndlResponse = await searchNDL(parsedInfo);
          searchResults = ndlResponse.results || [];
          results.ndl = searchResults;
          break;
        default:
          console.warn(`Unknown search source: ${source}`);
          break;
      }

      console.log(`✅ ${source} 検索完了: ${searchResults.length}件の結果`);
      
      // 🔧 API完了の確実な確認のため少し待機
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (onProgress) {
        onProgress(source, 'completed', searchResults.length);
      }
      
      console.log(`🔒 ${source} 検索結果を確実に保存完了 - 次のAPIへ`);
      
    } catch (error) {
      console.error(`❌ ${source} 検索エラー:`, error);
      if (onProgress) {
        onProgress(source, 'error');
      }
      results[source] = [];
    }
  }

  console.log(`✅ すべてのAPI検索完了 - 結果統合開始`);
  
  // 結果の統計を出力
  const resultStats = searchOrder.map(source => {
    const count = results[source]?.length || 0;
    return `${source}: ${count}件`;
  }).join(', ');
  console.log(`📊 API検索結果統計: ${resultStats}`);

  // 全結果を統合して返す（undefined要素を除外）
  const allResults = [
    ...results.googleBooks,
    ...results.crossref,
    ...results.semanticScholar,
    ...results.cinii,
    ...results.ndl
  ].filter(result => result !== null && result !== undefined);
  
  console.log(`🔍 統合結果フィルタリング完了: ${allResults.length}件（undefined除去済み）`);
  
  return allResults;
};

// 関数をエクスポート
export { searchCrossRef, searchSemanticScholar, searchCiNii, searchGoogleBooks };