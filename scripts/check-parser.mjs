import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source = fs.readFileSync(new URL('../assets/js/terminal.js', import.meta.url), 'utf8');
const start = source.indexOf('  function parse(text) {');
const end = source.indexOf('\n  function ', start + 1);
assert.ok(start >= 0 && end > start);
const parse = vm.runInNewContext(`(${source.slice(start, end).trim()})`);
for (const [input, expected] of [
  ['echo "a b"c', { name: 'echo', args: ['a bc'] }],
  ['echo "" end', { name: 'echo', args: ['', 'end'] }],
  ['cd hello\\ world', { name: 'cd', args: ['hello world'] }],
  ['ls -l', { name: 'ls', args: ['-l'] }],
  ['   ', { name: '', args: [] }],
]) {
  assert.deepEqual(JSON.parse(JSON.stringify(parse(input))), expected);
}
console.log('Command parser: quoted fragments, empty arguments, escapes and normal commands OK');
