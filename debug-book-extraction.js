// 書籍名抽出デバッグ
const testCitation = '喜多川進(2023). 「第 5 章自動車環境対策と雇用喪失ーー 1970 年代自動車排出ガス規制と 2020 年代 EV シフトの比較ーー」寺尾忠能(編著) 『後発の公共政策としての資源環境政策ーー理念・アイデアと社会的合意ーー』, 119-152.';

// 各パターンの抽出をテスト
console.log('=== 書籍名抽出デバッグ ===');
console.log('入力:', testCitation);

// パターン5のテスト
const jpPattern5 = /[「『][^」』]*[」』]\s*([々一-龯ぁ-んァ-ン\s]+)\([^)]*[編著][^)]*\)\s*([『「][^』」]+[』」])/;
const jpMatch5 = testCitation.match(jpPattern5);
console.log('\nパターン5マッチ:', jpMatch5);
if (jpMatch5) {
  console.log('  編者名:', jpMatch5[1].trim());
  console.log('  書籍名（生）:', jpMatch5[2]);
  
  // 現在の処理をシミュレート
  let bookTitle = jpMatch5[2].replace(/[『」「』]/g, '');
  console.log('  引用符除去後:', bookTitle);
  
  // 編者情報除去パターン（現在のロジック）
  let cleanBookTitle = bookTitle.replace(/^[々一-龯ぁ-んァ-ン\s]+\([^)]*[編著][^)]*\)\s*/, '');
  console.log('  編者除去後:', cleanBookTitle);
  
  // 引用符内容だけを抽出
  const quotedMatch = cleanBookTitle.match(/[『「]([^』」]+)[』」]/);
  if (quotedMatch) {
    cleanBookTitle = quotedMatch[1];
    console.log('  引用符内容抽出後:', cleanBookTitle);
  }
  
  // 追加の引用符を除去
  cleanBookTitle = cleanBookTitle.replace(/[『」「』]/g, '');
  console.log('  最終結果:', cleanBookTitle);
}