# Manualny smoke test US.5 dla `/admin`

## Warunki wstępne

- Uruchom lokalnie aplikację i Supabase.
- Zaloguj się kontem z rolą `super_admin`.
- Upewnij się, że w bazie istnieją co najmniej dwa zgłoszenia `pending`:
  - jedno z poprawnym dokumentem weryfikacyjnym,
  - jedno z brakującym dokumentem albo dokumentem nieobsługiwanym inline.

## Scenariusz podstawowy

1. Wejdź na `/admin` jako niezalogowany użytkownik.
   Oczekiwany wynik: przekierowanie do `/auth/login?return=/admin`.

2. Zaloguj się jako `super_admin` i wróć na `/admin`.
   Oczekiwany wynik: widok listy zgłoszeń, licznik kolejki i wejście `Panel admina` w nawigacji.

3. Kliknij pierwszy rekord z dokumentem.
   Oczekiwany wynik: otwiera się panel review, dane schroniska są widoczne, a dokument ładuje się w panelu.

4. Zatwierdź zgłoszenie.
   Oczekiwany wynik: dialog potwierdzenia otwiera się, po akcji pojawia się toast sukcesu, a rekord znika z listy `pending`.

5. Otwórz drugi rekord i spróbuj go odrzucić bez podania powodu.
   Oczekiwany wynik: formularz blokuje zapis i pokazuje komunikat walidacyjny.

6. Podaj poprawny powód odrzucenia i potwierdź akcję.
   Oczekiwany wynik: pojawia się toast sukcesu, a rekord znika z kolejki.

## Scenariusze brzegowe

1. Otwórz rekord bez dokumentu weryfikacyjnego.
   Oczekiwany wynik: panel pokazuje komunikat o braku dokumentu, a akcje zatwierdzenia i odrzucenia są zablokowane.

2. Otwórz rekord z dokumentem w formacie nieobsługiwanym inline.
   Oczekiwany wynik: zamiast preview pojawia się fallback z opcją pobrania i ponowienia próby.

3. Obsłuż ostatni rekord na stronie większej niż `1`.
   Oczekiwany wynik: po decyzji widok cofa się na poprzednią stronę bez pustego stanu na nieistniejącej stronie.

4. Odśwież listę po otwarciu kilku kart z panelem admina.
   Oczekiwany wynik: ręczne odświeżenie pobiera aktualną kolejkę bez przeładowania całej strony.

## Notatka

- W obecnym repo nie ma jawnie opisanych lokalnych danych logowania `super_admin`, więc konto testowe trzeba przygotować zgodnie z lokalnym seedem albo bezpośrednio w Supabase.
