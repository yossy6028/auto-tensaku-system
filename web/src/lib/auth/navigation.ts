const AUTH_REDIRECT_BASE = new URL('https://auth.local');

export function safeAuthNextPath(rawNext: string | null, fallback = '/grading') {
  if (!rawNext?.startsWith('/') || /[\\\u0000-\u001f\u007f]/.test(rawNext)) return fallback;

  try {
    const parsed = new URL(rawNext, AUTH_REDIRECT_BASE);
    if (parsed.origin !== AUTH_REDIRECT_BASE.origin) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function authRedirectURL(path: string, requestOrigin: string) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '');
  const base = new URL(configuredOrigin || requestOrigin);
  return new URL(safeAuthNextPath(path), base).toString();
}
