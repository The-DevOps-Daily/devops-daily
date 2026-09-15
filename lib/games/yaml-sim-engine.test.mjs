/**
 * Engine correctness test for the YAML Parsing Simulator.
 *
 * Run with:  npx tsx lib/games/yaml-sim-engine.test.mjs
 *
 * These assert the behaviour the simulator teaches, so if a resolution rule is
 * ever changed the lesson text and the engine cannot drift apart silently.
 */
import assert from 'node:assert/strict';
import { parseYaml, render, specDisagreements, resolveScalar } from './yaml-sim-engine.ts';

let passed = 0;
const check = (label, fn) => {
  fn();
  passed += 1;
  void label;
};

// The Norway problem: the reason this simulator exists.
check('NO is false under 1.1', () => assert.deepEqual(resolveScalar('NO', '1.1'), { kind: 'bool', value: false }));
check('NO is a string under 1.2', () => assert.deepEqual(resolveScalar('NO', '1.2'), { kind: 'string', value: 'NO' }));
check('yes is true under 1.1', () => assert.deepEqual(resolveScalar('yes', '1.1'), { kind: 'bool', value: true }));
check('yes is a string under 1.2', () => assert.deepEqual(resolveScalar('yes', '1.2'), { kind: 'string', value: 'yes' }));
check('off is false under 1.1', () => assert.deepEqual(resolveScalar('off', '1.1'), { kind: 'bool', value: false }));

// Versions.
check('1.10 is the float 1.1', () => assert.deepEqual(resolveScalar('1.10', '1.2'), { kind: 'float', value: 1.1 }));
check('1.10.2 stays a string', () => assert.deepEqual(resolveScalar('1.10.2', '1.2'), { kind: 'string', value: '1.10.2' }));

// Leading zeros mean different numbers in the two specs.
check('0755 is octal 493 under 1.1', () => assert.deepEqual(resolveScalar('0755', '1.1'), { kind: 'int', value: 493 }));
check('0755 is decimal 755 under 1.2', () => assert.deepEqual(resolveScalar('0755', '1.2'), { kind: 'int', value: 755 }));
check('0xFF is 255', () => assert.deepEqual(resolveScalar('0xFF', '1.2'), { kind: 'int', value: 255 }));

// Null has several spellings and an empty string is not one of them.
check('~ is null', () => assert.deepEqual(resolveScalar('~', '1.2'), { kind: 'null', value: null }));
check('nothing is null', () => assert.deepEqual(resolveScalar('', '1.2'), { kind: 'null', value: null }));

const doc = `
country: NO
version: 1.10
enabled: yes
name: "yes"
port: 8080
tags:
  - alpha
  - beta
nested:
  deep:
    value: off
`;

const r = parseYaml(doc, '1.1');
check('the document parses', () => assert.equal(r.ok, true));
check('a quoted yes is left alone', () => assert.equal(r.coercions.find((c) => c.path === 'name'), undefined));
check('country is coerced', () => assert.equal(r.coercions.find((c) => c.path === 'country').value, 'false'));
check('nested paths are reported', () => assert.equal(r.coercions.find((c) => c.path === 'nested.deep.value').value, 'false'));
check('port is an int', () => assert.equal(r.coercions.find((c) => c.path === 'port').kind, 'int'));

const disagreements = specDisagreements(doc);
check('three values differ between specs', () => assert.equal(disagreements.length, 3));
check('country is one of them', () => assert.equal(disagreements.find((d) => d.path === 'country').as12, 'string'));

// Structural errors the lessons rely on.
const tabbed = parseYaml('root:\n\tkey: value\n', '1.2');
check('a tab in indentation is rejected', () => {
  assert.equal(tabbed.ok, false);
  assert.match(tabbed.message, /tab/i);
});

const nospace = parseYaml('key:value\nother: 1\n', '1.2');
check('a colon with no space is not a mapping', () => assert.equal(nospace.ok, false));

const block = parseYaml('script: |\n  line one\n  line two\n', '1.2');
check('a literal block keeps its newlines', () => {
  assert.equal(block.ok, true);
  assert.match(block.root.entries[0][1].value, /line one\nline two/);
});

const listOfMaps = parseYaml('steps:\n  - name: build\n    run: make\n  - name: test\n    run: make test\n', '1.2');
check('a list of mappings parses', () => assert.equal(listOfMaps.ok, true));
check('and renders', () => assert.match(render(listOfMaps.root), /name: "build"/));

console.log(`yaml-sim-engine: ${passed} assertions passed`);
