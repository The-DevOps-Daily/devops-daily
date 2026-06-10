// Generates the site's hand-authored Lottie animations into public/lottie/.
// Run: node scripts/generate-lottie-animations.mjs
//
// The animations are built programmatically (seeded, so output is stable)
// instead of using stock LottieFiles clips: keeps them license-clean and in
// the site's palette/terminal aesthetic.

import fs from 'fs';
import path from 'path';

const OUT_DIR = path.join(process.cwd(), 'public', 'lottie');

// Site palette (tailwind colors used across components)
const EMERALD = [0.063, 0.725, 0.506, 1];
const AMBER = [0.961, 0.62, 0.043, 1];
const BLUE = [0.231, 0.51, 0.965, 1];
const VIOLET = [0.545, 0.361, 0.965, 1];
const RED = [0.937, 0.267, 0.267, 1];
const YELLOW = [0.98, 0.8, 0.082, 1];
const WINDOW_BG = [0.071, 0.085, 0.118, 1]; // slate-900ish
const WINDOW_BAR = [0.118, 0.161, 0.231, 1]; // slate-800
const LINE = [0.279, 0.334, 0.408, 1]; // slate-600

// Deterministic pseudo-random
function lcg(seed) {
  let s = seed;
  return () => {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  };
}

const stat = (k) => ({ a: 0, k });
const ease = { i: { x: [0.3], y: [1] }, o: { x: [0.4], y: [0] } };
const easeP = { i: { x: 0.3, y: 1 }, o: { x: 0.4, y: 0 } };
const linP = { i: { x: 1, y: 1 }, o: { x: 0, y: 0 } };

const LINEAR = { i: { x: [0.667], y: [0.667] }, o: { x: [0.333], y: [0.333] } };

function kf(frames) {
  // frames: [{t, s, e?}]. Every non-final keyframe gets easing data; lottie's
  // interpolator throws on segments whose leading keyframe has no i/o, which
  // blanks the whole frame.
  return {
    a: 1,
    k: frames.map(({ t, s, e }, idx) => ({
      t,
      s,
      ...(idx < frames.length - 1 ? e || LINEAR : {}),
    })),
  };
}

function fill(color, opacity = 100) {
  return { ty: 'fl', c: stat(color), o: stat(opacity) };
}

function stroke(color, width, opacity = 100) {
  return { ty: 'st', c: stat(color), o: stat(opacity), w: stat(width), lc: 2, lj: 2 };
}

function group(name, items, transform = {}) {
  return {
    ty: 'gr',
    nm: name,
    it: [
      ...items,
      {
        ty: 'tr',
        p: transform.p || stat([0, 0]),
        a: stat([0, 0]),
        s: transform.s || stat([100, 100]),
        r: transform.r || stat(0),
        o: transform.o || stat(100),
      },
    ],
  };
}

const rect = (w, h, r = 2) => ({ ty: 'rc', p: stat([0, 0]), s: stat([w, h]), r: stat(r) });
const ellipse = (w, h) => ({ ty: 'el', p: stat([0, 0]), s: stat([w, h]) });

function layer(ind, name, shapes, ks, ip, op) {
  return {
    ddd: 0,
    ind,
    ty: 4,
    nm: name,
    sr: 1,
    ks: {
      o: ks.o || stat(100),
      r: ks.r || stat(0),
      p: ks.p || stat([0, 0, 0]),
      a: stat([0, 0, 0]),
      s: ks.s || stat([100, 100, 100]),
    },
    ao: 0,
    shapes,
    ip,
    op,
    st: 0,
  };
}

function animation(name, w, h, op, layers) {
  return { v: '5.7.4', fr: 60, ip: 0, op, w, h, nm: name, ddd: 0, assets: [], layers };
}

/* ---------------- quiz celebration: one-shot confetti burst ------------- */
function quizCelebration() {
  const W = 400;
  const H = 300;
  const OP = 140;
  const cx = W / 2;
  const cy = H / 2 + 30;
  const rand = lcg(20260610);
  const colors = [EMERALD, AMBER, BLUE, VIOLET, RED, YELLOW];
  const layers = [];
  let ind = 1;

  // Two expanding rings
  for (const [delay, color] of [[0, EMERALD], [10, AMBER]]) {
    layers.push(
      layer(
        ind++,
        `ring-${delay}`,
        [group('ring', [ellipse(70, 70), stroke(color, 5)])],
        {
          p: stat([cx, cy, 0]),
          s: kf([
            { t: delay, s: [20, 20, 100], e: ease },
            { t: delay + 45, s: [180, 180, 100] },
          ]),
          o: kf([
            { t: delay, s: [90], e: ease },
            { t: delay + 45, s: [0] },
          ]),
        },
        0,
        OP
      )
    );
  }

  // Confetti particles
  for (let i = 0; i < 14; i++) {
    const angle = (Math.PI * 2 * i) / 14 + rand() * 0.5;
    const dist = 90 + rand() * 70;
    const peakX = cx + Math.cos(angle) * dist;
    const peakY = cy - Math.abs(Math.sin(angle)) * dist * 0.9 - 20;
    const endY = H + 20;
    const endX = peakX + (rand() - 0.5) * 60;
    const spin = (rand() > 0.5 ? 1 : -1) * (360 + rand() * 480);
    const color = colors[i % colors.length];
    const isDot = rand() > 0.6;
    const shape = isDot
      ? group('p', [ellipse(9, 9), fill(color)])
      : group('p', [rect(8, 14, 2), fill(color)]);

    layers.push(
      layer(
        ind++,
        `confetti-${i}`,
        [shape],
        {
          p: {
            a: 1,
            k: [
              { t: 0, s: [cx, cy, 0], ...easeP },
              { t: 32 + rand() * 10, s: [peakX, peakY, 0], ...linP },
              { t: OP - 8, s: [endX, endY, 0] },
            ],
          },
          r: kf([
            { t: 0, s: [0], e: ease },
            { t: OP - 8, s: [spin] },
          ]),
          o: kf([
            { t: 0, s: [100], e: ease },
            { t: 95, s: [100], e: ease },
            { t: OP - 10, s: [0] },
          ]),
        },
        0,
        OP
      )
    );
  }

  return animation('quiz-celebration', W, H, OP, layers);
}

/* --------------- games hero: terminal window with typing loop ----------- */
function gamesHero() {
  const W = 320;
  const H = 240;
  const OP = 240; // 4s loop
  const cx = W / 2;
  const cy = H / 2 + 8;
  const layers = [];
  let ind = 1;

  const bob = (base, amp, phase = 0) =>
    kf([
      { t: 0, s: [base[0], base[1] + amp * Math.sin(phase), 0], e: ease },
      { t: 60, s: [base[0], base[1] + amp * Math.sin(phase + Math.PI / 2), 0], e: ease },
      { t: 120, s: [base[0], base[1] + amp * Math.sin(phase + Math.PI), 0], e: ease },
      { t: 180, s: [base[0], base[1] + amp * Math.sin(phase + 1.5 * Math.PI), 0], e: ease },
      { t: 240, s: [base[0], base[1] + amp * Math.sin(phase), 0] },
    ]);

  // Floating accents behind the window
  layers.push(
    layer(
      ind++,
      'dpad',
      [
        group('dpad', [rect(34, 12, 5), fill(EMERALD)]),
        group('dpad-v', [rect(12, 34, 5), fill(EMERALD)]),
      ],
      { p: bob([46, 64], 7, 0), r: stat(-12), o: stat(85) },
      0,
      OP
    ),
    layer(
      ind++,
      'triangle',
      [
        group('tri', [
          {
            ty: 'sr',
            sy: 2,
            p: stat([0, 0]),
            pt: stat(3),
            r: stat(0),
            or: stat(16),
            os: stat(0),
          },
          stroke(AMBER, 4.5),
        ]),
      ],
      { p: bob([276, 58], 8, 1.8), r: kf([{ t: 0, s: [0], e: ease }, { t: 240, s: [38] }]), o: stat(85) },
      0,
      OP
    ),
    layer(
      ind++,
      'circle',
      [group('c', [ellipse(24, 24), stroke(BLUE, 4.5)])],
      { p: bob([286, 178], 7, 3.4), o: stat(85) },
      0,
      OP
    ),
    layer(
      ind++,
      'cross-x',
      [
        group('x1', [rect(20, 5, 2.5), fill(VIOLET)], { r: stat(45) }),
        group('x2', [rect(20, 5, 2.5), fill(VIOLET)], { r: stat(-45) }),
      ],
      { p: bob([38, 186], 8, 5.0), o: stat(85) },
      0,
      OP
    )
  );

  // Terminal window
  const winW = 212;
  const winH = 140;
  const winTop = cy - winH / 2;
  const typed = [
    // [y offset from window top, final width, color, start frame]
    [44, 96, EMERALD, 18],
    [62, 130, LINE, 48],
    [80, 72, AMBER, 90],
    [98, 112, LINE, 126],
  ];

  // Shape order matters: earlier entries render on top, so the frame
  // backdrop goes last.
  const windowShapes = [
    ...[
      [RED, -winW / 2 + 16],
      [YELLOW, -winW / 2 + 32],
      [EMERALD, -winW / 2 + 48],
    ].map(([c, x], i) =>
      group(`dot-${i}`, [ellipse(8, 8), fill(c)], { p: stat([x, -(winH / 2) + 13]) })
    ),
    group(
      'bar',
      [rect(winW, 26, 10), fill(WINDOW_BAR)],
      { p: stat([0, -(winH / 2) + 13]) }
    ),
    group('frame', [rect(winW, winH, 10), fill(WINDOW_BG)]),
  ];

  // Layer order also matters (first = on top): typed lines and the cursor
  // must come before the window layer or they hide behind it. Collect them
  // separately, then assemble lines/cursor -> window -> floating accents.
  const lineLayers = [];

  // Typed lines: scale-x animates from 0 to 100 anchored at the left edge.
  for (const [i, [dy, w, color, start]] of typed.entries()) {
    lineLayers.push(
      layer(
        ind++,
        `line-${i}`,
        [
          group('ln', [rect(w, 7, 3.5), fill(color)], {
            // anchor at left edge: offset the rect right by half width
            p: stat([w / 2, 0]),
          }),
        ],
        {
          p: bob([cx - winW / 2 + 18, 0], 4, 2.2).a
            ? {
                a: 1,
                k: bob([cx - winW / 2 + 18, winTop + dy], 4, 2.2).k,
              }
            : stat([cx - winW / 2 + 18, winTop + dy, 0]),
          s: kf([
            { t: start, s: [0, 100, 100], e: ease },
            { t: start + 22, s: [100, 100, 100] },
          ]),
        },
        0,
        OP
      )
    );
  }

  // Blinking cursor after the last line (gentle pulse; hand-rolled easing
  // objects here once crashed lottie's interpolator mid-render and blanked
  // every layer drawn after this one, so it goes through kf() like the rest)
  const cursorY = winTop + 116;
  const blinkFrames = [{ t: 0, s: [100] }, { t: 150, s: [100] }];
  for (let t = 165, on = false; t <= OP; t += 15, on = !on) {
    blinkFrames.push({ t, s: [on ? 100 : 10] });
  }
  const blink = kf(blinkFrames).k;
  lineLayers.push(
    layer(
      ind++,
      'cursor',
      [group('cur', [rect(9, 13, 1.5), fill(EMERALD)])],
      {
        p: {
          a: 1,
          k: bob([cx - winW / 2 + 24, cursorY], 4, 2.2).k,
        },
        o: { a: 1, k: blink },
      },
      0,
      OP
    )
  );

  const windowLayer = layer(ind++, 'window', windowShapes, { p: bob([cx, cy], 4, 2.2) }, 0, OP);

  // First in the array renders on top: lines/cursor, then the window
  // backdrop, then the floating accents (which sit outside the window).
  return animation('games-hero', W, H, OP, [...lineLayers, windowLayer, ...layers]);
}

/* ------------- 404: packet falls through the broken pipe, loops --------- */
function packetLost() {
  const W = 320;
  const H = 200;
  const OP = 200;
  const pipeY = 92;
  const gapL = 176;
  const gapR = 216;
  const layers = [];
  let ind = 1;

  // Packet: slides along the pipe, tips over the edge, falls through the gap
  layers.push(
    layer(
      ind++,
      'packet',
      [group('pk', [rect(22, 16, 4), fill(BLUE)])],
      {
        p: {
          a: 1,
          k: [
            { t: 0, s: [26, pipeY - 12, 0], i: { x: 0.6, y: 1 }, o: { x: 0.3, y: 0 } },
            { t: 78, s: [gapL + 6, pipeY - 12, 0], ...linP },
            { t: 96, s: [gapL + 22, pipeY + 8, 0], ...easeP },
            { t: 150, s: [gapL + 30, H + 24, 0] },
          ],
        },
        r: kf([
          { t: 78, s: [0], e: ease },
          { t: 150, s: [168] },
        ]),
        o: kf([
          { t: 0, s: [100], e: ease },
          { t: 126, s: [100], e: ease },
          { t: 148, s: [0] },
        ]),
      },
      0,
      OP
    )
  );

  // Pipe segments with broken ends angled down into the gap
  layers.push(
    layer(
      ind++,
      'pipe',
      [
        group('left', [rect(gapL - 16, 6, 3), fill(LINE)], {
          p: stat([(16 + gapL) / 2, pipeY]),
        }),
        group('right', [rect(W - gapR - 16, 6, 3), fill(LINE)], {
          p: stat([(gapR + W - 16) / 2, pipeY]),
        }),
        group('break-l', [rect(16, 6, 3), fill(LINE)], {
          p: stat([gapL + 5, pipeY + 6]),
          r: stat(38),
        }),
        group('break-r', [rect(16, 6, 3), fill(LINE)], {
          p: stat([gapR - 5, pipeY + 6]),
          r: stat(-38),
        }),
      ],
      { p: stat([0, 0, 0]) },
      0,
      OP
    )
  );

  // Spark flashes at the gap edges when the packet tips in
  for (const [x, r, t0] of [
    [gapL + 2, -30, 88],
    [gapR - 2, 30, 92],
  ]) {
    layers.push(
      layer(
        ind++,
        `spark-${t0}`,
        [
          group('s1', [rect(10, 3, 1.5), fill(AMBER)], { r: stat(r) }),
          group('s2', [rect(10, 3, 1.5), fill(AMBER)], { r: stat(r + 90) }),
        ],
        {
          p: stat([x, pipeY - 8, 0]),
          s: kf([
            { t: t0, s: [40, 40, 100], e: ease },
            { t: t0 + 12, s: [120, 120, 100] },
          ]),
          o: kf([
            { t: 0, s: [0] },
            { t: t0, s: [100], e: ease },
            { t: t0 + 16, s: [0] },
          ]),
        },
        0,
        OP
      )
    );
  }

  return animation('packet-lost-404', W, H, OP, layers);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const outputs = [
  ['quiz-celebration.json', quizCelebration()],
  ['games-hero.json', gamesHero()],
  ['packet-lost-404.json', packetLost()],
];
for (const [file, data] of outputs) {
  const json = JSON.stringify(data);
  fs.writeFileSync(path.join(OUT_DIR, file), json);
  console.log(`${file}: ${(json.length / 1024).toFixed(1)} KB`);
}
