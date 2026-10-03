const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup(saved = null, storageBlocked = false, autoplayBlocked = false) {
  const elements = new Map();
  for (const name of ['jungle-audio','sound-toggle','sound-volume','sound-level','sound-status']) {
    elements.set(`#${name}`, {value:'30',textContent:'',attributes:{},events:{},
      setAttribute(key,value){this.attributes[key]=value;},
      contains(target){return target===this;},
      addEventListener(name,callback){this.events[name]=callback;}});
  }
  const audio = elements.get('#jungle-audio');
  audio.paused = true;
  audio.playCalls = 0;
  audio.play = async () => {
    audio.playCalls++;
    if (autoplayBlocked && audio.playCalls===1) throw Object.assign(Error('blocked'),{name:'NotAllowedError'});
    audio.paused=false; audio.events.playing();
  };
  audio.pause = () => { audio.paused=true; audio.events.pause(); };
  const windowEvents = {};
  const documentEvents = {};
  const storage = new Map(saved === null ? [] : [['jungle-sound-volume',saved]]);
  const scope = {
    document:{querySelector:selector=>elements.get(selector),
      addEventListener:(name,callback)=>{documentEvents[name]=callback;}},
    window:{addEventListener:(name,callback)=>{windowEvents[name]=callback;}},
    localStorage:{getItem:key=>{if(storageBlocked)throw Error('disabled');return storage.get(key)??null;},
      setItem:(key,value)=>{if(storageBlocked)throw Error('disabled');storage.set(key,value);}},
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/soundscape.js'),'utf8'),scope);
  return {audio,button:elements.get('#sound-toggle'),volume:elements.get('#sound-volume'),
    level:elements.get('#sound-level'),status:elements.get('#sound-status'),storage,windowEvents,documentEvents};
}
async function run() {
  const state=setup();
  await new Promise(setImmediate);
  assert.equal(state.audio.playCalls,1,'sounds start automatically on load');
  assert.equal(state.audio.volume,.3,'ambient volume starts gently');
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
  assert.match(state.status.textContent,/enable/,'blocked playback has a retry message');
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
  const blocked=setup(null,false,true);await new Promise(setImmediate);
  assert.equal(blocked.audio.paused,true);
  assert.match(blocked.button.textContent,/Enable/);
  await blocked.documentEvents.click({target:{}});
  assert.equal(blocked.audio.paused,false,'first page interaction unlocks blocked autoplay');
  await blocked.button.events.click();
  await blocked.documentEvents.click({target:{}});
  assert.equal(blocked.audio.paused,true,'explicit mute is not undone by later interaction');
  const keyboard=setup(null,false,true);await new Promise(setImmediate);
  await keyboard.documentEvents.keydown({target:{}});
  assert.equal(keyboard.audio.paused,false,'TV remote key unlocks blocked autoplay');
  const toggle=setup(null,false,true);await new Promise(setImmediate);
  await toggle.documentEvents.click({target:toggle.button});
  await toggle.button.events.click();
  assert.equal(toggle.audio.playCalls,2,'toggle starts blocked audio only once');
  assert.equal(toggle.audio.paused,false);
  const hide=setup();hide.windowEvents.pagehide();
  assert.equal(hide.audio.paused,true,'leaving the display stops audio');
  const blockedHide=setup(null,false,true);await new Promise(setImmediate);blockedHide.windowEvents.pagehide();
  await blockedHide.documentEvents.click({target:{}});
  assert.equal(blockedHide.audio.playCalls,1,'page exit cancels autoplay fallback');
  console.log('Sound autoplay, gesture fallback, volume, persistence, mute, cancel, unavailable audio and page exit passed');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
