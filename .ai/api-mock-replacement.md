# API Mock Replacement Plan

## Cel

Usunąć runtime zależność aplikacji od mocków i sprawić, aby frontend oraz strony Astro korzystały z realnych endpointów backendowych pod `/api/*` zarówno w development, jak i w production.

Mocki mogą pozostać w repo jako narzędzie pomocnicze do ręcznych testów, ale nie powinny być już domyślnym źródłem danych dla żadnego flow użytkownika.

## Aktualny stan

Realne API jest w większości gotowe i zaimplementowane.

Główne miejsca, które nadal omijają backend:

1. `src/components/hooks/useShelters.ts`
   - w DEV przełącza request z `/api/profiles` na `/api/mocks/profiles`

2. `src/pages/shelter/[id].astro`
   - w DEV importuje dane bezpośrednio z `__mocks__/data/profiles.json` oraz `__mocks__/data/needs.json`
   - nie korzysta wtedy z `ProfileService` i `NeedsService`

Pozostałe główne flow aplikacji używają już realnych endpointów `/api/*`.

## Zakres

### W zakresie

- usunięcie runtime przełączania na `/api/mocks/*`
- usunięcie bezpośrednich importów danych z `__mocks__` w widokach runtime
- przełączenie publicznych flow na realne endpointy backendowe
- przygotowanie developmentu do pracy na seedowanych danych z bazy
- aktualizacja dokumentacji technicznej

### Poza zakresem

- natychmiastowe usuwanie całego katalogu `src/pages/api/mocks`
- przebudowa logiki backendowej, jeśli obecne endpointy są wystarczające
- rozbudowa nowych endpointów, o ile nie wyjdą realne braki kontraktu

## Docelowy stan

Po wdrożeniu:

- explorer schronisk zawsze korzysta z `GET /api/profiles`
- widok szczegółu schroniska zawsze korzysta z danych z backendu
- development i production używają tego samego źródła danych runtime
- mocki są opcjonalne i uruchamiane tylko świadomie, nie przez kod aplikacji

## Plan wdrożenia

### 1. Usunąć DEV fallback w liście schronisk

Plik: `src/components/hooks/useShelters.ts`

Zmiana:

- usunąć warunek `import.meta.env.DEV ? "/api/mocks/profiles" : "/api/profiles"`
- zawsze wywoływać `/api/profiles`

Oczekiwany efekt:

- strona główna i explorer używają wyłącznie realnego endpointu profili

### 2. Usunąć bezpośrednie mocki w widoku szczegółu schroniska

Plik: `src/pages/shelter/[id].astro`

Zmiana:

- usunąć importy z `__mocks__/data/profiles.json`
- usunąć importy z `__mocks__/data/needs.json`
- usunąć gałąź `const useMockData = import.meta.env.DEV`
- zawsze używać `ProfileService.getProfileById(id)`
- zawsze używać `NeedsService.getNeeds({ shelter_id: id, limit, offset })`

Oczekiwany efekt:

- widok `/shelter/[id]` jest zgodny z realnym backendem także lokalnie

### 3. Zweryfikować kontrakt API dla publicznych flow

Pliki referencyjne:

- `src/pages/api/profiles/index.ts`
- `src/pages/api/profiles/[id].ts`
- `src/pages/api/needs/index.ts`
- `src/lib/services/profile.service.ts`
- `src/lib/services/needs.service.ts`

Do sprawdzenia:

- czy `GET /api/profiles` zwraca pola oczekiwane przez explorer
- czy `GET /api/profiles/:id` zwraca dane potrzebne dla widoku schroniska
- czy `GET /api/needs?shelter_id=...` zwraca komplet danych potrzebny dla `ShelterDetailView`
- czy format odpowiedzi zgadza się z aktualnymi DTO

Jeżeli pojawi się rozjazd:

- naprawić mapowanie po stronie API lub service layer
- nie dodawać kolejnego fallbacku po stronie UI

### 4. Przygotować development do działania bez mocków

Pliki i obszary:

- `supabase/seed.sql`
- `supabase/DEPLOYMENT.md`
- konfiguracja środowiska `.env`

Wymagania:

- dostępny `SUPABASE_URL`
- dostępny `SUPABASE_KEY`
- dostępny `OPENROUTER_API_KEY` dla endpointów AI, jeśli są testowane
- seed zawierający co najmniej jedno `verified` shelter
- seed zawierający potrzeby powiązane z tym schroniskiem

Oczekiwany efekt:

- lokalny development nie wymaga mocków, bo realne endpointy mają prawdziwe dane testowe

### 5. Przejrzeć zachowanie pustych stanów i błędów

Po przełączeniu na realny backend trzeba potwierdzić, że UI poprawnie obsługuje:

- brak zweryfikowanych schronisk
- brak potrzeb dla schroniska
- nieistniejące schronisko
- nieprawidłowy UUID w URL
- chwilowy błąd Supabase lub geocodingu

Wymóg:

- aplikacja ma pokazywać jawne empty states albo komunikaty błędu
- aplikacja nie może polegać na tym, że mock zawsze zwraca bogate dane

### 6. Usunąć historyczne `/api/mocks/*`

Po stabilizacji runtime application code katalog `src/pages/api/mocks` oraz dane z `__mocks__` mogą zostać usunięte, aby nie utrzymywać nieaktualnego alternatywnego kontraktu API.

### 7. Zaktualizować dokumentację

Pliki do aktualizacji:

- `.ai/ui-plan.md`
- `.ai/api-plan.md`

Zmiany w dokumentacji:

- DEV nie powinien już domyślnie korzystać z mocków
- realne `/api/*` są podstawowym kontraktem runtime
- mock endpoints zostały usunięte z codebase po potwierdzeniu, że runtime ich nie używa

## Ryzyka

### 1. Brak danych w lokalnej bazie

Objaw:

- po usunięciu mocków explorer lub detal schroniska pokazuje pusty stan albo 404

Mitigacja:

- poprawić `supabase/seed.sql`
- zapewnić minimalny zestaw danych testowych

### 2. Rozjazd DTO między UI i API

Objaw:

- frontend oczekuje pól, które wcześniej były składane lokalnie z mocków

Mitigacja:

- poprawić mapowanie w `ProfileService` lub `NeedsService`
- trzymać kontrakt po stronie backendu, nie po stronie mocków

### 3. Problemy środowiskowe Supabase

Objaw:

- lokalne endpointy `/api/*` zwracają 500 albo puste dane

Mitigacja:

- sprawdzić konfigurację env
- sprawdzić migracje
- upewnić się, że dev environment ma prawidłowe dane

### 4. RLS i różnice dev/prod

Objaw:

- flow działa lokalnie, ale nie działa w produkcji

Mitigacja:

- testować flow także na środowisku z politykami zbliżonymi do produkcji
- nie opierać się wyłącznie na środowisku dev z wyłączonym RLS

## Kolejność implementacji

Minimalny bezpieczny rollout w jednym PR:

1. zmiana `useShelters.ts`
2. zmiana `shelter/[id].astro`
3. weryfikacja kontraktu realnego API
4. uzupełnienie seedów
5. testy ręczne i automatyczne
6. aktualizacja dokumentacji

## Checklist implementacyjny

- [ ] usunąć przełączanie `/api/mocks/profiles` w `useShelters.ts`
- [ ] usunąć bezpośrednie importy `__mocks__` w `shelter/[id].astro`
- [ ] zawsze używać `ProfileService` i `NeedsService` w widoku schroniska
- [ ] potwierdzić zgodność DTO dla explorer i shelter detail
- [ ] przygotować seed z verified shelter i needs
- [ ] sprawdzić empty states i 404 po przełączeniu
- [ ] zaktualizować dokumentację planów po usunięciu mock endpoints
- [ ] usunąć katalog `src/pages/api/mocks` i dane `__mocks__`, jeśli cleanup został wykonany

## Checklist weryfikacyjny

### Explorer

- [ ] strona główna wykonuje request do `/api/profiles`
- [ ] request nie trafia do `/api/mocks/profiles`
- [ ] lista schronisk renderuje się poprawnie w DEV

### Shelter detail

- [ ] `/shelter/[id]` działa na danych z backendu
- [ ] nie korzysta z `__mocks__`
- [ ] nieistniejący UUID daje 404
- [ ] poprawny, ale brakujący rekord daje 404

### Local backend readiness

- [ ] Supabase env jest poprawnie skonfigurowany
- [ ] lokalna baza ma verified shelter
- [ ] lokalna baza ma potrzeby dla tego schroniska

### Regression safety

- [ ] runtime UI nie używa żadnego `/api/mocks/*`
- [ ] historyczne mock endpoints zostały usunięte z repo, jeśli cleanup został wykonany

## Rekomendacja końcowa

Najlepszy następny krok to jeden skupiony PR, który:

- usuwa dwa aktywne punkty wejścia do mocków
- nie rusza jeszcze całej infrastruktury mocków
- opiera development na seedowanych danych Supabase

To jest najmniejsza sensowna zmiana, która wyrównuje zachowanie DEV i PROD bez niepotrzebnego rozszerzania zakresu.