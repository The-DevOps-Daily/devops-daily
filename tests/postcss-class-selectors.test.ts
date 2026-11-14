import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { classAttributeToClassSelector } from '../postcss.config.mjs';

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
