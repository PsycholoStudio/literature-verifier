/**
 * Citation Classification Test
 * テスト用の引用文献データ - 記事、書籍、書籍の章の分類検証
 */

import { parseLiterature } from './citationParser';

describe('Citation Classification Tests', () => {
  // テストデータ: 記事
  const journalArticles = [
    // 英語論文
    {
      citation: "Smith, J. (2020). Machine learning in healthcare. Journal of Medical Research, 45(3), 123-145.",
      expected: { isBook: false, isBookChapter: false, type: "journal article" }
    },
    {
      citation: "Brown, A., & Johnson, M. (2019). Climate change impacts on biodiversity. Nature Climate Change, 9, 876-882.",
      expected: { isBook: false, isBookChapter: false, type: "journal article" }
    },
    {
      citation: "Chen, L., Davis, R., & Wilson, K. (2021). Deep learning for image recognition. IEEE Transactions on Pattern Analysis and Machine Intelligence, 43(8), 2755-2770.",
      expected: { isBook: false, isBookChapter: false, type: "journal article" }
    },
    
    // 日本語論文
    {
      citation: "田中太郎 (2020). 人工知能の教育応用に関する研究. 教育情報研究, 35(4), 15-28.",
      expected: { isBook: false, isBookChapter: false, type: "journal article" }
    },
    {
      citation: "佐藤花子・山田次郎 (2019). 持続可能な社会の構築に向けた環境教育の役割. 環境教育学研究, 28(2), 45-60.",
      expected: { isBook: false, isBookChapter: false, type: "journal article" }
    },
    {
      citation: "鈴木一郎 (2021). 「コロナ禍における大学教育のデジタル化」『高等教育研究』第24巻第3号, 89-104頁.",
      expected: { isBook: false, isBookChapter: false, type: "journal article" }
    },
    // 巻とページ番号を持つ記事（書籍章と誤判定されやすいパターン）
    {
      citation: "坂部創一, 山崎秀夫 (2019). インターネット利用が新型うつ傾向へ及ぼす悪影響と予防策の縦断研究. キャリア教育研究, 33, 139-146.",
      expected: { isBook: false, isBookChapter: false, type: "journal article" }
    }
  ];

  // テストデータ: 書籍
  const books = [
    // 英語書籍
    {
      citation: "Johnson, M. (2020). The Future of Artificial Intelligence. New York: Academic Press.",
      expected: { isBook: true, isBookChapter: false, type: "book" }
    },
    {
      citation: "Brown, S., & Wilson, R. (2019). Climate Science: A Global Perspective (3rd ed.). London: Cambridge University Press.",
      expected: { isBook: true, isBookChapter: false, type: "book" }
    },
    {
      citation: "Davis, A. (2021). Machine Learning Fundamentals. San Francisco: Tech Publishers, 450 pages.",
      expected: { isBook: true, isBookChapter: false, type: "book" }
    },
    
    // 日本語書籍
    {
      citation: "田中太郎 (2020). 『人工知能と社会』東京: 学術出版社.",
      expected: { isBook: true, isBookChapter: false, type: "book" }
    },
    {
      citation: "佐藤花子 (2019). 『環境教育の理論と実践』(第2版) 京都: 教育書房, 320頁.",
      expected: { isBook: true, isBookChapter: false, type: "book" }
    },
    {
      citation: "山田次郎・鈴木一郎 (2021). 『コロナ時代の教育改革』 大阪: 未来出版.",
      expected: { isBook: true, isBookChapter: false, type: "book" }
    }
  ];

  // テストデータ: 書籍の章
  const bookChapters = [
    // 英語書籍の章
    {
      citation: "Hall, S. (1980). Encoding/decoding. In Culture, Media, Language, 128–138.",
      expected: { isBook: false, isBookChapter: true, type: "book chapter" }
    },
    {
      citation: "Smith, J. (2020). Machine learning in education. In A. Brown (Ed.), Technology and Learning (pp. 45-67). New York: Academic Press.",
      expected: { isBook: false, isBookChapter: true, type: "book chapter" }
    },
    {
      citation: "Wilson, R., & Davis, M. (2019). Climate adaptation strategies. In Climate Change and Society (Ch. 8, pp. 156-178). London: Environmental Press.",
      expected: { isBook: false, isBookChapter: true, type: "book chapter" }
    },
    {
      citation: "Johnson, A. (2021). Deep learning fundamentals. In Neural Networks and AI (Chapter 3). San Francisco: Tech Books.",
      expected: { isBook: false, isBookChapter: true, type: "book chapter" }
    },
    {
      citation: "Chen, L. (2020). Data analysis techniques. In M. Taylor & R. Johnson (Eds.), Research Methods in Computer Science (Vol. 2, pp. 89-112). Boston: MIT Press.",
      expected: { isBook: false, isBookChapter: true, type: "book chapter" }
    },
    
    // 日本語書籍の章
    {
      citation: "田中太郎 (2020). 人工知能の倫理的課題. 佐藤花子編『AI社会論』第3章, 45-68頁, 東京: 学術出版社.",
      expected: { isBook: false, isBookChapter: true, type: "book chapter" }
    },
    {
      citation: "山田次郎 (2019). 環境教育の実践事例. 『持続可能な社会と教育』所収, 123-145頁, 京都: 教育書房.",
      expected: { isBook: false, isBookChapter: true, type: "book chapter" }
    },
    {
      citation: "鈴木一郎 (2021). デジタル教育の可能性と課題. 田中太郎・佐藤花子編『コロナ時代の教育』第5章, 89-110頁, 大阪: 未来出版.",
      expected: { isBook: false, isBookChapter: true, type: "book chapter" }
    }
  ];

  describe('Journal Articles Classification', () => {
    journalArticles.forEach((test, index) => {
      it(`should correctly classify journal article ${index + 1}: ${test.expected.type}`, () => {
        const result = parseLiterature(test.citation);
        
        expect(result.isBook).toBe(test.expected.isBook);
        expect(result.isBookChapter).toBe(test.expected.isBookChapter);
        
        console.log(`📰 ${index + 1}. Testing: ${test.citation}`);
        console.log(`   Expected: isBook=${test.expected.isBook}, isBookChapter=${test.expected.isBookChapter}`);
        console.log(`   Actual:   isBook=${result.isBook}, isBookChapter=${result.isBookChapter}`);
      });
    });
  });

  describe('Books Classification', () => {
    books.forEach((test, index) => {
      it(`should correctly classify book ${index + 1}: ${test.expected.type}`, () => {
        const result = parseLiterature(test.citation);
        
        expect(result.isBook).toBe(test.expected.isBook);
        expect(result.isBookChapter).toBe(test.expected.isBookChapter);
        
        console.log(`📚 ${index + 1}. Testing: ${test.citation}`);
        console.log(`   Expected: isBook=${test.expected.isBook}, isBookChapter=${test.expected.isBookChapter}`);
        console.log(`   Actual:   isBook=${result.isBook}, isBookChapter=${result.isBookChapter}`);
      });
    });
  });

  describe('Book Chapters Classification', () => {
    bookChapters.forEach((test, index) => {
      it(`should correctly classify book chapter ${index + 1}: ${test.expected.type}`, () => {
        const result = parseLiterature(test.citation);
        
        expect(result.isBook).toBe(test.expected.isBook);
        expect(result.isBookChapter).toBe(test.expected.isBookChapter);
        
        console.log(`📖 ${index + 1}. Testing: ${test.citation}`);
        console.log(`   Expected: isBook=${test.expected.isBook}, isBookChapter=${test.expected.isBookChapter}`);
        console.log(`   Actual:   isBook=${result.isBook}, isBookChapter=${result.isBookChapter}`);
      });
    });
  });

  describe('Classification Summary', () => {
    it('should provide overall test statistics', () => {
      const allTests = [...journalArticles, ...books, ...bookChapters];
      let passedTests = 0;
      
      allTests.forEach((test) => {
        const result = parseLiterature(test.citation);
        const passed = result.isBook === test.expected.isBook && 
                       result.isBookChapter === test.expected.isBookChapter;
        if (passed) passedTests++;
      });
      
      const totalTests = allTests.length;
      const successRate = ((passedTests / totalTests) * 100).toFixed(1);
      
      console.log('\n=====================================');
      console.log('🏁 Test Summary:');
      console.log(`   Total Tests: ${totalTests}`);
      console.log(`   Passed: ${passedTests}`);
      console.log(`   Failed: ${totalTests - passedTests}`);
      console.log(`   Success Rate: ${successRate}%`);
      console.log('=====================================');
      
      // Expect at least 80% success rate
      expect(passedTests / totalTests).toBeGreaterThanOrEqual(0.8);
    });
  });
});