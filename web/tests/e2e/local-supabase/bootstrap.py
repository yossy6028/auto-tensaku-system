"""Initialize ONLY the empty, dedicated local signup E2E database.

Run from any directory after starting the matching local Supabase project.
No credentials or real account data are required. Existing app tables cause a stop.
"""
from pathlib import Path
import subprocess

PROJECT = 'tascal-signup-e2e-20260917'
CONTAINER = 'supabase_db_' + PROJECT
REPO = Path(__file__).resolve().parents[4]


def sql(text):
    result = subprocess.run(
        ['docker', 'exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d',
         'postgres', '-v', 'ON_ERROR_STOP=1', '-At'],
        input=text, text=True, capture_output=True, check=False,
    )
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


def main():
    # Never target a remote URL, default Supabase project, or populated database.
    if sql('SELECT count(*) FROM auth.users;') != '0':
        raise SystemExit('Refusing bootstrap: auth users already exist.')
    if sql("SELECT to_regclass('public.user_profiles') IS NOT NULL;") != 'f':
        raise SystemExit('Refusing bootstrap: app schema already exists. Use a fresh E2E project.')

    files = [
        'supabase_migration.sql',
        'supabase_migration_stripe.sql',
        'supabase_migration_custom_trial.sql',
        'supabase_migration_email_normalization.sql',
        'supabase_migration_device_limit.sql',
        'supabase_migration_atomic_usage.sql',
        'supabase_migration_trial_usage_info.sql',
        'supabase_migration_remove_trial_time_limit.sql',
        'supabase_migration_fix_subscription_unique.sql',
    ]
    files += [str(path.relative_to(REPO))
              for path in sorted((REPO / 'supabase/migrations').glob('*.sql'))]
    files += ['supabase/migration_stripe_events_status.sql']

    # Apply the historical base schema first, then all canonical migrations.
    # Each file is atomic; a failed bootstrap must be retried on a fresh fixture.
    for filename in files:
        source = (REPO / filename).read_text()
        if filename == 'supabase_migration_custom_trial.sql':
            # The obsolete final NOTICE contains an unescaped %. Its preceding
            # schema is unchanged, and later canonical migrations replace its RPCs.
            source = source.split('-- 完了メッセージ')[0]
        if filename == 'supabase_migration_atomic_usage.sql':
            # Historical base and atomic migration use different OUT signatures.
            source = 'DROP FUNCTION IF EXISTS public.increment_usage(uuid,jsonb);\n' + source
        sql('BEGIN;\n' + source + '\nCOMMIT;')
        print('Applied ' + filename)
    sql("NOTIFY pgrst, 'reload schema';")


if __name__ == '__main__':
    main()
