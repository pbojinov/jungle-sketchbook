# Jungle Sketchbook

A local, browser-based prototype inspired by museum coloring installations and
the open-source Paper Aquarium architecture:

**printed coloring sheet → phone photo → corrected page → child artwork cutout → animated TV display**

The first milestone is intentionally narrow: four animal templates, manual
corner selection, deterministic masks, and simple paper-cutout animation. This
proves the full home-network pipeline before we invest in automatic scanning and
articulated animal rigs.

## Current status

V0 supports:

- Printable A4 lion, fox, zebra, and gazelle sheets with four corner markers
- Photo selection directly from a phone camera or photo library
- Manual TL → TR → BR → BL corner registration
- Perspective correction using a projective homography
- A predefined species silhouette that preserves the child's exact pixels
- Live delivery from the capture device to every open display
- Foreground → midground → background aging and eventual removal
- Multiple capture/display devices on the same home network

The server uses only Node's standard library. There is no install or build step.

Run the small test suite with:

```bash
node test/geometry.js
node test/lion-mask.js
node test/fox-mask.js
node test/zebra-mask.js
node test/gazelle-mask.js
node test/smoke.js
```

These tests cover the homography/corner math and the server/API contract. Full
browser automation and visual snapshot tests are intentionally deferred until
the interaction and art direction stabilize.

## Requirements

- Node.js 18 or newer
- A computer that stays on while the experience is running
- A phone/tablet and display device on the same local network
- A modern browser with Canvas, `fetch`, and Server-Sent Events support

## Quick start

```bash
node server.js
```

The terminal prints a localhost URL and, when available, one or more LAN URLs:

```text
Live Sketchbook V0: http://localhost:8000
LAN: http://192.168.1.50:8000
```

Open these pages:

| Page | Purpose |
| --- | --- |
| `/` | Launcher and links |
| `/animals/lion/template.svg` | Printable lion sheet |
| `/animals/fox/template.svg` | Printable fox sheet |
| `/animals/zebra/template.svg` | Printable zebra sheet |
| `/animals/gazelle/template.svg` | Printable gazelle sheet |
| `/capture.html?species=lion` | Lion capture station |
| `/capture.html?species=fox` | Fox capture station |
| `/capture.html?species=zebra` | Zebra capture station |
| `/capture.html?species=gazelle` | Gazelle capture station |
| `/display.html` | Fullscreen safari display |

### Try the complete flow

1. Open a species template and print it at actual size on A4 or US Letter.
2. Color the animal while leaving all four corner markers visible.
3. Open `/display.html` on the display computer or TV browser.
4. Open that species' capture link using the server's LAN URL on the phone.
5. Take or select a photo containing the entire sheet.
6. Tap the page corners in this order: TL → TR → BR → BL.
7. Select **Cut out**, inspect the previews, and select **Send to safari**.

The display receives the PNG immediately. A new animal starts large in the
foreground, later moves to smaller depth lanes, and eventually leaves the scene.

## Home deployment options

For development, run the server and display browser on the same Mac and connect
it to the Sony Bravia over HDMI. The capture phone can be anywhere on the same
Wi-Fi.

The intended finished setup keeps the server elsewhere in the house. The Bravia
loads the display over the network using either:

1. An Android TV browser
2. A small sideloaded Android TV WebView app
3. An HDMI-connected computer or Raspberry Pi as a fallback

The Android TV app should remain a thin fullscreen client. Image processing,
state, and rendering continue to live in this web project.

## Project structure

```text
server.js                         Local HTTP, API, and event server
ARCHITECTURE.md                   Design, data flow, and roadmap
public/index.html                 Launcher
public/capture.html               Capture interface
public/geometry.js                Tested homography and corner-validation math
public/capture.js                 Photo, lion mask, and upload pipeline
public/display.html               Fullscreen safari canvas
public/display.js                 Scene and animal lifecycle
public/styles.css                 Launcher/capture styles
public/animals/lion/template.svg  Printable sheet and source geometry
public/animals/lion/shape.js      Shared lion extraction mask and crop bounds
public/animals/fox/template.svg   Printable fox sheet and source geometry
public/animals/fox/shape.js       Shared fox extraction mask and crop bounds
public/animals/zebra/             Zebra template and shape module
public/animals/gazelle/           Gazelle template and shape module
test/smoke.js                     Dependency-free server/API smoke test
test/geometry.js                  Focused image-geometry unit tests
test/lion-mask.js                 Template/mask consistency test
test/fox-mask.js                  Fox template/mask consistency test
test/zebra-mask.js                Zebra template/mask consistency test
test/gazelle-mask.js              Gazelle template/mask consistency test
```

## API

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/animals` | Return up to 20 recent in-memory animals |
| `POST` | `/api/animals` | Accept `{ species, texture }` and broadcast it |
| `GET` | `/api/events` | Server-Sent Events stream for displays |
| `POST` | `/api/clear` | Clear all in-memory animals and displays |

`texture` is a PNG data URL. Uploads are capped at 5 MB and the server retains a
maximum of 30 animals. Data is currently held in memory and disappears whenever
the server restarts.

## Important V0 limitations

- Four animal species with fixed silhouettes
- Manual page-corner selection
- Simplified paper-cutout motion rather than a skeletal walk cycle
- No persistent storage, authentication, or access control
- Intended only for a trusted home LAN; do not expose this server to the internet
- The printed guide lines remain visible in the extracted artwork

## Troubleshooting

- Make sure the phone and server are on the same Wi-Fi and not a guest network.
- Allow incoming Node connections if macOS asks about firewall access.
- Use the printed numeric LAN URL if a `.local` hostname does not resolve.
- Keep all four markers and the full edge of the paper visible in the photo.
- If the preview twists, reset and tap the corners in the required order.
- If no LAN URL prints, find the Mac's local IP in Network settings and append
  `:8000`; the server still listens on all network interfaces.

## Roadmap

1. Automatic corner-marker recognition, stability detection, and auto-capture
2. White-balance/color correction and printed-guide suppression
3. A deformable 2D lion mesh with a reusable walk cycle
4. Rhino and elephant templates, then species-specific rigs
5. Persistent drawings, scene controls, sound, and improved jungle artwork
6. Fullscreen kiosk behavior and a sideloaded Sony Android TV client

See [ARCHITECTURE.md](ARCHITECTURE.md) for the validated system design, risks,
and the recommended order of implementation.
