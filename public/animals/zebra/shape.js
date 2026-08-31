(function exposeZebraShape(root, factory) {
  const shape = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = shape;
  } else {
    root.AnimalShapes = root.AnimalShapes || {};
    root.AnimalShapes.zebra = shape;
  }
})(typeof globalThis === 'object' ? globalThis : this, function createZebraShape() {
  const maskParts = [
    `M265 510
      C360 480 500 490 590 535
      C625 575 625 645 590 685
      C565 705 535 715 505 715
      L500 845 L455 845 L440 710
      L335 710 L320 845 L275 845 L270 690
      C245 650 240 555 265 510 Z`,
    `M565 545
      C565 485 580 425 610 380
      L590 330 L625 345
      C655 325 690 342 705 375
      C720 410 700 440 670 455
      C660 500 650 550 635 595
      C615 610 580 585 565 545 Z`,
    `M585 345 L575 285 L615 330 Z`,
    `M625 338 L655 285 L660 350 Z`,
    `M275 535 C235 525 205 545 180 575 L190 595 C220 570 245 565 275 575 Z`,
  ];

  return {
    bounds: { x: 168, y: 273, width: 555, height: 580 },
    emoji: '🦓',
    maskParts,
    maskPath: maskParts.join(' '),
  };
});
