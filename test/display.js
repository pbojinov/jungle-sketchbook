const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const SafariMotion=require('../public/motion');
const paint = new Proxy({}, { get: (target, key) => {
 if(key==='createLinearGradient')return ()=>({addColorStop(){}});
 if(key==='getImageData')return ()=>({data:new Uint8ClampedArray(16)});
 return target[key] ?? (()=>{});
}, set:(target,key,value)=>{target[key]=value;return true;} });
function element(){return {events:{},attributes:{},style:{},append(){},remove(){},setAttribute(key,value){this.attributes[key]=value;},querySelector:()=>({}),addEventListener(name,callback){this.events[name]=callback;},getBoundingClientRect:()=>({height:100}),getContext:()=>paint};}
const elements=new Map();
const scope={
 document:{querySelector:selector=>{if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);},createElement:element},
 window:{devicePixelRatio:1,innerWidth:900,innerHeight:900,addEventListener(){}},
 location:{hostname:'127.0.0.1'},performance:{now:()=>0},ResizeObserver:class{observe(){}},
 Image:class {constructor(){this.width=this.height=2;this.events={};}addEventListener(name,callback){this.events[name]=callback;}set src(value){this.events.load();}},
 requestAnimationFrame(){},fetch:()=>new Promise(()=>{}),EventSource:class{addEventListener(){}},
 SafariMotion,AnimalRig:{create:()=>({profile:{stance:.74,stride:98}}),draw(){}},
 JungleScene:{background(){},foreground(){},groundY:(width,height,layer)=>height*.98-layer*height*.13},
 localStorage:{getItem:()=>null,setItem(){}},
};
vm.createContext(scope);
vm.runInContext(fs.readFileSync(require.resolve('../public/display.js'),'utf8'),scope);
vm.runInContext(`
for(let index=0;index<8;index++)addAnimal({id:String(index),species:'elephant',texture:'test',artworkVersion:'2026-09-artwork'},index<4);
`,scope);
const arrivals=vm.runInContext('animals.map(a=>({layer:a.layer,direction:a.direction,hasEntered:a.hasEntered,spacing:a.spacing}))',scope);
assert.equal(arrivals.length,8);
assert.ok(arrivals.every(a=>a.layer===0&&!a.hasEntered),'saved and new animals both begin in the first row');
assert.equal(arrivals.filter(a=>a.direction===1).length,4);
assert.equal(arrivals.filter(a=>a.direction===-1).length,4);
console.log('Saved and new scans start on the front row from both sides');
assert.equal(elements.get('#loop-toggle').attributes['aria-pressed'],'false','default is disappear mode');
assert.match(elements.get('#loop-status').textContent,/disappear/);
assert.ok(vm.runInContext('animals.every(a=>a.size>=.7&&a.size<=1.3&&a.startDirection===a.direction&&a.textures.length===4)',scope));
// Exercise the actual render/lifecycle loop without waiting several minutes.
vm.runInContext(`
clearScene();
addAnimal({id:'lifecycle',species:'giraffe',texture:'test',artworkVersion:'2026-09-artwork'},true);
var visited = new Set();
for(let frame=1;frame<=20000&&animals.length;frame++) {
  visited.add(animals[0].layer);drawFrame(frame*50);
}
`,scope);
assert.equal(vm.runInContext('visited.size',scope),4,'disappear mode traverses all four rows');
assert.equal(vm.runInContext('animals.length',scope),0,'animal is removed after its final offscreen exit');
elements.get('#loop-toggle').events.click();
assert.equal(elements.get('#loop-toggle').attributes['aria-pressed'],'true');
vm.runInContext(`
lastFrameTime=0;
addAnimal({id:'loop',species:'tiger',texture:'test',artworkVersion:'2026-09-artwork'},true);
var firstDirection=animals[0].direction,firstSize=animals[0].size;
var loops=0,previousLayer=0;
for(let frame=1;frame<=20000;frame++) {
  drawFrame(frame*50);
  if(animals[0].layer===0&&previousLayer===3)loops++;
  previousLayer=animals[0].layer;
}
`,scope);
assert.ok(vm.runInContext('loops>=2',scope),'infinite mode completes repeated full laps');
assert.equal(vm.runInContext('animals.length',scope),1,'loop keeps the drawing');
assert.ok(vm.runInContext('animals[0].size===firstSize&&animals[0].startDirection===firstDirection',scope));
elements.get('#loop-toggle').events.click();
vm.runInContext(`for(let frame=20001;frame<40000&&animals.length;frame++)drawFrame(frame*50);`,scope);
assert.equal(vm.runInContext('animals.length',scope),0,'switching off infinite mode allows the final exit');
console.log('Default disappearance, four rendered rows, repeated loops and live mode switching passed');
