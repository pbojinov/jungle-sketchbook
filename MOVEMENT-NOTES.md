# Movement tuning

The six-species animation pass uses the original scanned artwork and texture UVs.
Every animal gets a continuous mesh; limbs bend around their knees rather than
moving as rectangular cutouts. The face and tail remain connected to the body.

| Animal | Walk and body | Head and tail |
| --- | --- | --- |
| Elephant | Short, heavy steps; small knee recovery | Slow nod, trunk sway, restrained tail swing |
| Giraffe | Long stride and lifted knees | Low-frequency neck sway, gentle tail swing |
| Lion | Relaxed alternating paws | Mane/head nod, expressive tail-tip sway |
| Monkey | Higher foot recovery and a springier body | Curious head tilt, curled-tail movement |
| Tiger | Long, low prowl with little body bounce | Measured head motion, slow tail sweep |
| Zebra | Four hoof phases, higher recovery | Rhythmic nod and quicker small tail flicks |

Blinking compresses the existing eye ink into a thin closed lid instead of drawing
over a child's colors. Blinks take 0.22 seconds, recur roughly every 4–6.5 seconds,
and have individual offsets, small timing variation and occasional double blinks.

Gait advances with actual distance traveled, so stopped animals do not keep
stepping. Species stride lengths keep stance motion tied to ground speed. Head
and tail motion includes a small independent idle component. WebGL shares a
renderer and caches uploaded textures; a Canvas triangle fallback is available.

The base artistic walking pace is 36 rather than 28 pixels/second at the reference
front-row scale. Species speed factors remain elephant 0.94×, giraffe 1.02×,
lion 0.98×, monkey 1.04×, tiger 1.01× and zebra 1.02×. Individual tempo changes
remain smooth. These are visual choices rather than biological measurements.

The queue keeps the 0.45-second welcome poof. The first animal appears onscreen;
following animals begin at either edge with only their leading portion visible,
so they can start before their entire body fits. Admission preserves the following
distance plus a small buffer. Greetings and gaps vary with the scan backlog. Tests measure the
second arrival starting within four seconds at phone, desktop and wide viewports.
The queue still admits the oldest loaded animal first and row changes stay offscreen.

The background uses cached individual canopy blades and attached vine leaves.
A shared slow breeze has depth and phase offsets; each vine remains fixed at its
upper anchor and moves more toward its tip. Plants rotate and flex at their roots.
Trunks, ground and camera remain fixed. Canopy tips and edge plants travel about 10–20 pixels, with vine tips moving
about 15–25 pixels at a desktop viewport;
reduced-motion preferences freeze the background.

## Retired lineup research

Research checked September 28, 2026. These sources describe running capabilities,
not directly comparable relaxed walking speeds:

- Red fox: about 48 km/h maximum, University of Michigan Animal Diversity Web: https://animaldiversity.org/accounts/Vulpes_vulpes/
- Lioness: up to 53 km/h sprint, San Diego Zoo: https://animals.sandiegozoo.org/animals/lion
- Zebra: over 64 km/h running, San Diego Zoo: https://animals.sandiegozoo.org/animals/zebra
- Thomson’s gazelle: 50 mph, San Diego Zoo Safari Park visitor packet: https://sdzsafaripark.org/sites/default/files/2020-11/disabilities_hearing_packet-c_0.pdf

The generic fox/gazelle drawings do not identify a species. Red fox and Thomson’s
gazelle are reference examples only. Scene speeds are artistic tuning, not biological
walking-speed measurements: fox 0.96×, lion 0.98×, zebra 1.02×, gazelle 1.06×.
Individuals vary ±2%. Every 2.5–8 seconds they choose a pace target within ±12%,
easing toward it over roughly 1.4 seconds. Entry gaps vary from 0.75× to 1.45×
the usual gap, and initial greeting pauses range from 0.25 to 0.7 seconds. Faster followers ease off and preserve a minimum
gap; step cadence follows actual distance traveled. Row changes still happen offscreen.

New scans appear immediately in a waiting area with a brief cloud animation.
They remain still until their row has enough room, with a minimum 0.45-second
welcome display. The row queue admits the oldest loaded drawing first.

The research-based revision is documented in `ANIMATION-RESEARCH.md`. Saved animals now join the front row too. Opposing tracks admit independently, and sparse scan traffic has wider spacing variation than a busy queue. Fixed-length leg chains, continuous contact velocities and staggered footfalls replace stretched IK and simultaneous high steps.
