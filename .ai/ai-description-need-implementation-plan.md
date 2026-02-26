# API Endpoint Implementation Plan: POST /api/ai/generate-description

## 1. Przegląd punktu końcowego

Endpoint generuje opis tekstowy dla konkretnej potrzeby schroniska przy użyciu modelu językowego dostępnego przez OpenRouter.ai. Wynik jest zapisywany do pola `description` w rekordzie potrzeby w bazie danych, a licznik użycia AI dla profilu schroniska (`ai_usage_count`) jest inkrementowany. Endpoint jest chroniony — dostęp mają wyłącznie zalogowani użytkownicy będący właścicielem danej potrzeby i nieprzekraczający ustalonego limitu wywołań AI.

---

## 2. Szczegóły żądania

- **Metoda HTTP:** `POST`
- **Struktura URL:** `/api/ai/generate-description`
- **Nagłówki:**
  - `Authorization: Bearer {access_token}` — wymagany, sesja Supabase
  - `Content-Type: application/json` — wymagany
- **Parametry:**
  - Wymagane (body):
    - `need_id` — UUID identyfikujący potrzebę
    - `category` — enum `NeedCategory` (np. `"food"`)
    - `title` — niepusty ciąg znaków, tytuł potrzeby
    - `target_quantity` — liczba > 0
    - `unit` — enum `NeedUnit` (np. `"kg"`)
  - Opcjonalne: brak
- **Request Body:**

```json
{
  "need_id": "550e8400-e29b-41d4-a716-446655440000",
  "category": "food",
  "title": "Karma mokra dla kotów",
  "target_quantity": 50.0,
  "unit": "kg"
}
```

---

## 3. Wykorzystywane typy

### Command Model (Request Body)

```typescript
// Już zdefiniowany w src/types.ts
export interface GenerateDescriptionCommand {
  need_id: string;
  category: NeedCategory;
  title: string;
  target_quantity: number;
  unit: NeedUnit;
}
```

### DTO (Response)

```typescript
// Już zdefiniowany w src/types.ts
export interface AIGenerateDescriptionResponseDTO {
  description: string;
  ai_usage_incremented: boolean;
}
```

### Zod Schema (do utworzenia w `src/lib/validation/ai.schemas.ts`)

```typescript
import { z } from "zod";
import { NeedCategoryEnum, NeedUnitEnum } from "./needs.schemas"; // re-export enums

export const GenerateDescriptionCommandSchema = z.object({
  need_id: z.string().uuid({ message: "need_id must be a valid UUID" }),
  category: NeedCategoryEnum,
  title: z.string().min(1, { message: "title must not be empty" }).max(200),
  target_quantity: z.number().positive({ message: "target_quantity must be greater than 0" }),
  unit: NeedUnitEnum,
});
```

---

## 4. Szczegóły odpowiedzi

### Success Response (200 OK)

```json
{
  "description": "Pilnie potrzebujemy karmy mokrej dla naszych kotów. Pomóż nam zapewnić im zbilansowane posiłki. Każda puszka się liczy!",
  "ai_usage_incremented": true
}
```

### Error Responses

| Status | Kod błędu             | Przykładowa sytuacja                                         |
| ------ | --------------------- | ------------------------------------------------------------ |
| 400    | `VALIDATION_ERROR`    | Niepoprawny format UUID, brak wymaganych pól                 |
| 401    | `UNAUTHORIZED`        | Brak lub wygasły token sesji                                 |
| 403    | `FORBIDDEN`           | Użytkownik nie jest właścicielem potrzeby lub limit AI wycz. |
| 404    | `NOT_FOUND`           | Potrzeba o podanym `need_id` nie istnieje lub jest usunięta  |
| 429    | `RATE_LIMIT_EXCEEDED` | Zbyt wiele żądań w oknie czasowym (rate limiter)             |
| 500    | `INTERNAL_ERROR`      | Błąd OpenRouter lub błąd zapisu do bazy danych               |

---

## 5. Przepływ danych

```
[Klient] → POST /api/ai/generate-description
    │
    ▼
[Route Handler] src/pages/api/ai/generate-description.ts
    ├─ 1. Walidacja body (Zod) → 400 jeśli nieprawidłowe
    ├─ 2. Odczyt sesji z context.locals.supabase → 401 jeśli brak
    ├─ 3. Rate limiting (RateLimiter, per user_id) → 429 jeśli przekroczony
    │
    ▼
[AIService] src/lib/services/ai.service.ts
    ├─ 4. Pobranie potrzeby z DB (needs WHERE id = need_id AND deleted_at IS NULL)
    │       → 404 jeśli nie istnieje
    ├─ 5. Weryfikacja ownership (need.shelter_id === user profile.id)
    │       → 403 jeśli brak własności
    ├─ 6. Pobranie profilu użytkownika (ai_usage_count)
    ├─ 7. Sprawdzenie limitu AI (ai_usage_count < AI_USAGE_LIMIT)
    │       → 403 jeśli limit wyczerpany
    ├─ 8. Wywołanie OpenRouter.ai (HTTP POST do API)
    │       → 500 jeśli błąd zewnętrzny
    ├─ 9. Aktualizacja need.description w DB
    │       → 500 jeśli błąd zapisu
    ├─ 10. Inkrementacja profile.ai_usage_count
    │       → 500 jeśli błąd (nie rollback — logujemy, opis już zapisany)
    └─ 11. Zwrócenie AIGenerateDescriptionResponseDTO
    │
    ▼
[Klient] ← 200 OK { description, ai_usage_incremented: true }
```

### Prompt dla OpenRouter (przykład)

```
Jesteś asystentem pomagającym schroniskom dla zwierząt w Polsce pisać opisy potrzeb.
Napisz krótki, przekonujący opis po polsku (2-3 zdania) dla następującej potrzeby schroniska:
- Kategoria: {category}
- Tytuł: {title}
- Ilość: {target_quantity} {unit}

Opis powinien być empatyczny, zachęcać do pomocy i skupiać się na dobrostanie zwierząt.
Nie używaj tagów HTML ani markdown. Tylko czysty tekst.
```

---

## 6. Względy bezpieczeństwa

### Uwierzytelnianie i autoryzacja

- Sesja jest pobierana z `context.locals.supabase` (middleware Supabase ustawia `locals.supabase`).
- Wywołanie `supabase.auth.getUser()` weryfikuje token Bearer i zwraca zalogowanego użytkownika.
- Ownership jest weryfikowane przez porównanie `need.shelter_id` z `user.id` — zapobiega to atakowi IDOR (Insecure Direct Object Reference).

### Ochrona przed nadużyciami

- **Rate Limiter (per user):** instancja `RateLimiter` konfigurowana w `APP_CONFIG` (np. 10 req / 60s). Klucz: `user_id`.
- **AI Usage Limit:** `ai_usage_count < AI_USAGE_LIMIT` (konfigurowane w `APP_CONFIG`, np. 100). Gwarantuje, że żadne schronisko nie wyczerpie budżetu AI.
- Oba ograniczenia działają niezależnie; rate limiter jest sprawdzany przed wywołaniem serwisu (szybki fail).

### Zapobieganie prompt injection

- Dane wejściowe (`title`, `category`, `unit`, `target_quantity`) są walidowane Zodem — tylko znane typy enum i string o ograniczonej długości.
- Pola tekstowe (np. `title`) są wstawiane do prompta jako dosłowne cytaty, bez możliwości przełamania struktury dziobów systemowych.
- Nigdy nie wstawiamy do prompta wartości wczytanych z zewnętrznych źródeł, których nie kontrolujemy.

### Logowanie

- Żadne klucze API (OpenRouter), dane osobowe ani zawartość tokenów autoryzacyjnych nie są logowane.
- Używamy `logErrorWithContext` dla błędów (z endpoint, user_id, shelter_id, sanityzowanym body).
- Używamy `logSuccess` po pomyślnym wygenerowaniu (z endpoint, need_id, user_id).
- `request_body` przekazywany do logera NIE zawiera pola tokenu (token jest w nagłówku, nie body).

---

## 7. Obsługa błędów

| Scenariusz                                      | Typ błędu    | Status | Kod                   |
| ----------------------------------------------- | ------------ | ------ | --------------------- |
| Niepoprawne body (zły format UUID, brak pól)    | Walidacja    | 400    | `VALIDATION_ERROR`    |
| Brak lub wygasły token sesji                    | Autentykacja | 401    | `UNAUTHORIZED`        |
| `need.shelter_id !== user.id`                   | Autoryzacja  | 403    | `FORBIDDEN`           |
| `ai_usage_count >= AI_USAGE_LIMIT`              | Autoryzacja  | 403    | `FORBIDDEN`           |
| Need nie istnieje lub `deleted_at IS NOT NULL`  | Zasób        | 404    | `NOT_FOUND`           |
| Zbyt wiele żądań (rate limiter)                 | Throttling   | 429    | `RATE_LIMIT_EXCEEDED` |
| Błąd HTTP od OpenRouter (timeout, 5xx)          | Zewnętrzny   | 500    | `INTERNAL_ERROR`      |
| Błąd zapisu opisu do bazy                       | Baza danych  | 500    | `INTERNAL_ERROR`      |
| Inkrementacja `ai_usage_count` nie powiodła się | Baza danych  | 200\*  | —                     |

> \* Jeśli opis zostanie pomyślnie zapisany, ale inkrementacja `ai_usage_count` nie powiedzie się, zwracamy 200 z `ai_usage_incremented: false` i logujemy błąd. Opis jest wartościowy dla użytkownika — nie cofamy całej operacji.

---

## 8. Rozważania dotyczące wydajności

- **Brak cachowania promptu:** każde wywołanie kieruje zapytanie do OpenRouter. Jeśli to samo `need_id` pojawi się ponownie, i tak zostanie wygenerowany nowy opis (nadpisanie). Można rozważyć sprawdzenie czy `need.description` już istnieje i ewentualne pominięcie wywołania AI — jednak specyfikacja nie wymaga tego w MVP.
- **Timeout dla OpenRouter:** HTTP call powinien mieć ustawiony timeout (np. 15s) by nie blokować serverless handler ponad limit Vercel.
- **Brak transakcji:** operacje DB (update need + increment profile) wykonywane są sekwencyjnie. W razie awarii między nimi może dojść do niespójności (opis zapisany, licznik nie). Akceptowalne dla MVP; dla większej niezawodności można użyć Supabase RPC (database function) zamykającej obie operacje w transakcji.
- **Singleton RateLimiter:** instancja `RateLimiter` jest tworzona jako moduł-singleton (poza klasą serwisu) w `src/lib/config.ts` lub dedykowanym pliku, aby nie resetować stanu przy każdym żądaniu.

---

## 9. Etapy wdrożenia

### Etap 1: Konfiguracja stałych

**Plik do modyfikacji:** `src/lib/config.ts`

Dodać do obiektu `APP_CONFIG`:

```typescript
AI: {
  /** Maximum number of AI generations per shelter (lifetime or monthly, zależy od polityki) */
  USAGE_LIMIT: 100,
  /** OpenRouter model to use for description generation */
  DESCRIPTION_MODEL: "openai/gpt-4o-mini",
  /** System prompt timeout in milliseconds */
  TIMEOUT_MS: 15_000,
  /** Rate limiting for AI endpoints */
  RATE_LIMITING: {
    GENERATE_DESCRIPTION: {
      windowMs: 60 * 1000, // 1 minuta
      maxRequests: 10,      // 10 żądań na minutę per user
    },
  },
},
```

Dodać zmienną środowiskową do `src/env.d.ts`:

```typescript
OPENROUTER_API_KEY: string;
OPENROUTER_BASE_URL?: string; // opcjonalnie, domyślnie https://openrouter.ai/api/v1
```

---

### Etap 2: Zod Schema

**Plik do utworzenia:** `src/lib/validation/ai.schemas.ts`

```typescript
import { z } from "zod";

// Re-use enums from needs schemas or define inline
const NeedCategoryEnum = z.enum(["food", "medicine", "accessories", "cleaning", "bedding", "toys", "other"]);
const NeedUnitEnum = z.enum(["kg", "g", "l", "ml", "pcs", "packs", "boxes", "bags", "other"]);

export const GenerateDescriptionCommandSchema = z.object({
  need_id: z.string().uuid({ message: "need_id must be a valid UUID" }),
  category: NeedCategoryEnum,
  title: z.string().min(1, { message: "title is required" }).max(200, { message: "title is too long" }),
  target_quantity: z.number().positive({ message: "target_quantity must be greater than 0" }),
  unit: NeedUnitEnum,
});

export type GenerateDescriptionCommandInput = z.infer<typeof GenerateDescriptionCommandSchema>;
```

> Uwaga: sprawdzić rzeczywiste wartości enum z `src/db/database.types.ts` i użyć `z.enum([...])` zgodnie z nimi.

---

### Etap 3: AI Service

**Plik do utworzenia:** `src/lib/services/ai.service.ts`

```typescript
import type { SupabaseClient } from "@/db/supabase.client";
import type { AIGenerateDescriptionResponseDTO, GenerateDescriptionCommand } from "@/types";
import { NotFoundError, ForbiddenError, InternalError } from "@/lib/errors";
import { APP_CONFIG } from "@/lib/config";

export class AIService {
  constructor(private readonly supabase: SupabaseClient) {}

  async generateNeedDescription(
    command: GenerateDescriptionCommand,
    userId: string
  ): Promise<AIGenerateDescriptionResponseDTO> {
    // 1. Pobranie potrzeby z DB
    const { data: need, error: needError } = await this.supabase
      .from("needs")
      .select("id, shelter_id, title, category, target_quantity, unit")
      .eq("id", command.need_id)
      .is("deleted_at", null)
      .single();

    if (needError || !need) throw new NotFoundError("Need not found");

    // 2. Weryfikacja ownership
    if (need.shelter_id !== userId) {
      throw new ForbiddenError("You are not the owner of this need");
    }

    // 3. Sprawdzenie limitu AI
    const { data: profile, error: profileError } = await this.supabase
      .from("profiles")
      .select("ai_usage_count")
      .eq("id", userId)
      .single();

    if (profileError || !profile) throw new InternalError("Could not fetch profile");

    if (profile.ai_usage_count >= APP_CONFIG.AI.USAGE_LIMIT) {
      throw new ForbiddenError("AI usage limit exceeded");
    }

    // 4. Wywołanie OpenRouter
    const description = await this.callOpenRouter(command);

    // 5. Zapis opisu do potrzeby
    const { error: updateError } = await this.supabase
      .from("needs")
      .update({ description, updated_at: new Date().toISOString() })
      .eq("id", command.need_id);

    if (updateError) throw new InternalError("Failed to save description");

    // 6. Inkrementacja licznika (best-effort — nie rzucamy błędu głównego)
    const { error: incrementError } = await this.supabase
      .from("profiles")
      .update({ ai_usage_count: profile.ai_usage_count + 1 })
      .eq("id", userId);

    const ai_usage_incremented = !incrementError;

    return { description, ai_usage_incremented };
  }

  private async callOpenRouter(command: GenerateDescriptionCommand): Promise<string> {
    const prompt = this.buildPrompt(command);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), APP_CONFIG.AI.TIMEOUT_MS);

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${import.meta.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://shelterly.pl",
          "X-Title": "Shelterly",
        },
        body: JSON.stringify({
          model: APP_CONFIG.AI.DESCRIPTION_MODEL,
          messages: [
            {
              role: "system",
              content:
                "Jesteś asystentem pomagającym schroniskom dla zwierząt w Polsce pisać opisy potrzeb. " +
                "Pisz krótko i empatycznie po polsku. Tylko czysty tekst, bez markdown.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 200,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new InternalError(`OpenRouter returned ${response.status}`);
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content;

      if (!text) throw new InternalError("Empty response from AI service");

      return text.trim();
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildPrompt(command: GenerateDescriptionCommand): string {
    return (
      `Napisz krótki, przekonujący opis (2-3 zdania) dla następującej potrzeby schroniska:\n` +
      `- Kategoria: ${command.category}\n` +
      `- Tytuł: "${command.title}"\n` +
      `- Ilość: ${command.target_quantity} ${command.unit}\n\n` +
      `Opis powinien być empatyczny i zachęcać darczyńców do pomocy.`
    );
  }
}
```

---

### Etap 4: Route Handler

**Plik do utworzenia:** `src/pages/api/ai/generate-description.ts`

```typescript
import type { APIRoute } from "astro";
import { AIService } from "@/lib/services/ai.service";
import { GenerateDescriptionCommandSchema } from "@/lib/validation/ai.schemas";
import {
  createErrorHttpResponse,
  createValidationErrorResponse,
  logErrorWithContext,
  logSuccess,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
} from "@/lib/errors";
import { RateLimiter } from "@/lib/rate-limiter";
import { APP_CONFIG } from "@/lib/config";

export const prerender = false;

// Singleton rate limiter for this endpoint
const rateLimiter = new RateLimiter(APP_CONFIG.AI.RATE_LIMITING.GENERATE_DESCRIPTION);

export const POST: APIRoute = async ({ request, locals }) => {
  // 1. Autentykacja
  const {
    data: { user },
    error: authError,
  } = await locals.supabase.auth.getUser();

  if (authError || !user) {
    return createErrorHttpResponse("UNAUTHORIZED", "Authentication required", 401);
  }

  // 2. Rate limiting
  const rateLimitResult = rateLimiter.check(user.id);
  if (!rateLimitResult.allowed) {
    return createErrorHttpResponse("RATE_LIMIT_EXCEEDED", "Too many requests. Please try again later.", 429);
  }

  // 3. Parsowanie i walidacja body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createErrorHttpResponse("INVALID_REQUEST", "Invalid JSON body", 400);
  }

  const validationResult = GenerateDescriptionCommandSchema.safeParse(body);
  if (!validationResult.success) {
    return createValidationErrorResponse(validationResult.error.errors);
  }

  const command = validationResult.data;

  // 4. Wywołanie serwisu
  try {
    const aiService = new AIService(locals.supabase);
    const result = await aiService.generateNeedDescription(command, user.id);

    logSuccess("POST /api/ai/generate-description", {
      need_id: command.need_id,
      user_id: user.id,
      ai_usage_incremented: result.ai_usage_incremented,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logErrorWithContext(
      {
        endpoint: "POST /api/ai/generate-description",
        user_id: user.id,
        request_body: { need_id: command.need_id, category: command.category, title: command.title },
      },
      error
    );

    if (error instanceof NotFoundError) {
      return createErrorHttpResponse("NOT_FOUND", error.message, 404);
    }
    if (error instanceof ForbiddenError) {
      return createErrorHttpResponse("FORBIDDEN", error.message, 403);
    }
    if (error instanceof UnauthorizedError) {
      return createErrorHttpResponse("UNAUTHORIZED", error.message, 401);
    }

    return createErrorHttpResponse("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
};
```

---

### Etap 5: Konfiguracja zmiennych środowiskowych

W pliku `.env` (i `.env.example`) dodać:

```env
OPENROUTER_API_KEY=sk-or-...
# OPENROUTER_BASE_URL=https://openrouter.ai/api/v1  # opcjonalnie
```

---

### Etap 6: Testy jednostkowe (opcjonalne MVP)

**Plik do utworzenia:** `src/lib/services/ai.service.test.ts`

Scenariusze testowe:

- ✅ Poprawne wygenerowanie opisu — zwraca `{ description, ai_usage_incremented: true }`
- ❌ Need nie istnieje → `NotFoundError`
- ❌ `need.shelter_id !== userId` → `ForbiddenError("not the owner")`
- ❌ `ai_usage_count >= USAGE_LIMIT` → `ForbiddenError("limit exceeded")`
- ❌ OpenRouter zwraca 500 → `InternalError`
- ⚠️ Opis zapisany, inkrementacja nie powiodła się → zwraca `{ ai_usage_incremented: false }`

---

### Podsumowanie plików do utworzenia/modyfikacji

| Akcja       | Plik                                       |
| ----------- | ------------------------------------------ |
| Modyfikacja | `src/lib/config.ts`                        |
| Modyfikacja | `src/env.d.ts`                             |
| Utworzenie  | `src/lib/validation/ai.schemas.ts`         |
| Utworzenie  | `src/lib/services/ai.service.ts`           |
| Utworzenie  | `src/pages/api/ai/generate-description.ts` |
| Opcjonalne  | `src/lib/services/ai.service.test.ts`      |
