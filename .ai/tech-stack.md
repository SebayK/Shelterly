Frontend - Astro z React dla komponentów interaktywnych:

- Astro 5 pozwala na tworzenie szybkich, wydajnych stron i aplikacji z minimalną ilością JavaScript
- React 19 zapewni interaktywność tam, gdzie jest potrzebna (w tym mapy z React-Leaflet)
- TypeScript 5 dla statycznego typowania kodu i lepszego wsparcia IDE
- Tailwind 4 pozwala na wygodne stylowanie aplikacji
- Shadcn/ui zapewnia bibliotekę dostępnych komponentów React, na których oprzemy UI

Backend - Supabase jako kompleksowe rozwiązanie backendowe:

- Zapewnia bazę danych PostgreSQL i Storage na pliki (dokumenty weryfikacyjne)
- Zapewnia SDK w wielu językach, które posłużą jako Backend-as-a-Service
- Jest rozwiązaniem open source, które można hostować lokalnie lub na własnym serwerze
- Posiada wbudowaną autentykację użytkowników

AI - Komunikacja z modelami przez usługę Openrouter.ai:

- Dostęp do szerokiej gamy modeli (OpenAI, Anthropic, Google i wiele innych), które pozwolą nam znaleźć rozwiązanie zapewniające wysoką efektywność i niskie koszta
- Pozwala na ustawianie limitów finansowych na klucze API

Testy:

- Testy jednostkowe i integracyjne są realizowane przy użyciu Vitest 4
- Testy komponentów React wykorzystują React Testing Library oraz `@testing-library/user-event`
- Testy frontendowe uruchamiane poza prawdziwą przeglądarką korzystają ze środowiska `jsdom`
- Pokrycie kodu jest mierzone przez `@vitest/coverage-v8`
- Plan testów zakłada także testy E2E dla kluczowych flow użytkownika, ale repozytorium nie ma obecnie skonfigurowanego dedykowanego frameworka automatyzacji E2E

CI/CD i Hosting:

- Github Actions do tworzenia pipeline’ów testowych i linterów
- Vercel do automatycznego hostowania aplikacji (Serverless) i deploymentów z integracją Git
