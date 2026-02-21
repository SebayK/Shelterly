# API Endpoint Implementation Plan: POST /api/ai/generate-shopping-link

## 1. Przegląd punktu końcowego

Endpoint generuje link do wyszukiwania produktów (np. Ceneo.pl) dla konkretnej potrzeby schroniska, wykorzystując model językowy (LLM) przez usługę OpenRouter.ai. Na podstawie tytułu i kategorii potrzeby AI konstruuje optymalny URL wyszukiwania, który jest następnie zapisywany w kolumnie `needs.shopping_url`. Każde wywołanie inkrementuje licznik `ai_usage_count` w tabeli `profiles` (best-effort). Endpoint wymaga autentykacji, weryfikacji własności potrzeby oraz nie może przekroczyć limitów użycia AI i rate limitingu.

---

## 2. Szczegóły żądania

- **Metoda HTTP:** `POST`
- **Struktura URL:** `/api/ai/generate-shopping-link`
- **Nagłówki:**
  - `Authorization: Bearer {access_token}` — wymagany
  - `Content-Type: application/json` — wymagany
- **Parametry:**
  - Wymagane (Request Body):
    - `need_id` — UUID powiązanej potrzeby
    - `title` — tytuł potrzeby (string, 1–200 znaków)
    - `category` — kategoria potrzeby (`food | textiles | cleaning | medical | toys | other`)
  - Opcjonalne: brak

- **Request Body:**
  ```json
  {
    "need_id": "uuid",
    "title": "Karma mokra dla kotów",
    "category": "food"
  }
  ```

---

## 3. Wykorzystywane typy

Wszystkie wymienione typy są już zdefiniowane w `src/types.ts`.

**Command Model (ciało żądania):**
```typescript
// Command 6: POST /api/ai/generate-shopping-link
export interface GenerateShoppingLinkCommand {
  need_id: string;       // UUID
  title: string;
  category: NeedCategory;
}
```

**Response DTO:**
```typescript
// DTO 18: POST /api/ai/generate-shopping-link
export interface AIGenerateShoppingLinkResponseDTO {
  shopping_url: string;
  ai_usage_incremented: boolean;
}
```

**Nowy schemat walidacji Zod** (do dodania w `src/lib/validation/ai.schemas.ts`):
```typescript
export const GenerateShoppingLinkCommandSchema = z.object({
  need_id: z.string().uuid({ message: "need_id must be a valid UUID" }),
  title: z.string().trim().min(1, { message: "title is required" }).max(200, { message: "title is too long" }),
  category: NeedCategoryEnum,
});
```

---

## 4. Szczegóły odpowiedzi

### Sukces — 200 OK
```json
{
  "shopping_url": "https://www.ceneo.pl/search?q=karma+mokra+koty+premium",
  "ai_usage_incremented": true
}
```

`ai_usage_incremented` przyjmuje wartość `false`, gdy inkrementacja `ai_usage_count` nie powiodła się (błąd DB) — jest to operacja best-effort, nie powoduje zwrócenia błędu.

### Kody błędów

| Kod | Sytuacja |
|-----|----------|
| `400 Bad Request` | Nieprawidłowy JSON lub błędy walidacji Zod |
| `401 Unauthorized` | Brak sesji / nieważny token |
| `403 Forbidden` | Wywołujący nie jest właścicielem potrzeby LUB przekroczono limit AI (`ai_usage_count >= USAGE_LIMIT`) |
| `404 Not Found` | Potrzeba nie istnieje lub jest soft-deleted |
| `429 Too Many Requests` | Rate limit per użytkownik przekroczony |
| `500 Internal Server Error` | Błąd bazy danych, timeout OpenRouter lub inna nieoczekiwana awaria |

---

## 5. Przepływ danych

```
[Klient] → POST /api/ai/generate-shopping-link
    │
    ▼
[Middleware] — Hydratuje locals.supabase (src/middleware/index.ts)
    │
    ▼
[API Route] src/pages/api/ai/generate-shopping-link.ts
    │
    ├─ 1. Sprawdzenie locals.supabase (500 jeśli brak)
    ├─ 2. supabase.auth.getUser() → 401 jeśli brak sesji
    ├─ 3. RateLimiter.check(user.id) → 429 jeśli limit przekroczony
    ├─ 4. request.json() → 400 jeśli invalid JSON
    ├─ 5. GenerateShoppingLinkCommandSchema.safeParse() → 400 jeśli błędy
    │
    ▼
[AIService.generateShoppingLink(command, userId)]
    │
    ├─ 6. SELECT needs WHERE id = need_id AND deleted_at IS NULL
    │       → 500 jeśli błąd DB
    │       → 404 jeśli brak rekordu
    │       → 403 jeśli shelter_id ≠ userId
    │
    ├─ 7. SELECT profiles WHERE id = userId (ai_usage_count)
    │       → 500 jeśli błąd DB
    │       → 404 jeśli brak profilu
    │       → 403 jeśli ai_usage_count >= USAGE_LIMIT
    │
    ├─ 8. callOpenRouter(command) — generowanie shopping URL przez LLM
    │       → walidacja: URL musi zaczynać się od "https://"
    │       → 500 przy timeout / pustej odpowiedzi / błędzie HTTP
    │
    ├─ 9. UPDATE needs SET shopping_url = ..., updated_at = now()
    │       WHERE id = need_id AND deleted_at IS NULL
    │       → 500 jeśli błąd zapisu
    │
    └─ 10. UPDATE profiles SET ai_usage_count = ai_usage_count + 1 (best-effort)
            → logErrorWithContext przy błędzie, ai_usage_incremented = false
    │
    ▼
[API Route] → 200 { shopping_url, ai_usage_incremented }
```

---

## 6. Względy bezpieczeństwa

1. **Autentykacja** — każde żądanie musi posiadać ważną sesję Supabase. Sprawdzenie przez `supabase.auth.getUser()` odbywa się przed jakąkolwiek operacją biznesową.

2. **Autoryzacja (własność potrzeby)** — `need.shelter_id` musi być równe `user.id`. Zapobiega to generowaniu linków dla potrzeb innych schronisk.

3. **Limit użycia AI** — `profile.ai_usage_count >= APP_CONFIG.AI.USAGE_LIMIT` blokuje dalsze wywołania i zwraca `403 Forbidden`.

4. **Rate limiting** — niezależny `RateLimiter` per endpoint i user (in-memory, analogiczny do `GENERATE_DESCRIPTION`). Konfiguracja dodawana do `APP_CONFIG.AI.RATE_LIMITING.GENERATE_SHOPPING_LINK`.

5. **Prompt injection** — dane wejściowe (`title`, `category`) są ograniczone przez Zod (max 200 znaków, enum). System prompt jasno definiuje oczekiwany format wyjścia (URL), eliminując ryzyko wycieków danych z kontekstu.

6. **Walidacja wyjścia AI** — zwrócony URL jest walidowany w serwisie (musi zaczynać się od `https://`). Jeżeli walidacja wyjścia zawiedzie, rzucany jest `InternalError`.

7. **Supabase z context.locals** — zgodnie z regułami backendu, `supabase` jest pobierany wyłącznie z `locals`, a nie importowany bezpośrednio.

8. **Soft-delete** — zapytania do tabeli `needs` zawsze zawierają filtr `.is("deleted_at", null)`.

---

## 7. Obsługa błędów

| Sytuacja | Klasa błędu | Kod HTTP |
|----------|-------------|----------|
| Brak `locals.supabase` | — | `500` |
| Błąd `supabase.auth.getUser()` lub brak użytkownika | — | `401` |
| Przekroczony rate limit w pamięci | — | `429` |
| Nieprawidłowy JSON w body | — | `400` |
| Błąd walidacji Zod | — | `400` z `details[]` |
| Błąd DB przy SELECT needs | `InternalError` | `500` |
| Need nie znaleziony / soft-deleted | `NotFoundError` | `404` |
| Nie-właściciel potrzeby | `ForbiddenError` | `403` |
| Błąd DB przy SELECT profile | `InternalError` | `500` |
| Profil nie znaleziony | `NotFoundError` | `404` |
| Limit AI przekroczony | `ForbiddenError` | `403` |
| Błąd/timeout OpenRouter | `InternalError` | `500` |
| Pusta/nieprawidłowa odpowiedź AI | `InternalError` | `500` |
| Błąd DB przy UPDATE needs.shopping_url | `InternalError` | `500` |
| Błąd DB przy UPDATE ai_usage_count | logowanie (best-effort) | `200` (ai_usage_incremented: false) |
| Nieobsłużony wyjątek | — | `500` |

Wszystkie błędy są logowane przez `logErrorWithContext` z pełnym kontekstem (endpoint, user_id, need_id). Sukces jest logowany przez `logSuccess`.

---

## 8. Rozważania dotyczące wydajności

1. **Timeout OpenRouter** — wywołanie AI jest owijane `AbortController` z timeoutem `APP_CONFIG.AI.TIMEOUT_MS` (15 s), analogicznie do `generateNeedDescription`. Zapobiega zawieszeniu żądania.

2. **Minimalne zapytania do DB** — tylko dwa SELECT (needs, profiles) i dwa UPDATE. Brak zbędnych round-tripów.

3. **Best-effort inkrementacja** — nieudana aktualizacja licznika nie blokuje odpowiedzi, jedynie ustawia `ai_usage_incremented: false`. Eliminuje ryzyko straty wyniku AI z powodu pobocznego błędu DB.

4. **Rate limiter in-memory** — lekki, nie wymaga dodatkowego zapytania do DB przy każdym requestcie.

5. **Model AI** — do generowania URL wystarczy mały, szybki model (np. `openai/gpt-4o-mini`). Rozważyć dodanie osobnej konfiguracji `SHOPPING_LINK_MODEL` w `APP_CONFIG.AI`, aby móc niezależnie zoptymalizować koszty.

---

## 9. Etapy wdrożenia

### Krok 1 — Konfiguracja: rate limiter i model AI

W pliku `src/lib/config.ts` dodać:
- `APP_CONFIG.AI.RATE_LIMITING.GENERATE_SHOPPING_LINK` (`windowMs: 60_000`, `maxRequests: 10`)
- (opcjonalnie) `APP_CONFIG.AI.SHOPPING_LINK_MODEL` — jeśli model ma się różnić od `DESCRIPTION_MODEL`

```typescript
GENERATE_SHOPPING_LINK: {
  windowMs: 60 * 1000, // 1 minuta
  maxRequests: 10,
},
```

### Krok 2 — Schemat walidacji Zod

W pliku `src/lib/validation/ai.schemas.ts` dodać `GenerateShoppingLinkCommandSchema`:

```typescript
export const GenerateShoppingLinkCommandSchema = z.object({
  need_id: z.string().uuid({ message: "need_id must be a valid UUID" }),
  title: z.string().trim().min(1, { message: "title is required" }).max(200, { message: "title is too long" }),
  category: NeedCategoryEnum,
});

export type GenerateShoppingLinkCommandInput = z.input<typeof GenerateShoppingLinkCommandSchema>;
export type GenerateShoppingLinkCommandOutput = z.output<typeof GenerateShoppingLinkCommandSchema>;
```

### Krok 3 — Metoda serwisu: `AIService.generateShoppingLink`

W pliku `src/lib/services/ai.service.ts` dodać metodę publiczną `generateShoppingLink` oraz prywatną `callOpenRouterForShoppingLink` / `buildShoppingLinkPrompt`:

```typescript
async generateShoppingLink(
  command: GenerateShoppingLinkCommand,
  userId: string
): Promise<AIGenerateShoppingLinkResponseDTO> {
  // 1. Pobranie potrzeby (weryfikacja istnienia + soft-delete)
  // 2. Weryfikacja własności (shelter_id === userId)
  // 3. Pobranie profilu + sprawdzenie limitu AI
  // 4. Wywołanie OpenRouter → AI generuje URL wyszukiwania
  // 5. Walidacja zwróconego URL (musi zaczynać się od "https://")
  // 6. Zapis shopping_url do needs
  // 7. Best-effort inkrementacja ai_usage_count
  // 8. Zwrot DTO
}
```

**Prompt dla AI** — przykład systemu:
```
Jesteś asystentem pomagającym schroniskom dla zwierząt w Polsce znaleźć produkty online.
Zwróć TYLKO jeden URL (bez żadnego innego tekstu), kierujący do wyników wyszukiwania produktu
na Ceneo.pl lub Allegro.pl dla podanej potrzeby schroniska.
Format URL: https://www.ceneo.pl/search?q=<zakodowane_słowa_kluczowe>
```

**Prompt użytkownika:**
```
Kategoria: {category}
Tytuł potrzeby: {title}
```

**Walidacja wyjścia:**
```typescript
if (!shoppingUrl.startsWith("https://")) {
  throw new InternalError("AI returned an invalid shopping URL");
}
```

### Krok 4 — Plik endpointu API

Utworzyć `src/pages/api/ai/generate-shopping-link.ts` na wzór `generate-description.ts`:

```typescript
import type { APIRoute } from "astro";
import type { AIGenerateShoppingLinkResponseDTO } from "@/types";
import { APP_CONFIG } from "@/lib/config";
import {
  createErrorHttpResponse,
  createValidationErrorResponse,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
  logErrorWithContext,
  logSuccess,
} from "@/lib/errors";
import { RateLimiter } from "@/lib/rate-limiter";
import { AIService } from "@/lib/services/ai.service";
import { GenerateShoppingLinkCommandSchema } from "@/lib/validation/ai.schemas";

export const prerender = false;

const generateShoppingLinkLimiter = new RateLimiter(
  APP_CONFIG.AI.RATE_LIMITING.GENERATE_SHOPPING_LINK
);

export const POST: APIRoute = async ({ request, locals }) => {
  // 1. Sprawdzenie połączenia z DB
  // 2. Autentykacja
  // 3. Rate limiting
  // 4. Parsowanie + walidacja body (Zod)
  // 5. Wywołanie AIService.generateShoppingLink
  // 6. Obsługa błędów (NotFoundError → 404, ForbiddenError → 403, etc.)
  // 7. Zwrot 200 + DTO
};
```

### Krok 5 — Testy jednostkowe serwisu

W pliku `src/lib/services/ai.service.test.ts` dodać testy dla `generateShoppingLink`:

- `returns shopping_url and increments usage on success`
- `throws NotFoundError when need not found`
- `throws ForbiddenError when caller is not the need owner`
- `throws NotFoundError when profile not found`
- `throws ForbiddenError when AI usage limit exceeded`
- `throws InternalError when OpenRouter returns invalid URL`
- `throws InternalError when OpenRouter times out`
- `returns ai_usage_incremented: false when profile update fails`

### Krok 6 — Testy integracyjne endpointu

W pliku `src/pages/api/ai/generate-shopping-link.test.ts` (analogicznie do `generate-description.test.ts`) weryfikować:

- `401` przy braku tokena
- `429` po przekroczeniu rate limitu
- `400` przy błędach walidacji (brak pól, zły UUID, zła kategoria)
- `404` jeśli need nie istnieje
- `403` jeśli user nie jest właścicielem
- `403` jeśli limit AI przekroczony
- `200` z poprawnym `shopping_url` i `ai_usage_incremented: true`
- `200` z `ai_usage_incremented: false` gdy inkrementacja zawiedzie

### Krok 7 — Weryfikacja i linting

Uruchomić linter (`eslint`) i sprawdzić typy TypeScript (`tsc --noEmit`) po wdrożeniu każdego pliku, aby zapewnić zgodność z regułami projektu.
