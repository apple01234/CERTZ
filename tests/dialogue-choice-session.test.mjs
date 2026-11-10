import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import ts from 'typescript';

// Execute the actual component and handlers; only React hooks, JSX and browser clocks are replaced.
function harness() {
  let now = 1000, cursor = 0, dirty = true, current = null, tree, timersId = 0;
  const hooks = [], effects = [], timers = new Map(), listeners = new Map();
  const bus = new EventEmitter();
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) {
      const at = cursor++;
      if (!hooks[at]) hooks[at] = { value: initial };
      return [hooks[at].value, value => {
        const next = typeof value === 'function' ? value(hooks[at].value) : value;
        if (!Object.is(next, hooks[at].value)) { hooks[at].value = next; dirty = true; }
      }];
    },
    useRef(initial) { const at = cursor++; return hooks[at] ??= { current: initial }; },
    useEffect(run, deps) {
      const at = cursor++, old = hooks[at];
      if (!old || !same(old.deps, deps)) effects.push(() => {
        old?.cleanup?.(); hooks[at] = { deps, cleanup: run() };
      });
    },
  };
  const window = {
    setInterval(run, ms) { const id = ++timersId; timers.set(id, { run, ms, due: now + ms }); return id; },
    clearInterval(id) { timers.delete(id); },
    addEventListener(key, callback) { if (!listeners.has(key)) listeners.set(key, new Set()); listeners.get(key).add(callback); },
    removeEventListener(key, callback) { listeners.get(key)?.delete(callback); },
  };
  const jsx = (type, props) => ({ type, props });
  const module = { exports: {} };
  const source = fs.readFileSync(new URL('../src/components/game/DialogueBox.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
    window, document: { activeElement: null }, performance: { now: () => now },
    HTMLInputElement: class {}, HTMLTextAreaElement: class {}, console,
  })(name => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === './EventBus') return { EventBus: bus };
    if (name === '@/game/config') return { getPlayerName: () => '하루' };
    if (name === '@/game/data') return { BOSS_DEFS: {} };
    if (name === '@/game/textures') return { BOSS_ATLAS: {} };
    if (name === '@/game/audio') return { sfx: { uiClick() {} } };
    if (name === '@/game/cutsceneCast') return { cutsceneCharacter: () => null, castPortrait: () => '' };
    return {};
  }, module, module.exports);
  function flush() {
    for (let n = 0; dirty || effects.length; n++) {
      assert.ok(n < 50, 'component must settle');
      if (dirty) { dirty = false; cursor = 0; tree = module.exports.DialogueBox({ dialogue: current }); }
      while (effects.length) effects.shift()();
    }
  }
  bus.on('dialogue:show', dialogue => { current = dialogue; dirty = true; });
  bus.on('dialogue:done', () => { current = null; dirty = true; });
  function advance(ms) {
    const end = now + ms;
    for (let n = 0; n < 10000; n++) {
      const due = [...timers.entries()].filter(([, t]) => t.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
      if (!due) { now = end; return; }
      now = due[1].due; due[1].due += due[1].ms; due[1].run(); flush();
    }
    throw new Error('unbounded browser timer');
  }
  function nodes(node = tree) {
    if (!node) return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    return typeof node === 'object' ? [node, ...nodes(node.props?.children)] : [];
  }
  function key(type, code, repeat = false) {
    const event = { code, repeat, preventDefault() {} };
    for (const listener of [...(listeners.get(type) ?? [])]) listener(event);
    flush();
  }
  flush();
  return {
    bus, show(dialogue) { bus.emit('dialogue:show', dialogue); flush(); }, advance, key,
    choose(index = 0, times = 1) {
      const button = nodes().filter(n => n.type === 'button')[index]; assert.ok(button, 'visible choice button required');
      for (let i = 0; i < times; i++) button.props.onPointerDown({ stopPropagation() {} });
      flush();
    },
    blur() { for (const listener of [...(listeners.get('blur') ?? [])]) listener(); flush(); },
    get current() { return current; },
    get text() {
      const values = [];
      const walk = node => { if (typeof node === 'string') values.push(node); else if (Array.isArray(node)) node.forEach(walk); else if (node && typeof node === 'object') walk(node.props?.children); };
      walk(tree); return values.join(' ');
    },
  };
}
const choice = () => ({ speaker: '선택', lines: [], choices: [{ id: 'flee', label: '두려움에 도망치는 사람' }, { id: 'save', label: '누군가를 살리는 사람' }] });

test('one pointer selection cannot close the dialogue synchronously opened by its callback', () => {
  const h = harness(), picks = [], next = { speaker: '라일락', lines: ['그 대답을 기억할게.'] };
  let completed = 0;
  h.bus.on('dialogue:done', () => completed++);
  h.bus.on('dialogue:choice', ({ id }) => { picks.push(id); h.bus.emit('dialogue:show', next); });
  h.show(choice()); h.advance(300); h.choose(1, 3);
  assert.deepEqual(picks, ['save']); assert.equal(completed, 0); assert.equal(h.current, next);
  assert.equal(h.bus.listenerCount('dialogue:show'), 1, 'temporary replacement listener must be removed');
  h.advance(500); assert.ok(h.text.includes('그 대답을 기억할게.'));
});

test('a plain quest choice still finishes once; a new dialogue permits a fresh selection', () => {
  const h = harness(); let picks = 0, completed = 0;
  h.bus.on('dialogue:choice', () => picks++); h.bus.on('dialogue:done', () => completed++);
  h.show(choice()); h.advance(300); h.choose(0, 3);
  assert.equal(picks, 1); assert.equal(completed, 1); assert.equal(h.current, null);
  h.show(choice()); h.advance(300); h.choose(1);
  assert.equal(picks, 2); assert.equal(completed, 2);
});

test('held confirmation cannot auto-select or advance the following speech before key release', () => {
  const h = harness(), next = { speaker: '라일락', lines: ['잠깐, 내 말을 들어봐.'] };
  let picks = 0, completed = 0;
  h.bus.on('dialogue:done', () => completed++);
  h.bus.on('dialogue:choice', () => { picks++; h.bus.emit('dialogue:show', next); });
  h.show(choice()); h.advance(300);
  h.key('keydown', 'Space', true); assert.equal(picks, 0, 'repeat is not a deliberate selection');
  h.key('keydown', 'Space'); assert.equal(picks, 1); h.advance(1000);
  h.key('keydown', 'Space', true); h.key('keydown', 'Space', true);
  assert.equal(h.current, next); assert.equal(completed, 0);
  h.key('keyup', 'Space'); h.key('keydown', 'Space');
  assert.equal(completed, 1); assert.equal(h.current, null);
});

test('choice opening guard rejects the initiating key and immediate touch', () => {
  const h = harness(); let picked = 0; h.bus.on('dialogue:choice', () => picked++);
  h.show(choice()); h.key('keydown', 'Enter'); h.choose(); assert.equal(picked, 0);
  h.key('keyup', 'Enter'); h.advance(300); h.key('keydown', 'ArrowDown'); h.key('keydown', 'Enter');
  assert.equal(picked, 1); assert.equal(h.current, null);
});


test('a lost keyup on browser blur cannot leave the following dialogue locked', () => {
  const h = harness(), next = { speaker: '라일락', lines: ['다시 만났네.'] };
  let completed = 0;
  h.bus.on('dialogue:done', () => completed++);
  h.bus.on('dialogue:choice', () => h.bus.emit('dialogue:show', next));
  h.show(choice()); h.advance(300); h.key('keydown', 'Enter'); h.advance(500);
  h.blur(); h.key('keydown', 'Space');
  assert.equal(completed, 1); assert.equal(h.current, null);
});
