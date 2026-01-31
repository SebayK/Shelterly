# Shelterly Database Schema (MVP)

Dokument zawiera ostateczny plan schematu bazy danych PostgreSQL oparty na wymaganiach PRD, notatkach z sesji planowania oraz wybranym stacku technologicznym (Supabase, PostGIS).

## 1. Typy Danych (ENUM)

Zastosowanie natywnych typów wyliczeniowych PostgreSQL dla zamkniętych zbiorów wartości.

| Nazwa typu | Wartości | Opis |
| :--- | :--- | :--- |
| `user_role` | `'shelter'`, `'super_admin'` | Rola użytkownika w systemie. |
| `shelter_status` | `'pending'`, `'verified'`, `'suspended'`, `'rejected'` | Status cyklu życia konta schroniska. |
| `need_category` | `'food'`, `'textiles'`, `'cleaning'`, `'medical'`, `'toys'`, `'other'` | Kategoria zgłaszanej potrzeby. |
| `need_unit` | `'pcs'`, `'kg'`, `'g'`, `'l'`, `'ml'`, `'pack'` | Jednostka miary (mapowane w UI na: szt, kg, g, l, ml, opak). |
| `urgency_level` | `'low'`, `'normal'`, `'high'`, `'urgent'`, `'critical'` | 5-stopniowa skala pilności potrzeby. |

---

## 2. Tabele

### Tabela: `profiles`

This table is managed by Supabase Auth.

Rozszerza tabelę `auth.users` Supabase. Przechowuje profil publiczny schroniska oraz dane wrażliwe (NIP, dokumenty) dostępne tylko dla właściciela i admina.

| Kolumna | Typ Danych | Ograniczenia / Default | Opis |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | **PK**, FK -> `auth.users.id` (ON DELETE CASCADE) | Klucz główny tożsamy z ID użytkownika w Auth. |
| `role` | `user_role` | NOT NULL, DEFAULT `'shelter'` | Rola użytkownika. |
| `status` | `shelter_status` | NOT NULL, DEFAULT `'pending'` | Status weryfikacji. |
| `name` | `TEXT` | NOT NULL | Pełna nazwa schroniska. |
| `nip` | `TEXT` | UNIQUE, CHECK (regex 10 cyfr) | Numer Identyfikacji Podatkowej. |
| `city` | `TEXT` | NOT NULL | Miasto (do wyszukiwania i wyświetlania). |
| `address` | `TEXT` | NOT NULL | Pełny adres ulicy/numeru. |
| `location` | `GEOGRAPHY(Point, 4326)` | NULLABLE | Współrzędne geograficzne (PostGIS). |
| `phone_number` | `TEXT` | NULLABLE | Telefon kontaktowy. |
| `website_url` | `TEXT` | NULLABLE | Strona internetowa schroniska. |
| `verification_doc_path` | `TEXT` | NULLABLE | Ścieżka do pliku w Supabase Storage. |
| `ai_usage_count` | `INTEGER` | NOT NULL, DEFAULT `0` | Licznik wywołań AI (do limitowania kosztów). |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `now()` | Data rejestracji. |
| `updated_at` | `TIMESTAMPTZ` | NULLABLE | Data ostatniej aktualizacji profilu. |

### Tabela: `needs`

Przechowuje listę konkretnych potrzeb zgłoszonych przez schroniska.

| Kolumna | Typ Danych | Ograniczenia / Default | Opis |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | **PK**, DEFAULT `gen_random_uuid()` | Unikalny identyfikator potrzeby. |
| `shelter_id` | `UUID` | NOT NULL, FK -> `profiles.id` (ON DELETE CASCADE) | Powiązanie ze schroniskiem. |
| `category` | `need_category` | NOT NULL | Kategoria (np. karma, tektylia). |
| `title` | `TEXT` | NOT NULL | Krótki tytuł potrzeby (np. "Karma mokra dla kotów"). |
| `description` | `TEXT` | NULLABLE | Opis (generowany przez AI w US.2, edytowalny). |
| `shopping_url` | `TEXT` | NULLABLE | Link do zakupu/wyszukiwania (generowany przez AI). |
| `urgency` | `urgency_level` | NOT NULL, DEFAULT `'normal'` | Poziom pilności. |
| `target_quantity` | `NUMERIC(10,2)` | NOT NULL, CHECK (`> 0`) | Ile potrzeba. |
| `current_quantity` | `NUMERIC(10,2)` | NOT NULL, DEFAULT `0`, CHECK (`>= 0`) | Ile już zebrano. |
| `unit` | `need_unit` | NOT NULL | Jednostka miary. |
| `is_fulfilled` | `BOOLEAN` | NOT NULL, DEFAULT `FALSE` | Flaga zakończenia zbiórki. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `now()` | Data utworzenia. |
| `updated_at` | `TIMESTAMPTZ` | NULLABLE | Data ostatniej edycji. |
| `deleted_at` | `TIMESTAMPTZ` | NULLABLE | Obsługa **Soft Delete**. |

---

## 3. Relacje

* **`profiles` - `needs`**: Relacja **1:N** (Jeden do Wielu).
  * Jeden profil (schronisko) może mieć wiele powiązanych potrzeb.
  * Usunięcie profilu (`DELETE ON CASCADE`) powoduje twarde usunięcie wszystkich jego potrzeb.

---

## 4. Indeksy

Indeksy zostały dobrane pod kątem najczęstszych zapytań (mapa, filtrowanie listy, Dashboard schroniska).

| Tabela | Kolumny | Typ Indeksu | Cel Optymalizacji |
| :--- | :--- | :--- | :--- |
| `profiles` | `location` | **GIST** | Szybkie wyszukiwanie przestrzenne (`ST_DWithin`) dla mapy. |
| `profiles` | `status` | **BTREE** | Filtrowanie tylko zweryfikowanych schronisk. |
| `needs` | `shelter_id` | **BTREE** | Pobieranie potrzeb konkretnego schroniska. |
| `needs` | `created_at` | **BTREE** | Domyślne sortowanie list (najnowsze). |
| `needs` | `urgency` | **BTREE** | Filtrowanie po pilności (np. "Tylko pilne"). |
| `needs` | `is_fulfilled` | **BTREE** | Ukrywanie zrealizowanych potrzeb. |

---

## 5. Row Level Security (RLS) policies

System bezpieczeństwa oparty na modelu: **Publiczny Odczyt / Zapis tylko dla Zweryfikowanych Właścicieli**.

### Tabela `profiles`

1. **SELECT (Public):**
    * Zezwól wszystkim na odczyt pól publicznych (name, city, location, contact).
    * *Uwaga:* W MVP można uprościć do "zezwól na odczyt wszystkiego", chyba że chcemy ukryć `verification_doc_path` (dokumentacja powinna być chroniona na poziomie Storage).
2. **UPDATE (Owner):**
    * Użytkownik może edytować **tylko swój** profil (`auth.uid() = id`).
    * Użytkownik **NIE MOŻE** edytować kolumny `status` ani `role` (wymaga `postgres trigger` lub oddzielnej funkcji admina, ewentualnie kolumny te są wykluczone z polityki UPDATE dla roli authenticated).
3. **INSERT:**
    * Powiązane z triggerem przy rejestracji (`auth.users`), alternatywnie user może utworzyć swój profil, jeśli ID pasuje.

### Tabela `needs`

1. **SELECT (Public):**
    * Widoczne dla wszystkich, jeśli `deleted_at IS NULL`.
2. **INSERT (Verified Owner):**
    * Dozwolone, jeśli:
        * Użytkownik jest zalogowany.
        * `auth.uid() = shelter_id`.
        * Profil użytkownika ma `status = 'verified'`.
3. **UPDATE (Verified Owner):**
    * Dozwolone, jeśli:
        * `auth.uid() = shelter_id`.
        * Profil użytkownika ma `status = 'verified'`.
        * Użytkownik nie modyfikuje `shelter_id`.
4. **DELETE (Owner - Soft):**
    * W interfejsie API odbywa się przez `UPDATE needs SET deleted_at = now()`.
    * Polityka UPDATE obsługuje to uprawnienie.

---

## 6. Uwagi Dodatkowe

1. **Automatyzacja `updated_at`**: Typowa funkcja triggera PostgreSQL (`moddatetime`) zostanie przypięta do obu tabel, aby automatycznie aktualizować timestamp przy zmianach.
2. **Zarządzanie Stanem**: Zgodnie z decyzjami, statusy `pending` oraz `suspended` całkowicie blokują możliwość dodawania i edycji potrzeb przez polityki RLS.
3. **Walidacja NIP**: Zrealizowana przez `CHECK CONSTRAINT` z wyrażeniem regularnym, co zapewnia spójność danych na najniższym poziomie.
4. **Geolocation**: Wykorzystujemy typ `GEOGRAPHY` (a nie `GEOMETRY`) dla dokładniejszych obliczeń odległości w metrach na sferoidzie (Ziemia), co jest kluczowe dla funkcji "Najbliższe schronisko".
