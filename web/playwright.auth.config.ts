import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envFile = process.env.AUTH_E2E_ENV_FILE;
if (envFile) {
  const runtimeEnv = JSON.parse(readFileSync(resolve(envFile), 'utf8')) as Record<string, string>;
  for (const key of [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_APP_URL',
  ]) {
    if (runtimeEnv[key]) process.env[key] = runtimeEnv[key];
  }
  if (runtimeEnv.MAILPIT_URL) process.env.AUTH_E2E_MAILBOX_URL = runtimeEnv.MAILPIT_URL;
}

const baseURL = process.env.AUTH_E2E_BASE_URL ?? 'http://127.0.0.1:3218';

function requireLoopback(rawURL: string, label: string) {
  const hostname = new URL(rawURL).hostname;
  if (hostname !== '127.0.0.1' && hostname !== 'localhost' && hostname !== '::1') {
    throw new Error(`${label} must use a loopback URL for auth E2E`);
  }
}

requireLoopback(baseURL, 'AUTH_E2E_BASE_URL');
requireLoopback(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:55431', 'NEXT_PUBLIC_SUPABASE_URL');
requireLoopback(process.env.AUTH_E2E_MAILBOX_URL ?? 'http://127.0.0.1:55434', 'AUTH_E2E_MAILBOX_URL');

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'auth-real.spec.ts',
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-auth-local',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
});
