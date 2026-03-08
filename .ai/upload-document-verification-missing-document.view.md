# Upload Document Verification Missing Document Flow

## Goal

Domknąć brakujący flow dla schronisk, które zarejestrowały konto bez dokumentu weryfikacyjnego albo muszą poprawić zgłoszenie po decyzji administratora. Użytkownik ze statusem `pending` lub `rejected` powinien móc zalogować się, wejść do ograniczonej strefy schroniska i dołączyć lub zaktualizować dokument weryfikacyjny. Tylko `verified` zachowuje pełny dostęp do CRUD potrzeb. `suspended` pozostaje zablokowane na etapie logowania.

## Target Access Matrix

| Status | Login | Dashboard | Profile | Upload document | Needs CRUD | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `verified` | yes | full | yes | yes | yes | standard shelter flow |
| `pending` | yes | limited | yes | yes | no | should be guided to complete profile/document |
| `rejected` | yes | limited | yes | yes | no | should be guided to correct submission |
| `suspended` | no | no | no | no | no | blocked account |

## Implementation Plan

### Slice 1: Auth and redirects

1. Remove login rejection for `pending` in `src/lib/services/auth.service.ts`.
2. Keep `suspended` blocked at login.
3. Treat `rejected` as an allowed login state.
4. Make post-login redirect status-aware:
   - `super_admin` -> `/admin`
   - `verified` -> requested return URL or `/dashboard`
   - `pending` / `rejected` -> `/dashboard/profile`
5. Update login tests accordingly.

### Slice 2: Profile and UX guidance

1. Update `src/pages/auth/pending.astro` to stop being a dead-end screen.
2. Add clear CTA to complete profile and upload document.
3. Adjust `StatusBanner.astro` and profile UI copy for `pending` vs `rejected`.
4. Keep current upload endpoint `POST /api/profiles/me/verification-document` as the main remediation path.

### Slice 3: Restrict non-verified actions

1. Preserve backend restriction that only `verified` can create, update, delete, or fulfill needs.
2. Make dashboard needs UI explicitly read-only for `pending` and `rejected`.
3. Ensure error messages and disabled-action reasons distinguish verification states from general forbidden access.

### Slice 4: Rejected-state data gap

1. Current code validates `rejection_reason` but does not persist it.
2. Minimal delivery: allow `rejected` login and show a generic correction message.
3. Follow-up enhancement: persist `rejection_reason` in the database and expose it in profile/banner UI.

## Relevant Files

- `src/lib/services/auth.service.ts`
- `src/pages/api/auth/login.ts`
- `src/pages/auth/login.astro`
- `src/components/auth/LoginForm.tsx`
- `src/pages/auth/pending.astro`
- `src/pages/dashboard.astro`
- `src/pages/dashboard/profile.astro`
- `src/components/profile/ProfileForm.tsx`
- `src/components/StatusBanner.astro`
- `src/components/dashboard/NeedsManager.tsx`
- `src/pages/api/needs/index.ts`
- `src/pages/api/needs/[id]/index.ts`
- `src/pages/api/needs/[id]/fulfill.ts`
- `src/pages/api/auth/login.test.ts`

## Verification

1. `pending` can log in and is redirected to `/dashboard/profile`.
2. `rejected` can log in and is redirected to `/dashboard/profile`.
3. `suspended` still receives `403 ACCOUNT_SUSPENDED` and no active session.
4. `pending` and `rejected` can upload a verification document after login.
5. `pending` and `rejected` still cannot perform needs mutations.
6. `verified` and `super_admin` flows remain unchanged.

## Scope Notes

- This stage does not add a new role or a separate dashboard for remediation.
- This stage does not yet persist `rejection_reason`.
- The recommended first implementation target is Slice 1.