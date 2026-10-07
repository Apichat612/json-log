/**
 * Public entry point for the JSON Log library.
 *
 * Re-exports the single factory function `createJsonLogger` so consumers import
 * one name. A factory is used instead of a class instance so the internal
 * state (the accumulator) never escapes the module boundary.
 */
export { createJsonLogger } from './core.js';
