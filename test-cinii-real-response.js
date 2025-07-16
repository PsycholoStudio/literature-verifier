/**
 * 実際のCiNiiレスポンスの形式でテスト
 * channel要素を含む完全なRDF構造
 */

const { parseString } = require('xml2js');

// 実際のCiNiiレスポンスに近い構造
const realCiNiiXML = `<?xml version="1.0" encoding="utf-8" ?>
<rdf:RDF xmlns="http://purl.org/rss/1.0/" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:prism="http://prismstandard.org/namespaces/basic/2.0/" xmlns:ndl="http://ndl.go.jp/dcndl/terms" xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/" xmlns:cir="https://cir.nii.ac.jp/schema/1.0/" xml:lang="ja">
<channel rdf:about="https://cir.nii.ac.jp/opensearch/articles?q=test">
<title>CiNii Research articles - test</title>
<description>CiNii Research articles - test</description>
<link>https://cir.nii.ac.jp/opensearch/articles?q=test</link>
<dc:date>2025-07-15T21:11:07.131+09:00</dc:date>
<opensearch:totalResults>100</opensearch:totalResults>
<opensearch:startIndex>1</opensearch:startIndex>
<opensearch:itemsPerPage>20</opensearch:itemsPerPage>
<items>
<rdf:Seq>
<rdf:li rdf:resource="https://cir.nii.ac.jp/crid/1523388080641239040"/>
<rdf:li rdf:resource="https://cir.nii.ac.jp/crid/1523951030870267264"/>
</rdf:Seq>
</items>
</channel>
<item rdf:about="https://cir.nii.ac.jp/crid/1523388080641239040">
<title>テスト論文1</title>
<link>https://cir.nii.ac.jp/crid/1523388080641239040</link>
<rdfs:seeAlso rdf:resource="https://cir.nii.ac.jp/crid/1523388080641239040.rdf"/>
<dc:type>Article</dc:type>
<dc:creator>著者 太郎</dc:creator>
<dc:publisher>東京 : テスト出版社</dc:publisher>
<prism:publicationName>テスト掲載誌</prism:publicationName>
<prism:volume>84</prism:volume>
<prism:number>4</prism:number>
<prism:startingPage>69</prism:startingPage>
<prism:endingPage>73</prism:endingPage>
<prism:publicationDate>2017-04</prism:publicationDate>
<dc:identifier rdf:datatype="cir:NDL_BIB_ID">028027867</dc:identifier>
<dc:identifier rdf:datatype="cir:URI">https://ndlsearch.ndl.go.jp/books/R000000004-I028027867</dc:identifier>
<dc:identifier rdf:datatype="cir:NAID">40021123625</dc:identifier>
<dc:source rdf:resource="http://id.ndl.go.jp/bib/028027867" />
<dc:source rdf:resource="https://ndlsearch.ndl.go.jp/books/R000000004-I028027867" />
</item>
<item rdf:about="https://cir.nii.ac.jp/crid/1523951030870267264">
<title>テスト論文2</title>
<link>https://cir.nii.ac.jp/crid/1523951030870267264</link>
<rdfs:seeAlso rdf:resource="https://cir.nii.ac.jp/crid/1523951030870267264.rdf"/>
<dc:type>Article</dc:type>
<dc:creator>著者 花子</dc:creator>
<dc:publisher>東京 : テスト出版社</dc:publisher>
<prism:publicationName>テスト掲載誌</prism:publicationName>
<prism:volume>87</prism:volume>
<prism:number>3</prism:number>
<prism:startingPage>60</prism:startingPage>
<prism:endingPage>64</prism:endingPage>
<prism:publicationDate>2020-03</prism:publicationDate>
<dc:identifier rdf:datatype="cir:NDL_BIB_ID">030256047</dc:identifier>
<dc:identifier rdf:datatype="cir:URI">https://ndlsearch.ndl.go.jp/books/R000000004-I030256047</dc:identifier>
<dc:identifier rdf:datatype="cir:NAID">40022158583</dc:identifier>
<dc:source rdf:resource="http://id.ndl.go.jp/bib/030256047" />
<dc:source rdf:resource="https://ndlsearch.ndl.go.jp/books/R000000004-I030256047" />
</item>
</rdf:RDF>`;

// safeGetText関数
function safeGetText(obj, path) {
  if (!obj) return '';
  
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return '';
    }
  }
  
  if (Array.isArray(current)) {
    return current.length > 0 ? String(current[0]).trim() : '';
  }
  
  return current ? String(current).trim() : '';
}

// 実際のCiNiiハンドラーのロジックを再現
function testRealCiNiiParsing() {
  console.log('=== 実際のCiNiiレスポンス形式テスト ===');
  
  // 設定は実際のcinii-logic.jsと同じ
  const parseOptions = {
    explicitArray: true,
    ignoreAttrs: false,
    mergeAttrs: false,
    tagNameProcessors: [],
    attrNameProcessors: [],
    valueProcessors: [],
    attrValueProcessors: []
  };
  
  parseString(realCiNiiXML, parseOptions, (err, result) => {
    if (err) {
      console.error('❌ XMLパースエラー:', err);
      return;
    }
    
    console.log('✅ XMLパース成功');
    
    // 構造を確認
    console.log('\n=== パース結果の構造 ===');
    console.log('root keys:', Object.keys(result));
    
    if (result['rdf:RDF']) {
      console.log('rdf:RDF keys:', Object.keys(result['rdf:RDF']));
      
      // channelとitemを確認
      const rdfData = result['rdf:RDF'];
      console.log('Has channel:', !!rdfData.channel);
      console.log('Has item:', !!rdfData.item);
      
      if (rdfData.item) {
        const items = Array.isArray(rdfData.item) ? rdfData.item : [rdfData.item];
        console.log('Items count:', items.length);
        
        console.log('\n=== アイテム解析 ===');
        items.forEach((item, index) => {
          console.log(`\n--- アイテム ${index + 1} ---`);
          
          // 基本情報
          const title = safeGetText(item, 'title');
          const creator = safeGetText(item, 'dc:creator');
          const publicationName = safeGetText(item, 'prism:publicationName');
          const dcType = safeGetText(item, 'dc:type');
          
          // 巻号ページ情報
          const volume = safeGetText(item, 'prism:volume');
          const issue = safeGetText(item, 'prism:number');
          const startPage = safeGetText(item, 'prism:startingPage');
          const endPage = safeGetText(item, 'prism:endingPage');
          
          // ページ範囲構築
          let pages = '';
          if (startPage && endPage && startPage !== endPage && startPage !== '-') {
            pages = `${startPage}-${endPage}`;
          } else if (startPage && startPage !== '-') {
            pages = startPage;
          }
          
          console.log(`タイトル: "${title}"`);
          console.log(`著者: "${creator}"`);
          console.log(`掲載誌名: "${publicationName}"`);
          console.log(`記事タイプ: "${dcType}"`);
          console.log(`巻: "${volume}"`);
          console.log(`号: "${issue}"`);
          console.log(`ページ: "${pages}"`);
          
          // 生データ確認
          console.log('\n  [生データ]');
          console.log(`  prism:volume: ${JSON.stringify(item['prism:volume'])}`);
          console.log(`  prism:number: ${JSON.stringify(item['prism:number'])}`);
          console.log(`  prism:startingPage: ${JSON.stringify(item['prism:startingPage'])}`);
          console.log(`  prism:endingPage: ${JSON.stringify(item['prism:endingPage'])}`);
          
          // 最終結果オブジェクト
          const resultItem = {
            title,
            authors: creator ? [creator] : [],
            year: '2017',
            doi: '',
            journal: publicationName,
            publisher: '',
            volume,
            issue,
            pages,
            url: item.link?.[0] || '',
            isbn: '',
            source: 'CiNii',
            isBook: false,
            isBookChapter: false,
            bookTitle: '',
            editors: []
          };
          
          console.log('\n  [最終結果オブジェクト]');
          console.log(`  volume: "${resultItem.volume}"`);
          console.log(`  issue: "${resultItem.issue}"`);
          console.log(`  pages: "${resultItem.pages}"`);
          console.log(`  journal: "${resultItem.journal}"`);
          
          // 検証
          const isValid = resultItem.volume && resultItem.issue && resultItem.pages;
          console.log(`\n  [検証結果]: ${isValid ? '✅ 成功' : '❌ 失敗'}`);
        });
      }
    }
  });
}

// 異なるパース設定でのテスト
function testDifferentParseOptions() {
  console.log('\n\n=== 異なるパース設定でのテスト ===');
  
  const options = [
    {
      name: 'explicitArray: false',
      config: { explicitArray: false }
    },
    {
      name: 'explicitArray: true + ignoreAttrs: true',
      config: { explicitArray: true, ignoreAttrs: true }
    },
    {
      name: 'explicitArray: true + mergeAttrs: true',
      config: { explicitArray: true, mergeAttrs: true }
    }
  ];
  
  options.forEach(option => {
    console.log(`\n--- ${option.name} ---`);
    
    parseString(realCiNiiXML, option.config, (err, result) => {
      if (err) {
        console.error('❌ エラー:', err.message);
        return;
      }
      
      try {
        const items = result['rdf:RDF'].item;
        const firstItem = Array.isArray(items) ? items[0] : items;
        
        console.log('prism:volume:', firstItem['prism:volume']);
        console.log('prism:number:', firstItem['prism:number']);
        
        const volume = safeGetText(firstItem, 'prism:volume');
        const issue = safeGetText(firstItem, 'prism:number');
        
        console.log(`抽出結果 - volume: "${volume}", issue: "${issue}"`);
      } catch (error) {
        console.error('❌ データ処理エラー:', error.message);
      }
    });
  });
}

// テスト実行
testRealCiNiiParsing();
testDifferentParseOptions();