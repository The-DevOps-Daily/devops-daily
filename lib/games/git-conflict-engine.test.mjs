/**
 * Engine test for the Git Merge Conflict Simulator.
 *
 * Run with:  npx tsx lib/games/git-conflict-engine.test.mjs
 *
 * Every lesson must be completable by its own Run commands and solutions, and
 * the traps the lessons teach (markers staged by git add, --ours during a
 * rebase, committing with unmerged paths) must not count as progress.
 */
import assert from 'node:assert/strict';
import { LESSONS, execute, saveFile, hasMarkers, classifyLines } from './git-conflict-engine.ts';

function play(lesson) {
  let state = lesson.initial();
  lesson.steps.forEach((step, i) => {
    if (step.kind === 'edit') {
      assert.notEqual(
        step.validate(state.files[step.file].content),
        null,
        `${lesson.id} step ${i}: the starting file must not already pass`
      );
      assert.equal(
        step.validate(step.solution),
        null,
        `${lesson.id} step ${i}: the solution must validate`
      );
      state = saveFile(state, step.file, step.solution);
      return;
    }
    const before = state;
    const result = execute(step.command, state);
    state = result.state;
    assert.ok(
      step.done(step.command, before, state),
      `${lesson.id} step ${i} (${step.command}) did not complete:\n${result.lines.map((l) => l.content).join('\n')}`
    );
  });
  return state;
}

// Every lesson plays through. The first one only reads the conflict, so it ends mid-merge.
for (const lesson of LESSONS) {
  const end = play(lesson);
  if (lesson.id !== 'read-markers') {
    assert.equal(end.op, null, `${lesson.id} should end with no merge or rebase in progress`);
  }
}

// The conflicted working file matches the stages it is built from.
{
  const lesson = LESSONS.find((l) => l.id === 'read-markers');
  const state = lesson.initial();
  const sides = classifyLines(state.files['config.yaml'].content);
  assert.deepEqual(
    sides.filter((l) => l.side === 'ours').map((l) => l.text),
    ['timeout: 45']
  );
  assert.deepEqual(
    sides.filter((l) => l.side === 'theirs').map((l) => l.text),
    ['timeout: 60']
  );
  const base = execute('git show :1:config.yaml', state).lines[0].content;
  assert.match(base, /timeout: 30/);
}

// Resolving by picking one side is rejected, with the reason.
{
  const step = LESSONS.find((l) => l.id === 'resolve-by-editing').steps[0];
  assert.match(
    step.validate('flask==3.0.3\nredis==5.0.8\ngunicorn==22.0.0\n'),
    /prometheus-client/
  );
  assert.match(step.validate('flask==3.0.3\n<<<<<<< HEAD\nredis==5.0.8\n'), /markers/);
}

// git add with markers still in the file stages it (Git does not check) but is not progress.
{
  const lesson = LESSONS.find((l) => l.id === 'resolve-by-editing');
  const state = lesson.initial();
  const r = execute('git add requirements.txt', state);
  assert.equal(r.state.files['requirements.txt'].status, 'staged');
  assert.ok(r.lines.some((l) => l.type === 'note' && /markers/.test(l.content)));
  assert.equal(lesson.steps[1].done('git add requirements.txt', state, r.state), false);
  // and checkout -m brings the conflict back
  const back = execute('git checkout -m requirements.txt', r.state).state;
  assert.equal(back.files['requirements.txt'].status, 'unmerged');
  assert.ok(hasMarkers(back.files['requirements.txt'].content));
}

// Committing with unmerged paths fails the way Git does.
{
  const state = LESSONS.find((l) => l.id === 'resolve-by-editing').initial();
  const r = execute('git commit --no-edit', state);
  assert.equal(r.lines[0].type, 'error');
  assert.match(r.lines[0].content, /unmerged files/);
  assert.equal(r.state.op?.kind, 'merge');
}

// Aborting is not concluding: the commit step must not complete on --abort.
{
  const lesson = LESSONS.find((l) => l.id === 'resolve-by-editing');
  const state = lesson.initial();
  const r = execute('git merge --abort', state);
  assert.equal(r.state.op, null);
  assert.equal(lesson.steps[3].done('git merge --abort', state, r.state), false);
}

// During a rebase, --ours is main's version and does not complete the step.
{
  const lesson = LESSONS.find((l) => l.id === 'rebase-flip');
  const state = lesson.initial();
  const r = execute('git checkout --ours app.py', state);
  assert.match(r.state.files['app.py'].content, /VERSION/);
  assert.doesNotMatch(r.state.files['app.py'].content, /limiter/);
  assert.equal(lesson.steps[2].done('git checkout --ours app.py', state, r.state), false);
  assert.ok(
    r.lines.some(
      (l) => l.type === 'note' && /--ours is the branch you are replaying onto/.test(l.content)
    )
  );
}

// npm cannot read a lockfile with markers in it.
{
  const state = LESSONS.find((l) => l.id === 'ours-theirs').initial();
  const r = execute('npm install', state);
  assert.equal(r.lines[0].type, 'error');
  assert.equal(r.state.lockfileRegenerated, false);
}

// merge --abort restores every file.
{
  const state = LESSONS.find((l) => l.id === 'abort').initial();
  const r = execute('git merge --abort', state);
  for (const f of Object.values(r.state.files)) {
    assert.equal(f.status, 'clean');
    assert.equal(hasMarkers(f.content), false, `${f.path} still has markers after --abort`);
  }
  assert.match(
    execute('git status', r.state).lines[0].content,
    /nothing to commit, working tree clean/
  );
}

// The clean merge really is clean, and the tests catch it.
{
  const lesson = LESSONS.find((l) => l.id === 'semantic-conflict');
  let state = lesson.initial();
  const merged = execute('git merge feature/worker', state);
  assert.match(merged.lines[0].content, /Merge made by the 'ort' strategy/);
  state = merged.state;
  assert.ok(Object.values(state.files).every((f) => f.status === 'clean'));
  assert.equal(execute('make test', state).state.tests, 'failing');
}

console.log(
  `git-conflict-engine: ${LESSONS.length} lessons, ${LESSONS.reduce((n, l) => n + l.steps.length, 0)} steps, all checks passed`
);
