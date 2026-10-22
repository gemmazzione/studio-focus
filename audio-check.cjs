const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, { value: '', checked: false, hidden: false, textContent: '', listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; }, animate() {} });
  return elements.get(id);
}
const events = {}, storage = {};
let tones = 0, contexts = 0;
class AudioContext {
  constructor() { contexts++; this.state = 'suspended'; this.currentTime = 0; this.destination = {}; }
  async resume() { this.state = 'running'; }
  createOscillator() { return { frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {}, start() { tones++; }, stop() {} }; }
  createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
}
const window = { AudioContext, matchMedia: () => ({ matches: true }), addEventListener: (event, fn) => events[event] = fn };
const document = { getElementById: element, addEventListener() {}, body: { classList: { toggle() {} } }, querySelector: () => element('panel') };
vm.runInNewContext(fs.readFileSync('dist/experience.js', 'utf8'), { window, document, localStorage: { getItem: k => storage[k] || null, setItem: (k, v) => storage[k] = v }, MutationObserver: class { observe() {} }, console });
const flush = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  await element('sound-test').listeners.click(); await flush();
  assert.equal(tones, 4, 'Bell preview schedules two fundamentals and two partials');
  assert.equal(contexts, 1, 'Single audio context reused');
  element('sound-kind').value = 'pulse'; element('sound-volume').value = '35'; element('sound-kind').listeners.input();
  events['studio:alarm'](); await flush(); assert.equal(tones, 7, 'Natural expiry schedules three notes');
  assert.equal(JSON.parse(storage['studio.sound.v1']).volume, 35, 'Volume persisted');
  element('sound-enabled').checked = false; element('sound-enabled').listeners.input();
  events['studio:alarm'](); await flush(); assert.equal(tones, 7, 'Muted alarm schedules no tones');
  await element('sound-test').listeners.click(); await flush(); assert.equal(tones, 10, 'Explicit preview works with alarms muted');
  element('sound-kind').value = 'wood'; element('sound-kind').listeners.input();
  await element('sound-test').listeners.click(); await flush(); assert.equal(tones, 13, 'Wood preview schedules three taps');
  assert(fs.readFileSync('dist/app.js', 'utf8').includes('new CustomEvent("studio:alarm"'), 'Timer expiry dispatches the alarm event');
  console.log('PASS: bell/pulse/wood, audio reuse, mute, preview, saved volume, expiry integration.');
})().catch(error => { console.error(error); process.exitCode = 1; });
