/**
 * IvyInvi - Master Automated E2E Test Suite Runner
 * Executes both:
 * 1. Webhook & Integration Suite (test/verify-integration.js)
 * 2. Content, Theme & Branding Suite (test/verify-content-theme.js)
 * Aggregates 4-tier results, prints detailed summary table, and sets appropriate exit code.
 * Zero external dependencies.
 */

const { runIntegrationTests } = require('./verify-integration');
const { runContentThemeTests } = require('./verify-content-theme');

function aggregateByTier(results) {
  const tiers = {
    'Tier 1: Feature Coverage': { passed: 0, total: 0 },
    'Tier 2: Boundary & Corner Cases': { passed: 0, total: 0 },
    'Tier 3: Cross-Feature Combinations': { passed: 0, total: 0 },
    'Tier 4: Real-World Scenarios': { passed: 0, total: 0 }
  };

  results.forEach(r => {
    const tierName = r.tier || 'Other';
    if (!tiers[tierName]) {
      tiers[tierName] = { passed: 0, total: 0 };
    }
    tiers[tierName].total++;
    if (r.passed) {
      tiers[tierName].passed++;
    }
  });

  return tiers;
}

async function runAllTests() {
  const startTime = Date.now();

  console.log('\n======================================================================');
  console.log('       IvyInvi Graduation Invitation - MASTER E2E TEST RUNNER         ');
  console.log('       Target: Vũ Lâm Thanh Hằng | Theme: Blush Pink & Rose Gold      ');
  console.log('======================================================================\n');

  // 1. Run Integration Suite
  let integrationSummary;
  try {
    integrationSummary = await runIntegrationTests();
  } catch (err) {
    console.error('FATAL: Integration test suite encountered an unhandled error:', err);
    integrationSummary = { total: 0, passed: 0, failed: 1, results: [] };
  }

  // 2. Run Content & Theme Suite
  let contentThemeSummary;
  try {
    contentThemeSummary = runContentThemeTests();
  } catch (err) {
    console.error('FATAL: Content & Theme test suite encountered an unhandled error:', err);
    contentThemeSummary = { total: 0, passed: 0, failed: 1, results: [] };
  }

  // 3. Aggregate all results
  const allResults = [
    ...(integrationSummary.results || []),
    ...(contentThemeSummary.results || [])
  ];

  const totalAssertions = allResults.length;
  const passedAssertions = allResults.filter(r => r.passed).length;
  const failedAssertions = totalAssertions - passedAssertions;
  const passRate = totalAssertions > 0 ? ((passedAssertions / totalAssertions) * 100).toFixed(1) : '0.0';
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  const tierStats = aggregateByTier(allResults);

  // 4. Print Aggregated Master Summary Table
  console.log('\n======================================================================');
  console.log('                  E2E TEST SUITE AGGREGATED REPORT                    ');
  console.log('======================================================================');
  console.log(`Execution Time: ${duration}s | Total Assertions: ${totalAssertions}\n`);

  console.log('SUITE BREAKDOWN:');
  console.log(`  1. Integration & Webhook Protocol: ${integrationSummary.passed}/${integrationSummary.total} passed (${integrationSummary.failed} failed)`);
  console.log(`  2. Content, Theme & Asset Tokens:  ${contentThemeSummary.passed}/${contentThemeSummary.total} passed (${contentThemeSummary.failed} failed)\n`);

  console.log('4-TIER BREAKDOWN:');
  Object.keys(tierStats).forEach(tierName => {
    const stat = tierStats[tierName];
    const rate = stat.total > 0 ? ((stat.passed / stat.total) * 100).toFixed(1) : '0.0';
    const status = stat.failed === 0 ? 'PASS' : (stat.passed === stat.total ? 'PASS' : 'WARN');
    console.log(`  - [${status}] ${tierName.padEnd(35)} : ${stat.passed}/${stat.total} (${rate}%)`);
  });

  console.log('\n----------------------------------------------------------------------');
  if (failedAssertions === 0) {
    console.log(` OVERALL RESULT: ALL TESTS PASSED (100.0% - ${passedAssertions}/${totalAssertions})`);
    console.log(' Status: READY FOR MILESTONE COMPLETION & DEPLOYMENT');
  } else {
    console.log(` OVERALL RESULT: ${failedAssertions} ASSERTIONS PENDING/FAILED (${passRate}% - ${passedAssertions}/${totalAssertions} passed)`);
    console.log(' Status: MILESTONE IMPLEMENTATION IN PROGRESS');
  }
  console.log('======================================================================\n');

  return {
    totalAssertions,
    passedAssertions,
    failedAssertions,
    passRate,
    duration,
    integrationSummary,
    contentThemeSummary
  };
}

if (require.main === module) {
  runAllTests().then(summary => {
    process.exit(summary.failedAssertions === 0 ? 0 : 1);
  }).catch(err => {
    console.error('Master test runner fatal exception:', err);
    process.exit(1);
  });
}

module.exports = { runAllTests };
