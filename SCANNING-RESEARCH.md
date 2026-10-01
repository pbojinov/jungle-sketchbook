# Automatic sheet scanning

## Choice

Use OpenCV on the local server. It provides both coded-marker detection and
feature matching, so the phone can use the same capture screen for every animal.
The original photograph stays on this server; the browser receives identification
and four normalized page corners, then makes the cutout with the existing canvas
pipeline. No cloud image service is involved.

Options researched:

- [OpenCV feature matching and homography](https://docs.opencv.org/5.0/tutorials/features/feature_homography/feature_homography.html):
  matches known artwork and estimates perspective with robust outlier rejection.
  This supports existing unmarked coloring sheets and animal identification.
- [OpenCV ArUco detection](https://docs.opencv.org/4.13.0/d5/dae/tutorial_aruco_detection.html):
  returns marker IDs and their ordered corner coordinates. Four different codes
  on each sheet encode both its animal and the page location of each mark.
- [jscanify](https://github.com/puffinsoft/jscanify): an OpenCV.js document scanner
  suitable for browser paper-outline detection. It does not by itself identify
  which of our animals is on the sheet. Server-side OpenCV avoids requiring each
  phone to download and initialize the vision runtime.

## Detection order and fallback

1. Look for ArUco codes from our six-sheet catalog. One readable code identifies
   the species; at least three consistent codes are required for automatic
   alignment. Fit a homography and check residuals and projected page geometry.
2. Match SIFT features against the exact original artwork of all six animals.
   Fit a robust homography with USAC/MAGSAC and reject uncertain results.
3. If artwork alignment is uncertain, try a large convex paper outline. This
   can supply corners even when identification still needs a user choice.
4. Ask only for the remaining animal/corner information. Corners can be dragged
   and the cutout updates when a drag finishes. A changed photo, reset, or manual
   edit cancels pending detection so a late response cannot overwrite it.

Artwork alignment requires at least 22 inliers, an inlier ratio of 0.35, spatial
coverage of 0.20 of the animal, and a minimum span of 0.45 in both axes. Median
alignment error must be below 2.3 pixels in the detector image. This prevents a
face close-up with many matches from masquerading as a confidently aligned page.
Competing animal matches also require a clear winner. Projected page geometry is
checked separately; slightly cropped paper edges can be inferred, with padded
canvas space so the user can still adjust their corners.

These thresholds and the displayed internal confidence score are heuristics,
not calibrated probabilities. Strong glare, folds, heavy decoration over most
ink, unfamiliar templates, or badly cropped animals can require manual alignment.

## Print design

Each US Letter sheet has four 4x4 ArUco marks from `DICT_4X4_50`, with a white
quiet zone. IDs 0–23 are assigned in animal order: elephant, giraffe, lion, monkey,
tiger, zebra; within each animal the order is TL, TR, BR, BL. Mark locations sit
inside a quarter-inch printer margin. Animal artwork retains its original page
placement, so the same silhouette and animation rig still fit.

The SVG templates and print-all PDF share geometry from `scanning/registration.py`.
Print at actual size and keep the marks clear. The older plain corner marks are
not decoded as ArUco; those sheets remain supported through artwork matching.

## Validation

- All six supplied photographs identified correctly and produced automatic page
  alignment: three differently colored giraffes, decorated lion, elephant, tiger.
  Warm detector time was approximately 0.6–0.9 seconds on this development Mac;
  this is a small test set and does not establish field accuracy.
- Browser capture produced the decorated elephant cutout automatically while
  preserving crayon texture and gems.
- A 390 × 844 browser frame verified the phone layout and dragging a detected
  corner; controls stay below the image at this width. This is not a physical
  iOS/Android camera test.
- All six species passed synthetic perspective tests with and without marks.
  One covered mark still permits alignment using the other three.
- Every marker in the rendered six-page PDF decoded correctly (24 total).
- Blank white/black images and a giraffe face-only crop do not receive confident
  complete-artwork alignment. Impossible projected geometry is rejected.
- Pointer regression checks cover grabbing away from a marker center, multi-touch,
  crossing/clamping corners, reset during a drag, and invalidating stale cutouts.
- Server smoke checks cover malformed input and manual fallback with a missing
  Python executable.

Run the commands in README.md. Reference features are cached in the repository;
rebuild them whenever original artwork or its page placement changes.
