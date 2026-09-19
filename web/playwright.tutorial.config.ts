import { defineConfig, devices } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const defaultEnvFile = resolve(__dirname, '../../tutorial-e2e/.runtime/runtime-env.json');
const explicitEnvFile = process.env.TUTORIAL_E2E_ENV_FILE;
const envFile = explicitEnvFile ? resolve(explicitEnvFile) : defaultEnvFile;
if (explicitEnvFile && !existsSync(envFile)) {
  throw new Error(`TUTORIAL_E2E_ENV_FILE does not exist: ${envFile}`);
}
const runtimeEnv = existsSync(envFile)
  ? JSON.parse(readFileSync(envFile, 'utf8')) as Record<string, string>
  : {};

for (const key of [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_APP_URL',
]) {
  if (runtimeEnv[key]) process.env[key] = runtimeEnv[key];
}
if (runtimeEnv.MAILPIT_URL) process.env.TUTORIAL_E2E_MAILBOX_URL = runtimeEnv.MAILPIT_URL;

// Standard checkouts may provide these values directly. The sibling runtime file
// is only a convenience for the dedicated local harness used in this task.
for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[key]) {
    throw new Error(`${key} is required for tutorial E2E`);
  }
}

const baseURL = process.env.TUTORIAL_E2E_BASE_URL ?? 'http://127.0.0.1:3228';

function requireLoopback(rawURL: string, label: string) {
  const hostname = new URL(rawURL).hostname;
  if (!['127.0.0.1', 'localhost', '::1'].includes(hostname)) {
    throw new Error(`${label} must use a loopback URL for tutorial E2E`);
  }
}

requireLoopback(baseURL, 'TUTORIAL_E2E_BASE_URL');
requireLoopback(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:55531', 'NEXT_PUBLIC_SUPABASE_URL');
requireLoopback(process.env.TUTORIAL_E2E_MAILBOX_URL ?? 'http://127.0.0.1:55534', 'TUTORIAL_E2E_MAILBOX_URL');

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'tutorial*.ts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: 'test-results/tutorial',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-tutorial-local',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
});
