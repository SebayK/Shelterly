# To Do List

Poniżej rozpiska per dokument, z podziałem na: zrobione, częściowo zrobione, brakujące.

## ui-plan.md

### Zrealizowane

1. Publiczna strona główna z explorerem schronisk istnieje w `src/pages/index.astro`, a komponenty mapy/listy/filtrów są w `src/components/shelter-explorer/ShelterExplorer.tsx`, `src/components/shelter-explorer/MapView.tsx`, `src/components/shelter-explorer/ShelterList.tsx`, `src/components/shelter-explorer/ShelterFilters.tsx`, `src/components/shelter-explorer/LocationBanner.tsx`, `src/components/shelter-explorer/MobileViewToggle.tsx`.
2. Widok szczegółów schroniska istnieje w `src/pages/shelter/[id].astro`, z komponentami w `src/components/shelter-detail/ShelterDetailView.tsx`, `src/components/shelter-detail/NeedCard.tsx`, `src/components/shelter-detail/NeedsFilter.tsx`, `src/components/shelter-detail/ShelterHeader.astro`.
3. Logowanie, rejestracja i pending page są gotowe w `src/pages/auth/login.astro`, `src/pages/auth/register.astro`, `src/pages/auth/pending.astro`, z formularzami w `src/components/auth/LoginForm.tsx` i `src/components/auth/RegisterForm.tsx`.
4. Dashboard schroniska i edycja profilu istnieją w `src/pages/dashboard.astro` oraz `src/pages/dashboard/profile.astro`.
5. Layouty i nawigacja są wdrożone w `src/layouts/Layout.astro`, `src/layouts/DashboardLayout.astro`, `src/components/Navbar.astro`, `src/components/DashboardSidebar.astro`, `src/components/DashboardBottomNav.astro`, `src/components/UserAvatarMenu.tsx`, `src/components/MobileNavMenu.tsx`.
6. CRUD potrzeb w dashboardzie jest gotowe w `src/components/dashboard/NeedsManager.tsx`, `src/components/dashboard/NeedFormDialog.tsx`, `src/components/dashboard/NeedsTable.tsx`, `src/components/dashboard/DeleteNeedAlertDialog.tsx`, `src/components/dashboard/FulfillNeedAlertDialog.tsx`.
7. Primitives UI z planu są już w repo, m.in. `src/components/ui/dialog.tsx`, `src/components/ui/alert-dialog.tsx`, `src/components/ui/tooltip.tsx`, `src/components/ui/sheet.tsx`, `src/components/ui/label.tsx`, `src/components/ui/textarea.tsx`, `src/components/ui/switch.tsx`.
8. Panel administracyjny UI został wdrożony w `src/pages/admin/index.astro` wraz z komponentami `src/components/admin/AdminPendingSheltersView.tsx`, `src/components/admin/PendingSheltersTable.tsx`, `src/components/admin/ShelterReviewPanel.tsx`, `src/components/admin/ShelterStatusConfirmationDialog.tsx`.
9. Flow statusów `pending`, `rejected` i `suspended` jest domknięty w widokach i redirectach, w tym ograniczony dostęp do `/dashboard/profile` dla kont niezweryfikowanych oraz prezentacja powodu odrzucenia w UI.
10. Strona 404 z planu UI istnieje w `src/pages/404.astro`.

### Częściowo zrealizowane

1. Niektóre założenia architektoniczne z dokumentu nie zostały wdrożone literalnie: nie ma TanStack Query ani centralnego api clienta, zamiast tego są własne hooki fetchujące, np. `src/components/hooks/useNeeds.ts`, `src/components/hooks/useShelters.ts`, `src/components/hooks/useAdminPendingShelters.ts`.

### Brakujące

1. Brak istotnych braków widoków z planu UI; pozostały głównie odchylenia architektoniczne opisane wyżej.

## prd.md

### Zrealizowane

1. Rejestracja schroniska z danymi i statusem `pending` jest zaimplementowana przez `src/pages/api/auth/signup.ts` i `src/lib/services/auth.service.ts`, z formularzem w `src/components/auth/RegisterForm.tsx`.
2. Upload dokumentu weryfikacyjnego działa przez `src/pages/api/profiles/me/verification-document.ts` i UI w `src/components/auth/FileUploadDropzone.tsx` oraz `src/components/profile/ProfileForm.tsx`.
3. Blokada niezweryfikowanego konta przed pełnym użyciem działa w logowaniu i dashboardzie: `src/pages/api/auth/login.ts`, `src/components/StatusBanner.astro`, `src/components/dashboard/NeedsManager.tsx`.
4. CRUD potrzeb dla schroniska i helpery AI są wdrożone.
5. Publiczny widok mapy i szczegółów schroniska jest wdrożony.
6. Ścieżka administratora jest wdrożona end-to-end: istnieje frontend `/admin`, backend admin API i review flow z podglądem dokumentu.
7. Status `rejected` ma już trwały powód odrzucenia (`rejection_reason`), który jest zapisywany i widoczny dla schroniska.
8. Konta `pending` i `rejected` mogą zalogować się do ograniczonej strefy profilu, a `suspended` pozostaje blokowane.

### Częściowo zrealizowane

1. Geolokalizacja i sortowanie po odległości działają po stronie publicznej, ale logika rekomendacji z PRD nie jest domknięta: brak wydzielonej funkcji `suggestShelterForUser`, brak testu tej logiki i brak sortowania łączącego odległość z pilnością.

### Brakujące

1. Test funkcji recommendacyjnej wskazanej w PRD. Nie ma funkcji `suggestShelterForUser` ani testu dla niej.
2. CI pipeline. Nie ma workflowów w `.github/workflows`.

## api-plan.md

### Zrealizowane

1. Profile endpoints są obecne: `src/pages/api/profiles/index.ts`, `src/pages/api/profiles/[id].ts`, `src/pages/api/profiles/me/index.ts`, `src/pages/api/profiles/me/verification-document.ts`, `src/pages/api/profiles/me/geocode.ts`.
2. Needs endpoints są obecne: `src/pages/api/needs/index.ts`, `src/pages/api/needs/[id]/index.ts`, `src/pages/api/needs/[id]/fulfill.ts`.
3. AI endpoints są obecne: `src/pages/api/ai/generate-description.ts`, `src/pages/api/ai/generate-shopping-link.ts`.
4. Admin endpoints są obecne: `src/pages/api/admin/shelters/pending.ts`, `src/pages/api/admin/shelters/[id]/status.ts`, `src/pages/api/admin/shelters/[id]/verification-document.ts`.
5. Auth endpoints są obecne: `src/pages/api/auth/signup.ts`, `src/pages/api/auth/login.ts`, `src/pages/api/auth/logout.ts`, `src/pages/api/auth/refresh.ts`.
6. Duża część walidacji Zod jest wdrożona w `src/lib/validation/profile.schemas.ts`, `src/lib/validation/needs.schemas.ts`, `src/lib/validation/admin.schemas.ts`, `src/lib/validation/auth.schemas.ts`, `src/lib/validation/ai.schemas.ts`.
7. Rate limiting dla create need i AI endpoints jest już skonfigurowany w `src/lib/config.ts`.

### Częściowo zrealizowane

1. `POST /api/profiles/me/geocode` oraz `PATCH /api/profiles/me` pozwalają już zapisać `location` do profilu, ale publiczna logika rekomendacji nadal odbiega od planu API i PRD.
2. Caching jest wdrożony wybiórczo. `GET /api/needs` ma cache, admin ma `no-store`, ale `GET /api/profiles` nie ma deklarowanego cache-control z planu.
3. Bezpieczeństwo w praktyce opiera się dziś bardziej na warstwie API niż na RLS.

### Brakujące

1. Pełne RLS zgodne z planem. Schemat startowy je przewiduje w `supabase/migrations/20260119000000_init_schema.sql`, ale potem polityki są usuwane w `supabase/migrations/20260119120000_disable_rls_policies.sql` i RLS jest wyłączane w `supabase/migrations/20260224000000_disable_rls.sql`.
2. Rate limiting dla auth i general API zgodnie z `api-plan.md`.
3. Pełna zgodność z deklarowanym middleware chain z planu. Middleware istnieje w `src/middleware/index.ts`, ale obecnie robi głównie inicjalizację Supabase clienta, nie całą zaplanowaną sekwencję CORS, auth validator, rate limiter, formatter.

## Najkrótsza wersja priorytetów

1. RLS i część wymagań bezpieczeństwa z `api-plan.md` nadal są niespełnione.
2. Brakuje CI oraz testu i implementacji pełnej logiki rekomendacji z PRD.
3. Brakuje rate limitingu dla auth i general API oraz pełniejszego middleware chain zgodnego z planem.
4. Architektura UI odbiega od planu, ale to jest raczej dług techniczny niż blocker MVP.
