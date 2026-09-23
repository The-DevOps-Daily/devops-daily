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
import {
  LESSONS,
  execute,
  saveFile,
  hasMarkers,
  classifyLines,
  fileStatus,
} from './git-conflict-engine.ts';

const lesson = (id) => LESSONS.find((l) => l.id === id);

function play(l) {
  let state = l.initial();
  l.steps.forEach((step, i) => {
    if (step.kind === 'edit') {
      assert.notEqual(
        step.validate(state.files[step.file].content),
        null,
        `${l.id} step ${i}: the starting file must not already pass`
      );
      assert.equal(
        step.validate(step.solution),
        null,
        `${l.id} step ${i}: the solution must validate`
      );
      state = saveFile(state, step.file, step.solution);
      return;
    }
    const before = state;
    const result = execute(step.command, state);
    state = result.state;
    assert.ok(result.ok, `${l.id} step ${i} (${step.command}) failed`);
    assert.ok(
      step.done(step.command, before, state),
      `${l.id} step ${i} (${step.command}) did not complete:\n${result.lines.map((x) => x.content).join('\n')}`
    );
  });
  return state;
}

// Every lesson plays through. The first one only reads the conflict, so it ends mid-merge.
for (const l of LESSONS) {
  const end = play(l);
  if (l.id !== 'read-markers') {
    assert.equal(end.op, null, `${l.id} should end with no merge or rebase in progress`);
    for (const f of Object.values(end.files)) {
      assert.equal(fileStatus(f), 'clean', `${l.id}: ${f.path} should be committed`);
    }
  }
}

// The conflicted working file matches the stages it is built from.
{
  const state = lesson('read-markers').initial();
  const sides = classifyLines(state.files['config.yaml'].content);
  assert.deepEqual(
    sides.filter((x) => x.side === 'ours').map((x) => x.text),
    ['timeout: 45']
  );
  assert.deepEqual(
    sides.filter((x) => x.side === 'theirs').map((x) => x.text),
    ['timeout: 60']
  );
  assert.match(execute('git show :1:config.yaml', state).lines[0].content, /timeout: 30/);
}

// Once a path is resolved it has no stages: git show :1: fails.
{
  const staged = execute('git add config.yaml', lesson('read-markers').initial()).state;
  const r = execute('git show :1:config.yaml', staged);
  assert.equal(r.ok, false);
  assert.match(r.lines[0].content, /not at stage 1/);
}

// Resolving by picking one side is rejected, with the reason.
{
  const step = lesson('resolve-by-editing').steps[0];
  assert.match(
    step.validate('flask==3.0.3\nredis==5.0.8\ngunicorn==22.0.0\n'),
    /prometheus-client/
  );
  assert.match(step.validate('flask==3.0.3\n<<<<<<< HEAD\nredis==5.0.8\n'), /markers/);
}

// git add with markers stages them (Git does not check) but is not progress; checkout -m undoes it.
{
  const l = lesson('resolve-by-editing');
  const state = l.initial();
  const r = execute('git add requirements.txt', state);
  assert.equal(fileStatus(r.state.files['requirements.txt']), 'staged');
  assert.ok(r.lines.some((x) => x.type === 'note' && /markers/.test(x.content)));
  assert.equal(l.steps[1].done('git add requirements.txt', state, r.state), false);
  const back = execute('git checkout -m requirements.txt', r.state).state;
  assert.equal(fileStatus(back.files['requirements.txt']), 'unmerged');
  assert.match(back.files['requirements.txt'].content, /^<<<<<<< ours$/m);
  assert.match(back.files['requirements.txt'].content, /^>>>>>>> theirs$/m);
}

// Saving the right file and then taking one side again does not pass the add step.
{
  const l = lesson('resolve-by-editing');
  let state = saveFile(l.initial(), 'requirements.txt', l.steps[0].solution);
  state = execute('git checkout --ours requirements.txt', state).state;
  const r = execute('git add requirements.txt', state);
  assert.equal(l.steps[1].done('git add requirements.txt', state, r.state), false);
}

// After git add, --ours and --theirs have no stage to read, as in Git.
{
  const l = lesson('resolve-by-editing');
  const resolved = saveFile(l.initial(), 'requirements.txt', l.steps[0].solution);
  const staged = execute('git add requirements.txt', resolved).state;
  const r = execute('git checkout --ours requirements.txt', staged);
  assert.equal(r.ok, false);
  assert.match(r.lines[0].content, /does not have our version/);

  // Saving a staged file leaves the index alone.
  const edited = saveFile(staged, 'requirements.txt', 'flask==3.0.3\n');
  assert.equal(edited.files['requirements.txt'].index, l.steps[0].solution);
  assert.match(execute('git status', edited).lines[0].content, /Changes not staged for commit/);
}

// Committing with unmerged paths fails the way Git does.
{
  const r = execute('git commit --no-edit', lesson('resolve-by-editing').initial());
  assert.equal(r.ok, false);
  assert.match(r.lines[0].content, /unmerged files/);
  assert.equal(r.state.op?.kind, 'merge');
}

// Aborting is not concluding.
{
  const l = lesson('resolve-by-editing');
  const state = l.initial();
  const r = execute('git merge --abort', state);
  assert.equal(r.state.op, null);
  assert.equal(l.steps[3].done('git merge --abort', state, r.state), false);
}

// Binary conflict: no markers, and --abort restores the cleanly merged file too.
{
  const state = lesson('ours-theirs').initial();
  assert.equal(hasMarkers(state.files['assets/logo.png'].content), false);
  assert.match(execute('git diff', state).lines[0].content, /Binary files differ/);
  const aborted = execute('git merge --abort', state).state;
  assert.match(aborted.files['assets/brand.css'].content, /#2563eb/);
}

// During a rebase, --ours is the rebased side and does not complete the step.
{
  const l = lesson('rebase-flip');
  const state = l.initial();
  const r = execute('git checkout --ours limits.py', state);
  assert.match(r.state.files['limits.py'].content, /200 per minute/);
  assert.equal(l.steps[2].done('git checkout --ours limits.py', state, r.state), false);
  assert.ok(
    r.lines.some((x) => x.type === 'note' && /your own commit is --theirs/.test(x.content))
  );
}

// rebase --continue refuses unstaged changes, and --abort puts the branch back.
{
  const l = lesson('rebase-flip');
  let state = execute('git checkout --theirs limits.py', l.initial()).state;
  state = execute('git add limits.py', state).state;
  const dirty = saveFile(state, 'limits.py', 'something else\n');
  const r = execute('git rebase --continue', dirty);
  assert.equal(r.ok, false);
  assert.match(r.lines[0].content, /unstaged changes/);
  const aborted = execute('git rebase --abort', l.initial()).state;
  assert.equal(aborted.branch, 'feature/rate-limit');
  assert.equal(aborted.headSha, '7c1e2a9');
  assert.match(aborted.files['limits.py'].content, /10 per second/);
}

// merge --abort restores every file.
{
  const r = execute('git merge --abort', lesson('abort').initial());
  for (const f of Object.values(r.state.files)) {
    assert.equal(fileStatus(f), 'clean');
    assert.equal(hasMarkers(f.content), false, `${f.path} still has markers after --abort`);
  }
  assert.match(
    execute('git status', r.state).lines[0].content,
    /nothing to commit, working tree clean/
  );
}

// The clean merge really is clean, the tests catch it, and a comment does not fix it.
{
  const l = lesson('semantic-conflict');
  const merged = execute('git merge feature/worker', l.initial());
  assert.match(merged.lines[0].content, /Merge made by the 'ort' strategy/);
  assert.ok(Object.values(merged.state.files).every((f) => fileStatus(f) === 'clean'));
  assert.equal(execute('make test', merged.state).state.tests, 'failing');
  assert.notEqual(l.steps[2].validate('# get_request_timeout()\n'), null);
  const commented = saveFile(merged.state, 'worker.py', '# get_request_timeout()\n');
  assert.equal(execute('make test', commented).state.tests, 'failing');
}

console.log(
  `git-conflict-engine: ${LESSONS.length} lessons, ${LESSONS.reduce((n, l) => n + l.steps.length, 0)} steps, all checks passed`
);
