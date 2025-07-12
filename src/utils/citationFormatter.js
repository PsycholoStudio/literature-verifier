/**
 * 引用形式フォーマッター
 */

import { compareAuthors, compareYear } from './comparisonUtils';

// イタリック表示のヘルパー関数
const formatItalic = (text, isJapanese = false) => {
  if (!text) return '';
  // 日本語文献ではイタリックを使用しない
  if (isJapanese) {
    return text;
  }
  // 英語文献ではHTMLのemタグを使用
  return `<em>${text}</em>`;
};

// 引用スタイル生成（検索結果優先版）
export const generateCitation = (parsedInfo, mostSimilarResult, style = 'apa') => {
  // **検索結果を最優先**（入力情報は補完のみ）
  const title = mostSimilarResult?.title || parsedInfo?.title || '[Title unknown]';
  const authors = mostSimilarResult?.authors ? 
    (typeof mostSimilarResult.authors === 'string' ? 
      mostSimilarResult.authors.split(/[;,&]/).map(a => a.trim()).filter(a => a) : 
      mostSimilarResult.authors.map(a => typeof a === 'string' ? a : a.name).filter(a => a)
    ) : (parsedInfo?.authors || []);
  const year = mostSimilarResult?.year || parsedInfo?.year || 'n.d.';
  const journal = mostSimilarResult?.journal || parsedInfo?.journal || '';
  
  // 検索結果のみを使用（混在を避ける）
  const volume = mostSimilarResult?.volume || '';
  const issue = mostSimilarResult?.issue || '';
  const pages = mostSimilarResult?.pages || '';
  const publisher = parsedInfo?.publisher || '';
  const isBook = parsedInfo?.isBook || false;
  const doi = mostSimilarResult?.doi || '';
  const isJapanese = parsedInfo?.language === 'japanese';
  
  console.log('🔍 推定された引用のデータ確認:');
  console.log('  mostSimilarResult:', mostSimilarResult);
  console.log('  volume:', mostSimilarResult?.volume, '→', volume);
  console.log('  issue:', mostSimilarResult?.issue, '→', issue);
  console.log('  pages:', mostSimilarResult?.pages, '→', pages);
  
  console.log('引用生成用データ:', {
    title: title.substring(0, 50) + '...',
    authors: authors.slice(0, 2),
    year,
    journal,
    volume,
    issue,
    pages,
    isJapanese,
    source: mostSimilarResult?.source || 'input'
  });
  
  switch (style) {
    case 'apa':
      return isJapanese ? 
        generateJapaneseAPACitation(authors, year, title, journal, volume, issue, pages, publisher, isBook, doi) :
        generateEnglishAPACitation(authors, year, title, journal, volume, issue, pages, publisher, isBook, doi);
    case 'mla':
      return generateMLACitation(authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, isJapanese);
    case 'chicago':
      return generateChicagoCitation(authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, isJapanese);
    default:
      return isJapanese ? 
        generateJapaneseAPACitation(authors, year, title, journal, volume, issue, pages, publisher, isBook, doi) :
        generateEnglishAPACitation(authors, year, title, journal, volume, issue, pages, publisher, isBook, doi);
  }
};

// 日本語APA形式（日本心理学会準拠）
const generateJapaneseAPACitation = (authors, year, title, journal, volume, issue, pages, publisher, isBook, doi) => {
  let citation = '';
  
  // 著者名（日本語スタイル：中黒区切り）
  if (authors && authors.length > 0) {
    const cleanAuthors = authors.map(author => 
      author.replace(/[,，・•&;]/g, '').trim()
    ).filter(author => author.length > 0);
    
    if (cleanAuthors.length <= 3) {
      citation += cleanAuthors.join('・'); // 中黒で区切り
    } else {
      citation += cleanAuthors[0] + '・他'; // 4名以上は「他」
    }
  } else {
    citation += '[著者不明]';
  }
  
  // 年（日本語スタイル）
  citation += ` (${year})`;
  
  if (isBook) {
    // 書籍の場合
    citation += ` ${title}`;
    
    if (publisher) {
      citation += ` ${publisher}`;
    }
  } else {
    // 雑誌論文の場合
    citation += ` ${title}`;
    
    if (journal) {
      citation += ` ${journal}`;
      
      // 巻号（日本語スタイル）
      if (volume) {
        citation += `, ${volume}`;
        if (issue) {
          citation += `(${issue})`;
        }
      }
      
      // ページ（日本語スタイル）
      if (pages) {
        citation += `, ${pages}.`;
      } else {
        citation += '.';
      }
    }
  }
  
  // DOI（日本語でも英語形式）
  if (doi) {
    citation += ` https://doi.org/${doi.replace(/^doi:/, '')}`;
  }
  
  return citation;
};

// 英語APA形式（APA 7th edition準拠）
const generateEnglishAPACitation = (authors, year, title, journal, volume, issue, pages, publisher, isBook, doi) => {
  let citation = '';
  
  // 著者名（APA形式：姓, 名イニシャル）
  if (authors && authors.length > 0) {
    const cleanAuthors = authors.map(author => {
      const parts = author.replace(/[,，]/g, '').trim().split(/\s+/);
      if (parts.length >= 2) {
        const last = parts[parts.length - 1];
        const first = parts.slice(0, -1).join(' ');
        const initial = first.split(/\s+/).map(name => 
          name.charAt(0).toUpperCase() + '.'
        ).join(' ');
        return `${last}, ${initial}`;
      }
      return author;
    });
    
    let authorText;
    if (cleanAuthors.length === 1) {
      authorText = cleanAuthors[0];
    } else if (cleanAuthors.length === 2) {
      authorText = cleanAuthors.join(' & ');
    } else if (cleanAuthors.length <= 20) {
      authorText = cleanAuthors.slice(0, -1).join(', ') + ', & ' + cleanAuthors[cleanAuthors.length - 1];
    } else {
      authorText = cleanAuthors.slice(0, 19).join(', ') + ', ... ' + cleanAuthors[cleanAuthors.length - 1];
    }
    citation += authorText;
  } else {
    citation += '[Author unknown]';
  }
  
  // 年
  citation += ` (${year}).`;
  
  if (isBook) {
    // 書籍の場合
    citation += ` ${formatItalic(title)}.`;
    if (publisher) {
      citation += ` ${publisher}.`;
    }
  } else {
    // 雑誌論文の場合
    citation += ` ${title}.`;
    
    if (journal) {
      citation += ` ${formatItalic(journal)}`;
      
      // 巻号（英語スタイル）
      if (volume) {
        citation += `, ${formatItalic(volume)}`;
        if (issue) {
          citation += `(${issue})`;
        }
      }
      
      // ページ
      if (pages) {
        citation += `, ${pages}`;
      }
      citation += '.';
    }
  }
  
  // DOI
  if (doi) {
    citation += ` https://doi.org/${doi.replace(/^doi:/, '')}`;
  }
  
  return citation;
};

// MLA形式（MLA 9th edition準拠）
const generateMLACitation = (authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, isJapanese) => {
  let citation = '';
  
  // 著者名（MLA形式）
  if (authors && authors.length > 0) {
    if (isJapanese) {
      const cleanAuthors = authors.map(author => 
        author.replace(/[,，・•&;]/g, '').trim()
      ).filter(author => author.length > 0);
      citation += cleanAuthors.join('・');
    } else {
      if (authors.length === 1) {
        const parts = authors[0].split(/\s+/);
        if (parts.length >= 2) {
          citation += parts[parts.length - 1] + ', ' + parts.slice(0, -1).join(' ');
        } else {
          citation += authors[0];
        }
      } else if (authors.length === 2) {
        const parts1 = authors[0].split(/\s+/);
        const lastName1 = parts1.length >= 2 ? parts1[parts1.length - 1] + ', ' + parts1.slice(0, -1).join(' ') : authors[0];
        citation += lastName1 + ', and ' + authors[1];
      } else {
        const parts = authors[0].split(/\s+/);
        const lastName = parts.length >= 2 ? parts[parts.length - 1] + ', ' + parts.slice(0, -1).join(' ') : authors[0];
        citation += lastName + ', et al.';
      }
    }
    citation += '.';
  } else {
    citation += '[Author unknown].';
  }
  
  if (isBook) {
    // 書籍の場合
    citation += ` ${formatItalic(title, isJapanese)}.`;
    if (publisher) {
      citation += ` ${publisher},`;
    }
    citation += ` ${year}.`;
  } else {
    // 雑誌論文の場合
    citation += ` "${title}."`;
    
    if (journal) {
      citation += ` ${formatItalic(journal, isJapanese)}`;
      
      if (volume) {
        citation += `, vol. ${volume}`;
        if (issue) {
          citation += `, no. ${issue}`;
        }
      }
      
      citation += `, ${year}`;
      
      if (pages) {
        citation += `, pp. ${pages}`;
      }
      citation += '.';
    }
  }
  
  // DOI
  if (doi) {
    citation += ` doi:${doi.replace(/^doi:/, '')}.`;
  }
  
  return citation;
};

// Chicago形式（Chicago 17th edition準拠）
const generateChicagoCitation = (authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, isJapanese) => {
  let citation = '';
  
  // 著者名（Chicago形式）
  if (authors && authors.length > 0) {
    if (isJapanese) {
      const cleanAuthors = authors.map(author => 
        author.replace(/[,，・•&;]/g, '').trim()
      ).filter(author => author.length > 0);
      citation += cleanAuthors.join('・');
    } else {
      if (authors.length === 1) {
        const parts = authors[0].split(/\s+/);
        if (parts.length >= 2) {
          citation += parts[parts.length - 1] + ', ' + parts.slice(0, -1).join(' ');
        } else {
          citation += authors[0];
        }
      } else if (authors.length <= 3) {
        const formattedAuthors = authors.map((author, index) => {
          if (index === 0) {
            const parts = author.split(/\s+/);
            if (parts.length >= 2) {
              return parts[parts.length - 1] + ', ' + parts.slice(0, -1).join(' ');
            }
          }
          return author;
        });
        citation += formattedAuthors.slice(0, -1).join(', ') + ', and ' + formattedAuthors[formattedAuthors.length - 1];
      } else {
        const parts = authors[0].split(/\s+/);
        const lastName = parts.length >= 2 ? parts[parts.length - 1] + ', ' + parts.slice(0, -1).join(' ') : authors[0];
        citation += lastName + ' et al.';
      }
    }
    citation += '.';
  } else {
    citation += '[Author unknown].';
  }
  
  if (isBook) {
    // 書籍の場合
    citation += ` ${formatItalic(title, isJapanese)}.`;
    if (publisher) {
      citation += ` ${publisher},`;
    }
    citation += ` ${year}.`;
  } else {
    // 雑誌論文の場合
    citation += ` "${title}."`;
    
    if (journal) {
      citation += ` ${formatItalic(journal, isJapanese)}`;
      
      if (volume) {
        citation += ` ${volume}`;
        if (issue) {
          citation += `, no. ${issue}`;
        }
      }
      
      citation += ` (${year})`;
      
      if (pages) {
        citation += `: ${pages}`;
      }
      citation += '.';
    }
  }
  
  // DOI
  if (doi) {
    citation += ` https://doi.org/${doi.replace(/^doi:/, '')}.`;
  }
  
  return citation;
};

// 色分け引用形式生成（一致部分を緑、不一致部分を赤で表示）
export const generateColoredCitation = (parsedInfo, mostSimilarResult, style = 'apa', compareFieldsFunc) => {
  // **検索結果を最優先**（入力情報は補完のみ）
  const title = mostSimilarResult?.title || parsedInfo?.title || '[Title unknown]';
  const authors = mostSimilarResult?.authors ? 
    (typeof mostSimilarResult.authors === 'string' ? 
      mostSimilarResult.authors.split(/[;,&]/).map(a => a.trim()).filter(a => a) : 
      mostSimilarResult.authors.map(a => typeof a === 'string' ? a : a.name).filter(a => a)
    ) : (parsedInfo?.authors || []);
  const year = mostSimilarResult?.year || parsedInfo?.year || 'n.d.';
  const journal = mostSimilarResult?.journal || parsedInfo?.journal || '';
  
  // 検索結果を優先して取得（通常の引用と統一）
  const volume = mostSimilarResult?.volume || '';
  const issue = mostSimilarResult?.issue || '';
  const pages = mostSimilarResult?.pages || '';
  const publisher = parsedInfo?.publisher || '';
  const isBook = parsedInfo?.isBook || false;
  const doi = mostSimilarResult?.doi || parsedInfo?.doi || '';
  const isJapanese = parsedInfo?.language === 'japanese';
  
  // 一致状況を判定
  const authorMatch = compareAuthors(parsedInfo?.authors, authors);
  const titleMatch = compareFieldsFunc(parsedInfo?.title, title);
  const journalMatch = compareFieldsFunc(parsedInfo?.journal, journal);
  const yearMatch = compareYear(parsedInfo?.year, year);
  
  // 色分けヘルパー関数
  const colorize = (text, isMatch) => {
    const color = isMatch ? 'text-green-600' : 'text-red-600';
    return `<span class="${color}">${text}</span>`;
  };
  
  // スタイル別に色分け引用形式を生成
  switch (style) {
    case 'apa':
      return isJapanese ? 
        generateColoredJapaneseAPA(authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, authorMatch, yearMatch, titleMatch, journalMatch, colorize) :
        generateColoredEnglishAPA(authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, authorMatch, yearMatch, titleMatch, journalMatch, colorize);
    case 'mla':
      return generateColoredMLA(authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, isJapanese, authorMatch, yearMatch, titleMatch, journalMatch, colorize);
    case 'chicago':
      return generateColoredChicago(authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, isJapanese, authorMatch, yearMatch, titleMatch, journalMatch, colorize);
    default:
      return isJapanese ? 
        generateColoredJapaneseAPA(authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, authorMatch, yearMatch, titleMatch, journalMatch, colorize) :
        generateColoredEnglishAPA(authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, authorMatch, yearMatch, titleMatch, journalMatch, colorize);
  }
};

// 色分け日本語APA形式
const generateColoredJapaneseAPA = (authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, authorMatch, yearMatch, titleMatch, journalMatch, colorize) => {
  let citation = '';
  
  // 著者名
  if (authors && authors.length > 0) {
    const cleanAuthors = authors.map(author => 
      author.replace(/[,，・•&;]/g, '').trim()
    ).filter(author => author.length > 0);
    
    const authorText = cleanAuthors.length <= 3 ? cleanAuthors.join('・') : cleanAuthors[0] + '・他';
    citation += colorize(authorText, authorMatch);
  } else {
    citation += colorize('[著者不明]', false);
  }
  
  // 年
  citation += ` (${colorize(year, yearMatch)})`;
  
  if (isBook) {
    // 書籍の場合
    citation += ` ${colorize(title, titleMatch)}`;
    if (publisher) {
      citation += ` ${publisher}`;
    }
  } else {
    // 雑誌論文の場合
    citation += ` ${colorize(title, titleMatch)}`;
    
    if (journal) {
      citation += ` ${colorize(journal, journalMatch)}`;
      
      // 巻号
      if (volume) {
        citation += `, ${volume}`;
        if (issue) {
          citation += `(${issue})`;
        }
      }
      
      // ページ
      if (pages) {
        citation += `, ${pages}.`;
      } else {
        citation += '.';
      }
    }
  }
  
  // DOI
  if (doi) {
    citation += ` https://doi.org/${doi.replace(/^doi:/, '')}`;
  }
  
  return citation;
};

// 色分け英語APA形式
const generateColoredEnglishAPA = (authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, authorMatch, yearMatch, titleMatch, journalMatch, colorize) => {
  let citation = '';
  
  // 著者名
  if (authors && authors.length > 0) {
    const cleanAuthors = authors.map(author => {
      const parts = author.replace(/[,，]/g, '').trim().split(/\s+/);
      if (parts.length >= 2) {
        const last = parts[parts.length - 1];
        const first = parts.slice(0, -1).join(' ');
        const initial = first.split(/\s+/).map(name => 
          name.charAt(0).toUpperCase() + '.'
        ).join(' ');
        return `${last}, ${initial}`;
      }
      return author;
    });
    
    let authorText;
    if (cleanAuthors.length === 1) {
      authorText = cleanAuthors[0];
    } else if (cleanAuthors.length === 2) {
      authorText = cleanAuthors.join(' & ');
    } else if (cleanAuthors.length <= 20) {
      authorText = cleanAuthors.slice(0, -1).join(', ') + ', & ' + cleanAuthors[cleanAuthors.length - 1];
    } else {
      authorText = cleanAuthors.slice(0, 19).join(', ') + ', ... ' + cleanAuthors[cleanAuthors.length - 1];
    }
    citation += colorize(authorText, authorMatch);
  } else {
    citation += colorize('[Author unknown]', false);
  }
  
  // 年
  citation += ` (${colorize(year, yearMatch)})`;
  
  if (isBook) {
    // 書籍の場合
    citation += `. <em>${colorize(title, titleMatch)}</em>`;
    if (publisher) {
      citation += `. ${publisher}`;
    }
  } else {
    // 雑誌論文の場合
    citation += `. ${colorize(title, titleMatch)}`;
    
    if (journal) {
      citation += `. <em>${colorize(journal, journalMatch)}</em>`;
      
      // 巻号
      if (volume) {
        citation += `, <em>${volume}</em>`;
        if (issue) {
          citation += `(${issue})`;
        }
      }
      
      // ページ
      if (pages) {
        citation += `, ${pages}`;
      }
    }
  }
  
  // DOI
  if (doi) {
    citation += `. https://doi.org/${doi.replace(/^doi:/, '')}`;
  }
  
  return citation;
};

// 色分けMLA形式
const generateColoredMLA = (authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, isJapanese, authorMatch, yearMatch, titleMatch, journalMatch, colorize) => {
  let citation = '';
  
  // 著者名
  if (authors && authors.length > 0) {
    const authorText = isJapanese ? authors.join('・') : (authors[0] + (authors.length > 1 ? ', et al.' : ''));
    citation += colorize(authorText, authorMatch);
  } else {
    citation += colorize('[Author unknown]', false);
  }
  
  if (isBook) {
    // 書籍の場合
    const formattedTitle = isJapanese ? title : `<em>${title}</em>`;
    citation += ` ${colorize(formattedTitle, titleMatch)}`;
    if (publisher) {
      citation += `, ${publisher}`;
    }
    citation += `, ${colorize(year, yearMatch)}`;
  } else {
    // 雑誌論文の場合
    citation += ` "${colorize(title, titleMatch)}."`;
    
    if (journal) {
      const formattedJournal = isJapanese ? journal : `<em>${journal}</em>`;
      citation += ` ${colorize(formattedJournal, journalMatch)}`;
      
      if (volume) {
        citation += `, vol. ${volume}`;
        if (issue) {
          citation += `, no. ${issue}`;
        }
      }
      
      citation += `, ${colorize(year, yearMatch)}`;
      
      if (pages) {
        citation += `, pp. ${pages}`;
      }
    }
  }
  
  // DOI
  if (doi) {
    citation += `, doi:${doi.replace(/^doi:/, '')}`;
  }
  
  return citation;
};

// 色分けChicago形式
const generateColoredChicago = (authors, year, title, journal, volume, issue, pages, publisher, isBook, doi, isJapanese, authorMatch, yearMatch, titleMatch, journalMatch, colorize) => {
  let citation = '';
  
  // 著者名
  if (authors && authors.length > 0) {
    const authorText = isJapanese ? authors.join('・') : (authors[0] + (authors.length > 1 ? ' et al.' : ''));
    citation += colorize(authorText, authorMatch);
  } else {
    citation += colorize('[Author unknown]', false);
  }
  
  if (isBook) {
    // 書籍の場合
    const formattedTitle = isJapanese ? title : `<em>${title}</em>`;
    citation += ` ${colorize(formattedTitle, titleMatch)}`;
    if (publisher) {
      citation += `. ${publisher}`;
    }
    citation += `, ${colorize(year, yearMatch)}`;
  } else {
    // 雑誌論文の場合
    citation += ` "${colorize(title, titleMatch)}."`;
    
    if (journal) {
      const formattedJournal = isJapanese ? journal : `<em>${journal}</em>`;
      citation += ` ${colorize(formattedJournal, journalMatch)}`;
      
      if (volume) {
        citation += ` ${volume}`;
        if (issue) {
          citation += `, no. ${issue}`;
        }
      }
      
      if (year) {
        citation += ` (${colorize(year, yearMatch)})`;
      }
      
      if (pages) {
        citation += `: ${pages}`;
      }
    }
  }
  
  // DOI
  if (doi) {
    citation += `. https://doi.org/${doi.replace(/^doi:/, '')}`;
  }
  
  return citation;
};

