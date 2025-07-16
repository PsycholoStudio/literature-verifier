# Work History

## Session 2025-07-16

### Current Status
- Academic literature verification tool based on React
- Multiple database search functionality implemented
- API proxy functions in `/api` directory for CORS handling
- Recent commits show work on citation formatting and API improvements

### Recent Git Activity
- Modified files: .gitignore, API files (cinii.js, crossref.js, google-books.js, ndl-search.js, semantic-scholar.js)
- Modified components: CitationInput.js, citationFormatter.js
- New component: LineNumberedTextarea.js
- Recent commits focus on book chapter citation formatting and NDL author name processing

### Current Phase
- **PRODUCTION ENVIRONMENT TESTING** - The application is now in production environment verification phase
- Focus on production-ready stability and performance

### Latest Work Session - Subtitle Handling Improvements
**Issue**: Input text titles didn't consider subtitles when comparing with candidate literature titles, causing poor matching and incorrect color-coding.

**Solution Implemented**:
1. **Enhanced Citation Parser** (`/src/utils/citationParser.js`):
   - Added `titleWithSubtitle` field to preserve complete titles before subtitle removal
   - Maintains backward compatibility with existing `title` field

2. **Updated API Response Handlers** (all `/api/*.js` files):
   - Added `subtitle` field to all search results (CrossRef, Google Books, CiNii, NDL, Semantic Scholar)
   - Enables flexible title combination during comparison and display

3. **Improved Comparison Logic** (`/src/utils/comparisonUtils.js`):
   - Updated similarity evaluation to use `titleWithSubtitle` when available
   - Maintains existing subtitle bonus logic for better matching accuracy

4. **Fixed Color-Coding Display** (`/src/utils/citationFormatter.js`):
   - Updated all citation formatting functions (APA, MLA, Chicago) to use complete titles
   - Character-level color comparison now properly handles input titles with subtitles
   - Candidate subtitles show in green instead of red when input lacks subtitles

**Files Modified**:
- `/src/utils/citationParser.js` - Added titleWithSubtitle field
- `/src/utils/comparisonUtils.js` - Updated to use titleWithSubtitle in comparisons
- `/src/utils/citationFormatter.js` - Fixed color-coding in all citation styles
- `/api/crossref.js` - Added subtitle field support
- `/api/google-books.js` - Added subtitle field support
- `/api/cinii.js` - Added subtitle field (empty for CiNii)
- `/api/ndl-search.js` - Added subtitle field (empty for NDL)
- `/api/semantic-scholar.js` - Added subtitle field (empty for Semantic Scholar)

**Impact**: 
- Improved matching accuracy for literature with subtitles
- Better visual feedback with proper color-coding
- Enhanced user experience in production environment
- All evaluation systems now consistently use complete titles

### Next Steps
- Continue web app improvements as requested
- Address any pending issues or new feature requests
- Ensure all changes are production-ready

### Notes
- Project uses Vercel serverless functions for API calls
- Both Japanese and English citation parsing supported
- Focus on maintaining consistent error handling across APIs
- **IMPORTANT: All changes must be production-ready and thoroughly tested**

### Deployment Process
- **GitHub Push → Vercel Auto-Deploy**: Changes are automatically deployed to production when pushed to GitHub
- **CRITICAL**: Every commit directly affects production environment
- Must ensure all changes are fully tested before git push