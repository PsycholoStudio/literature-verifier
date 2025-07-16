// Test script to debug the citation classification issue

const citation = "坂部創一, 山崎秀夫 (2019). インターネット利用が新型うつ傾向へ及ぼす悪影響と予防策の縦断研究. キャリア教育研究, 33, 139-146.";

console.log("Testing citation:", citation);
console.log();

// Test the book chapter patterns that might be causing the issue
const bookChapterPatterns = [
    // Pattern 11: "Title, pages." (Inなし、ページのみ) - 巻号情報なしの確認必要
    /^[^.]+[,，]\s*\d+[-–—]\d+\.\s*$/i,
    
    // Pattern 12: "Title, pages" (Inなし、ページのみ、ピリオドなし) - 巻号情報なしの確認必要
    /^[^.]+[,，]\s*\d+[-–—]\d+\s*$/i,
    
    // Pattern 13: "Title. Subtitle, pages." (途中にピリオドあり、Foucaultパターン)
    /^.+[,，]\s*\d+[-–—]\d+\.\s*$/i,
    
    // Pattern 14: "Title. Subtitle, pages" (途中にピリオドあり、ピリオドなし)
    /^.+[,，]\s*\d+[-–—]\d+\s*$/i,
];

console.log("=== Book Chapter Pattern Tests ===");
bookChapterPatterns.forEach((pattern, index) => {
    const match = pattern.test(citation);
    console.log(`Pattern ${index + 11}: ${pattern}`);
    console.log(`  Match: ${match ? 'YES' : 'NO'}`);
    if (match) {
        console.log(`  ⚠️ This pattern is incorrectly matching the journal article!`);
    }
});

console.log();

// Test the current volume/issue detection used in the code
const currentVolumeIssuePattern = /\b\d+\s*\(\s*\d+\s*\)/;
const hasVolumeIssue = currentVolumeIssuePattern.test(citation);
console.log("=== Current Volume/Issue Detection ===");
console.log(`Pattern: ${currentVolumeIssuePattern}`);
console.log(`Citation has volume(issue): ${hasVolumeIssue}`);
console.log("❌ This is the problem! The pattern only looks for 'volume(issue)' format");
console.log("   but this citation has 'journal, volume, pages' format");

console.log();

// Test improved volume/issue patterns that should detect this case
const improvedVolumePatterns = [
    /\b\d+\s*\(\s*\d+\s*\)/, // Original: volume(issue)
    /[,，]\s*\d+\s*[,，]\s*\d+[-–—]\d+/, // New: , volume, pages
    /(?:第\s*)?\d+\s*巻\s*(?:第\s*)?\d+\s*号/, // Japanese: 巻号
    /vol\.?\s*\d+/i, // vol. number
    /volume\s*\d+/i, // volume number
];

console.log("=== Improved Volume/Issue Detection ===");
improvedVolumePatterns.forEach((pattern, index) => {
    const match = pattern.test(citation);
    console.log(`Pattern ${index + 1}: ${pattern}`);
    console.log(`  Match: ${match ? 'YES' : 'NO'}`);
    if (match) {
        console.log(`  ✅ This pattern correctly detects journal volume info!`);
    }
});

console.log();

// Test journal article patterns from the detectBook function
const journalArticlePatterns = [
    // Pattern that should match "33, 139-146"
    /(\d+)[，,]\s*(\d+[-–]\d+)/,
    // More comprehensive pattern
    /[,，]\s*\d+\s*[,，]\s*\d+[-–—]\d+/,
    // Japanese volume/issue patterns
    /(?:第\s*)?\d+\s*巻\s*(?:第\s*)?\d+\s*号/,
    /\d+\s*巻\s*[,，、､]\s*\d+[-–—]\d+/,
    /\d+\s*号\s*[,，、､]\s*\d+[-–—]\d+/,
];

console.log("=== Journal Article Pattern Tests ===");
journalArticlePatterns.forEach((pattern, index) => {
    const match = pattern.test(citation);
    console.log(`Pattern ${index + 1}: ${pattern}`);
    console.log(`  Match: ${match ? 'YES' : 'NO'}`);
    if (match) {
        const matchResult = citation.match(pattern);
        console.log(`  ✅ Matched: "${matchResult[0]}"`);
    }
});