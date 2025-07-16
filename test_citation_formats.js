/**
 * Test citation formats for book chapters
 */

import { generateCitation } from './src/utils/citationFormatter.js';

// Test data for Hall book chapter
const hallParsedInfo = {
  title: 'Encoding/decoding',
  authors: ['Hall, S.'],
  year: '1980',
  language: 'english',
  isBook: false,
  isBookChapter: true,
  bookTitle: 'Culture, Media, Language',
  editors: ['Hall, S.', 'Hobson, D.', 'Lowe, A.', 'Willis, P.'],
  pages: '128-138',
  publisher: 'Hutchinson'
};

const hallMostSimilarResult = {
  title: 'Encoding/decoding',
  authors: ['Hall, S.'],
  year: '1980',
  isBookChapter: true,
  bookTitle: 'Culture, Media, Language',
  editors: ['Hall, S.', 'Hobson, D.', 'Lowe, A.', 'Willis, P.'],
  pages: '128-138',
  publisher: 'Hutchinson'
};

console.log('=== Testing Book Chapter Citation Formats ===\n');

// Test APA format
console.log('APA Format:');
const apaCitation = generateCitation(hallParsedInfo, hallMostSimilarResult, 'apa');
console.log(apaCitation);
console.log();

// Test MLA format  
console.log('MLA Format:');
const mlaCitation = generateCitation(hallParsedInfo, hallMostSimilarResult, 'mla');
console.log(mlaCitation);
console.log();

// Test Chicago format
console.log('Chicago Format:');
const chicagoCitation = generateCitation(hallParsedInfo, hallMostSimilarResult, 'chicago');
console.log(chicagoCitation);
console.log();

// Test Japanese book chapter
const japaneseParsedInfo = {
  title: 'メディア理論の基礎',
  authors: ['田中太郎', '鈴木花子'],
  year: '2020',
  language: 'japanese',
  isBook: false,
  isBookChapter: true,
  bookTitle: 'コミュニケーション研究の最前線',
  editors: ['山田一郎', '佐藤美子'],
  pages: '45-68',
  publisher: '学術出版社'
};

const japaneseMostSimilarResult = {
  title: 'メディア理論の基礎',
  authors: ['田中太郎', '鈴木花子'],
  year: '2020',
  isBookChapter: true,
  bookTitle: 'コミュニケーション研究の最前線',
  editors: ['山田一郎', '佐藤美子'],
  pages: '45-68',
  publisher: '学術出版社'
};

console.log('=== Testing Japanese Book Chapter Citation Formats ===\n');

// Test Japanese APA format
console.log('Japanese APA Format:');
const japaneseApaCitation = generateCitation(japaneseParsedInfo, japaneseMostSimilarResult, 'apa');
console.log(japaneseApaCitation);
console.log();

// Test Japanese MLA format
console.log('Japanese MLA Format:');
const japaneseMlaCitation = generateCitation(japaneseParsedInfo, japaneseMostSimilarResult, 'mla');
console.log(japaneseMlaCitation);
console.log();

// Test Japanese Chicago format
console.log('Japanese Chicago Format:');
const japaneseChicagoCitation = generateCitation(japaneseParsedInfo, japaneseMostSimilarResult, 'chicago');
console.log(japaneseChicagoCitation);
console.log();

console.log('=== Testing Complete! ===');