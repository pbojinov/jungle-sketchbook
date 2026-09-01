# Jungle Sketchbook

A local, browser-based prototype inspired by museum coloring installations and
the open-source Paper Aquarium architecture:

**printed coloring sheet → phone photo → corrected page → child artwork cutout
→ animated TV display**

The prototype stays deliberately narrow: six known animal templates, automatic
registration with a manual fallback, deterministic masks, and simple
paper-cutout animation. This proves the full home-network pipeline while the
capture flow and articulated rigs evolve independently.

## Current status

V0 supports:

- Printable A4 lion, fox, zebra, gazelle, rhino, and elephant sheets
- Photo selection directly from a phone camera or photo library
- Automatic species and page-corner detection from four printed ArUco markers
- Manual TL → TR → BR → BL corner registration
- Perspective correction using a projective homography
- A predefined species silhouette that preserves the child's exact pixels
- Live delivery from the capture device to every open display
- Persistent local PNG storage with atomic metadata updates
- PIN-protected parent controls for pause, retention, delete, and clear
- A local health endpoint for kiosk monitoring
- Fullscreen install metadata plus reduced-motion and low-power display modes
- Foreground → midground → background aging and eventual removal
- Multiple capture/display devices on the same home network

The server uses only Node's standard library. There is no install or build step.

Run the small test suite with:

```bash
node test/geometry.js
node test/markers.js
node test/species-catalog.js
node test/animal-store.js
node test/display-config.js
node test/android-tv-contract.js
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
ADMIN_PIN=2468 node server.js
```

Choose a private PIN for your household. The server still runs without one,
but parent controls remain locked. Drawings are stored in the ignored `data/`
directory and survive server restarts.

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
| `/animals/rhino/template.svg` | Printable rhino sheet |
| `/animals/elephant/template.svg` | Printable elephant sheet |
| `/capture.html?species=lion` | Lion capture station |
| `/capture.html?species=fox` | Fox capture station |
| `/capture.html?species=zebra` | Zebra capture station |
| `/capture.html?species=gazelle` | Gazelle capture station |
| `/capture.html?species=rhino` | Rhino capture station |
| `/capture.html?species=elephant` | Elephant capture station |
| `/display.html` | Fullscreen safari display |
| `/display-settings.html` | Per-device safari display settings |
| `/admin.html` | PIN-protected parent controls |

### Try the complete flow

1. Open a species template and print it at actual size on A4 or US Letter.
2. Color the animal while leaving all four corner markers visible.
3. Open `/display.html` on the display computer or TV browser.
4. Open that species' capture link using the server's LAN URL on the phone.
5. Take or select a photo containing the entire sheet.
6. Review the automatically detected corners. If detection fails, tap the page
   corners in this order: TL → TR → BR → BL.
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
public/index.js                   Catalog-driven launcher actions
public/species.js                 Shared species and behavior catalog
public/capture.html               Capture interface
public/capture-loader.js          Loads only the selected species shape
public/geometry.js                Tested homography and corner-validation math
public/markers.js                 Species marker mapping and page registration
public/capture.js                 Photo, lion mask, and upload pipeline
public/display.html               Fullscreen safari canvas
public/display.js                 Scene and animal lifecycle
public/display-config.js          Validated per-browser display preferences
public/display-settings.html      Display preference interface
public/styles.css                 Launcher/capture styles
public/admin.html                 Parent control interface
public/admin.js                   Parent authentication and drawing controls
lib/animal-store.js               Atomic PNG, index, and settings persistence
public/animals/lion/template.svg  Printable sheet and source geometry
public/animals/lion/shape.js      Shared lion extraction mask and crop bounds
public/animals/fox/template.svg   Printable fox sheet and source geometry
public/animals/fox/shape.js       Shared fox extraction mask and crop bounds
public/animals/zebra/             Zebra template and shape module
public/animals/gazelle/           Gazelle template and shape module
public/animals/rhino/             Rhino template and shape module
public/animals/elephant/          Elephant template and shape module
test/smoke.js                     Dependency-free server/API smoke test
test/geometry.js                  Focused image-geometry unit tests
test/markers.js                   Marker detection and registration tests
test/lion-mask.js                 Template/mask consistency test
test/fox-mask.js                  Fox template/mask consistency test
test/zebra-mask.js                Zebra template/mask consistency test
test/gazelle-mask.js              Gazelle template/mask consistency test
test/species-catalog.js            Catalog and all-species contract test
test/animal-store.js               Persistence, retention, and recovery tests
test/display-config.js             Display preference validation tests
test/android-tv-contract.js        Android manifest and WebView safety checks
android-tv/                        Sideloadable fullscreen Android TV wrapper
```

## API

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/animals` | Return up to 20 recent saved animals |
| `POST` | `/api/animals` | Accept `{ species, texture }` and broadcast it |
| `GET` | `/api/events` | Server-Sent Events stream for displays |
| `GET` | `/api/health` | Return storage, uptime, and display health |
| `POST` | `/api/admin/login` | Start a PIN-protected parent session |
| `PATCH` | `/api/admin/settings` | Pause arrivals or change retention |
| `DELETE` | `/api/animals/:id` | Delete one drawing as a parent |
| `POST` | `/api/clear` | Clear all saved drawings as a parent |

Uploads use PNG data URLs and are capped at 5 MB. The server stores decoded PNGs
and compact metadata locally, retaining 30 by default. The parent page can set a
limit from 1 to 100. API responses use immutable local texture URLs instead of
re-embedding every image.

## Display and kiosk mode

Open `/display-settings.html` on each display device to choose full or reduced
motion, cap rendering near 30 fps for low-power hardware, and select a quiet
reconnect indicator. These settings stay in that browser and do not affect the
capture devices or server.

The included web manifest launches `/display.html` fullscreen when the browser
allows installation. Browser installation generally requires HTTPS (localhost
is the development exception), so a plain HTTP LAN URL remains a normal browser
experience. The planned Android TV wrapper provides reliable fullscreen startup
for the Bravia without pretending local HTTP is a secure PWA origin.

The final TV wrapper lives in `android-tv/`. It keeps the screen awake, restores
immersive fullscreen mode, retries the display after network failures, and
blocks WebView navigation or resource loads outside the configured private LAN
origin. See `android-tv/README.md` for Android Studio, sideloading, remote-control
gestures, the cleartext-LAN exception, and the physical-device checklist.
The cleartext exception is limited to `sketchbook.local`; other private
addresses require HTTPS.

## Important V0 limitations

- Six animal species with fixed silhouettes
- Automatic registration still needs a real printed-photo validation set
- Simplified paper-cutout motion rather than a skeletal walk cycle
- Parent sessions reset when the server restarts
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

## Third-party code

The browser marker detector vendors js-aruco2 2.0.0 under its included license
at `public/vendor/js-aruco2/LICENSE.txt`. It makes no runtime network requests.
