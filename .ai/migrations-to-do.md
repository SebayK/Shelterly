# Migrations — plan naprawczy

## Aktualny stan (problem)

Historia migracji zawiera dwie migracje oznaczone jako "DEVELOPMENT ONLY", które mimo to wejdą na produkcję przy `supabase db push`:

| Migracja                                                 | Co robi                               | Problem                               |
| -------------------------------------------------------- | ------------------------------------- | ------------------------------------- |
| `20260119000000_init_schema.sql`                         | Tworzy schema + poprawne polityki RLS | OK — bazowa migracja                  |
| `20260119120000_disable_rls_policies.sql`                | Usuwa wszystkie polityki RLS          | ⚠️ Dev-only, ale wejdzie na produkcję |
| `20260124000000_update_handle_new_user.sql`              | Aktualizuje trigger                   | OK                                    |
| `20260221000000_add_get_pending_shelters_fn.sql`         | Dodaje RPC dla admina                 | OK                                    |
| `20260224000000_disable_rls.sql`                         | Wyłącza RLS całkowicie                | ⚠️ Dev-only, ale wejdzie na produkcję |
| `20260301000000_update_handle_new_user_full_profile.sql` | Aktualizuje trigger                   | OK                                    |
| `20260302000000_add_nip_required_for_shelter.sql`        | Dodaje constraint NIP                 | OK                                    |
| `20260304000000_create_storage_buckets.sql`              | Tworzy bucket storage                 | OK                                    |
| `20260304000001_create_storage_policies.sql`             | Polityki RLS dla storage              | OK                                    |

**Efekt końcowy na produkcji:** `profiles` i `needs` mają RLS **wyłączone** — każdy zalogowany użytkownik może czytać i modyfikować dane innych.

---

## Co zrobić

### Krok 1 — Nowa migracja: przywrócenie RLS

Stworzyć `20260305000000_restore_rls_policies.sql`, która:

1. Włącza RLS na `profiles` i `needs`
2. Odtwarza wszystkie polityki z `init_schema.sql` (są poprawne, wystarczy je skopiować)

```sql
-- Włącz RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.needs ENABLE ROW LEVEL SECURITY;

-- Profiles: odczyt dla anonimowych (tylko zweryfikowane)
CREATE POLICY "anon_select_verified_profiles" ON public.profiles
  FOR SELECT TO anon USING (status = 'verified');

-- Profiles: odczyt dla zalogowanych (tylko zweryfikowane)
CREATE POLICY "auth_select_verified_profiles" ON public.profiles
  FOR SELECT TO authenticated USING (status = 'verified');

-- Profiles: własny profil (niezależnie od statusu)
CREATE POLICY "auth_select_own_profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

-- Profiles: edycja własnego profilu
CREATE POLICY "auth_update_own_profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Profiles: admin widzi wszystkich
CREATE POLICY "admin_select_all_profiles" ON public.profiles
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Profiles: admin może aktualizować (weryfikacja, zawieszanie)
CREATE POLICY "admin_update_all_profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Needs: odczyt dla anonimowych
CREATE POLICY "anon_select_needs" ON public.needs
  FOR SELECT TO anon USING (
    deleted_at IS NULL AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = needs.shelter_id AND status = 'verified')
  );

-- Needs: odczyt dla zalogowanych
CREATE POLICY "auth_select_needs" ON public.needs
  FOR SELECT TO authenticated USING (
    deleted_at IS NULL AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = needs.shelter_id AND status = 'verified')
  );

-- Needs: wstawianie (tylko zweryfikowane schronisko, własne rekordy)
CREATE POLICY "auth_insert_own_needs" ON public.needs
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = shelter_id AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'verified')
  );

-- Needs: aktualizacja własnych
CREATE POLICY "auth_update_own_needs" ON public.needs
  FOR UPDATE TO authenticated USING (
    auth.uid() = shelter_id AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'verified')
  );
```

### Krok 2 — Seed dla dev zamiast migracji

Wyłączanie RLS dla wygody deweloperskiej przenieść do `supabase/seed.sql` (nie do migracji):

```sql
-- seed.sql (DEVELOPMENT ONLY — nigdy nie trafia na produkcję)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.needs DISABLE ROW LEVEL SECURITY;
```

`seed.sql` jest wykonywany tylko lokalnie przy `supabase db reset` — nigdy przy `supabase db push`.

### Krok 3 — Weryfikacja przed każdym push na produkcję

```bash
# Sprawdź które migracje nie są jeszcze na produkcji
supabase migration list

# Przejrzyj każdą nową migrację ręcznie przed pushem
```

---

## Zasady na przyszłość

1. **Migracje są nieodwracalne i środowisko-agnostyczne** — każda migracja musi być bezpieczna do uruchomienia na produkcji
2. **Dev-only zmiany idą do `seed.sql`** — nie do `migrations/`
3. **Bucket = polityki** — każdy nowy bucket storage musi mieć polityki RLS w tej samej lub kolejnej migracji
4. **Nie wyłączać RLS** — zamiast tego używać klucza `service_role` lokalnie jeśli potrzeba ominąć polityki
5. **Polityki zawsze z `DROP ... IF EXISTS` przed `CREATE`** — bezpieczne przy `db reset`
