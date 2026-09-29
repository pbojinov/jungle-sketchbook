# Jungle art direction

## References consulted — September 28, 2026

- [ARTE Museum exhibition](https://newyork.artemuseum.com/exhibition): luminous forest imagery and a drawing-led interactive experience. Preserve the teal, indigo, and muted violet mood; keep the animals the focus.
- [ARTE Museum Busan — Jungle Glow reference image](https://cdn.imweb.me/thumbnail/20240812/1963ecac78460.jpg): layered luminous vegetation around tall vertical trunks. Referenced for direction; no external artwork is embedded or copied.
- [Gardens by the Bay Cloud Forest](https://www.gardensbythebay.com.sg/en/things-to-do/attractions/cloud-forest.html) and [Cloud Forest trail](https://www.gardensbythebay.com.sg/en/plan-your-visit/itinerary-planner/cloud-forest-trail.html): dense fern/moss layers, broad foliage, framed views, and mist.

## Implementation

`public/scene.js` draws original Canvas artwork. Filled, asymmetric leaf blades and fine veins replace the old skeletal fronds. Cached fern and broad-leaf plant sprites sway gently at the edges. The upper canopy and trailing vines frame an open central clearing. Gradient trunks have roots and restrained bark detail; smaller trunks sit farther back. Irregular ground contours and tiny low-contrast leaf-litter marks replace the flat floor boundary.

The existing mint/amber floating orbs remain, now with soft halos. The teal/indigo/violet palette remains. Mist is still composited after each distant animal row. The expensive static forest and plant sprites are cached per viewport; each frame reuses them and only animates plant transforms and orbs. Reduced-motion preferences freeze foliage sway and orb movement.

The accompanying timing adjustment shortens the welcome poof to 450 ms and the greeting pause to 250–700 ms. Entry gaps are narrower but following-distance protection remains.

## Verification

JavaScript syntax, movement/spacing regression checks, geometry, all four species
masks, and server/API smoke tests pass. The local browser permission prevented
agent-side visual inspection of the redesigned scene. The user reviewed the
Cloudflare phone preview and confirmed that the jungle looks good for now.
