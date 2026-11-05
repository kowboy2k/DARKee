# DARKee – génère les icônes PNG (sans dépendance) : python3 generer-icones.py
# Le contour dit le mode, le croissant dit la page en cours :
#   off     : fond bleu #5972c6, croissant gris clair → DARKee éteint (OFF)
#   on      : pas de contour, croissant jaune → « Actif par défaut », page sombre
#   siteoff : pas de contour, croissant bleu → « Actif par défaut », page coupée
#   idleon  : contour bleuté #5972c6, croissant jaune → « Inactif par défaut », page (ou domaine) allumée
#   idle    : contour bleuté #5972c6, croissant bleu → « Inactif par défaut », page pas allumée
# icon-*.png (icône principale de l'extension) = état « on ».
import os
import struct
import sys
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))

DARK, YELLOW, BLUE, RING = (32, 33, 36), (253, 214, 99), (138, 180, 248), (89, 114, 198)
STATES = {
    'off': {'bg': RING, 'moon': (214, 218, 226), 'ring': None},
    'on': {'bg': DARK, 'moon': YELLOW, 'ring': None},
    'siteoff': {'bg': DARK, 'moon': BLUE, 'ring': None},
    'idleon': {'bg': DARK, 'moon': YELLOW, 'ring': RING},
    'idle': {'bg': DARK, 'moon': BLUE, 'ring': RING},
}
SIZES = (16, 32, 48, 128)


def inside_rounded(px, py, inset=0.0, radius=0.22):
    lo, hi = inset + radius, 1 - inset - radius
    cx, cy = min(max(px, lo), hi), min(max(py, lo), hi)
    return (px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2


def colour_at(px, py, st, n):
    if not inside_rounded(px, py):
        return None
    if (px - 0.5) ** 2 + (py - 0.5) ** 2 < 0.30 ** 2 and not (px - 0.63) ** 2 + (py - 0.40) ** 2 < 0.25 ** 2:
        return st['moon']
    if st['ring']:
        # Contour : au moins 1,5 px à 16 px, plus fin en proportion sur les grandes tailles.
        width = max(1.5 / n, 0.07)
        if not inside_rounded(px, py, inset=width, radius=0.22 - width * 0.6):
            return st['ring']
    return st['bg']


def png(n, st, path, ss=4):
    rows = []
    for y in range(n):
        row = bytearray([0])
        for x in range(n):
            r = g = b = a = 0
            for sy in range(ss):
                for sx in range(ss):
                    c = colour_at((x + (sx + 0.5) / ss) / n, (y + (sy + 0.5) / ss) / n, st, n)
                    if c:
                        r += c[0]; g += c[1]; b += c[2]; a += 1
            row += bytes([r // a, g // a, b // a, 255 * a // (ss * ss)] if a else [0, 0, 0, 0])
        rows.append(bytes(row))

    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)

    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        f.write(chunk(b'IHDR', struct.pack('>IIBBBBB', n, n, 8, 6, 0, 0, 0)))
        f.write(chunk(b'IDAT', zlib.compress(b''.join(rows), 9)))
        f.write(chunk(b'IEND', b''))


for name, st in STATES.items():
    for n in SIZES:
        png(n, st, os.path.join(HERE, f'{name}-{n}.png'))
for n in SIZES:
    png(n, STATES['on'], os.path.join(HERE, f'icon-{n}.png'))
