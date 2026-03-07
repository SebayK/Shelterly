# Plan implementacji widoku Panel administracyjny

## 1. Przegląd

Widok panelu administracyjnego pod ścieżką `/admin` służy do obsługi procesu weryfikacji schronisk oczekujących na aktywację. Jego podstawowym celem jest umożliwienie użytkownikowi z rolą `super_admin` szybkiego przejrzenia listy kont ze statusem `pending`, otwarcia szczegółów konkretnego zgłoszenia, podglądu dokumentu weryfikacyjnego oraz wykonania jednej z dwóch akcji biznesowych: zatwierdzenia konta lub odrzucenia zgłoszenia.

Widok powinien być zgodny z historią użytkownika US.5 z PRD: administrator ma mieć dostęp do listy zgłoszeń oraz do dokumentów potrzebnych do oceny wiarygodności schroniska. Implementacja powinna opierać się na Astro 5 dla routingu i SSR, React 19 dla interaktywnej części widoku oraz istniejących prymitywach UI z `src/components/ui`. Po stronie klienta widok powinien zapewniać szybkie odświeżanie danych po mutacji, czytelny stan pusty, przewidywalną obsługę błędów i pełną dostępność dla tabeli, panelu review oraz dialogów potwierdzających.

## 2. Routing widoku

- **Ścieżka:** `/admin`
- **Plik strony:** `src/pages/admin/index.astro`
- **Tryb renderowania:** `export const prerender = false`
- **Dostęp:** wyłącznie użytkownik zalogowany z rolą `super_admin`
- **Źródło autoryzacji:** sesja Supabase dostępna przez `Astro.locals.supabase`

### Zachowanie routingu i guardów

- Jeśli użytkownik nie jest zalogowany, strona powinna wykonać redirect do `/auth/login?return=/admin`.
- Jeśli użytkownik jest zalogowany, ale nie ma profilu lub nie ma roli `super_admin`, strona nie powinna renderować panelu.
- Dla roli `shelter` należy przyjąć jeden jawny wariant zachowania i stosować go konsekwentnie w implementacji:
  - wariant preferowany: redirect do właściwej strefy użytkownika, czyli `/dashboard`
  - alternatywa akceptowalna: zwrócenie `403` z dedykowanym ekranem braku uprawnień
- Guard SSR w `src/pages/admin/index.astro` jest obowiązkowy nawet wtedy, gdy endpointy API dodatkowo sprawdzają rolę. To realizuje wymaganie „podwójnego guardu” z opisu widoku.

## 3. Struktura komponentów

Proponowana struktura widoku:

```text
src/pages/admin/index.astro
└── DashboardLayout.astro lub dedykowany Admin layout
    └── AdminPendingSheltersView client:load
        ├── AdminPendingSheltersHeader
        │   ├── title
        │   ├── Badge z liczbą oczekujących
        │   └── przycisk odświeżenia
        ├── PendingSheltersTable
        │   ├── PendingShelterTableRow[]
        │   ├── status dokumentu
        │   └── klasyczna paginacja
        ├── ShelterReviewPanel
        │   ├── sekcja danych schroniska
        │   ├── sekcja dokumentu
        │   ├── DocumentPreview
        │   └── ReviewActions
        ├── ShelterStatusConfirmationDialog
        │   ├── tryb verify
        │   └── tryb reject
        └── stany pomocnicze
            ├── loading
            ├── empty
            ├── error
            └── document loading / unsupported preview
```

### Rekomendowany podział plików

- `src/pages/admin/index.astro`
- `src/components/admin/AdminPendingSheltersView.tsx`
- `src/components/admin/AdminPendingSheltersHeader.tsx`
- `src/components/admin/PendingSheltersTable.tsx`
- `src/components/admin/PendingSheltersPagination.tsx`
- `src/components/admin/ShelterReviewPanel.tsx`
- `src/components/admin/VerificationDocumentPreview.tsx`
- `src/components/admin/ShelterStatusConfirmationDialog.tsx`
- `src/components/admin/types.ts`
- `src/components/hooks/useAdminPendingShelters.ts`
- `src/components/hooks/useShelterVerificationDocument.ts`
- `src/components/hooks/useUpdateShelterStatus.ts`
- opcjonalnie: `src/components/admin/admin.helpers.ts`

Jeżeli zespół chce ograniczyć liczbę plików w pierwszym kroku, `AdminPendingSheltersHeader` i `PendingSheltersPagination` mogą zostać zaimplementowane jako małe komponenty współlokowane w `AdminPendingSheltersView.tsx`, ale `PendingSheltersTable`, `ShelterReviewPanel` i `ShelterStatusConfirmationDialog` powinny pozostać osobnymi komponentami.

## 4. Szczegóły komponentów

### `src/pages/admin/index.astro`

- **Opis komponentu:** Strona Astro odpowiedzialna za SSR guard, pobranie minimalnych danych bieżącego użytkownika i wyrenderowanie interaktywnej wyspy React.
- **Przeznaczenie:** Ochrona dostępu do panelu przed renderowaniem oraz przekazanie do klienta danych potrzebnych do nagłówka, layoutu i pierwszego renderu.
- **Główne elementy:**
  - import `DashboardLayout.astro` albo dedykowanego layoutu administracyjnego
  - frontmatter z walidacją sesji i profilu
  - `AdminPendingSheltersView client:load`
- **Obsługiwane zdarzenia:** brak zdarzeń klienta; logika działa w frontmatterze
- **Warunki walidacji:**
  - użytkownik musi być zalogowany
  - profil musi istnieć
  - `profile.role === "super_admin"`
- **Typy:**
  - istniejący `ProfileMeDTO` albo minimalny SSR model użytkownika administracyjnego
  - nowy `AdminPageUserVM`
- **Propsy przekazywane do React island:**

```ts
interface AdminPendingSheltersViewProps {
  currentUser: AdminPageUserVM;
  currentPath: string;
}
```

### `AdminPendingSheltersView`

- **Opis komponentu:** Główny kontener interaktywnego widoku. Odpowiada za orkiestrację zapytań, paginacji, zaznaczenia aktywnego schroniska, otwierania panelu review oraz wykonania mutacji statusu.
- **Z czego się składa:**
  - `AdminPendingSheltersHeader`
  - kontener treści z tabelą i panelem review
  - stany ładowania, błędu i pustej listy
  - `ShelterStatusConfirmationDialog`
- **Główne elementy HTML i komponenty dzieci:**
  - `<section>` jako główny kontener
  - `<div>` z układem `grid` lub `flex` dla tabeli i panelu bocznego
  - `PendingSheltersTable`
  - `ShelterReviewPanel`
  - `AlertDialog`
- **Obsługiwane zdarzenia:**
  - odświeżenie listy
  - zmiana strony paginacji
  - kliknięcie wiersza tabeli
  - otwarcie / zamknięcie panelu review
  - kliknięcie „Zweryfikuj”
  - kliknięcie „Odrzuć”
  - wpisanie powodu odrzucenia
  - potwierdzenie albo anulowanie dialogu
- **Warunki walidacji:**
  - przed wysłaniem mutacji `verified` `rejection_reason` musi być `undefined` albo `null`
  - przed wysłaniem mutacji `rejected` powód odrzucenia musi mieć min. 3 znaki po `trim()` i max 500 znaków
  - akcje muszą być zablokowane, gdy trwa mutacja lub nie ma aktywnie wybranego schroniska
- **Typy:**
  - `PendingShelterListItemDTO`
  - `PendingShelterListResponseDTO`
  - `UpdateShelterStatusCommand`
  - `ShelterStatusUpdateResponseDTO`
  - nowe ViewModel: `PendingShelterRowVM`, `ShelterReviewVM`, `AdminPaginationVM`, `ReviewActionState`
- **Propsy:**

```ts
interface AdminPendingSheltersViewProps {
  currentUser: AdminPageUserVM;
}
```

### `AdminPendingSheltersHeader`

- **Opis komponentu:** Nagłówek sekcji listy zgłoszeń. Pokazuje nazwę widoku, krótki opis, liczbę oczekujących schronisk i globalne akcje widoku.
- **Główne elementy:**
  - `<header>`
  - `<h1>`
  - `<p>` z opisem kontekstu administracyjnego
  - `Badge` z liczbą oczekujących
  - `Button` „Odśwież”
- **Obsługiwane zdarzenia:** kliknięcie odświeżenia
- **Warunki walidacji:** przycisk odświeżenia może być zablokowany podczas aktywnego refetchu
- **Typy:** `AdminPendingSheltersHeaderProps`
- **Propsy:**

```ts
interface AdminPendingSheltersHeaderProps {
  pendingCount: number;
  isRefreshing: boolean;
  onRefresh: () => void;
}
```

### `PendingSheltersTable`

- **Opis komponentu:** Semantyczna tabela z listą schronisk `pending`. Jest głównym miejscem nawigacji po rekordach. Wiersz jest klikalny i ustawia aktywny rekord w panelu review.
- **Główne elementy HTML i komponenty dzieci:**
  - `<section>` lub `<div>` opakowujące tabelę
  - `<table>` z prawidłową strukturą: `<caption>`, `<thead>`, `<tbody>`
  - kolumny: nazwa, NIP, miasto, email, data rejestracji, status dokumentu
  - `PendingSheltersPagination`
  - stan pusty i stan skeleton / loading
- **Obsługiwane zdarzenia:**
  - kliknięcie wiersza
  - `Enter` lub `Space` na fokusowalnym wierszu / przycisku „Przejrzyj”
  - przejście do poprzedniej / następnej strony
- **Warunki walidacji:**
  - jeśli `verification_doc_path` jest `null`, wiersz nadal może się otwierać, ale panel review powinien pokazać brak dokumentu i zablokować decyzję w zależności od polityki UX
  - paginacja ma blokować przyciski poza zakresem
  - tabela musi zachować semantykę i nie może polegać wyłącznie na `div`-ach stylowanych jak wiersze
- **Typy:**
  - `PendingShelterListItemDTO`
  - `Pagination`
  - `PendingShelterRowVM`
- **Propsy:**

```ts
interface PendingSheltersTableProps {
  rows: PendingShelterRowVM[];
  pagination: AdminPaginationVM | null;
  selectedShelterId: string | null;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  onSelectShelter: (shelterId: string) => void;
  onRetry: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
}
```

### `PendingSheltersPagination`

- **Opis komponentu:** Klasyczna paginacja z przyciskami „Poprzednia” i „Następna”, opcjonalnie z informacją o aktualnym zakresie wyników.
- **Główne elementy:**
  - `<nav aria-label="Paginacja zgłoszeń schronisk">`
  - dwa przyciski
  - tekst z zakresem rekordów
- **Obsługiwane zdarzenia:** kliknięcie poprzedniej / następnej strony
- **Warunki walidacji:**
  - brak przejścia poniżej strony 1
  - brak przejścia powyżej `totalPages`
- **Typy:** `AdminPaginationVM`
- **Propsy:**

```ts
interface PendingSheltersPaginationProps {
  pagination: AdminPaginationVM;
  onPrevPage: () => void;
  onNextPage: () => void;
}
```

### `ShelterReviewPanel`

- **Opis komponentu:** Panel boczny albo modal review dla aktywnie wybranego schroniska. Zawiera szczegóły rekordu, status dokumentu, podgląd dokumentu i przyciski akcji biznesowych.
- **Rekomendacja UI:**
  - desktop: `Sheet` z prawej strony
  - mobile: ten sam `Sheet`, pełna szerokość albo prawie pełna szerokość
- **Główne elementy HTML i komponenty dzieci:**
  - `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription`
  - sekcja danych schroniska w formie `dl`
  - sekcja dokumentu
  - `VerificationDocumentPreview`
  - przyciski akcji w stopce
- **Obsługiwane zdarzenia:**
  - otwarcie / zamknięcie panelu
  - kliknięcie „Zweryfikuj”
  - kliknięcie „Odrzuć”
  - kliknięcie „Pobierz dokument”
- **Warunki walidacji:**
  - jeśli brak aktywnego schroniska, panel nie renderuje treści merytorycznej
  - jeśli dokument nie istnieje lub nie daje się podejrzeć inline, panel musi zaoferować bezpieczny fallback: komunikat + link / przycisk pobrania
  - przyciski akcji muszą być zablokowane podczas mutacji
- **Typy:**
  - `ShelterReviewVM`
  - `VerificationDocumentState`
  - `ReviewActionState`
- **Propsy:**

```ts
interface ShelterReviewPanelProps {
  open: boolean;
  shelter: ShelterReviewVM | null;
  documentState: VerificationDocumentState;
  actionState: ReviewActionState;
  onOpenChange: (open: boolean) => void;
  onVerifyClick: () => void;
  onRejectClick: () => void;
  onRetryDocument: () => void;
  onDownloadDocument: () => void;
}
```

### `VerificationDocumentPreview`

- **Opis komponentu:** Komponent odpowiedzialny za podgląd dokumentu pobranego przez API proxy. Powinien rozpoznawać typ MIME i dobrać odpowiedni sposób prezentacji.
- **Główne elementy HTML:**
  - `<iframe>` dla PDF
  - `<img>` dla obrazów
  - fallback tekstowy dla nieobsługiwanych typów
  - przycisk pobrania
- **Obsługiwane zdarzenia:**
  - ponowne pobranie dokumentu
  - pobranie pliku
- **Warunki walidacji:**
  - dla `application/pdf` render przez `iframe`
  - dla `image/jpeg`, `image/png`, `image/webp` render przez `img`
  - dla `application/octet-stream` albo innych typów brak próby inline renderu, tylko fallback
  - komponent musi mieć `aria-label` opisujący zawartość podglądu
- **Typy:** `VerificationDocumentState`, `VerificationDocumentPreviewProps`
- **Propsy:**

```ts
interface VerificationDocumentPreviewProps {
  state: VerificationDocumentState;
  shelterName: string;
  onRetry: () => void;
  onDownload: () => void;
}
```

### `ShelterStatusConfirmationDialog`

- **Opis komponentu:** Dialog potwierdzenia akcji statusowej. W trybie `verify` pokazuje konsekwencje aktywacji konta. W trybie `reject` pokazuje pole na powód odrzucenia, które musi przejść walidację zgodną z API.
- **Główne elementy HTML i komponenty dzieci:**
  - `AlertDialog`
  - `AlertDialogTitle`
  - `AlertDialogDescription`
  - `Textarea` dla powodu odrzucenia
  - `AlertDialogCancel`
  - `AlertDialogAction`
- **Obsługiwane zdarzenia:**
  - otwarcie / zamknięcie dialogu
  - zmiana tekstu powodu odrzucenia
  - potwierdzenie akcji
  - anulowanie
- **Warunki walidacji:**
  - dla `mode === "rejected"` powód jest wymagany
  - wartość po `trim()` musi mieć od 3 do 500 znaków
  - dla `mode === "verified"` pole nie powinno być wysyłane
  - przy aktywnej mutacji przyciski są blokowane
- **Typy:**
  - `AdminReviewDecision`
  - `ShelterStatusConfirmationDialogProps`
- **Propsy:**

```ts
interface ShelterStatusConfirmationDialogProps {
  open: boolean;
  mode: AdminReviewDecision | null;
  shelterName: string | null;
  rejectionReason: string;
  validationError: string | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onRejectionReasonChange: (value: string) => void;
  onConfirm: () => void;
}
```

## 5. Typy

Widok korzysta z istniejących DTO z `src/types.ts`, ale wymaga też cienkiej warstwy ViewModel dostosowanej do potrzeb interfejsu.

### Typy istniejące

#### `PendingShelterListItemDTO`

```ts
interface PendingShelterListItemDTO {
  id: string;
  name: string | null;
  nip: string | null;
  city: string | null;
  email: string;
  verification_doc_path: string | null;
  created_at: string;
}
```

Zastosowanie:

- baza dla tabeli
- źródło danych dla panelu review

#### `PendingShelterListResponseDTO`

```ts
interface PendingShelterListResponseDTO {
  data: PendingShelterListItemDTO[];
  pagination: Pagination;
}
```

Zastosowanie:

- odpowiedź `GET /api/admin/shelters/pending`
- źródło danych dla paginacji

#### `UpdateShelterStatusCommand`

```ts
interface UpdateShelterStatusCommand {
  status: ShelterStatus;
  rejection_reason?: string | null;
}
```

W praktyce dla tego widoku należy wysyłać tylko dwa warianty:

- `{ status: "verified" }`
- `{ status: "rejected", rejection_reason: string }`

Mimo że backend dopuszcza także `suspended`, widok `/admin` według opisu powinien wspierać wyłącznie `verified` i `rejected`.

#### `ShelterStatusUpdateResponseDTO`

```ts
interface ShelterStatusUpdateResponseDTO {
  id: string;
  status: ShelterStatus;
  updated_at: string;
}
```

Zastosowanie:

- wynik mutacji `PATCH /api/admin/shelters/:id/status`
- optymistyczna aktualizacja cache albo usunięcie rekordu z listy `pending`

#### `ErrorResponse`

Zastosowanie:

- mapowanie błędów walidacji, autoryzacji, błędów serwera i błędów domenowych do komunikatów UI

### Nowe typy ViewModel

#### `AdminPageUserVM`

Minimalny model użytkownika administracyjnego przekazywany z Astro do Reacta.

```ts
interface AdminPageUserVM {
  id: string;
  name: string | null;
  role: "super_admin";
}
```

#### `PendingShelterRowVM`

Model pojedynczego wiersza tabeli, wzbogacony o dane sformatowane pod UI.

```ts
interface PendingShelterRowVM {
  id: string;
  name: string;
  nip: string;
  city: string;
  email: string;
  createdAt: string;
  createdAtLabel: string;
  hasVerificationDocument: boolean;
  documentStatusLabel: string;
}
```

Wyjaśnienie pól:

- `name`, `nip`, `city` powinny mieć fallbacki UI, np. „Brak nazwy”, „Brak NIP”, „Brak miasta”
- `createdAt` pozostaje surowym ISO stringiem do logiki i sortowania
- `createdAtLabel` to sformatowana data dla użytkownika, np. lokalizacja `pl-PL`
- `hasVerificationDocument` upraszcza warunki renderowania badge’a i preview
- `documentStatusLabel` pozwala oddzielić logikę od warstwy prezentacji

#### `ShelterReviewVM`

Model danych dla panelu review.

```ts
interface ShelterReviewVM {
  id: string;
  name: string;
  nip: string;
  city: string;
  email: string;
  createdAt: string;
  createdAtLabel: string;
  verificationDocumentPath: string | null;
  hasVerificationDocument: boolean;
}
```

Ten model może być budowany bez dodatkowego endpointu szczegółu, wyłącznie na podstawie `PendingShelterListItemDTO`.

#### `AdminPaginationVM`

```ts
interface AdminPaginationVM {
  total: number;
  limit: number;
  offset: number;
  currentPage: number;
  totalPages: number;
  from: number;
  to: number;
}
```

Pola `from` i `to` upraszczają render informacji typu „Pokazano 1-10 z 24”.

#### `AdminReviewDecision`

```ts
type AdminReviewDecision = "verified" | "rejected";
```

Typ ograniczony do działań dostępnych w tym widoku.

#### `VerificationDocumentState`

```ts
interface VerificationDocumentState {
  status: "idle" | "loading" | "success" | "error" | "unsupported" | "missing";
  objectUrl: string | null;
  contentType: string | null;
  fileName: string | null;
  errorMessage: string | null;
}
```

Wyjaśnienie:

- `idle`: panel jeszcze nie zażądał dokumentu
- `loading`: trwa pobieranie pliku przez API proxy
- `success`: dokument gotowy do podglądu lub pobrania
- `error`: pobranie zakończone błędem
- `unsupported`: plik pobrany, ale brak obsługi preview inline
- `missing`: rekord nie ma `verification_doc_path`

#### `ReviewActionState`

```ts
interface ReviewActionState {
  isSubmitting: boolean;
  pendingDecision: AdminReviewDecision | null;
}
```

#### `AdminListFiltersVM`

Widok na ten moment nie ma filtrów biznesowych, ale warto przewidzieć prosty model techniczny dla bieżącej strony.

```ts
interface AdminListFiltersVM {
  page: number;
  pageSize: number;
}
```

## 6. Zarządzanie stanem

Widok wymaga jawnego i przewidywalnego zarządzania stanem po stronie klienta. Najlepszym rozwiązaniem będzie użycie TanStack Query dla danych z API oraz lokalnego stanu React do obsługi interakcji chwilowych.

### Rekomendowana infrastruktura

- dodać zależność `@tanstack/react-query`
- utworzyć cienki provider, jeśli w projekcie nie istnieje jeszcze globalny `QueryClientProvider`
- jeśli zespół nie chce od razu wprowadzać providera globalnie, można opakować nim tylko `AdminPendingSheltersView`

### Stan serwerowy

Stanem serwerowym powinny zarządzać hooki oparte o TanStack Query:

- `useAdminPendingShelters(page, pageSize)`
  - pobiera listę oczekujących schronisk
  - utrzymuje `staleTime: 30_000`
  - korzysta z `placeholderData` lub zachowuje poprzednie dane podczas zmiany strony, żeby uniknąć migotania tabeli
- `useShelterVerificationDocument(shelterId, enabled)`
  - pobiera dokument dopiero po otwarciu panelu review dla konkretnego schroniska
  - tworzy `Blob` i `objectUrl`
  - czyści poprzedni `objectUrl` na zmianę rekordu lub unmount
- `useUpdateShelterStatus()`
  - wykonuje mutację `PATCH`
  - po sukcesie invaliduje query listy `pending`
  - opcjonalnie natychmiast zamyka panel review i resetuje dialog

### Stan lokalny komponentu `AdminPendingSheltersView`

Lokalny stan powinien obejmować:

- `selectedShelterId: string | null`
- `isReviewPanelOpen: boolean`
- `confirmationDialogMode: AdminReviewDecision | null`
- `rejectionReason: string`
- `rejectionReasonError: string | null`
- opcjonalnie `lastActionMessage` tylko jeśli zespół nie chce opierać się w pełni na `sonner`

### Custom hooki

#### `useAdminPendingShelters`

Cel:

- enkapsulacja pobierania listy i transformacji DTO do VM
- centralizacja klucza query, np. `['admin', 'pending-shelters', page, pageSize]`

Zwracane dane:

```ts
interface UseAdminPendingSheltersResult {
  rows: PendingShelterRowVM[];
  rawItems: PendingShelterListItemDTO[];
  pagination: AdminPaginationVM | null;
  isLoading: boolean;
  isFetching: boolean;
  errorMessage: string | null;
  refetch: () => Promise<unknown>;
}
```

#### `useShelterVerificationDocument`

Cel:

- pobranie dokumentu przez API proxy
- rozpoznanie typu MIME
- przygotowanie `objectUrl` i metadanych do preview

Zwracane dane:

```ts
interface UseShelterVerificationDocumentResult {
  documentState: VerificationDocumentState;
  retry: () => Promise<unknown>;
  download: () => void;
}
```

#### `useUpdateShelterStatus`

Cel:

- hermetyzacja mutacji i mapowania błędów API na komunikaty UI

Zwracane dane:

```ts
interface UseUpdateShelterStatusResult {
  updateStatus: (payload: { shelterId: string; command: UpdateShelterStatusCommand }) => Promise<void>;
  isPending: boolean;
  errorMessage: string | null;
}
```

## 7. Integracja API

Widok wykorzystuje trzy endpointy administracyjne.

### `GET /api/admin/shelters/pending`

Cel frontendowy:

- pobranie strony listy rekordów do tabeli

Typ żądania:

```ts
interface PendingSheltersQueryParams {
  limit?: number;
  offset?: number;
}
```

Typ odpowiedzi:

```ts
type PendingSheltersResponse = PendingShelterListResponseDTO;
```

Szczegóły implementacyjne:

- domyślny `pageSize` powinien być jawny i spójny z UI, np. `10` lub `20`
- `offset = (page - 1) * limit`
- błąd `401` powinien kończyć się redirectem do `/auth/login?return=/admin`
- błąd `403` powinien kończyć się przekierowaniem do bezpiecznej strony albo pokazaniem komunikatu o braku dostępu
- `500` powinien pokazać stan błędu sekcji listy z możliwością ponowienia

### `PATCH /api/admin/shelters/:id/status`

Cel frontendowy:

- potwierdzenie decyzji administratora

Typ żądania dla tego widoku:

```ts
type AdminStatusCommand =
  | { status: "verified" }
  | { status: "rejected"; rejection_reason: string };
```

Typ odpowiedzi:

```ts
type AdminStatusResponse = ShelterStatusUpdateResponseDTO;
```

Szczegóły implementacyjne:

- dla akcji „Zweryfikuj” nie należy wysyłać `rejection_reason`
- dla akcji „Odrzuć” należy wysłać `rejection_reason`
- po sukcesie należy:
  - zamknąć dialog
  - pokazać toast sukcesu
  - zainwalidować cache listy `pending`
  - odświeżyć panel tak, aby usunięty rekord nie pozostał wybrany
- trzeba pamiętać, że backend aktualnie waliduje `rejection_reason`, ale go nie zapisuje. UI powinien to uwzględniać i nie obiecywać administratorowi trwałego zapisania powodu w obecnej wersji systemu.

### `GET /api/admin/shelters/:id/verification-document`

Cel frontendowy:

- pobranie prywatnego dokumentu do preview lub pobrania

Typ odpowiedzi:

- `Response` z binarnym body i nagłówkami:
  - `Content-Type`
  - `Content-Disposition`

Szczegóły implementacyjne:

- frontend powinien używać `response.blob()`
- z `Blob` należy utworzyć `URL.createObjectURL(blob)`
- jeśli `Content-Type` to PDF lub obsługiwany obraz, można renderować preview inline
- jeśli `Content-Type` jest nieobsługiwany, należy pokazać informację i przycisk pobrania
- po zamknięciu panelu albo zmianie dokumentu należy wywołać `URL.revokeObjectURL(previousUrl)`

## 8. Interakcje użytkownika

### Lista interakcji i oczekiwane rezultaty

1. Wejście na `/admin` jako `super_admin`
   - widok ładuje listę zgłoszeń oczekujących
   - nagłówek pokazuje liczbę oczekujących rekordów

2. Wejście na `/admin` bez sesji
   - redirect do `/auth/login?return=/admin`

3. Wejście na `/admin` jako `shelter`
   - redirect do `/dashboard` albo ekran 403, zgodnie z przyjętą polityką

4. Kliknięcie wiersza tabeli
   - otwarcie `ShelterReviewPanel`
   - ustawienie aktywnego schroniska
   - rozpoczęcie pobierania dokumentu, jeśli `verification_doc_path` istnieje

5. Kliknięcie przycisku „Zweryfikuj”
   - otwarcie `AlertDialog`
   - pokazanie komunikatu, że konto uzyska dostęp do funkcji schroniska
   - po potwierdzeniu wysłanie `PATCH` ze statusem `verified`
   - po sukcesie rekord znika z tabeli `pending`

6. Kliknięcie przycisku „Odrzuć”
   - otwarcie `AlertDialog`
   - wyświetlenie pola na powód odrzucenia
   - bez podania poprawnej wartości przycisk potwierdzenia pozostaje nieaktywny albo pokazuje błąd walidacji
   - po potwierdzeniu wysłanie `PATCH` ze statusem `rejected`
   - po sukcesie rekord znika z tabeli `pending`

7. Kliknięcie „Odśwież”
   - ręczne ponowienie zapytania listy

8. Kliknięcie „Pobierz dokument”
   - pobranie pliku na urządzenie użytkownika z zachowaniem nazwy wynikającej z `Content-Disposition`, jeśli jest dostępna

9. Przejście do następnej / poprzedniej strony
   - aktualizacja numeru strony
   - pobranie odpowiednich rekordów
   - zachowanie zaznaczenia tylko wtedy, gdy rekord nadal istnieje na aktywnej stronie; w przeciwnym razie reset zaznaczenia

### Mapowanie historii użytkownika do implementacji

US.5 „Moderacja Schronisk” mapuje się bezpośrednio na:

- `GET /api/admin/shelters/pending` → lista zgłoszeń do weryfikacji
- `ShelterReviewPanel` → przegląd danych pojedynczego schroniska
- `GET /api/admin/shelters/:id/verification-document` → podgląd / pobranie dokumentu
- `PATCH /api/admin/shelters/:id/status` → decyzja administratora

## 9. Warunki i walidacja

### Warunki dostępu

- Strona renderuje się tylko dla `super_admin`
- API i SSR muszą niezależnie weryfikować sesję oraz rolę

### Warunki danych tabeli

- `name`, `nip`, `city` mogą przyjść jako `null`, więc UI musi mieć fallbacki tekstowe
- `email` jest wymagany i może być wyświetlany bez fallbacku
- `verification_doc_path` może być `null`, więc trzeba rozróżnić stan „dokument niedostarczony” od stanu błędu pobierania

### Warunki walidacji dialogu decyzji

- `verified`
  - brak `rejection_reason`
  - brak renderowania pola tekstowego albo jego pełna nieaktywność
- `rejected`
  - pole tekstowe jest wymagane
  - wartość po `trim()` musi mieć od 3 do 500 znaków
  - walidacja powinna działać natychmiast po próbie potwierdzenia, opcjonalnie także w trakcie wpisywania

### Warunki dokumentu

- jeśli rekord nie ma `verification_doc_path`, panel pokazuje informację „Brak dokumentu weryfikacyjnego”
- jeśli API zwróci `404`, panel pokazuje stan błędu domenowego „Dokument nie został znaleziony”
- jeśli `Content-Type` nie jest wspierany dla preview, interfejs nie powinien próbować renderować wadliwego `iframe` lub `img`

### Warunki paginacji

- `limit` powinien mieścić się w granicach akceptowanych przez backend, czyli `1-100`
- `offset` nie może spaść poniżej `0`

### Warunki wydajnościowe

- `staleTime` listy: `30_000`
- dokument pobierany leniwie dopiero po otwarciu panelu review
- po mutacji nie należy wykonywać pełnego reloadu strony, tylko invalidację query

## 10. Obsługa błędów

### Błędy autentykacji i autoryzacji

- `401` przy pobieraniu listy lub mutacji:
  - redirect do `/auth/login?return=/admin`
  - opcjonalnie toast „Sesja wygasła. Zaloguj się ponownie.”
- `403`:
  - zamknięcie widoku albo pokazanie ekranu braku uprawnień
  - nie należy pozostawiać panelu w stanie częściowo interaktywnym

### Błędy pobierania listy

- stan błędu sekcji z czytelnym komunikatem i przyciskiem „Spróbuj ponownie”
- jeśli są dane z poprzedniego sukcesu i tylko refetch się nie udał, można zachować starą listę i pokazać toast / baner ostrzegawczy

### Błędy pobierania dokumentu

- osobny stan błędu w obrębie `ShelterReviewPanel`, bez psucia całej listy
- komunikat zależny od statusu:
  - `404`: dokument lub rekord nie istnieje
  - `500`: nie udało się pobrać dokumentu, spróbuj ponownie
- zawsze pozostawić możliwość zamknięcia panelu i ponowienia próby

### Błędy mutacji statusu

- `400` / `VALIDATION_ERROR`:
  - pokazanie błędu pod polem powodu odrzucenia lub w dialogu
- `404`:
  - rekord mógł zostać obsłużony gdzie indziej; po komunikacie należy odświeżyć listę
- `500`:
  - toast błędu, brak zamknięcia dialogu, zachowanie wpisanego powodu odrzucenia

### Przypadki brzegowe

- ostatni rekord na ostatniej stronie zostaje zatwierdzony lub odrzucony:
  - po invalidacji trzeba sprawdzić, czy bieżąca strona nadal istnieje; jeśli nie, cofnąć się o jedną stronę
- użytkownik szybko zmienia aktywny rekord:
  - trzeba zapobiec wyciekowi `objectUrl` i nadpisaniu nowego stanu przez starsze żądanie
- rekord wybrany w panelu znika z listy po mutacji:
  - zamknąć panel i wyczyścić `selectedShelterId`

## 11. Kroki implementacji

1. Utworzyć stronę `src/pages/admin/index.astro` z `prerender = false` i SSR guardem dla sesji oraz roli `super_admin`.

2. Zdecydować, czy widok ma używać istniejącego `DashboardLayout.astro`, czy wymaga osobnego layoutu administracyjnego. Jeśli zostaje `DashboardLayout.astro`, trzeba uwzględnić, że obecny nagłówek i nawigacja są projektowane pod schronisko i mogą wymagać adaptacji dla `super_admin`.

3. Dodać zależność `@tanstack/react-query` i przygotować lokalny albo globalny `QueryClientProvider` dla React islands korzystających z danych serwerowych.

4. Utworzyć folder `src/components/admin` oraz plik `src/components/admin/types.ts` z nowymi ViewModelami i interfejsami propsów.

5. Zaimplementować klienta API dla listy zgłoszeń:
   - funkcję pobierającą `GET /api/admin/shelters/pending`
   - mapowanie `PendingShelterListResponseDTO` do `PendingShelterRowVM[]` i `AdminPaginationVM`
   - mapowanie błędów API do komunikatów UI

6. Zaimplementować hook `useAdminPendingShelters` oparty o TanStack Query z `staleTime: 30000` oraz kluczem query uwzględniającym `page` i `pageSize`.

7. Zaimplementować `AdminPendingSheltersHeader` pokazujący tytuł, liczbę rekordów i ręczne odświeżenie.

8. Zaimplementować `PendingSheltersTable` jako prawidłową semantycznie tabelę z obsługą:
   - stanu loading
   - stanu error
   - stanu empty
   - zaznaczonego wiersza
   - klasycznej paginacji

9. Zaimplementować `ShelterReviewPanel` jako `Sheet`, z layoutem mobilnym i desktopowym, prezentacją danych schroniska i sekcją dokumentu.

10. Zaimplementować `useShelterVerificationDocument`:
    - pobieranie dokumentu tylko po otwarciu panelu
    - obsługa `Blob`, `Content-Type`, `Content-Disposition`
    - tworzenie i czyszczenie `objectUrl`
    - fallback dla plików bez preview inline

11. Zaimplementować `VerificationDocumentPreview` z trzema głównymi ścieżkami renderu:
    - PDF w `iframe`
    - obraz w `img`
    - fallback tekstowy z przyciskiem pobrania

12. Zaimplementować `ShelterStatusConfirmationDialog` w dwóch trybach:
    - `verified`
    - `rejected` z polem powodu i walidacją 3-500 znaków po `trim()`

13. Zaimplementować hook mutacji `useUpdateShelterStatus`:
    - wysyłka `PATCH /api/admin/shelters/:id/status`
    - obsługa 401, 403, 404, 500
    - invalidacja cache listy po sukcesie

14. Dodać toasty sukcesu i błędów przez `sonner`, zgodnie z istniejącym wzorcem dashboardu.

15. Dodać logikę czyszczenia stanu po sukcesie mutacji:
    - zamknięcie dialogu
    - wyczyszczenie `rejectionReason`
    - zamknięcie panelu review lub przejście do kolejnego rekordu, jeśli zespół uzna to za wygodniejsze

16. Uzupełnić dostępność:
    - semantyczna tabela
    - `aria-current` lub inny czytelny sygnał zaznaczenia aktywnego rekordu
    - `aria-label` dla podglądu dokumentu
    - czytelne opisy konsekwencji w `AlertDialog`
    - poprawna kolejność fokusu w panelu i dialogu

17. Zweryfikować zachowanie edge-case’ów:
    - brak dokumentu
    - dokument nieobsługiwany inline
    - wygasła sesja podczas pracy
    - ostatni rekord na stronie po mutacji

18. Dodać testy komponentów i testy manualne dla kluczowych ścieżek:
    - render listy
    - otwarcie panelu review
    - walidacja odrzucenia bez powodu
    - sukces `verified`
    - sukces `rejected`
    - błędy API listy i dokumentu
    - dostępność dialogu i fokusu

19. Po implementacji sprawdzić, czy wymagane są zmiany w nawigacji aplikacji, tak aby `super_admin` miał realny punkt wejścia do `/admin` z poziomu UI, a nie tylko przez ręczne wpisanie adresu.

20. Na końcu przeprowadzić test ręczny pełnego scenariusza biznesowego US.5: wejście administratora do panelu, otwarcie zgłoszenia, podgląd dokumentu, zatwierdzenie jednego schroniska i odrzucenie drugiego.