# Leg animation research and implementation

Research checked September 30, 2026.

- [Autodesk: Animating a Quadruped Walk](https://download.autodesk.com/us/3dsmax/2011/help/files/WS1a9193826455f5ff-e569a012180ce589113f6.htm): offset the foreleg and hind-leg cycles rather than moving all limbs in parallel.
- [Autodesk: Add Weight Shifts and Spine Movement](https://download.autodesk.com/us/3dsmax/2011/help/files/WS1a9193826455f5ff-e569a012180ce589114c1.htm): animate the pelvis and shoulders while preserving foot constraints; avoid completely extended limbs and allow secondary head movement to lag.
- [Spine: IK Constraints](https://esotericsoftware.com/spine-ik-constraints): control the foot target with a two-bone chain and an explicit bend direction; avoid rapid straightening near maximum reach.
- [Spine: Weights](https://esotericsoftware.com/spine-weights): bind artwork to bones, tune the weights through the maximum animation range, and test the resulting deformation.
- [Spine runtimes](https://github.com/EsotericSoftware/spine-runtimes): an established option for authored skeletal assets. A runtime alone does not author the anatomy, foot targets, timing, or mesh weights for these scanned drawings. The existing shared WebGL renderer can render those corrected controls without replacing the capture pipeline.

## Changes informed by the research

The former solver stretched virtual bone lengths while its texture transforms only rotated the original lengths. Upper and lower bones therefore did not meet exactly at the solved knee. The replacement uses fixed segment lengths and contact targets authored inside their reachable range. Tests check both segment lengths, the transformed knee connection, and a minimum bend during body weight shifts.

Foot recovery now uses a Hermite curve whose horizontal velocity matches the stance at both boundaries. Vertical recovery uses a squared sine so lift-off and landing have zero vertical velocity. Gait advances with actual distance, using each animal's stance duration; the deformation amplitude is no longer multiplied by acceleration a second time. These measures reduce foot skating and toe snaps.

The visible hind and fore legs have staggered phases, with independent shoulder and pelvis weight shifts. Steps are longer horizontally and lower vertically than the previous high-stepping pass. Skin weights and body lowering are tuned separately for each illustration, with full-stride checks for inverted triangles, including blinking. The selected duty factors and amplitudes are artistic adaptations to these cartoon illustrations, not measured species-specific biomechanics.

Opposite-direction animals can pass on the same painted trail with consistent depth order. Existing saved animals and new scans both begin on row zero. Each edge admits its oldest waiting drawing, even when the other edge is continuously busy. Admission gaps and greeting pauses are sampled independently; a large scan backlog reduces their range while retaining minimum following distance.

The scene has four evenly spaced walking rows, with the first at the bottom of the viewport. Each background row admits at most three active animals. Body opacity stays at 1, with progressive color haze and mist supplying distance. Each drawing gets a stable size between 70% and 130%, which is included in spacing and gait cadence. Walking is 15% slower. The default lifecycle exits after row four; the optional infinite setting returns to row one from the original entry side after a complete offscreen exit.

## Continuous skeleton walk — October 3

The main display now uses Three.js 0.186.1, downloaded from npm with its SHA-512 integrity checked and MIT notice preserved. The hierarchy binds one continuous silhouette mesh to calibrated joints. Giraffe, lion, tiger and zebra hind legs include a forward-bending stifle and a separate rearward hock, rather than treating the visible hock as the knee. Foot targets keep stance planted and drive the hip/knee chains analytically; a controlled metatarsal pitch resolves the three-segment hind chain.

The Three.js bone matrices feed planar dual-quaternion blending, with calibrated uniform scale applied separately about the joints. Harmonic skin weights preserve the source artwork, and triangle-area correction reduces creasing. Contacts where two paws touch in the source drawing have separate weighted vertices so the paws can lift independently. WebGL blinking remaps texture sampling around the eyes, avoiding geometric compression of facial triangles. The Canvas renderer remains a fallback.

- [Three.js SkinnedMesh](https://threejs.org/docs/pages/SkinnedMesh.html): each vertex needs bone indices and weights, in addition to the skeleton.
- [Three.js CCDIKSolver](https://threejs.org/docs/pages/CCDIKSolver.html): foot targets can drive constrained bone chains. This implementation uses an analytic solver instead, with Three.js handling the hierarchy and bind matrices.
- [Three.js license](https://github.com/mrdoob/three.js/blob/dev/LICENSE): MIT.
- [Spine runtime license](https://esotericsoftware.com/spine-runtimes-license): using the runtime has editor licensing requirements; it is not an unconditional free runtime alternative.

- [Kavan et al.: Geometric Skinning with Approximate Dual Quaternion Blending](https://dcgi.fel.cvut.cz/en/publications/2008/kavan-tog-adqb/): the basis for reducing volume loss when blending rotations.
- [Spine Raptor example](https://esotericsoftware.com/spine-examples-raptor): multi-segment leg controls and constrained joint chains.

`node test/skeleton.js` loads the vendored Three.js library and the production skinning implementation. It checks mesh weights and indices, finite vertices through complete strides at both crop and ink baselines, joint-target agreement below 0.001 source pixels, and texture blink control for all six animals. `/tests/continuous-skeleton-preview.html` provides pause, scrub and held-blink inspection. Earlier previews rendered six rigs in roughly 14–19 ms on this desktop; that is not a phone or TV performance guarantee. The source drawings remain cartoon poses, and the selected gait amplitudes are artistic adaptations rather than measured species biomechanics. The user approved promoting this walk while further visual refinement remains possible.
