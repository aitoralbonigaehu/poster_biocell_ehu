"""Light copy of the poster PDF: one 200 dpi JPEG page (4:4:4, q88) plus an invisible text layer (search / copy).
The full vector PDF (4800 form objects, a 9 MB page stream) takes ~40-70 s to render once; this one opens at once.
usage: python tools/make_light_pdf.py [in.pdf] [out.pdf] [dpi]"""
import os, sys, logging, tempfile
import pypdfium2 as pdfium, pdfplumber
from PIL import Image
from reportlab.pdfgen import canvas
logging.getLogger('pdfminer').setLevel(logging.ERROR)
Image.MAX_IMAGE_PIXELS = None
src = sys.argv[1] if len(sys.argv) > 1 else 'Macrophage_poster.pdf'
out = sys.argv[2] if len(sys.argv) > 2 else src.replace('.pdf', '_light.pdf')
dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 200
page = pdfium.PdfDocument(src)[0]
W, H = page.get_width(), page.get_height()
im = page.render(scale=dpi / 72).to_pil().convert('RGB')
jpg = os.path.join(tempfile.mkdtemp(), 'page.jpg')     # a JPEG *file* is embedded as is (a buffer gets re-encoded)
im.save(jpg, 'JPEG', quality=88, subsampling=0, optimize=True, dpi=(dpi, dpi))
with pdfplumber.open(src) as p:
    words = p.pages[0].dedupe_chars(tolerance=1).extract_words(extra_attrs=['size'], keep_blank_chars=False)   # labels are drawn twice (halo + ink)
c = canvas.Canvas(out, pagesize=(W, H), pageCompression=1)
c.setTitle('How a macrophage destroys what it engulfs (light)')
c.drawImage(jpg, 0, 0, width=W, height=H)
# invisible text (render mode 3), each word stretched to its own box so a selection lands on the drawing
for w in words:
    size = max(1.0, float(w['size'])); fw = c.stringWidth(w['text'], 'Helvetica', size)
    t = c.beginText(); t.setTextRenderMode(3); t.setFont('Helvetica', size)
    t.setHorizScale(100 * (w['x1'] - w['x0']) / fw if fw > 0 else 100)
    t.setTextOrigin(w['x0'], H - w['bottom'] + size * 0.2); t.textOut(w['text']); c.drawText(t)
c.showPage(); c.save()
print(out, f'{im.size[0]}x{im.size[1]} px at {dpi} dpi, {len(words)} words searchable')
