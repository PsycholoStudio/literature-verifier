/**
 * XML to JSON変換の詳細テスト
 * 様々なエッジケースを検証
 */

const { parseString } = require('xml2js');

// テストケース1: 正常なケース
const normalXML = `<?xml version="1.0" encoding="utf-8" ?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:prism="http://prismstandard.org/namespaces/basic/2.0/">
<item rdf:about="https://example.com/1">
<title>正常なタイトル</title>
<dc:creator>著者名</dc:creator>
<prism:volume>84</prism:volume>
<prism:number>4</prism:number>
<prism:startingPage>69</prism:startingPage>
<prism:endingPage>73</prism:endingPage>
</item>
</rdf:RDF>`;

// テストケース2: 空のフィールド
const emptyFieldsXML = `<?xml version="1.0" encoding="utf-8" ?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:prism="http://prismstandard.org/namespaces/basic/2.0/">
<item rdf:about="https://example.com/2">
<title>空フィールドのテスト</title>
<dc:creator>著者名</dc:creator>
<prism:volume></prism:volume>
<prism:number></prism:number>
<prism:startingPage></prism:startingPage>
<prism:endingPage></prism:endingPage>
</item>
</rdf:RDF>`;

// テストケース3: フィールドが存在しない
const missingFieldsXML = `<?xml version="1.0" encoding="utf-8" ?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:prism="http://prismstandard.org/namespaces/basic/2.0/">
<item rdf:about="https://example.com/3">
<title>フィールド欠損テスト</title>
<dc:creator>著者名</dc:creator>
</item>
</rdf:RDF>`;

// テストケース4: 特殊文字が含まれる
const specialCharsXML = `<?xml version="1.0" encoding="utf-8" ?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:prism="http://prismstandard.org/namespaces/basic/2.0/">
<item rdf:about="https://example.com/4">
<title>特殊文字テスト &amp; &lt;タグ&gt;</title>
<dc:creator>著者名 &quot;引用&quot;</dc:creator>
<prism:volume>84</prism:volume>
<prism:number>4</prism:number>
<prism:startingPage>69</prism:startingPage>
<prism:endingPage>73</prism:endingPage>
</item>
</rdf:RDF>`;

// テストケース5: 複数のアイテム
const multipleItemsXML = `<?xml version="1.0" encoding="utf-8" ?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:prism="http://prismstandard.org/namespaces/basic/2.0/">
<item rdf:about="https://example.com/5a">
<title>複数アイテム1</title>
<dc:creator>著者1</dc:creator>
<prism:volume>84</prism:volume>
<prism:number>4</prism:number>
<prism:startingPage>69</prism:startingPage>
<prism:endingPage>73</prism:endingPage>
</item>
<item rdf:about="https://example.com/5b">
<title>複数アイテム2</title>
<dc:creator>著者2</dc:creator>
<prism:volume>85</prism:volume>
<prism:number>5</prism:number>
<prism:startingPage>100</prism:startingPage>
<prism:endingPage>105</prism:endingPage>
</item>
</rdf:RDF>`;

// safeGetText関数を再現
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

// テスト実行関数
function runTest(testName, xmlContent, expectedVolume, expectedIssue, expectedPages) {
  console.log(`\n=== ${testName} ===`);
  
  parseString(xmlContent, {
    explicitArray: true,
    ignoreAttrs: false,
    mergeAttrs: false,
    tagNameProcessors: [],
    attrNameProcessors: [],
    valueProcessors: [],
    attrValueProcessors: []
  }, (err, result) => {
    if (err) {
      console.error('❌ XMLパースエラー:', err.message);
      return;
    }
    
    try {
      const items = result['rdf:RDF'].item;
      const itemsArray = Array.isArray(items) ? items : [items];
      
      console.log(`アイテム数: ${itemsArray.length}`);
      
      itemsArray.forEach((item, index) => {
        console.log(`\n--- アイテム ${index + 1} ---`);
        
        const title = safeGetText(item, 'title');
        const creator = safeGetText(item, 'dc:creator');
        const volume = safeGetText(item, 'prism:volume');
        const issue = safeGetText(item, 'prism:number');
        const startPage = safeGetText(item, 'prism:startingPage');
        const endPage = safeGetText(item, 'prism:endingPage');
        
        // ページ範囲を構築
        let pages = '';
        if (startPage && endPage && startPage !== endPage && startPage !== '-') {
          pages = `${startPage}-${endPage}`;
        } else if (startPage && startPage !== '-') {
          pages = startPage;
        }
        
        console.log(`タイトル: "${title}"`);
        console.log(`著者: "${creator}"`);
        console.log(`巻: "${volume}"`);
        console.log(`号: "${issue}"`);
        console.log(`ページ: "${pages}"`);
        
        // 生データの確認
        console.log('\n--- 生データ ---');
        console.log('prism:volume:', item['prism:volume']);
        console.log('prism:number:', item['prism:number']);
        console.log('prism:startingPage:', item['prism:startingPage']);
        console.log('prism:endingPage:', item['prism:endingPage']);
        
        // 期待値との比較（最初のアイテムのみ）
        if (index === 0) {
          console.log('\n--- 期待値との比較 ---');
          console.log(`volume: ${volume === expectedVolume ? '✅' : '❌'} (期待: "${expectedVolume}", 実際: "${volume}")`);
          console.log(`issue: ${issue === expectedIssue ? '✅' : '❌'} (期待: "${expectedIssue}", 実際: "${issue}")`);
          console.log(`pages: ${pages === expectedPages ? '✅' : '❌'} (期待: "${expectedPages}", 実際: "${pages}")`);
        }
      });
      
    } catch (error) {
      console.error('❌ データ処理エラー:', error.message);
    }
  });
}

// 破損したXMLのテスト
function testCorruptedXML() {
  console.log('\n=== 破損XMLテスト ===');
  
  const corruptedXML = `<?xml version="1.0" encoding="utf-8" ?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:prism="http://prismstandard.org/namespaces/basic/2.0/">
<item rdf:about="https://example.com/corrupt">
<title>破損XMLテスト</title>
<dc:creator>著者名</dc:creator>
<prism:volume>84</prism:volume>
<prism:number>4
<prism:startingPage>69</prism:startingPage>
<prism:endingPage>73</prism:endingPage>
</item>
</rdf:RDF>`;

  parseString(corruptedXML, { explicitArray: true }, (err, result) => {
    if (err) {
      console.log('✅ 期待通り破損XMLでエラー:', err.message);
    } else {
      console.log('❌ 破損XMLでもパース成功（予期しない動作）');
    }
  });
}

// 全テストの実行
async function runAllTests() {
  console.log('=== XML to JSON変換テスト開始 ===');
  
  runTest('正常なケース', normalXML, '84', '4', '69-73');
  runTest('空のフィールド', emptyFieldsXML, '', '', '');
  runTest('フィールド欠損', missingFieldsXML, '', '', '');
  runTest('特殊文字', specialCharsXML, '84', '4', '69-73');
  runTest('複数アイテム', multipleItemsXML, '84', '4', '69-73');
  
  testCorruptedXML();
  
  console.log('\n=== 全テスト完了 ===');
}

// テスト実行
runAllTests();