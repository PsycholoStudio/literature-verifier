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
try {
  const apaCitation = generateCitation(hallParsedInfo, hallMostSimilarResult, 'apa');
  console.log(apaCitation);
} catch (error) {
  console.error('Error generating APA citation:', error.message);
}
console.log();

// Test MLA format  
console.log('MLA Format:');
try {
  const mlaCitation = generateCitation(hallParsedInfo, hallMostSimilarResult, 'mla');
  console.log(mlaCitation);
} catch (error) {
  console.error('Error generating MLA citation:', error.message);
}
console.log();

// Test Chicago format
console.log('Chicago Format:');
try {
  const chicagoCitation = generateCitation(hallParsedInfo, hallMostSimilarResult, 'chicago');
  console.log(chicagoCitation);
} catch (error) {
  console.error('Error generating Chicago citation:', error.message);
}
console.log();

console.log('=== Testing Complete! ===');