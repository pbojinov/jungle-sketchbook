const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const SafariMotion=require('../public/motion');
function element(){return {style:{},append(){},remove(){},setAttribute(){},querySelector:()=>({}),addEventListener(){},getBoundingClientRect:()=>({height:100}),getContext:()=>({drawImage(){},fillRect(){},getImageData:()=>({data:new Uint8ClampedArray(16)})})};}
const elements=new Map();
const scope={
 document:{querySelector:selector=>{if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);},createElement:element},
 window:{devicePixelRatio:1,innerWidth:900,innerHeight:900,addEventListener(){}},
 location:{hostname:'127.0.0.1'},performance:{now:()=>0},ResizeObserver:class{observe(){}},
 Image:class {constructor(){this.width=this.height=2;this.events={};}addEventListener(name,callback){this.events[name]=callback;}set src(value){this.events.load();}},
 requestAnimationFrame(){},fetch:()=>new Promise(()=>{}),EventSource:class{addEventListener(){}},
 SafariMotion,AnimalRig:{create:()=>({})},
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
