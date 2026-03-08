# Lokalny `super_admin` do testów `/admin`

Poniżej najkrótsza ścieżka, która działa z obecną architekturą projektu.

## Wariant zalecany

1. Uruchom lokalne Supabase:

```bash
npx supabase start
```

2. Utwórz zwykłe konto przez aplikację albo endpoint rejestracji.
   Najprościej użyć lokalnego formularza `/auth/register` i założyć konto z adresem:

```text
admin@shelterly.dev
```

Hasło używane w kolekcji Postmana:

```text
Admin123!
```

3. Po utworzeniu konta podnieś je do `super_admin` w SQL Editorze Supabase Studio albo przez `psql`:

```sql
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id
  FROM auth.users
  WHERE email = 'admin@shelterly.dev';

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'User admin@shelterly.dev not found in auth.users';
  END IF;

  UPDATE public.profiles
  SET
    role = 'super_admin',
    status = 'verified',
    name = 'System Administrator',
    city = 'Warsaw',
    address = 'Admin Office',
    updated_at = NOW()
  WHERE id = admin_id;
END $$;
```

4. Zaloguj się tym kontem i przejdź do `/admin`.

## Weryfikacja

- Wejście na `/admin` po zalogowaniu powinno otworzyć panel administracyjny.
- W menu avatara powinien być widoczny link `Panel admina`.
- W shared navigation powinien być widoczny admin entry point na desktopie i mobile.

## Skąd biorą się te dane

- Kolekcja Postmana zawiera lokalne dane logowania `admin@shelterly.dev` / `Admin123!`.
- `supabase/seed.sql` zawiera już logikę upgrade'u użytkownika do `super_admin`, ale działa tylko wtedy, gdy użytkownik istnieje wcześniej w `auth.users`.

## Uwaga

- Komentarz w `supabase/seed.sql` sugerował wcześniej `UPDATE profiles ... WHERE email = ...`, ale `public.profiles` nie ma kolumny `email`. Poprawna ścieżka zawsze idzie przez `auth.users.id`.
