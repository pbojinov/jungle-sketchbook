(function exposeRhinoShape(root, factory) {
  const shape = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = shape;
  } else {
    root.AnimalShapes = root.AnimalShapes || {};
    root.AnimalShapes.rhino = shape;
  }
})(typeof globalThis === 'object' ? globalThis : this, function createRhinoShape() {
  const maskParts = [
    `M280 500 C375 455 535 470 640 525
      C680 570 680 650 640 700 L615 710
      L610 840 L560 840 L545 715
      L390 715 L375 840 L325 840 L315 695
      C275 655 260 555 280 500 Z`,
    `M285 510 C250 480 205 475 165 500
      C135 525 125 575 145 620
      C175 660 235 665 290 625
      C320 590 315 545 285 510 Z`,
    `M160 535 L95 555 L155 575 Z`,
    `M225 490 L205 430 L255 480 Z`,
    `M635 535 C680 520 715 535 740 565 L728 590
      C700 565 675 565 642 585 Z`,
  ];

  return {
    bounds: { x: 83, y: 418, width: 669, height: 430 },
    emoji: '🦏',
    maskParts,
    maskPath: maskParts.join(' '),
  };
});
