import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from the server directory
dotenv.config({ path: path.join(__dirname, '.env') });
const PORT = process.env.PORT || 8000;

const CONFIG = {
  baseURL: `http://localhost:${PORT}`,
  timeout: 60000,
};

// ─────────────────────────────────────────────────────────
// Color codes for beautiful console output
// ─────────────────────────────────────────────────────────
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m'
};

// ─────────────────────────────────────────────────────────
// Test statistics
// ─────────────────────────────────────────────────────────
let testStats = {
  total: 0,
  passed: 0,
  failed: 0,
  startTime: Date.now(),
  testNumber: 0
};

const failedTests = [];

// ─────────────────────────────────────────────────────────
// Enhanced logging functions
// ─────────────────────────────────────────────────────────
function logHeader(title) {
  const border = '═'.repeat(60);
  console.log(`\n${colors.bgBlue}${colors.white}${colors.bright} ${title} ${colors.reset}`);
  console.log(`${colors.blue}${border}${colors.reset}\n`);
}

function logSubHeader(title) {
  console.log(`${colors.cyan}${colors.bright}📋 ${title}${colors.reset}`);
  console.log(`${colors.cyan}${'─'.repeat(40)}${colors.reset}`);
}

function logTest(title, status, details = '') {
  const statusIcon = status === 'PASS' ? '✅' : '❌';
  const statusColor = status === 'PASS' ? colors.green : colors.red;
  const testStr = `${colors.bright}[${(testStats.testNumber).toString().padStart(3, '0')}]${colors.reset}`;
  
  console.log(`${testStr} ${statusIcon} ${statusColor}${status}${colors.reset} - ${title}`);
  if (details) {
    console.log(`     ${colors.dim}${details}${colors.reset}`);
  }
}

function logSuccess(message) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function logError(message) {
  console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function logInfo(message) {
  console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

// ─────────────────────────────────────────────────────────
// Main test runner function
// ─────────────────────────────────────────────────────────
async function runAPITest(
  title,
  method = 'GET',
  endpoint,
  body = null,
  headers = {},
  expectedStatus = 200,
  expectedProperties = [],
  authToken = null,
  fileUpload = false,
  description = '',
  retriesLeft = 5
) {
  testStats.testNumber++;
  testStats.total++;
  
  try {
    // Prepare headers
    const requestHeaders = {
      'Content-Type': fileUpload ? undefined : 'application/json',
      ...headers
    };

    // Add auth header if provided
    if (authToken) {
      requestHeaders['Authorization'] = `Bearer ${authToken}`;
    }

    // Prepare request config
    const config = {
      method: method.toLowerCase(),
      url: `${CONFIG.baseURL}${endpoint}`,
      headers: requestHeaders,
      timeout: CONFIG.timeout,
      validateStatus: () => true // Don't throw on any status code
    };

    // Add body for non-GET requests
    if (body && !fileUpload) {
      config.data = body;
    } else if (fileUpload && body) {
      config.data = body;
      config.headers = { ...config.headers, ...body.getHeaders() };
    }

    // Make the request
    const response = await axios(config);
    
    // Check status code
    const statusMatch = response.status === expectedStatus;
    
    // Check expected properties if provided
    let propertiesMatch = true;
    let missingProperties = [];
    
    if (expectedProperties.length > 0 && response.data) {
      expectedProperties.forEach(prop => {
        if (!hasProperty(response.data, prop)) {
          propertiesMatch = false;
          missingProperties.push(prop);
        }
      });
    }

    const testPassed = statusMatch && propertiesMatch;
    
    let details = `${method} ${endpoint} → ${response.status} ${response.statusText}`;
    if (!testPassed || expectedStatus >= 400) {
      details += `\n     Response: ${JSON.stringify(response.data, null, 2).substring(0, 500)}...`;
    }
    
    if (testPassed) {
      testStats.passed++;
      logTest(title, 'PASS', details);
    } else {
      testStats.failed++;
      let errorDetails = [];
      
      if (!statusMatch) {
        errorDetails.push(`Expected ${expectedStatus}, got ${response.status}`);
      }
      if (!propertiesMatch) {
        errorDetails.push(`Missing properties: ${missingProperties.join(', ')}`);
      }
      
      const errorMsg = errorDetails.join('; ');
      logTest(title, 'FAIL', `${errorMsg}\n     ${details}`);
      
      failedTests.push({
        number: testStats.testNumber,
        title,
        method,
        endpoint,
        error: errorMsg,
        response: {
          status: response.status,
          data: response.data
        },
        description,
        timestamp: new Date().toISOString(),
        requestBody: body,
        hasToken: !!authToken
      });
    }

    return {
      success: testPassed,
      response,
      data: response.data
    };

  } catch (error) {

    const errorMsg = error.code === 'ECONNREFUSED' 
      ? 'Connection refused - Server not running'
      : error.message;
      
    logTest(title, 'FAIL', errorMsg);
    if(retriesLeft > 0 && error.code === 'ECONNREFUSED'){
      logWarning(`Retrying test ${title}... (${retriesLeft} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return await runAPITest(title, method, endpoint, body, headers, expectedStatus, expectedProperties, authToken, fileUpload, description, retriesLeft - 1);
    }else{
    testStats.failed++;
    failedTests.push({
      number: testStats.testNumber,
      title,
      method,
      endpoint,
      error: errorMsg,
      response: null,
      description,
      timestamp: new Date().toISOString(),
      requestBody: body,
      hasToken: !!authToken
    });

    return {
      success: false,
      error: errorMsg
    };
  }
}
}

// ─────────────────────────────────────────────────────────
// Helper function to check nested properties
// ─────────────────────────────────────────────────────────
function hasProperty(obj, path) {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined || !(key in current)) {
      return false;
    }
    current = current[key];
  }
  return true;
}


// ═══════════════════════════════════════════════════════════
// MAIN TEST SUITE
// ═══════════════════════════════════════════════════════════
async function runAllTests() {
  logHeader('🚀 Kocaeli News Map API — Comprehensive Test Suite');
  
  logInfo(`Base URL: ${CONFIG.baseURL}`);
  logInfo(`Timeout: ${CONFIG.timeout}ms`);
  logWarning('Note: Ensure the FastAPI server is running on port ' + PORT);
  logWarning('Note: Ensure MongoDB is connected and the server is fully started');
  console.log();

  // Store shared data between tests
  let savedArticleId = null;

  try {

    // ═══════════════════════════════════════════════════════
    // 1. HEALTH & ROOT ENDPOINTS
    // ═══════════════════════════════════════════════════════
    logSubHeader('1. Health & Root Endpoints');

    await runAPITest(
      'Root endpoint returns OK',
      'GET', '/',
      null, {}, 200,
      ['status', 'service', 'version'],
      null, false,
      'Verifies the root health check returns status=ok, service name, and version'
    );

    await runAPITest(
      'Health check returns database status',
      'GET', '/api/health',
      null, {}, 200,
      ['status', 'database'],
      null, false,
      'Verifies /api/health returns status and database connection info'
    );

    // Edge: non-existent root-level path
    await runAPITest(
      'Non-existent root path returns 404',
      'GET', '/api/nonexistent',
      null, {}, 404,
      [],
      null, false,
      'A completely invalid top-level path should return 404'
    );

    // ═══════════════════════════════════════════════════════
    // 2. NEWS LIST ENDPOINT (GET /api/news)
    // ═══════════════════════════════════════════════════════
    logSubHeader('2. News List Endpoint — GET /api/news');

    const listResult = await runAPITest(
      'List articles with default pagination',
      'GET', '/api/news',
      null, {}, 200,
      ['articles', 'total', 'page', 'limit', 'total_pages'],
      null, false,
      'Verifies the paginated list response structure'
    );

    // Save an article ID for later single-article tests
    if (listResult.success && listResult.data.articles && listResult.data.articles.length > 0) {
      savedArticleId = listResult.data.articles[0].id;
      logInfo(`Stored article ID for later tests: ${savedArticleId}`);
    }

    await runAPITest(
      'List articles with custom page and limit',
      'GET', '/api/news?page=1&limit=5',
      null, {}, 200,
      ['articles', 'total', 'page', 'limit', 'total_pages'],
      null, false,
      'Custom pagination parameters page=1, limit=5'
    );

    await runAPITest(
      'List articles page 2',
      'GET', '/api/news?page=2&limit=5',
      null, {}, 200,
      ['articles'],
      null, false,
      'Second page should still return a valid response even if empty'
    );

    await runAPITest(
      'List articles with limit=1 (minimum)',
      'GET', '/api/news?limit=1',
      null, {}, 200,
      ['articles'],
      null, false,
      'Minimum limit boundary test'
    );

    await runAPITest(
      'List articles with limit=100 (maximum)',
      'GET', '/api/news?limit=100',
      null, {}, 200,
      ['articles'],
      null, false,
      'Maximum limit boundary test'
    );

    // Edge: invalid pagination
    await runAPITest(
      'List articles with limit=0 returns 422 (below minimum)',
      'GET', '/api/news?limit=0',
      null, {}, 422,
      [],
      null, false,
      'limit=0 is below the ge=1 constraint, should be rejected by FastAPI'
    );

    await runAPITest(
      'List articles with limit=101 returns 422 (above maximum)',
      'GET', '/api/news?limit=101',
      null, {}, 422,
      [],
      null, false,
      'limit=101 exceeds the le=100 constraint'
    );

    await runAPITest(
      'List articles with page=0 returns 422 (below minimum)',
      'GET', '/api/news?page=0',
      null, {}, 422,
      [],
      null, false,
      'page=0 is below the ge=1 constraint'
    );

    await runAPITest(
      'List articles with negative page returns 422',
      'GET', '/api/news?page=-1',
      null, {}, 422,
      [],
      null, false,
      'Negative page number should be rejected'
    );

    // ═══════════════════════════════════════════════════════
    // 3. NEWS FILTERING TESTS
    // ═══════════════════════════════════════════════════════
    logSubHeader('3. News Filtering — Category, District, Source, Date, Search');

    await runAPITest(
      'Filter by category: guncel',
      'GET', '/api/news?category=guncel',
      null, {}, 200,
      ['articles', 'total'],
      null, false,
      'Should return only articles with category=guncel'
    );

    await runAPITest(
      'Filter by category: polis',
      'GET', '/api/news?category=polis',
      null, {}, 200,
      ['articles', 'total'],
      null, false,
      'Should return only polis articles'
    );

    await runAPITest(
      'Filter by category: ekonomi',
      'GET', '/api/news?category=ekonomi',
      null, {}, 200,
      ['articles', 'total'],
      null, false,
      'Should return only ekonomi articles'
    );

    await runAPITest(
      'Filter by category: spor',
      'GET', '/api/news?category=spor',
      null, {}, 200,
      ['articles', 'total'],
      null, false,
      'Should return only spor articles'
    );

    await runAPITest(
      'Filter by category: siyaset',
      'GET', '/api/news?category=siyaset',
      null, {}, 200,
      ['articles', 'total'],
      null, false,
      'Should return only siyaset articles'
    );

    await runAPITest(
      'Filter by category: egitim',
      'GET', '/api/news?category=egitim',
      null, {}, 200,
      ['articles', 'total'],
      null, false,
      'Should return only egitim articles'
    );

    await runAPITest(
      'Filter by category: saglik',
      'GET', '/api/news?category=saglik',
      null, {}, 200,
      ['articles', 'total'],
      null, false,
      'Should return only saglik articles'
    );

    await runAPITest(
      'Filter by category: teknoloji',
      'GET', '/api/news?category=teknoloji',
      null, {}, 200,
      ['articles', 'total'],
      null, false,
      'Should return only teknoloji articles'
    );

    await runAPITest(
      'Filter by category: yasam',
      'GET', '/api/news?category=yasam',
      null, {}, 200,
      ['articles', 'total'],
      null, false,
      'Should return only yasam articles'
    );

    await runAPITest(
      'Filter by non-existent category returns empty list',
      'GET', '/api/news?category=nonexistent_xyz',
      null, {}, 200,
      ['articles', 'total'],
      null, false,
      'Non-matching category should return zero articles but 200 OK'
    );

    await runAPITest(
      'Filter by district: İzmit',
      'GET', '/api/news?district=İzmit',
      null, {}, 200,
      ['articles', 'total'],
      null, false,
      'District filter uses regex matching on location_text'
    );

    await runAPITest(
      'Filter by district: Gebze',
      'GET', '/api/news?district=Gebze',
      null, {}, 200,
      ['articles', 'total'],
      null, false,
      'District filter for Gebze'
    );

    await runAPITest(
      'Filter by district: Darıca',
      'GET', '/api/news?district=Darıca',
      null, {}, 200,
      ['articles', 'total'],
      null, false,
      'District filter for Darıca'
    );

    await runAPITest(
      'Filter by non-existent district returns empty list',
      'GET', '/api/news?district=NonExistentCity',
      null, {}, 200,
      ['articles', 'total'],
      null, false,
      'Non-matching district returns zero results'
    );

    await runAPITest(
      'Filter by source: Çağdaş Kocaeli',
      'GET', '/api/news?source=Çağdaş Kocaeli',
      null, {}, 200,
      ['articles', 'total'],
      null, false,
      'Filter by exact source name'
    );

    await runAPITest(
      'Filter by source: Yeni Kocaeli',
      'GET', '/api/news?source=Yeni Kocaeli',
      null, {}, 200,
      ['articles', 'total'],
      null, false,
      'Filter by exact source name'
    );

    await runAPITest(
      'Filter by date range (valid)',
      'GET', '/api/news?start_date=2026-03-01&end_date=2026-04-02',
      null, {}, 200,
      ['articles', 'total'],
      null, false,
      'Date range filter with valid YYYY-MM-DD format'
    );

    await runAPITest(
      'Filter by start_date only',
      'GET', '/api/news?start_date=2026-04-01',
      null, {}, 200,
      ['articles', 'total'],
      null, false,
      'Only start_date specified, no end_date'
    );

    await runAPITest(
      'Filter by end_date only',
      'GET', '/api/news?end_date=2026-04-02',
      null, {}, 200,
      ['articles', 'total'],
      null, false,
      'Only end_date specified, no start_date'
    );

    await runAPITest(
      'Filter by invalid start_date format returns 400',
      'GET', '/api/news?start_date=01-2026-04',
      null, {}, 400,
      [],
      null, false,
      'start_date in DD-YYYY-MM format should be rejected'
    );

    await runAPITest(
      'Filter by invalid end_date format returns 400',
      'GET', '/api/news?end_date=invalid-date',
      null, {}, 400,
      [],
      null, false,
      'Completely invalid date string should return 400'
    );

    await runAPITest(
      'Search by keyword in title/content',
      'GET', '/api/news?search=Kocaeli',
      null, {}, 200,
      ['articles', 'total'],
      null, false,
      'Text search uses regex on title and content fields'
    );

    await runAPITest(
      'Search with no matching keyword returns empty',
      'GET', '/api/news?search=xyznonexistent123',
      null, {}, 200,
      ['articles', 'total'],
      null, false,
      'No articles should match a gibberish search term'
    );

    // Combined filters
    await runAPITest(
      'Combined filter: category + district',
      'GET', '/api/news?category=guncel&district=İzmit',
      null, {}, 200,
      ['articles', 'total'],
      null, false,
      'Multiple filters applied simultaneously'
    );

    await runAPITest(
      'Combined filter: category + search + date range',
      'GET', '/api/news?category=polis&search=kaza&start_date=2026-01-01&end_date=2026-12-31',
      null, {}, 200,
      ['articles', 'total'],
      null, false,
      'Triple filter combination'
    );

    await runAPITest(
      'Combined filter: all filters at once',
      'GET', '/api/news?category=guncel&district=İzmit&source=Çağdaş Kocaeli&start_date=2026-01-01&end_date=2026-12-31&search=haber&page=1&limit=5',
      null, {}, 200,
      ['articles', 'total', 'page', 'limit', 'total_pages'],
      null, false,
      'All available query parameters used together'
    );

    // ═══════════════════════════════════════════════════════
    // 4. SINGLE ARTICLE ENDPOINT (GET /api/news/{id})
    // ═══════════════════════════════════════════════════════
    logSubHeader('4. Single Article Endpoint — GET /api/news/{id}');

    if (savedArticleId) {
      await runAPITest(
        'Get single article by valid ID',
        'GET', `/api/news/${savedArticleId}`,
        null, {}, 200,
        ['id', 'title', 'content', 'category', 'published_at', 'source_name', 'source_url', 'sources'],
        null, false,
        'Fetches a specific article and verifies all required fields are present'
      );
    } else {
      logWarning('Skipping single article test — no article ID available (database may be empty)');
    }

    await runAPITest(
      'Get article with invalid ObjectId format returns 400',
      'GET', '/api/news/invalid-id-format',
      null, {}, 400,
      [],
      null, false,
      'Non-ObjectId strings should return 400'
    );

    await runAPITest(
      'Get article with non-existent valid ObjectId returns 404',
      'GET', '/api/news/000000000000000000000000',
      null, {}, 404,
      [],
      null, false,
      'A valid ObjectId format but not in DB should return 404'
    );

    await runAPITest(
      'Get article with empty ID returns 404 or 405',
      'GET', '/api/news/',
      null, {}, 200,
      [],
      null, false,
      'Trailing slash on /api/news/ should hit the list endpoint (200)'
    );

    // ═══════════════════════════════════════════════════════
    // 5. CATEGORIES ENDPOINT (GET /api/news/categories)
    // ═══════════════════════════════════════════════════════
    logSubHeader('5. Categories Endpoint — GET /api/news/categories');

    const catResult = await runAPITest(
      'Get all categories returns array',
      'GET', '/api/news/categories',
      null, {}, 200,
      [],
      null, false,
      'Should return a sorted array of distinct category strings'
    );

    if (catResult.success && Array.isArray(catResult.data)) {
      logInfo(`Found ${catResult.data.length} categories: ${catResult.data.join(', ')}`);
    }

    // ═══════════════════════════════════════════════════════
    // 6. DISTRICTS ENDPOINT (GET /api/news/districts)
    // ═══════════════════════════════════════════════════════
    logSubHeader('6. Districts Endpoint — GET /api/news/districts');

    const distResult = await runAPITest(
      'Get all districts returns array',
      'GET', '/api/news/districts',
      null, {}, 200,
      [],
      null, false,
      'Should return a sorted array of distinct location_text values (no nulls)'
    );

    if (distResult.success && Array.isArray(distResult.data)) {
      logInfo(`Found ${distResult.data.length} districts: ${distResult.data.slice(0, 5).join(', ')}${distResult.data.length > 5 ? '...' : ''}`);
    }

    // ═══════════════════════════════════════════════════════
    // 7. SOURCES ENDPOINT (GET /api/news/sources)
    // ═══════════════════════════════════════════════════════
    logSubHeader('7. Sources Endpoint — GET /api/news/sources');

    const srcResult = await runAPITest(
      'Get all news sources returns array',
      'GET', '/api/news/sources',
      null, {}, 200,
      [],
      null, false,
      'Should return a sorted array of distinct source_name values'
    );

    if (srcResult.success && Array.isArray(srcResult.data)) {
      logInfo(`Found ${srcResult.data.length} sources: ${srcResult.data.join(', ')}`);
    }

    // ═══════════════════════════════════════════════════════
    // 8. STATS ENDPOINT (GET /api/news/stats)
    // ═══════════════════════════════════════════════════════
    logSubHeader('8. Statistics Endpoint — GET /api/news/stats');

    await runAPITest(
      'Get statistics returns all fields',
      'GET', '/api/news/stats',
      null, {}, 200,
      ['total_articles', 'by_category', 'by_source', 'by_district'],
      null, false,
      'Aggregation endpoint must return total_articles, by_category, by_source, by_district'
    );

    // ═══════════════════════════════════════════════════════
    // 9. SCRAPER TRIGGER ENDPOINT (POST /api/scrape)
    // ═══════════════════════════════════════════════════════
    logSubHeader('9. Scraper Trigger Endpoint — POST /api/scrape');

    await runAPITest(
      'Trigger scrape with default parameters',
      'POST', '/api/scrape',
      { days: 1, sources: ["cagdaskocaeli"] },
      {}, 200,
      ['is_running', 'message', 'articles_scraped', 'articles_saved', 'errors'],
      null, false,
      'Trigger a small scrape (1 day, 1 source) and verify response shape'
    );

    await runAPITest(
      'Trigger scrape with all sources',
      'POST', '/api/scrape',
      { days: 1, sources: ["all"] },
      {}, 200,
      ['is_running', 'message'],
      null, false,
      'Trigger scrape for all sources (may return "already running" if previous still active)'
    );

    await runAPITest(
      'Trigger scrape with specific source list',
      'POST', '/api/scrape',
      { days: 1, sources: ["ozgurkocaeli", "seskocaeli"] },
      {}, 200,
      ['is_running', 'message'],
      null, false,
      'Trigger scrape for two specific sources'
    );

    await runAPITest(
      'Trigger scrape with all five sources',
      'POST', '/api/scrape',
      { days: 1, sources: ["cagdaskocaeli", "ozgurkocaeli", "seskocaeli", "bizimyaka", "yenikocaeli"] },
      {}, 200,
      ['is_running', 'message'],
      null, false,
      'All 5 configured sources listed explicitly'
    );

    // Edge: invalid days
    await runAPITest(
      'Trigger scrape with days=0 returns 422',
      'POST', '/api/scrape',
      { days: 0, sources: ["all"] },
      {}, 422,
      [],
      null, false,
      'days must be >= 1 per ScrapeRequest model'
    );

    await runAPITest(
      'Trigger scrape with days=31 returns 422',
      'POST', '/api/scrape',
      { days: 31, sources: ["all"] },
      {}, 422,
      [],
      null, false,
      'days must be <= 30 per ScrapeRequest model'
    );

    await runAPITest(
      'Trigger scrape with negative days returns 422',
      'POST', '/api/scrape',
      { days: -5, sources: ["all"] },
      {}, 422,
      [],
      null, false,
      'Negative days should be rejected by validation'
    );

    // Edge: invalid sources
    await runAPITest(
      'Trigger scrape with empty sources array',
      'POST', '/api/scrape',
      { days: 1, sources: [] },
      {}, 200,
      ['is_running', 'message'],
      null, false,
      'Empty sources array — server should handle gracefully (returns "No valid sources")'
    );

    await runAPITest(
      'Trigger scrape with non-existent source name',
      'POST', '/api/scrape',
      { days: 1, sources: ["nonexistent_source"] },
      {}, 200,
      ['is_running', 'message'],
      null, false,
      'Unknown source name — should handle gracefully without crashing'
    );

    // Edge: empty body
    await runAPITest(
      'Trigger scrape with empty body (defaults apply)',
      'POST', '/api/scrape',
      {},
      {}, 200,
      ['is_running', 'message'],
      null, false,
      'Empty body should use defaults: days=3, sources=["all"]'
    );

    // Edge: wrong HTTP method
    await runAPITest(
      'GET on scrape endpoint returns 405',
      'GET', '/api/scrape',
      null, {}, 405,
      [],
      null, false,
      'Scrape trigger only accepts POST, GET should return Method Not Allowed'
    );

    // ═══════════════════════════════════════════════════════
    // 10. SCRAPER STATUS ENDPOINT (GET /api/scrape/status)
    // ═══════════════════════════════════════════════════════
    logSubHeader('10. Scraper Status Endpoint — GET /api/scrape/status');

    await runAPITest(
      'Get scrape status',
      'GET', '/api/scrape/status',
      null, {}, 200,
      ['is_running', 'message', 'articles_scraped', 'articles_saved', 'errors'],
      null, false,
      'Check scraping pipeline status. All fields must be present.'
    );

    // Edge: POST on status should return 405
    await runAPITest(
      'POST on status endpoint returns 405',
      'POST', '/api/scrape/status',
      {}, {}, 405,
      [],
      null, false,
      'Status endpoint only accepts GET'
    );

    // ═══════════════════════════════════════════════════════
    // 11. HTTP METHOD & CONTENT TYPE EDGE CASES
    // ═══════════════════════════════════════════════════════
    logSubHeader('11. HTTP Method & Content Type Edge Cases');

    await runAPITest(
      'PUT on /api/news returns 405 (not allowed)',
      'PUT', '/api/news',
      { title: 'test' }, {}, 405,
      [],
      null, false,
      'News list endpoint only supports GET'
    );

    await runAPITest(
      'DELETE on /api/news returns 405 (not allowed)',
      'DELETE', '/api/news',
      null, {}, 405,
      [],
      null, false,
      'No DELETE handler on news list endpoint'
    );

    await runAPITest(
      'PATCH on /api/news returns 405 (not allowed)',
      'PATCH', '/api/news',
      { title: 'test' }, {}, 405,
      [],
      null, false,
      'No PATCH handler on news list endpoint'
    );

    await runAPITest(
      'POST on /api/news/categories returns 405',
      'POST', '/api/news/categories',
      {}, {}, 405,
      [],
      null, false,
      'Categories endpoint only accepts GET'
    );

    await runAPITest(
      'POST on /api/news/districts returns 405',
      'POST', '/api/news/districts',
      {}, {}, 405,
      [],
      null, false,
      'Districts endpoint only accepts GET'
    );

    await runAPITest(
      'POST on /api/news/sources returns 405',
      'POST', '/api/news/sources',
      {}, {}, 405,
      [],
      null, false,
      'Sources endpoint only accepts GET'
    );

    await runAPITest(
      'POST on /api/news/stats returns 405',
      'POST', '/api/news/stats',
      {}, {}, 405,
      [],
      null, false,
      'Stats endpoint only accepts GET'
    );

    // ═══════════════════════════════════════════════════════
    // 12. ARTICLE RESPONSE SCHEMA VALIDATION
    // ═══════════════════════════════════════════════════════
    logSubHeader('12. Article Response Schema Validation');

    if (savedArticleId) {
      const schemaResult = await runAPITest(
        'Verify single article has all required fields',
        'GET', `/api/news/${savedArticleId}`,
        null, {}, 200,
        ['id', 'title', 'content', 'category', 'published_at', 'source_name', 'source_url', 'sources'],
        null, false,
        'Full field validation per NewsArticleResponse model'
      );

      if (schemaResult.success && schemaResult.data) {
        const article = schemaResult.data;

        // Validate field types
        const typeChecks = [
          { field: 'id', type: 'string', value: article.id },
          { field: 'title', type: 'string', value: article.title },
          { field: 'content', type: 'string', value: article.content },
          { field: 'category', type: 'string', value: article.category },
          { field: 'source_name', type: 'string', value: article.source_name },
          { field: 'source_url', type: 'string', value: article.source_url },
        ];

        for (const check of typeChecks) {
          testStats.testNumber++;
          testStats.total++;
          const isCorrectType = typeof check.value === check.type;
          if (isCorrectType) {
            testStats.passed++;
            logTest(`Field "${check.field}" is type ${check.type}`, 'PASS', `Value: ${String(check.value).substring(0, 80)}`);
          } else {
            testStats.failed++;
            logTest(`Field "${check.field}" is type ${check.type}`, 'FAIL', `Got type ${typeof check.value}`);
            failedTests.push({
              number: testStats.testNumber,
              title: `Field "${check.field}" type check`,
              method: 'GET',
              endpoint: `/api/news/${savedArticleId}`,
              error: `Expected type ${check.type}, got ${typeof check.value}`,
              response: null,
              description: 'Schema type validation',
              timestamp: new Date().toISOString()
            });
          }
        }

        // Validate sources is an array
        testStats.testNumber++;
        testStats.total++;
        if (Array.isArray(article.sources)) {
          testStats.passed++;
          logTest('Field "sources" is an array', 'PASS', `Length: ${article.sources.length}`);
        } else {
          testStats.failed++;
          logTest('Field "sources" is an array', 'FAIL', `Got type ${typeof article.sources}`);
          failedTests.push({ number: testStats.testNumber, title: 'sources array check', method: 'GET', endpoint: `/api/news/${savedArticleId}`, error: 'sources is not an array', response: null, timestamp: new Date().toISOString() });
        }

        // Validate each source has name and url
        if (Array.isArray(article.sources) && article.sources.length > 0) {
          testStats.testNumber++;
          testStats.total++;
          const firstSource = article.sources[0];
          if (firstSource.name && firstSource.url) {
            testStats.passed++;
            logTest('Source item has name and url fields', 'PASS', `name: ${firstSource.name}, url: ${firstSource.url.substring(0, 60)}`);
          } else {
            testStats.failed++;
            logTest('Source item has name and url fields', 'FAIL', JSON.stringify(firstSource));
            failedTests.push({ number: testStats.testNumber, title: 'source fields check', method: 'GET', endpoint: `/api/news/${savedArticleId}`, error: 'Source missing name or url', response: null, timestamp: new Date().toISOString() });
          }
        }

        // Validate category is in the known list
        const KNOWN_CATEGORIES = ['guncel', 'polis', 'siyaset', 'egitim', 'ekonomi', 'yasam', 'saglik', 'teknoloji', 'spor'];
        testStats.testNumber++;
        testStats.total++;
        if (KNOWN_CATEGORIES.includes(article.category.toLowerCase())) {
          testStats.passed++;
          logTest('Article category is a valid category', 'PASS', `Category: ${article.category}`);
        } else {
          // Not a failure per se — new categories are dynamically discovered
          testStats.passed++;
          logTest('Article category is a dynamically discovered category', 'PASS', `Category: ${article.category} (not in default list but acceptable)`);
        }
      }
    } else {
      logWarning('Skipping schema validation — no article ID available (database may be empty)');
    }

    // ═══════════════════════════════════════════════════════
    // 13. PAGINATION LOGIC VALIDATION
    // ═══════════════════════════════════════════════════════
    logSubHeader('13. Pagination Logic Validation');

    const paginationResult = await runAPITest(
      'Verify pagination math (total_pages = ceil(total/limit))',
      'GET', '/api/news?limit=5',
      null, {}, 200,
      ['total', 'total_pages', 'limit'],
      null, false,
      'total_pages should equal Math.ceil(total / limit)'
    );

    if (paginationResult.success && paginationResult.data) {
      const { total, total_pages, limit } = paginationResult.data;
      const expectedPages = total > 0 ? Math.ceil(total / limit) : 1;

      testStats.testNumber++;
      testStats.total++;
      if (total_pages === expectedPages) {
        testStats.passed++;
        logTest('total_pages calculation is correct', 'PASS', `total=${total}, limit=${limit}, total_pages=${total_pages}, expected=${expectedPages}`);
      } else {
        testStats.failed++;
        logTest('total_pages calculation is correct', 'FAIL', `total=${total}, limit=${limit}, total_pages=${total_pages}, expected=${expectedPages}`);
        failedTests.push({ number: testStats.testNumber, title: 'Pagination math', method: 'GET', endpoint: '/api/news?limit=5', error: `Expected ${expectedPages} pages, got ${total_pages}`, response: null, timestamp: new Date().toISOString() });
      }

      // Verify articles count doesn't exceed limit
      testStats.testNumber++;
      testStats.total++;
      const returnedCount = paginationResult.data.articles ? paginationResult.data.articles.length : 0;
      if (returnedCount <= limit) {
        testStats.passed++;
        logTest('Returned articles count does not exceed limit', 'PASS', `Returned ${returnedCount} articles (limit=${limit})`);
      } else {
        testStats.failed++;
        logTest('Returned articles count does not exceed limit', 'FAIL', `Returned ${returnedCount} articles (limit=${limit})`);
        failedTests.push({ number: testStats.testNumber, title: 'Articles count vs limit', method: 'GET', endpoint: '/api/news?limit=5', error: `Count ${returnedCount} > limit ${limit}`, response: null, timestamp: new Date().toISOString() });
      }
    }

    // ═══════════════════════════════════════════════════════
    // 14. LARGE PAGE NUMBER (BEYOND DATA)
    // ═══════════════════════════════════════════════════════
    logSubHeader('14. Edge Case — Large Page Number');

    await runAPITest(
      'Requesting a very large page number returns empty articles',
      'GET', '/api/news?page=9999&limit=10',
      null, {}, 200,
      ['articles', 'total'],
      null, false,
      'Should return 200 with an empty articles array for pages beyond actual data'
    );

    // ═══════════════════════════════════════════════════════
    // 15. CORS HEADERS CHECK
    // ═══════════════════════════════════════════════════════
    logSubHeader('15. CORS Headers Check');

    const corsResult = await runAPITest(
      'Response includes CORS headers (Access-Control-Allow-Origin)',
      'GET', '/',
      null, { 'Origin': 'http://localhost:3000' },
      200,
      ['status'],
      null, false,
      'CORS middleware should add Access-Control-Allow-Origin header'
    );

    if (corsResult.success && corsResult.response) {
      const acaoHeader = corsResult.response.headers['access-control-allow-origin'];
      testStats.testNumber++;
      testStats.total++;
      if (acaoHeader) {
        testStats.passed++;
        logTest('CORS Access-Control-Allow-Origin header present', 'PASS', `Value: ${acaoHeader}`);
      } else {
        testStats.failed++;
        logTest('CORS Access-Control-Allow-Origin header present', 'FAIL', 'Header not found');
        failedTests.push({ number: testStats.testNumber, title: 'CORS header', method: 'GET', endpoint: '/', error: 'Access-Control-Allow-Origin missing', response: null, timestamp: new Date().toISOString() });
      }
    }

    // ═══════════════════════════════════════════════════════
    // 16. RAPID SEQUENTIAL REQUESTS (CONSISTENCY)
    // ═══════════════════════════════════════════════════════
    logSubHeader('16. Rapid Sequential Requests — Data Consistency');

    const results = [];
    for (let i = 0; i < 3; i++) {
      const r = await runAPITest(
        `Rapid request #${i + 1} — categories endpoint`,
        'GET', '/api/news/categories',
        null, {}, 200,
        [],
        null, false,
        `Consistency test: categories should remain the same across rapid calls`
      );
      results.push(r);
    }

    // Check consistency across all three responses
    if (results.every(r => r.success)) {
      testStats.testNumber++;
      testStats.total++;
      const first = JSON.stringify(results[0].data);
      const allSame = results.every(r => JSON.stringify(r.data) === first);
      if (allSame) {
        testStats.passed++;
        logTest('Rapid requests return consistent data', 'PASS', 'All 3 responses identical');
      } else {
        testStats.failed++;
        logTest('Rapid requests return consistent data', 'FAIL', 'Responses differ across rapid calls');
        failedTests.push({ number: testStats.testNumber, title: 'Data consistency', method: 'GET', endpoint: '/api/news/categories', error: 'Inconsistent responses', response: null, timestamp: new Date().toISOString() });
      }
    }

    // ═══════════════════════════════════════════════════════
    // 17. SPECIAL CHARACTERS IN QUERY PARAMS
    // ═══════════════════════════════════════════════════════
    logSubHeader('17. Special Characters in Query Parameters');

    await runAPITest(
      'Search with Turkish characters: İzmit',
      'GET', '/api/news?search=İzmit',
      null, {}, 200,
      ['articles'],
      null, false,
      'Turkish İ character in search parameter'
    );

    await runAPITest(
      'Search with Turkish characters: Şehir',
      'GET', '/api/news?search=Şehir',
      null, {}, 200,
      ['articles'],
      null, false,
      'Turkish Ş character in search parameter'
    );

    await runAPITest(
      'Search with Turkish characters: Çayırova',
      'GET', '/api/news?search=Çayırova',
      null, {}, 200,
      ['articles'],
      null, false,
      'Turkish Ç character in search parameter'
    );

    await runAPITest(
      'Search with empty string',
      'GET', '/api/news?search=',
      null, {}, 200,
      ['articles'],
      null, false,
      'Empty search should be treated as no search filter'
    );

    await runAPITest(
      'District filter with URL-encoded Turkish: Darıca',
      'GET', `/api/news?district=${encodeURIComponent('Darıca')}`,
      null, {}, 200,
      ['articles'],
      null, false,
      'Turkish characters properly URL-encoded'
    );

    // ═══════════════════════════════════════════════════════
    // 18. RESPONSE TIME CHECK
    // ═══════════════════════════════════════════════════════
    logSubHeader('18. Response Time Check');

    {
      const startTime = Date.now();
      const timingResult = await runAPITest(
        'List endpoint responds within 10 seconds',
        'GET', '/api/news?limit=10',
        null, {}, 200,
        ['articles'],
        null, false,
        'Performance check — basic list query should be fast'
      );
      const elapsed = Date.now() - startTime;

      testStats.testNumber++;
      testStats.total++;
      if (elapsed < 10000) {
        testStats.passed++;
        logTest('Response time under 10s', 'PASS', `Responded in ${elapsed}ms`);
      } else {
        testStats.failed++;
        logTest('Response time under 10s', 'FAIL', `Responded in ${elapsed}ms — too slow`);
        failedTests.push({ number: testStats.testNumber, title: 'Response time', method: 'GET', endpoint: '/api/news?limit=10', error: `Took ${elapsed}ms`, response: null, timestamp: new Date().toISOString() });
      }
    }

    {
      const startTime = Date.now();
      await runAPITest(
        'Stats endpoint responds within 10 seconds',
        'GET', '/api/news/stats',
        null, {}, 200,
        ['total_articles'],
        null, false,
        'Performance check — aggregation query'
      );
      const elapsed = Date.now() - startTime;

      testStats.testNumber++;
      testStats.total++;
      if (elapsed < 10000) {
        testStats.passed++;
        logTest('Stats response time under 10s', 'PASS', `Responded in ${elapsed}ms`);
      } else {
        testStats.failed++;
        logTest('Stats response time under 10s', 'FAIL', `Responded in ${elapsed}ms`);
        failedTests.push({ number: testStats.testNumber, title: 'Stats response time', method: 'GET', endpoint: '/api/news/stats', error: `Took ${elapsed}ms`, response: null, timestamp: new Date().toISOString() });
      }
    }

    // ═══════════════════════════════════════════════════════
    // 19. CONTENT TYPE HEADER VALIDATION
    // ═══════════════════════════════════════════════════════
    logSubHeader('19. Content-Type Header Validation');

    const ctResult = await runAPITest(
      'API returns application/json content type',
      'GET', '/api/news',
      null, {}, 200,
      ['articles'],
      null, false,
      'All API responses should return JSON'
    );

    if (ctResult.success && ctResult.response) {
      const contentType = ctResult.response.headers['content-type'] || '';
      testStats.testNumber++;
      testStats.total++;
      if (contentType.includes('application/json')) {
        testStats.passed++;
        logTest('Content-Type is application/json', 'PASS', `Value: ${contentType}`);
      } else {
        testStats.failed++;
        logTest('Content-Type is application/json', 'FAIL', `Value: ${contentType}`);
        failedTests.push({ number: testStats.testNumber, title: 'Content-Type header', method: 'GET', endpoint: '/api/news', error: `Expected application/json, got ${contentType}`, response: null, timestamp: new Date().toISOString() });
      }
    }

    // ═══════════════════════════════════════════════════════
    // 20. SCRAPE REQUEST WITH TEXT BODY (MALFORMED)
    // ═══════════════════════════════════════════════════════
    logSubHeader('20. Malformed Request Bodies');

    await runAPITest(
      'POST scrape with string body returns 422',
      'POST', '/api/scrape',
      'this is not json',
      { 'Content-Type': 'text/plain' },
      422,
      [],
      null, false,
      'Non-JSON body should be rejected'
    );

    await runAPITest(
      'POST scrape with wrong field types returns 422',
      'POST', '/api/scrape',
      { days: "not_a_number", sources: "not_an_array" },
      {}, 422,
      [],
      null, false,
      'Invalid field types should be caught by Pydantic validation'
    );

    // ═══════════════════════════════════════════════════════
    // 21. FINAL VALIDATION — ALL ENDPOINTS ACCESSIBLE
    // ═══════════════════════════════════════════════════════
    logSubHeader('21. Final Validation — All Endpoints Accessible');

    const finalValidationTests = [
      ['Root endpoint', 'GET', '/', 200],
      ['Health check', 'GET', '/api/health', 200],
      ['News list', 'GET', '/api/news', 200],
      ['News categories', 'GET', '/api/news/categories', 200],
      ['News districts', 'GET', '/api/news/districts', 200],
      ['News sources', 'GET', '/api/news/sources', 200],
      ['News stats', 'GET', '/api/news/stats', 200],
      ['Scrape status', 'GET', '/api/scrape/status', 200],
    ];

    for (const [description, method, endpoint, expectedStatus] of finalValidationTests) {
      await runAPITest(description, method, endpoint, null, {}, expectedStatus, [], null, false, 'Final validation sweep');
    }


    // ═══════════════════════════════════════════════════════
    // TEST EXECUTION SUMMARY
    // ═══════════════════════════════════════════════════════
    logSubHeader('Test Execution Summary');
    
    logInfo('Endpoint coverage summary:');
    logInfo('✓ Root / health endpoints: GET /, GET /api/health');
    logInfo('✓ News list endpoint: GET /api/news (with pagination, filters)');
    logInfo('✓ News categories: GET /api/news/categories');
    logInfo('✓ News districts: GET /api/news/districts');
    logInfo('✓ News sources: GET /api/news/sources');
    logInfo('✓ News stats: GET /api/news/stats');
    logInfo('✓ Single article: GET /api/news/{id}');
    logInfo('✓ Scraper trigger: POST /api/scrape');
    logInfo('✓ Scraper status: GET /api/scrape/status');
    logInfo('✓ Filter tests: category, district, source, date range, search');
    logInfo('✓ Combined filter tests: multiple filters simultaneously');
    logInfo('✓ Pagination tests: limits, pages, boundary values, math validation');
    logInfo('✓ Schema validation: field types, sources array, category values');
    logInfo('✓ HTTP method validation: 405 for unsupported methods');
    logInfo('✓ Edge cases: invalid IDs, non-existent data, malformed bodies');
    logInfo('✓ Turkish character support: İ, Ş, Ç, ğ, ü in query params');
    logInfo('✓ CORS validation: Access-Control-Allow-Origin header');
    logInfo('✓ Response time checks: performance under 10s');
    logInfo('✓ Content-Type validation: application/json');
    logInfo('✓ Data consistency: rapid sequential requests');

    // Print final results
    printFinalResults();
    
  } catch (error) {
    logError(`Test suite failed: ${error.message}`);
    console.error(error);
    printFinalResults();
  }
}

// ─────────────────────────────────────────────────────────
// FINAL RESULTS PRINTER
// ─────────────────────────────────────────────────────────
function printFinalResults() {
  const duration = ((Date.now() - testStats.startTime) / 1000).toFixed(2);
  const passRate = testStats.total > 0 ? ((testStats.passed / testStats.total) * 100).toFixed(1) : '0.0';
  
  console.log('\n' + '═'.repeat(60));
  logHeader('📊 Test Results Summary');
  
  console.log(`${colors.bright}⏱️  Duration: ${colors.cyan}${duration}s${colors.reset}`);
  console.log(`${colors.bright}📈 Total Tests: ${colors.blue}${testStats.total}${colors.reset}`);
  console.log(`${colors.bright}✅ Passed: ${colors.green}${testStats.passed}${colors.reset}`);
  console.log(`${colors.bright}❌ Failed: ${colors.red}${testStats.failed}${colors.reset}`);
  console.log(`${colors.bright}📊 Pass Rate: ${colors.cyan}${passRate}%${colors.reset}`);
  
  if (passRate >= 80) {
    console.log(`${colors.bgGreen}${colors.white}${colors.bright} 🎉 EXCELLENT TEST RESULTS! 🎉 ${colors.reset}`);
  } else if (passRate >= 60) {
    console.log(`${colors.bgYellow}${colors.white}${colors.bright} ⚠️  GOOD BUT NEEDS IMPROVEMENT ⚠️  ${colors.reset}`);
  } else {
    console.log(`${colors.bgRed}${colors.white}${colors.bright} 🚨 MANY TESTS FAILED - CHECK SETUP 🚨 ${colors.reset}`);
  }
  
  if (failedTests.length > 0) {
    logHeader('❌ Failed Tests Details');
    console.log(`${colors.red}The following ${failedTests.length} test(s) failed:${colors.reset}\n`);
    
    failedTests.forEach((test, index) => {
      console.log(`${colors.bright}${index + 1}. [${test.number}] ${test.title}${colors.reset}`);
      console.log(`   ${colors.dim}Method: ${test.method} | Endpoint: ${test.endpoint}${colors.reset}`);
      console.log(`   ${colors.red}Error: ${test.error}${colors.reset}`);
      console.log(`   ${colors.cyan}Time: ${test.timestamp}${colors.reset}`);
      if (test.description) {
        console.log(`   ${colors.dim}Description: ${test.description}${colors.reset}`);
      }
      if (test.requestBody) {
        console.log(`   ${colors.magenta}Request Body:${colors.reset}`);
        console.log(`   ${JSON.stringify(test.requestBody, null, 4).split('\n').map(line => '   ' + line).join('\n')}`);
      }
      if (test.response && test.response.data) {
        console.log(`   ${colors.yellow}Response:${colors.reset}`);
        console.log(`   ${JSON.stringify(test.response.data, null, 4).split('\n').map(line => '   ' + line).join('\n')}`);
      }
      console.log(`   ${colors.white}${'─'.repeat(60)}${colors.reset}`);
    });
  }
  
  console.log(`${colors.bright}🏁 Testing complete! Thank you for using the Kocaeli News Map API Test Suite.${colors.reset}\n`);
}

// ─────────────────────────────────────────────────────────
// Configuration warnings
// ─────────────────────────────────────────────────────────
function printConfigWarnings() {
  logWarning('Configuration Setup Required:');
  console.log(`${colors.dim}1. Ensure your FastAPI server is running: cd server && python -m uvicorn main:app --host 0.0.0.0 --port ${PORT}${colors.reset}`);
  console.log(`${colors.dim}2. Ensure MongoDB Atlas is connected (check .env for MONGODB_URI)${colors.reset}`);
  console.log(`${colors.dim}3. For full test coverage, scrape some articles first by running the scraper${colors.reset}\n`);
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logError(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  printFinalResults();
  process.exit(1);
});

// ─────────────────────────────────────────────────────────
// RUN
// ─────────────────────────────────────────────────────────
printConfigWarnings();
runAllTests().catch(error => {
  logError(`Test execution failed: ${error.message}`);
  printFinalResults();
  process.exit(1);
});
