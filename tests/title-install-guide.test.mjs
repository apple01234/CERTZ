import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const html = readFileSync(new URL('../public/apk-guide.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const valid = { latest: '9.8.7', code: 987, apk: 'https://github.com/apple01234/CERTZ/releases/download/v9.8.7/SERTZ-vc987.apk' };

function guide(responses) {
  const elements = Object.fromEntries(['apk', 'retry', 'version'].map(id => [id, {
    hidden: id !== 'version', disabled: false,
    removeAttribute(name) { delete this[name]; },
    addEventListener(event, fn) { this[event] = fn; },
  }]));
  const timers = new Map(), requests = [];
  const context = vm.createContext({
    document: { getElementById: id => elements[id] }, URL, AbortController,
    setTimeout(fn) { const id = {}; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch(url, options) {
      requests.push({ url, ...options });
      const response = responses.shift();
      if (typeof response === 'function') return response(options);
      return Promise.resolve({ ok: response !== false, json: async () => response });
    },
  });
  const done = vm.runInContext(script, context);
  return { elements, done, timers, requests };
}

test('install guide shows only validated official APK URLs and releases its loading state', async () => {
  const h = guide([valid]);
  assert.equal(h.elements.retry.disabled, true);
  assert.equal(h.elements.apk.hidden, true);
  await h.done;
  assert.equal(h.elements.apk.href, valid.apk);
  assert.equal(h.elements.apk.hidden, false);
  assert.match(h.elements.version.textContent, /v9\.8\.7/);
  assert.equal(h.elements.retry.disabled, false);
  assert.equal(h.timers.size, 0);
  assert.equal(h.requests[0].cache, 'no-store');
});

test('invalid version metadata or untrusted APK targets never become download links', async () => {
  for (const data of [
    false, null, { ...valid, latest: 'unknown' }, { ...valid, code: 0 }, { ...valid, code: 1.5 },
    { ...valid, apk: 'javascript:alert(1)' },
    { ...valid, apk: 'https://example.com/file.apk' },
    { ...valid, apk: 'https://github.com/other/project/releases/download/file.apk' },
    { ...valid, apk: 'https://github.com.evil.example/apple01234/CERTZ/releases/download/file.apk' },
  ]) {
    const h = guide([data]);
    await h.done;
    assert.equal(h.elements.apk.hidden, true);
    assert.equal(h.elements.apk.href, undefined);
    assert.match(h.elements.version.textContent, /공식 배포 목록/);
    assert.equal(h.elements.retry.hidden, false);
    assert.equal(h.timers.size, 0);
  }
});

test('retry recovers from a failed version request and hides stale links while reloading', async () => {
  const h = guide([false, valid, false]);
  await h.done;
  await h.elements.retry.click();
  assert.equal(h.elements.apk.href, valid.apk);
  const done = h.elements.retry.click();
  assert.equal(h.elements.apk.hidden, true);
  assert.equal(h.elements.apk.href, undefined);
  await done;
  assert.equal(h.elements.apk.hidden, true);
  assert.equal(h.requests.length, 3);
});

test('a stalled version request times out and leaves retry and the release-list fallback available', async () => {
  const h = guide([({ signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))))]);
  for (const timeout of h.timers.values()) timeout();
  await h.done;
  assert.equal(h.elements.apk.hidden, true);
  assert.equal(h.elements.retry.disabled, false);
  assert.match(h.elements.version.textContent, /다시 시도/);
  assert.match(html, /href="https:\/\/github.com\/apple01234\/CERTZ\/releases"/);
});

test('title save deletion requires confirmation and cancel never changes the saved game', () => {
  const source = readFileSync(new URL('../src/components/game/Overlays.tsx', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('Overlays.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler;
  const visit = node => {
    if (ts.isArrowFunction(node) && node.getText(tree).includes('clearSave();')) handler = node.getText(tree);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.ok(handler);
  for (const accepted of [false, true]) {
    let cleared = 0, changed = 0;
    const run = new Function('window', 'clearSave', 'setSave', `return (${handler});`)(
      { confirm: () => accepted }, () => cleared++, () => changed++,
    );
    run();
    assert.equal(cleared, Number(accepted));
    assert.equal(changed, Number(accepted));
  }
});

test('rotation guidance never blocks title, account or character selection', () => {
  const source = readFileSync(new URL('../src/components/game/GameRoot.tsx', import.meta.url), 'utf8');
  assert.match(source, /<RotatePrompt active=\{state === "playing" && portraitMobile && !rotateDismissed\}/);
});
