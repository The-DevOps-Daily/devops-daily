/**
 * @tailwindcss/typography writes `[class~="not-prose"]` where it means
 * `.not-prose`. Both match the same elements, but Chrome restyles the whole
 * subtree of an element on any class change while an attribute selector on
 * `class` sits before a descendant combinator. That made every className
 * update, such as opening the mobile menu, restyle all of its children.
 */
export const classAttributeToClassSelector = () => ({
  postcssPlugin: 'class-attribute-to-class-selector',
  OnceExit(root) {
    root.walkRules((rule) => {
      if (!rule.selector.includes('[class~=')) return;
      rule.selector = rule.selector.replace(
        /\[class~=(["']?)(-?[_a-zA-Z][\w-]*)\1\]/g,
        (_, _quote, name) => `.${name}`
      );
    });
  },
});
classAttributeToClassSelector.postcss = true;

const TRANSITION_PROP = /^(-webkit-)?transition(-property|-duration|-delay)?$/;
const NO_TRANSITION = /^(none|0m?s|0)$/;

/**
 * Gives every rule that sets a transition a twin that turns it off while
 * <html> has `theme-switching` (components/theme-provider.tsx), so a theme
 * switch does not fade colours. next-themes' disableTransitionOnChange does
 * this with a `*` style sheet instead, which restyles every element once more
 * when it is removed; taking the class off restyles only these elements.
 */
export const noTransitionsWhileThemeSwitches = () => ({
  postcssPlugin: 'no-transitions-while-theme-switches',
  OnceExit(root) {
    root.walkRules((rule) => {
      let nested = false;
      for (let p = rule.parent; p && p.type !== 'root'; p = p.parent) {
        if (p.type === 'rule') nested = true;
        if (p.type === 'atrule' && /keyframes$/i.test(p.name)) return;
      }
      const sets = rule.nodes?.some(
        (n) =>
          n.type === 'decl' && TRANSITION_PROP.test(n.prop) && !NO_TRANSITION.test(n.value.trim())
      );
      if (!sets) return;
      const selectors = rule.selectors.map((s) => {
        if (nested) return s.includes('&') ? `.theme-switching ${s}` : `.theme-switching & ${s}`;
        const top = s.match(/^(html|:root)(?![\w-])/);
        return top ? `${top[0]}.theme-switching${s.slice(top[0].length)}` : `.theme-switching ${s}`;
      });
      const twin = rule.clone();
      twin.removeAll();
      twin.selectors = selectors;
      twin.append({ prop: 'transition', value: 'none', important: true });
      rule.after(twin);
    });
  },
});
noTransitionsWhileThemeSwitches.postcss = true;

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: [
    '@tailwindcss/postcss',
    classAttributeToClassSelector(),
    noTransitionsWhileThemeSwitches(),
  ],
};

export default config;
