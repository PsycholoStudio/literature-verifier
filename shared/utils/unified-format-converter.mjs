/**
 * Unified format conversion utilities for academic APIs
 * 
 * Schema:
 * - Article: isBook: false, isBookChapter: false
 * - Book: isBook: true, isBookChapter: false
 * - Book Chapter: isBook: true, isBookChapter: true
 */

// Since we're in the shared folder and normalizeAuthors is in the src folder,
// we'll implement a simple version here to avoid cross-dependencies
function normalizeAuthors(authorArray) {
  if (!Array.isArray(authorArray)) {
    return [];
  }
  
  return authorArray.map(author => {
    if (typeof author === 'string') {
      return author.trim();
    } else if (author && typeof author === 'object') {
      // Handle CrossRef format: { given: "John", family: "Smith" }
      if (author.given && author.family) {
        return `${author.given} ${author.family}`.trim();
      }
      // Handle Semantic Scholar format: { name: "John Smith" }
      if (author.name) {
        return author.name.trim();
      }
      // Handle other object formats
      if (author.first && author.last) {
        return `${author.first} ${author.last}`.trim();
      }
    }
    return '';
  }).filter(name => name.length > 0);
}

/**
 * Base converter class with common functionality
 */
export class BaseConverter {
  /**
   * Extract year from various date formats
   * @param {string|number} dateString - Date in various formats
   * @returns {string} Year as string
   */
  static extractYear(dateString) {
    if (!dateString) return '';
    
    const dateStr = dateString.toString();
    const yearMatch = dateStr.match(/^\d{4}/);
    return yearMatch ? yearMatch[0] : '';
  }

  /**
   * Combine title and subtitle
   * @param {string} title - Main title
   * @param {string} subtitle - Subtitle
   * @returns {string} Combined title
   */
  static combineTitle(title, subtitle) {
    if (!title) return '';
    if (!subtitle) return title;
    return `${title}: ${subtitle}`;
  }

  /**
   * Determine publication type flags
   * @param {string} type - Publication type from API
   * @returns {{isBook: boolean, isBookChapter: boolean}}
   */
  static getPublicationFlags(type) {
    const normalizedType = (type || '').toLowerCase();
    
    // Book chapter detection
    if (normalizedType.includes('book-chapter') || 
        normalizedType.includes('book_chapter') ||
        normalizedType.includes('chapter')) {
      return { isBook: true, isBookChapter: true };
    }
    
    // Book detection
    if (normalizedType.includes('book') || 
        normalizedType.includes('monograph') ||
        normalizedType.includes('edited-book') ||
        normalizedType.includes('reference-book')) {
      return { isBook: true, isBookChapter: false };
    }
    
    // Default to article
    return { isBook: false, isBookChapter: false };
  }

  /**
   * Create unified result object with defaults
   * @returns {Object} Default unified result
   */
  static createDefaultResult() {
    return {
      title: '',
      authors: [],
      year: '',
      doi: '',
      journal: '',
      publisher: '',
      volume: '',
      issue: '',
      pages: '',
      url: '',
      isbn: '',
      source: '',
      isBook: false,
      isBookChapter: false,
      bookTitle: '',
      editors: [],
      type: '',
      originalData: null
    };
  }
}

/**
 * CrossRef API format converter
 */
export class CrossRefConverter extends BaseConverter {
  /**
   * Convert CrossRef API response to unified format
   * @param {Object} item - CrossRef API item
   * @returns {Object} Unified format result
   */
  static convert(item) {
    const result = this.createDefaultResult();
    
    // Title and subtitle
    const title = item.title?.[0] || '';
    const subtitle = item.subtitle?.[0] || '';
    result.title = this.combineTitle(title, subtitle);
    
    // Authors and editors
    result.authors = normalizeAuthors(item.author || []);
    result.editors = item.editor ? normalizeAuthors(item.editor || []) : [];
    
    // Publication info
    result.year = item.published?.['date-parts']?.[0]?.[0]?.toString() || '';
    result.doi = item.DOI || '';
    result.publisher = item.publisher || '';
    result.volume = item.volume || '';
    result.issue = item.issue || '';
    result.pages = item.page || '';
    result.url = item.URL || '';
    
    // Journal/container title
    result.journal = item['container-title']?.[0] || '';
    
    // Type and flags
    result.type = item.type || '';
    const flags = this.getPublicationFlags(item.type);
    result.isBook = flags.isBook;
    result.isBookChapter = flags.isBookChapter;
    
    // Book-specific fields
    if (result.isBookChapter) {
      result.bookTitle = item['container-title']?.[0] || '';
    }
    
    // ISBN for books
    if (result.isBook && item.ISBN) {
      result.isbn = Array.isArray(item.ISBN) ? item.ISBN[0] : item.ISBN;
    }
    
    // Source and original data
    result.source = 'CrossRef';
    result.originalData = item;
    
    return result;
  }

  /**
   * Convert array of CrossRef items
   * @param {Array} items - Array of CrossRef API items
   * @returns {Array} Array of unified format results
   */
  static convertMany(items) {
    if (!Array.isArray(items)) return [];
    return items.map(item => this.convert(item));
  }
}

/**
 * Google Books API format converter
 */
export class GoogleBooksConverter extends BaseConverter {
  /**
   * Convert Google Books API response to unified format
   * @param {Object} item - Google Books API item
   * @returns {Object} Unified format result
   */
  static convert(item) {
    const result = this.createDefaultResult();
    const volumeInfo = item.volumeInfo || {};
    
    // Title and subtitle
    const title = volumeInfo.title || '';
    const subtitle = volumeInfo.subtitle || '';
    result.title = this.combineTitle(title, subtitle);
    
    // Authors
    result.authors = normalizeAuthors(volumeInfo.authors || []);
    
    // Publication info
    result.year = this.extractYear(volumeInfo.publishedDate);
    result.publisher = volumeInfo.publisher || '';
    result.pages = volumeInfo.pageCount ? volumeInfo.pageCount.toString() : '';
    result.url = `https://books.google.com/books?id=${item.id}`;
    
    // ISBN
    if (volumeInfo.industryIdentifiers) {
      const isbn13 = volumeInfo.industryIdentifiers.find(id => id.type === 'ISBN_13');
      const isbn10 = volumeInfo.industryIdentifiers.find(id => id.type === 'ISBN_10');
      result.isbn = isbn13?.identifier || isbn10?.identifier || '';
    }
    
    // Google Books results are always books
    result.isBook = true;
    result.isBookChapter = false;
    result.type = 'book';
    
    // Source and original data
    result.source = 'Google Books';
    result.originalData = item;
    
    return result;
  }

  /**
   * Convert array of Google Books items
   * @param {Array} items - Array of Google Books API items
   * @returns {Array} Array of unified format results
   */
  static convertMany(items) {
    if (!Array.isArray(items)) return [];
    return items.map(item => this.convert(item));
  }
}

/**
 * Semantic Scholar API format converter
 */
export class SemanticScholarConverter extends BaseConverter {
  /**
   * Convert Semantic Scholar API response to unified format
   * @param {Object} item - Semantic Scholar API item
   * @returns {Object} Unified format result
   */
  static convert(item) {
    const result = this.createDefaultResult();
    
    // Basic info
    result.title = item.title || '';
    result.authors = normalizeAuthors(item.authors || []);
    result.year = item.year?.toString() || '';
    result.doi = item.externalIds?.DOI || item.doi || '';
    result.journal = item.venue || item.journal?.name || '';
    result.url = item.url || '';
    
    // Publication types from Semantic Scholar
    const publicationTypes = item.publicationTypes || [];
    let isBook = false;
    let isBookChapter = false;
    
    // Check publication types array
    if (publicationTypes.includes('Book')) {
      isBook = true;
    }
    if (publicationTypes.includes('BookChapter')) {
      isBook = true;
      isBookChapter = true;
    }
    
    // If no specific type, assume it's an article
    if (!isBook && !isBookChapter && publicationTypes.length === 0) {
      // Default to article
      isBook = false;
      isBookChapter = false;
    }
    
    result.isBook = isBook;
    result.isBookChapter = isBookChapter;
    result.type = publicationTypes.join(', ') || 'article';
    
    // Source and original data
    result.source = 'Semantic Scholar';
    result.originalData = item;
    
    return result;
  }

  /**
   * Convert array of Semantic Scholar items
   * @param {Array} items - Array of Semantic Scholar API items
   * @returns {Array} Array of unified format results
   */
  static convertMany(items) {
    if (!Array.isArray(items)) return [];
    return items.map(item => this.convert(item));
  }
}

/**
 * Main converter factory
 */
export class UnifiedFormatConverter {
  /**
   * Convert API response based on source
   * @param {Object|Array} data - API response data
   * @param {string} source - API source ('crossref', 'google-books', 'semantic-scholar')
   * @returns {Object|Array} Unified format result(s)
   */
  static convert(data, source) {
    switch (source.toLowerCase()) {
      case 'crossref':
        return Array.isArray(data) 
          ? CrossRefConverter.convertMany(data)
          : CrossRefConverter.convert(data);
          
      case 'google-books':
      case 'googlebooks':
        return Array.isArray(data)
          ? GoogleBooksConverter.convertMany(data)
          : GoogleBooksConverter.convert(data);
          
      case 'semantic-scholar':
      case 'semanticscholar':
        return Array.isArray(data)
          ? SemanticScholarConverter.convertMany(data)
          : SemanticScholarConverter.convert(data);
          
      default:
        console.warn(`Unknown API source: ${source}`);
        return Array.isArray(data) ? [] : BaseConverter.createDefaultResult();
    }
  }
}