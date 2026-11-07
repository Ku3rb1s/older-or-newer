# Older or Newer

Musik-Quiz wie „Higher or Lower“: Oben steht ein Song mit Jahr, unten läuft ein neuer – **älter oder neuer?**
Richtig → der neue Song rückt nach oben, die Serie wächst. Ein Fehler beendet das Spiel. Teil der
[Jukebox](https://ku3rb1s.github.io/jukebox/) (gleicher Look wie Musik-Bingo und Needle Drop).

**Online:** https://ku3rb1s.github.io/older-or-newer/

Lokal starten: `node server.js` → http://127.0.0.1:8892/

## Wie es funktioniert

- **Songs:** handverlesene Liste in `data/songs-src.txt` (rund 900 Hits 1954–2025) plus automatisch importierte in `data/songs-auto.txt` (`scripts/build-auto.js`, rund 1.300 Hits) – zusammen über 2.100.
  Das Jahr ist die **erste Veröffentlichung** – Deezer und Spotify nennen oft das Jahr von Best-of-Alben oder Remastern, darum kommt es nicht von dort.
- **Jahre geprüft mit MusicBrainz:** `scripts/check-years.js` schlägt jedes Jahr nach (gleiche Logik wie „Originaljahr nachschlagen“
  in Musik-Bingo: früheste Album/Single/EP-Veröffentlichung, ohne Compilations, Bootlegs und Live-Mitschnitte) und listet Abweichungen.
  Das passiert beim Bauen, nicht im Spiel – MusicBrainz erlaubt nur etwa eine Anfrage pro Sekunde.
- **Audio:** 30-s-Vorschauen von Deezer (JSONP, kein Login). Der Vorschau-Link läuft ab, darum wird er erst kurz vorher per `/track/{id}` geholt.
- **Schwierigkeit** (`DIFF` in `js/game.js`): Mindestabstand der Jahre, Bekanntheit der Songs (Deezer-Rang) und Bedenkzeit – Leicht (große Hits, ≥ 10 Jahre), Normal (≥ 5), Schwer (alle, ≥ 2), Profi (ab 1 Jahr, 10 s pro Song). Gleiche Jahre kommen nie vor.
- **Modus:** „Mit Titel“ oder „Nur hören“ (Titel, Interpret und Cover erst nach dem Tipp).
- Rekorde je Songs/Schwierigkeit/Modus und Statistik nur lokal (`oon.*` im Browser-Speicher). Design (`mq.theme`), Sprache (`mq.lang`) und Profil (`jb.profile`) teilt es mit den anderen Spielen.

## Songliste ändern

**Automatischer Import** (`node scripts/build-auto.js`): Songs aus den Deezer-Redaktions-Playlists von Needle Drop und dem Billionärs Club;
ein Song kommt nur rein, wenn MusicBrainz (`scripts/mb.js`) und das Deezer-Album **dasselbe** Jahr nennen. MusicBrainz allein liegt bei
etwa jedem zehnten Song daneben (fehlende Original-Singles, falsch datierte Einträge). Zwischenstände: `data/mb-years.json`, `data/dz-years.json`
(abbrechen und neu starten geht jederzeit). Handverlesene Songs haben Vorrang. Danach `node scripts/build-songs.js`.

**Von Hand:**

1. `data/songs-src.txt` bearbeiten: `Jahr | Interpret | Titel | Zusätze` (`de` = deutscher Act, `dz=123` = feste Deezer-ID, falls die Suche danebenliegt)
2. `node scripts/build-songs.js` – sucht die Deezer-IDs und schreibt `data/songs.json`
3. `node scripts/check-years.js` – prüft die Jahre gegen MusicBrainz und schreibt Abweichungen nach `data/mb-diffs.txt` (Zwischenstand in `data/mb-years.json`, abbrechen und neu starten geht jederzeit)

## Sprachen

Deutsch, Englisch, Französisch, Spanisch, Norwegisch – gleiches System wie Needle Drop (`js/i18n.js`, `js/lang/*.js`).
Texte im Code auf Deutsch mit `tx()`; `node scripts/check-lang.js` zeigt, was fehlt.

## Versionen

Änderungen in [CHANGELOG.md](CHANGELOG.md) und in der App unter Einstellungen → Versionsnummer. Bei jedem Update `APP_VERSION`/`APP_DATE`
in `js/game.js` erhöhen, `CHANGELOG.md` ergänzen und `?v=` in `index.html` hochzählen.

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Markup (Start, Spiel, Ende, Einstellungen) und Icons |
| `css/base.css`, `css/fonts.css`, `fonts/` | gemeinsamer Look aus Musik-Bingo, Schrift Outfit lokal |
| `css/app.css` | Spiel-eigene Teile (Song-Karten, Älter/Neuer-Knöpfe, Ergebnis) |
| `js/game.js` | Spielablauf, Wiedergabe, Anzeige, Einstellungen |
| `js/deezer.js`, `js/i18n.js`, `js/profile.js`, `js/pwa.js` | wie in Needle Drop |
| `data/songs-src.txt` → `data/songs.json` | Songliste mit geprüften Jahren |
| `scripts/` | Songliste bauen, Jahre prüfen, Sprachen prüfen |
| `logo.svg` | Logo „Zeitreise“ (Vorlage für die PNG-Icons); `scripts/logo-options.js` baut eine Auswahlseite mit Varianten |
