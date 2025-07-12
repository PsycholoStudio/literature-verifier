/**
 * 候補文献フォーマッター
 */

import { compareAuthors, compareYear } from './comparisonUtils';

// 候補文献用の引用フォーマット（部分一致表示付き）
export const formatCandidateCitation = (candidate, parsedInfo, style = 'apa') => {
  const isJapanese = parsedInfo?.language === 'japanese';
  
  // 基本情報を取得（citationFormatter.jsと同じロジック）
  const candidateData = {
    title: candidate.title || '[Title unknown]',
    // 著者処理をcitationFormatter.jsと統一
    authors: candidate.authors ? 
      (typeof candidate.authors === 'string' ? 
        candidate.authors.split(/[;,&]/).map(a => a.trim()).filter(a => a) : 
        candidate.authors.map(a => typeof a === 'string' ? a : a.name).filter(a => a)
      ) : [],
    year: candidate.year || 'n.d.',
    journal: candidate.journal || '',
    volume: candidate.volume || '',
    issue: candidate.issue || '',
    pages: candidate.pages || '',
    doi: candidate.doi || ''
  };
  
  // 部分一致のハイライト処理
  const highlightPartialMatch = (original, candidate) => {
    if (!original || !candidate) return candidate;
    
    const originalLower = original.toLowerCase();
    const candidateLower = candidate.toLowerCase();
    
    // 完全一致の場合は全体を緑に
    if (originalLower === candidateLower) {
      return `<span class="text-green-600 font-medium">${candidate}</span>`;
    }
    
    // 部分一致の処理（単語単位）
    const originalWords = originalLower.split(/\s+/);
    const candidateWords = candidate.split(/\s+/);
    
    return candidateWords.map(word => {
      const wordLower = word.toLowerCase();
      const hasMatch = originalWords.some(ow => {
        return ow.includes(wordLower) || wordLower.includes(ow);
      });
      
      if (hasMatch) {
        return `<span class="text-green-600 font-medium">${word}</span>`;
      } else {
        return `<span class="text-red-600">${word}</span>`;
      }
    }).join(' ');
  };
  
  // 著者名の比較とハイライト（citationFormatter.jsと同じAPAスタイル）
  const formatAuthorsWithComparison = (candidateAuthors, originalAuthors, isJapanese) => {
    if (!candidateAuthors || candidateAuthors.length === 0) return '';
    
    const validAuthors = candidateAuthors.filter(a => a && a.trim());
    if (validAuthors.length === 0) return '';
    
    let authorText;
    
    if (isJapanese) {
      // 日本語著者：中黒区切り
      const cleanAuthors = validAuthors.map(author => 
        author.replace(/[,，・•&;]/g, '').trim()
      ).filter(author => author.length > 0);
      
      if (cleanAuthors.length <= 3) {
        authorText = cleanAuthors.join('・');
      } else {
        authorText = cleanAuthors[0] + '・他';
      }
    } else {
      // 英語著者：APAスタイル（姓, 名イニシャル）
      const cleanAuthors = validAuthors.map(author => {
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
      
      if (cleanAuthors.length === 1) {
        authorText = cleanAuthors[0];
      } else if (cleanAuthors.length === 2) {
        authorText = cleanAuthors.join(' & ');
      } else if (cleanAuthors.length <= 20) {
        authorText = cleanAuthors.slice(0, -1).join(', ') + ', & ' + cleanAuthors[cleanAuthors.length - 1];
      } else {
        authorText = cleanAuthors.slice(0, 19).join(', ') + ', ... ' + cleanAuthors[cleanAuthors.length - 1];
      }
    }
    
    if (!originalAuthors || originalAuthors.length === 0) {
      return authorText;
    }
    
    // 著者比較（citationFormatter.jsと同じ順序）
    const isMatch = compareAuthors(originalAuthors, validAuthors);
    if (isMatch) {
      return `<span class="text-green-600 font-medium">${authorText}</span>`;
    } else {
      return `<span class="text-red-600">${authorText}</span>`;
    }
  };
  
  // 年の比較とハイライト
  const formatYearWithComparison = (candidateYear, originalYear) => {
    if (!candidateYear) return 'n.d.';
    
    if (!originalYear) return candidateYear;
    
    const isMatch = compareYear(originalYear, candidateYear);
    if (isMatch) {
      return `<span class="text-green-600 font-medium">${candidateYear}</span>`;
    } else {
      return `<span class="text-red-600">${candidateYear}</span>`;
    }
  };
  
  // APA形式で引用を構築
  let citation = '';
  
  // 著者
  const authorsText = formatAuthorsWithComparison(candidateData.authors, parsedInfo?.authors, isJapanese);
  if (authorsText) {
    citation += authorsText;
  }
  
  // 年
  const yearText = formatYearWithComparison(candidateData.year, parsedInfo?.year);
  citation += citation ? ` (${yearText}).` : `(${yearText}).`;
  
  // タイトル（部分一致ハイライト）
  const highlightedTitle = highlightPartialMatch(parsedInfo?.title, candidateData.title);
  
  if (candidateData.journal) {
    // 雑誌論文
    citation += ` "${highlightedTitle}."`;
    
    const journalHighlighted = highlightPartialMatch(parsedInfo?.journal, candidateData.journal);
    const formattedJournal = isJapanese ? journalHighlighted : `<em>${journalHighlighted}</em>`;
    citation += ` ${formattedJournal}`;
    
    // 巻号・ページ情報を追加
    if (candidateData.volume) {
      citation += `, ${candidateData.volume}`;
      if (candidateData.issue) {
        citation += `(${candidateData.issue})`;
      }
    }
    
    if (candidateData.pages) {
      citation += `, ${candidateData.pages}`;
    }
  } else {
    // 書籍
    const bookTitle = isJapanese ? highlightedTitle : `<em>${highlightedTitle}</em>`;
    citation += ` ${bookTitle}`;
  }
  
  // DOI
  if (candidateData.doi) {
    citation += `. https://doi.org/${candidateData.doi.replace(/^doi:/, '')}`;
  }
  
  return citation;
};