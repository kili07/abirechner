#!/usr/bin/env python3
"""Erzeugt die drei App-Icons nach Abschnitt 5.14 der Bauanleitung.

    python3 icons/make-icons.py

Farbe und Größe stehen als Konstanten am Kopf — wer etwas ändern will,
ändert eine Zeile und lässt das Skript neu laufen. Gezeichnet wird auf
2048 px und erst am Ende verkleinert, sonst werden die Kanten stufig.
"""
from PIL import Image, ImageDraw, ImageFont
import os

# ── Vorgaben aus Abschnitt 5.14 ─────────────────────────────────
HINTERGRUND = '#1B1B1B'   # Grau der dunklen Android-Icons, nicht Schwarz
MOTIV       = '#FFFFFF'   # flächiges Weiß, keine Akzentfarbe
BREITE_ANY  = 0.45        # Motivbreite im voll sichtbaren Icon
BREITE_MASK = 0.32        # Motivbreite im maskable-Icon (Android zeigt ~85 %)

RASTER = 2048             # Zeichenauflösung
FONT = '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
HIER = os.path.dirname(os.path.abspath(__file__))


def motiv():
    """Doktorhut über dem Schriftzug ABI, weiß auf durchsichtigem Grund.
    Alle Maße beziehen sich auf ein 512er Entwurfsraster.
    Zurück kommt das Bild auf seine tatsächliche Ausdehnung beschnitten —
    nur so lässt es sich anschließend auf eine Zielbreite rechnen."""
    img = Image.new('RGBA', (RASTER, RASTER), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    p = lambda v: v * RASTER / 512.0

    # Kopfteil des Huts: gerader Aufsatz plus halbe Ellipse als runder Boden
    d.rectangle([p(200), p(132), p(312), p(171)], fill=MOTIV)
    d.pieslice([p(200), p(136), p(312), p(206)], 0, 180, fill=MOTIV)

    # Quaste: Schnur und Knoten. Das Brett wird danach darübergelegt und
    # schneidet den Ansatz ab, dadurch hängt sie sichtbar daran.
    d.line([(p(330), p(106)), (p(341), p(178))], fill=MOTIV, width=max(1, int(p(8))))
    d.ellipse([p(330), p(174), p(352), p(208)], fill=MOTIV)

    # Brett zuletzt
    d.polygon([(p(256), p(86)), (p(376), p(122)), (p(256), p(158)), (p(136), p(122))], fill=MOTIV)

    # Schriftzug auf feste Breite eingepasst statt auf gut Glück skaliert
    groesse = int(p(150))
    font = ImageFont.truetype(FONT, groesse)
    b = d.textbbox((0, 0), 'ABI', font=font)
    font = ImageFont.truetype(FONT, max(8, int(groesse * p(318) / (b[2] - b[0]))))
    b = d.textbbox((0, 0), 'ABI', font=font)
    d.text((p(256) - (b[2] - b[0]) / 2 - b[0], p(235) - b[1]), 'ABI', font=font, fill=MOTIV)

    return img.crop(img.getbbox())


def kachel(size, anteil):
    """Volle Fläche in HINTERGRUND, Motiv mittig auf `anteil` der Kantenlänge.
    Kein Alphakanal: der Hintergrund deckt alles ab, und durchsichtige Ecken
    füllt iOS je nach Version mit Weiß."""
    img = Image.new('RGB', (RASTER, RASTER), HINTERGRUND)
    m = motiv()
    breite = int(RASTER * anteil)
    hoehe = round(m.height * breite / m.width)
    m = m.resize((breite, hoehe), Image.LANCZOS)
    img.paste(m, ((RASTER - breite) // 2, (RASTER - hoehe) // 2), m)
    return img.resize((size, size), Image.LANCZOS)


for name, size, anteil in [('icon-192.png', 192, BREITE_ANY),
                           ('icon-512.png', 512, BREITE_ANY),
                           ('icon-maskable-512.png', 512, BREITE_MASK)]:
    ziel = os.path.join(HIER, name)
    kachel(size, anteil).save(ziel, optimize=True)
    print(f'{name}: {os.path.getsize(ziel)} Bytes, Motiv {anteil:.0%} breit')
