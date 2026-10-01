# Jungle Sketchbook

Printed coloring sheet → phone photo → child's artwork → animated jungle display.

Six animals use the supplied coloring-sheet artwork: **elephant, giraffe, lion,
monkey, tiger, and zebra**. The old V0 ZIP is not used. Source PDFs are preserved
in `source-art/`; clean vector traces supply the printable sheets, silhouettes,
and colored demo animals.

## Run

Requires Node.js 18 or newer. No npm installation or build is needed.

```sh
node server.js
```

Open the printed local or LAN URL. The launcher links to each capture station,
printable sheet, and `/display.html`. The display has six sample-animal buttons.
`/coloring-sheets.pdf` downloads all six sheets in one US Letter PDF.

## Color and scan

1. Print the new PDF at actual size on US Letter, or use the supplied original
   sheet. Animal positions match the original pages.
2. Color it and open the matching animal's capture station on your phone.
3. Select a photo showing the whole sheet. Tap the **paper corners** in order:
   top-left, top-right, bottom-right, bottom-left. Printed markers are optional.
4. For a flat scan already cropped to the entire page, use **Use whole image**.
   This option does not automatically detect the animal or correct a tilted photo.
5. Select **Cut out**, check alignment, then **Send to safari**.

New arrivals appear with a poof in the waiting area, then enter as space opens.
Their feet deform the continuous drawing, preserving the face and the child's
coloring. Speeds drift gently, with subtle artistic differences between species.
Animals move to a smaller, hazier row only after exiting fully offscreen.

The new artwork has a version identifier. Refresh old capture/display tabs before
using these sheets; the old animal textures do not fit the new silhouettes.

## Checks

```sh
node test/artwork.js
node test/motion.js
node test/geometry.js
node test/smoke.js
```

These cover vector assets, foot mesh bounds and orientation, direction, spacing,
offscreen row transitions, perspective math, and the server/API contract.
`/tests/sample-textures.html` additionally checks sample rendering in a browser.

## Rebuild artwork

Only maintainers rebuilding assets need Python with Pillow, NumPy,
opencv-python-headless, svglib, and reportlab, plus Poppler and Potrace on PATH.
Run from the repository:

```sh
python3 tools/trace-source-art.py
python3 tools/build-animal-assets.py
python3 tools/build-coloring-pdf.py
```

Tracing removes isolated scan specks and retains the main drawing. Sample color
regions and foot positions are calibrated to these exact six source PDFs; changing
a source requires reviewing those settings. The final PDF is written to
`output/pdf/jungle-coloring-sheets.pdf` and copied to the web folder.

## Implementation

- `server.js`: static files, in-memory animals, and live events.
- `public/capture.js` / `geometry.js`: manual registration and silhouette extraction.
- `public/animals/`: catalog, traced paths, shared crop/rig geometry, print templates.
- `public/samples.js`: colored demo textures from the traced artwork.
- `public/motion.js` / `rig.js`: pacing, spacing, and continuous foot deformation.
- `public/display.js` / `scene.js`: arrivals, lifecycle, mist, and jungle scenery.

`POST /api/animals` accepts `{species, artworkVersion: "2026-09-artwork", texture}`,
where texture is a PNG data URL. `GET /api/animals` returns up to 30 drawings;
`GET /api/events` streams updates; `POST /api/clear` clears them.

Data is held in memory and disappears when the server restarts. There is no
login or access control; this prototype is intended for a trusted home network.

## Temporary phone preview

Run `cloudflared tunnel --url http://localhost:8000` and open its generated HTTPS
URL with `/display.html`. Quick Tunnel displays use polling instead of SSE. Stop
the tunnel when finished. For a home-network preview, use the server's LAN URL.
