/**
 * @qrypto/e2e-suite — WalletPage
 * Last updated: 2024-01-15
 */

import { type Page, expect } from '@playwright/test';

import { BasePage } from './BasePage.js';

export class WalletPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ─── Balance Locators ─────────────────────────────────────────────────────

  balanceCard(currency: string) {
    return this.page.getByTestId(`balance-row-${currency}`);
  }

  balanceAvailable(currency: string) {
    return this.page.getByTestId(`balance-available-${currency}`);
  }

  // ─── Withdrawal Form Locators ─────────────────────────────────────────────

  get withdrawCurrencySelect() {
    return this.page.getByTestId('withdraw-currency');
  }

  get withdrawAmountInput() {
    return this.page.getByTestId('withdraw-amount');
  }

  get withdrawAddressInput() {
    return this.page.getByTestId('withdraw-address');
  }

  get withdraw2faInput() {
    return this.page.getByTestId('withdraw-2fa-code');
  }

  get withdrawSubmitButton() {
    return this.page.getByTestId('withdraw-submit');
  }

  get withdrawErrorMessage() {
    return this.page.getByTestId('withdraw-error');
  }

  get withdrawSuccessMessage() {
    return this.page.getByTestId('withdraw-success');
  }

  // ─── Deposit Locators ─────────────────────────────────────────────────────

  get depositAddressDisplay() {
    return this.page.getByTestId('deposit-address');
  }

  get depositGetAddressButton() {
    return this.page.getByTestId('deposit-get-address');
  }

  // ─── Actions ─────────────────────────────────────────────────────────────

  override async goto(): Promise<void> {
    await this.navigateTo('wallet');
    await this.page.getByTestId('wallet-tab-balances').waitFor({ state: 'visible' });
    await this.waitForLoad();
  }

  async fillWithdrawalForm(params: {
    currency?: string;
    amount: string;
    address: string;
    twoFactorCode?: string;
  }): Promise<void> {
    await this.goToWithdrawTab();
    if (params.currency) {
      await this.withdrawCurrencySelect.selectOption(params.currency);
    }
    await this.withdrawAmountInput.fill(params.amount);
    await this.withdrawAddressInput.fill(params.address);
    await this.withdraw2faInput.fill(params.twoFactorCode ?? '123456');
  }

  async submitWithdrawal(): Promise<void> {
    await this.withdrawSubmitButton.click();
    await this.waitForLoad();
  }

  async getDepositAddress(): Promise<void> {
    await this.goToDepositTab();
    await this.depositGetAddressButton.click();
    await this.waitForLoad();
  }

  async goToWithdrawTab(): Promise<void> {
    await this.page.getByTestId('wallet-tab-withdraw').click();
    await this.page.waitForTimeout(300);
  }

  async goToDepositTab(): Promise<void> {
    await this.page.getByTestId('wallet-tab-deposit').click();
    await this.page.waitForTimeout(300);
  }

  // ─── Assertions ────────────────────────────────────────────────────────────

  async expectBalanceVisible(currency: string): Promise<void> {
    await expect(this.balanceCard(currency)).toBeVisible();
  }

  async expectWithdrawalError(text?: string): Promise<void> {
    await expect(this.withdrawErrorMessage).toBeVisible();
    if (text) await expect(this.withdrawErrorMessage).toContainText(text, { ignoreCase: true });
  }

  async expectWithdrawalSuccess(): Promise<void> {
    await expect(this.withdrawSuccessMessage).toBeVisible();
  }

  async expectDepositAddressVisible(): Promise<void> {
    await expect(this.depositAddressDisplay).toBeVisible();
  }
}
