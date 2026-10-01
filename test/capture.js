const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const geometry = require('../public/geometry');
const elements = new Map();
const context = new Proxy({}, { get: () => () => {} });
function element() {
  return {
    width: 1000, height: 800, disabled: true, style: {}, listeners: {}, captured: new Set(),
    addEventListener(name, callback) { this.listeners[name] = callback; },
    getContext: () => context,
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 500, height: 400 }),
    setPointerCapture(id) { this.captured.add(id); },
    hasPointerCapture(id) { return this.captured.has(id); },
    releasePointerCapture(id) { this.captured.delete(id); },
  };
}
const scope = {
  document: { querySelector(selector) {
    if (!elements.has(selector)) elements.set(selector, element());
    return elements.get(selector);
  } },
  window: { innerWidth: 536, SketchGeometry: geometry,
    AnimalShapes: { lion: require('../public/animals/lion/shape.json') } },
  requestAnimationFrame() {},
};
vm.createContext(scope);
vm.runInContext(fs.readFileSync(require.resolve('../public/capture.js'), 'utf8'), scope);
const canvas = elements.get('#photoCanvas');
const run = (script) => vm.runInContext(script, scope);
function pointer(type, x, y, pointerId = 1) {
  canvas.listeners[type]({ clientX: 10 + x / 2, clientY: 20 + y / 2,
    pointerId, button: 0, isPrimary: true, preventDefault() {} });
}
run("image = { naturalWidth:1000, naturalHeight:800 }; chooseSpecies('lion');");
for (const [x, y] of [[100,100],[900,100],[900,700],[100,700]]) {
  pointer('pointerdown', x, y);
  pointer('pointerup', x, y);
}
assert.equal(run('selectedCorners.length'), 4);
assert.equal(elements.get('#processBtn').disabled, false);
run("finalTexture = 'previous cutout'; sendButton.disabled = false;");
// Grab 20 CSS pixels from the first marker: preserve its position until moving.
pointer('pointerdown', 140, 100);
assert.equal(run('selectedCorners[0].x'), 100);
assert.equal(run('activeCorner'), 0);
assert.equal(run('finalTexture'), null);
assert.equal(elements.get('#sendBtn').disabled, true);
pointer('pointermove', 200, 200, 2);
assert.equal(run('selectedCorners[0].x'), 100, 'another finger cannot steal the drag');
pointer('pointermove', 200, 200);
assert.equal(run('selectedCorners[0].x'), 160, 'grab offset prevents the marker jumping');
assert.equal(run('selectedCorners[0].y'), 200);
assert.equal(run('selectedCorners.length'), 4, 'dragging never adds a fifth corner');
pointer('pointermove', 990, 750);
assert.equal(elements.get('#processBtn').disabled, true, 'crossed corners cannot be processed');
pointer('pointermove', -100, -100);
assert.equal(run('selectedCorners[0].x'), 0);
assert.equal(run('selectedCorners[0].y'), 0);
assert.equal(elements.get('#processBtn').disabled, false, 'repairing the shape enables processing again');
pointer('pointercancel', 0, 0);
assert.equal(run('activePointer'), null);
assert.equal(canvas.captured.size, 0, 'cancel releases the pointer');
pointer('pointerdown', 0, 0);
elements.get('#resetPoints').listeners.click();
assert.equal(run('selectedCorners.length'), 0);
assert.equal(run('activePointer'), null);
assert.equal(elements.get('#processBtn').disabled, true);
assert.equal(elements.get('#sendBtn').disabled, true);
async function checkDetection() {
  scope.AbortController = AbortController;
  scope.document.createElement = () => ({ ...element(), toDataURL: () => 'data:image/jpeg;base64,AA==' });
  const reply = result => ({ok:true,json:async()=>result});
  const corners = [[.1,.1],[.9,.1],[.9,.9],[.1,.9]];
  scope.fetch = async () => reply({identified:true,species:'lion',confident:true,corners});
  // Avoid waiting for actual raster extraction in this event/state test.
  run('extractAnimal = async () => {};');
  await run('detectPhoto()');
  assert.equal(run('species'), 'lion');
  assert.equal(run('selectedCorners.length'), 4);
  assert.equal(elements.get('#animalChoice').hidden, true);
  assert.equal(elements.get('#processBtn').disabled, false);
  let release;
  scope.fetch = () => new Promise(resolve => { release = resolve; });
  const pending = run('detectPhoto()');
  assert.equal(elements.get('#processBtn').disabled, true, 'cannot process stale alignment during detection');
  elements.get('#resetPoints').listeners.click();
  release(reply({identified:true,species:'lion',confident:true,corners}));
  await pending;
  assert.equal(run('selectedCorners.length'), 0, 'late result cannot overwrite a manual reset');
  run('chooseSpecies(null);');
  scope.fetch = async () => reply({identified:false,confident:false});
  await run('detectPhoto()');
  assert.equal(elements.get('#animalChoice').hidden, false, 'unknown sheet asks for its animal');
  assert.equal(elements.get('#sendBtn').disabled, true);
  scope.fetch = async () => reply({identified:true,species:'lion',confident:false});
  await run('detectPhoto()');
  assert.equal(run('species'), 'lion', 'retain identification when corners are uncertain');
  assert.equal(elements.get('#animalChoice').hidden, true);
  scope.fetch = async () => { throw new Error('unavailable'); };
  await run('detectPhoto()');
  assert.match(elements.get('#status').textContent, /unavailable/);
  assert.equal(elements.get('#detectAgain').disabled, false);
  console.log('Corner dragging, detection, fallback, stale response protection and reset passed');
}
checkDetection().catch(error => { console.error(error); process.exitCode = 1; });
