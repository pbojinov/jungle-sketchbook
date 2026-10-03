# Jungle Sketchbook

Printed coloring sheet → phone photo → child's artwork → animated jungle display.

Six animals use the supplied coloring-sheet artwork: **elephant, giraffe, lion,
monkey, tiger, and zebra**. The old V0 ZIP is not used. Source PDFs are preserved
in `source-art/`; clean vector traces supply the printable sheets, silhouettes,
and colored demo animals.

<img width="890" height="992" alt="image" src="https://github.com/user-attachments/assets/988fb2bb-bdfa-468a-90e1-b2bcdb56e903" />

## Run

Requires Node.js 18 or newer. No npm installation or build is needed.
Automatic scanning also needs Python 3 and OpenCV on the server:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-scan.txt
node server.js
```

On Windows, use `.venv\Scripts\python.exe` for the pip command. The server finds
the project virtual environment automatically; `SCANNER_PYTHON` can select another
Python executable. Without OpenCV, capture still offers manual alignment.

Open the printed local or LAN URL. The launcher has one **Scan your animal** entry point at
`/capture.html`. Printing lives separately at `/print.html`, with individual sheets
and a print-all PDF. `/display.html` has six sample-animal buttons.
`/coloring-sheets.pdf` downloads all six sheets in one US Letter PDF.

## Color and scan

1. Print at actual size on US Letter. New sheets have four coded corner marks;
   existing original sheets also work through artwork matching.
2. Color it and open **Scan your animal** on your phone.
3. Take a photo or choose an existing image. The server identifies the animal,
   detects the page corners, and prepares the cutout automatically.
4. Check the preview. Drag any corner to adjust it; **Reset corners** is beside
   the image. **Change animal** allows correcting the identification.
5. Select **Send to safari**. If detection is uncertain or unavailable, the page
   asks for the animal and/or the four paper corners it still needs. For a flat
   scan cropped to the page edges, **Use whole image** skips perspective detection.

Photos are analyzed on your own server, with no external image service. New print
marks encode both species and corner position. The detector can align a marked
sheet with three visible marks; original sheets use SIFT artwork matching and a
robust homography. A conservative paper-outline fallback handles clear page edges.
Confidence is a heuristic, not a calibrated probability. Heavy glare, covered ink,
folded sheets, and unfamiliar artwork can still require manual adjustment. See
[scanning research and validation](SCANNING-RESEARCH.md).

New arrivals appear with a poof in the waiting area, then enter as space opens.
Each species has its own bending-leg gait, head/neck motion, tail sway and staggered
blinks; the elephant also sways its trunk. A continuous texture mesh preserves the
child's ink and coloring. Queued arrivals begin entering at the edge as soon as a
safe gap opens, with shorter greetings and a slightly quicker walking pace.
Speeds still drift gently. Canopy leaves, rooted plants and hanging vines move in
a slow breeze; background animation freezes for reduced-motion preferences.
All animals, including saved drawings after a refresh, start on the front row from either side. Gaps vary with scan pressure. After exiting fully offscreen, animals take one smaller, hazier background pass, with at most three active background animals. Their bodies remain opaque.

The front trail sits low on TV screens, with clearance based on the measured
control height. Jungle ambience starts automatically on the display; adjust
**Volume** (default 30%) with the slider, which remembers its level. If the
browser blocks autoplay, tap the display or press a key to enable sound.
Select the sound button to stop it. The recording is a local
CC0 asset, with source and license details in `public/audio/CREDITS.md`.

The new artwork has a version identifier. Refresh old capture/display tabs before
using these sheets; the old animal textures do not fit the new silhouettes.

## Checks

```sh
node test/artwork.js
node test/motion.js
node test/geometry.js
node test/capture.js
.venv/bin/python test/scanning.py
node test/smoke.js
node test/scene.js
node test/display.js
node test/soundscape.js
```

These cover vector assets, foot mesh bounds and orientation, direction, spacing,
offscreen row transitions, perspective math, draggable corner behavior, marker/artwork detection, rejection
of incomplete images, and the server/API contract including unavailable detection.
`/tests/sample-textures.html` additionally checks sample rendering in a browser.
`/tests/animal-animation.html` shows all six rigs together, with pause, scrub and
hold-blink controls for visual inspection. WebGL renders the continuous mesh
without triangle seams; Canvas provides a fallback when WebGL is unavailable.

## Rebuild artwork

Only maintainers rebuilding assets need Python with Pillow, NumPy,
opencv-python-headless, svglib, and reportlab, plus Poppler and Potrace on PATH.
Run from the repository:

```sh
python3 tools/trace-source-art.py
python3 tools/build-animal-assets.py
python3 tools/build-coloring-pdf.py
python3 scanning/build-references.py
```

Tracing removes isolated scan specks and retains the main drawing. Sample color
regions and foot positions are calibrated to these exact six source PDFs; changing
a source requires reviewing those settings. The final PDF is written to
`output/pdf/jungle-coloring-sheets.pdf` and copied to the web folder.

To change only the print marks, run `tools/build-print-templates.py` followed by
`tools/build-coloring-pdf.py`. Rebuild `scanning/reference-features.npz` whenever
the original artwork or its page placement changes. The cache avoids tracing
all reference features on the first scan.

## Implementation

- `server.js`: static files, in-memory animals, and live events.
- `public/capture.js` / `geometry.js`: automatic alignment, manual correction, and silhouette extraction.
- `scanning/`: persistent local OpenCV worker, reference features, and print marks.
- `public/animals/`: catalog, traced paths, shared crop/rig geometry, print templates.
- `public/samples.js`: colored demo textures from the traced artwork.
- `public/motion.js` / `rig.js`: pacing, spacing, and continuous foot deformation.
- `public/display.js` / `scene.js`: arrivals, lifecycle, mist, and jungle scenery.

`POST /api/detect` accepts `{image, species?}` with a JPEG/PNG data URL. It returns
`identified`, `species`, `confident`, normalized `corners` in TL/TR/BR/BL order,
`method`, and heuristic `score`. A detected animal can be retained even when
its page alignment is uncertain. Missing dependencies return 503 for manual fallback.

`POST /api/animals` accepts `{species, artworkVersion: "2026-09-artwork", texture}`,
where texture is a PNG data URL. `GET /api/animals` returns up to 20 drawings;
`GET /api/events` streams updates; `POST /api/clear` clears them.

Data is held in memory and disappears when the server restarts. There is no
login or access control; this prototype is intended for a trusted home network.

## Temporary phone preview

Run `cloudflared tunnel --url http://localhost:8000` and open its generated HTTPS
URL with `/display.html`. Quick Tunnel displays use polling instead of SSE. Stop
the tunnel when finished. For a home-network preview, use the server's LAN URL.
