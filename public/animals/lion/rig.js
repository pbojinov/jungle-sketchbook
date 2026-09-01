(function exposeLionRig(root, factory) {
  const rig = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = rig;
  } else {
    root.AnimalRigs = root.AnimalRigs || {};
    root.AnimalRigs.lion = rig;
  }
})(typeof globalThis === 'object' ? globalThis : this, function createLionRigModule() {
  const width = 709;
  const height = 471;

  const parts = [
    {
      id: 'tail',
      path: `M525 166 C585 166 600 211 640 216 L645 248
        C595 248 575 208 525 193 Z
        M640 211 C660 196 685 208 690 229
        C685 251 660 261 640 243 C630 233 630 221 640 211 Z`,
      pivot: [535, 187],
      z: 0,
    },
    {
      id: 'rear-leg',
      path: `M260 278 L355 278 L346 363 L331 463 L281 463 L266 363 Z`,
      pivot: [305, 302],
      z: 1,
    },
    {
      id: 'front-leg',
      path: `M430 278 L520 278 L511 463 L461 463 L446 363 Z`,
      pivot: [475, 302],
      z: 2,
    },
    {
      id: 'body',
      path: `M220 120 C325 100 475 120 546 168
        C580 205 582 273 556 323
        C510 357 330 369 246 328
        C223 294 215 206 220 120 Z`,
      pivot: [380, 238],
      z: 3,
    },
    {
      id: 'mane',
      path: `M226 33 C276 58 306 108 306 168
        C306 233 278 288 231 318
        C181 348 121 343 76 313
        C31 283 8 228 16 168
        C23 108 51 58 101 33 C141 8 186 8 226 33 Z`,
      pivot: [228, 171],
      z: 4,
    },
  ];

  function poseAt(time, phase = 0) {
    const cycle = time * 5 + phase;
    const stride = Math.sin(cycle);
    return {
      bodyY: Math.abs(Math.sin(cycle)) * 3,
      'front-leg': stride * 0.18,
      mane: -stride * 0.012,
      'rear-leg': -stride * 0.18,
      tail: Math.sin(cycle * 0.7 + 0.8) * 0.1,
    };
  }

  function makePartCanvas(image, part) {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const partContext = canvas.getContext('2d');
    partContext.clip(new Path2D(part.path));
    partContext.drawImage(image, 0, 0);
    return canvas;
  }

  function create(image) {
    if (typeof document === 'undefined' || typeof Path2D === 'undefined') return null;
    if ((image.naturalWidth || image.width) !== width) return null;
    if ((image.naturalHeight || image.height) !== height) return null;

    const canvases = new Map(
      parts.map((part) => [part.id, makePartCanvas(image, part)]),
    );

    return {
      draw(context, time, phase) {
        const pose = poseAt(time, phase);
        context.save();
        context.translate(0, pose.bodyY);
        for (const part of parts) {
          const [pivotX, pivotY] = part.pivot;
          context.save();
          context.translate(pivotX, pivotY);
          context.rotate(pose[part.id] || 0);
          context.translate(-pivotX, -pivotY);
          context.drawImage(canvases.get(part.id), 0, 0);
          context.restore();
        }
        context.restore();
      },
    };
  }

  return { create, height, parts, poseAt, width };
});
