"""Rebuild registration-marked sheets without rebuilding sample textures."""
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scanning.registration import SPECIES, template_svg
for species in SPECIES:
    folder = ROOT/f'public/animals/{species}'
    svg = (folder/'ink.svg').read_text()
    ink = svg[svg.index('<g'):svg.rindex('</svg>')]
    (folder/'template.svg').write_text(template_svg(species, ink))
    print(species)
