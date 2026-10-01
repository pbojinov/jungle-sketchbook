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
  for(const joint of rig.joints[species]) {
    const angles=[];
    for(let phase=0;phase<1;phase+=.01) {
      const pose=rig.bonePose(joint,phase,rig.profiles[species],1,rig.profiles[species].crouch);
      const step=motion.footstep(phase,rig.profiles[species].stride,rig.profiles[species].lift,rig.profiles[species].stance);
      assert.ok(Math.abs(pose.ankle.y-(joint[5]-step.lift))<.02,'stance feet remain at their ground height');
      assert.ok(Math.abs(Math.hypot(pose.knee.x-pose.hip.x,pose.knee.y-pose.hip.y)-Math.hypot(joint[2]-joint[0],joint[3]-joint[1]))<.001,'upper leg retains its length');
      assert.ok(Math.abs(Math.hypot(pose.ankle.x-pose.knee.x,pose.ankle.y-pose.knee.y)-Math.hypot(joint[4]-joint[2],joint[5]-joint[3]))<.001,'lower leg retains its length');
      const [c,sn,tx,ty]=pose.upper;
      assert.ok(Math.hypot(c*joint[2]-sn*joint[3]+tx-pose.knee.x,sn*joint[2]+c*joint[3]+ty-pose.knee.y)<.001,'upper bone actually joins the knee');
      const body=rig.profiles[species].crouch+Math.cos(phase*Math.PI*4)*rig.profiles[species].bob;
      const weighted=rig.bonePose(joint,phase,rig.profiles[species],1,body);
      const kneeAngle=Math.abs(Math.atan2(weighted.ankle.y-weighted.knee.y,weighted.ankle.x-weighted.knee.x)-Math.atan2(weighted.knee.y-weighted.hip.y,weighted.knee.x-weighted.hip.x));
      assert.ok(kneeAngle>.15,'weight shifts never lock a knee completely straight');
      angles.push(Math.atan2(pose.ankle.y-pose.knee.y,pose.ankle.x-pose.knee.x)-Math.atan2(pose.knee.y-pose.hip.y,pose.knee.x-pose.hip.x));
    }
    assert.ok(Math.max(...angles)-Math.min(...angles)>.45,`${species} bends each knee by at least 25 degrees through its stride`);
  }
  const mesh = rig.create(motion.rigs[species]);
  const still = rig.deform(mesh,0,0);
  assert.deepEqual(still, mesh.vertices.map(({x,y}) => ({x,y})), 'waiting animal retains original geometry');
  const signatures=new Set();
  let feetSeen=false,headSeen=false,tailSeen=false,kneesSeen=false;
  for (let phase=0;phase<1;phase+=.05) {
    for (const time of [0,2,5,9,15]) for(const blink of [0,.5,1]) {
      const moved=rig.deform(mesh,phase,1,time,1.7,blink);
      moved.forEach((p,i)=>{
        const source=mesh.vertices[i];
        assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
        assert.ok(Math.abs(p.x-source.x)<90 && Math.abs(p.y-source.y)<90,'fixed-length limb arcs stay within the authored pose range');
        const distance=Math.hypot(p.x-source.x,p.y-source.y);
        if(source.weights.some(w=>w>.7)&&distance>2)feetSeen=true;
        if(source.legs.some(l=>l.knee>.8)&&distance>2)kneesSeen=true;
        if(source.head>.9 && distance>2)headSeen=true;
        if(source.tail>.9 && distance>2)tailSeen=true;
      });
      for (const [a,b,c] of mesh.triangles) {
        const p=moved[a],q=moved[b],r=moved[c];
        assert.ok((q.x-p.x)*(r.y-p.y)-(r.x-p.x)*(q.y-p.y)>0,`${species} triangles never fold, including closed eyes`);
      }
    }
    signatures.add(JSON.stringify(rig.deform(mesh,phase,1,3)));
  }
  assert.ok(feetSeen && kneesSeen && headSeen && tailSeen,`${species} animates legs, knees, head and tail`);
  assert.ok(signatures.size>10,'walk cycle has distinct poses');
  const closed=rig.deform(mesh,0,0,0,0,1);
  for(const [x,y,rx,ry] of mesh.profile.eyes) {
    const indices=[-1,1].map(sign=>mesh.vertices.findIndex(v=>Math.abs(v.x-(x-shape.bounds.x))<.001&&Math.abs(v.y-(y-shape.bounds.y+sign*ry*.85))<.001));
    assert.ok(indices.every(i=>i>=0),'mesh includes both eye edges');
    const openHeight=mesh.vertices[indices[1]].y-mesh.vertices[indices[0]].y;
    assert.ok(closed[indices[1]].y-closed[indices[0]].y<openHeight*.15,`${species} eye ink closes into a thin lid`);
  }
  let blinks=0;
  for(let time=0;time<25;time+=.02) if(rig.blinkAt(time,2.3,species)>.9)blinks++;
  assert.ok(blinks>0 && blinks<100,'brief automatic blinks occur without holding eyes shut');

}
console.log('All six vector assets, bending legs, head/tail motion and blinks passed');
