/**
 * 実際のCiNii APIエンドポイントを使ったテスト
 * 実際のレスポンスでXML to JSON変換を検証
 */

const { parseString } = require('xml2js');

// Node.jsの標準fetchを使用（Node.js 18以降）
const fetch = globalThis.fetch || require('node-fetch');

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

// 実際のCiNii APIテスト
async function testRealCiNiiAPI() {
  console.log('=== 実際のCiNii APIテスト ===');
  
  const url = 'https://cir.nii.ac.jp/opensearch/articles?q=%E3%83%9E%E3%82%A4%E3%83%B3%E3%83%89%E3%83%95%E3%83%AB%E3%83%8D%E3%82%B9&count=5&start=1&lang=ja&format=rss';
  
  try {
    console.log('🌐 CiNii API リクエスト:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/rss+xml, application/xml, text/xml',
        'User-Agent': 'LiteratureVerifier/1.0'
      }
    });
    
    if (!response.ok) {
      console.error(`❌ API エラー: ${response.status} ${response.statusText}`);
      return;
    }
    
    const xmlText = await response.text();
    console.log(`✅ XMLレスポンス取得: ${xmlText.length}バイト`);
    
    // XMLの最初の1000文字を表示
    console.log('\n=== XMLサンプル ===');
    console.log(xmlText.substring(0, 1000));
    console.log('...');
    
    // XMLをパース
    console.log('\n=== XMLパース開始 ===');
    
    const parseOptions = {
      explicitArray: true,
      ignoreAttrs: false,
      mergeAttrs: false,
      tagNameProcessors: [],
      attrNameProcessors: [],
      valueProcessors: [],
      attrValueProcessors: []
    };
    
    parseString(xmlText, parseOptions, (err, result) => {
      if (err) {
        console.error('❌ XMLパースエラー:', err);
        return;
      }
      
      console.log('✅ XMLパース完了');
      
      // 構造確認
      console.log('\n=== パース結果の構造 ===');
      console.log('root keys:', Object.keys(result));
      
      if (result['rdf:RDF']) {
        const rdfData = result['rdf:RDF'];
        console.log('rdf:RDF keys:', Object.keys(rdfData));
        
        if (rdfData.item) {
          const items = Array.isArray(rdfData.item) ? rdfData.item : [rdfData.item];
          console.log(`Items count: ${items.length}`);
          
          // 最初の3つのアイテムを詳細に分析
          const maxItems = Math.min(3, items.length);
          console.log(`\n=== 最初の${maxItems}アイテムの詳細分析 ===`);
          
          for (let i = 0; i < maxItems; i++) {
            const item = items[i];
            console.log(`\n--- アイテム ${i + 1} ---`);
            
            // 基本情報
            const title = safeGetText(item, 'title');
            const creator = safeGetText(item, 'dc:creator');
            const publicationName = safeGetText(item, 'prism:publicationName');
            const dcType = safeGetText(item, 'dc:type');
            const publicationDate = safeGetText(item, 'prism:publicationDate');
            
            console.log(`タイトル: "${title}"`);
            console.log(`著者: "${creator}"`);
            console.log(`掲載誌名: "${publicationName}"`);
            console.log(`記事タイプ: "${dcType}"`);
            console.log(`出版日: "${publicationDate}"`);
            
            // 巻号ページ情報の詳細分析
            console.log('\n  [巻号ページ情報]');
            console.log(`  prism:volume key exists: ${'prism:volume' in item}`);
            console.log(`  prism:number key exists: ${'prism:number' in item}`);
            console.log(`  prism:startingPage key exists: ${'prism:startingPage' in item}`);
            console.log(`  prism:endingPage key exists: ${'prism:endingPage' in item}`);
            
            console.log(`  prism:volume value: ${JSON.stringify(item['prism:volume'])}`);
            console.log(`  prism:number value: ${JSON.stringify(item['prism:number'])}`);
            console.log(`  prism:startingPage value: ${JSON.stringify(item['prism:startingPage'])}`);
            console.log(`  prism:endingPage value: ${JSON.stringify(item['prism:endingPage'])}`);
            
            // safeGetTextで抽出
            const volume = safeGetText(item, 'prism:volume');
            const issue = safeGetText(item, 'prism:number');
            const startPage = safeGetText(item, 'prism:startingPage');
            const endPage = safeGetText(item, 'prism:endingPage');
            
            console.log(`  抽出結果 - volume: "${volume}"`);
            console.log(`  抽出結果 - issue: "${issue}"`);
            console.log(`  抽出結果 - startPage: "${startPage}"`);
            console.log(`  抽出結果 - endPage: "${endPage}"`);
            
            // ページ範囲構築
            let pages = '';
            if (startPage && endPage && startPage !== endPage && startPage !== '-') {
              pages = `${startPage}-${endPage}`;
            } else if (startPage && startPage !== '-') {
              pages = startPage;
            }
            
            console.log(`  構築されたページ: "${pages}"`);
            
            // 最終結果
            const hasVolumeInfo = volume || issue || pages;
            console.log(`  巻号ページ情報: ${hasVolumeInfo ? '✅ あり' : '❌ なし'}`);
            
            // 結果オブジェクト
            const resultItem = {
              title,
              authors: creator ? [creator] : [],
              year: publicationDate.match(/\\d{4}/) ? publicationDate.match(/\\d{4}/)[0] : '',
              doi: '',
              journal: publicationName,
              publisher: '',
              volume,
              issue,
              pages,
              url: item.link?.[0] || '',
              source: 'CiNii'
            };
            
            console.log(`\n  [最終結果オブジェクト]`);
            console.log(`  title: "${resultItem.title.substring(0, 30)}..."`);
            console.log(`  journal: "${resultItem.journal}"`);
            console.log(`  volume: "${resultItem.volume}"`);
            console.log(`  issue: "${resultItem.issue}"`);
            console.log(`  pages: "${resultItem.pages}"`);
            console.log(`  year: "${resultItem.year}"`);
            
            // 全てのキーを表示（デバッグ用）
            console.log(`\n  [利用可能なキー]`);
            const prismKeys = Object.keys(item).filter(key => key.startsWith('prism:'));
            console.log(`  prism:* keys: ${prismKeys.join(', ')}`);
          }
          
          // 統計情報
          console.log(`\n=== 統計情報 ===`);
          let itemsWithVolume = 0;
          let itemsWithIssue = 0;
          let itemsWithPages = 0;
          
          items.forEach(item => {
            const volume = safeGetText(item, 'prism:volume');
            const issue = safeGetText(item, 'prism:number');
            const startPage = safeGetText(item, 'prism:startingPage');
            const endPage = safeGetText(item, 'prism:endingPage');
            
            if (volume) itemsWithVolume++;
            if (issue) itemsWithIssue++;
            if (startPage || endPage) itemsWithPages++;
          });
          
          console.log(`総アイテム数: ${items.length}`);
          console.log(`巻情報ありアイテム: ${itemsWithVolume} (${Math.round(itemsWithVolume/items.length*100)}%)`);
          console.log(`号情報ありアイテム: ${itemsWithIssue} (${Math.round(itemsWithIssue/items.length*100)}%)`);
          console.log(`ページ情報ありアイテム: ${itemsWithPages} (${Math.round(itemsWithPages/items.length*100)}%)`);
          
        } else {
          console.log('❌ itemが見つかりません');
        }
      } else {
        console.log('❌ rdf:RDFが見つかりません');
      }
    });
    
  } catch (error) {
    console.error('❌ APIテストエラー:', error);
  }
}

// テスト実行
testRealCiNiiAPI();