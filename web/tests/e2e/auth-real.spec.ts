import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import { safeAuthNextPath } from '../../src/lib/auth/navigation';

const mailboxURL = process.env.AUTH_E2E_MAILBOX_URL ?? 'http://127.0.0.1:55434';
const supabaseURL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:55431';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function assertLoopback(rawURL: string, label: string) {
  const hostname = new URL(rawURL).hostname;
  expect(['127.0.0.1', 'localhost', '::1'], `${label} must be loopback-only`).toContain(hostname);
}

assertLoopback(mailboxURL, 'mailboxURL');
assertLoopback(supabaseURL, 'supabaseURL');

type MailboxAddress = { Address?: string; address?: string };
type MailboxMessage = {
  ID?: string;
  id?: string;
  To?: MailboxAddress[];
  to?: MailboxAddress[];
  HTML?: string;
  html?: string;
  Text?: string;
  text?: string;
};

function uniqueCredentials(prefix: string) {
  return {
    email: `${prefix}-${randomUUID()}@example.test`,
    password: `Aa9!${randomBytes(12).toString('base64url')}`,
  };
}

async function openAuth(page: Page, mode: 'signup' | 'signin') {
  await page.goto('/grading');
  await page.getByRole('button', {
    name: mode === 'signup' ? '無料で登録して5回試す' : 'ログイン',
  }).click();
  await expect(page.getByRole('heading', { name: mode === 'signup' ? '新規登録' : 'ログイン' })).toBeVisible();
}

async function submitSignup(page: Page, email: string, password: string) {
  const modal = page.locator('div.fixed.inset-0.z-50');
  await modal.getByLabel('メールアドレス').fill(email);
  await modal.getByLabel('パスワード', { exact: true }).fill(password);
  await modal.getByLabel('パスワード（確認）').fill(password);
  await modal.getByRole('button', { name: '登録する' }).click();
}

function messageRecipients(message: MailboxMessage) {
  const recipients = message.To ?? message.to ?? [];
  return recipients.map((recipient) => recipient.Address ?? recipient.address ?? '').filter(Boolean);
}

async function listMessages(request: APIRequestContext): Promise<MailboxMessage[]> {
  const response = await request.get(`${mailboxURL}/api/v1/messages`);
  expect(response.ok(), `mailbox API ${response.status()}`).toBeTruthy();
  const payload = await response.json();
  return Array.isArray(payload) ? payload : (payload.messages ?? payload.Messages ?? []);
}

async function messagesFor(request: APIRequestContext, email: string) {
  return (await listMessages(request)).filter((message) => messageRecipients(message).includes(email));
}

async function confirmationLinkFor(request: APIRequestContext, email: string) {
  await expect.poll(async () => (await messagesFor(request, email)).length, {
    timeout: 20_000,
    message: `confirmation email for ${email}`,
  }).toBeGreaterThan(0);

  const summary = (await messagesFor(request, email))[0];
  const messageId = summary.ID ?? summary.id;
  expect(messageId).toBeTruthy();
  const detailResponse = await request.get(`${mailboxURL}/api/v1/message/${messageId}`);
  expect(detailResponse.ok()).toBeTruthy();
  const detail = await detailResponse.json() as MailboxMessage;
  const body = detail.HTML ?? detail.html ?? detail.Text ?? detail.text ?? '';
  const normalizedBody = body.replaceAll('&amp;', '&');
  const link = normalizedBody.match(/https?:\/\/[^\s"'<>]+(?:type=signup|type%3Dsignup)[^\s"'<>]*/)?.[0];
  expect(link, 'signup confirmation link').toBeTruthy();
  return link!;
}

async function expectAuthenticated(page: Page, email: string) {
  await expect(page.getByText(email.split('@')[0], { exact: true }).first()).toBeVisible({ timeout: 20_000 });
}

async function signOut(page: Page, email: string) {
  await page.getByText(email.split('@')[0], { exact: true }).first().click();
  await page.getByRole('button', { name: 'ログアウト' }).click();
  await expect(page.getByRole('button', { name: '無料で登録して5回試す' })).toBeVisible();
}

async function adminHeaders() {
  expect(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY is required for local auth E2E').toBeTruthy();
  return {
    apikey: serviceRoleKey!,
    authorization: `Bearer ${serviceRoleKey}`,
  };
}

async function findLocalUser(request: APIRequestContext, email: string) {
  const response = await request.get(`${supabaseURL}/auth/v1/admin/users`, {
    headers: await adminHeaders(),
  });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  const users = Array.isArray(payload) ? payload : payload.users;
  const user = users.find((candidate: { email?: string }) => candidate.email === email);
  expect(user, `local auth user ${email}`).toBeTruthy();
  return user as { id: string; email: string };
}

test.describe('real local signup and login', () => {
  test('auth continuation rejects protocol-relative and backslash redirects', () => {
    expect(safeAuthNextPath('//evil.example/path')).toBe('/grading');
    expect(safeAuthNextPath('/\\evil.example/path')).toBe('/grading');
    expect(safeAuthNextPath('/account?tab=security')).toBe('/account?tab=security');
  });

  test('client validation rejects mismatched passwords without sending email', async ({ page, request }) => {
    const credentials = uniqueCredentials('validation');
    const before = (await messagesFor(request, credentials.email)).length;
    await openAuth(page, 'signup');
    await page.getByLabel('メールアドレス').fill(credentials.email);
    await page.getByLabel('パスワード', { exact: true }).fill(credentials.password);
    await page.getByLabel('パスワード（確認）').fill(`${credentials.password}x`);
    await page.getByRole('button', { name: '登録する' }).click();
    await expect(page.getByText('パスワードが一致しません。')).toBeVisible();
    expect((await messagesFor(request, credentials.email)).length).toBe(before);
  });

  test('new signup confirms through the local mailbox and provisions trial and device access', async ({ page, request }) => {
    const credentials = uniqueCredentials('confirmed');
    await openAuth(page, 'signup');
    await submitSignup(page, credentials.email, credentials.password);
    await expect(page.getByText('確認メールを送信しました。メールをご確認ください。')).toBeVisible();

    const confirmationLink = await confirmationLinkFor(request, credentials.email);
    assertLoopback(confirmationLink, 'confirmationLink');
    const profileStatuses: number[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/rest/v1/user_profiles?')) profileStatuses.push(response.status());
    });
    await page.goto(confirmationLink);
    await expect(page).toHaveURL(/\/grading(?:\?|$)/);
    await expectAuthenticated(page, credentials.email);
    await expect(page.getByText(/残り\s*5回/).first()).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => profileStatuses, {
      timeout: 20_000,
      message: 'signed-in browser profile request statuses',
    }).toContain(200);
    expect(profileStatuses).not.toContain(500);
    await page.screenshot({ path: 'auth-e2e-results/signup-confirmed.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'auth-e2e-results/signup-confirmed-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1280, height: 720 });

    const user = await findLocalUser(request, credentials.email);
    const headers = await adminHeaders();
    const profileResponse = await request.get(
      `${supabaseURL}/rest/v1/user_profiles?id=eq.${user.id}&select=free_trial_usage_count`,
      { headers },
    );
    expect(profileResponse.ok()).toBeTruthy();
    expect(await profileResponse.json()).toEqual([{ free_trial_usage_count: 0 }]);

    await expect.poll(async () => {
      const response = await request.get(
        `${supabaseURL}/rest/v1/user_devices?user_id=eq.${user.id}&select=id`,
        { headers },
      );
      return response.ok() ? (await response.json()).length : -1;
    }, { timeout: 20_000 }).toBe(1);

    await signOut(page, credentials.email);
    await openAuth(page, 'signup');
    await submitSignup(page, credentials.email, credentials.password);
    await expect(page.getByText('登録状況をご確認ください。未確認の場合に限り、確認メールが届きます。確認済みの場合はログインしてください。')).toBeVisible();

    const modal = page.locator('div.fixed.inset-0.z-50');
    await modal.getByRole('button', { name: 'ログイン' }).click();
    await modal.getByLabel('メールアドレス').fill(credentials.email);
    await modal.getByLabel('パスワード').fill(`${credentials.password}wrong`);
    await modal.locator('form').getByRole('button', { name: 'ログイン' }).click();
    await expect(page.getByText('メールアドレスまたはパスワードが正しくありません。')).toBeVisible();
    await modal.getByLabel('パスワード').fill(credentials.password);
    await modal.locator('form').getByRole('button', { name: 'ログイン' }).click();
    await expect(page).toHaveURL(/\/grading(?:\?|$)/);
    await expectAuthenticated(page, credentials.email);

    const consumedLinkPage = await page.context().newPage();
    await consumedLinkPage.goto(confirmationLink);
    await expect(consumedLinkPage).toHaveURL(/\/auth\/error\?reason=callback_invalid/);
    await expect(consumedLinkPage.getByText('ログインリンクが無効か、期限が切れています。')).toBeVisible();
    await consumedLinkPage.close();
  });

  test('pending signup can request another confirmation without claiming unconditional delivery', async ({ page, request }) => {
    const credentials = uniqueCredentials('pending');
    await openAuth(page, 'signup');
    await submitSignup(page, credentials.email, credentials.password);
    await expect(page.getByText('確認メールを送信しました。メールをご確認ください。')).toBeVisible();
    const initialCount = (await messagesFor(request, credentials.email)).length;

    await page.reload();
    await openAuth(page, 'signup');
    await submitSignup(page, credentials.email, credentials.password);
    await expect(page.getByText('登録状況をご確認ください。未確認の場合に限り、確認メールが届きます。確認済みの場合はログインしてください。')).toBeVisible();
    await expect.poll(async () => (await messagesFor(request, credentials.email)).length, { timeout: 20_000 }).toBeGreaterThan(initialCount);
  });

  test('invalid confirmation and callback links show a safe recovery page', async ({ page }) => {
    await page.goto('/auth/confirm?token_hash=invalid&type=signup&next=%2Fgrading');
    await expect(page).toHaveURL(/\/auth\/error\?reason=confirmation_invalid/);
    await expect(page.getByRole('heading', { name: '認証リンクを確認できませんでした' })).toBeVisible();
    await expect(page.getByText('リンクが無効か、期限が切れています。')).toBeVisible();

    await page.goto('/auth/callback?code=invalid&next=%2Fgrading');
    await expect(page).toHaveURL(/\/auth\/error\?reason=callback_invalid/);
    await expect(page.getByRole('link', { name: 'ログインに戻る' })).toHaveAttribute('href', '/login');
  });
});
