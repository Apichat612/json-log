/**
 * Core implementation of a logger that writes one JSON object per line.
 *
 * Design decision (stated plainly):
 *   The "consistent key order" guarantee is implemented by sorting keys
 *   alphabetically at serialization time. We deliberately do NOT support a
 *   custom key-ordering callback. Every prior attempt to support both
 *   "sort alphabetically" and "caller-defined order" in the same function
 *   produced a wrapper with three conflicting code paths that failed its own
 *   tests. One rule, one code path.
 */

/**
 * Deterministic alphabet comparator for object keys.
 *
 * Built on String.prototype.localeCompare with the "base" sensitivity so that
 * only base letters matter, and a numeric sub-ordering so that "log2" sorts
 * before "log10". This is the closest standard-library comparator to a stable
 * lexical sort without pulling in a third-party collation library.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function compareKeys(a, b) {
  return a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true });
}

/**
 * Serializes a value to a compact JSON string with keys sorted deterministically.
 *
 * Uses JSON.stringify's replacer-function overload. The replacer receives
 * (holder, key) pairs in insertion order; by buffering them and sorting before
 * emitting, we get sorted output without mutating the caller's object.
 *
 * Edge cases handled here, because the tests cover them:
 *   - undefined at the top level (stringifies to the literal text "undefined",
 *     because JSON.stringify(undefined) returns undefined; we coerce to the
 *     string so a log line is never empty).
 *   - circular references throw synchronously; the caller decides whether to
 *     catch. We do not swallow errors — silent failure is worse than a thrown
 *     exception for a logging library.
 *   - BigInt values are passed through via a toJSON-free path; JSON.stringify
 *     throws on BigInt by default, and we let it, because coercing BigInt to
 *     Number would silently lose precision.
 *
 * @param {*} value
 * @returns {string}
 */
function toSortedJson(value) {
  if (value === undefined) {
    return 'undefined';
  }
  const seen = new Set();
  const replacer = (key, val) => {
    if (val !== null && typeof val === 'object') {
      if (seen.has(val)) {
        throw new TypeError('Converting circular structure to JSON');
      }
      seen.add(val);
      if (Array.isArray(val)) {
        return val;
      }
      const sortedEntries = Object.entries(val)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => compareKeys(a, b));
      return Object.fromEntries(sortedEntries);
    }
    return val;
  };
  const out = JSON.stringify(value, replacer);
  return out === undefined ? 'undefined' : out;
}

/**
 * Creates a JsonLogger bound to an output sink.
 *
 * @param {{ write: (line: string) => void }} sink  Anything with a .write(line)
 *        method. In Node that's typically process.stdout; in tests it's a
 *        capturing stub. We depend on the duck type, not on Node's stream
 *        classes, so the library stays dependency-free and testable.
 * @returns {{ log: (obj: Record<string, unknown>) => void }}
 */
export function createJsonLogger(sink) {
  if (!sink || typeof sink.write !== 'function') {
    throw new TypeError('createJsonLogger requires a sink with a write(line) method');
  }
  return {
    /**
     * Writes one JSON line to the sink.
     *
     * The line is terminated with a single '\n' (U+000A). We do not support
     * configurable terminators; supporting both '\n' and '\r\n' is exactly the
     * kind of "honour it three ways" compromise that breaks its own tests.
     *
     * @param {Record<string, unknown>} obj
     * @returns {void}
     */
    log(obj) {
      const line = toSortedJson(obj) + '\n';
      sink.write(line);
    },
  };
}
