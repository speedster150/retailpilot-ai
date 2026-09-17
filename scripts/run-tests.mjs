import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'

const pwd = process.cwd()

// Process isolation worker mode
if (process.argv[2] === '--worker') {
  const targetSuite = process.argv[3]
  if (!targetSuite) {
    console.error('No target suite specified for test worker')
    process.exit(1)
  }

  const require = createRequire(import.meta.url)
  const jitiExport = require('jiti')
  const createJiti = typeof jitiExport === 'function' ? jitiExport : jitiExport.createJiti
  const jiti = createJiti(pwd, {
    alias: {
      '@': pwd,
    },
  })

  try {
    await jiti.import(resolve(pwd, targetSuite))
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

const testSuites = [
  'tests/verify-returns-suite.ts',
  'tests/verify-ui-mobile-pos-suite.ts',
  'tests/verify-api-contract-suite.ts',
  'tests/verify-security-rls-suite.ts',
  'tests/verify-low-stock-suite.ts',
  'tests/verify-dead-stock-suite.ts',
  'tests/verify-ai-mcp-suite.ts',
]

const requestedSuite = process.argv[2]
const suitesToRun = requestedSuite ? [requestedSuite] : testSuites

console.log('==================================================================')
console.log('RETAILPILOT AI — CI/CD AUTOMATED TEST RUNNER')
console.log(`Executing ${suitesToRun.length} test suite(s) with process isolation...`)
console.log('==================================================================\n')

let passedSuites = 0
let failedSuites = 0

for (const suite of suitesToRun) {
  console.log(`\n▶ Starting test suite: ${suite}`)
  const result = spawnSync(
    'node',
    [resolve(pwd, 'scripts/run-tests.mjs'), '--worker', suite],
    {
      cwd: pwd,
      stdio: 'inherit',
      env: process.env,
    }
  )

  if (result.status === 0) {
    passedSuites++
    console.log(`✓ Completed test suite: ${suite}`)
  } else {
    failedSuites++
    console.error(`✗ Test suite failed with exit code ${result.status}: ${suite}`)
  }
}

console.log('\n==================================================================')
console.log(`TEST RUNNER SUMMARY: ${passedSuites} PASSED, ${failedSuites} FAILED out of ${suitesToRun.length} Suites`)
console.log('==================================================================')

if (failedSuites > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
