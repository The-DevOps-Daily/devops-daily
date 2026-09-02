import grayMatter from 'gray-matter';

// gray-matter picks its parser from the text after the opening `---`, and its
// `js`/`javascript`/`coffee` engines are eval(). Content arrives through pull
// requests and is parsed on CI and on maintainer machines, so every caller in
// the repo goes through this wrapper, which accepts YAML and JSON only.
const noCodeEngine = {
  parse(): never {
    throw new Error('Code front matter (---js, ---coffee) is not allowed');
  },
};

const SAFE_ENGINES = {
  js: noCodeEngine,
  javascript: noCodeEngine,
  coffee: noCodeEngine,
  coffeescript: noCodeEngine,
  cson: noCodeEngine,
};

export function parseFrontMatter(raw: string) {
  return grayMatter(raw, { engines: SAFE_ENGINES });
}

export default parseFrontMatter;
