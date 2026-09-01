(function exposeElephantShape(root, factory) {
  const shape = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = shape;
  } else {
    root.AnimalShapes = root.AnimalShapes || {};
    root.AnimalShapes.elephant = shape;
  }
})(typeof globalThis === 'object' ? globalThis : this, function createElephantShape() {
  const maskParts = [
    `M300 455 C405 410 560 430 650 500
      C690 555 690 650 650 705 L620 720
      L615 855 L560 855 L545 720
      L410 720 L395 855 L340 855 L330 700
      C285 650 275 525 300 455 Z`,
    `M300 470 C260 430 205 430 165 465
      C125 505 125 575 160 620
      C195 660 255 660 305 615
      C335 570 330 515 300 470 Z`,
    `M155 545 C125 580 120 650 145 710
      C155 735 145 765 115 780
      C155 800 190 775 188 735
      C180 665 190 605 205 565 Z`,
    `M185 480 C215 455 270 470 282 520
      C285 570 250 610 205 605
      C175 585 165 520 185 480 Z`,
    `M645 510 C690 495 725 510 750 540 L738 565
      C710 540 685 540 652 560 Z`,
  ];

  return {
    bounds: { x: 103, y: 408, width: 659, height: 455 },
    emoji: '🐘',
    maskParts,
    maskPath: maskParts.join(' '),
  };
});
