# Plan implementacji widoku Strona 404

## 1. Przegląd

Widok 404 ma pełnić rolę publicznej, statycznej strony informacyjnej dla nieistniejących adresów i zasobów niedostępnych z perspektywy użytkownika. Celem jest pokazanie prostego, czytelnego komunikatu o braku strony oraz zapewnienie bezpiecznej ścieżki powrotu do strony głównej z mapą schronisk. Implementacja powinna być spójna z istniejącym publicznym layoutem aplikacji i nie może wprowadzać zbędnej hydracji Reacta ani ujawniać szczegółów technicznych błędu.

Zakres obejmuje nie tylko sam widok 404, ale również korektę istniejącego flow not-found tak, aby strony dynamiczne renderowały treść 404 z zachowaniem semantyki błędu zamiast wykonywać zwykły redirect do `/404`.

## 2. Routing widoku

- Ścieżka użytkowa: `/404`
- Docelowy plik strony: `src/pages/404.astro`
- Typ renderowania: strona Astro bez React islands
- Prerender: pozostawić domyślne zachowanie Astro dla specjalnej strony 404; nie dodawać `prerender = false`, jeśli widok nie wymaga własnej logiki SSR
- Layout: użyć istniejącego `Layout.astro`
- Zachowanie frameworka:
  - bezpośrednie wejście na nieistniejącą trasę powinno automatycznie renderować tę stronę jako custom 404
  - znane strony dynamiczne, które wykrywają brak zasobu, powinny używać przepływu not-found opartego o rewrite do `/404` zamiast redirectu do `/404`

## 3. Struktura komponentów

```text
Layout.astro
└── 404.astro
    └── section
        └── div
            ├── Ikona błędu
            ├── h1
            ├── p z opisem
            └── a „Wróć na mapę"
```

Wzorzec wizualny i układu warto oprzeć na istniejącej stronie `/auth/pending`, ponieważ ma już poprawny układ centrowany, ikonę, nagłówek i CTA w publicznym layoucie.

## 4. Szczegóły komponentów

### `404.astro`

- Opis komponentu:
  - Główna strona widoku 404 renderowana przez Astro.
  - Odpowiada za strukturę sekcji, treść komunikatu, ikonę, CTA oraz meta title.
  - Nie pobiera danych, nie korzysta z hooków i nie wymaga JavaScript po stronie klienta.
- Główne elementy HTML i komponenty dzieci:
  - `Layout` jako wrapper dokumentu i nawigacji.
  - `section` z pełną wysokością roboczą pomniejszoną o wysokość navbaru, wyrównana centralnie.
  - `div` z ograniczoną szerokością, wyrównaniem tekstu do środka i odstępami.
  - dekoracyjny kontener ikony z `aria-hidden="true"`.
  - `h1` jako główny nagłówek strony.
  - 1-2 paragrafy z neutralnym komunikatem.
  - pojedynczy link `a` do strony głównej, stylizowany jak przycisk podstawowy.
- Obsługiwane zdarzenia:
  - kliknięcie CTA „Wróć na mapę” → pełna nawigacja do `/`
  - brak innych zdarzeń interaktywnych
- Warunki walidacji:
  - brak walidacji formularzy
  - widok musi zachować dokładnie jeden nagłówek `h1`
  - CTA musi zawsze wskazywać `/`
  - strona nie może wyświetlać wpisanej przez użytkownika ścieżki, identyfikatora rekordu ani komunikatu technicznego
- Typy:
  - brak nowych DTO
  - brak nowych ViewModeli wymaganych do działania
  - używa istniejących propsów layoutu pośrednio przez `title`
- Propsy, które komponent przyjmuje od rodzica:
  - brak, ponieważ to strona routowana przez Astro

### `Layout.astro`

- Opis komponentu:
  - Bazowy layout publiczny aplikacji, odpowiedzialny za `html lang`, meta viewport, favicon, skip link, nawigację i slot na treść.
  - Zapewnia spójność strony 404 z resztą publicznej aplikacji.
- Główne elementy HTML i komponenty dzieci:
  - `html`, `head`, `body`
  - skip-to-content link
  - `Navbar.astro`
  - `main` z `id="main-content"`
- Obsługiwane zdarzenia:
  - brak lokalnych zdarzeń użytkownika poza tymi, które obsługuje navbar
- Warunki walidacji:
  - z punktu widzenia 404 należy przekazać poprawny `title`
  - nie aktywować `withLeaflet`
- Typy:
  - istniejący interfejs `Props`: `title?: string`, `withLeaflet?: boolean`
  - pośrednio używa istniejącego typu `NavbarUser`
- Propsy, które komponent przyjmuje od rodzica:
  - `title` ustawiony na wariant w rodzaju „404 — Strona nie znaleziona — Shelterly”
  - `withLeaflet` pozostaje `false` lub niewypełnione

### `Navbar.astro`

- Opis komponentu:
  - Publiczna, sticky nawigacja renderowana przez layout.
  - Na stronie 404 pełni rolę dodatkowej ścieżki odzyskania nawigacji i zachowuje spójność z resztą systemu.
- Główne elementy HTML i komponenty dzieci:
  - `header` i `nav`
  - logo prowadzące do `/`
  - linki auth dla anonimowego użytkownika lub menu użytkownika dla zalogowanego
- Obsługiwane zdarzenia:
  - kliknięcie logo
  - kliknięcia linków auth
  - ewentualne interakcje wewnątrz istniejących islands menu na mobile lub dla użytkownika zalogowanego
- Warunki walidacji:
  - bez zmian względem aktualnej implementacji
  - strona 404 nie wymaga żadnych dodatkowych gałęzi renderowania
- Typy:
  - istniejący props `user: NavbarUser | null`
- Propsy, które komponent przyjmuje od rodzica:
  - `user` przekazywany przez layout na podstawie aktualnej sesji

### Korekta flow not-found w istniejących stronach dynamicznych

- Opis komponentu:
  - To nie jest osobny komponent wizualny, lecz wymagany element wdrożenia. Należy zaktualizować strony, które dziś robią redirect do `/404`, aby zamiast tego renderowały stronę 404 w kontekście pierwotnego URL.
- Główne elementy:
  - logika w frontmatterze stron dynamicznych
  - gałęzie warunkowe odpowiedzialne za invalid ID i brak danych
- Obsługiwane zdarzenia:
  - wejście na niepoprawny URL dynamiczny
  - wejście na poprawny route pattern z niepoprawnym ID lub nieistniejącym zasobem
- Warunki walidacji:
  - invalid UUID → widok 404
  - brak klienta Supabase lub brak danych domenowych → widok 404
  - wyjątek not-found lub błąd domenowy traktowany jako not-found → widok 404
  - zamiast redirectu należy użyć podejścia zachowującego semantykę 404, rekomendacyjnie `Astro.rewrite("/404")`
- Typy:
  - bez nowych typów
- Propsy, które komponent przyjmuje od rodzica:
  - nie dotyczy

## 5. Typy

Widok nie wymaga nowych DTO ani nowych modeli ViewModel po stronie klienta.

### Istniejące typy wykorzystywane pośrednio

- `NavbarUser`
  - `name: string | null`
  - `role: UserRole`
  - zastosowanie: renderowanie odpowiedniej wersji navbaru w layoucie
- `UserRole`
  - wartości domenowe roli użytkownika
  - zastosowanie pośrednie w layoucie i navbarze

### DTO wymagane przez widok

- Brak
- Widok 404 nie wywołuje endpointów biznesowych i nie renderuje danych domenowych, więc nie potrzebuje kontraktów request/response.

### ViewModel wymagane przez widok

- Brak obowiązkowych ViewModeli
- Rekomendacja: nie tworzyć lokalnego obiektu typu `NotFoundViewModel`, jeśli treść pozostaje statyczna i składa się z jednego nagłówka, krótkiego opisu oraz jednego CTA.

## 6. Zarządzanie stanem

Widok nie wymaga lokalnego stanu klienta ani customowego hooka.

- Brak `useState`, `useEffect`, contextu i React islands
- Brak formularzy, request lifecycle, optimistic updates i loading states
- Jedyny stan pośredni dotyczy layoutu:
  - layout pobiera sesję użytkownika i profil tylko po to, aby wyrenderować poprawny navbar
  - ta logika już istnieje i nie powinna być rozszerzana specjalnie dla 404

Wniosek: dla samego widoku 404 zarządzanie stanem pozostaje zerowe, a jedynym zachowaniem runtime jest SSR layoutu.

## 7. Integracja API

Dla samego widoku 404 nie ma dedykowanego endpointu, request body ani response DTO.

### Wymagane wywołania API i odpowiadające im akcje frontendowe

- Brak wywołań frontendowych z poziomu `404.astro`
- Brak request helpers, custom hooków i `fetch` do Astro API
- Pośrednio layout wykonuje:
  - pobranie użytkownika z `Astro.locals.supabase.auth.getUser()`
  - pobranie roli i nazwy z tabeli `profiles`

### Typy żądania i odpowiedzi

- Brak typu żądania dla 404
- Brak typu odpowiedzi biznesowej dla 404
- Odpowiedzią jest dokument HTML strony 404 renderowany przez Astro

## 8. Interakcje użytkownika

1. Użytkownik wchodzi na nieistniejący adres.
   - Oczekiwany wynik: widzi stronę 404 z neutralnym komunikatem i CTA do strony głównej.

2. Użytkownik trafia na poprawny route pattern, ale z nieistniejącym zasobem, na przykład błędnym ID schroniska.
   - Oczekiwany wynik: zamiast przekierowania do `/404` wykonywany jest rewrite do treści 404.

3. Użytkownik klika „Wróć na mapę”.
   - Oczekiwany wynik: pełna nawigacja do `/`.

4. Użytkownik klika logo w navbarze.
   - Oczekiwany wynik: pełna nawigacja do `/`.

5. Użytkownik anonimowy korzysta z linków auth w navbarze.
   - Oczekiwany wynik: przejście do logowania lub rejestracji.

6. Użytkownik zalogowany korzysta z menu avatara lub menu mobilnego.
   - Oczekiwany wynik: zachowanie identyczne jak na innych stronach publicznych.

## 9. Warunki i walidacja

### Warunki widoku

- Strona musi być publiczna i dostępna bez sesji.
- Strona musi używać publicznego layoutu zamiast własnego, odizolowanego dokumentu.
- Widok ma pozostać statyczny i bez hydracji Reacta.
- Widok ma zawierać dokładnie jeden główny komunikat i jedno podstawowe CTA prowadzące do `/`.
- Widok nie może pokazywać szczegółów takich jak niepoprawne ID, ścieżka URL użytkownika, stack trace, kod techniczny lub informacja, czy zasób istnieje, ale jest ukryty.

### Warunki dostępności

- `h1` jest obecny i jednoznaczny.
- `section` ma `aria-labelledby` wskazujące na `h1`.
- Ikona jest dekoracyjna i ukryta dla czytników przez `aria-hidden`.
- CTA pozostaje zwykłym linkiem `a`, dzięki czemu działa bez JavaScript.
- Układ musi pozostać czytelny przy responsywnych szerokościach mobilnych i desktopowych.

### Warunki weryfikowane przez interfejs

- `404.astro`:
  - weryfikuje jedynie spójność treści i atrybutów dostępności
- strony dynamiczne korzystające z flow 404:
  - walidacja formatu parametru, jeśli jest wymagana domenowo
  - obsługa przypadku braku danych i błędów domenowych przez rewrite do `/404`

## 10. Obsługa błędów

### Potencjalne scenariusze błędów i zalecana obsługa

- Nieznana ścieżka wpisana ręcznie przez użytkownika
  - obsługa: automatyczne użycie strony 404 przez Astro

- Niepoprawny parametr dynamiczny, na przykład niepoprawny UUID w szczegółach schroniska
  - obsługa: rewrite do `/404`
  - uzasadnienie: użytkownik widzi właściwy komunikat, a flow zachowuje semantykę not-found

- Zasób nie istnieje lub nie powinien być ujawniony użytkownikowi
  - obsługa: rewrite do `/404`
  - uzasadnienie: strona 404 pozostaje neutralna i bezpieczna informacyjnie

- Błąd pobrania sesji lub profilu w layoucie
  - obsługa: zachować aktualne fail-open z logowaniem błędu i wyrenderować stronę z anonimowym navbar

- Pozostawienie `Astro.redirect("/404")` w istniejących trasach
  - obsługa: wykonać grep-audit i wymienić te miejsca w ramach wdrożenia

## 11. Kroki implementacji

1. Utworzyć nowy plik `src/pages/404.astro` i oprzeć go na istniejącym wzorcu z `/auth/pending`, ale uprościć treść do jednego neutralnego komunikatu oraz jednego CTA „Wróć na mapę”.

2. Podpiąć stronę pod `Layout.astro`, ustawić poprawny `title` dokumentu i nie dodawać żadnych React islands ani logiki formularzowej.

3. Zaimplementować strukturę HTML i Tailwind zgodną z aktualnym językiem UI projektu:
   - pełna wysokość robocza z uwzględnieniem navbaru,
   - wyśrodkowany kontener,
   - dekoracyjna ikona błędu,
   - `h1`,
   - krótki opis,
   - podstawowy link CTA do `/`.

4. Dopilnować dostępności widoku:
   - `section` z `aria-labelledby`,
   - jedno `h1`,
   - dekoracyjna ikona z `aria-hidden`,
   - poprawny focus outline dla CTA,
   - brak zależności od JavaScript.

5. Przeprowadzić audit miejsc używających redirectu do `/404` i zamienić ten mechanizm na not-found flow oparty o rewrite. Punktem startowym jest `src/pages/shelter/[id].astro`, gdzie dziś kilka gałęzi kończy się redirectem do `/404`.

6. W `src/pages/shelter/[id].astro` zaktualizować wszystkie gałęzie invalid/not-found:
   - niepoprawny format ID,
   - brak klienta Supabase,
   - brak schroniska w mockach,
   - wyjątek przy pobieraniu danych,
     tak aby finalnie renderowały stronę 404 przez rewrite zamiast redirectu.

7. Wykonać dodatkowy grep po `src/pages` i `src/middleware` pod kątem dalszych wystąpień flow not-found, aby uniknąć niespójności między trasami publicznymi i dynamicznymi.

8. Zweryfikować widok manualnie w przeglądarce:
   - wejście na `/404`,
   - wejście na losowy nieistniejący URL,
   - wejście na `/shelter/niepoprawne-id`,
   - wejście na `/shelter/{uuid-nieistniejącego-rekordu}`,
   - kliknięcie CTA i logo,
   - sprawdzenie renderu anonimowego i zalogowanego navbaru.

9. Uruchomić lint projektu i sprawdzić, czy nowy widok nie wprowadza ostrzeżeń dostępności lub niespójności składni.

10. Jeśli zespół chce zamknąć temat szerzej niż ten widok, dopisać do backlogu technicznego oddzielny task na ujednolicenie obsługi 404/403/redirect dla całego obszaru routingu, ale nie mieszać go z bieżącym wdrożeniem UI strony 404.
