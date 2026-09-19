import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

const supabaseURL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:55531';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const artifactDir = process.env.TUTORIAL_E2E_ARTIFACT_DIR ??
  resolve(__dirname, '../../../../tutorial-e2e/artifacts');

const OCR_TEXT = '友だちの話が本当か確かめたく、飛行機も見たかったので、みんなですぐ見に行くことにした。';
const EDITED_OCR_TEXT = OCR_TEXT + '（確認済み）';

type EventPayload = {
  eventName?: string;
  properties?: Record<string, unknown>;
};

type StubState = {
  events: EventPayload[];
  ocrCalls: number;
  gradeCalls: number;
  authenticatedOcrCalls: number;
  authenticatedGradeCalls: number;
};

type GradeMode = 'success' | 'empty' | 'error';

function assertLoopback(rawURL: string, label: string) {
  expect(['127.0.0.1', 'localhost', '::1'], `${label} must be loopback-only`).toContain(new URL(rawURL).hostname);
}

assertLoopback(supabaseURL, 'Supabase URL');

function credentials(prefix: string) {
  return {
    displayName: prefix,
    email: `${prefix}-${randomUUID()}@example.test`,
    password: `Aa9!${randomBytes(12).toString('base64url')}`,
  };
}

async function createConfirmedUser(request: APIRequestContext, prefix: string) {
  expect(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY is required').toBeTruthy();
  const account = credentials(prefix);
  const response = await request.post(`${supabaseURL}/auth/v1/admin/users`, {
    headers: {
      apikey: serviceRoleKey!,
      authorization: `Bearer ${serviceRoleKey}`,
    },
    data: {
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: { display_name: prefix },
    },
  });
  expect(response.ok(), `create local user: ${response.status()}`).toBeTruthy();
  return account;
}

async function login(page: Page, account: { displayName: string; email: string; password: string }) {
  await page.goto('/grading');
  await page.getByRole('button', { name: 'ログイン' }).first().click();
  const modal = page.locator('div.fixed.inset-0.z-50');
  await modal.getByLabel('メールアドレス').fill(account.email);
  await modal.getByLabel('パスワード').fill(account.password);
  await modal.locator('form').getByRole('button', { name: 'ログイン' }).click();
  await expect(page.getByRole('button').filter({ hasText: account.displayName }).first()).toBeVisible({ timeout: 20_000 });
  await expect(modal).toBeHidden();
}

async function logout(page: Page, account: { displayName: string }) {
  await page.getByRole('button').filter({ hasText: account.displayName }).first().click();
  await page.getByRole('button', { name: 'ログアウト' }).click();
  await expect(page.getByRole('button', { name: 'ログイン' }).first()).toBeVisible();
}

function gradePayload(label = 'サンプル問5') {
  return {
    status: 'success',
    results: [{
      label,
      status: 'success',
      strictness: 'standard',
      result: {
        grading_result: {
          score: 72,
          recognized_text: EDITED_OCR_TEXT,
          deduction_details: [{
            reason: '話を確かめたい気持ちの説明が短い',
            deduction_percentage: 28,
            advice: '二つの気持ちを結び付けます。',
          }],
          feedback_content: {
            good_point: '飛行機を見たい気持ちを説明できています。',
            improvement_advice: '話が本当か確かめたい気持ちも加えましょう。',
            rewrite_example: '話が本当か確かめたく、飛行機も見たかったので、みんなですぐ見に行くことにした。',
          },
        },
      },
    }],
  };
}

async function installLocalBoundaries(page: Page, gradeModes: GradeMode[] = ['success']) {
  const state: StubState = {
    events: [],
    ocrCalls: 0,
    gradeCalls: 0,
    authenticatedOcrCalls: 0,
    authenticatedGradeCalls: 0,
  };
  let gradeIndex = 0;

  await page.route('https://www.googletagmanager.com/**', (route) => route.abort());
  await page.route('**/api/events', async (route) => {
    try {
      const body = route.request().postData();
      if (body) state.events.push(JSON.parse(body) as EventPayload);
    } catch {
      // Invalid analytics input is irrelevant to the guided flow assertion.
    }
    await route.fulfill({ status: 204, body: '' });
  });
  await page.route('**/api/ocr', async (route) => {
    state.ocrCalls += 1;
    if ((await route.request().allHeaders()).cookie?.includes('sb-')) state.authenticatedOcrCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'success', ocrResult: { text: OCR_TEXT, charCount: OCR_TEXT.length } }),
    });
  });
  await page.route('**/api/grade', async (route) => {
    state.gradeCalls += 1;
    if ((await route.request().allHeaders()).cookie?.includes('sb-')) state.authenticatedGradeCalls += 1;
    const requestBody = route.request().postDataBuffer()?.toString('utf8') ?? '';
    const label = requestBody.includes('サンプル問5') ? 'サンプル問5' : '問1';
    const mode = gradeModes[Math.min(gradeIndex, gradeModes.length - 1)];
    gradeIndex += 1;
    if (mode === 'empty') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', results: [] }) });
      return;
    }
    if (mode === 'error') {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ status: 'error', message: '合成した採点失敗' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(gradePayload(label)) });
  });
  return state;
}

async function screenshot390(page: Page, name: string) {
  mkdirSync(artifactDir, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: resolve(artifactDir, name), fullPage: true });
}

async function expectInViewport(page: Page, selector: string) {
  await expect.poll(async () => page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  })).toBeTruthy();
}

async function reachConfirm(page: Page) {
  await page.getByRole('button', { name: 'サンプルで体験を始める' }).click();
  await expect(page.getByRole('heading', { name: 'サンプル問5・10点' })).toBeVisible();
  await page.getByRole('button', { name: 'この問題の文字を読み取る' }).click();
  await expect(page.getByRole('heading', { name: '読み取り結果を確認', exact: true })).toBeVisible();
  const textarea = page.getByPlaceholder('読み取り結果がここに表示されます');
  await expect(textarea).toHaveValue(OCR_TEXT);
  return textarea;
}

test.describe('guided sample tutorial with real local Auth', () => {
  test('success path shows real result guidance and produces 390px evidence', async ({ page, request }) => {
    const account = await createConfirmedUser(request, 'tutorial-success');
    const state = await installLocalBoundaries(page);
    await login(page, account);
    await expect(page.getByRole('heading', { name: '資料なしで使い方を体験' })).toBeVisible();

    await screenshot390(page, '01-intro-390.png');
    await page.getByRole('button', { name: 'サンプルで体験を始める' }).click();
    await expect(page.getByRole('heading', { name: 'サンプル問5・10点' })).toBeVisible();
    await screenshot390(page, '02-select-390.png');

    await page.getByRole('button', { name: 'この問題の文字を読み取る' }).click();
    await expect(page.getByRole('heading', { name: '読み取り結果を確認', exact: true })).toBeVisible();
    const textarea = page.getByPlaceholder('読み取り結果がここに表示されます');
    await expect(textarea).toHaveValue(OCR_TEXT);
    await textarea.fill(EDITED_OCR_TEXT);
    await screenshot390(page, '03-confirm-390.png');
    await expectInViewport(page, '#tutorial-guide-confirm');
    await expectInViewport(page, '#tutorial-confirm');

    await page.getByRole('button', { name: '採点を開始' }).click();
    await expect(page.getByRole('heading', { name: '点数を見る' })).toBeVisible();
    await expect(page.locator('#grading-results span').filter({ hasText: /^72$/ }).last()).toBeVisible();
    await screenshot390(page, '04-results-390.png');
    await expectInViewport(page, '#tutorial-guide-score');
    await expectInViewport(page, '#tutorial-score');
    await page.screenshot({ path: resolve(artifactDir, '05-score-guide-and-result-viewport-390.png') });
    expect(state.ocrCalls).toBe(1);
    expect(state.gradeCalls).toBe(1);
    expect(state.authenticatedOcrCalls).toBe(1);
    expect(state.authenticatedGradeCalls).toBe(1);
    expect(state.events.some((event) => event.eventName === 'own_answer_grading_completed')).toBeFalsy();

    await page.getByRole('button', { name: '次へ' }).click();
    await expect(page.getByRole('heading', { name: '減点理由を確認' })).toBeVisible();
    await expect(page.locator('#tutorial-deductions').getByText('話を確かめたい気持ちの説明が短い')).toBeVisible();
    await page.getByRole('button', { name: '次へ' }).click();
    await expect(page.getByRole('heading', { name: '書き直しを見る' })).toBeVisible();
    await expect(page.locator('#tutorial-rewrite').getByText(/話が本当か確かめたく/).first()).toBeVisible();
    await page.getByRole('button', { name: '次へ' }).click();
    await expect(page.getByRole('heading', { name: '使い方の体験が完了しました' })).toBeVisible();
    await expect.poll(() => state.events.some((event) => event.eventName === 'tutorial_completed')).toBeTruthy();
  });

  test('skip, reload and account switching resume only the matching account without refetching grade', async ({ page, request }) => {
    const first = await createConfirmedUser(request, 'tutorial-resume-a');
    const second = await createConfirmedUser(request, 'tutorial-resume-b');
    const state = await installLocalBoundaries(page);
    await login(page, first);
    await expect(page.getByRole('heading', { name: '資料なしで使い方を体験' })).toBeVisible();

    await page.getByRole('button', { name: 'サンプルで体験を始める' }).click();
    await page.getByRole('button', { name: 'あとで続ける' }).click();
    await expect(page.getByRole('heading', { name: 'チュートリアルを再開' })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'チュートリアルを再開' }).click();
    await expect(page.getByRole('heading', { name: 'サンプル問5・10点' })).toBeVisible();

    await page.getByRole('button', { name: 'この問題の文字を読み取る' }).click();
    await expect(page.getByPlaceholder('読み取り結果がここに表示されます')).toHaveValue(OCR_TEXT);
    await page.reload();
    await expect(page.getByRole('heading', { name: '読み取り結果を確認', exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('読み取り結果がここに表示されます')).toHaveValue(OCR_TEXT);
    await page.getByRole('button', { name: '採点を開始' }).click();
    await expect(page.getByRole('heading', { name: '点数を見る' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: '点数を見る' })).toBeVisible();
    expect(state.ocrCalls).toBe(1);
    expect(state.gradeCalls).toBe(1);

    await logout(page, first);
    await login(page, second);
    await expect(page.getByRole('heading', { name: '資料なしで使い方を体験' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '点数を見る' })).toHaveCount(0);
    await logout(page, second);
    await login(page, first);
    await expect(page.getByRole('heading', { name: '点数を見る' })).toBeVisible();
    expect(state.gradeCalls).toBe(1);
  });

  test('empty and failed grades preserve confirmed OCR and never complete until a valid retry', async ({ page, request }) => {
    const account = await createConfirmedUser(request, 'tutorial-retry');
    const state = await installLocalBoundaries(page, ['empty', 'error', 'success']);
    await login(page, account);
    await expect(page.getByRole('heading', { name: '資料なしで使い方を体験' })).toBeVisible();
    const textarea = await reachConfirm(page);
    await textarea.fill(EDITED_OCR_TEXT);

    await page.getByRole('button', { name: '採点を開始' }).click();
    await expect(page.getByText(/採点結果を最後まで取得できませんでした/).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: '使い方の体験が完了しました' })).toHaveCount(0);
    await expect(page.getByPlaceholder('読み取り結果がここに表示されます')).toHaveValue(EDITED_OCR_TEXT);

    await page.getByRole('button', { name: '採点を開始' }).click();
    await expect(page.getByText('合成した採点失敗').first()).toBeVisible();
    await expect(page.getByPlaceholder('読み取り結果がここに表示されます')).toHaveValue(EDITED_OCR_TEXT);
    expect(state.events.some((event) => event.eventName === 'tutorial_completed')).toBeFalsy();

    await page.getByRole('button', { name: '採点を開始' }).click();
    await expect(page.getByRole('heading', { name: '点数を見る' })).toBeVisible();
    expect(state.ocrCalls).toBe(1);
    expect(state.gradeCalls).toBe(3);
  });

  test('own upload is preserved and only a successful own grade emits the own-answer event', async ({ page, request }) => {
    const account = await createConfirmedUser(request, 'tutorial-own');
    const state = await installLocalBoundaries(page);
    await login(page, account);
    await expect(page.getByRole('heading', { name: '資料なしで使い方を体験' })).toBeVisible();
    const fileInput = page.locator('#file-upload');
    await fileInput.setInputFiles({
      name: 'own-answer.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
    });
    await expect(page.getByText('own-answer.png')).toBeVisible();
    await expect(page.getByRole('button', { name: 'サンプルで体験を始める' })).toBeDisabled();
    await expect(page.getByText('入力中の答案があります。現在の作業を終えてから体験できます。')).toBeVisible();

    await page.getByRole('button', { name: '3 読み取りを開始する' }).click();
    await expect(page.getByPlaceholder('読み取り結果がここに表示されます')).toHaveValue(OCR_TEXT);
    await page.getByRole('button', { name: '採点を開始' }).click();
    await expect(page.locator('#grading-results span').filter({ hasText: /^72$/ }).last()).toBeVisible();
    await expect.poll(() => state.events.filter((event) => event.eventName === 'own_answer_grading_completed').length).toBe(1);
    expect(state.events.some((event) => event.eventName === 'tutorial_completed')).toBeFalsy();
    await expect(page.getByText('sample-handwritten.png')).toHaveCount(0);
  });
});
