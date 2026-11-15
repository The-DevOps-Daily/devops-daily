import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import {
  classAttributeToClassSelector,
  noTransitionsWhileThemeSwitches,
} from '../postcss.config.mjs';

const run = async (css: string) =>
  (await postcss([classAttributeToClassSelector()]).process(css, { from: undefined })).css;

describe('class attribute selectors', () => {
  it('turns the typography not-prose guard into class selectors', async () => {
    const css =
      '.prose :where(p):not(:where([class~="not-prose"],[class~="not-prose"] *)){margin:0}';
    expect(await run(css)).toBe('.prose :where(p):not(:where(.not-prose,.not-prose *)){margin:0}');
  });

  it('handles unquoted values and the lead class', async () => {
    expect(await run('.prose :where([class~=lead]){color:red}')).toBe(
      '.prose :where(.lead){color:red}'
    );
  });

  it('leaves other attribute selectors alone', async () => {
    const css = '[class*="col-"],[class~="a b"],[data-state="open"] *{color:red}';
    expect(await run(css)).toBe(css);
  });
});

describe('transitions while the theme switches', () => {
  const runTwin = async (css: string) =>
    (await postcss([noTransitionsWhileThemeSwitches()]).process(css, { from: undefined })).css;

  it('adds a twin after each rule that sets a transition', async () => {
    const css =
      '@layer utilities{.transition-colors{transition-property:color;transition-duration:var(--tw-duration,.15s)}.transition-\\[opacity\\,visibility\\],.duration-200{transition-duration:.2s}}';
    expect(await runTwin(css)).toBe(
      '@layer utilities{.transition-colors{transition-property:color;transition-duration:var(--tw-duration,.15s)}.theme-switching .transition-colors{transition:none !important}.transition-\\[opacity\\,visibility\\],.duration-200{transition-duration:.2s}.theme-switching .transition-\\[opacity\\,visibility\\],.theme-switching .duration-200{transition:none !important}}'
    );
  });

  it('leaves rules without a transition alone', async () => {
    const css =
      '.a{color:red}.transition-none{transition-property:none}.b{transition:none}@keyframes k{0%{transition:color 1s}}';
    expect(await runTwin(css)).toBe(css);
  });

  it('puts the class on the root element and keeps nested selectors relative', async () => {
    expect(await runTwin(':root .a,html{transition:color 1s}')).toBe(
      ':root .a,html{transition:color 1s}:root.theme-switching .a,html.theme-switching{transition:none !important}'
    );
    expect(await runTwin('.a{&:hover{transition:color 1s}.b{transition:color 1s}}')).toBe(
      '.a{&:hover{transition:color 1s}.theme-switching &:hover{transition:none !important}.b{transition:color 1s}.theme-switching & .b{transition:none !important}}'
    );
  });
});
