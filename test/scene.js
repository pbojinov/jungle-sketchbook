const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const media={matches:false};
let nextCanvas=0;
const gradient=()=>({addColorStop(){}});
function context(log){
  return new Proxy({}, {get(target,key){
    if(key==='createLinearGradient'||key==='createRadialGradient')return gradient;
    if(key in target)return target[key];
    return (...args)=>{if(log)log.push([key,...args.map(a=>a&&a.id?a.id:a)]);};
  }});
}
const scene=vm.runInNewContext(fs.readFileSync(require.resolve('../public/scene.js'),'utf8')+';JungleScene',{
 window:{matchMedia:()=>media},
 document:{createElement:()=>({id:++nextCanvas,getContext:()=>context()})},
 Path2D:class {moveTo(){}bezierCurveTo(){}lineTo(){}},
});
const vine={x:100,length:300,phase:1.5,flex:22};
for(let time=0;time<60;time+=.1){
 const anchor=scene.vinePoint(vine,0,time);
 assert.equal(anchor.x,100);assert.equal(anchor.y,-5,'vine stays attached to the canopy');
 const tip=scene.vinePoint(vine,1,time);
 assert.ok(Math.abs(tip.x-95)<=22.001,'vine movement remains subtle');
 const next=scene.vinePoint(vine,1,time+1/60);
 assert.ok(Math.abs(next.x-tip.x)<.19,'vine moves smoothly between frames');
 assert.ok(Math.abs(scene.breeze(time,2))<=1,'breeze stays bounded');
}
const log=[],ctx=context(log);
function paint(time){log.length=0;scene.background(ctx,900,700,time);scene.foreground(ctx,900,700,time);return log.slice();}
paint(0); // Build the static scenery and sprite cache once.
const first=paint(1000),second=paint(9000);
const rotations=commands=>commands.filter(c=>c[0]==='rotate');
assert.equal(rotations(first).length,rotations(second).length);
assert.notDeepEqual(rotations(first),rotations(second),'individual leaves and plants move over time');
media.matches=true;
assert.deepEqual(paint(1000),paint(9000),'reduced-motion preference freezes every background animation');
console.log('Anchored vines, subtle breeze, animated leaves and reduced motion passed');

// Every depth lane is inside the painted floor, including tall and short screens.
for(const [width,height,controls] of [[884,994,112],[1472,1682,170],[1500,650,100],[450,800,200]]) {
 const rear=scene.groundY(width,height,1,width*.5,controls);
 const horizon=rear-height*.065;
 for(const layer of [0,1]) for(let x=0;x<=width;x+=width/48) {
  const feet=scene.groundY(width,height,layer,x,controls);
  assert.ok(feet>horizon+height*.03,'all walking paths lie below the forest floor boundary');
  assert.ok(feet<height-controls-24,'feet stay clear of the controls');
 }
}
console.log('Both walking paths stay on the ground at portrait and landscape sizes');
for (const [width,height,controls] of [[960,540,44],[1280,720,44],[1920,1080,44]]) {
  const feet=scene.groundY(width,height,0,width*.5,controls);
  assert.ok(feet>=height*.80,'TV entrances sit in the lower fifth of the screen');
  const old=Math.min(height*.80,height-controls-158);
  assert.ok(feet>old+height*.05,'TV path is visibly lower than the previous layout');
}
console.log('TV-sized entrance paths sit low while leaving room for controls');
