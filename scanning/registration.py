"""Shared print/detection geometry; coded marks stay outside the animal art."""
import json
from pathlib import Path
import cv2

ROOT = Path(__file__).resolve().parents[1]
SPECIES = list(json.loads((ROOT / 'public/animals/catalog.json').read_text()))
PAGE_WIDTH, PAGE_HEIGHT = 840, 1087
MARKER_SIZE = 42
MARKER_POSITIONS = [(32, 32), (766, 32), (766, 1013), (32, 1013)]
DICTIONARY = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)


def marker_points(position):
    x, y = MARKER_POSITIONS[position]
    size = MARKER_SIZE
    return [[x, y], [x + size, y], [x + size, y + size], [x, y + size]]


def marker_svg(species):
    tags = []
    for position, (x, y) in enumerate(MARKER_POSITIONS):
        marker_id = SPECIES.index(species) * 4 + position
        bits = cv2.aruco.generateImageMarker(DICTIONARY, marker_id, 6)
        tags.append(f'<rect x="{x-8}" y="{y-8}" width="58" height="58" fill="white"/>')
        for row in range(6):
            for col in range(6):
                if bits[row, col] == 0:
                    tags.append(f'<rect x="{x+col*7}" y="{y+row*7}" width="7" height="7" fill="black"/>')
    return ''.join(tags)


def template_svg(species, ink):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="8.5in" height="11in" viewBox="0 0 840 1087">'
            f'<rect width="840" height="1087" fill="white"/>{marker_svg(species)}'
            f'<text x="420" y="64" text-anchor="middle" font-family="sans-serif" font-size="24">'
            f'JUNGLE SKETCHBOOK · {species.upper()}</text>{ink}'
            '<text x="420" y="1014" text-anchor="middle" font-family="sans-serif" font-size="17">'
            'Name: ____________________</text>'
            '<text x="420" y="1059" text-anchor="middle" font-family="sans-serif" font-size="12">'
            'Print at actual size · Keep corner marks clear for automatic scanning</text></svg>')
