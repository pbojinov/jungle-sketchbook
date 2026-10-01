# Jungle art direction

## References consulted — September 28, 2026

- [ARTE Museum exhibition](https://newyork.artemuseum.com/exhibition): luminous forest imagery and a drawing-led interactive experience. Preserve the teal, indigo, and muted violet mood; keep the animals the focus.
- [ARTE Museum Busan — Jungle Glow reference image](https://cdn.imweb.me/thumbnail/20240812/1963ecac78460.jpg): layered luminous vegetation around tall vertical trunks. Referenced for direction; no external artwork is embedded or copied.
- [Gardens by the Bay Cloud Forest](https://www.gardensbythebay.com.sg/en/things-to-do/attractions/cloud-forest.html) and [Cloud Forest trail](https://www.gardensbythebay.com.sg/en/plan-your-visit/itinerary-planner/cloud-forest-trail.html): dense fern/moss layers, broad foliage, framed views, and mist.

## Implementation

`public/scene.js` draws original Canvas artwork. Filled, asymmetric leaf blades and fine veins replace the old skeletal fronds. Cached fern and broad-leaf plant sprites sway gently at the edges. Individually cached canopy leaves pivot gently around their petioles; trailing vines bend progressively from fixed upper anchors, with attached leaves following the curve. A shared slow breeze has phase and depth offsets, keeping movement subtle while the camera, trunks and ground stay steady. Reduced-motion preferences freeze the background. The canopy and vines frame an open central clearing. Gradient trunks have roots and restrained bark detail; smaller trunks sit farther back. Irregular ground contours and tiny low-contrast leaf-litter marks replace the flat floor boundary.

The existing mint/amber floating orbs remain, now with soft halos. The teal/indigo/violet palette remains. Mist is composited after the one background animal row. Animals remain opaque so overlapping bodies do not appear as ghosts. The expensive static forest and plant sprites are cached per viewport; each frame reuses them and only animates plant transforms and orbs. Reduced-motion preferences freeze foliage sway and orb movement.

The accompanying timing adjustment shortens the welcome poof to 450 ms and the greeting pause varies with scan pressure. Entry gaps are narrower but following-distance protection remains.

## Verification

JavaScript syntax, movement/spacing regression checks, geometry, all six species masks, articulated knee-angle checks, grounded paths across portrait and landscape sizes, and server/API smoke tests pass. The current local display was visually inspected in the in-app browser.

The two walking paths and animal foot baselines now share `groundY`, including viewport and control-panel height. The painted floor begins behind the rear path. Foliage has larger slow sway. Both entry edges admit animals independently onto slightly offset tracks on the front trail. HTML, JavaScript and CSS are served without caching so refreshes show the current implementation.

Visible foot contact is measured from texture alpha at load time, excluding transparent crop padding before positioning the animal on its path.

There is one front row and one background row. The background admits at most three active animals, queuing subsequent passes until room opens. This keeps a large number of scans from forming a crowded distant pile.

The forest edge and the two walking paths use the same vertical interval. Continuous floor shading replaces the extra contour bands, and the trail interval is 11% of viewport height (subject to the existing short-screen limit). This keeps the visible depth gaps consistent without introducing another animal row.
