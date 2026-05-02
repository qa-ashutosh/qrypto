/**
 * @qrypto/api-suite — Global Teardown
 * Last updated: 2024-01-15
 */

export default async function globalTeardown(): Promise<void> {
  // Nothing to tear down — mock server manages its own state
  // State reset happens in globalSetup before the next run
}
