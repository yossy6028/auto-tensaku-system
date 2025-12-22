import crypto from 'crypto';

type Base64Url = string;

export type RegradeTokenPayloadV1 = {
  v: 1;
  sub: string; // user id
  label: string;
  fp: string; // fingerprint
  remaining: number;
  iat: number; // seconds
  exp: number; // seconds
};

type VerifyOk = { ok: true; payload: RegradeTokenPayloadV1 };
type VerifyNg = { ok: false; reason: 'invalid_format' | 'bad_signature' | 'expired' | 'invalid_payload' };

function base64UrlEncode(input: string | Buffer): Base64Url {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecodeToString(input: Base64Url): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (b64.length % 4)) % 4;
  const padded = b64 + '='.repeat(padLen);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function hmacSha256Base64Url(data: string, secret: string): Base64Url {
  return base64UrlEncode(crypto.createHmac('sha256', secret).update(data).digest());
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function createRegradeToken(args: {
  secret: string;
  userId: string;
  label: string;
  fingerprint: string;
  remaining: number;
  ttlSeconds: number;
  now?: Date;
}): string {
  const now = args.now ?? new Date();
  const iat = Math.floor(now.getTime() / 1000);
  const exp = iat + Math.max(1, Math.floor(args.ttlSeconds));

  const header = { alg: 'HS256', typ: 'JWT' } as const;
  const payload: RegradeTokenPayloadV1 = {
    v: 1,
    sub: args.userId,
    label: args.label,
    fp: args.fingerprint,
    remaining: Math.max(0, Math.floor(args.remaining)),
    iat,
    exp,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signatureB64 = hmacSha256Base64Url(signingInput, args.secret);
  return `${signingInput}.${signatureB64}`;
}

export function verifyRegradeToken(args: { secret: string; token: string; now?: Date }): VerifyOk | VerifyNg {
  const parts = args.token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'invalid_format' };

  const [headerB64, payloadB64, signatureB64] = parts;
  if (!headerB64 || !payloadB64 || !signatureB64) return { ok: false, reason: 'invalid_format' };

  const signingInput = `${headerB64}.${payloadB64}`;
  const expectedSig = hmacSha256Base64Url(signingInput, args.secret);
  if (!timingSafeEqual(signatureB64, expectedSig)) return { ok: false, reason: 'bad_signature' };

  let payload: unknown;
  try {
    payload = JSON.parse(base64UrlDecodeToString(payloadB64));
  } catch {
    return { ok: false, reason: 'invalid_payload' };
  }

  if (!payload || typeof payload !== 'object') return { ok: false, reason: 'invalid_payload' };
  const p = payload as Partial<RegradeTokenPayloadV1>;
  if (p.v !== 1) return { ok: false, reason: 'invalid_payload' };
  if (typeof p.sub !== 'string' || typeof p.label !== 'string' || typeof p.fp !== 'string') {
    return { ok: false, reason: 'invalid_payload' };
  }
  if (typeof p.remaining !== 'number' || typeof p.iat !== 'number' || typeof p.exp !== 'number') {
    return { ok: false, reason: 'invalid_payload' };
  }

  const now = args.now ?? new Date();
  const nowSec = Math.floor(now.getTime() / 1000);
  if (nowSec >= p.exp) return { ok: false, reason: 'expired' };

  return { ok: true, payload: p as RegradeTokenPayloadV1 };
}














