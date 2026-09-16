/**
 * Engine correctness test for the Cron Expression Simulator.
 *
 * Run with:  npx tsx lib/games/cron-sim-engine.test.mjs
 *
 * The simulator makes claims about when a job fires. These assert the claims,
 * so the lesson text and the engine cannot drift apart silently. Fixed start
 * instants are used throughout, never Date.now(), so a run in December gives
 * the same answer as a run in June.
 */
import assert from 'node:assert/strict';
import {
  parseCron,
  findNextTransition,
  nextFireTimes,
  describeCron,
  observations,
  dayMatches,
  wallClockToInstants,
  localParts,
  EXAMPLES,
  TIMEZONES,
} from './cron-sim-engine.ts';

let passed = 0;
const check = (label, fn) => {
  try {
    fn();
  } catch (err) {
    console.error(`FAILED: ${label}`);
    throw err;
  }
  passed += 1;
};

/** The local wall-clock strings of the next `n` fires, which is what the UI shows. */
const fires = (expr, tz, n, fromIso) => {
  const p = parseCron(expr);
  assert.ok(p.ok, `expected ${expr} to parse: ${JSON.stringify(p.errors)}`);
  return nextFireTimes(p, tz, n, Date.parse(fromIso)).times.map((t) => t.local);
};

// ---------------------------------------------------------------------------
// Field parsing
// ---------------------------------------------------------------------------

check('five stars parses', () => {
  const p = parseCron('* * * * *');
  assert.equal(p.ok, true);
  assert.equal(p.fields.minute.values.length, 60);
  assert.equal(p.fields.hour.values.length, 24);
  assert.equal(p.fields.dom.values.length, 31);
  assert.equal(p.fields.month.values.length, 12);
  // 0-7 with 7 folded onto 0 leaves seven distinct days.
  assert.deepEqual(p.fields.dow.values, [0, 1, 2, 3, 4, 5, 6]);
});

check('*/15 gives 0,15,30,45', () => {
  assert.deepEqual(parseCron('*/15 * * * *').fields.minute.values, [0, 15, 30, 45]);
});

check('*/7 is uneven and ends at 56', () => {
  assert.deepEqual(parseCron('*/7 * * * *').fields.minute.values, [0, 7, 14, 21, 28, 35, 42, 49, 56]);
});

check('*/5 and 0,5,10,... are the same set', () => {
  const a = parseCron('*/5 * * * *').fields.minute.values;
  const b = parseCron('0,5,10,15,20,25,30,35,40,45,50,55 * * * *').fields.minute.values;
  assert.deepEqual(a, b);
});

check('a range with a step', () => {
  assert.deepEqual(parseCron('0-30/10 * * * *').fields.minute.values, [0, 10, 20, 30]);
});

check('a bare number with a step runs to the end of the range', () => {
  // Vixie cron reads `5/20` as "from 5, every 20, to 59".
  assert.deepEqual(parseCron('5/20 * * * *').fields.minute.values, [5, 25, 45]);
});

check('lists and ranges combine', () => {
  assert.deepEqual(parseCron('0 1,3,5-7 * * *').fields.hour.values, [1, 3, 5, 6, 7]);
});

check('month names work', () => {
  assert.deepEqual(parseCron('0 0 1 JAN,APR,JUL,OCT *').fields.month.values, [1, 4, 7, 10]);
});

check('day names work and are case insensitive', () => {
  assert.deepEqual(parseCron('0 0 * * mon-fri').fields.dow.values, [1, 2, 3, 4, 5]);
});

check('dow 7 is Sunday, same as 0', () => {
  assert.deepEqual(parseCron('0 0 * * 7').fields.dow.values, [0]);
  assert.deepEqual(parseCron('0 0 * * 0').fields.dow.values, [0]);
});

check('? is accepted and means *', () => {
  const p = parseCron('0 0 ? * MON');
  assert.equal(p.ok, true);
  assert.equal(p.fields.dom.wildcard, true);
  // With dom unrestricted there is no OR rule.
  assert.equal(p.dayOr, false);
});

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

check('hour 24 is rejected with the right hint', () => {
  const p = parseCron('0 24 * * *');
  assert.equal(p.ok, false);
  assert.match(p.errors[0].message, /out of range/);
  assert.match(p.errors[0].hint, /midnight is 0/);
});

check('minute 60 is rejected', () => {
  assert.equal(parseCron('60 * * * *').ok, false);
});

check('six fields is called out as Quartz/Spring', () => {
  const p = parseCron('0 0 0 * * *');
  assert.equal(p.ok, false);
  assert.match(p.errors[0].message, /6 fields/);
  assert.match(p.errors[0].hint, /seconds/);
});

check('four fields is rejected', () => {
  assert.equal(parseCron('0 0 * *').ok, false);
});

check('a backwards range is rejected, not wrapped', () => {
  const p = parseCron('0 22-4 * * *');
  assert.equal(p.ok, false);
  assert.match(p.errors[0].message, /backwards/);
  assert.match(p.errors[0].hint, /22-23,0-4/);
});

check('a zero step is rejected', () => {
  assert.equal(parseCron('*/0 * * * *').ok, false);
});

check('Quartz L is rejected with an explanation', () => {
  const p = parseCron('0 0 L * *');
  assert.equal(p.ok, false);
  assert.match(p.errors[0].message, /not standard cron/);
});

check('Quartz # is rejected', () => {
  assert.equal(parseCron('0 0 * * 2#2').ok, false);
});

check('an empty expression is an error, not a crash', () => {
  assert.equal(parseCron('   ').ok, false);
});

check('garbage in a field is an error', () => {
  assert.equal(parseCron('0 0 * * banana').ok, false);
});

// ---------------------------------------------------------------------------
// Macros
// ---------------------------------------------------------------------------

check('@daily expands to 0 0 * * *', () => {
  const p = parseCron('@daily');
  assert.equal(p.ok, true);
  assert.equal(p.normalised, '0 0 * * *');
  assert.equal(p.macro, '@daily');
});

check('@weekly is Sunday midnight', () => {
  assert.equal(parseCron('@weekly').normalised, '0 0 * * 0');
});

check('@reboot has no schedule and says so', () => {
  const p = parseCron('@reboot');
  assert.equal(p.ok, false);
  assert.match(p.errors[0].message, /runs once when cron starts/);
});

check('an unknown macro lists the known ones', () => {
  const p = parseCron('@fortnightly');
  assert.equal(p.ok, false);
  assert.match(p.errors[0].hint, /@daily/);
});

// ---------------------------------------------------------------------------
// The day-of-month / day-of-week OR rule
// ---------------------------------------------------------------------------

check('both day fields restricted sets dayOr', () => {
  assert.equal(parseCron('0 9 1 * MON').dayOr, true);
});

check('only one day field restricted does not', () => {
  assert.equal(parseCron('0 9 * * MON').dayOr, false);
  assert.equal(parseCron('0 9 1 * *').dayOr, false);
});

check('OR means the 1st fires even when it is not a Monday', () => {
  const p = parseCron('0 9 1 * MON');
  // 1 September 2026 is a Tuesday.
  assert.equal(dayMatches(p, { month: 9, day: 1, dow: 2 }), true);
  // And a Monday fires even when it is not the 1st.
  assert.equal(dayMatches(p, { month: 9, day: 7, dow: 1 }), true);
  // A day that is neither does not.
  assert.equal(dayMatches(p, { month: 9, day: 8, dow: 2 }), false);
});

check('without the OR rule both day fields must match', () => {
  const p = parseCron('0 9 * * MON');
  assert.equal(dayMatches(p, { month: 9, day: 7, dow: 1 }), true);
  assert.equal(dayMatches(p, { month: 9, day: 8, dow: 2 }), false);
});

check('the OR rule shows up in the real schedule', () => {
  // September 2026: the 1st is a Tuesday, Mondays are 7, 14, 21, 28. Start
  // after 09:00 on the 31st, which is itself a Monday and would otherwise fire.
  const got = fires('0 9 1 * MON', 'UTC', 5, '2026-08-31T12:00:00Z');
  assert.deepEqual(got, [
    '2026-09-01 09:00',
    '2026-09-07 09:00',
    '2026-09-14 09:00',
    '2026-09-21 09:00',
    '2026-09-28 09:00',
  ]);
});

// ---------------------------------------------------------------------------
// Fire times
// ---------------------------------------------------------------------------

check('every minute fires every minute', () => {
  const got = fires('* * * * *', 'UTC', 3, '2026-09-16T10:00:30Z');
  assert.deepEqual(got, ['2026-09-16 10:01', '2026-09-16 10:02', '2026-09-16 10:03']);
});

check('a minute already in progress does not fire again', () => {
  // At 10:00:30 the 10:00 run has been and gone.
  const got = fires('0 * * * *', 'UTC', 1, '2026-09-16T10:00:30Z');
  assert.deepEqual(got, ['2026-09-16 11:00']);
});

check('midnight daily', () => {
  const got = fires('0 0 * * *', 'UTC', 3, '2026-09-16T10:00:00Z');
  assert.deepEqual(got, ['2026-09-17 00:00', '2026-09-18 00:00', '2026-09-19 00:00']);
});

check('*/7 wraps with a 4 minute gap, which is the whole lesson', () => {
  const p = parseCron('*/7 * * * *');
  const times = nextFireTimes(p, 'UTC', 4, Date.parse('2026-09-16T10:48:00Z')).times;
  assert.deepEqual(times.map((t) => t.local), [
    '2026-09-16 10:49',
    '2026-09-16 10:56',
    '2026-09-16 11:00',
    '2026-09-16 11:07',
  ]);
  // 56 -> 00 is four minutes, not seven.
  assert.deepEqual(times.map((t) => t.gapMinutes), [null, 7, 4, 7]);
});

check('*/5 has no such gap', () => {
  const p = parseCron('*/5 * * * *');
  const times = nextFireTimes(p, 'UTC', 4, Date.parse('2026-09-16T10:48:00Z')).times;
  assert.deepEqual(times.map((t) => t.gapMinutes), [null, 5, 5, 5]);
});

check('weekdays only skips the weekend', () => {
  // 18 September 2026 is a Friday.
  const got = fires('30 8 * * 1-5', 'UTC', 3, '2026-09-18T09:00:00Z');
  assert.deepEqual(got, ['2026-09-21 08:30', '2026-09-22 08:30', '2026-09-23 08:30']);
});

check('a quarterly job crosses the year end', () => {
  const got = fires('0 6 1 1,4,7,10 *', 'UTC', 3, '2026-09-16T00:00:00Z');
  assert.deepEqual(got, ['2026-10-01 06:00', '2027-01-01 06:00', '2027-04-01 06:00']);
});

check('29 February only fires on a leap year', () => {
  const got = fires('0 0 29 2 *', 'UTC', 2, '2026-09-16T00:00:00Z');
  assert.deepEqual(got, ['2028-02-29 00:00', '2032-02-29 00:00']);
});

check('30 February never fires and is reported, not hung', () => {
  const p = parseCron('0 0 30 2 *');
  assert.equal(p.ok, true);
  const res = nextFireTimes(p, 'UTC', 5, Date.parse('2026-09-16T00:00:00Z'));
  assert.equal(res.never, true);
  assert.equal(res.times.length, 0);
});

check('the last day of a short month is respected', () => {
  // April has 30 days, so a 31st schedule skips it.
  const got = fires('0 0 31 * *', 'UTC', 3, '2026-03-31T12:00:00Z');
  assert.deepEqual(got, ['2026-05-31 00:00', '2026-07-31 00:00', '2026-08-31 00:00']);
});

// ---------------------------------------------------------------------------
// Timezones and daylight saving
// ---------------------------------------------------------------------------

check('a UTC schedule is unaffected by a London DST change', () => {
  // London goes forward at 01:00 UTC on 29 March 2026.
  const got = fires('30 2 * * *', 'UTC', 3, '2026-03-28T12:00:00Z');
  assert.deepEqual(got, ['2026-03-29 02:30', '2026-03-30 02:30', '2026-03-31 02:30']);
});

check('01:30 London does not exist on the spring-forward day', () => {
  // The UK clock goes 00:59 GMT straight to 02:00 BST on 29 March 2026, so it
  // is the 01:00 hour that vanishes, not the 02:00 one. Central Europe and the
  // US skip 02:00-03:00 instead; the hour depends on the zone, not on cron.
  const p = parseCron('30 1 * * *');
  const res = nextFireTimes(p, 'Europe/London', 3, Date.parse('2026-03-28T12:00:00Z'));
  assert.deepEqual(res.times.map((t) => t.local), [
    '2026-03-30 01:30',
    '2026-03-31 01:30',
    '2026-04-01 01:30',
  ]);
  assert.ok(res.skipped.some((s) => s.local === '2026-03-29 01:30'));
});

check('the skipped local time really has no instant', () => {
  assert.deepEqual(wallClockToInstants(2026, 3, 29, 1, 30, 'Europe/London'), []);
});

check('Berlin skips 02:30 on the same date, London does not', () => {
  assert.deepEqual(wallClockToInstants(2026, 3, 29, 2, 30, 'Europe/Berlin'), []);
  assert.equal(wallClockToInstants(2026, 3, 29, 2, 30, 'Europe/London').length, 1);
});

check('01:30 London happens twice on the autumn day', () => {
  // London goes back at 02:00 BST on 25 October 2026.
  const instants = wallClockToInstants(2026, 10, 25, 1, 30, 'Europe/London');
  assert.equal(instants.length, 2);
  // An hour apart, and the first is BST, the second GMT.
  assert.equal(instants[1] - instants[0], 3_600_000);
  assert.equal(localParts(instants[0], 'Europe/London').zoneAbbr, 'BST');
  assert.equal(localParts(instants[1], 'Europe/London').zoneAbbr, 'GMT');
});

check('a job at 01:30 London therefore fires twice that day', () => {
  const p = parseCron('30 1 * * *');
  const res = nextFireTimes(p, 'Europe/London', 3, Date.parse('2026-10-24T12:00:00Z'));
  assert.deepEqual(res.times.map((t) => t.local), [
    '2026-10-25 01:30',
    '2026-10-25 01:30',
    '2026-10-26 01:30',
  ]);
  assert.equal(res.times[0].repeated, true);
  assert.equal(res.times[1].repeated, true);
  // One hour apart in real time, despite reading the same on the wall.
  assert.equal(res.times[1].at - res.times[0].at, 3_600_000);
});

check('the same expression in two zones fires at different instants', () => {
  const p = parseCron('0 9 * * *');
  const utc = nextFireTimes(p, 'UTC', 1, Date.parse('2026-09-16T00:00:00Z')).times[0];
  const tokyo = nextFireTimes(p, 'Asia/Tokyo', 1, Date.parse('2026-09-16T00:00:00Z')).times[0];
  // Both read 09:00 on their own wall clock, which is the point.
  assert.equal(utc.local, '2026-09-16 09:00');
  // Tokyo is UTC+9, so at midnight UTC its 09:00 has already gone by: the next
  // one is the following day. Same expression, different instant, different date.
  assert.equal(tokyo.local, '2026-09-17 09:00');
  assert.notEqual(utc.at, tokyo.at);
});

check('a half-hour offset zone works', () => {
  const got = fires('0 9 * * *', 'Asia/Kolkata', 1, '2026-09-16T00:00:00Z');
  assert.deepEqual(got, ['2026-09-16 09:00']);
});

check('a southern hemisphere zone springs forward in October', () => {
  // Sydney goes forward on 4 October 2026, months out of step with the north.
  const p = parseCron('30 2 * * *');
  const res = nextFireTimes(p, 'Australia/Sydney', 2, Date.parse('2026-10-03T00:00:00Z'));
  assert.ok(res.skipped.some((s) => s.local === '2026-10-04 02:30'));
});

check('every listed timezone is one the runtime accepts', () => {
  for (const tz of TIMEZONES) {
    const p = localParts(Date.parse('2026-06-15T12:00:00Z'), tz);
    assert.equal(Number.isFinite(p.year), true, `${tz} did not resolve`);
    assert.ok(p.dow >= 0 && p.dow <= 6, `${tz} gave a bad weekday`);
  }
});

// ---------------------------------------------------------------------------
// Finding the next clock change, which is what the "jump to it" button uses
// ---------------------------------------------------------------------------

check('the next London change after midsummer is the October one', () => {
  const t = findNextTransition('Europe/London', Date.parse('2026-06-15T00:00:00Z'));
  assert.ok(t, 'expected a transition');
  assert.equal(t.shiftMinutes, -60);
  assert.equal(t.localBefore, '2026-10-25 01:59');
  assert.equal(t.localAfter, '2026-10-25 01:00');
  assert.equal(t.abbrBefore, 'BST');
  assert.equal(t.abbrAfter, 'GMT');
});

check('the next London change after new year is the March one', () => {
  const t = findNextTransition('Europe/London', Date.parse('2026-01-05T00:00:00Z'));
  assert.equal(t.shiftMinutes, 60);
  assert.equal(t.localBefore, '2026-03-29 00:59');
  // The clock jumps from 00:59 to 02:00, which is the hour that goes missing.
  assert.equal(t.localAfter, '2026-03-29 02:00');
});

check('a zone with no daylight saving returns null', () => {
  assert.equal(findNextTransition('UTC', Date.parse('2026-01-01T00:00:00Z')), null);
  assert.equal(findNextTransition('Asia/Kolkata', Date.parse('2026-01-01T00:00:00Z')), null);
  assert.equal(findNextTransition('Asia/Tokyo', Date.parse('2026-01-01T00:00:00Z')), null);
});

check('every DST zone in the list finds a change within a year', () => {
  const noDst = new Set(['UTC', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'America/Sao_Paulo']);
  for (const tz of TIMEZONES) {
    if (noDst.has(tz)) continue;
    assert.ok(findNextTransition(tz, Date.parse('2026-01-01T00:00:00Z')), `${tz} found no transition`);
  }
});

// ---------------------------------------------------------------------------
// Descriptions and observations
// ---------------------------------------------------------------------------

check('descriptions read like sentences', () => {
  assert.equal(describeCron(parseCron('0 0 * * *')), 'At 00:00, every day.');
  assert.equal(describeCron(parseCron('* * * * *')), 'Every minute, every day.');
  assert.equal(describeCron(parseCron('*/5 * * * *')), 'Every 5 minutes, every day.');
  assert.equal(describeCron(parseCron('30 8 * * 1-5')), 'At 08:30, Monday to Friday.');
});

check('the description spells out the OR rather than hiding it', () => {
  assert.match(describeCron(parseCron('0 9 1 * MON')), /and also on Monday/);
});

check('*/7 raises the uneven-step observation', () => {
  const p = parseCron('*/7 * * * *');
  const res = nextFireTimes(p, 'UTC', 5, Date.parse('2026-09-16T10:00:00Z'));
  const obs = observations(p, res, 'UTC');
  const gap = obs.find((o) => o.kind === 'gap');
  assert.ok(gap, 'expected an uneven-step observation');
  assert.match(gap.body, /is 4 minutes, not 7/);
});

check('*/5 raises no uneven-step observation', () => {
  const p = parseCron('*/5 * * * *');
  const res = nextFireTimes(p, 'UTC', 5, Date.parse('2026-09-16T10:00:00Z'));
  assert.equal(observations(p, res, 'UTC').some((o) => o.kind === 'gap'), false);
});

check('five stars warns about 1,440 runs', () => {
  const p = parseCron('* * * * *');
  const res = nextFireTimes(p, 'UTC', 5, Date.parse('2026-09-16T10:00:00Z'));
  assert.ok(observations(p, res, 'UTC').some((o) => /1,440/.test(o.title)));
});

check('the OR observation appears only when both day fields are set', () => {
  const withOr = parseCron('0 9 1 * MON');
  const without = parseCron('0 9 * * MON');
  const at = Date.parse('2026-09-16T10:00:00Z');
  assert.ok(observations(withOr, nextFireTimes(withOr, 'UTC', 5, at), 'UTC').some((o) => o.kind === 'or'));
  assert.equal(observations(without, nextFireTimes(without, 'UTC', 5, at), 'UTC').some((o) => o.kind === 'or'), false);
});

check('a skipped DST run raises an observation', () => {
  const p = parseCron('30 1 * * *');
  const res = nextFireTimes(p, 'Europe/London', 5, Date.parse('2026-03-28T12:00:00Z'));
  assert.ok(observations(p, res, 'Europe/London').some((o) => o.kind === 'dst' && /skipped/.test(o.title)));
});

check('a doubled DST run raises an observation', () => {
  const p = parseCron('30 1 * * *');
  const res = nextFireTimes(p, 'Europe/London', 5, Date.parse('2026-10-24T12:00:00Z'));
  assert.ok(observations(p, res, 'Europe/London').some((o) => o.kind === 'dst' && /twice/.test(o.title)));
});

// ---------------------------------------------------------------------------
// The shipped examples must all do what their blurb claims
// ---------------------------------------------------------------------------

check('every example parses, or fails on purpose', () => {
  for (const ex of EXAMPLES) {
    const p = parseCron(ex.expr);
    assert.equal(p.ok, true, `${ex.id} (${ex.expr}) did not parse`);
  }
});

check('every example except the impossible one produces fire times', () => {
  for (const ex of EXAMPLES) {
    const at = ex.from ? Date.parse(ex.from) : Date.parse('2026-09-16T10:00:00Z');
    const p = parseCron(ex.expr);
    const res = nextFireTimes(p, ex.tz ?? 'UTC', 3, at);
    if (ex.id === 'never') {
      assert.equal(res.never, true, 'the "never" example should never fire');
    } else {
      assert.equal(res.times.length, 3, `${ex.id} produced ${res.times.length} times`);
    }
  }
});

check('the DST examples show their point in the first few runs', () => {
  // The whole reason an example carries a `from`: the lesson has to be visible
  // immediately, not 200 runs later.
  const spring = EXAMPLES.find((e) => e.id === 'dst-spring');
  const springRes = nextFireTimes(parseCron(spring.expr), spring.tz, 5, Date.parse(spring.from));
  assert.ok(springRes.skipped.length > 0, 'the spring example did not skip a run in its first five');

  const autumn = EXAMPLES.find((e) => e.id === 'dst-autumn');
  const autumnRes = nextFireTimes(parseCron(autumn.expr), autumn.tz, 5, Date.parse(autumn.from));
  assert.ok(autumnRes.times.some((t) => t.repeated), 'the autumn example did not double a run in its first five');
});

// ---------------------------------------------------------------------------
// Regressions from the parser /tools/cron-parser used to carry
//
// That page had its own implementation and got these three wrong. It now uses
// this engine, so these assertions are what stop the old answers coming back.
// ---------------------------------------------------------------------------

check('0 9 1 * 1 is not five months away', () => {
  // The old tool ANDed the two day fields and answered "1 February 2027".
  // The 1st or any Monday means the next one is days away, not months.
  const got = fires('0 9 1 * 1', 'UTC', 5, '2026-09-16T12:00:00Z');
  assert.deepEqual(got, [
    '2026-09-21 09:00',
    '2026-09-28 09:00',
    '2026-10-01 09:00',
    '2026-10-05 09:00',
    '2026-10-12 09:00',
  ]);
});

check('MON parses rather than returning nothing', () => {
  // The old tool refused any expression with a day name in it.
  const named = parseCron('0 9 1 * MON');
  const numeric = parseCron('0 9 1 * 1');
  assert.equal(named.ok, true);
  assert.deepEqual(named.fields.dow.values, numeric.fields.dow.values);
});

check('a leap-year schedule gives dates instead of an empty list', () => {
  // The old tool searched one year of minutes and reported no runs at all.
  const res = nextFireTimes(parseCron('0 0 29 2 *'), 'UTC', 2, Date.parse('2026-09-16T12:00:00Z'));
  assert.equal(res.never, false);
  assert.deepEqual(res.times.map((t) => t.local), ['2028-02-29 00:00', '2032-02-29 00:00']);
});

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

check('a sparse expression terminates instead of hanging', () => {
  const started = Date.now();
  const p = parseCron('0 0 29 2 *');
  nextFireTimes(p, 'UTC', 5, Date.parse('2026-09-16T00:00:00Z'));
  assert.ok(Date.now() - started < 4000, 'leap-year search took too long');
});

check('a dense expression over a DST day stays correct', () => {
  // 1,440 candidate minutes on a day that loses one hour: 1,380 real ones.
  // Start before local midnight so the whole day is ahead of the search.
  const p = parseCron('* * * * *');
  const res = nextFireTimes(p, 'Europe/London', 1500, Date.parse('2026-03-28T23:30:00Z'));
  const onTheDay = res.times.filter((t) => t.local.startsWith('2026-03-29'));
  assert.equal(onTheDay.length, 1380, `expected 1380 minutes on the short day, got ${onTheDay.length}`);
});

console.log(`cron-sim-engine: ${passed} checks passed`);
