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
check('the error lands on the next line, as in real parsers', () => assert.equal(nospace.line, 2));

// 1.1 has octal but no leading-zero decimal, so 08 is a string there and 8 under 1.2.
check('08 is a string under 1.1', () => assert.deepEqual(resolveScalar('08', '1.1'), { kind: 'string', value: '08' }));
check('08 is 8 under 1.2', () => assert.deepEqual(resolveScalar('08', '1.2'), { kind: 'int', value: 8 }));
check('0755 is still octal under 1.1', () => assert.deepEqual(resolveScalar('0755', '1.1'), { kind: 'int', value: 493 }));

const block = parseYaml('script: |\n  line one\n  line two\n', '1.2');
check('a literal block keeps its newlines', () => {
  assert.equal(block.ok, true);
  assert.match(block.root.entries[0][1].value, /line one\nline two/);
});

const listOfMaps = parseYaml('steps:\n  - name: build\n    run: make\n  - name: test\n    run: make test\n', '1.2');
check('a list of mappings parses', () => assert.equal(listOfMaps.ok, true));
check('and renders', () => assert.match(render(listOfMaps.root), /name: "build"/));

// Things real files contain that an over-simple parser rejects.
const multiDoc = parseYaml('---\na: 1\n---\nb: 2\n', '1.2');
check('a document separator does not break it', () => assert.equal(multiDoc.ok, true));
check('and the extra documents are counted', () => assert.equal(multiDoc.documents, 2));

const anchored = parseYaml('base: &b\n  image: alpine\nuse:\n  <<: *b\n  tag: v1\n', '1.2');
check('anchors and merge keys resolve', () => {
  assert.equal(anchored.ok, true);
  const use = anchored.root.entries.find(([k]) => k === 'use')[1];
  assert.deepEqual(use.entries.map(([k]) => k).sort(), ['image', 'tag']);
});
check('and the document is flagged as using them', () => assert.equal(anchored.usedAnchors, true));

const flowMap = parseYaml('limits: {cpu: 1, memory: 512Mi}\n', '1.2');
check('a flow mapping is a mapping, not a string', () => {
  const limits = flowMap.root.entries[0][1];
  assert.equal(limits.kind, 'map');
  assert.equal(limits.entries.find(([k]) => k === 'cpu')[1].kind, 'int');
});

const flowSeq = parseYaml('ports: [80, 443]\n', '1.2');
check('a flow sequence is a sequence of ints', () => {
  const ports = flowSeq.root.entries[0][1];
  assert.equal(ports.kind, 'seq');
  assert.equal(ports.items.length, 2);
  assert.equal(ports.items[0].kind, 'int');
});

const dupes = parseYaml('name: one\nname: two\n', '1.2');
check('a repeated key keeps the last value', () => {
  assert.equal(dupes.root.entries.length, 1);
  assert.equal(dupes.root.entries[0][1].value, 'two');
});
check('and the duplicate is reported', () => assert.deepEqual(dupes.duplicates, ['name']));

const folded = parseYaml('note: this keeps\n  going on the next line\n', '1.2');
check('a plain scalar folds across lines', () =>
  assert.equal(folded.root.entries[0][1].value, 'this keeps going on the next line'));

const tagged = parseYaml('port: !!str 8080\n', '1.2');
check('an explicit tag stops resolution', () => {
  assert.deepEqual(tagged.root.entries[0][1], { kind: 'string', value: '8080' });
});

const escaped = parseYaml('msg: "line\\nbreak"\n', '1.2');
check('double quotes process escapes', () => assert.match(escaped.root.entries[0][1].value, /line\nbreak/));

const singled = parseYaml("msg: 'line\\nbreak'\n", '1.2');
check('single quotes do not', () => assert.match(singled.root.entries[0][1].value, /line\\nbreak/));

// YAML 1.1 types that 1.2 dropped, checked against PyYAML 6.0.
check('22:22 is base 60 under 1.1', () => assert.deepEqual(resolveScalar('22:22', '1.1'), { kind: 'int', value: 1342 }));
check('22:22 is a string under 1.2', () => assert.deepEqual(resolveScalar('22:22', '1.2'), { kind: 'string', value: '22:22' }));
check('1:08 reads each base 60 part as decimal', () => assert.deepEqual(resolveScalar('1:08', '1.1'), { kind: 'int', value: 68 }));
check('1:20.5 is a base 60 float under 1.1', () => assert.deepEqual(resolveScalar('1:20.5', '1.1'), { kind: 'float', value: 80.5 }));
check('0b1010 is 10 under 1.1', () => assert.deepEqual(resolveScalar('0b1010', '1.1'), { kind: 'int', value: 10 }));
check('0b1010 is a string under 1.2', () => assert.deepEqual(resolveScalar('0b1010', '1.2'), { kind: 'string', value: '0b1010' }));
check('1_000 is 1000 under 1.1', () => assert.deepEqual(resolveScalar('1_000', '1.1'), { kind: 'int', value: 1000 }));
check('-1_000 keeps its sign', () => assert.deepEqual(resolveScalar('-1_000', '1.1'), { kind: 'int', value: -1000 }));
check('1_000 is a string under 1.2', () => assert.deepEqual(resolveScalar('1_000', '1.2'), { kind: 'string', value: '1_000' }));
check('0x_ff is 255 under 1.1', () => assert.deepEqual(resolveScalar('0x_ff', '1.1'), { kind: 'int', value: 255 }));
check('.inf is infinity in both specs', () => {
  assert.deepEqual(resolveScalar('.inf', '1.1'), { kind: 'float', value: Infinity });
  assert.deepEqual(resolveScalar('.inf', '1.2'), { kind: 'float', value: Infinity });
  assert.deepEqual(resolveScalar('-.Inf', '1.2'), { kind: 'float', value: -Infinity });
});
check('.nan is a float in both specs', () => {
  assert.equal(resolveScalar('.nan', '1.1').kind, 'float');
  assert.ok(Number.isNaN(resolveScalar('.NaN', '1.2').value));
});
check('1e3 is a string under 1.1 but 1000 under 1.2', () => {
  assert.deepEqual(resolveScalar('1e3', '1.1'), { kind: 'string', value: '1e3' });
  assert.deepEqual(resolveScalar('1e3', '1.2'), { kind: 'float', value: 1000 });
});
check('a 1.1 exponent needs a dot and a sign', () => {
  assert.deepEqual(resolveScalar('1.0e3', '1.1'), { kind: 'string', value: '1.0e3' });
  assert.deepEqual(resolveScalar('1.0e+3', '1.1'), { kind: 'float', value: 1000 });
});
check('1.10.2 stays a string under 1.1 too', () =>
  assert.deepEqual(resolveScalar('1.10.2', '1.1'), { kind: 'string', value: '1.10.2' }));
check('1.10 is still the float 1.1 under 1.1', () => assert.deepEqual(resolveScalar('1.10', '1.1'), { kind: 'float', value: 1.1 }));

const oldTypes = specDisagreements('time: 22:22\nmask: 0b1010\nbig: 1_000\nlimit: .inf\nsci: 1e3\n');
check('the disagreement table lists the 1.1-only types', () => {
  assert.deepEqual(
    oldTypes.map((d) => [d.path, d.as11, d.as12]),
    [
      ['time', 'int 1342', 'string'],
      ['mask', 'int 10', 'string'],
      ['big', 'int 1000', 'string'],
      ['sci', 'string', 'float 1000'],
    ],
  );
});

// Plain keys resolve too: PyYAML loads a GitHub Actions `on:` as the key True.
const workflow = 'on:\n  push:\n    branches: [main]\njobs:\n  build: {runs-on: ubuntu-latest}\n';
const wf11 = parseYaml(workflow, '1.1');
const wf12 = parseYaml(workflow, '1.2');
check('on: is the key true under 1.1', () => {
  assert.equal(wf11.root.entries[0][0], 'true');
  assert.match(render(wf11.root), /^true:\n/);
});
check('on: stays a string key under 1.2', () => assert.equal(wf12.root.entries[0][0], 'on'));
check('and the key shows up as a disagreement', () => {
  const d = specDisagreements(workflow);
  assert.deepEqual(d.map((x) => [x.path, x.as11, x.as12]), [['on (key)', 'bool true', 'string']]);
});
check('a quoted key is left alone', () => assert.equal(parseYaml('"on": push\n', '1.1').root.entries[0][0], 'on'));
check('keys that resolve to the same value collide', () => {
  const r2 = parseYaml('on: push\nyes: 1\n', '1.1');
  assert.equal(r2.root.entries.length, 1);
  assert.deepEqual(r2.duplicates, ['true']);
});

// A bool key and a string key with the same text are different keys.
const mixedKeys = parseYaml('true: first\n"true": second\n', '1.2');
check('true and "true" stay two keys', () => {
  assert.equal(mixedKeys.root.entries.length, 2);
  assert.deepEqual(mixedKeys.duplicates, []);
  assert.deepEqual(
    mixedKeys.root.entries.map(([k, v, kind]) => [k, kind ?? 'string', v.value]),
    [
      ['true', 'bool', 'first'],
      ['true', 'string', 'second'],
    ],
  );
});
check('and render differently', () => assert.equal(render(mixedKeys.root), 'true: "first"\n"true": "second"'));
check('the same holds in a flow mapping', () => {
  const flow = parseYaml('m: {1: a, "1": b}\n', '1.2').root.entries[0][1];
  assert.deepEqual(flow.entries.map(([k, , kind]) => [k, kind ?? 'string']), [
    ['1', 'int'],
    ['1', 'string'],
  ]);
});
check('a string key that reads like another type is quoted when rendered', () =>
  assert.match(render(wf12.root), /^"on":\n/));

// The 1.1 spec allows a sign before a dot-leading float (PyYAML is stricter here).
check('-.5 is a float under 1.1', () => assert.deepEqual(resolveScalar('-.5', '1.1'), { kind: 'float', value: -0.5 }));
check('+.5e+1 is a float under 1.1', () => assert.deepEqual(resolveScalar('+.5e+1', '1.1'), { kind: 'float', value: 5 }));
check('-.5 is a float under 1.2 too', () => assert.deepEqual(resolveScalar('-.5', '1.2'), { kind: 'float', value: -0.5 }));

console.log(`yaml-sim-engine: ${passed} assertions passed`);
