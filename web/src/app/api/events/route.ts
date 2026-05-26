import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { logger } from '@/lib/security/logger';

export const dynamic = 'force-dynamic';

const EVENT_NAME_PATTERN = /^[a-z0-9_]{1,80}$/;
const MAX_PROPERTY_KEYS = 30;
const MAX_STRING_VALUE_LENGTH = 500;

type EventPropertyValue = string | number | boolean | null;

function sanitizeProperties(value: unknown): Record<string, EventPropertyValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_PROPERTY_KEYS);
  const output: Record<string, EventPropertyValue> = {};

  for (const [rawKey, rawValue] of entries) {
    const key = rawKey.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 60);
    if (!key) continue;

    if (typeof rawValue === 'string') {
      output[key] = rawValue.slice(0, MAX_STRING_VALUE_LENGTH);
    } else if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      output[key] = rawValue;
    } else if (typeof rawValue === 'boolean' || rawValue === null) {
      output[key] = rawValue;
    }
  }

  return output;
}

function getSupabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('[events] SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

async function getAuthenticatedUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Route handlers can ignore cookie set failures here.
          }
        },
      },
    }
  );

  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as {
      eventName?: unknown;
      properties?: unknown;
      path?: unknown;
    } | null;

    const eventName = typeof body?.eventName === 'string' ? body.eventName : '';
    if (!EVENT_NAME_PATTERN.test(eventName)) {
      return NextResponse.json({ error: 'Invalid event name' }, { status: 400 });
    }

    const userId = await getAuthenticatedUserId();
    const path = typeof body?.path === 'string' ? body.path.slice(0, 300) : null;
    const properties = sanitizeProperties(body?.properties);

    const { error } = await getSupabaseAdmin()
      .from('app_events')
      .insert({
        user_id: userId,
        event_name: eventName,
        properties,
        path,
      });

    if (error) {
      logger.warn('[events] Failed to insert app event:', error);
      return NextResponse.json({ stored: false }, { status: 202 });
    }

    return NextResponse.json({ stored: true });
  } catch (error) {
    logger.warn('[events] Event ingestion failed:', error);
    return NextResponse.json({ stored: false }, { status: 202 });
  }
}
