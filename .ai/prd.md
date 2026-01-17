# Product Requirements Document (PRD) – Shelterly (MVP)

| Wersja | 1.0 (MVP) |
| :--- | :--- |
| **Status** | Zatwierdzony do realizacji |
| **Data** | 08.01.2026 |
| **Ostatnia aktualizacja** | Konfiguracja Tech Stack (Astro, Supabase, AI) |

---

## 1. Wstęp

### 1.1. Problem

Schroniska dla zwierząt w Polsce często mają niedobory podstawowych zasobów (karma, koce, środki czystości), a informacje o ich bieżących potrzebach są rozproszone po różnych kanałach (media społecznościowe, strony www, plakaty).  
Darczyńcy, nawet jeśli chcą pomóc, nie mają jednego, prostego miejsca, gdzie mogliby szybko sprawdzić, czego konkretnie potrzebuje najbliższe schronisko i jak najlepiej dopasować swoją pomoc.

### 1.2. Rozwiązanie

Aplikacja webowa agregująca potrzeby zweryfikowanych schronisk na mapie. Umożliwia darczyńcom szybkie sprawdzenie lokalnych potrzeb i przekierowanie do zakupu odpowiednich produktów, a schroniskom – łatwe zarządzanie zbiórkami.

### 1.3. Grupa Docelowa

1. **Darczyńca (Użytkownik anonimowy):** Chce szybko pomóc lokalnie, bez zakładania konta.
2. **Schronisko (Użytkownik zweryfikowany):** Potrzebuje prostego narzędzia do zgłaszania zapotrzebowania.
3. **Super Admin (Wewnętrzny):** Weryfikuje wiarygodność schronisk.

---

## 2. Historie Użytkownika i Funkcjonalności (MVP)

### 2.1. Ścieżka Schroniska (Rejestracja i Zarządzanie)

* **US.1. Rejestracja i Weryfikacja**
  * **Jako** pracownik schroniska, **chcę** zarejestrować swoją placówkę i wgrać dokumenty potwierdzające, **aby** móc oficjalnie zbierać dary.
  * **Kryteria Akceptacji:**
    * Formularz rejestracji (Email, Hasło, Nazwa, Adres, NIP/KRS).
    * Możliwość uploadu dokumentu do bezpiecznego `Supabase Storage`.
    * Po rejestracji konto otrzymuje status `PENDING` i nie ma dostępu do edycji potrzeb.
    * Próba logowania przed weryfikacją wyświetla komunikat o oczekiwaniu.

* **US.2. Zarządzanie Profilem i Potrzebami (CRUD)**
  * **Jako** zweryfikowane schronisko, **chcę** zarządzać listą potrzeb, **aby** darczyńcy wiedzieli, czego nam brakuje.
  * **Kryteria Akceptacji:**
    * Dodawanie potrzeby z polami: Kategoria, Nazwa, Ilość Docelowa, Jednostka.
    * **AI Helper:** Przycisk „Generuj opis”, który tworzy krótki tekst zachęty via OpenRouter.
    * **AI Helper:** Przycisk „Znajdź produkt”, który generuje link do wyszukiwania (np. Ceneo/Google) dla danej rzeczy.
    * Edycja ilości obecnej (aktualizacja paska postępu).
    * Oznaczanie potrzeby jako `ZREALIZOWANA` (archiwizacja).

### 2.2. Ścieżka Darczyńcy (Odkrywanie i Pomoc)

* **US.3. Znajdowanie Schroniska na Mapie**
  * **Jako** darczyńca, **chcę** zobaczyć mapę schronisk w mojej okolicy, **aby** wybrać to, które jest blisko lub najbardziej potrzebuje pomocy.
  * **Kryteria Akceptacji:**
    * Mapa (Leaflet) z klastrowaniem punktów.
    * Filtry: „Wszystkie”, „Tylko pilne potrzeby”.
    * System prosi o lokalizację przeglądarki; w przypadku odmowy pokazuje domyślny widok (cała Polska).
    * **Logika Rekomendacji:** Lista sugerowanych schronisk posortowana wg algorytmu (odległość + pilność).

* **US.4. Przeglądanie Potrzeb i Deklaracja Pomocy**
  * **Jako** darczyńca, **chcę** widzieć konkretne paski postępu zbiórek, **aby** wiedzieć, ile jeszcze brakuje.
  * **Kryteria Akceptacji:**
    * Widok szczegółowy schroniska z danymi kontaktowymi.
    * Karty potrzeb z wizualnym paskiem postępu (np. „5/50 kg karmy”).
    * Kliknięcie „Kup online” przenosi do zewnętrznego sklepu/wyszukiwarki (link z US.2).

### 2.3. Ścieżka Administratora (Bezpieczeństwo)

* **US.5. Moderacja Schronisk**
  * **Jako** Super Admin, **chcę** przeglądać zgłoszenia i dokumenty, **aby** aktywować tylko wiarygodne placówki.
  * **Kryteria Akceptacji:**
    * Admin dostępny tylko z poziomu bazy danych lub prostego panelu (zmiana statusu `PENDING` -> `VERIFIED`).
    * Dostęp do podglądu wgranych dokumentów.

---

## 3. Wymagania Techniczne i Architektura

### 3.1. Frontend (Astro + React)

* **Framework:** Astro 5 (główny szkielet, routing, SEO).
* **Interaktywność:** React 19 (Islands Architecture) dla komponentów dynamicznych:
  * Mapa (React-Leaflet).
  * Panel Admina/Schroniska.
  * Formularze z walidacją.
* **Styling:** Tailwind CSS v4.
* **UI Library:** Shadcn/ui (dla spójności i dostępności).
* **Język:** TypeScript 5.

### 3.2. Backend (Supabase + Serverless Functions)

* **Baza Danych:** PostgreSQL (hostowane na Supabase Cloud - Free Tier).
* **Auth:** Supabase Auth (Email/Password).
* **Storage:** Supabase Storage (Bucket prywatny na dokumenty weryfikacyjne, RLS policy: tylko owner i admin).
* **Logika Biznesowa:** Endpointy API w Astro (Node adapter) lub Edge Functions, łączące się z Supabase.

### 3.3. Integracja AI

* **Provider:** OpenRouter.ai.
* **Zastosowanie:**
  * Generowanie opisów tekstowych (model tani i szybki, np. Llama 3 8b lub GPT-4o-mini).
  * Konstruowanie linków search query (bez scrapowania cen, by uniknąć halucynacji).

### 3.4. Infrastruktura i Deployment

* **Aplikacja (Astro Vercel Adapter):** Hosting Serverless na **Vercel** (rozwiązanie prostsze i darmowe na start MVP).
* **Baza/Auth:** Supabase Cloud.
* **CI/CD:** Vercel Git Integration (automatyczny deploy) + GitHub Actions (testy).
  * Trigger: Push/PR do `main`.
  * Kroki: Install deps -> Lint -> Test -> Automatyczny Deploy na Vercel (Preview/Production).

---

## 4. Model Danych (Uproszczony Schema)

```sql
TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users, -- powiązanie z Supabase Auth
  role TEXT DEFAULT 'shelter', -- 'shelter', 'super_admin'
  status TEXT DEFAULT 'pending', -- 'pending', 'verified'
  name TEXT,
  city TEXT,
  location GEOGRAPHY(Point), -- PostGIS dla mapy
  verification_doc_url TEXT -- ścieżka do prywatnego bucketa
);

TABLE needs (
  id UUID PRIMARY KEY,
  shelter_id UUID REFERENCES profiles(id),
  category TEXT, -- ENUM: 'food', 'textiles', 'cleaning', 'other'
  title TEXT,
  description_ai TEXT, -- wygenerowane przez AI
  shopping_link_ai TEXT, -- wygenerowane przez AI
  target_quantity INTEGER,
  current_quantity INTEGER DEFAULT 0,
  unit TEXT, -- 'szt', 'kg', 'l'
  is_fulfilled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ
);
```

---

## 5. Kryteria Sukcesu i Testy

1. **Weryfikacja Konta:** Scenariusz, w którym nowo zarejestrowane schronisko nie może zarządzać potrzebami do momentu zmiany flagi w bazie przez Admina.
2. **Test Logiki Biznesowej (Unit Test):** Test funkcji `suggestShelterForUser`.
    * *Input:* User(52.2, 21.0), Schroniska[A(52.3, 21.0, pilne), B(50.0, 20.0, małe potrzeby)].
    * *Assert:* Funkcja zwraca Schronisko A jako pierwsze.
3. **CI Pipeline:** Workflow w GitHub Actions musi przechodzić na zielono przy każdym commicie.

---

## 6. Ograniczenia i Ryzyka (Mitigacja)

* **Brak geolokalizacji:** Jeśli użytkownik zablokuje lokalizację -> UI prosi o wybranie miasta lub pokazuje listę ogólnopolską posortowaną wg pilności.
* **Koszty AI:** Użycie limitów (hard limits) na OpenRouter oraz cache'owanie wygenerowanych opisów w bazie danych (pole `description_ai`), aby nie generować ich przy każdym wyświetleniu.
* **Bezpieczeństwo:** Rygorystyczne polityki RLS (Row Level Security) w Supabase – schronisko może edytować TYLKO swoje potrzeby.

---

## 7. Harmonogram Implementacji (Sugestia)

1. **Setup:** Repo, Astro+React install, Supabase project setup.
2. **Database & Auth:** Modele danych, rejestracja, RLS policies.
3. **Backend Logic:** Endpointy CRUD, integracja z OpenRouter.
4. **Frontend Core:** Landing page, Mapa (Leaflet), Widok Schroniska.
5. **Panel Schroniska:** Formularze dodawania potrzeb, weryfikacja.
6. **Admin & Polish:** Seed admina, stylowanie (Tailwind), testy E2E/Unit, CI/CD.
