const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const motion = require('../public/motion');
const anatomy = require('../public/skeleton-anatomy');
const meshData = require('../public/animals/skeleton-meshes.json');

async function run() {
  // Load the vendored ESM library in Node without changing this CommonJS app.
  const threeSource = fs.readFileSync(require.resolve('../public/vendor/three/three.core.js'), 'utf8');
  const three = await import(`data:text/javascript;base64,${Buffer.from(threeSource).toString('base64')}`);
  const source = fs.readFileSync(require.resolve('../public/rig-continuous-skeleton.js'), 'utf8')
    .replace(/^import \{([^}]+)\} from [^;]+;/, 'const {$1} = three;')
    .replace(/const meshes=await .*?\.json\(\);/, 'const meshes = meshData;');
  const rig = { ...require('../public/rig-v2') };
  let targets;
  // Capture the exact vertices sent to either rasterizer; do not mock skinning.
  rig.drawMesh = (context, texture, mesh, vertices) => { targets = vertices; };
  rig.supportsWebGL = () => true;
  const document = { documentElement: { dataset: {} } };
  vm.runInNewContext(source, { three, meshData, AnimalRig: rig, document });
  assert.equal(document.documentElement.dataset.skeletonRuntime, 'three.js continuous skin');

  for (const [species, shape] of Object.entries(motion.rigs)) {
    const data = meshData[species];
    assert.deepEqual(data.chains, anatomy.chains(species), `${species}: generated anatomy matches the runtime calibration`);
    assert.equal(data.vertices.length, data.skin.length);
    const boneCount = 1 + data.chains.reduce((sum, chain) => sum + chain.indices.length, 0);
    for (const skin of data.skin) {
      assert.equal(skin.indices.length, 4);
      assert.equal(skin.weights.length, 4);
      assert.ok(skin.indices.every(i => Number.isInteger(i) && i >= 0 && i < boneCount));
      assert.ok(skin.weights.every(w => Number.isFinite(w) && w >= 0));
      assert.ok(Math.abs(skin.weights.reduce((a, b) => a + b, 0) - 1) < 1e-6);
    }
    for (const triangle of data.triangles) {
      assert.ok(triangle.every(i => Number.isInteger(i) && i >= 0 && i < data.vertices.length));
    }
    const mesh = rig.create(shape);
    for (const baseline of [shape.height, Math.max(...data.soles) - shape.y]) {
      for (let frame = 0; frame <= 120; frame++) {
        rig.draw(null, null, shape, mesh, frame / 120, 1, frame / 20, .91, undefined, baseline);
        assert.equal(targets.length, data.vertices.length);
        assert.ok(targets.every(v => Number.isFinite(v.x) && Number.isFinite(v.y)), `${species}: finite skinned vertices through the full stride`);
        assert.ok(mesh.skeletonQuality.jointError < .001, `${species}: all hip, knee, hock and ankle connections meet their targets`);
      }
    }
    rig.draw(null, null, shape, mesh, .4, 1, 4, .91, 1, shape.height);
    assert.equal(mesh.textureBlink, 1, 'GPU blinking changes texture sampling instead of crushing mesh triangles');
  }
  console.log('All six Three.js skeletons, weighted meshes, full-stride joint connections and blink control passed');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
