# Deployment Guide - Supabase Migrations

## Różnice między środowiskami

### Development (lokalne)

- RLS **wyłączony** dla łatwiejszego testowania
- Wszystkie migracje są stosowane automatycznie przez `supabase db reset`

### Production

- RLS **włączony** z politykami bezpieczeństwa
- Migracje wyłączające RLS są pomijane

## Migracje specyficzne dla środowiska

### Tylko Development:

- `20260119120000_disable_rls_policies.sql` - usuwa RLS policies
- `20260224000000_disable_rls.sql` - wyłącza RLS

### Wszystkie środowiska:

- `20260119000000_init_schema.sql` - schema + RLS policies
- `20260124000000_update_handle_new_user.sql` - trigger metadata
- `20260221000000_add_get_pending_shelters_fn.sql` - funkcje admin

## Deployment do produkcji

### Opcja 1: Ręczne zastosowanie migracji (zalecane)

```bash
# Link do projektu produkcyjnego
supabase link --project-ref your-project-ref

# Zastosuj tylko migracje produkcyjne (bez disable RLS)
supabase db push \
  --include-migrations \
  "20260119000000_init_schema.sql,20260124000000_update_handle_new_user.sql,20260221000000_add_get_pending_shelters_fn.sql"
```

### Opcja 2: Utworzenie prod-specific migration file

```bash
# Połącz wszystkie migracje produkcyjne w jeden plik
cat supabase/migrations/20260119000000_init_schema.sql \
    supabase/migrations/20260124000000_update_handle_new_user.sql \
    supabase/migrations/20260221000000_add_get_pending_shelters_fn.sql \
    > supabase/production.sql

# Wykonaj w Supabase Dashboard > SQL Editor
```

### Opcja 3: Git-based deployment z ignorowaniem plików

Dodaj do `.gitignore` (tylko dla dev branch):

```
supabase/migrations/*disable*.sql
```

Na branchu produkcyjnym nie commituj migracji dev-only.

## Weryfikacja RLS w produkcji

Po deployment sprawdź czy RLS jest włączony:

```sql
-- Wykonaj w SQL Editor produkcji
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'needs');

-- Oczekiwany wynik: rowsecurity = true dla obu tabel
```

```sql
-- Sprawdź policies
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public';

-- Oczekiwane policies:
-- - anon_select_verified_profiles
-- - auth_select_verified_profiles
-- - auth_select_own_profile
-- - auth_update_own_profile
-- - anon_select_needs
-- - auth_select_needs
-- - auth_insert_own_needs
-- - auth_update_own_needs
```

## Troubleshooting

### Problem: RLS zablokował wszystkie zapytania w produkcji

**Przyczyna:** RLS włączony bez policies  
**Rozwiązanie:** Zastosuj `20260119000000_init_schema.sql` która zawiera policies

## CI and Deployment Safety

To prevent accidental application of development-only migrations (which disable RLS), the repository includes the following safeguards:

- A GitHub Action (`.github/workflows/check-dev-migrations.yml`) runs on pull requests to `main` and will fail the check if the PR's diff contains any migration files matching `*disable_rls*.sql`. This prevents merging dev-only migration changes into `main`.

- The production deployment script `scripts/deploy-production.sh` performs local checks and will refuse to proceed if dev-only migration files are present in `supabase/migrations/`. To override locally (not recommended), set the environment variable `ALLOW_DEV_MIGRATIONS=1` or pass the `--force` flag to the script. Use caution — do not use these overrides in CI or production environments.

Checklist before production deploy:

- Ensure no `disable_rls` migrations are present in the PR diff.
- Use `./scripts/deploy-production.sh` which creates a curated production bundle and applies only approved migrations.
- Verify RLS remains enabled after deployment (see "Weryfikacja RLS w produkcji").

### Problem: Nie mogę tworzyć needs w produkcji

**Przyczyna:** User nie ma verified profile  
**Rozwiązanie:** Profil musi mieć `status='verified'` - wymaga zatwierdzenia przez admina

### Problem: Lokalne testy nie działają z RLS

**Przyczyna:** Brak verified profiles  
**Rozwiązanie:** Zastosuj migracje disable RLS lokalnie (`supabase db reset`)
