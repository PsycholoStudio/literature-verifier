/**
 * API統一レスポンスフォーマッター (ES6 Module版)
 * 各外部APIのレスポンスを統一フォーマットに変換
 */

/**
 * CrossRefレスポンスを統一フォーマットに変換
 */
export function formatCrossRefResponse(crossRefData) {
  if (!crossRefData?.message?.items) {
    console.log(`📊 CrossRef API レスポンス: 0件`);
    console.log(`📊 CrossRef解析完了: 0件の結果を抽出`);
    return { results: [], source: 'CrossRef', query: {} };
  }


  const results = crossRefData.message.items.map(item => {
    // タイプ判定（CrossRefの型情報を使用）
    const type = item.type || '';
    const isBookChapter = type === 'book-chapter';
    const isBook = isBookChapter || type === 'book' || type === 'monograph';

    // 著者情報の正規化
    const authors = [];
    if (item.author && Array.isArray(item.author)) {
      item.author.forEach(author => {
        if (author.given && author.family) {
          authors.push(`${author.given} ${author.family}`);
        } else if (author.family) {
          authors.push(author.family);
        } else if (author.name) {
          authors.push(author.name);
        }
      });
    }

    // 編者情報の正規化（書籍の章用）
    const editors = [];
    if (item.editor && Array.isArray(item.editor)) {
      item.editor.forEach(editor => {
        if (editor.given && editor.family) {
          editors.push(`${editor.given} ${editor.family}`);
        } else if (editor.family) {
          editors.push(editor.family);
        } else if (editor.name) {
          editors.push(editor.name);
        }
      });
    }

    // 出版年の抽出
    let year = '';
    if (item['published-print']?.['date-parts']?.[0]?.[0]) {
      year = item['published-print']['date-parts'][0][0].toString();
    } else if (item['published-online']?.['date-parts']?.[0]?.[0]) {
      year = item['published-online']['date-parts'][0][0].toString();
    } else if (item.created?.['date-parts']?.[0]?.[0]) {
      year = item.created['date-parts'][0][0].toString();
    }

    // DOI正規化
    let doi = item.DOI || '';
    if (doi && !doi.startsWith('10.')) {
      doi = doi.replace(/^doi:/, '').replace(/^https?:\/\/doi\.org\//, '');
    }

    // ページ情報
    let pages = '';
    if (item.page) {
      pages = item.page;
    } else if (item['article-number']) {
      pages = item['article-number'];
    }

    // 統一フォーマット
    const result = {
      title: Array.isArray(item.title) ? item.title[0] : (item.title || ''),
      authors,
      year,
      doi,
      journal: isBookChapter ? '' : (item['container-title']?.[0] || ''),
      publisher: item.publisher || '',
      volume: item.volume || '',
      issue: item.issue || '',
      pages,
      url: item.URL || (doi ? `https://doi.org/${doi}` : ''),
      source: 'CrossRef',
      isBook,
      isBookChapter,
      bookTitle: isBookChapter ? (item['container-title']?.[0] || '') : '',
      editors: isBookChapter ? editors : [],
      isbn: '', // CrossRefではISBN情報は通常含まれない
      originalData: {
        type: item.type,
        crossRefItem: item
      }
    };

    return result;
  });

  console.log(`📊 CrossRef解析完了: ${results.length}件の結果を抽出`);
  
  return {
    results,
    source: 'CrossRef',
    query: crossRefData.query || {}
  };
}

/**
 * Google Booksレスポンスを統一フォーマットに変換
 */
export function formatGoogleBooksResponse(googleBooksData) {
  if (!googleBooksData?.items) {
    console.log(`📊 Google Books API レスポンス: 0件`);
    console.log(`📊 Google Books解析完了: 0件の結果を抽出`);
    return { results: [], source: 'Google Books', query: {} };
  }

  const itemCount = googleBooksData.items.length;
  console.log(`📊 Google Books API レスポンス: ${itemCount}件受信`);

  const results = googleBooksData.items.map(item => {
    const volumeInfo = item.volumeInfo || {};
    
    // Google Booksは基本的に書籍のみ
    const isBook = true;
    const isBookChapter = false; // Google Books APIは通常書籍全体を返す

    // 著者情報
    const authors = volumeInfo.authors || [];

    // 出版年の抽出
    let year = '';
    if (volumeInfo.publishedDate) {
      const yearMatch = volumeInfo.publishedDate.match(/(\d{4})/);
      year = yearMatch ? yearMatch[1] : '';
    }

    // ISBN抽出
    let isbn = '';
    if (volumeInfo.industryIdentifiers) {
      const isbnData = volumeInfo.industryIdentifiers.find(id => 
        id.type === 'ISBN_13' || id.type === 'ISBN_10'
      );
      isbn = isbnData ? isbnData.identifier : '';
    }

    // タイトル構築（サブタイトル含む）
    let title = volumeInfo.title || '';
    if (volumeInfo.subtitle) {
      title += `: ${volumeInfo.subtitle}`;
    }

    const result = {
      title,
      authors,
      year,
      doi: '', // Google Booksは通常DOIを提供しない
      journal: '', // 書籍なので掲載誌名は空
      publisher: volumeInfo.publisher || '',
      volume: '',
      issue: '',
      pages: volumeInfo.pageCount ? volumeInfo.pageCount.toString() : '',
      url: volumeInfo.infoLink || volumeInfo.canonicalVolumeLink || '',
      source: 'Google Books',
      isBook,
      isBookChapter,
      bookTitle: '', // 書籍全体なので空
      editors: [], // 書籍全体なので編者は空
      isbn,
      originalData: {
        googleBooksItem: item,
        volumeInfo
      }
    };

    return result;
  });

  console.log(`📊 Google Books解析完了: ${results.length}件の結果を抽出`);
  
  return {
    results,
    source: 'Google Books',
    query: googleBooksData.query || {}
  };
}

/**
 * Semantic Scholarレスポンスを統一フォーマットに変換
 */
export function formatSemanticScholarResponse(semanticScholarData) {
  if (!semanticScholarData?.data) {
    console.log(`📊 Semantic Scholar API レスポンス: 0件`);
    console.log(`📊 Semantic Scholar解析完了: 0件の結果を抽出`);
    return { results: [], source: 'Semantic Scholar', query: {} };
  }

  const itemCount = semanticScholarData.data.length;
  console.log(`📊 Semantic Scholar API レスポンス: ${itemCount}件受信`);

  const results = semanticScholarData.data.map(item => {
    // Semantic Scholarは主に学術論文
    const isBook = false;
    const isBookChapter = false;

    // 著者情報
    const authors = [];
    if (item.authors && Array.isArray(item.authors)) {
      item.authors.forEach(author => {
        if (author.name) {
          authors.push(author.name);
        }
      });
    }

    // 出版年の抽出
    let year = '';
    if (item.publicationDate) {
      const yearMatch = item.publicationDate.match(/(\d{4})/);
      year = yearMatch ? yearMatch[1] : '';
    } else if (item.year) {
      year = item.year.toString();
    }

    // DOI抽出
    let doi = '';
    if (item.externalIds?.DOI) {
      doi = item.externalIds.DOI;
    }

    // 掲載誌名（venue または journal）
    const journal = item.venue || item.journal?.name || '';

    const result = {
      title: item.title || '',
      authors,
      year,
      doi,
      journal,
      publisher: '', // Semantic Scholarは通常出版社情報を提供しない
      volume: '',
      issue: '',
      pages: '',
      url: item.url || (item.paperId ? `https://www.semanticscholar.org/paper/${item.paperId}` : ''),
      source: 'Semantic Scholar',
      isBook,
      isBookChapter,
      bookTitle: '',
      editors: [],
      isbn: '',
      originalData: {
        semanticScholarItem: item,
        paperId: item.paperId,
        citationCount: item.citationCount
      }
    };

    return result;
  });

  console.log(`📊 Semantic Scholar解析完了: ${results.length}件の結果を抽出`);
  
  return {
    results,
    source: 'Semantic Scholar',
    query: semanticScholarData.query || {}
  };
}

/**
 * NDLレスポンスを統一フォーマットに変換（既に対応済みだが念のため）
 */
export function formatNDLResponse(ndlData) {
  // NDLは既に統一フォーマットで返されているのでそのまま返す
  if (ndlData && ndlData.results) {
    console.log(`📊 NDL解析完了: ${ndlData.results.length}件の結果を抽出`);
  }
  return ndlData;
}

/**
 * 出版社名から地名を除去 (ES6版)
 */
function cleanPublisherName(publisher) {
  if (!publisher || typeof publisher !== 'string') return '';
  
  // 「地名 : 出版社名」パターンを処理
  const cleaned = publisher
    .replace(/^[^:：]+[：:]\s*/, '') // 地名部分を削除（例：「東京 : 大法輪閣」→「大法輪閣」）
    .replace(/^\s*\[.*?\]\s*/, '') // 先頭の角括弧を削除
    .replace(/\s*\[.*?\]\s*$/, '') // 末尾の角括弧を削除
    .trim();
  
  // console.log(`📍 出版社名クリーニング (ES6): "${publisher}" → "${cleaned}"`);
  return cleaned || publisher; // クリーニング後が空の場合は元の値を返す
}

/**
 * CiNiiレスポンスを統一フォーマットに変換
 */
export function formatCiNiiResponse(ciniiData) {
  if (!ciniiData?.results) {
    return { results: [], source: 'CiNii', query: {} };
  }

  // 結果を再処理して出版社名クリーニングと掲載誌名修正を適用
  const enhancedResults = ciniiData.results.map(item => {
    const rawPublisher = item.originalData?.rawPublisher || item.publisher || '';
    const cleanedPublisher = cleanPublisherName(rawPublisher);
    const publicationName = item.originalData?.publicationName || '';
    
    return {
      ...item,
      journal: publicationName || item.journal || cleanedPublisher,
      publisher: cleanedPublisher,
      originalData: {
        ...item.originalData,
        rawPublisher,
        publicationName
      }
    };
  });

  console.log(`📊 CiNii後処理完了: ${enhancedResults.length}件の結果を改善`);
  
  return {
    ...ciniiData,
    results: enhancedResults
  };
}