/**
 * @qrypto/e2e-suite — TradingPage
 * Last updated: 2024-01-15
 */

import { type Page, expect } from '@playwright/test';

import { BasePage } from './BasePage.js';

export class TradingPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ─── Pair Selector ────────────────────────────────────────────────────────

  pairButton(pair: string) {
    return this.page.getByTestId(`pair-${pair.replace('/', '-')}`);
  }

  // ─── Order Form ───────────────────────────────────────────────────────────

  get buyButton() {
    return this.page.getByTestId('side-buy');
  }

  get sellButton() {
    return this.page.getByTestId('side-sell');
  }

  get limitTypeButton() {
    return this.page.getByTestId('type-limit');
  }

  get marketTypeButton() {
    return this.page.getByTestId('type-market');
  }

  get priceInput() {
    return this.page.getByTestId('order-price');
  }

  get quantityInput() {
    return this.page.getByTestId('order-quantity');
  }

  get submitButton() {
    return this.page.getByTestId('order-submit');
  }

  get errorMessage() {
    return this.page.getByTestId('order-error');
  }

  get successMessage() {
    return this.page.getByTestId('order-success');
  }

  // ─── Order Book ───────────────────────────────────────────────────────────

  get tickerChange() {
    return this.page.getByTestId('ticker-change');
  }

  ask(index: number) {
    return this.page.getByTestId(`ask-${index}`);
  }

  bid(index: number) {
    return this.page.getByTestId(`bid-${index}`);
  }

  // ─── Open Orders ─────────────────────────────────────────────────────────

  orderRow(orderId: string) {
    return this.page.getByTestId(`order-row-${orderId}`);
  }

  cancelButton(orderId: string) {
    return this.page.getByTestId(`cancel-${orderId}`);
  }

  // ─── Actions ─────────────────────────────────────────────────────────────

  override async goto(): Promise<void> {
    await this.navigateTo('trading');
    await this.waitForLoad();
  }

  async selectPair(pair: string): Promise<void> {
    await this.pairButton(pair).click();
    await this.page.waitForTimeout(500); // allow ticker to update
  }

  async selectSide(side: 'buy' | 'sell'): Promise<void> {
    if (side === 'buy') {
      await this.buyButton.click();
    } else {
      await this.sellButton.click();
    }
  }

  async selectOrderType(type: 'limit' | 'market'): Promise<void> {
    if (type === 'limit') {
      await this.limitTypeButton.click();
    } else {
      await this.marketTypeButton.click();
    }
  }

  async fillOrderForm(params: {
    side?: 'buy' | 'sell';
    type?: 'limit' | 'market';
    price?: string;
    quantity: string;
  }): Promise<void> {
    if (params.side) await this.selectSide(params.side);
    if (params.type) await this.selectOrderType(params.type);
    if (params.price) await this.priceInput.fill(params.price);
    await this.quantityInput.fill(params.quantity);
  }

  async placeOrder(): Promise<void> {
    await this.submitButton.click();
    await this.waitForLoad();
  }

  async waitForOrderBookUpdate(): Promise<void> {
    // Order book polls every 2s
    await this.page.waitForTimeout(2500);
  }

  // ─── Assertions ───────────────────────────────────────────────────────────

  async expectSuccess(text?: string): Promise<void> {
    await expect(this.successMessage).toBeVisible({ timeout: 10000 });
    if (text) await expect(this.successMessage).toContainText(text, { ignoreCase: true });
  }

  override async expectError(text?: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    if (text) await expect(this.errorMessage).toContainText(text, { ignoreCase: true });
  }

  async expectOrderBookVisible(): Promise<void> {
    await expect(this.ask(0)).toBeVisible();
    await expect(this.bid(0)).toBeVisible();
  }

  async expectTickerVisible(): Promise<void> {
    await expect(this.tickerChange).toBeVisible();
  }

  async expectSubmitEnabled(): Promise<void> {
    await expect(this.submitButton).toBeEnabled();
  }
}
