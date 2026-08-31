(function exposeGazelleShape(root, factory) {
  const shape = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = shape;
  } else {
    root.AnimalShapes = root.AnimalShapes || {};
    root.AnimalShapes.gazelle = shape;
  }
})(typeof globalThis === 'object' ? globalThis : this, function createGazelleShape() {
  const maskParts = [
    `M300 535
      C380 510 515 515 600 550
      C625 580 625 630 600 660
      C575 680 550 688 525 690
      L520 850 L485 850 L470 685
      L365 685 L350 850 L315 850 L310 675
      C285 640 278 570 300 535 Z`,
    `M300 555
      C275 515 265 465 275 415
      C280 380 265 350 235 335
      C205 320 175 335 160 365
      C175 392 205 402 238 392
      C255 450 258 515 265 580
      C275 610 305 595 300 555 Z`,
    `M195 342 L175 300 L215 330 Z`,
    `M225 337 L250 300 L245 350 Z`,
    `M210 330 C195 275 195 235 210 205 L220 210 C215 250 220 285 230 325 Z`,
    `M230 328 C230 270 242 230 265 205 L274 214 C250 252 248 290 250 335 Z`,
    `M590 560 C635 545 665 555 690 580 L680 600 C650 580 625 580 595 595 Z`,
  ];

  return {
    bounds: { x: 148, y: 193, width: 554, height: 665 },
    emoji: '🦌',
    maskParts,
    maskPath: maskParts.join(' '),
  };
});
