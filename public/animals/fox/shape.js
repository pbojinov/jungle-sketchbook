(function exposeFoxShape(root, factory) {
  const shape = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = shape;
  } else {
    root.AnimalShapes = root.AnimalShapes || {};
    root.AnimalShapes.fox = shape;
  }
})(typeof globalThis === 'object' ? globalThis : this, function createFoxShape() {
  const maskParts = [
    `M285 520
      C360 495 500 500 600 535
      C630 565 635 625 610 665
      C590 690 565 700 540 705
      L535 825 L495 825 L475 700
      L365 700 L345 825 L305 825 L300 675
      C270 640 265 565 285 520 Z`,
    `M285 520
      C250 500 215 485 180 480
      L120 525 L180 555
      C188 610 225 645 285 635
      C325 610 330 555 285 520 Z`,
    `M188 490 L175 375 L245 460 Z`,
    `M235 485 L285 385 L300 520 Z`,
    `M585 535
      C650 470 735 455 790 500
      C755 520 735 555 755 590
      C720 650 650 685 590 650
      C615 610 610 570 585 535 Z`,
  ];

  return {
    bounds: { x: 108, y: 363, width: 695, height: 470 },
    emoji: '🦊',
    maskParts,
    maskPath: maskParts.join(' '),
  };
});
