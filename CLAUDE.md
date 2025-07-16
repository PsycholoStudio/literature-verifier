# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm start` - Run the development server on http://localhost:3000
- `npm build` - Build for production deployment
- `npm test` - Run Jest tests in watch mode

## Architecture Overview

This is a React-based academic literature verification tool that helps researchers verify citations by searching multiple academic databases.

### Core Components

1. **LiteratureVerifier.js** - Main application logic that handles:
   - Citation parsing (Japanese/English detection and extraction)
   - Multi-database search orchestration
   - Result comparison and similarity matching
   - UI state management

2. **API Proxy Functions** (in `/api` directory):
   - Each external API has its own Vercel serverless function to handle CORS
   - Functions include timeout handling (10s) and proper error responses
   - All return consistent JSON structure with error handling

### Key Patterns

1. **Citation Parsing**: The parser uses regex patterns to extract citation components, with separate logic for Japanese vs English citations. When modifying parsing logic, ensure both language patterns are updated.

2. **API Integration**: All external API calls go through Vercel proxy functions. Never call external APIs directly from the frontend due to CORS restrictions.

3. **Error Handling**: Each API function implements try-catch with specific error messages. Frontend gracefully handles API failures by continuing with other searches.

4. **Similarity Matching**: Uses normalized string comparison for fuzzy matching of titles and authors. Critical for handling minor variations in citation formatting.

### Testing Approach

The project uses Jest with React Testing Library. When adding new features:
- Test citation parsing with various formats
- Mock API responses for search functionality
- Verify error states are handled gracefully

### Deployment

This app is designed for Vercel deployment. The `/api` directory contains serverless functions that are automatically deployed as API endpoints. No environment variables are needed as all API endpoints are public.

## Work History

For ongoing development notes and session history, see: [WORK_HISTORY.md](./WORK_HISTORY.md)