(function exposeLionShape(root, factory) {
  const shape = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = shape;
  } else {
    root.LionShape = shape;
  }
})(typeof globalThis === 'object' ? globalThis : this, function createLionShape() {
  const maskParts = [
    `M340 520
      C430 495 570 510 650 555
      C680 590 685 660 660 710
      C650 730 635 742 615 750
      L615 850 L565 850 L550 750
      L450 750 L435 850 L385 850 L370 720
      C345 685 335 620 340 520 Z`,
    `M640 565
      C700 565 715 610 755 615
      L760 635
      C710 635 690 595 640 592 Z`,
    `M755 610
      C775 595 800 607 805 628
      C800 650 775 660 755 642
      C745 632 745 620 755 610 Z`,
    `M330 420
      C380 445 410 495 410 555
      C410 620 382 675 335 705
      C285 735 225 730 180 700
      C135 670 112 615 120 555
      C127 495 155 445 205 420
      C245 395 290 395 330 420 Z`,
  ];

  return {
    bounds: { x: 104, y: 387, width: 709, height: 471 },
    maskParts,
    maskPath: maskParts.join(' '),
  };
});
