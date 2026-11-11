# Słówka EN ↔ PL

Lekka aplikacja SPA do ćwiczenia słownictwa angielskiego i polskiego. Działa bez frameworków, bibliotek zewnętrznych i procesu budowania. Słownik oraz postępy są obsługiwane lokalnie w przeglądarce.

## Funkcje

- Nauka w kierunkach EN → PL, PL → EN i MIX.
- Losowanie słówek bez powtórzeń w bieżącym obiegu.
- Analiza liter, brakujących i nadmiarowych znaków oraz odpowiedzi z wariantami.
- Opcjonalne ignorowanie polskich znaków.
- Kolejka błędnych odpowiedzi, statystyki sesji, ciemny i jasny motyw.
- Awaryjny słownik wbudowany w aplikację na wypadek błędu pobierania `slowa.txt`.

## Uruchomienie lokalne

Zalecany sposób to dwuklik na `start-local.bat`. Skrypt uruchamia wbudowany serwer Node pod adresem `http://127.0.0.1:8765/` i otwiera stronę w domyślnej przeglądarce. Zamknięcie okna konsoli zatrzymuje serwer. Wymagany jest Node.js dostępny jako polecenie `node`.

Dwuklik na `index.html` także uruchomi aplikację, ale w trybie `file://` przeglądarka nie może pobrać `slowa.txt`. Wtedy aplikacja używa osadzonego w `app.js` słownika z dokładnie 8 parami i pokazuje informację „Tryb lokalny (file://) · słownik wbudowany · 8 słówek” zamiast banera błędu. Pełny słownik z `slowa.txt` jest wczytywany przez `http://` (np. lokalnie przez `start-local.bat`) lub GitHub Pages.

## Edycja słownika

W pliku `slowa.txt` dodaj po jednej parze na linię w formacie `english;polski|wariant`. Puste linie oraz wiersze rozpoczynające się od `#` są pomijane. Plik powinien być zapisany jako UTF-8.

## Wdrożenie na GitHub Pages

1. Utwórz repozytorium na GitHubie i umieść w nim pliki projektu w katalogu głównym.
2. Wypchnij zmiany do gałęzi `main`.
3. Otwórz repozytorium na GitHubie i wybierz **Settings → Pages**.
4. W sekcji **Build and deployment** wybierz **Deploy from a branch**.
5. Wybierz gałąź `main` i katalog `/ (root)`, a następnie kliknij **Save**.
6. Po zakończeniu publikacji otwórz adres strony pokazany w sekcji Pages.

`.nojekyll` wyłącza przetwarzanie Jekyll dla statycznych plików. Aplikacja nie wymaga sekretów ani konfiguracji serwera. Postępy są zapisywane w `localStorage` danej przeglądarki i urządzenia.

## Dostępność i prywatność

Interfejs obsługuje klawiaturę, ma widoczne stany fokusu i komunikaty `aria-live`. Dane postępów pozostają w lokalnej pamięci przeglądarki; aplikacja nie wysyła ich na serwer.
