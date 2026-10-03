const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup(saved = null, storageBlocked = false) {
  const elements = new Map();
  for (const name of ['jungle-audio','sound-toggle','sound-volume','sound-level','sound-status']) {
    elements.set(`#${name}`, {value:'30',textContent:'',attributes:{},events:{},
      setAttribute(key,value){this.attributes[key]=value;},
      addEventListener(name,callback){this.events[name]=callback;}});
  }
  const audio = elements.get('#jungle-audio');
  audio.paused = true;
  audio.playCalls = 0;
  audio.play = async () => { audio.playCalls++; audio.paused=false; audio.events.playing(); };
  audio.pause = () => { audio.paused=true; audio.events.pause(); };
  const windowEvents = {};
  const storage = new Map(saved === null ? [] : [['jungle-sound-volume',saved]]);
  const scope = {
    document:{querySelector:selector=>elements.get(selector)},
    window:{addEventListener:(name,callback)=>{windowEvents[name]=callback;}},
    localStorage:{getItem:key=>{if(storageBlocked)throw Error('disabled');return storage.get(key)??null;},
      setItem:(key,value)=>{if(storageBlocked)throw Error('disabled');storage.set(key,value);}},
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/soundscape.js'),'utf8'),scope);
  return {audio,button:elements.get('#sound-toggle'),volume:elements.get('#sound-volume'),
    level:elements.get('#sound-level'),status:elements.get('#sound-status'),storage,windowEvents};
}
async function run() {
  const state=setup();
  assert.equal(state.audio.playCalls,0,'no audible autoplay on load');
  assert.equal(state.audio.volume,.3,'ambient volume starts gently');
  await state.button.events.click();
  assert.equal(state.button.attributes['aria-pressed'],'true');
  state.volume.value='65';state.volume.events.input();
  assert.equal(state.audio.volume,.65);
  assert.equal(state.level.textContent,'65%');
  assert.equal(state.storage.get('jungle-sound-volume'),'65');
  state.volume.value='0';state.volume.events.input();
  assert.equal(state.audio.volume,0);
  assert.match(state.button.textContent,/muted/);
  await state.button.events.click();
  assert.equal(state.audio.paused,true);
  assert.equal(state.button.attributes['aria-pressed'],'false');
  state.audio.play=async()=>{throw Object.assign(Error('blocked'),{name:'NotAllowedError'});};
  await state.button.events.click();
  assert.equal(state.button.attributes['aria-pressed'],'false');
  assert.match(state.status.textContent,/again/,'blocked playback has a retry message');
  let resolve;
  state.audio.play=()=>new Promise(done=>{resolve=done;});
  const pending=state.button.events.click();
  assert.equal(state.button.attributes['aria-busy'],'true');
  await state.button.events.click(); // Stop while the recording is still loading.
  state.audio.paused=false;resolve();await pending;
  assert.equal(state.audio.paused,true,'late play completion cannot restart canceled sound');
  assert.equal(state.button.attributes['aria-pressed'],'false');
  state.audio.events.error();
  assert.match(state.status.textContent,/could not load/);
  assert.equal(setup('0').audio.volume,0,'saved mute level remains zero');
  assert.equal(setup('85').audio.volume,.85);
  assert.equal(setup('broken').audio.volume,.3,'invalid stored volume uses the default');
  assert.equal(setup(null,true).audio.volume,.3,'TV browsers without storage still work');
  const hide=setup();await hide.button.events.click();hide.windowEvents.pagehide();
  assert.equal(hide.audio.paused,true,'leaving the display stops audio');
  console.log('Sound gesture, volume, persistence, mute, cancel, unavailable audio and page exit passed');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
