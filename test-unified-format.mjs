/**
 * Test script for unified format conversion
 */

import { UnifiedFormatConverter, CrossRefConverter, GoogleBooksConverter, SemanticScholarConverter } from './shared/utils/unified-format-converter.mjs';

// Test data samples
const crossrefSample = {
  "DOI": "10.1037/h0036316",
  "title": ["The magical number seven, plus or minus two"],
  "subtitle": ["Some limits on our capacity for processing information"],
  "author": [
    { "given": "George A.", "family": "Miller", "sequence": "first", "affiliation": [] }
  ],
  "published": { "date-parts": [[1956]] },
  "container-title": ["Psychological Review"],
  "publisher": "American Psychological Association",
  "type": "journal-article",
  "volume": "63",
  "issue": "2",
  "page": "81-97",
  "URL": "https://doi.org/10.1037/h0036316"
};

const bookChapterSample = {
  "DOI": "10.1007/978-1-4612-4380-9_1",
  "title": ["Introduction to Statistical Learning"],
  "author": [
    { "given": "Robert", "family": "Tibshirani", "sequence": "first" }
  ],
  "editor": [
    { "given": "John", "family": "Smith", "sequence": "first" }
  ],
  "published": { "date-parts": [[2013]] },
  "container-title": ["An Introduction to Statistical Learning"],
  "publisher": "Springer",
  "type": "book-chapter",
  "page": "1-14",
  "ISBN": ["978-1-4612-4380-9"]
};

const googleBooksSample = {
  "id": "1234567890",
  "volumeInfo": {
    "title": "The Art of Computer Programming",
    "subtitle": "Volume 1: Fundamental Algorithms",
    "authors": ["Donald E. Knuth"],
    "publishedDate": "1997-07-04",
    "publisher": "Addison-Wesley",
    "industryIdentifiers": [
      { "type": "ISBN_13", "identifier": "9780201896831" },
      { "type": "ISBN_10", "identifier": "0201896834" }
    ],
    "pageCount": 672
  }
};

const semanticScholarSample = {
  "paperId": "649def34f8be52c8b66281af98ae884c09aef38b",
  "title": "Construction of the Literature Graph in Semantic Scholar",
  "authors": [
    { "authorId": "1741101", "name": "Waleed Ammar" },
    { "authorId": "1678980", "name": "Dirk Groeneveld" }
  ],
  "year": 2018,
  "venue": "NAACL",
  "publicationTypes": ["Conference"],
  "externalIds": {
    "DOI": "10.18653/v1/N18-3011"
  },
  "url": "https://www.semanticscholar.org/paper/649def34f8be52c8b66281af98ae884c09aef38b"
};

const semanticScholarBookSample = {
  "paperId": "123456",
  "title": "Deep Learning",
  "authors": [
    { "authorId": "123", "name": "Ian Goodfellow" },
    { "authorId": "456", "name": "Yoshua Bengio" },
    { "authorId": "789", "name": "Aaron Courville" }
  ],
  "year": 2016,
  "publicationTypes": ["Book"],
  "url": "https://www.semanticscholar.org/paper/123456"
};

const semanticScholarBookChapterSample = {
  "paperId": "789012",
  "title": "Convolutional Networks",
  "authors": [
    { "authorId": "123", "name": "Yann LeCun" }
  ],
  "year": 2015,
  "venue": "Deep Learning",
  "publicationTypes": ["BookChapter"],
  "url": "https://www.semanticscholar.org/paper/789012"
};

console.log('🧪 Testing Unified Format Converters\n');

// Test CrossRef converter
console.log('📚 Testing CrossRef Converter:');
console.log('1. Journal Article:');
const crossrefArticle = CrossRefConverter.convert(crossrefSample);
console.log(`   Title: ${crossrefArticle.title}`);
console.log(`   Type: ${crossrefArticle.type}`);
console.log(`   isBook: ${crossrefArticle.isBook}, isBookChapter: ${crossrefArticle.isBookChapter}`);
console.log(`   Authors: ${crossrefArticle.authors.join(', ')}`);
console.log(`   Journal: ${crossrefArticle.journal}`);

console.log('\n2. Book Chapter:');
const crossrefChapter = CrossRefConverter.convert(bookChapterSample);
console.log(`   Title: ${crossrefChapter.title}`);
console.log(`   Type: ${crossrefChapter.type}`);
console.log(`   isBook: ${crossrefChapter.isBook}, isBookChapter: ${crossrefChapter.isBookChapter}`);
console.log(`   Book Title: ${crossrefChapter.bookTitle}`);
console.log(`   Editors: ${crossrefChapter.editors.join(', ')}`);
console.log(`   ISBN: ${crossrefChapter.isbn}`);

// Test Google Books converter
console.log('\n\n📖 Testing Google Books Converter:');
const googleBook = GoogleBooksConverter.convert(googleBooksSample);
console.log(`   Title: ${googleBook.title}`);
console.log(`   Type: ${googleBook.type}`);
console.log(`   isBook: ${googleBook.isBook}, isBookChapter: ${googleBook.isBookChapter}`);
console.log(`   Authors: ${googleBook.authors.join(', ')}`);
console.log(`   Publisher: ${googleBook.publisher}`);
console.log(`   ISBN: ${googleBook.isbn}`);
console.log(`   Pages: ${googleBook.pages}`);

// Test Semantic Scholar converter
console.log('\n\n🎓 Testing Semantic Scholar Converter:');
console.log('1. Conference Paper:');
const ssArticle = SemanticScholarConverter.convert(semanticScholarSample);
console.log(`   Title: ${ssArticle.title}`);
console.log(`   Type: ${ssArticle.type}`);
console.log(`   isBook: ${ssArticle.isBook}, isBookChapter: ${ssArticle.isBookChapter}`);
console.log(`   Authors: ${ssArticle.authors.join(', ')}`);
console.log(`   Venue: ${ssArticle.journal}`);

console.log('\n2. Book:');
const ssBook = SemanticScholarConverter.convert(semanticScholarBookSample);
console.log(`   Title: ${ssBook.title}`);
console.log(`   Type: ${ssBook.type}`);
console.log(`   isBook: ${ssBook.isBook}, isBookChapter: ${ssBook.isBookChapter}`);
console.log(`   Authors: ${ssBook.authors.join(', ')}`);

console.log('\n3. Book Chapter:');
const ssChapter = SemanticScholarConverter.convert(semanticScholarBookChapterSample);
console.log(`   Title: ${ssChapter.title}`);
console.log(`   Type: ${ssChapter.type}`);
console.log(`   isBook: ${ssChapter.isBook}, isBookChapter: ${ssChapter.isBookChapter}`);
console.log(`   Venue/Book: ${ssChapter.journal}`);

// Test factory converter
console.log('\n\n🏭 Testing UnifiedFormatConverter Factory:');
const factoryResult = UnifiedFormatConverter.convert([crossrefSample, bookChapterSample], 'crossref');
console.log(`   Converted ${factoryResult.length} CrossRef items`);
console.log(`   Item 1: ${factoryResult[0].title} (${factoryResult[0].type})`);
console.log(`   Item 2: ${factoryResult[1].title} (${factoryResult[1].type})`);

console.log('\n✅ Unified format conversion test completed!');