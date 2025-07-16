/**
 * CiNiiのXMLパースのテスト
 * 巻号ページ情報が正しく抽出されるかを検証
 */

const { parseString } = require('xml2js');

// 実際のCiNiiレスポンスの一部（巻号ページ情報を含む）
const testXML = `<?xml version="1.0" encoding="utf-8" ?>
<rdf:RDF xmlns="http://purl.org/rss/1.0/" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:prism="http://prismstandard.org/namespaces/basic/2.0/" xmlns:ndl="http://ndl.go.jp/dcndl/terms" xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/" xmlns:cir="https://cir.nii.ac.jp/schema/1.0/" xml:lang="ja">
<item rdf:about="https://cir.nii.ac.jp/crid/1523388080641239040">
<title>マインドフルネスの可能性</title>
<link>https://cir.nii.ac.jp/crid/1523388080641239040</link>
<rdfs:seeAlso rdf:resource="https://cir.nii.ac.jp/crid/1523388080641239040.rdf"/>
<dc:type>Article</dc:type>
<dc:creator>保坂 隆</dc:creator>
<dc:publisher>東京 : 大法輪閣</dc:publisher>
<prism:publicationName>大法輪</prism:publicationName>
<prism:volume>84</prism:volume>
<prism:number>4</prism:number>
<prism:startingPage>69</prism:startingPage>
<prism:endingPage>73</prism:endingPage>
<prism:publicationDate>2017-04</prism:publicationDate>
<dc:identifier rdf:datatype="cir:NDL_BIB_ID">028027867</dc:identifier>
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

async function testCiNiiParsing() {
  console.log('=== CiNii XMLパーステスト開始 ===');
  
  // XML2JSでパース
  parseString(testXML, {
    explicitArray: true,
    ignoreAttrs: false,
    mergeAttrs: false,
    tagNameProcessors: [],
    attrNameProcessors: [],
    valueProcessors: [],
    attrValueProcessors: []
  }, (err, result) => {
    if (err) {
      console.error('❌ XMLパースエラー:', err);
      return;
    }
    
    console.log('✅ XMLパース完了');
    
    // パースされた構造を確認
    console.log('\n=== パースされた構造 ===');
    console.log('root keys:', Object.keys(result));
    
    if (result['rdf:RDF']) {
      console.log('rdf:RDF keys:', Object.keys(result['rdf:RDF']));
      
      if (result['rdf:RDF'].item) {
        const items = Array.isArray(result['rdf:RDF'].item) ? result['rdf:RDF'].item : [result['rdf:RDF'].item];
        console.log('items count:', items.length);
        
        const item = items[0];
        console.log('\n=== 最初のアイテム ===');
        console.log('item keys:', Object.keys(item));
        
        // 巻号ページ情報の抽出をテスト
        console.log('\n=== 巻号ページ情報の抽出テスト ===');
        
        const volume = safeGetText(item, 'prism:volume');
        const issue = safeGetText(item, 'prism:number');
        const startPage = safeGetText(item, 'prism:startingPage');
        const endPage = safeGetText(item, 'prism:endingPage');
        
        console.log('volume:', volume);
        console.log('issue:', issue);
        console.log('startPage:', startPage);
        console.log('endPage:', endPage);
        
        // 生データの確認
        console.log('\n=== 生データの確認 ===');
        console.log('item[\'prism:volume\']:', item['prism:volume']);
        console.log('item[\'prism:number\']:', item['prism:number']);
        console.log('item[\'prism:startingPage\']:', item['prism:startingPage']);
        console.log('item[\'prism:endingPage\']:', item['prism:endingPage']);
        
        // 期待される結果と比較
        console.log('\n=== 結果検証 ===');
        console.log('volume:', volume === '84' ? '✅ 正常' : '❌ 異常');
        console.log('issue:', issue === '4' ? '✅ 正常' : '❌ 異常');
        console.log('startPage:', startPage === '69' ? '✅ 正常' : '❌ 異常');
        console.log('endPage:', endPage === '73' ? '✅ 正常' : '❌ 異常');
        
        // その他の情報も確認
        console.log('\n=== その他の情報 ===');
        const title = safeGetText(item, 'title');
        const publicationName = safeGetText(item, 'prism:publicationName');
        const creator = safeGetText(item, 'dc:creator');
        
        console.log('title:', title);
        console.log('publicationName:', publicationName);
        console.log('creator:', creator);
      }
    }
  });
}

// テスト実行
testCiNiiParsing();