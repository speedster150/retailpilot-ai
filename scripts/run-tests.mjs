import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const pwd = process.cwd()

const testSuites = [
  'tests/verify-returns-suite.ts',
  'tests/verify-ui-mobile-pos-suite.ts',
  'tests/verify-api-contract-suite.ts',
  'tests/verify-security-rls-suite.ts',
  'tests/verify-low-stock-suite.ts',
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
  const result = spawnSync('node', [resolve(pwd, 'scratch/run-test.mjs'), suite], {
    cwd: pwd,
    stdio: 'inherit',
    env: process.env,
  })

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
