// Parses the data part of the website's `window.X = <literal>;` files without executing them.
// Accepts JSON plus the JavaScript literal forms those files use: unquoted keys,
// single-quoted and backtick strings (no `${}`), trailing commas, true/false/null and numbers.
// Anything else (function calls, identifiers as values, interpolation) is rejected.

function parseLiteral(source) {
  let i = 0;
  const s = String(source);

  function fail(message) {
    throw new Error(message + ' @' + i);
  }

  function skip() {
    while (i < s.length) {
      const c = s[i];
      if (c === ' ' || c === '\n' || c === '\r' || c === '\t' || c === '﻿') { i++; continue; }
      if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
      if (c === '/' && s[i + 1] === '*') {
        const end = s.indexOf('*/', i + 2);
        if (end < 0) fail('unterminated comment');
        i = end + 2;
        continue;
      }
      break;
    }
  }

  function string() {
    const quote = s[i++];
    let out = '';
    while (i < s.length) {
      const c = s[i++];
      if (c === quote) return out;
      if (quote === '`' && c === '$' && s[i] === '{') fail('template interpolation is not allowed');
      if (c === '\\') {
        const e = s[i++];
        if (e === 'n') out += '\n';
        else if (e === 't') out += '\t';
        else if (e === 'r') out += '\r';
        else if (e === 'b') out += '\b';
        else if (e === 'f') out += '\f';
        else if (e === 'u') {
          const hex = s.slice(i, i + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail('bad unicode escape');
          out += String.fromCharCode(parseInt(hex, 16));
          i += 4;
        } else if (e === '\n') {
          // line continuation
        } else out += e;
        continue;
      }
      if ((c === '\n' || c === '\r') && quote !== '`') fail('newline in string');
      out += c;
    }
    fail('unterminated string');
  }

  function key() {
    skip();
    const c = s[i];
    if (c === '"' || c === "'" || c === '`') return string();
    const match = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(s.slice(i, i + 200));
    if (!match) fail('bad key');
    i += match[0].length;
    return match[0];
  }

  function value(depth = 0) {
    if (depth > 80) fail('too many nested values');
    skip();
    const c = s[i];
    if (c === '{') {
      i++;
      const obj = {};
      skip();
      if (s[i] === '}') { i++; return obj; }
      for (;;) {
        const k = key();
        skip();
        if (s[i] !== ':') fail('expected :');
        i++;
        Object.defineProperty(obj, k, { value: value(depth + 1), enumerable: true, configurable: true, writable: true });
        skip();
        if (s[i] === ',') { i++; skip(); if (s[i] === '}') { i++; return obj; } continue; }
        if (s[i] === '}') { i++; return obj; }
        fail('expected , or }');
      }
    }
    if (c === '[') {
      i++;
      const arr = [];
      skip();
      if (s[i] === ']') { i++; return arr; }
      for (;;) {
        arr.push(value(depth + 1));
        skip();
        if (s[i] === ',') { i++; skip(); if (s[i] === ']') { i++; return arr; } continue; }
        if (s[i] === ']') { i++; return arr; }
        fail('expected , or ]');
      }
    }
    if (c === '"' || c === "'" || c === '`') return string();
    const rest = s.slice(i, i + 40);
    const num = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(rest);
    if (num) { i += num[0].length; return Number(num[0]); }
    if (rest.startsWith('true')) { i += 4; return true; }
    if (rest.startsWith('false')) { i += 5; return false; }
    if (rest.startsWith('null')) { i += 4; return null; }
    fail('unexpected value');
  }

  const result = value();
  skip();
  if (s[i] === ';') i++;
  skip();
  if (i !== s.length) fail('trailing content');
  return result;
}

// `window.NAME=[...];` or `window.NAME = {...};` → the literal. The name must match.
function parseAssignment(source, name) {
  const text = String(source);
  const match = /^\s*window\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=/.exec(text);
  if (!match || (name && match[1] !== name)) throw new Error('unexpected data file');
  return parseLiteral(text.slice(match[0].length));
}

module.exports = { parseLiteral, parseAssignment };
