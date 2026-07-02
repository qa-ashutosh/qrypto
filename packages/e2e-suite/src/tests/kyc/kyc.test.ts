/**
 * @qrypto/e2e-suite — KYC Tests
 *
 * Tests KYC UI surface — status rendering, submission flow,
 * rejection message display. API correctness is api-suite's job.
 *
 * Last updated: 2024-01-15
 */

import { test, expect } from '@playwright/test';

import { SEED_USERS, loginViaUI, resetMockServer } from '../../fixtures/index.js';
import { KycPage } from '../../pages/index.js';

test.describe('KYC — Status Display', () => {
  test.beforeEach(async () => {
    await resetMockServer();
  });

  test('approved user sees approved status @smoke', async ({ page }) => {
    await loginViaUI(page, SEED_USERS.VERIFIED);

    const kycPage = new KycPage(page);
    await kycPage.goto();

    await kycPage.expectStatus('approved');
    // Submit button hidden — already approved
    await kycPage.expectSubmitHidden();
  });

  test('unverified user sees unverified status and submit button @smoke', async ({ page }) => {
    await loginViaUI(page, SEED_USERS.UNVERIFIED);

    const kycPage = new KycPage(page);
    await kycPage.goto();

    await kycPage.expectStatus('unverified');
    await kycPage.expectSubmitVisible();
  });

  test('pending user sees pending status', async ({ page }) => {
    await loginViaUI(page, SEED_USERS.KYC_PENDING);

    const kycPage = new KycPage(page);
    await kycPage.goto();

    await kycPage.expectStatus('pending');
    // Cannot re-submit while pending
    await kycPage.expectSubmitHidden();
  });

  test('rejected user sees rejected status and can re-submit', async ({ page }) => {
    await loginViaUI(page, SEED_USERS.KYC_REJECTED);

    const kycPage = new KycPage(page);
    await kycPage.goto();

    await kycPage.expectStatus('rejected');
    await kycPage.expectSubmitVisible();
  });
});

test.describe('KYC — Document Submission Flow', () => {
  test.beforeEach(async () => {
    await resetMockServer();
  });

  test('unverified user can submit KYC documents and status changes to pending @smoke', async ({
    page,
  }) => {
    await loginViaUI(page, SEED_USERS.UNVERIFIED);

    const kycPage = new KycPage(page);
    await kycPage.goto();

    await kycPage.expectStatus('unverified');
    await kycPage.submitKyc('passport');

    // Status transitions to pending after submission
    await kycPage.expectStatus('pending');
  });

  test('document type selector shows all options', async ({ page }) => {
    await loginViaUI(page, SEED_USERS.UNVERIFIED);

    const kycPage = new KycPage(page);
    await kycPage.goto();

    const options = kycPage.documentTypeSelect.locator('option');
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});
