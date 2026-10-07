import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createJsonLogger } from '../src/index.js';

/**
 * A minimal capturing sink. Collects every string passed to .write into an
 * array so each test can assert on exact output without touching the real
 * stdout (which would make assertions order-sensitive and noisy).
 */
function capturingSink() {
  const lines = [];
  return {
    lines,
    write(line) { lines.push(line); },
  };
}

test('writes a single JSON line with a trailing newline', () => {
  const sink = capturingSink();
  const log = createJsonLogger(sink);
  log.log({ level: 'info', message: 'hello' });
  assert.deepEqual(sink.lines, ['{"level":"info","message":"hello"}\n']);
});

test('sorts keys alphabetically regardless of insertion order', () => {
  const sink = capturingSink();
  const log = createJsonLogger(sink);
  log.log({ zeta: 1, alpha: 2, mu: 3 });
  assert.equal(sink.lines[0], '{"alpha":2,"mu":3,"zeta":1}\n');
});

test('numeric sub-ordering: log2 sorts before log10', () => {
  const sink = capturingSink();
  const log = createJsonLogger(sink);
  log.log({ log10: 'a', log2: 'b' });
  assert.equal(sink.lines[0], '{"log2":"b","log10":"a"}\n');
});

test('nested objects are also sorted by key', () => {
  const sink = capturingSink();
  const log = createJsonLogger(sink);
  log.log({ outer: { z: 1, a: 2 }, keep: true });
  assert.equal(sink.lines[0], '{"keep":true,"outer":{"a":2,"z":1}}\n');
});

test('arrays preserve element order (only object keys are sorted)', () => {
  const sink = capturingSink();
  const log = createJsonLogger(sink);
  log.log({ items: ['z', 'a', 'm'] });
  assert.equal(sink.lines[0], '{"items":["z","a","m"]}\n');
});

test('keys with undefined values are omitted, matching JSON.stringify', () => {
  const sink = capturingSink();
  const log = createJsonLogger(sink);
  log.log({ present: 1, absent: undefined });
  assert.equal(sink.lines[0], '{"present":1}\n');
});

test('null values are preserved, not treated as undefined', () => {
  const sink = capturingSink();
  const log = createJsonLogger(sink);
  log.log({ value: null });
  assert.equal(sink.lines[0], '{"value":null}\n');
});

test('multiple log calls produce multiple lines', () => {
  const sink = capturingSink();
  const log = createJsonLogger(sink);
  log.log({ n: 1 });
  log.log({ n: 2 });
  assert.deepEqual(sink.lines, ['{"n":1}\n', '{"n":2}\n']);
});

test('throws synchronously on circular references', () => {
  const sink = capturingSink();
  const log = createJsonLogger(sink);
  const obj = { a: 1 };
  obj.self = obj;
  assert.throws(() => log.log(obj), { name: 'TypeError' });
  assert.equal(sink.lines.length, 0, 'no partial write on circular input');
});

test('throws on BigInt because JSON.stringify does, and we do not coerce', () => {
  const sink = capturingSink();
  const log = createJsonLogger(sink);
  assert.throws(() => log.log({ big: 10n }), { name: 'TypeError' });
});

test('throws when constructed without a sink', () => {
  assert.throws(() => createJsonLogger(undefined), { name: 'TypeError' });
});

test('throws when sink lacks a write method', () => {
  assert.throws(() => createJsonLogger({}), { name: 'TypeError' });
});
