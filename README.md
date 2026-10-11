# JSON Log

A tiny, zero-dependency logger that writes one JSON object per line to any sink with a `.write(line)` method, with object keys sorted deterministically.

```js
import { createJsonLogger } from 'json-log';

const log = createJsonLogger(process.stdout);
log.log({ level: 'error', message: 'disk full', path: '/var/data' });
// {"level":"error","message":"disk full","path":"/var/data"}
```

## Why

Structured logs are easier to grep and ingest when every line is valid JSON and keys appear in a stable order. The consistent order makes diffs between log lines readable and lets downstream parsers rely on field locality.

The trade-off: keys are always sorted alphabetically with `localeCompare` (base sensitivity, numeric sub-ordering). There is no callback to customize order. Supporting both "sorted" and "caller-defined" in one function is the exact ambiguity that breaks these libraries, so this one picks sorting and stops there.

## Edge you will hit

- `undefined` values in objects are dropped (standard `JSON.stringify` behavior). If you need a placeholder, use `null` explicitly.
- Circular references and `BigInt` throw synchronously. The library does not coerce or swallow — a logger that silently drops fields is worse than one that fails loudly.
- The sink is a duck type: anything with `write(line)`. The library does not import Node's `stream` module, so it works in any environment that provides a writable sink.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

