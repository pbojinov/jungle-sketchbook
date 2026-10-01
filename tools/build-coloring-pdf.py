"""Build the printable six-page vector PDF from the web templates."""
from pathlib import Path
import json, shutil
from reportlab.pdfgen import canvas
from reportlab.graphics import renderPDF
from svglib.svglib import svg2rlg
ROOT = Path(__file__).resolve().parents[1]
output = ROOT / 'output/pdf/jungle-coloring-sheets.pdf'
output.parent.mkdir(parents=True, exist_ok=True)
pdf = canvas.Canvas(str(output), pagesize=(612, 792))
pdf.setTitle('Jungle Sketchbook - Animal Coloring Sheets')
for species in json.loads((ROOT / 'public/animals/catalog.json').read_text()):
    drawing = svg2rlg(str(ROOT / f'public/animals/{species}/template.svg'))
    drawing.scale(612 / drawing.width, 792 / drawing.height)
    renderPDF.draw(drawing, pdf, 0, 0)
    pdf.showPage()
pdf.save()
shutil.copyfile(output, ROOT / 'public/coloring-sheets.pdf')
print(output)
