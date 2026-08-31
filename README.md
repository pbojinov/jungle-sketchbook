# Live Sketchbook V0

A minimal home prototype inspired by the architecture of the open-source **Paper Aquarium** project: paper coloring → photo → rectified page → masked child artwork → live animated display.

## Run

Requires Node 18+ and no npm install.

```bash
node server.js
```

Then open:

- `http://localhost:8000/` — launcher
- `/capture.html` — capture station
- `/display.html` — safari wall
- `/animals/lion/template.svg` — printable lion sheet

The server prints LAN URLs so another computer/TV on the same Wi-Fi can open the display.

## V0 flow

1. Print the lion sheet.
2. Color it and take a photo of the whole page.
3. In Capture, choose the photo and tap TL → TR → BR → BL page corners.
4. Pure JavaScript computes a homography and perspective-corrects the page to an A4 canvas.
5. A predefined lion contour masks everything outside the animal.
6. The transparent PNG is POSTed to the local Node server.
7. The display receives it immediately over Server-Sent Events.
8. The lion crosses the screen and ages through foreground → midground → background layers.

## Why manual corners first?

Paper Aquarium automatically recognizes encoded corner markers. V0 intentionally keeps registration manual so we can validate the entire end-to-end system before adding computer-vision marker detection. The sheet already has four unique corner markers so V1 can automate capture without changing the paper.

## Next milestones

- Automatic marker recognition / auto-capture
- White-balance and color correction
- Remove/suppress printed gray guide lines
- Real skeletal/deformable 2D walk animation
- Five species
- Persistent saved drawings
- Better jungle art, ambient audio, fullscreen kiosk mode
- New-arrival spotlight, then depth-layer aging
