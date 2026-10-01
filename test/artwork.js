const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const motion = require('../public/motion');
const rig = require('../public/rig');
const catalog = require('../public/animals/catalog.json');
assert.deepEqual(Object.keys(motion.rigs).sort(), Object.keys(catalog).sort());
for (const species of Object.keys(catalog)) {
  const folder = path.join(__dirname, '../public/animals', species);
  const shape = require(path.join(folder, 'shape'));
  assert.equal(shape.page.height,1087);
  assert.equal(shape.page.width,840);
  assert.ok(shape.maskPath.length > 100);
  for (const filename of ['ink.svg','mask.svg','sample.svg','template.svg']) {
    const svg = fs.readFileSync(path.join(folder,filename),'utf8');
    assert.ok(svg.includes('<path'), `${species} ${filename} has vector artwork`);
    assert.ok(!svg.includes('<image'), 'traced artwork has no raster dependency');
  }
  const mesh = rig.create(motion.rigs[species]);
  const still = rig.deform(mesh,0,0);
  assert.deepEqual(still, mesh.vertices.map(({x,y}) => ({x,y})), 'waiting animal retains original geometry');
  let motionSeen = false;
  for (let phase=0;phase<1;phase+=.1) {
    const moved = rig.deform(mesh,phase);
    moved.forEach((p,i) => {
      const source=mesh.vertices[i];
      assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
      assert.ok(Math.abs(p.x-source.x)<=rig.STRIDE/2+.001);
      assert.ok(p.y<=source.y && source.y-p.y<=15.001);
      if(source.weights.every(w=>w===0)) assert.deepEqual(p,{x:source.x,y:source.y},'upper body and face stay intact');
      if(Math.abs(p.x-source.x)>1) motionSeen=true;
    });
    for (const [a,b,c] of mesh.triangles) {
      const p=moved[a],q=moved[b],r=moved[c];
      assert.ok((q.x-p.x)*(r.y-p.y)-(r.x-p.x)*(q.y-p.y)>0,'deformed triangles never fold');
    }
  }
  assert.ok(motionSeen,`${species} feet move`);
}
console.log('All six vector assets and continuous foot rigs passed');
