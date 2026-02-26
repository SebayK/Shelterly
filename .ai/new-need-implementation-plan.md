# API Endpoint Implementation Plan: POST /api/needs

## 1. Przegląd punktu końcowego

Cel: umożliwić zweryfikowanemu schronisku tworzenie nowej potrzeby (need). Endpoint przyjmuje dane potrzeby, waliduje je, tworzy rekord w tabeli `needs` i zwraca pełny obiekt potrzeby z polami systemowymi.

Kluczowe założenia:

- Tworzyć można tylko wtedy, gdy konto/shelter jest uwierzytelnione i zweryfikowane.
- `description` i `shopping_url` są generowane/uzupełniane przez inne procesy (AI) i mogą być NULL w momencie tworzenia.

## 2. Szczegóły żądania

- Metoda HTTP: POST
- Struktura URL: `/api/needs`
- Nagłówki:
  - Wymagane: `Authorization: Bearer {access_token}` (JWT / Supabase access token)

- Parametry:
  - Wymagane (body JSON):
    - `category` (string enum) — np. `food`, `textile` — zgodne z typem DB `need_category`.
    - `title` (string) — niepusty krótki tytuł.
    - `urgency` (string enum) — wartości zgodne z DB `urgency_level`, domyślnie `normal`.
    - `target_quantity` (number) — > 0, precyzja do 2 miejsc (NUMERIC(10,2)).
    - `unit` (string enum) — zgodne z DB `need_unit`.
  - Opcjonalne (body JSON):
    - `description` (string | null)
    - `shopping_url` (string | null)

Przykład body:

```json
{
  "category": "food",
  "title": "Karma sucha dla psów",
  "urgency": "normal",
  "target_quantity": 100.0,
  "unit": "kg"
}
```

## 3. Wykorzystywane typy (DTO / Command)

- CreateNeedCommand
  - `shelterId: string` (UUID, wniosek powinien zdać z kontekstu użytkownika)
  - `category: string`
  - `title: string`
  - `description?: string | null`
  - `shopping_url?: string | null`
  - `urgency?: string` (domyślnie `normal`)
  - `target_quantity: number` (>= 0.01)
  - `unit: string`

- NeedDTO (response)
  - `id, shelter_id, category, title, description, shopping_url, urgency, target_quantity, current_quantity, unit, is_fulfilled, created_at`

## 4. Szczegóły odpowiedzi

- Sukces (201 Created): zwraca pełny obiekt `NeedDTO` (JSON) z ustawionym `id`, `shelter_id`, `current_quantity: 0.0`, `is_fulfilled: false` oraz `created_at` w formacie ISO.
- Błędy: zgodnie z specyfikacją
  - `401 Unauthorized` — brak/nieprawidłowy token
  - `403 Forbidden` — konto niezweryfikowane lub zawieszone
  - `400 Bad Request` — walidacja pola (np. brak wymaganych pól, `target_quantity` <= 0, nieznana wartość enum)
  - `500 Internal Server Error` — błąd serwera / DB / nieoczekiwany wyjątek

Przykład sukcesu:

```json
{
  "id": "uuid",
  "shelter_id": "uuid",
  "category": "food",
  "title": "Karma sucha dla psów",
  "description": null,
  "shopping_url": null,
  "urgency": "normal",
  "target_quantity": 100.0,
  "current_quantity": 0.0,
  "unit": "kg",
  "is_fulfilled": false,
  "created_at": "2026-01-21T10:30:00Z"
}
```

## 5. Przepływ danych

1. Autoryzacja: odczytaj `Authorization` header, weryfikuj token (Supabase / JWT). Uzyskaj `user_id` i powiązany `profile` (shelter) z DB.
2. Autoryzacja dodatkowa: sprawdź, czy `profile.status` jest `verified` (lub inny właściwy status). Jeśli nie — zwróć `403`.
3. Walidacja: waliduj ciało żądania za pomocą Zod (typy, zakresy, enumy).
4. Mapowanie: zmapuj `CreateNeedCommand` i `shelterId` na wpis DB.
5. Persist: utwórz rekord w `needs` (użyć transakcji, upewnić się że constraints są spełnione).
6. Post-processing: zwróć utworzony rekord (po ewentualnym SELECT by pobrać pola defaultowe i timestamptz).
7. Asynchroniczne rozszerzenia: po utworzeniu można odpalić zadania (queuing) do generowania `description` i `shopping_url` przez AI.

Uwagi implementacyjne:

- Używać `supabase` poprzez kontekst (np. `context.locals.supabase`) zgodnie z repozytorium.
- Obsłużyć soft-delete i unikalne ograniczenia (jeżeli istnieją)

## 6. Walidacja danych wejściowych

- Użyć `zod`:
  - `category`: enum oparty na wartościach DB `need_category` (zaktualizować listę w kodzie lub mapować z centralnego źródła).
  - `title`: string.trim().min(3).max(255).
  - `description`: optional string.max(2000).
  - `shopping_url`: optional string.url()
  - `urgency`: enum [`low`,`normal`,`high`,`critical`] (dopasować do DB).
  - `target_quantity`: number().positive().max(99999999.99).pipe(round(2)) — mapować do `NUMERIC(10,2)`.
  - `unit`: enum typu `need_unit`.

Walidacja biznesowa:

- `target_quantity` > 0
- `unit` musi być spośród akceptowanych jednostek

## 7. Rejestrowanie błędów

- W przypadku błędów logicznych i wyjątków zapisywać zdarzenia do istniejącego modułu logów (`src/lib/errors.ts` lub dedykowana tabela `error_logs`) z następującymi danymi: `timestamp`, `user_id`, `shelter_id` (jeśli dostępne), `endpoint`, `request_body` (częściowo - bez danych wrażliwych), `error_message`, `stack_trace`.
- Krytyczne DB errors (np. constraint violation) oznaczyć poziomem `error` i zawrzeć `constraint` w logu.

## 8. Zagrożenia bezpieczeństwa

- Brak/niepoprawne uwierzytelnienie → `401`.
- Uprawnienia: niezweryfikowane konto powinno otrzymać `403`.
- Injection: zabezpieczyć zapytania (używając prepared statements / Supabase client) i walidacji wejścia.
- Overposting: akceptować tylko explicite dozwolone pola (whitelist body).
- Mass-assignment: nie używać bezpośredniego rozpakowywania request body na model DB.
- Rate limiting: rozważyć throttle (np. limiter na endpointy tworzenia) by zapobiec nadużyciom.
- URL sanitization: walidować `shopping_url` i nie wykonywać zapytań do zewnętrznych URL bezpośrednio.
- Logowanie: nie logować tokenów ani danych wrażliwych.

## 9. Scenariusze błędów i kody stanu

- 400 Bad Request
  - brak wymaganych pól
  - `target_quantity` <= 0
  - nieprawidłowy enum
  - nieprawidłowy format URL
- 401 Unauthorized
  - brak nagłówka `Authorization` albo nieprawidłowy token
- 403 Forbidden
  - konto niezweryfikowane / zawieszone
  - użytkownik nie jest właścicielem profilu schroniska (jeżeli dotyczy)
- 404 Not Found
  - powiązany profil/shelter nie istnieje (rzadkie — zwykle 403 używane wcześniej)
- 409 Conflict (opcjonalnie)
  - kolizje unikalne (jeśli istnieją ograniczenia uniemożliwiające duplikaty)
- 500 Internal Server Error
  - niespodziewane wyjątki, DB niedostępne, itp.

## 10. Rozważania dotyczące wydajności

- Operacja tworzenia jest zwykle lekka — główny koszt to zapis do DB.
- Upewnić się, że pola defaultowe i trigger-y nie powodują dodatkowych, kosztownych operacji synchronicznych.
- Dla obciążeń masowych: batch insert lub endpoint async + job queue.

## 11. Kroki implementacji (szczegółowo)

1. Zdefiniować DTO i walidację
   - Plik: [src/lib/validation/needs.schemas.ts](src/lib/validation/needs.schemas.ts) (lub zaktualizować istniejący)
   - Zod schema `createNeedSchema` (opisane powyżej)

2. Dodać/rozszerzyć service
   - Plik: [src/lib/services/needs.service.ts](src/lib/services/needs.service.ts)
   - Funkcja: `createNeed(command: CreateNeedCommand, opts: {supabase, logger}) -> Promise<NeedDTO>`
   - Implementacja: walidacja wejścia już w handlerze; service mapuje i wykonuje insert z kontrolą błędów DB.

3. Zaimplementować handler API
   - Plik: [src/pages/api/needs/index.ts](src/pages/api/needs/index.ts)
   - Kroki:
     - Parsowanie i weryfikacja tokena (użyj istniejącej warstwy auth/middleware).
     - Pobierz `profile` powiązany z user_id; sprawdź `status === 'verified'`.
     - Walidacja body przy pomocy `createNeedSchema`.
     - Wywołaj `needs.service.createNeed(...)`.
     - Zwróć `201` z tym obiektem.
     - Obsłuż błędy walidacji (400), auth (401,403), DB/serwer (500).

4. Logowanie i monitoring
   - Użyć `src/lib/errors.ts` lub `logger` (np. pino/winston) do logowania błędów.
   - Dodać metryki tworzeń (liczniki success/fail) jeśli system monitoringu istnieje.

5. Testy
   - Unit: walidacja Zod, service (mock supabase), handler (mock request/response)
   - Integracja: test wyrzucający prawdziwe zapisy do testowego DB lub użycie Supabase emulatora.

6. Bezpieczeństwo i review
   - Przegląd kodu na podatności (overposting, logowanie poufnych danych).
   - Dodać rate limiting jeśli nie ma.

7. Dokumentacja i deploy
   - Zaktualizować dokumentację API (OpenAPI/README).
   - Dodać migracje jeśli konieczne (np. dodanie default enumów).
   - Commit i PR; przeprowadzić code review.

## 12. Dodatkowe wskazówki implementacyjne

- Używać transakcji przy bardziej złożonych operacjach.
- Utrzymywać listę dozwolonych wartości enum w jednym miejscu (konfiguracja lub typy DB -> synchronizacja przy deployu).
- Wstrzykiwać `supabase` i `logger` zamiast ich globalnego importu, dla łatwiejszego testowania.

---

Plik ten jest przewodnikiem operacyjnym — szczegółowe fragmenty kodu (schematy Zod, service, handler) mogą być dostarczone na życzenie.
