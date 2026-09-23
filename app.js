'use strict';

/* ═══════════════════════════════════════════════════════════════
   Abi-Rechner — hessisches Abitur

   Vanilla JS, kein Build, keine Abhängigkeiten, keine Netzwerkaufrufe.
   Aufbau: REGELN · Datenmodell · Rechenkern · Ansichten.
   ═══════════════════════════════════════════════════════════════ */

const KEY = 'abirechner.v1';
const THEME_KEY = 'abirechner.theme';
const APP_VERSION = '1.0.1';

/* ═══════════════════════════════════════════════════════════════
   REGELN — die einzige Stelle, an der Zahlen aus der Verordnung stehen

   Quelle: Oberstufen- und Abiturverordnung Hessen (OAVO) vom 20.07.2009,
   Fassung gültig ab 01.08.2025, insbesondere § 26 (Berechnung der
   Gesamtqualifikation), § 38 Abs. 1 und Anlage 10b.
   Gegengeprüft am Ratgeber des Deutschen Lehrerverbands Hessen zur OAVO,
   Fassung April 2026 — Wortlaut in § 26 identisch, also für das
   Landesabitur 2027 unverändert.

   § 52 (Übergangsregelungen) nennt das Landesabitur 2027 ausdrücklich,
   betrifft aber nur den Prüfungsstoff (§ 25 Abs. 1), nicht die Berechnung.

   Gilt für die gymnasiale Oberstufe. Die Sonderregeln für berufliches
   Gymnasium, Abendgymnasium und Hessenkolleg (§ 26 Abs. 3 und 8 bis 12)
   sind bewusst nicht abgebildet.
   ═══════════════════════════════════════════════════════════════ */
const REGELN = {

  halbjahre: ['q1', 'q2', 'q3', 'q4'],   // § 26 Abs. 4: Q1 bis Q4

  punkte: { min: 0, max: 15 },           // Notenpunkte je Halbjahresergebnis

  /* ── Block I — Qualifikationsphase (§ 26 Abs. 1, 2, 14) ────── */
  block1: {
    /* § 26 Abs. 2 Satz 1: "die 24 anzurechnenden Grundkurse einfach zu
       werten, die acht anzurechnenden Leistungskurse zweifach" */
    lkKurse: 8,
    gkKurse: 24,
    kurseGesamt: 32,      // § 26 Abs. 2 Satz 2: "Unter den 32 einzubringenden Kursen"
    faktorLK: 2,
    faktorGK: 1,

    /* 8 × 2 + 24 × 1 = 40 Wertungen, 40 × 15 Punkte = 600. Block I ist in
       Hessen deshalb die schlichte gewichtete Punktsumme. Es gibt hier
       KEINE (Punktsumme : Wertungen) × 40 — diese Formel der
       KMK-Vereinbarung brauchen nur Länder, in denen die Zahl der
       Wertungen schwankt. In Hessen liegt sie fest auf 40, die Formel
       wäre die Identität. Damit entfällt auch jede Rundung: Block I ist
       immer ganzzahlig. */
    wertungen: 40,

    maxLK: 240,           // § 26 Abs. 1: "maximal 240 Punkte im Leistungskursbereich"
    maxGK: 360,           // § 26 Abs. 1: "maximal 360 Punkte im Grundkursbereich"
    max: 600,             // § 26 Abs. 1

    /* § 26 Abs. 14 — die beiden Bereiche werden EINZELN geprüft und sind
       nicht gegeneinander verrechenbar. Ein starker Grundkursbereich
       rettet keinen zu schwachen Leistungskursbereich. Die Summe ergibt
       zwar 200, aber "Block I ≥ 200" allein ist keine gültige Prüfung. */
    minLK: 80,
    minGK: 120,

    /* § 26 Abs. 2 Satz 3: "Höchstens sechs Kurse dürfen unter fünf Punkten
       sein, davon maximal zwei Leistungskurse in einfacher Wertung."
       "in einfacher Wertung" heißt: ein Leistungskurs unter 5 Punkten
       zählt als EIN Unterkurs, obwohl er für die Punkte doppelt zählt. */
    unterkursGrenze: 5,   // "unter fünf Punkten", also 0 bis 4
    maxUnterkurse: 6,
    maxUnterkurseLK: 2,
    unterkursLKZaehltDoppelt: false,

    /* § 26 Abs. 2 Satz 2: "darf kein Kurs mit null Punkten abgeschlossen sein" */
    nullPunkteEinbringbar: false,
  },

  /* ── Block II — Abiturprüfung (§ 26 Abs. 13, 14) ───────────── */
  block2: {
    pruefungsfaecher: 5,  // § 26 Abs. 13 Nr. 1
    faktor: 4,            // "werden die Ergebnisse vierfach gewertet"
    maxProFach: 60,       // "jeweils maximal 60 Punkte"
    max: 300,             // § 26 Abs. 1
    min: 100,             // § 26 Abs. 14

    /* § 26 Abs. 13 Nr. 2: "In mindestens drei Prüfungsfächern, darunter
       einem Leistungsfach, müssen jeweils mindestens fünf Punkte in
       einfacher Wertung erreicht werden." 5 × 4 = 20 Punkte gewertet.
       Der Zusatz "darunter einem Leistungsfach" fehlt in den meisten
       Online-Rechnern — er ist hier eine eigene Bedingung. */
    mindestfaecher: 3,
    mindestPunkteProFach: 20,
    mindestensEinLK: true,

    /* § 26 Abs. 4 Nr. 1 spricht von "den Leistungskursen im ersten und
       zweiten Prüfungsfach" — in Hessen sind Position 1 und 2 also per
       Definition die Leistungskurse. "darunter einem Leistungsfach" aus
       Nr. 2 heißt damit: eines der drei Fächer mit mindestens 20 Punkten
       muss Position 1 oder 2 sein. Keine zusätzliche Eingabe nötig. */
    lkPositionen: [1, 2],

    /* Drei schriftliche, zwei mündliche Prüfungen. Die Prüfungsart hängt
       an der Position und wird deshalb nicht je Prüfung gespeichert.
       Präsentationsprüfung und besondere Lernleistung (§ 37) sind
       bewusst nicht abgebildet. */
    artNachPosition: ['schriftlich', 'schriftlich', 'schriftlich', 'mündlich', 'mündlich'],

    /* § 26 Abs. 13 Nr. 5: "Die Prüfung darf in keinem Prüfungsfach mit
       null Punkten abgeschlossen sein." */
    nullPunkteErlaubt: false,
  },

  /* ── Gesamtqualifikation und Note (§ 26 Abs. 14, Anlage 10b) ─ */
  gesamt: {
    max: 900,             // 600 + 300
    min: 300,             // § 26 Abs. 14: "mindestens 300 Punkte"

    /* Anlage 10b (zu § 38 Abs. 1) ist die verbindliche Tabelle. Sie ist
       exakt N = 17/3 − P/180, auf eine Nachkommastelle abgeschnitten und
       auf 1,0 bis 4,0 begrenzt — die Tabelle fasst 823 bis 900 zu 1,0
       zusammen, rechnerisch ginge es darunter weiter.

       Gerechnet wird ganzzahlig in Zehnteln:
           zehntel = floor((1020 − P) / 18), begrenzt auf 10 bis 40
       Herleitung: N × 10 = 170/3 − P/18 = (1020 − P)/18.

       Beide Formen wurden gegen alle 601 Punktzahlen von 300 bis 900
       geprüft, beide treffen die Tabelle vollständig. Die Ganzzahlform
       steht hier trotzdem, weil sie exakt ist: die Gleitkommaform trifft
       nur deshalb, weil das Abschneiden an den Zeilengrenzen zufällig
       nach oben ausfällt (17/3 − 318/180 ergibt 3.9000000000000004).
       Auf diesen Zufall will ich mich bei einer Abiturnote nicht
       verlassen. */
    noteZaehler: 1020,
    noteNenner: 18,
    noteBeste: 1.0,
    noteSchlechteste: 4.0,
  },

  /* ── Einbringung (§ 26 Abs. 4, 5, 6) ────────────────────────
     Zahlen und Texte stehen hier, die Prüfmechanik in pruefeEinbringung().
     'rolle' verweist auf faecher[].rolle im Datenmodell — ohne so ein Feld
     kann die App "Deutsch" nicht von einem Fach namens "Deutsch LK bei
     Frau M." unterscheiden. Siehe Rückfrage 1. */
  einbringung: {
    /* § 26 Abs. 4 Nr. 1 — ohne Wahlmöglichkeit einzubringen: die
       Leistungskurse im 1. und 2. Prüfungsfach sowie die Grundkurse Q1
       bis Q4 im 3., 4. und 5. Prüfungsfach. */
    lkAlleHalbjahre: 4,
    gkPruefungsfachAlleHalbjahre: 4,

    /* § 26 Abs. 6 — Verteilung der eingebrachten Kurse auf die
       Aufgabenfelder. 'min' ist die Zahl der Halbjahre.

       'einFach' unterscheidet zwei Formulierungen der Verordnung, die
       sich leicht überlesen lassen: "vier Kurse in EINER Naturwissen-
       schaft" muss ein einziges Fach liefern — zwei Halbjahre Biologie
       plus zwei Halbjahre Chemie erfüllen es nicht. "mindestens zwei
       Kurse in Kunst, Musik oder Darstellendes Spiel" darf dagegen über
       mehrere Fächer zusammenkommen. */
    pflicht: [
      { rolle: 'deutsch',           min: 4, af: 1, einFach: true,  text: 'Deutsch' },                                  // Abs. 6 Nr. 1 a
      { rolle: 'fremdsprache',      min: 4, af: 1, einFach: true,  text: 'eine fortgeführte Fremdsprache' },           // Abs. 6 Nr. 1 a
      { rolle: 'kunstmusikds',      min: 2, af: 1, einFach: false, text: 'Kunst, Musik oder Darstellendes Spiel' },    // Abs. 6 Nr. 1 b
      { rolle: 'geschichte',        min: 2, af: 2, einFach: false, text: 'Geschichte' },                               // Abs. 6 Nr. 2 a
      { rolle: 'powi',              min: 2, af: 2, einFach: false, text: 'Politik und Wirtschaft' },                   // Abs. 6 Nr. 2 b
      { rolle: 'mathematik',        min: 4, af: 3, einFach: true,  text: 'Mathematik' },                               // Abs. 6 Nr. 3 a
      { rolle: 'naturwissenschaft', min: 4, af: 3, einFach: true,  text: 'eine Naturwissenschaft' },                   // Abs. 6 Nr. 3 b
    ],

    /* § 26 Abs. 6 Nr. 2: im gesellschaftswissenschaftlichen Aufgabenfeld
       "mindestens sechs Kurse" insgesamt — mehr als die 2 + 2 oben. */
    aufgabenfeldMin: { 1: 0, 2: 6, 3: 0 },

    /* § 26 Abs. 6 Nr. 1 c und Nr. 3 c sind ein Entweder-oder: zwei Kurse
       in einer weiteren Fremdsprache ODER zwei Kurse in einer zweiten
       Naturwissenschaft bzw. Informatik. Genau ein Zweig muss stehen.
       Die beiden Buchstaben verweisen wörtlich aufeinander ("wenn nicht
       …"), deshalb ist es eine Regel und nicht zwei. */
    entwederOder: {
      min: 2,
      zweigA: { rollen: ['fremdsprache'],                  text: 'eine weitere Fremdsprache' },
      zweigB: { rollen: ['naturwissenschaft', 'informatik'], text: 'eine zweite Naturwissenschaft oder Informatik' },
    },

    /* § 26 Abs. 5 Nr. 1: "aus Sport … bis zu drei Kurse" — freiwillig,
       aber gedeckelt. */
    maxSport: 3,

    /* Rollen, aus denen beim Anlegen eines Fachs gewählt wird. 'sonstiges'
       deckt alles ab, was keine Pflichteinbringung auslöst. */
    rollen: [
      { id: 'deutsch',           text: 'Deutsch',                            af: 1 },
      { id: 'fremdsprache',      text: 'Fremdsprache',                       af: 1 },
      { id: 'kunstmusikds',      text: 'Kunst / Musik / Darstellendes Spiel', af: 1 },
      { id: 'geschichte',        text: 'Geschichte',                         af: 2 },
      { id: 'powi',              text: 'Politik und Wirtschaft',             af: 2 },
      { id: 'gesellschaft',      text: 'andere Gesellschaftswissenschaft',   af: 2 },
      { id: 'mathematik',        text: 'Mathematik',                         af: 3 },
      { id: 'naturwissenschaft', text: 'Naturwissenschaft',                  af: 3 },
      { id: 'informatik',        text: 'Informatik',                         af: 3 },
      { id: 'sport',             text: 'Sport',                              af: null },
      { id: 'religionethik',     text: 'Religion / Ethik',                   af: 2 },
      { id: 'sonstiges',         text: 'sonstiges Fach',                     af: null },
    ],
  },

  aufgabenfelder: {
    1: 'sprachlich-literarisch-künstlerisch',
    2: 'gesellschaftswissenschaftlich',
    3: 'mathematisch-naturwissenschaftlich-technisch',
  },

  /* Ziel-Voreinstellung der Ersteinrichtung. 643 Punkte ist die kleinste
     Punktzahl, die nach Anlage 10b noch 2,0 ergibt. */
  zielVorgabe: { modus: 'note', note: 2.0, punkte: 643 },

  /* ── Bewusst nicht abgebildet ────────────────────────────────

     § 26 Abs. 6 Nr. 2 b ließe statt Politik und Wirtschaft auch
     Wirtschaftswissenschaften oder Geographie zu, Geographie allerdings
     nur, "sofern ab dem ersten Halbjahr der Einführungsphase durchgängig
     belegt". Diese Bedingung könnte die App nicht nachprüfen. Geklärt:
     hier wird Politik und Wirtschaft belegt, das ist unbedingt zulässig.

     § 37 (Präsentationsprüfung, besondere Lernleistung im fünften
     Prüfungsfach) ist nicht abgebildet — es bleibt bei fünf regulären
     Prüfungen. Eine besondere Lernleistung würde nach § 26 Abs. 4 Nr. 1
     vier Pflichtkurse entfallen lassen.

     § 26 Abs. 5 Nr. 2 und 3 erlauben weitere freiwillige Einbringungen.
     Für die Validierung ohne Belang, solange die Gesamtzahl 32 stimmt.

     § 26 Abs. 4 Nr. 3 (bei einer in der Einführungsphase neu begonnenen
     zweiten Fremdsprache sind deren letzte beide Kurse Pflicht) greift
     hier nicht — die zweite Fremdsprache ist längst abgewählt. Damit ist
     auch der Zweig A des Entweder-oder unten faktisch zu: die zwei Kurse
     müssen aus einer zweiten Naturwissenschaft oder Informatik kommen.
     Geprüft werden trotzdem beide Zweige.
  */
};

/* ═══════════════════════════════════════════════════════════════
   Datenmodell

   Vier Entscheidungen, die von der ersten Skizze abweichen — jeweils,
   weil sonst zwei Stellen dasselbe behaupten könnten und irgendwann
   auseinanderlaufen:

   1. `aufgabenfeld` wird NICHT gespeichert. Es hängt eindeutig an der
      Rolle (REGELN.einbringung.rollen[].af). Ein zweites Feld daneben
      könnte der Rolle widersprechen — und dann rechnet die
      Aufgabenfeld-Prüfung gegen etwas anderes als die Fachprüfung.

   2. Die Zuordnung Fach ↔ Prüfungsfach steht NUR am Fach
      (`pruefungsfach: 1..5`). `pruefungen` trägt deshalb keine `fachId`,
      sondern nur die Ergebnisse; die Position ist der Index. Ein
      Rückverweis wäre ein zweiter Ort für dieselbe Wahrheit.

   3. `art` steht nicht je Prüfung, sondern in
      REGELN.block2.artNachPosition — drei schriftliche, zwei mündliche.

   4. `erwartet` gibt es zusätzlich je Halbjahr, nicht nur je Prüfung.
      Ohne das kann die Übersicht für Q4 keine Prognose zeigen, sondern
      nur den gesicherten Stand. Die Halbjahre-Ansicht blendet das Feld
      nur dort ein, wo noch kein Ergebnis eingetragen ist.
   ═══════════════════════════════════════════════════════════════ */

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Ein Fach in einem Halbjahr. Vier davon hängen an jedem Fach. */
const leeresHalbjahr = () => ({
  belegt: false,       // in diesem Halbjahr gewählt? Q3 kann anders aussehen als Q1
  kursart: 'GK',       // 'LK' | 'GK' — siehe Kommentar bei neuesFach()
  punkte: null,        // 0..15, null = noch nicht eingetragen (nicht 0!)
  erwartet: null,      // 0..15, Schätzung für die Prognose, null = keine
  einbringen: false,   // Haken für Block I; die App prüft, entscheidet aber nicht
});

/** `kursart` sitzt am Halbjahr und nicht am Fach: ändert sich das nie,
    kostet es nichts — andersherum wäre es nicht nachrüstbar. */
const neuesFach = (name, rolle) => ({
  id: uid(),
  name: name || '',              // frei wählbar, z.B. "Biologie"
  rolle: rolle || 'sonstiges',   // aus REGELN.einbringung.rollen — steuert die Pflichtprüfung
  pruefungsfach: null,           // 1..5 = Position im Abitur, null = kein Prüfungsfach
  hj: {
    q1: leeresHalbjahr(),
    q2: leeresHalbjahr(),
    q3: leeresHalbjahr(),
    q4: leeresHalbjahr(),
  },
});

/** Eine der fünf Abiturprüfungen. Die Position ist der Index + 1, das
    Fach steht in faecher[].pruefungsfach. */
const leerePruefung = () => ({
  punkte: null,        // 0..15 einfach gewertet, null = Ergebnis liegt noch nicht vor
  erwartet: null,      // 0..15, Schätzung für die Prognose
});

/** Frische Grundstruktur. Basis beim Laden und beim Backup-Import, damit
    später ergänzte Felder in alten Daten nicht fehlen. */
const blank = () => ({
  v: 1,                          // Formatversion des Datensatzes
  setup: false,                  // Ersteinrichtung erledigt?

  schule: {
    abijahr: 2027,               // nur zur Anzeige
    aktuellesHj: 'q3',           // markiert den Tab und trennt "offen" von "gelaufen"
  },

  faecher: [],                   // neuesFach()

  /* Immer genau fünf Einträge, Index 0..4 = Prüfungsfach 1..5. Feste
     Länge, damit die Analyse nicht zwischen "Prüfung fehlt" und
     "Prüfungsfach nicht zugeordnet" raten muss — Letzteres steht an den
     Fächern. */
  pruefungen: [leerePruefung(), leerePruefung(), leerePruefung(),
               leerePruefung(), leerePruefung()],

  /* `modus` sagt, welches der beiden Felder führt. Beide werden
     mitgeführt, damit ein Wechsel der Anzeige den zuletzt von Hand
     gesetzten Wert nicht verliert: Note → Punkte ist verlustbehaftet
     (2,0 deckt 643 bis 660 ab), Punkte → Note ebenso. */
  ziel: Object.assign({}, REGELN.zielVorgabe),

  /* Ein Szenario speichert nur Abweichungen, keine Kopie des Datensatzes.
     Schlüssel: 'hj:<fachId>:<q1|q2|q3|q4>' und 'pf:<1..5>', Wert 0..15.
     Beim Vergleich wird der Datensatz mit diesen Werten überlagert. */
  szenarien: [],                 // {id, name, ueberschreibungen:{}}

  /* Gesetzt vom Testdatensatz-Generator in den Einstellungen. Solange er
     steht, zeigt die App einen deutlichen Hinweis — Testdaten dürfen
     sich nie als echter Stand ausgeben. */
  testdaten: false,

  theme: 'dark',
  lastBackup: null,              // ISO-Zeitstempel des letzten Exports
});

let db = blank();

/* ═══════════════════════════════════════════════════════════════
   Rechenkern — ausschließlich reine Funktionen

   Kein DOM, kein Zugriff auf `db`, nichts außerhalb der Parameter.
   Alle Funktionen bekommen `regeln` übergeben, statt REGELN direkt zu
   lesen — dadurch lässt sich der Kern mit abgewandelten Regeln
   durchrechnen, ohne ihn anzufassen.

   Gerundet wird an genau einer Stelle: in noteFuerPunkte(). Und selbst
   dort wird abgeschnitten, nicht gerundet. Block I und Block II sind
   ganzzahlig, dazwischen entsteht nie ein Bruch.

   Abweichung von der Auftragsskizze: gesamt() bekommt `regeln` als
   dritten Parameter. Ohne das müsste es die Mindestbedingungen aus
   § 26 Abs. 14 fest eingebaut haben — genau das soll nicht passieren.
   ═══════════════════════════════════════════════════════════════ */

/** Alle eingebrachten Kurse als flache Liste. Grundlage für alles
    Weitere in Block I. `punkte: null` heißt "noch nicht eingetragen" und
    ist ausdrücklich nicht dasselbe wie 0 Punkte. */
function eingebrachteKurse(faecher, regeln) {
  const out = [];
  (faecher || []).forEach((f) => {
    regeln.halbjahre.forEach((q) => {
      const h = f.hj && f.hj[q];
      if (!h || !h.belegt || !h.einbringen) return;
      const lk = h.kursart === 'LK';
      out.push({
        fachId: f.id,
        name: f.name,
        rolle: f.rolle,
        hj: q,
        lk,
        wertung: lk ? regeln.block1.faktorLK : regeln.block1.faktorGK,
        punkte: (typeof h.punkte === 'number') ? h.punkte : null,
      });
    });
  });
  return out;
}

/** Block I. Die Punktzahl wird NICHT bei 600 gedeckelt: wer zu viele
    Kurse anhakt, soll das als Befund sehen und nicht als stillschweigend
    gekappte Zahl. */
function berechneBlock1(faecher, regeln) {
  const r = regeln.block1;
  const kurse = eingebrachteKurse(faecher, regeln);

  let punkteLK = 0, punkteGK = 0, wertungen = 0;
  let eingebrachtLK = 0, eingebrachtGK = 0;
  let offen = 0, offeneWertungen = 0;
  let unterkurse = 0, unterkurseLK = 0, nullPunkte = 0;

  kurse.forEach((k) => {
    if (k.lk) eingebrachtLK++; else eingebrachtGK++;
    wertungen += k.wertung;

    if (k.punkte === null) { offen++; offeneWertungen += k.wertung; return; }

    if (k.lk) punkteLK += k.punkte * k.wertung; else punkteGK += k.punkte * k.wertung;
    if (k.punkte === 0) nullPunkte++;

    if (k.punkte < r.unterkursGrenze) {
      /* § 26 Abs. 2 Satz 3 sagt "davon maximal zwei Leistungskurse in
         einfacher Wertung" — ein Leistungskurs unter 5 Punkten zählt als
         EIN Unterkurs, obwohl er für die Punkte doppelt zählt. */
      unterkurse += (k.lk && r.unterkursLKZaehltDoppelt) ? 2 : 1;
      if (k.lk) unterkurseLK++;
    }
  });

  return {
    punkte: punkteLK + punkteGK,
    punkteLK, punkteGK,
    wertungen,
    eingebracht: kurse.length, eingebrachtLK, eingebrachtGK,
    fehlend: Math.max(0, r.kurseGesamt - kurse.length),
    ueberzaehlig: Math.max(0, kurse.length - r.kurseGesamt),
    offen, offeneWertungen,
    unterkurse, unterkurseLK, nullPunkte,
    kurse,
  };
}

/** Block II. Erwartet genau regeln.block2.pruefungsfaecher Einträge;
    fehlende gelten als offen. */
function berechneBlock2(pruefungen, regeln) {
  const r = regeln.block2;
  const proFach = [];
  let punkte = 0, offen = 0, offeneWertungen = 0;
  let mitMindestpunkten = 0, lkMitMindestpunkten = 0, nullPunkte = 0;

  for (let i = 0; i < r.pruefungsfaecher; i++) {
    const p = (pruefungen && pruefungen[i]) || {};
    const pos = i + 1;
    const lk = r.lkPositionen.indexOf(pos) !== -1;
    const roh = (typeof p.punkte === 'number') ? p.punkte : null;
    const gewertet = roh === null ? null : roh * r.faktor;

    if (gewertet === null) {
      offen++; offeneWertungen += r.faktor;
    } else {
      punkte += gewertet;
      if (roh === 0) nullPunkte++;
      if (gewertet >= r.mindestPunkteProFach) {
        mitMindestpunkten++;
        if (lk) lkMitMindestpunkten++;
      }
    }
    proFach.push({ position: pos, art: r.artNachPosition[i], lk, punkte: roh, gewertet });
  }

  return { punkte, proFach, offen, offeneWertungen,
           mitMindestpunkten, lkMitMindestpunkten, nullPunkte };
}

/** Durchschnittsnote nach Anlage 10b. Unter der Mindestpunktzahl gibt es
    keine Note — dann liefert die Funktion null und die Anzeige muss das
    aushalten, statt eine 4,0 zu behaupten. */
function noteFuerPunkte(punkte, regeln) {
  const g = regeln.gesamt;
  if (punkte < g.min) return null;
  const zehntel = Math.floor((g.noteZaehler - punkte) / g.noteNenner);
  const beste = Math.round(g.noteBeste * 10);
  const schlechteste = Math.round(g.noteSchlechteste * 10);
  return Math.min(schlechteste, Math.max(beste, zehntel)) / 10;
}

/** Umkehrung: die KLEINSTE Punktzahl, die diese Note noch ergibt. Die
    Zuordnung ist nicht umkehrbar eindeutig — 2,0 deckt 643 bis 660 ab —,
    deshalb ist die Untergrenze die einzige sinnvolle Antwort auf
    "wie viele Punkte brauche ich dafür". */
function punkteFuerNote(note, regeln) {
  const g = regeln.gesamt;
  const begrenzt = Math.min(g.noteSchlechteste, Math.max(g.noteBeste, note));
  const zehntel = Math.round(begrenzt * 10);
  return Math.max(g.min, g.noteZaehler - g.noteNenner * (zehntel + 1) + 1);
}

/** Gesamtergebnis samt aller Mindestbedingungen aus § 26 Abs. 14 und
    Abs. 13. `gruende` ist leer, wenn nichts dagegenspricht.
    `vollstaendig` sagt, ob das schon eine endgültige Aussage ist. */
function gesamt(b1, b2, regeln) {
  const r1 = regeln.block1, r2 = regeln.block2, g = regeln.gesamt;
  const punkte = b1.punkte + b2.punkte;
  const gruende = [];

  if (punkte < g.min) {
    gruende.push(`Die Gesamtpunktzahl liegt bei ${punkte}, gefordert sind ${g.min}.`);
  }
  if (b1.punkteLK < r1.minLK) {
    gruende.push(`Im Leistungskursbereich sind es ${b1.punkteLK} Punkte, gefordert sind ${r1.minLK}.`);
  }
  if (b1.punkteGK < r1.minGK) {
    gruende.push(`Im Grundkursbereich sind es ${b1.punkteGK} Punkte, gefordert sind ${r1.minGK}.`);
  }
  if (b2.punkte < r2.min) {
    gruende.push(`In der Abiturprüfung sind es ${b2.punkte} Punkte, gefordert sind ${r2.min}.`);
  }
  if (b2.mitMindestpunkten < r2.mindestfaecher) {
    gruende.push(`Nur ${b2.mitMindestpunkten} Prüfungsfächer erreichen ${r2.mindestPunkteProFach} Punkte, `
      + `nötig sind ${r2.mindestfaecher}.`);
  }
  if (r2.mindestensEinLK && b2.lkMitMindestpunkten < 1) {
    gruende.push(`Unter den Prüfungsfächern mit ${r2.mindestPunkteProFach} Punkten ist kein Leistungskurs.`);
  }
  if (!r2.nullPunkteErlaubt && b2.nullPunkte > 0) {
    gruende.push('Eine Abiturprüfung ist mit null Punkten abgeschlossen.');
  }
  if (!r1.nullPunkteEinbringbar && b1.nullPunkte > 0) {
    gruende.push(`${b1.nullPunkte} eingebrachte Kurse haben null Punkte — die sind nicht einbringbar.`);
  }
  if (b1.unterkurse > r1.maxUnterkurse) {
    gruende.push(`${b1.unterkurse} Unterkurse, erlaubt sind ${r1.maxUnterkurse}.`);
  }
  if (b1.unterkurseLK > r1.maxUnterkurseLK) {
    gruende.push(`${b1.unterkurseLK} Leistungskurse unter ${r1.unterkursGrenze} Punkten, `
      + `erlaubt sind ${r1.maxUnterkurseLK}.`);
  }

  return {
    punkte,
    note: noteFuerPunkte(punkte, regeln),
    bestanden: gruende.length === 0,
    gruende,
    vollstaendig: b1.offen === 0 && b2.offen === 0 && b1.fehlend === 0,
  };
}

/** Was in den offenen Leistungen im Schnitt nötig ist. `fixePunkte` ist
    das bereits Gesicherte, `offeneLeistungen` eine Liste mit `wertung`
    je Eintrag (1 oder 2 in Block I, 4 in Block II).
    `schnitt` wird NICHT gerundet — das ist Sache der Anzeige. */
function benoetigt(zielPunkte, fixePunkte, offeneLeistungen, regeln) {
  const wertungen = (offeneLeistungen || []).reduce((s, l) => s + (l.wertung || 1), 0);
  const fehlt = zielPunkte - fixePunkte;
  const max = regeln.punkte.max;
  return {
    fehlt,
    wertungen,
    schnitt: wertungen > 0 ? fehlt / wertungen : null,
    bestenfalls: fixePunkte + wertungen * max,
    schlechtestenfalls: fixePunkte,
    erreichbar: fehlt <= wertungen * max,
    schonErreicht: fehlt <= 0,
  };
}

/** Was ein Punkt mehr bringt. In Block I genau die Wertung des Kurses,
    in Block II der Faktor 4. Steht hier und nicht in der Ansicht, damit
    die Analyse und der Plausibilitätstest dieselbe Behauptung benutzen —
    sonst prüft der Test die Anzeige gegen sich selbst. */
function sensitivitaet(faecher, regeln) {
  const kurse = eingebrachteKurse(faecher, regeln);
  const jeFach = new Map();
  kurse.forEach((k) => {
    const e = jeFach.get(k.fachId)
      || { fachId: k.fachId, name: k.name, halbjahre: 0, wertung: k.wertung, offen: 0 };
    e.halbjahre++;
    if (k.punkte === null) e.offen++;
    e.wertung = k.wertung;          // bei gemischter Kursart gilt die des letzten Halbjahrs
    jeFach.set(k.fachId, e);
  });
  return {
    block1: Array.from(jeFach.values()),
    block2: { faktor: regeln.block2.faktor },
  };
}

/** Legt erwartete Werte und Szenario-Abweichungen über die offenen
    Leistungen und gibt KOPIEN zurück. Danach lesen alle Rechenfunktionen
    unverändert nur `punkte` — sie müssen von Prognose und Szenarien
    nichts wissen. Das hält den Kern frei von Sonderfällen.

    opts: { erwartet: true|false, ueberschreibungen: {'hj:<id>:q4': 12} } */
function mitPrognose(faecher, pruefungen, opts, regeln) {
  opts = opts || {};
  const ueb = opts.ueberschreibungen || {};
  const nutzeErwartet = opts.erwartet !== false;
  /* Beide Quellen greifen NUR in offene Leistungen. Ein Szenario ist eine
     Annahme über die Zukunft und darf ein bereits geschriebenes Ergebnis
     nie überstimmen — sonst zeigt die App eine Note, die es nicht mehr
     geben kann, sobald ein alter Eintrag im Szenario stehenbleibt. */
  const fuellen = (o, schluessel) => {
    if (o.punkte != null) return o;
    if (typeof ueb[schluessel] === 'number') o.punkte = ueb[schluessel];
    else if (nutzeErwartet && typeof o.erwartet === 'number') o.punkte = o.erwartet;
    return o;
  };

  const nf = (faecher || []).map((f) => {
    const hj = {};
    regeln.halbjahre.forEach((q) => {
      hj[q] = fuellen(Object.assign({}, (f.hj && f.hj[q]) || {}), 'hj:' + f.id + ':' + q);
    });
    return Object.assign({}, f, { hj });
  });

  const np = [];
  for (let i = 0; i < regeln.block2.pruefungsfaecher; i++) {
    np.push(fuellen(Object.assign({}, (pruefungen && pruefungen[i]) || {}), 'pf:' + (i + 1)));
  }
  return { faecher: nf, pruefungen: np };
}

/** "Q1, Q2 und Q4" statt "q1,q2,q4". */
function listeHalbjahre(qs) {
  const t = qs.map((q) => q.toUpperCase());
  if (t.length === 0) return '';
  if (t.length === 1) return t[0];
  return t.slice(0, -1).join(', ') + ' und ' + t[t.length - 1];
}

/** Befunde zur Einbringung. Liefert nur eine Liste und sperrt nichts —
    ein unfertiger Zwischenstand muss speicherbar bleiben.

    stufe: 'fehler'   verstößt gegen die Verordnung
           'warnung'  noch nicht erfüllt, aber die Halbjahre laufen noch
           'offen'    Eintrag fehlt schlicht
           'ok'       erfüllt */
function pruefeEinbringung(faecher, regeln) {
  const r = regeln.block1, e = regeln.einbringung;
  const befunde = [];
  const add = (stufe, text) => befunde.push({ stufe, text });

  const kurse = eingebrachteKurse(faecher, regeln);
  const b1 = berechneBlock1(faecher, regeln);
  const liste = faecher || [];
  const benannt = (f) => f.name || '(unbenannt)';

  /* Halbjahre je Fach, die angehakt sind */
  const hjJeFach = new Map();
  kurse.forEach((k) => {
    if (!hjJeFach.has(k.fachId)) hjJeFach.set(k.fachId, []);
    hjJeFach.get(k.fachId).push(k.hj);
  });
  const anzahl = (f) => (hjJeFach.get(f.id) || []).length;
  const mitRolle = (rolle) => liste.filter((f) => f.rolle === rolle);

  /* ── Gesamtzahl (§ 26 Abs. 2) ───────────────────────────────── */
  if (b1.eingebracht === r.kurseGesamt) {
    add('ok', `${r.kurseGesamt} Kurse eingebracht — genau die geforderte Zahl.`);
  } else if (b1.eingebracht < r.kurseGesamt) {
    add('warnung', `${b1.eingebracht} von ${r.kurseGesamt} Kursen eingebracht, `
      + `es fehlen noch ${b1.fehlend}.`);
  } else {
    add('fehler', `${b1.eingebracht} Kurse eingebracht, erlaubt sind ${r.kurseGesamt} — `
      + `${b1.ueberzaehlig} zu viel.`);
  }

  if (b1.eingebrachtLK !== r.lkKurse) {
    add(b1.eingebrachtLK < r.lkKurse ? 'warnung' : 'fehler',
      `${b1.eingebrachtLK} von ${r.lkKurse} Leistungskurs-Halbjahren eingebracht. `
      + 'Alle acht sind Pflicht.');
  }
  if (b1.eingebrachtGK !== r.gkKurse) {
    add(b1.eingebrachtGK < r.gkKurse ? 'warnung' : 'fehler',
      `${b1.eingebrachtGK} von ${r.gkKurse} Grundkursen eingebracht.`);
  }

  /* ── Pflichteinbringung je Fach (§ 26 Abs. 6) ───────────────── */
  e.pflicht.forEach((p) => {
    const kandidaten = mitRolle(p.rolle);

    if (kandidaten.length === 0) {
      /* Kein Fehler, sondern offen: wer mitten in Q3 einsteigt, hat die
         Fächer aus Q1 und Q2 noch gar nicht angelegt. Ein rotes Ausrufe-
         zeichen dafür wäre Meckern, kein Befund. Rot ist nur, was gegen
         die Verordnung verstößt. */
      add('offen', `${p.text}: noch kein Fach angelegt. Dort sind `
        + `${p.min} Halbjahre Pflicht.`);
      return;
    }

    if (p.einFach) {
      /* Muss aus EINEM Fach kommen — siehe Kommentar an REGELN.pflicht. */
      const bestes = kandidaten.reduce((a, f) => (anzahl(f) > anzahl(a) ? f : a), kandidaten[0]);
      const hat = anzahl(bestes);
      if (hat >= p.min) {
        add('ok', `${p.text}: ${benannt(bestes)} mit ${hat} Halbjahren eingebracht.`);
      } else {
        const fehlende = regeln.halbjahre.filter((q) => (hjJeFach.get(bestes.id) || []).indexOf(q) === -1);
        add('warnung', `${benannt(bestes)}: ${listeHalbjahre(fehlende)} `
          + `${fehlende.length === 1 ? 'fehlt' : 'fehlen'} — `
          + `für ${p.text} sind alle ${p.min} Halbjahre Pflicht.`);
      }
    } else {
      const summe = kandidaten.reduce((s, f) => s + anzahl(f), 0);
      if (summe >= p.min) add('ok', `${p.text}: ${summe} Halbjahre eingebracht.`);
      else add('warnung', `${p.text}: ${summe} von ${p.min} Halbjahren eingebracht.`);
    }
  });

  /* ── Aufgabenfelder (§ 26 Abs. 6 Nr. 2) ─────────────────────── */
  const afVon = (rolle) => {
    const treffer = e.rollen.filter((x) => x.id === rolle)[0];
    return treffer ? treffer.af : null;
  };
  const afZaehler = { 1: 0, 2: 0, 3: 0 };
  kurse.forEach((k) => { const af = afVon(k.rolle); if (af) afZaehler[af]++; });

  Object.keys(e.aufgabenfeldMin).forEach((af) => {
    const min = e.aufgabenfeldMin[af];
    if (min <= 0) return;
    const ist = afZaehler[af] || 0;
    if (ist >= min) {
      add('ok', `Aufgabenfeld ${af} (${regeln.aufgabenfelder[af]}): ${ist} Kurse.`);
    } else {
      add('warnung', `Aufgabenfeld ${af} (${regeln.aufgabenfelder[af]}): ${ist} von ${min} Kursen. `
        + 'Religion oder Ethik zählt hier mit.');
    }
  });

  /* ── Das Entweder-oder aus § 26 Abs. 6 Nr. 1 c und Nr. 3 c ──── */
  const eo = e.entwederOder;
  const absteigend = (rolle) => mitRolle(rolle).map(anzahl).sort((a, b) => b - a);
  const fs = absteigend('fremdsprache');
  const nw = absteigend('naturwissenschaft');
  const inf = absteigend('informatik');
  /* Das erste Fach deckt schon die vier Pflichtkurse ab, gesucht ist das
     zweite — deshalb fs[1] und nw[1], bei Informatik dagegen inf[0]. */
  const zweigA = fs.length > 1 && fs[1] >= eo.min;
  const zweigB = (nw.length > 1 && nw[1] >= eo.min) || (inf.length > 0 && inf[0] >= eo.min);

  if (zweigA || zweigB) {
    const welcher = zweigA ? eo.zweigA.text : eo.zweigB.text;
    add('ok', `Die zusätzlichen ${eo.min} Kurse stehen: ${welcher}.`);
  } else {
    add('warnung', `Es fehlen ${eo.min} Kurse in ${eo.zweigA.text} oder in ${eo.zweigB.text} — `
      + 'eines von beidem verlangt § 26 Abs. 6.');
  }

  /* ── Unterkurse (§ 26 Abs. 2 Satz 3) ────────────────────────── */
  if (b1.unterkurse > r.maxUnterkurse) {
    add('fehler', `${b1.unterkurse} eingebrachte Kurse unter ${r.unterkursGrenze} Punkten, `
      + `erlaubt sind ${r.maxUnterkurse}.`);
  } else if (b1.unterkurse > 0) {
    add('ok', `${b1.unterkurse} von ${r.maxUnterkurse} erlaubten Unterkursen.`);
  }
  if (b1.unterkurseLK > r.maxUnterkurseLK) {
    add('fehler', `${b1.unterkurseLK} Leistungskurse unter ${r.unterkursGrenze} Punkten, `
      + `erlaubt sind ${r.maxUnterkurseLK}.`);
  }

  /* ── Nullpunkte (§ 26 Abs. 2 Satz 2) ────────────────────────── */
  kurse.filter((k) => k.punkte === 0).forEach((k) => {
    add('fehler', `${benannt(k)} ${k.hj.toUpperCase()} hat null Punkte und ist damit `
      + 'nicht einbringbar. Nimm den Haken weg.');
  });

  /* ── Sport (§ 26 Abs. 5 Nr. 1) ──────────────────────────────── */
  const sport = kurse.filter((k) => k.rolle === 'sport').length;
  if (sport > e.maxSport) {
    add('fehler', `${sport} Sportkurse eingebracht, erlaubt sind ${e.maxSport}.`);
  }

  /* ── Was noch offen ist ─────────────────────────────────────── */
  if (b1.offen > 0) {
    add('offen', `${b1.offen} eingebrachte Kurse haben noch kein Ergebnis.`);
  }

  /* ── Prüfungsfächer vollständig zugeordnet? ─────────────────── */
  const belegtePositionen = liste.map((f) => f.pruefungsfach).filter((p) => p);
  for (let pos = 1; pos <= regeln.block2.pruefungsfaecher; pos++) {
    const treffer = belegtePositionen.filter((p) => p === pos).length;
    if (treffer === 0) add('offen', `Für Prüfungsfach ${pos} ist noch kein Fach zugeordnet.`);
    else if (treffer > 1) add('fehler', `Prüfungsfach ${pos} ist ${treffer} Fächern zugeordnet.`);
  }

  return befunde;
}

/* ═══════════════════════════════════════════════════════════════
   Testdaten

   Ein vollständiger, regelkonformer Jahrgang: 8 Leistungskurs-Halbjahre,
   24 Grundkurse, alle Pflichteinbringungen erfüllt, alle fünf
   Prüfungsfächer zugeordnet. Steht hier und nicht in der
   Einstellungsansicht, damit der Plausibilitätstest genau den Datensatz
   prüft, den die App auch erzeugt.

   Die Verteilung: Aufgabenfeld 1, 2 und 3 je 10 Kurse, dazu 2 Sport.
   Das Entweder-oder ist über Chemie als zweite Naturwissenschaft gelöst.
   ═══════════════════════════════════════════════════════════════ */
const TESTFAECHER = [
  { name: 'Deutsch',                rolle: 'deutsch',           kursart: 'LK', pf: 1,    hj: ['q1', 'q2', 'q3', 'q4'] },
  { name: 'Biologie',               rolle: 'naturwissenschaft', kursart: 'LK', pf: 2,    hj: ['q1', 'q2', 'q3', 'q4'] },
  { name: 'Mathematik',             rolle: 'mathematik',        kursart: 'GK', pf: 3,    hj: ['q1', 'q2', 'q3', 'q4'] },
  { name: 'Politik und Wirtschaft', rolle: 'powi',              kursart: 'GK', pf: 4,    hj: ['q1', 'q2', 'q3', 'q4'] },
  { name: 'Geschichte',             rolle: 'geschichte',        kursart: 'GK', pf: 5,    hj: ['q1', 'q2', 'q3', 'q4'] },
  { name: 'Englisch',               rolle: 'fremdsprache',      kursart: 'GK', pf: null, hj: ['q1', 'q2', 'q3', 'q4'] },
  { name: 'Kunst',                  rolle: 'kunstmusikds',      kursart: 'GK', pf: null, hj: ['q1', 'q2'] },
  { name: 'Ethik',                  rolle: 'religionethik',     kursart: 'GK', pf: null, hj: ['q1', 'q2'] },
  { name: 'Chemie',                 rolle: 'naturwissenschaft', kursart: 'GK', pf: null, hj: ['q3', 'q4'] },
  { name: 'Sport',                  rolle: 'sport',             kursart: 'GK', pf: null, hj: ['q3', 'q4'] },
];

/** `punkteFuer` ist eine Zahl für alle Kurse oder eine Funktion, die je
    Kurs entscheidet — damit lassen sich gezielt einzelne Leistungen
    verbiegen, ohne den Generator zu ändern. */
function testdatensatz(punkteFuer) {
  const wert = (typeof punkteFuer === 'function') ? punkteFuer : () => punkteFuer;
  return TESTFAECHER.map((t) => {
    const f = neuesFach(t.name, t.rolle);
    f.pruefungsfach = t.pf;
    t.hj.forEach((q) => {
      f.hj[q] = {
        belegt: true,
        kursart: t.kursart,
        punkte: wert({ name: t.name, rolle: t.rolle, hj: q, lk: t.kursart === 'LK' }),
        erwartet: null,
        einbringen: true,
      };
    });
    return f;
  });
}

function testpruefungen(punkteFuer, regeln) {
  const wert = (typeof punkteFuer === 'function') ? punkteFuer : () => punkteFuer;
  const out = [];
  for (let i = 0; i < regeln.block2.pruefungsfaecher; i++) {
    const pos = i + 1;
    out.push({
      punkte: wert({ position: pos, lk: regeln.block2.lkPositionen.indexOf(pos) !== -1 }),
      erwartet: null,
    });
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════
   ── Ab hier DOM ──
   Alles darüber ist frei von Browser-Abhängigkeiten und wird vom
   Plausibilitätstest in Node geladen. Diese Zeile ist die Trennmarke;
   wenn sie verrutscht, schlägt der Test fehl statt stillschweigend
   weniger zu prüfen.
   ═══════════════════════════════════════════════════════════════ */

/* `bar` ist die Hintergrundfarbe des Themes und landet im
   <meta name="theme-color">, damit die Systemleiste mitzieht — muss mit
   --bg in style.css übereinstimmen. */
const THEMES = {
  dark:  { label: 'Dunkel', bar: '#0b0e14' },
  light: { label: 'Hell',   bar: '#f3f5f9' },
};

/* ── Helfer ─────────────────────────────────────────────────── */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const dfLong = new Intl.DateTimeFormat('de-DE',
  { day: '2-digit', month: 'short', year: 'numeric' });

/** Note oder Punktzahl für die Anzeige. null heißt "gibt es nicht", und
    das muss sichtbar sein statt als 0 durchzurutschen. */
const zeigeNote = (n) => (n === null || n === undefined) ? '—' : nf1.format(n);

/** Eingabe auf einen gültigen Notenpunkt eindampfen. Alles andere wird
    null — ein leeres Feld ist ausdrücklich nicht 0 Punkte. */
function punkteOderNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = parseInt(v, 10);
  return (isFinite(n) && n >= REGELN.punkte.min && n <= REGELN.punkte.max) ? n : null;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
}

/* ── Persistenz ─────────────────────────────────────────────── */

/** Fremden Datensatz auf die aktuelle Struktur bringen. Object.assign
    allein reicht nicht: es ersetzt verschachtelte Objekte im Ganzen — ein
    älteres Fach ohne das Feld `rolle` würde die Vorgabe nicht ergänzen,
    sondern löschen. Daten haben Vorrang vor Vorgabe. */
function normalize(src) {
  const base = blank();
  const d = Object.assign(blank(), src || {});
  delete d.meta;                          // Kopfdaten des Backups gehören nicht in die Daten

  d.schule = Object.assign({}, base.schule, d.schule || {});
  d.schule.abijahr = parseInt(d.schule.abijahr, 10) || base.schule.abijahr;
  if (REGELN.halbjahre.indexOf(d.schule.aktuellesHj) === -1) {
    d.schule.aktuellesHj = base.schule.aktuellesHj;
  }

  const rollenIds = REGELN.einbringung.rollen.map((r) => r.id);
  d.faecher = Array.isArray(d.faecher) ? d.faecher : [];
  d.faecher.forEach((f) => {
    if (!f.id) f.id = uid();
    f.name = String(f.name == null ? '' : f.name);
    if (rollenIds.indexOf(f.rolle) === -1) f.rolle = 'sonstiges';
    const pf = parseInt(f.pruefungsfach, 10);
    f.pruefungsfach = (pf >= 1 && pf <= REGELN.block2.pruefungsfaecher) ? pf : null;

    const hj = {};
    REGELN.halbjahre.forEach((q) => {
      const h = Object.assign(leeresHalbjahr(), (f.hj && f.hj[q]) || {});
      h.belegt = !!h.belegt;
      h.kursart = (h.kursart === 'LK') ? 'LK' : 'GK';
      h.punkte = punkteOderNull(h.punkte);
      h.erwartet = punkteOderNull(h.erwartet);
      /* Ein nicht belegtes Halbjahr kann nicht eingebracht werden — sonst
         zählt ein abgewähltes Fach stillschweigend in Block I mit. */
      h.einbringen = !!h.einbringen && h.belegt;
      hj[q] = h;
    });
    f.hj = hj;
  });

  /* Jede Prüfungsfach-Position höchstens einmal. Bei einer Dublette aus
     einem alten Backup gewinnt das erste Fach, das zweite verliert die
     Zuordnung — lieber eine sichtbare Lücke als zwei Fächer, die sich um
     dieselbe Prüfung streiten. */
  const vergeben = {};
  d.faecher.forEach((f) => {
    if (!f.pruefungsfach) return;
    if (vergeben[f.pruefungsfach]) f.pruefungsfach = null;
    else vergeben[f.pruefungsfach] = true;
  });

  const roh = Array.isArray(d.pruefungen) ? d.pruefungen : [];
  d.pruefungen = [];
  for (let i = 0; i < REGELN.block2.pruefungsfaecher; i++) {
    const p = Object.assign(leerePruefung(), roh[i] || {});
    p.punkte = punkteOderNull(p.punkte);
    p.erwartet = punkteOderNull(p.erwartet);
    d.pruefungen.push(p);
  }

  d.ziel = Object.assign({}, base.ziel, d.ziel || {});
  if (d.ziel.modus !== 'punkte') d.ziel.modus = 'note';

  d.szenarien = Array.isArray(d.szenarien) ? d.szenarien : [];
  d.szenarien.forEach((s) => {
    if (!s.id) s.id = uid();
    if (!s.ueberschreibungen || typeof s.ueberschreibungen !== 'object') s.ueberschreibungen = {};
  });

  d.setup = !!d.setup;
  d.testdaten = !!d.testdaten;
  if (!THEMES[d.theme]) d.theme = base.theme;
  return d;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    db = normalize(JSON.parse(raw));
  } catch (e) { console.warn('Laden fehlgeschlagen', e); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('Speichern fehlgeschlagen!'); console.error(e); }
}

/** Theme aufs Dokument legen. Der Spiegel in THEME_KEY ist das, was das
    Startskript in index.html liest — ohne ihn flackert der Start. */
function applyTheme(t) {
  if (!THEMES[t]) t = 'dark';
  db.theme = t;
  document.documentElement.dataset.theme = t;
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = THEMES[t].bar;
  try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* nicht schlimm */ }
}

/* ── Sheet-System ───────────────────────────────────────────── */
let sheetSaveFn = null;

function openSheet(title, html, saveFn, saveLabel) {
  armBack();                              // Zurück soll das Sheet schließen, nicht die App
  $('#sheetTitle').textContent = title;
  $('#sheetBody').innerHTML = html;
  $('#sheetBody').onclick = null;         // Handler des vorherigen Sheets verwerfen
  $('#sheetCancel').onclick = closeSheet; // ggf. überschriebenes Abbrechen zurücksetzen
  sheetSaveFn = saveFn || null;
  const btn = $('#sheetSave');
  btn.classList.toggle('hidden', !saveFn);
  btn.textContent = saveLabel || 'Sichern';
  $('#sheet').classList.remove('hidden');
  $('#scrim').classList.remove('hidden');
  $('#sheetBody').scrollTop = 0;
}

function closeSheet() {
  $('#sheet').classList.add('hidden');
  $('#scrim').classList.add('hidden');
  sheetSaveFn = null;
}

/* ── Dialoge ────────────────────────────────────────────────────
   Ersatz für confirm() / prompt() / alert(): installierte Web-Apps
   unterdrücken die nativen Dialoge je nach Gerät kommentarlos — der Knopf
   tut dann scheinbar nichts. `back` führt zurück zum vorherigen Sheet
   statt alles zuzuklappen. */

function askSheet(title, text, okLabel, onOk, back, danger) {
  openSheet(title, `
    <p class="dlg-t">${esc(text)}</p>
    <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-block" id="dlgOk">${esc(okLabel)}</button>
    <button class="btn btn-block" id="dlgNo" style="margin-top:8px">Abbrechen</button>
  `, null);
  const zurueck = () => (back ? back() : closeSheet());
  $('#dlgOk').onclick = onOk;
  $('#dlgNo').onclick = zurueck;
  $('#sheetCancel').onclick = zurueck;
}

function infoSheet(title, text, back) {
  openSheet(title, `
    <p class="dlg-t">${esc(text)}</p>
    <button class="btn btn-primary btn-block" id="dlgOk">Verstanden</button>
  `, null);
  const zurueck = () => (back ? back() : closeSheet());
  $('#dlgOk').onclick = zurueck;
  $('#sheetCancel').onclick = zurueck;
}

/** Einzeiliger Texteingabe-Dialog. `opts`: {value, placeholder, numeric, okLabel} */
function askText(title, label, opts, onOk, back) {
  opts = opts || {};
  openSheet(title, `
    <label>${esc(label)}<input id="dlg_in"
      ${opts.numeric ? 'type="number" inputmode="decimal" step="any"' : 'autocomplete="off"'}
      placeholder="${esc(opts.placeholder || '')}"
      value="${esc(opts.value == null ? '' : opts.value)}"></label>
  `, () => onOk($('#dlg_in').value), opts.okLabel || 'Übernehmen');
  if (back) $('#sheetCancel').onclick = back;
  const inp = $('#dlg_in');
  inp.focus(); inp.select && inp.select();
  inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); sheetSaveFn && sheetSaveFn(); } };
}

/* ── Zurück-Taste ───────────────────────────────────────────────
   Ohne Zutun beendet ein einziger Druck auf Zurück die installierte App.
   Ein zusätzlicher Verlaufseintrag ("Wächter") fängt das ab: Zurück
   schließt der Reihe nach, was offen ist, und fragt erst auf der
   Übersicht nach. */
let guardUp = false;
let leaving = false;

function pushGuard() {
  if (guardUp) return;
  guardUp = true;
  try { history.pushState({ g: 1 }, ''); } catch (e) { guardUp = false; }
}

function armBack() { pushGuard(); }

/** "Verlassen" im Abschiedsdialog: der Dialog hat selbst einen Wächter
    aufgebaut (jedes Sheet tut das). Erst ihn abräumen, dann führt der
    zweite Schritt aus der App. Beides muss über zwei Runden laufen —
    history.back() zweimal hintereinander fasst der Browser zu einem
    Schritt zusammen. */
function leaveApp() {
  closeSheet();
  leaving = true;
  history.back();
}

function wireBack() {
  pushGuard();
  window.addEventListener('popstate', () => {
    guardUp = false;

    if (leaving) {
      leaving = false;
      history.back();
      // Falls nichts mehr zum Zurückgehen da ist, bleiben wir hier — dann
      // fehlt der Wächter. Kein Timer zum Nachrüsten: ein pushState würde
      // den laufenden Schritt abbrechen und genau das Verlassen verhindern.
      document.addEventListener('pointerdown', pushGuard, { once: true });
      return;
    }
    // Über den Abbrechen-Knopf, nicht über closeSheet: verschachtelte Sheets
    // haben dort ihren Rückweg zum vorherigen Sheet hinterlegt.
    if (!$('#sheet').classList.contains('hidden')) { $('#sheetCancel').click(); pushGuard(); return; }
    if (view !== 'home') { nav('home'); pushGuard(); return; }

    askSheet('App verlassen?', 'Möchtest Du die App wirklich schließen?',
      'Verlassen', leaveApp);
  });
}

/* ── Navigation ─────────────────────────────────────────────── */
const TITLES = {
  home: 'Übersicht', halbjahre: 'Halbjahre',
  pruefungen: 'Prüfungen', analyse: 'Analyse',
};
let view = 'home';

function nav(v) {
  view = v;
  $$('.view').forEach((s) => s.classList.toggle('hidden', s.id !== 'view-' + v));
  $$('.tabbar button[data-nav]').forEach((b) => b.classList.toggle('on', b.dataset.nav === v));
  $('#viewTitle').textContent = TITLES[v] || '';
  window.scrollTo(0, 0);
  armBack();
  render();
}

/** Alles neu zeichnen. Bei diesen Datenmengen ist gezieltes Aktualisieren
    unnötige Komplexität — einmal neu rendern ist schnell genug und kann
    nicht aus dem Tritt geraten. Ausnahme sind die Punktefelder, siehe
    aktualisiereHjWerte(). */
function render() {
  $('#testBanner').classList.toggle('hidden', !db.testdaten);
  if (view === 'home') renderHome();
  else if (view === 'halbjahre') renderHalbjahre();
  else if (view === 'pruefungen') renderPruefungen();
  else if (view === 'analyse') renderAnalyse();
}

/* ── Gemeinsame Bausteine ───────────────────────────────────── */

const rolleText = (id) => {
  const r = REGELN.einbringung.rollen.filter((x) => x.id === id)[0];
  return r ? r.text : id;
};

const HAKEN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">'
  + '<path d="M4 12l6 6L20 6"/></svg>';

/** Befundliste mit Ampel. Fehler zuerst, dann Warnungen, dann Offenes —
    das Erledigte ganz unten, weil es nur zur Beruhigung da ist. */
function befundeHtml(befunde) {
  const rang = { fehler: 0, warnung: 1, offen: 2, ok: 3 };
  const sortiert = befunde.slice().sort((a, b) => rang[a.stufe] - rang[b.stufe]);
  if (!sortiert.length) return '<p class="leer">Noch nichts zu prüfen.</p>';
  return sortiert.map((b) =>
    `<div class="befund befund-${b.stufe}"><i></i><span>${esc(b.text)}</span></div>`).join('');
}

/* ── Ersteinrichtung ────────────────────────────────────────── */

function rollenOptionen(gewaehlt) {
  return REGELN.einbringung.rollen.map((r) =>
    `<option value="${r.id}"${r.id === gewaehlt ? ' selected' : ''}>${esc(r.text)}</option>`).join('');
}

function openSetup() {
  openSheet('Ersteinrichtung', `
    <p class="dlg-t klein muted">Die beiden Leistungskurse sind in Hessen automatisch das
    erste und zweite Prüfungsfach (§ 26 Abs. 4). Alles andere trägst Du danach ein.</p>
    <label>Abiturjahr
      <input id="s_jahr" type="number" inputmode="numeric" step="1" value="${db.schule.abijahr}"></label>
    <label>Laufendes Halbjahr
      <select id="s_hj">${REGELN.halbjahre.map((q) =>
        `<option value="${q}"${q === db.schule.aktuellesHj ? ' selected' : ''}>${q.toUpperCase()}</option>`).join('')}</select></label>
    <label>1. Leistungskurs — Name
      <input id="s_lk1" autocomplete="off" placeholder="z. B. Deutsch"></label>
    <label>1. Leistungskurs — Fach
      <select id="s_lk1r">${rollenOptionen('deutsch')}</select></label>
    <label>2. Leistungskurs — Name
      <input id="s_lk2" autocomplete="off" placeholder="z. B. Biologie"></label>
    <label>2. Leistungskurs — Fach
      <select id="s_lk2r">${rollenOptionen('naturwissenschaft')}</select></label>
  `, () => {
    const n1 = $('#s_lk1').value.trim(), n2 = $('#s_lk2').value.trim();
    if (!n1 || !n2) { toast('Beide Leistungskurse brauchen einen Namen'); return; }

    db.schule.abijahr = parseInt($('#s_jahr').value, 10) || db.schule.abijahr;
    db.schule.aktuellesHj = $('#s_hj').value;

    [[n1, $('#s_lk1r').value, 1], [n2, $('#s_lk2r').value, 2]].forEach(([name, rolle, pos]) => {
      const f = neuesFach(name, rolle);
      f.pruefungsfach = pos;
      /* Alle acht Leistungskurs-Halbjahre sind Pflichteinbringung — der
         Haken sitzt deshalb von Anfang an und nicht erst nach Klick. */
      REGELN.halbjahre.forEach((q) => {
        f.hj[q] = { belegt: true, kursart: 'LK', punkte: null, erwartet: null, einbringen: true };
      });
      db.faecher.push(f);
    });

    db.setup = true;
    save(); closeSheet(); hjTab = db.schule.aktuellesHj; nav('halbjahre');
    toast('Los geht’s — trag Dein laufendes Halbjahr ein');
  }, 'Anlegen');
}

/* ── Halbjahre ──────────────────────────────────────────────── */

let hjTab = null;
const hjAktiv = () => (REGELN.halbjahre.indexOf(hjTab) !== -1) ? hjTab : db.schule.aktuellesHj;

/** Kennzahlen eines einzelnen Halbjahrs. Bewusst getrennt vom Rechenkern:
    hier geht es um die Anzeige eines Halbjahrs, nicht um Block I. */
function hjStatistik(q) {
  let summe = 0, mitNote = 0, unter = 0, eingebracht = 0;
  db.faecher.forEach((f) => {
    const h = f.hj[q];
    if (!h.belegt) return;
    if (h.einbringen) eingebracht++;
    if (h.punkte === null) return;
    summe += h.punkte; mitNote++;
    if (h.punkte < REGELN.block1.unterkursGrenze) unter++;
  });
  return { summe, mitNote, unter, eingebracht,
           schnitt: mitNote ? summe / mitNote : null };
}

function hjStatsHtml(s) {
  return `<div class="stat-reihe">
    <div class="stat"><div class="stat-k">Punktsumme</div><div class="stat-v num">${s.summe}</div></div>
    <div class="stat"><div class="stat-k">Schnitt</div>
      <div class="stat-v num">${s.schnitt === null ? '—' : nf1.format(s.schnitt)}</div></div>
    <div class="stat"><div class="stat-k">Unterkurse</div>
      <div class="stat-v num${s.unter ? ' down' : ''}">${s.unter}</div></div>
    <div class="stat"><div class="stat-k">Eingebracht</div><div class="stat-v num">${s.eingebracht}</div></div>
  </div>`;
}

function renderHalbjahre() {
  const el = $('#view-halbjahre');

  if (!db.setup && !db.faecher.length) {
    el.innerHTML = `<div class="card"><p class="leer">Noch keine Fächer angelegt.</p>
      <button class="btn btn-primary btn-block" data-aktion="setup">Ersteinrichtung starten</button></div>`;
    return;
  }

  const q = hjAktiv();
  const idx = REGELN.halbjahre.indexOf(q);
  const vorher = idx > 0 ? REGELN.halbjahre[idx - 1] : null;
  const imHj = db.faecher.filter((f) => f.hj[q].belegt);

  const zeilen = imHj.map((f) => {
    const h = f.hj[q];
    const unter = h.punkte !== null && h.punkte < REGELN.block1.unterkursGrenze;
    const pf = f.pruefungsfach ? ` · ${f.pruefungsfach}. Prüfungsfach` : '';
    return `<div class="zeile">
      <button class="zeile-name" data-fach="${f.id}">
        <strong>${esc(f.name || '(unbenannt)')}</strong>
        <span class="zeile-meta">
          <span class="badge${h.kursart === 'LK' ? ' lk' : ''}">${h.kursart}</span>
          ${esc(rolleText(f.rolle))}${esc(pf)}
        </span>
      </button>
      <input class="punkt-in${unter ? ' unter' : ''}" type="number" inputmode="numeric"
        min="${REGELN.punkte.min}" max="${REGELN.punkte.max}" step="1"
        data-punkte="${f.id}" value="${h.punkte === null ? '' : h.punkte}"
        placeholder="–" aria-label="Punkte ${esc(f.name)} ${q.toUpperCase()}">
      <button class="haken" data-haken="${f.id}" aria-pressed="${h.einbringen}"
        aria-label="${h.einbringen ? 'Nicht einbringen' : 'Einbringen'}"><span>${HAKEN_SVG}</span></button>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="seg">${REGELN.halbjahre.map((x) =>
      `<button data-hj="${x}" class="${x === q ? 'on' : ''}${x === db.schule.aktuellesHj ? ' jetzt' : ''}"
        >${x.toUpperCase()}</button>`).join('')}</div>

    <div class="card" id="hjStats">${hjStatsHtml(hjStatistik(q))}</div>

    <div class="card">
      <p class="card-titel">Fächer in ${q.toUpperCase()}</p>
      ${zeilen || '<p class="leer">In diesem Halbjahr ist noch kein Fach belegt.</p>'}
      <div class="btn-reihe">
        <button class="btn" data-aktion="fach-neu">Fach hinzufügen</button>
        ${vorher ? `<button class="btn" data-aktion="uebernehmen">Aus ${vorher.toUpperCase()} übernehmen</button>` : ''}
      </div>
    </div>

    <div class="card">
      <p class="card-titel">Einbringung</p>
      <div id="hjBefunde">${befundeHtml(pruefeEinbringung(db.faecher, REGELN))}</div>
    </div>`;
}

/** Nur die abhängigen Anzeigen nachziehen. Ein voller Neuaufbau würde dem
    Punktefeld beim Tippen den Fokus nehmen und die Tastatur zuklappen. */
function aktualisiereHjWerte() {
  const s = hjStatistik(hjAktiv());
  const stats = $('#hjStats'); if (stats) stats.innerHTML = hjStatsHtml(s);
  const bef = $('#hjBefunde'); if (bef) bef.innerHTML = befundeHtml(pruefeEinbringung(db.faecher, REGELN));
}

/* ── Fach anlegen und bearbeiten ────────────────────────────── */

function openFachNeu() {
  const q = hjAktiv();
  openSheet(`Fach in ${q.toUpperCase()}`, `
    <label>Name<input id="f_name" autocomplete="off" placeholder="z. B. Geschichte"></label>
    <label>Fach (bestimmt Aufgabenfeld und Pflichteinbringung)
      <select id="f_rolle">${rollenOptionen('sonstiges')}</select></label>
    <label>Kursart in ${q.toUpperCase()}
      <select id="f_art"><option value="GK">Grundkurs</option><option value="LK">Leistungskurs</option></select></label>
  `, () => {
    const name = $('#f_name').value.trim();
    if (!name) { toast('Das Fach braucht einen Namen'); return; }
    const f = neuesFach(name, $('#f_rolle').value);
    f.hj[q] = { belegt: true, kursart: $('#f_art').value, punkte: null, erwartet: null, einbringen: true };
    db.faecher.push(f);
    save(); closeSheet(); render(); toast('Angelegt');
  }, 'Anlegen');
}

function openFach(id) {
  const f = db.faecher.filter((x) => x.id === id)[0];
  if (!f) return;
  const q = hjAktiv();
  const h = f.hj[q];

  openSheet(esc(f.name || 'Fach'), `
    <label>Name<input id="f_name" autocomplete="off" value="${esc(f.name)}"></label>
    <label>Fach<select id="f_rolle">${rollenOptionen(f.rolle)}</select></label>
    <label>Kursart in ${q.toUpperCase()}
      <select id="f_art">
        <option value="GK"${h.kursart === 'GK' ? ' selected' : ''}>Grundkurs</option>
        <option value="LK"${h.kursart === 'LK' ? ' selected' : ''}>Leistungskurs</option>
      </select></label>
    <label class="check-zeile">
      <input type="checkbox" id="f_alle">
      <span>Kursart für alle Halbjahre übernehmen</span></label>
    <label>Prüfungsfach
      <select id="f_pf"><option value="">kein Prüfungsfach</option>
        ${[1, 2, 3, 4, 5].map((p) => `<option value="${p}"${f.pruefungsfach === p ? ' selected' : ''}
          >${p}. Prüfungsfach (${REGELN.block2.artNachPosition[p - 1]}${
            REGELN.block2.lkPositionen.indexOf(p) !== -1 ? ', Leistungskurs' : ''})</option>`).join('')}
      </select></label>
    <button class="btn btn-block" id="f_weg" style="margin-top:8px">Aus ${q.toUpperCase()} entfernen</button>
    <button class="btn btn-danger btn-block" id="f_loeschen" style="margin-top:8px">Fach ganz löschen</button>
  `, () => {
    f.name = $('#f_name').value.trim() || f.name;
    f.rolle = $('#f_rolle').value;
    const art = $('#f_art').value;
    if ($('#f_alle').checked) REGELN.halbjahre.forEach((x) => { f.hj[x].kursart = art; });
    else h.kursart = art;

    const pf = parseInt($('#f_pf').value, 10);
    const neu = (pf >= 1 && pf <= REGELN.block2.pruefungsfaecher) ? pf : null;
    /* Eine Position kann nur einem Fach gehören — sonst stünden zwei
       Fächer auf derselben Prüfung und Block II wäre nicht zuzuordnen. */
    if (neu) db.faecher.forEach((x) => { if (x !== f && x.pruefungsfach === neu) x.pruefungsfach = null; });
    f.pruefungsfach = neu;

    save(); closeSheet(); render(); toast('Gesichert');
  });

  $('#f_weg').onclick = () => {
    h.belegt = false; h.einbringen = false;
    save(); closeSheet(); render(); toast(`Aus ${q.toUpperCase()} entfernt`);
  };
  $('#f_loeschen').onclick = () => {
    askSheet('Fach löschen?',
      `„${f.name}“ wird aus allen Halbjahren entfernt. Das lässt sich nicht rückgängig machen.`,
      'Löschen', () => {
        db.faecher = db.faecher.filter((x) => x.id !== id);
        save(); closeSheet(); render(); toast('Gelöscht');
      }, () => openFach(id), true);
  };
}

/** Fächer aus dem Vorhalbjahr übernehmen. Vorhandene Belegungen werden
    nicht angefasst — sonst wären bereits eingetragene Punkte weg. */
function uebernehmen() {
  const q = hjAktiv();
  const idx = REGELN.halbjahre.indexOf(q);
  if (idx < 1) return;
  const vorher = REGELN.halbjahre[idx - 1];

  let n = 0;
  db.faecher.forEach((f) => {
    if (!f.hj[vorher].belegt || f.hj[q].belegt) return;
    f.hj[q] = {
      belegt: true, kursart: f.hj[vorher].kursart,
      punkte: null, erwartet: null, einbringen: f.hj[vorher].einbringen,
    };
    n++;
  });
  save(); render();
  toast(n ? `${n} Fächer übernommen` : 'Nichts zu übernehmen');
}

/* ── Stand: gesichert gegenüber Prognose ────────────────────── */

/** Beides in einem Rutsch. Der gesicherte Stand zählt nur eingetragene
    Ergebnisse, die Prognose füllt offene Leistungen mit den erwarteten
    Werten und den Abweichungen eines Szenarios. Die Trennung ist der
    halbe Zweck der App: eine einzige Zahl würde verschweigen, wie viel
    davon noch Wunsch ist. */
function stand(ueberschreibungen) {
  const mach = (f, p) => {
    const b1 = berechneBlock1(f, REGELN);
    const b2 = berechneBlock2(p, REGELN);
    return { b1, b2, g: gesamt(b1, b2, REGELN) };
  };
  const pro = mitPrognose(db.faecher, db.pruefungen,
    { erwartet: true, ueberschreibungen: ueberschreibungen || {} }, REGELN);
  return {
    gesichert: mach(db.faecher, db.pruefungen),
    prognose: mach(pro.faecher, pro.pruefungen),
  };
}

/** Zielpunktzahl, egal ob das Ziel als Note oder als Punktzahl gesetzt ist. */
function zielPunkte() {
  if (db.ziel.modus === 'punkte') {
    return Math.max(REGELN.gesamt.min, Math.min(REGELN.gesamt.max,
      db.ziel.punkte || REGELN.gesamt.min));
  }
  return punkteFuerNote(db.ziel.note, REGELN);
}

/** Alle noch offenen Leistungen mit ihrer Wertung — Grundlage für
    benoetigt() und für die Spannen in der Analyse. */
function offeneLeistungen() {
  const out = [];
  eingebrachteKurse(db.faecher, REGELN).forEach((k) => {
    if (k.punkte === null) out.push({ art: 'hj', name: k.name, hj: k.hj, wertung: k.wertung, lk: k.lk });
  });
  berechneBlock2(db.pruefungen, REGELN).proFach.forEach((p) => {
    if (p.punkte === null) out.push({ art: 'pf', position: p.position, art2: p.art, wertung: REGELN.block2.faktor });
  });
  return out;
}

/* ── Übersicht ──────────────────────────────────────────────── */

/** Balken für Block I und Block II gegen ihr Maximum. Von Hand
    gezeichnet — eine Diagrammbibliothek wären 200 KB für vier Rechtecke.
    Die Farben laufen über CSS-Klassen, damit die Themes greifen. */
function balkenSvg(gesichert, prognose) {
  const B = 320, hoehe = 14;
  const reihen = [
    { name: 'Block I — Qualifikationsphase', y: 26,
      ist: gesichert.b1.punkte, prog: prognose.b1.punkte,
      max: REGELN.block1.max, min: REGELN.block1.minLK + REGELN.block1.minGK },
    { name: 'Block II — Abiturprüfung', y: 86,
      ist: gesichert.b2.punkte, prog: prognose.b2.punkte,
      max: REGELN.block2.max, min: REGELN.block2.min },
  ];

  const teile = reihen.map((r) => {
    const w = (v) => Math.max(0, Math.min(B, Math.round(v / r.max * B)));
    const xMin = w(r.min);
    return `<text x="0" y="${r.y - 9}" class="bk-l">${esc(r.name)}</text>
      <text x="${B}" y="${r.y - 9}" class="bk-v" text-anchor="end">${r.prog} / ${r.max}</text>
      <rect x="0" y="${r.y}" width="${B}" height="${hoehe}" rx="7" class="bk-spur"/>
      <rect x="0" y="${r.y}" width="${w(r.prog)}" height="${hoehe}" rx="7" class="bk-prog"/>
      <rect x="0" y="${r.y}" width="${w(r.ist)}" height="${hoehe}" rx="7" class="bk-ist"/>
      <line x1="${xMin}" y1="${r.y - 4}" x2="${xMin}" y2="${r.y + hoehe + 4}" class="bk-min"/>
      <text x="${xMin}" y="${r.y + hoehe + 17}" class="bk-m" text-anchor="middle">Minimum ${r.min}</text>`;
  }).join('');

  return `<svg class="balken" viewBox="0 0 ${B} 126" xmlns="http://www.w3.org/2000/svg" role="img"
    aria-label="Block I ${prognose.b1.punkte} von ${REGELN.block1.max} Punkten, Block II ${prognose.b2.punkte} von ${REGELN.block2.max} Punkten"
    >${teile}</svg>`;
}

function renderHome() {
  const el = $('#view-home');

  if (!db.setup && !db.faecher.length) {
    el.innerHTML = `<div class="card hero">
      <div class="hero-value">Abi ${db.schule.abijahr}</div>
      <p class="hero-sub">Noch nichts eingerichtet.</p>
      <button class="btn btn-primary btn-block" data-aktion="setup" style="margin-top:16px"
        >Ersteinrichtung starten</button></div>`;
    return;
  }

  const s = stand();
  const prog = s.prognose.g, sich = s.gesichert.g;
  const ziel = zielPunkte();
  const diff = ziel - prog.punkte;
  const offen = s.gesichert.b1.offen + s.gesichert.b2.offen;
  const mitPrognoseGerechnet = prog.punkte !== sich.punkte;

  /* Unter 300 Punkten gibt es nach Anlage 10b keine Note. Solange Q1 bis
     Q4 nicht stehen, ist das der Normalfall und keine schlechte Nachricht —
     deshalb hier ein Satz statt eines Striches ohne Erklärung. */
  const heroUnten = prog.note === null
    ? `${prog.punkte} von ${REGELN.gesamt.max} Punkten — unter ${REGELN.gesamt.min} gibt es noch keine Note`
    : `${prog.punkte} von ${REGELN.gesamt.max} Punkten`;

  el.innerHTML = `
    <div class="card hero">
      <div class="hero-value">${zeigeNote(prog.note)}</div>
      <p class="hero-sub">${esc(heroUnten)}</p>
      ${offen ? `<p class="hero-sub klein muted">${offen} Leistungen noch offen</p>` : ''}
    </div>

    <div class="card">
      <div class="stat-reihe">
        <div class="stat"><div class="stat-k">Gesichert</div><div class="stat-v num">${sich.punkte}</div></div>
        <div class="stat"><div class="stat-k">Prognose</div><div class="stat-v num">${prog.punkte}</div></div>
        <div class="stat"><div class="stat-k">Ziel</div><div class="stat-v num">${ziel}</div></div>
        <div class="stat"><div class="stat-k">Differenz</div>
          <div class="stat-v num ${diff <= 0 ? 'up' : 'down'}">${diff <= 0 ? '+' + (-diff) : '−' + diff}</div></div>
      </div>
      <p class="klein muted" style="margin:12px 0 0">
        Gesichert zählt nur eingetragene Ergebnisse.
        ${mitPrognoseGerechnet
          ? 'Die Prognose rechnet Deine erwarteten Werte mit.'
          : 'Ohne erwartete Werte ist die Prognose gleich dem gesicherten Stand.'}
        Ziel: ${zeigeNote(noteFuerPunkte(ziel, REGELN))} — änderbar in den Einstellungen.</p>
    </div>

    <div class="card">
      <p class="card-titel">Blöcke gegen ihr Maximum</p>
      ${balkenSvg(s.gesichert, s.prognose)}
      <p class="klein muted" style="margin:8px 0 0">Kräftig: gesichert. Blass: Prognose.
        Block I verlangt getrennt ${REGELN.block1.minLK} Punkte im Leistungs- und
        ${REGELN.block1.minGK} im Grundkursbereich — die sind nicht gegeneinander verrechenbar.</p>
    </div>

    <div class="card">
      <p class="card-titel">Stand der Bedingungen</p>
      ${prog.bestanden
        ? `<div class="befund befund-ok"><i></i><span>Nach heutigem Stand${
            prog.vollstaendig ? '' : ' und Prognose'} ist alles erfüllt.</span></div>`
        : prog.gruende.map((t) =>
            `<div class="befund befund-${prog.vollstaendig ? 'fehler' : 'offen'}"><i></i><span>${esc(t)}</span></div>`).join('')}
      ${prog.vollstaendig ? '' :
        '<p class="klein muted" style="margin:12px 0 0">Noch nicht alles eingetragen — das ist eine '
        + 'Zwischenbilanz, kein Ergebnis.</p>'}
    </div>`;
}

/* ── Analyse ────────────────────────────────────────────────── */

function renderAnalyse() {
  const el = $('#view-analyse');
  if (!db.faecher.length) {
    el.innerHTML = '<div class="card"><p class="leer">Leg erst Fächer an, dann gibt es hier etwas zu rechnen.</p></div>';
    return;
  }

  const s = stand();
  const ziel = zielPunkte();
  const offene = offeneLeistungen();
  const fix = s.gesichert.g.punkte;
  const b = benoetigt(ziel, fix, offene, REGELN);
  const max = REGELN.punkte.max;

  /* Kopfzeile: die eine Frage, für die es die App gibt. */
  let kopf;
  if (!offene.length) {
    kopf = b.schonErreicht
      ? `<p class="dlg-t">Alles eingetragen — Du bist ${-b.fehlt} Punkte über Deinem Ziel.</p>`
      : `<p class="dlg-t">Alles eingetragen. Zum Ziel fehlen ${b.fehlt} Punkte, und es ist nichts mehr offen.</p>`;
  } else if (b.schonErreicht) {
    kopf = `<p class="dlg-t">Dein Ziel steht schon aus dem Gesicherten heraus — mit ${-b.fehlt} Punkten Luft.</p>`;
  } else {
    kopf = `<p class="dlg-t">Bis zu Deinem Ziel fehlen <strong>${b.fehlt} Punkte</strong>.
      Dafür brauchst Du in den verbleibenden ${offene.length} Leistungen im Schnitt
      <strong>${nf1.format(b.schnitt)} Punkte</strong>.</p>`;
  }

  const warnung = (!b.erreichbar && offene.length)
    ? `<div class="befund befund-fehler"><i></i><span>Dein Ziel ist rechnerisch nicht mehr erreichbar:
        selbst mit ${max} Punkten in allem Offenen kämst Du auf ${b.bestenfalls} Punkte.
        Setz das Ziel in den Einstellungen tiefer.</span></div>` : '';

  /* Je offenem Halbjahr und je offener Prüfung */
  const jeHj = {};
  offene.filter((o) => o.art === 'hj').forEach((o) => {
    jeHj[o.hj] = jeHj[o.hj] || { anzahl: 0, wertungen: 0 };
    jeHj[o.hj].anzahl++; jeHj[o.hj].wertungen += o.wertung;
  });

  const schnitt = b.schnitt === null ? 0 : b.schnitt;
  const bloecke = REGELN.halbjahre.filter((q) => jeHj[q]).map((q) => {
    const j = jeHj[q];
    return `<div class="befund befund-offen"><i></i><span><strong>${q.toUpperCase()}</strong>:
      ${j.anzahl} offene Kurse, ${j.wertungen} Wertungen. Bei Schnitt ${nf1.format(schnitt)}
      bringt ${q.toUpperCase()} ${Math.round(schnitt * j.wertungen)} Punkte.</span></div>`;
  }).join('')
  + offene.filter((o) => o.art === 'pf').map((o) =>
    `<div class="befund befund-offen"><i></i><span><strong>Prüfung ${o.position}</strong>
      (${esc(o.art2)}): ${o.wertung} Wertungen. Bei Schnitt ${nf1.format(schnitt)}
      sind das ${Math.round(schnitt * o.wertung)} Punkte.</span></div>`).join('');

  /* Sensitivität: nur Fächer, in denen überhaupt noch etwas offen ist —
     bei einem abgeschlossenen Fach bringt "ein Punkt mehr" nichts.
     Gleich schwere Fächer werden zusammengefasst: acht gleichlautende
     Zeilen verdecken genau das Gefälle, das hier sichtbar werden soll. */
  const sens = sensitivitaet(db.faecher, REGELN).block1.filter((f) => f.offen > 0);
  const lks = sens.filter((f) => f.wertung === REGELN.block1.faktorLK);
  const gks = sens.filter((f) => f.wertung !== REGELN.block1.faktorLK);
  const offenePf = offene.filter((o) => o.art === 'pf').length;
  const pkt = (n) => n + (n === 1 ? ' Punkt' : ' Punkte');
  const hj = (n) => n + (n === 1 ? ' offenes Halbjahr' : ' offene Halbjahre');

  const sensZeilen = [
    offenePf ? `<div class="befund befund-warnung"><i></i><span>
        <strong>Abiturprüfungen</strong> wiegen am schwersten: ein Punkt mehr bringt
        ${pkt(REGELN.block2.faktor)} in Block II. ${offenePf} von
        ${REGELN.block2.pruefungsfaecher} stehen noch aus.</span></div>` : '',

    lks.length ? `<div class="befund befund-warnung"><i></i><span>
        <strong>Leistungskurse</strong> zählen doppelt: ein Punkt mehr in einem Halbjahr
        bringt ${pkt(REGELN.block1.faktorLK)} in Block I.
        ${lks.map((f) => esc(f.name) + ' (' + hj(f.offen) + ')').join(', ')}.</span></div>` : '',

    gks.length ? `<div class="befund befund-ok"><i></i><span>
        <strong>Grundkurse</strong> zählen einfach: ein Punkt mehr bringt
        ${pkt(REGELN.block1.faktorGK)} in Block I.
        ${gks.map((f) => esc(f.name) + ' (' + hj(f.offen) + ')').join(', ')}.</span></div>` : '',
  ].filter(Boolean).join('');

  const bestenfallsNote = noteFuerPunkte(b.bestenfalls, REGELN);
  const schlechtestNote = noteFuerPunkte(fix, REGELN);

  el.innerHTML = `
    <div class="card">
      <p class="card-titel">Bis zum Ziel</p>
      ${kopf}
      ${warnung}
    </div>

    <div class="card">
      <p class="card-titel">Spanne</p>
      <div class="stat-reihe">
        <div class="stat"><div class="stat-k">Schlechtestenfalls</div>
          <div class="stat-v num">${fix}</div>
          <div class="klein muted">${schlechtestNote === null ? 'keine Note' : 'Note ' + zeigeNote(schlechtestNote)}</div></div>
        <div class="stat"><div class="stat-k">Bestenfalls</div>
          <div class="stat-v num">${b.bestenfalls}</div>
          <div class="klein muted">${bestenfallsNote === null ? 'keine Note' : 'Note ' + zeigeNote(bestenfallsNote)}</div></div>
      </div>
      <p class="klein muted" style="margin:12px 0 0">Schlechtestenfalls heißt: alles Offene null Punkte.
        Damit wärst Du nicht bestanden — ein eingebrachter Kurs mit null Punkten ist nach
        § 26 Abs. 2 gar nicht einbringbar. Die Zahl ist die Untergrenze, keine gültige Abiturnote.</p>
    </div>

    <div class="card">
      <p class="card-titel">Wo noch etwas offen ist</p>
      ${bloecke || '<p class="leer">Nichts mehr offen.</p>'}
    </div>

    <div class="card">
      <p class="card-titel">Wo sich Anstrengung lohnt</p>
      ${sensZeilen || '<p class="leer">Keine offenen Leistungen mehr.</p>'}
    </div>`;
}

/* ── Prüfungen ──────────────────────────────────────────────── */

function renderPruefungen() {
  const el = $('#view-pruefungen');
  const b2 = berechneBlock2(db.pruefungen, REGELN);

  const zeilen = b2.proFach.map((p) => {
    const fach = db.faecher.filter((f) => f.pruefungsfach === p.position)[0];
    const roh = db.pruefungen[p.position - 1];
    const unter = p.gewertet !== null && p.gewertet < REGELN.block2.mindestPunkteProFach;
    return `<div class="zeile">
      <button class="zeile-name" data-pf="${p.position}">
        <strong>${fach ? esc(fach.name) : 'Fach zuordnen'}</strong>
        <span class="zeile-meta">
          <span class="badge${p.lk ? ' lk' : ''}">${p.position}.</span>
          ${esc(p.art)}${p.gewertet === null ? '' : ' · ' + p.gewertet + ' Punkte'}
        </span>
      </button>
      <input class="punkt-in schwach" type="number" inputmode="numeric" min="${REGELN.punkte.min}"
        max="${REGELN.punkte.max}" step="1" data-pruef-erwartet="${p.position}"
        value="${roh.erwartet === null ? '' : roh.erwartet}" placeholder="erw"
        aria-label="Erwartet Prüfung ${p.position}">
      <input class="punkt-in${unter ? ' unter' : ''}" type="number" inputmode="numeric"
        min="${REGELN.punkte.min}" max="${REGELN.punkte.max}" step="1"
        data-pruef-punkte="${p.position}" value="${roh.punkte === null ? '' : roh.punkte}"
        placeholder="–" aria-label="Ergebnis Prüfung ${p.position}">
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="card" id="pfStats">${pfStatsHtml(b2)}</div>

    <div class="card">
      <p class="card-titel">Die fünf Prüfungen</p>
      ${zeilen}
      <p class="klein muted" style="margin:12px 0 0">Die beiden rechten Felder sind
        <strong>erwartet</strong> und <strong>tatsächlich</strong>. Sobald ein tatsächliches
        Ergebnis dasteht, sticht es den erwarteten Wert.
        Prüfung 1 und 2 sind in Hessen die Leistungskurse (§ 26 Abs. 4).</p>
    </div>

    <div class="card">
      <p class="card-titel">Bedingungen für Block II</p>
      <div id="pfBefunde">${pruefungsBefunde(b2)}</div>
    </div>`;
}

function pfStatsHtml(b2) {
  const r = REGELN.block2;
  return `<div class="stat-reihe">
    <div class="stat"><div class="stat-k">Block II</div>
      <div class="stat-v num">${b2.punkte} / ${r.max}</div></div>
    <div class="stat"><div class="stat-k">Über ${r.mindestPunkteProFach} Punkten</div>
      <div class="stat-v num${b2.mitMindestpunkten < r.mindestfaecher ? ' down' : ''}"
        >${b2.mitMindestpunkten} / ${r.mindestfaecher}</div></div>
    <div class="stat"><div class="stat-k">Offen</div><div class="stat-v num">${b2.offen}</div></div>
  </div>`;
}

/** Wie aktualisiereHjWerte(): nur die abhängigen Anzeigen, damit das
    Punktefeld beim Tippen den Fokus behält. */
function aktualisierePfWerte() {
  const b2 = berechneBlock2(db.pruefungen, REGELN);
  const st = $('#pfStats'); if (st) st.innerHTML = pfStatsHtml(b2);
  const bf = $('#pfBefunde'); if (bf) bf.innerHTML = pruefungsBefunde(b2);
}

/** Befunde nur zu Block II — die Einbringungsprüfung steckt bei den
    Halbjahren, hier geht es um § 26 Abs. 13. */
function pruefungsBefunde(b2) {
  const r = REGELN.block2;
  const bef = [];
  const zugeordnet = db.faecher.filter((f) => f.pruefungsfach).length;

  if (zugeordnet < r.pruefungsfaecher) {
    bef.push({ stufe: 'offen', text: `${zugeordnet} von ${r.pruefungsfaecher} Prüfungsfächern zugeordnet.` });
  } else {
    bef.push({ stufe: 'ok', text: 'Alle fünf Prüfungsfächer sind zugeordnet.' });
  }

  if (b2.offen > 0) bef.push({ stufe: 'offen', text: `${b2.offen} Prüfungsergebnisse stehen noch aus.` });

  if (b2.punkte >= r.min) bef.push({ stufe: 'ok', text: `${b2.punkte} Punkte — das Minimum von ${r.min} steht.` });
  else bef.push({ stufe: b2.offen ? 'offen' : 'fehler',
    text: `${b2.punkte} von mindestens ${r.min} Punkten in Block II.` });

  if (b2.mitMindestpunkten >= r.mindestfaecher) {
    bef.push({ stufe: 'ok', text: `${b2.mitMindestpunkten} Prüfungen über ${r.mindestPunkteProFach} Punkten.` });
  } else {
    bef.push({ stufe: b2.offen ? 'offen' : 'fehler',
      text: `${b2.mitMindestpunkten} von ${r.mindestfaecher} Prüfungen erreichen ${r.mindestPunkteProFach} Punkte.` });
  }

  if (r.mindestensEinLK) {
    if (b2.lkMitMindestpunkten >= 1) {
      bef.push({ stufe: 'ok', text: `Ein Leistungskurs liegt über ${r.mindestPunkteProFach} Punkten.` });
    } else {
      bef.push({ stufe: b2.offen ? 'offen' : 'fehler',
        text: `Unter den Prüfungen über ${r.mindestPunkteProFach} Punkten muss ein `
          + 'Leistungskurs sein — also Prüfung 1 oder 2.' });
    }
  }

  b2.proFach.filter((p) => p.punkte === 0).forEach((p) => {
    bef.push({ stufe: 'fehler', text: `Prüfung ${p.position} steht auf null Punkten. `
      + 'Damit ist die Abiturprüfung nicht bestanden (§ 26 Abs. 13 Nr. 5).' });
  });

  return befundeHtml(bef);
}

/** Fach für eine Prüfungsposition wählen. */
function openPruefungFach(pos) {
  const art = REGELN.block2.artNachPosition[pos - 1];
  const istLK = REGELN.block2.lkPositionen.indexOf(pos) !== -1;
  const aktuell = db.faecher.filter((f) => f.pruefungsfach === pos)[0];

  openSheet(`${pos}. Prüfungsfach`, `
    <p class="dlg-t klein muted">${esc(art)}${istLK
      ? ' · In Hessen ist das erste und zweite Prüfungsfach ein Leistungskurs (§ 26 Abs. 4).'
      : ''}</p>
    <label>Fach<select id="p_fach"><option value="">kein Fach</option>
      ${db.faecher.map((f) => `<option value="${f.id}"${aktuell && aktuell.id === f.id ? ' selected' : ''}
        >${esc(f.name)}</option>`).join('')}</select></label>
  `, () => {
    const id = $('#p_fach').value;
    /* Erst alle Zuordnungen auf diese Position lösen, dann neu setzen —
       sonst hielten zwei Fächer dieselbe Prüfung. */
    db.faecher.forEach((f) => { if (f.pruefungsfach === pos) f.pruefungsfach = null; });
    const f = db.faecher.filter((x) => x.id === id)[0];
    if (f) f.pruefungsfach = pos;
    save(); closeSheet(); render(); toast('Zugeordnet');
  });
}

/* ── Einstellungen ──────────────────────────────────────────── */

/* ── Abiziel ────────────────────────────────────────────────── */

/** Note und Punktzahl werden beide mitgeführt und bei jeder Eingabe
    ineinander umgerechnet. `modus` sagt, welches der beiden führt — die
    Umrechnung ist in beide Richtungen verlustbehaftet (Note 2,0 deckt 643
    bis 660 ab), deshalb bleibt der zuletzt getippte Wert erhalten. */
function openZiel() {
  const zeichne = () => {
    const modus = db.ziel.modus;
    $$('#z_modus button').forEach((b) => b.classList.toggle('on', b.dataset.modus === modus));
    $('#z_l_note').classList.toggle('hidden', modus !== 'note');
    $('#z_l_punkte').classList.toggle('hidden', modus !== 'punkte');
    const p = zielPunkte();
    $('#z_hinweis').innerHTML = modus === 'note'
      ? `Note ${zeigeNote(db.ziel.note)} brauchst Du ab <strong>${p} Punkten</strong>.`
      : `${p} Punkte ergeben <strong>Note ${zeigeNote(noteFuerPunkte(p, REGELN))}</strong>.`;
  };

  openSheet('Abiziel', `
    <div class="seg" id="z_modus">
      <button data-modus="note">Als Note</button>
      <button data-modus="punkte">Als Punkte</button>
    </div>
    <label id="z_l_note">Zielnote (${nf1.format(REGELN.gesamt.noteBeste)} bis ${nf1.format(REGELN.gesamt.noteSchlechteste)})
      <input id="z_note" type="number" inputmode="decimal" step="0.1"
        min="${REGELN.gesamt.noteBeste}" max="${REGELN.gesamt.noteSchlechteste}"
        value="${nf1.format(db.ziel.note).replace(',', '.')}"></label>
    <label id="z_l_punkte">Zielpunktzahl (${REGELN.gesamt.min} bis ${REGELN.gesamt.max})
      <input id="z_punkte" type="number" inputmode="numeric" step="1"
        min="${REGELN.gesamt.min}" max="${REGELN.gesamt.max}" value="${db.ziel.punkte}"></label>
    <p class="dlg-t klein muted" id="z_hinweis"></p>
  `, () => { save(); closeSheet(); render(); toast('Ziel gesetzt'); }, 'Übernehmen');

  $('#z_modus').onclick = (ev) => {
    const b = ev.target.closest('[data-modus]');
    if (!b) return;
    db.ziel.modus = b.dataset.modus;
    zeichne();
  };
  $('#z_note').oninput = (ev) => {
    const n = parseFloat(String(ev.target.value).replace(',', '.'));
    if (!isFinite(n)) return;
    db.ziel.note = Math.min(REGELN.gesamt.noteSchlechteste,
      Math.max(REGELN.gesamt.noteBeste, Math.round(n * 10) / 10));
    db.ziel.punkte = punkteFuerNote(db.ziel.note, REGELN);   // Gegenrichtung mitführen
    zeichne();
  };
  $('#z_punkte').oninput = (ev) => {
    const p = parseInt(ev.target.value, 10);
    if (!isFinite(p)) return;
    db.ziel.punkte = Math.min(REGELN.gesamt.max, Math.max(REGELN.gesamt.min, p));
    const n = noteFuerPunkte(db.ziel.punkte, REGELN);
    if (n !== null) db.ziel.note = n;
    zeichne();
  };
  zeichne();
}

/* ── Szenarien ──────────────────────────────────────────────── */

/** Ein Szenario hält nur Abweichungen für noch OFFENE Leistungen, keine
    Kopie des Datensatzes. Trägst Du später ein echtes Ergebnis ein,
    verliert die Abweichung dort ihre Wirkung — was richtig ist, denn ein
    Szenario soll nie eine bereits geschriebene Note überstimmen. */
function szenarioAusStand() {
  const u = {};
  db.faecher.forEach((f) => REGELN.halbjahre.forEach((q) => {
    const h = f.hj[q];
    if (h.belegt && h.einbringen && h.punkte === null && h.erwartet !== null) {
      u['hj:' + f.id + ':' + q] = h.erwartet;
    }
  }));
  db.pruefungen.forEach((p, i) => {
    if (p.punkte === null && p.erwartet !== null) u['pf:' + (i + 1)] = p.erwartet;
  });
  return u;
}

function openSzenarien() {
  const zeile = (name, u, id) => {
    const g = stand(u).prognose.g;
    return `<tr><td>${esc(name)}</td>
      <td class="num">${zeigeNote(g.note)}</td>
      <td class="num">${g.punkte}</td>
      <td>${id ? `<button class="link" data-szen-laden="${id}">Laden</button>` : ''}</td>
      <td>${id ? `<button class="link" data-szen-weg="${id}">Löschen</button>` : ''}</td></tr>`;
  };

  openSheet('Szenarien', `
    <p class="dlg-t klein muted">Ein Szenario sichert Deine jetzigen erwarteten Werte für alles,
      was noch offen ist. Eingetragene Ergebnisse bleiben davon unberührt.</p>
    <div class="tabelle-scroll"><table class="vgl">
      <tr><th>Szenario</th><th class="num">Note</th><th class="num">Punkte</th><th></th><th></th></tr>
      ${zeile('Jetzt (erwartete Werte)', null, null)}
      ${db.szenarien.map((s) => zeile(s.name, s.ueberschreibungen, s.id)).join('')}
    </table></div>
    ${db.szenarien.length ? '' : '<p class="leer klein">Noch kein Szenario gesichert.</p>'}
    <button class="btn btn-primary btn-block" id="sz_neu" style="margin-top:12px">Jetzigen Stand sichern</button>
  `, null);

  $('#sz_neu').onclick = () => {
    const u = szenarioAusStand();
    if (!Object.keys(u).length) {
      infoSheet('Nichts zu sichern',
        'Ein Szenario besteht aus erwarteten Werten für offene Leistungen. Trag erst welche ein — '
        + 'in den Halbjahren und bei den Prüfungen, jeweils im linken Feld.', openSzenarien);
      return;
    }
    askText('Szenario benennen', 'Name',
      { value: ['Realistisch', 'Optimistisch', 'Pessimistisch'][db.szenarien.length] || '',
        okLabel: 'Sichern' },
      (name) => {
        db.szenarien.push({ id: uid(), name: (name || '').trim() || 'Ohne Namen', ueberschreibungen: u });
        save(); openSzenarien(); toast('Szenario gesichert');
      }, openSzenarien);
  };

  $('#sheetBody').onclick = (ev) => {
    const laden = ev.target.closest('[data-szen-laden]');
    if (laden) {
      const s = db.szenarien.filter((x) => x.id === laden.dataset.szenLaden)[0];
      if (!s) return;
      /* Laden heißt: die Abweichungen werden zu den erwarteten Werten.
         Eingetragene Ergebnisse werden dabei nicht angefasst. */
      Object.keys(s.ueberschreibungen).forEach((k) => {
        const wert = s.ueberschreibungen[k];
        const teile = k.split(':');
        if (teile[0] === 'hj') {
          const f = db.faecher.filter((x) => x.id === teile[1])[0];
          if (f && f.hj[teile[2]] && f.hj[teile[2]].punkte === null) f.hj[teile[2]].erwartet = wert;
        } else if (teile[0] === 'pf') {
          const p = db.pruefungen[parseInt(teile[1], 10) - 1];
          if (p && p.punkte === null) p.erwartet = wert;
        }
      });
      save(); closeSheet(); render(); toast(`„${s.name}“ geladen`);
      return;
    }
    const weg = ev.target.closest('[data-szen-weg]');
    if (weg) {
      db.szenarien = db.szenarien.filter((x) => x.id !== weg.dataset.szenWeg);
      save(); openSzenarien(); toast('Gelöscht');
    }
  };
}

/* ── Einstellungen ──────────────────────────────────────────── */

function openSettings() {
  const ziel = zielPunkte();
  openSheet('Einstellungen', `
    <p class="card-titel">Abiziel</p>
    <button class="btn btn-block" id="e_ziel">Ziel: ${zeigeNote(noteFuerPunkte(ziel, REGELN))} · ${ziel} Punkte</button>
    <button class="btn btn-block" id="e_szen" style="margin-top:8px"
      >Szenarien (${db.szenarien.length})</button>

    <p class="card-titel" style="margin-top:20px">Darstellung</p>
    <label>Erscheinungsbild
      <select id="e_theme">${Object.keys(THEMES).map((t) =>
        `<option value="${t}"${db.theme === t ? ' selected' : ''}>${esc(THEMES[t].label)}</option>`).join('')}</select></label>

    <p class="card-titel">Sicherung</p>
    <button class="btn btn-block" id="e_export">Backup exportieren</button>
    <button class="btn btn-block" id="e_import" style="margin-top:8px">Backup laden</button>
    <input type="file" id="e_datei" accept="application/json,.json" class="hidden">
    <p class="klein muted">Die Daten liegen nur auf diesem Gerät. „Browserdaten löschen“ räumt sie
      ohne Vorwarnung weg — exportier ab und zu eine Sicherung.
      ${db.lastBackup ? 'Letztes Backup: ' + esc(dfLong.format(new Date(db.lastBackup))) + '.' : 'Bisher kein Backup.'}</p>

    <p class="card-titel" style="margin-top:20px">Testdaten</p>
    <button class="btn btn-block" id="e_test">Testdatensatz erzeugen</button>
    <p class="klein muted">Ein vollständiger Beispieljahrgang zum Ausprobieren. Ersetzt Deine
      Eingaben und wird oben deutlich als Testdaten gekennzeichnet.</p>

    <p class="card-titel" style="margin-top:20px">Version</p>
    <p class="klein muted">Abi-Rechner ${esc(APP_VERSION)}</p>
    <button class="btn btn-block" id="e_update" style="margin-top:8px">Nach Update suchen</button>

    <button class="btn btn-danger btn-block" id="e_reset" style="margin-top:20px">Alle Daten löschen</button>
  `, null);

  $('#e_ziel').onclick = openZiel;
  $('#e_szen').onclick = openSzenarien;

  $('#e_update').onclick = async () => {
    if (!('serviceWorker' in navigator)) {
      infoSheet('Nicht verfügbar', 'Dieser Browser unterstützt keine Offline-Installation. '
        + 'Ein Neuladen der Seite holt dann immer die aktuelle Fassung.', openSettings);
      return;
    }
    toast('Suche nach einer neuen Fassung …');
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) await reg.update();
    } catch (e) { /* offline — dann bleibt es bei dem, was im Cache liegt */ }
    /* Kurz warten: der neue Worker muss erst installiert sein, bevor die
       frische app.js im Cache liegt und die Version gelesen werden kann. */
    setTimeout(async () => {
      const cv = await cachedVersion();
      if (!cv || cv === APP_VERSION) { toast(`Du hast die neueste Fassung (${APP_VERSION})`); return; }
      /* applyIfNewer() lädt nicht neu, solange ein Sheet offen ist — sonst
         risse ein Update ein halb ausgefülltes Formular weg. Hier ist das
         offene Sheet aber genau das, aus dem heraus Du das Update angefordert
         hast. Ohne dieses Schließen könnte der Knopf sich nie selbst einlösen
         und bliebe bei "bereit — App neu starten" stehen. */
      closeSheet();
      applyIfNewer(true);
    }, 1200);
  };
  $('#e_theme').onchange = (ev) => { applyTheme(ev.target.value); save(); };
  $('#e_export').onclick = exportBackup;
  $('#e_import').onclick = () => $('#e_datei').click();
  $('#e_datei').onchange = (ev) => importBackup(ev.target.files[0]);

  $('#e_test').onclick = () => {
    askSheet('Testdaten erzeugen?',
      'Deine jetzigen Fächer und Noten werden dabei ersetzt. Ein Backup davor schadet nicht.',
      'Erzeugen', () => {
        db.faecher = testdatensatz((k) => (k.hj === 'q1' || k.hj === 'q2') ? 9 + (k.lk ? 2 : 0) : null);
        db.pruefungen = testpruefungen(null, REGELN);
        db.testdaten = true; db.setup = true;
        save(); closeSheet(); render(); toast('Testdaten erzeugt');
      }, openSettings);
  };

  $('#e_reset').onclick = () => {
    askSheet('Alle Daten löschen?', 'Fächer, Noten, Ziel und Szenarien werden entfernt. '
      + 'Das lässt sich nicht rückgängig machen.', 'Löschen', () => {
      const theme = db.theme;
      db = blank(); db.theme = theme;
      save(); closeSheet(); nav('home'); toast('Alles gelöscht');
    }, openSettings, true);
  };
}

/* ── Backup ─────────────────────────────────────────────────── */

function exportBackup() {
  db.lastBackup = new Date().toISOString();
  save();
  /* Der gesamte Datensatz wandert unverändert in die Datei. `meta` steht
     nur als Kopfzeile davor und wird beim Import wieder entfernt (siehe
     normalize), damit es nicht in die Daten wandert. */
  const payload = Object.assign({
    meta: { app: 'Abi-Rechner', appVersion: APP_VERSION, format: db.v, exported: db.lastBackup },
  }, db);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `abirechner-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Backup gespeichert');
}

function importBackup(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || !Array.isArray(d.faecher)) throw new Error('Die Datei ist kein Backup dieser App.');
      const stand = d.meta && d.meta.exported ? ` vom ${dfLong.format(new Date(d.meta.exported))}` : '';
      askSheet('Backup laden',
        `Das Backup${stand} enthält ${d.faecher.length} Fächer. `
        + 'Deine jetzigen Daten werden dabei ersetzt.',
        'Laden', () => {
          db = normalize(d);
          applyTheme(db.theme);
          save(); closeSheet(); render(); toast('Backup geladen');
        }, openSettings);
    } catch (e) { infoSheet('Import fehlgeschlagen', e.message, openSettings); }
  };
  r.readAsText(file);
}

/* ── Verdrahtung ────────────────────────────────────────────── */

function wire() {
  document.body.addEventListener('click', (e) => {
    const n = e.target.closest('[data-nav]');
    if (n) { hjTab = null; nav(n.dataset.nav); return; }

    const t = e.target.closest('[data-hj]');
    if (t) { hjTab = t.dataset.hj; render(); return; }

    const h = e.target.closest('[data-haken]');
    if (h) {
      const f = db.faecher.filter((x) => x.id === h.dataset.haken)[0];
      if (f) { const k = f.hj[hjAktiv()]; k.einbringen = !k.einbringen; save(); render(); }
      return;
    }

    const f = e.target.closest('[data-fach]');
    if (f) { openFach(f.dataset.fach); return; }

    const p = e.target.closest('[data-pf]');
    if (p) { openPruefungFach(parseInt(p.dataset.pf, 10)); return; }

    const a = e.target.closest('[data-aktion]');
    if (!a) return;
    if (a.dataset.aktion === 'setup') openSetup();
    else if (a.dataset.aktion === 'fach-neu') openFachNeu();
    else if (a.dataset.aktion === 'uebernehmen') uebernehmen();
  });

  /* Punkte werden beim Tippen übernommen, aber ohne Neuaufbau der Zeilen —
     sonst verliert das Feld den Fokus und die Tastatur klappt zu. */
  document.body.addEventListener('input', (e) => {
    const el = e.target.closest('[data-punkte],[data-pruef-punkte],[data-pruef-erwartet]');
    if (!el) return;

    if (el.dataset.punkte !== undefined) {
      const fach = db.faecher.filter((x) => x.id === el.dataset.punkte)[0];
      if (!fach) return;
      const h = fach.hj[hjAktiv()];
      h.punkte = punkteOderNull(el.value);
      el.classList.toggle('unter', h.punkte !== null && h.punkte < REGELN.block1.unterkursGrenze);
      save();
      aktualisiereHjWerte();
      return;
    }

    const pos = parseInt(el.dataset.pruefPunkte || el.dataset.pruefErwartet, 10);
    const p = db.pruefungen[pos - 1];
    if (!p) return;
    if (el.dataset.pruefPunkte !== undefined) {
      p.punkte = punkteOderNull(el.value);
      el.classList.toggle('unter', p.punkte !== null
        && p.punkte * REGELN.block2.faktor < REGELN.block2.mindestPunkteProFach);
    } else {
      p.erwartet = punkteOderNull(el.value);
    }
    save();
    aktualisierePfWerte();
  });

  $('#btnSettings').onclick = openSettings;
  $('#sheetCancel').onclick = closeSheet;
  $('#scrim').onclick = closeSheet;
  $('#sheetSave').onclick = () => sheetSaveFn && sheetSaveFn();
  $('#btnTestWeg').onclick = () => {
    askSheet('Testdaten entfernen?', 'Die Beispieldaten werden gelöscht und die App startet leer.',
      'Entfernen', () => {
        const theme = db.theme;
        db = blank(); db.theme = theme;
        save(); closeSheet(); nav('home'); toast('Testdaten entfernt');
      }, null, true);
  };
}

/* ── Update-Erkennung ───────────────────────────────────────────
   Ohne das merkt die installierte App nie, dass eine neue Fassung online
   ist — der Service Worker liefert die alte weiter, teilweise über Tage. */

/** Welche APP_VERSION liegt im Offline-Cache? Das ist die Fassung, die
    beim nächsten Laden ausgeliefert wird — nicht zwingend die laufende. */
async function cachedVersion() {
  if (!('caches' in window)) return null;
  for (const k of await caches.keys()) {
    if (!k.startsWith('abirechner')) continue;
    const c = await caches.open(k);
    const res = (await c.match('./app.js')) || (await c.match('app.js'));
    if (!res) continue;
    const m = (await res.text()).match(/APP_VERSION\s*=\s*'([^']+)'/);
    if (m) return m[1];
  }
  return null;
}

/** Lädt neu, wenn im Cache eine andere Fassung liegt als die laufende. Die
    Sperre in sessionStorage verhindert eine Endlosschleife, falls das
    Neuladen die Version wider Erwarten nicht ändert. */
let reloading = false;
async function applyIfNewer(announce) {
  if (reloading) return false;
  const cv = await cachedVersion();
  if (!cv || cv === APP_VERSION) return false;
  if (sessionStorage.getItem('abi-reload') === cv) return false;    // schon versucht
  if (!$('#sheet').classList.contains('hidden')) {                  // Formular offen
    toast(`Version ${cv} bereit — App neu starten`);
    return true;
  }
  reloading = true;
  sessionStorage.setItem('abi-reload', cv);
  if (announce) toast(`Version ${cv} wird geladen …`);
  setTimeout(() => location.reload(), announce ? 700 : 0);
  return true;
}

function wireUpdates() {
  if (!('serviceWorker' in navigator)) return;

  /* Auf 'controllerchange' ist kein Verlass: aktualisiert sich dieselbe
     Registrierung, gilt die Seite nicht als "neu kontrolliert" und das
     Ereignis bleibt aus. Verlässlich ist der Zustandswechsel des neuen
     Workers auf 'activated' — dann liegt der frische Cache bereit. */
  const watch = (w) => {
    if (!w) return;
    if (w.state === 'activated') { applyIfNewer(false); return; }
    w.addEventListener('statechange', () => {
      if (w.state === 'activated') applyIfNewer(false);
    });
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => applyIfNewer(false));

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      watch(reg.installing); watch(reg.waiting);
      reg.addEventListener('updatefound', () => watch(reg.installing));
      navigator.serviceWorker.ready.then(() => applyIfNewer(false));
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    }).catch(() => {});
  });
}

/* ── Start ──────────────────────────────────────────────────── */

load();
applyTheme(db.theme);
wire();
wireBack();
nav(db.setup || db.faecher.length ? 'halbjahre' : 'home');

/* Bittet den Browser, den Speicher nicht bei Platzmangel wegzuräumen. */
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

wireUpdates();
