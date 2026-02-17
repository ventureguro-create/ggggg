/**
 * Connections Module - E2E Tests
 * 
 * Tests all critical API endpoints and frontend integration
 * Run: npx tsx tests/e2e/connections.e2e.test.ts
 */

const API_BASE = process.env.API_URL || 'http://localhost:8001';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`✅ ${name}`);
  } catch (error: any) {
    results.push({ name, passed: false, duration: Date.now() - start, error: error.message });
    console.log(`❌ ${name}: ${error.message}`);
  }
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

// ============================================================
// API TESTS
// ============================================================

async function testHealthEndpoint() {
  const data = await fetchJson(`${API_BASE}/api/health`);
  if (!data.ok) throw new Error('Health check failed');
  if (data.service !== 'fomo-backend') throw new Error('Wrong service name');
}

async function testUnifiedAccountsRealTwitter() {
  const data = await fetchJson(`${API_BASE}/api/connections/unified?facet=REAL_TWITTER&limit=5`);
  if (!data.ok) throw new Error('API returned ok=false');
  if (!data.data || data.data.length === 0) throw new Error('No accounts returned');
  
  // Validate account structure
  const account = data.data[0];
  if (typeof account.authority !== 'number') throw new Error('authority is not a number');
  if (account.authority > 100) throw new Error(`authority scale wrong: ${account.authority} (expected 0-100)`);
  if (!account.handle) throw new Error('Missing handle');
  if (!account.source) throw new Error('Missing source');
}

async function testUnifiedAccountsSmart() {
  const data = await fetchJson(`${API_BASE}/api/connections/unified?facet=SMART&limit=5`);
  if (!data.ok) throw new Error('API returned ok=false');
  if (data.facet !== 'SMART') throw new Error('Wrong facet returned');
}

async function testClusters() {
  const data = await fetchJson(`${API_BASE}/api/connections/clusters`);
  if (!data.ok) throw new Error('API returned ok=false');
  if (!data.data || data.data.length === 0) throw new Error('No clusters returned');
  
  // Validate cluster structure
  const cluster = data.data[0];
  if (!cluster.name) throw new Error('Missing cluster name');
  if (!cluster.members || cluster.members.length === 0) throw new Error('Cluster has no members');
}

async function testBackers() {
  const data = await fetchJson(`${API_BASE}/api/connections/backers`);
  if (!data.ok) throw new Error('API returned ok=false');
  if (!data.data?.backers || data.data.backers.length === 0) throw new Error('No backers returned');
  
  // Validate backer structure
  const backer = data.data.backers[0];
  if (!backer.slug) throw new Error('Missing backer slug');
  if (!backer.name) throw new Error('Missing backer name');
  if (typeof backer.seedAuthority !== 'number') throw new Error('Missing seedAuthority');
}

async function testOpportunities() {
  const data = await fetchJson(`${API_BASE}/api/connections/opportunities`);
  if (!data.ok) throw new Error('API returned ok=false');
}

async function testAltSeason() {
  const data = await fetchJson(`${API_BASE}/api/connections/alt-season`);
  if (!data.ok) throw new Error('API returned ok=false');
}

async function testLifecycle() {
  const data = await fetchJson(`${API_BASE}/api/connections/lifecycle`);
  if (!data.ok) throw new Error('API returned ok=false');
}

async function testGraphV2() {
  const data = await fetchJson(`${API_BASE}/api/connections/graph/v2?handle=vitalikbuterin`);
  if (!data.ok) throw new Error('API returned ok=false');
  // Graph may return empty nodes if no data, that's ok
}

async function testAdminBackers() {
  const data = await fetchJson(`${API_BASE}/api/admin/connections/backers`);
  if (!data.ok) throw new Error('API returned ok=false');
  if (!data.data?.backers) throw new Error('Missing backers in response');
}

// ============================================================
// DATA INTEGRITY TESTS
// ============================================================

async function testAuthorityScale() {
  const data = await fetchJson(`${API_BASE}/api/connections/unified?facet=REAL_TWITTER&limit=10`);
  
  for (const account of data.data) {
    if (account.authority > 100) {
      throw new Error(`Authority scale error: ${account.handle} has authority=${account.authority}`);
    }
    if (account.authority < 0) {
      throw new Error(`Authority negative: ${account.handle} has authority=${account.authority}`);
    }
  }
}

async function testBackerConfidence() {
  const data = await fetchJson(`${API_BASE}/api/connections/backers`);
  
  for (const backer of data.data.backers) {
    const confidence = backer.confidence;
    if (confidence !== undefined && confidence !== null) {
      if (typeof confidence !== 'number' || isNaN(confidence)) {
        throw new Error(`Backer ${backer.slug} has invalid confidence: ${confidence}`);
      }
    }
  }
}

async function testClusterMembers() {
  const data = await fetchJson(`${API_BASE}/api/connections/clusters`);
  
  for (const cluster of data.data) {
    if (!Array.isArray(cluster.members)) {
      throw new Error(`Cluster ${cluster.name} has invalid members`);
    }
    if (cluster.members.length === 0) {
      throw new Error(`Cluster ${cluster.name} is empty`);
    }
  }
}

// ============================================================
// INTEGRATION TESTS
// ============================================================

async function testUnifiedToBackersLink() {
  // Get unified accounts with VC category
  const unified = await fetchJson(`${API_BASE}/api/connections/unified?facet=REAL_TWITTER&limit=10`);
  
  // Get backers
  const backers = await fetchJson(`${API_BASE}/api/connections/backers`);
  
  // Both should return valid data
  if (!unified.ok) throw new Error('Unified REAL_TWITTER failed');
  if (!backers.ok) throw new Error('Backers API failed');
  
  // Check that we have VCs in both
  const vcAccounts = unified.data.filter((a: any) => a.categories?.includes('VC'));
  if (vcAccounts.length === 0 && backers.data.backers.length === 0) {
    throw new Error('No VC data found in either API');
  }
}

async function testSearchFunctionality() {
  const data = await fetchJson(`${API_BASE}/api/connections/unified?facet=REAL_TWITTER&search=vitalik&limit=5`);
  if (!data.ok) throw new Error('Search failed');
  // Search should work even if no results
}

// ============================================================
// MAIN
// ============================================================

async function runAllTests() {
  console.log('\n🧪 CONNECTIONS MODULE E2E TESTS\n');
  console.log('=' .repeat(50));
  console.log(`API Base: ${API_BASE}\n`);

  // API Tests
  console.log('📡 API Endpoint Tests:');
  await test('Health endpoint', testHealthEndpoint);
  await test('Unified accounts (REAL_TWITTER)', testUnifiedAccountsRealTwitter);
  await test('Unified accounts (SMART)', testUnifiedAccountsSmart);
  await test('Clusters API', testClusters);
  await test('Backers API', testBackers);
  await test('Opportunities API', testOpportunities);
  await test('Alt-Season API', testAltSeason);
  await test('Lifecycle API', testLifecycle);
  await test('Graph V2 API', testGraphV2);
  await test('Admin Backers API', testAdminBackers);

  // Data Integrity Tests
  console.log('\n🔍 Data Integrity Tests:');
  await test('Authority scale (0-100)', testAuthorityScale);
  await test('Backer confidence (no NaN)', testBackerConfidence);
  await test('Cluster members (not empty)', testClusterMembers);

  // Integration Tests
  console.log('\n🔗 Integration Tests:');
  await test('Unified ↔ Backers link', testUnifiedToBackersLink);
  await test('Search functionality', testSearchFunctionality);

  // Summary
  console.log('\n' + '=' .repeat(50));
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(`\n📊 RESULTS: ${passed}/${total} passed (${Math.round(passed/total*100)}%)`);
  
  if (failed > 0) {
    console.log(`\n❌ FAILED TESTS:`);
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
  }

  // Write results to file
  const report = {
    timestamp: new Date().toISOString(),
    apiBase: API_BASE,
    total,
    passed,
    failed,
    successRate: `${Math.round(passed/total*100)}%`,
    tests: results,
  };
  
  const fs = await import('fs');
  fs.writeFileSync('/app/test_reports/e2e_connections.json', JSON.stringify(report, null, 2));
  console.log('\n📄 Report saved to: /app/test_reports/e2e_connections.json');

  // Exit with error if any tests failed
  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(console.error);
