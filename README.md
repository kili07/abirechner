# Abi-Rechner

Abiturschnitt für das **hessische Abitur** nach OAVO — offline, auf dem Handy,
ohne Konto und ohne dass Daten das Gerät verlassen.

Der eigentliche Zweck ist nicht die Endnote, sondern die Frage davor: wo muss
ich noch nachlegen, solange Q3, Q4 und die Prüfungen offen sind.

## Was drin ist

- **Übersicht** — Gesamtstand in Punkten und Note, daneben Ziel und Differenz.
  Gesicherter Stand und Prognose stehen getrennt nebeneinander; die Balken für
  Block I und Block II zeigen kräftig, was feststeht, und blass, was noch
  Annahme ist.
- **Halbjahre Q1–Q4** — Fächer je Halbjahr anlegen, Punkte eintragen (0–15),
  Einbringung selbst anhaken. Fächer lassen sich aus dem Vorhalbjahr übernehmen.
- **Einbringungsprüfung** — die App entscheidet nicht, sie prüft und meldet:
  fehlende Pflichtkurse namentlich („Deutsch Q2 fehlt"), Unterkurse über dem
  Limit, Kurse mit null Punkten, offene Einträge. Nichts wird gesperrt, ein
  unfertiger Zwischenstand ist jederzeit speicherbar.
- **Prüfungen** — die fünf Prüfungsfächer zuordnen, je Prüfung ein erwarteter
  und ein tatsächlicher Wert. Der tatsächliche sticht den erwarteten.
- **Analyse** — was bis zum Ziel fehlt, welcher Schnitt dafür in den offenen
  Leistungen nötig ist, wie viel jedes offene Halbjahr und jede Prüfung dabei
  beiträgt, die Spanne zwischen bestem und schlechtestem Fall, und wo sich
  Anstrengung überhaupt lohnt: Prüfung vierfach, Leistungskurs doppelt,
  Grundkurs einfach.
- **Szenarien** — Realistisch, Optimistisch, Pessimistisch nebeneinander als
  Note gegen Note. Ein Szenario hält nur Abweichungen für offene Leistungen,
  keine Kopie des Datensatzes, und überstimmt nie ein eingetragenes Ergebnis.
- **Backup** als JSON-Datei, exportieren und wieder einlesen.
- **Testdatensatz** in den Einstellungen — ein vollständiger Beispieljahrgang
  zum Ausprobieren, deutlich als Testdaten gekennzeichnet.
- **Installierbar und offline** — Service Worker, Manifest und Icons sind da.
  Einmal geladen läuft die App ohne Netz weiter.

## Die Rechenregeln

Alle Zahlen aus der Verordnung stehen an genau einer Stelle: in der Konstante
`REGELN` am Kopf von `app.js`, jede mit Quellenangabe im Kommentar. Die
Rechenfunktionen darunter sind rein — kein DOM, kein Zugriff auf den
Datensatz, alles über Parameter.

Grundlage ist die [OAVO](https://www.rv.hessenrecht.hessen.de/perma?a=OSt%2FAbiV_HE),
§ 26 und Anlage 10b, gegengeprüft am OAVO-Ratgeber des Deutschen
Lehrerverbands Hessen von April 2026.

Vier Punkte, an denen verbreitete Online-Rechner danebenliegen:

| | |
|---|---|
| **32 Kurse, nicht 40** | 8 Leistungskurs-Halbjahre (doppelt) + 24 Grundkurse = 40 Wertungen |
| **Keine `× 40`-Formel** | 40 Wertungen × 15 Punkte = 600. Block I ist die schlichte Punktsumme, ganzzahlig, ohne Rundung |
| **80 + 120 statt 200** | Leistungs- und Grundkursbereich werden einzeln geprüft und sind nicht gegeneinander verrechenbar |
| **LK-Unterkurs zählt einfach** | „davon maximal zwei Leistungskurse **in einfacher Wertung**" (§ 26 Abs. 2) |

Dazu: unter den drei Prüfungsfächern mit mindestens 20 Punkten muss ein
Leistungsfach sein (§ 26 Abs. 13 Nr. 2) — der Zusatz fehlt in den meisten
Rechnern.

Die Durchschnittsnote folgt Anlage 10b, also `N = 17/3 − P/180`, auf eine
Nachkommastelle **abgeschnitten** und bei 1,0 gedeckelt. Gerechnet wird
ganzzahlig als `floor((1020 − P) / 18)`.

Abgebildet ist die gymnasiale Oberstufe. Berufliches Gymnasium,
Abendgymnasium und Hessenkolleg (§ 26 Abs. 3 und 8–12) sowie
Präsentationsprüfung und besondere Lernleistung (§ 37) sind bewusst außen vor.

**Ohne Gewähr.** Im Zweifel gilt, was die Schule rechnet.

## Lokal starten

```
python3 -m http.server 8123
```

Dann `http://localhost:8123` aufrufen.

## Aufs Handy bringen

1. Repo auf [github.com/new](https://github.com/new) anlegen, **Public** —
   bei privaten Repos kostet GitHub Pages Geld. Kein README anhaken.
2. „uploading an existing file" → den **Inhalt** dieses Ordners hineinziehen,
   nicht den Ordner selbst. `index.html` muss im Wurzelverzeichnis liegen.
   `.claude/` und `HANDY-WEBAPP-BAUANLEITUNG.md` bleiben draußen.
   `icons/make-icons.py` gehört dagegen dazu.
3. *Settings → Pages → Deploy from a branch, `main`, `/ (root)`* → Save.
4. Nach ein bis zwei Minuten liegt sie unter
   `https://<dein-name>.github.io/abirechner/`.
5. Auf dem Handy in Chrome öffnen → ⋮ → **Zum Startbildschirm hinzufügen**.

Ob wirklich die neue Fassung läuft, steht in den Einstellungen unter
„Version". Daneben sitzt **Nach Update suchen** — der Service Worker liefert
sonst tagelang die alte Fassung weiter.

Bei jedem Update müssen `APP_VERSION` in `app.js` **und** `CACHE` in `sw.js`
hochgezählt werden, sonst ändert sich für die installierte App nichts.

## Plausibilitätsprüfung

Der Rechenkern wird gegen die Verordnung geprüft, nicht gegen sich selbst:
alle Leistungen 15 Punkte → 900 → 1,0; alle 5 Punkte → 300 → 4,0; je ein
Punkt unter jede Mindestbedingung → „nicht bestanden" mit der richtigen
Begründung; die behauptete Sensitivität gegen eine echte Neuberechnung; die
Notentabelle gegen alle 601 Punktzahlen von 300 bis 900; und die Zusage, dass
ein Szenario nie ein bereits eingetragenes Ergebnis überstimmt.

Schlägt eine Probe fehl, liegt der Fehler im Rechenkern — nicht in der Anzeige.

## Aufbau

```
index.html            Gerüst, alle Ansichten als <section>
style.css             Tokens → Themes → Komponenten
app.js                REGELN · Datenmodell · Rechenkern · Ansichten
sw.js                 Offline-Cache
manifest.webmanifest  macht sie installierbar
icons/make-icons.py   erzeugt die drei Icons neu
```

Die Icons werden nicht von Hand gezeichnet, sondern mit
`python3 icons/make-icons.py` erzeugt. Farbe und Größe stehen als Konstanten
am Kopf des Skripts: Hintergrund `#1B1B1B`, weißes Motiv, im voll sichtbaren
Icon 45 % der Kantenlänge breit, im maskable-Icon 32 % — dort schneidet
Android auf einen Kreis mit 40 % Radius zu.

Vanilla JavaScript, kein Build, keine Abhängigkeiten, keine Netzwerkaufrufe.
Die Daten liegen im `localStorage` unter `abirechner.v1`.

**„Browserdaten löschen" räumt alles weg.** Deshalb ab und zu ein Backup
exportieren.
