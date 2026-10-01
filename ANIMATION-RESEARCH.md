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

The front row has two slightly offset foot tracks on the same painted trail, allowing opposite-direction animals to pass with consistent depth order. Existing saved animals and new scans both begin on row zero. Each edge admits its oldest waiting drawing, even when the other edge is continuously busy. Admission gaps and greeting pauses are sampled independently; a large scan backlog reduces their range while retaining minimum following distance.

The scene now has two walking rows. The distant third pass is removed; the single background row admits at most three active animals. Body opacity stays at 1, with color haze and a moderate mist overlay supplying distance instead of transparent overlapping silhouettes.
