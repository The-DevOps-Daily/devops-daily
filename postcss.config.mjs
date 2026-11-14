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

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: ['@tailwindcss/postcss', classAttributeToClassSelector()],
};

export default config;
