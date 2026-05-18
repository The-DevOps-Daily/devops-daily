// Audits every URL in the Bing report against the rendered meta description
// (after truncateMetaDescription is applied, matching production).

import { readFileSync, existsSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';

// Inline copy of lib/meta-description.ts (the post-fix version).
function truncateMetaDescription(text, maxLength = 155) {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  const sentenceFloor = Math.floor(maxLength * 0.7);
  const slice = trimmed.slice(0, maxLength + 1);
  const sentenceEnd = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
  );
  if (sentenceEnd >= sentenceFloor) {
    return trimmed.slice(0, sentenceEnd + 1);
  }
  const wordEnd = slice.lastIndexOf(' ');
  if (wordEnd > 0) {
    return trimmed.slice(0, wordEnd).replace(/[,;:.\s]+$/, '') + '...';
  }
  return trimmed.slice(0, maxLength - 3) + '...';
}

const ROOT = process.cwd();

const URLS = [
  "comparisons/github-vs-gitlab",
  "posts/capturing-mobile-phone-traffic-on-wireshark",
  "posts/using-ssh-keys-in-docker-container",
  "comparisons/selenium-vs-playwright",
  "games/deployment-strategies",
  "comparisons/gitlab-ci-vs-github-actions",
  "posts/network-tools-that-simulate-slow-network-connection",
  "posts/dependency-scanning-guide",
  "posts/right-sizing-kubernetes-resources-vpa-karpenter",
  "comparisons/argocd-vs-flux",
  "comparisons/consul-vs-etcd",
  "posts/docker-rename-image-repository",
  "posts/set-image-name-dockerfile",
  "posts/docker-compose-always-recreate-containers",
  "comparisons/argocd-vs-jenkins-x",
  "comparisons/helm-vs-kustomize",
  "posts/3-infrastructure-decisions-engineering-velocity",
  "posts/increasing-the-maximum-number-of-tcp-ip-connections-in-linux",
  "posts/vagrant-vs-docker-for-isolated-environments",
  "interview-questions/senior/disaster-recovery-planning",
  "guides/introduction-to-packer/01-packer-fundamentals",
  "categories/git",
  "posts/how-i-finally-understood-docker-and-kubernetes",
  "guides/introduction-to-linux",
  "tools/cidr-calculator",
  "newsletters/2026-week-17",
  "posts/terraform-refresh-explained",
  "categories",
  "tools/cron-parser",
  "categories/kubernetes",
  "posts/how-does-it-work-so-fast",
  "tools/jwt-decoder",
  "newsletters/2026-week-14",
  "newsletters/2026-week-15",
  "categories/devops",
  "guides/introduction-to-git/07-collaboration",
  "comparisons/aws-lambda-vs-google-cloud-functions",
  "guides/introduction-to-git/04-branching",
  "guides/introduction-to-docker/02-docker-installation",
  "categories/terraform",
  "guides/introduction-to-kubernetes/01-kubernetes-architecture-and-components",
  "comparisons/istio-vs-linkerd",
  "guides/security-gates/02-vulnerability-gates",
  "flashcards/docker-essentials",
  "games/git-quiz",
  "guides/introduction-to-bash/02-bash-basics",
  "checklists/cicd-pipeline-setup",
  "guides/introduction-to-docker/08-docker-compose",
  "guides/introduction-to-docker/06-working-with-docker-volumes",
  "exercises/ci-cd-github-actions",
];

function readMd(file) {
  if (!existsSync(file)) return null;
  const raw = readFileSync(file, 'utf8');
  const { data } = matter(raw);
  return data;
}

function readJson(file) {
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8'));
}

function lookup(urlPath) {
  const segs = urlPath.split('/').filter(Boolean);
  if (segs[0] === 'posts') {
    const file = path.join(ROOT, 'content/posts', segs[1] + '.md');
    const fm = readMd(file);
    return { source: file, description: fm?.excerpt || fm?.description || null };
  }
  if (segs[0] === 'comparisons') {
    const file = path.join(ROOT, 'content/comparisons', segs[1] + '.json');
    const obj = readJson(file);
    return { source: file, description: obj?.description || null };
  }
  if (segs[0] === 'categories') {
    if (segs.length === 1) {
      return { source: 'app/categories/page.tsx (Next metadata)', description: '<inline-in-app>' };
    }
    const file = path.join(ROOT, 'content/categories', segs[1] + '.md');
    const fm = readMd(file);
    // Category meta tag uses longDescription (with description fallback) per
    // app/categories/[slug]/page.tsx.
    return { source: file, description: fm?.longDescription || fm?.description || fm?.excerpt || null };
  }
  if (segs[0] === 'newsletters') {
    const file = path.join(ROOT, 'content/newsletters', segs[1] + '.md');
    const fm = readMd(file);
    return { source: file, description: fm?.excerpt || fm?.description || null };
  }
  if (segs[0] === 'guides') {
    if (segs.length === 2) {
      // index page of a guide
      const file = path.join(ROOT, 'content/guides', segs[1], 'index.md');
      const fm = readMd(file);
      return { source: file, description: fm?.description || fm?.excerpt || null };
    }
    const file = path.join(ROOT, 'content/guides', segs[1], segs[2] + '.md');
    const fm = readMd(file);
    return { source: file, description: fm?.description || fm?.excerpt || null };
  }
  if (segs[0] === 'interview-questions') {
    // /interview-questions/<level>/<slug>
    const file = path.join(ROOT, 'content/interview-questions', segs[1], segs[2] + '.md');
    const fm = readMd(file);
    return { source: file, description: fm?.description || fm?.excerpt || null };
  }
  if (segs[0] === 'tools') {
    return { source: `app/tools/${segs[1]}/page.tsx (Next metadata)`, description: '<inline-in-app>' };
  }
  if (segs[0] === 'games') {
    return { source: `app/games/${segs[1]}/page.tsx (Next metadata)`, description: '<inline-in-app>' };
  }
  if (segs[0] === 'flashcards') {
    const file = path.join(ROOT, 'content/flashcards', segs[1] + '.json');
    const obj = readJson(file);
    return { source: file, description: obj?.description || null };
  }
  if (segs[0] === 'checklists') {
    const file = path.join(ROOT, 'content/checklists', segs[1] + '.json');
    const obj = readJson(file);
    return { source: file, description: obj?.description || null };
  }
  if (segs[0] === 'exercises') {
    const file = path.join(ROOT, 'content/exercises', segs[1] + '.md');
    const fm = readMd(file);
    return { source: file, description: fm?.description || fm?.excerpt || null };
  }
  return { source: 'unknown', description: null };
}

const THRESHOLD = 120;
const TOTAL = URLS.length;
let short = 0;
let inline = 0;
let missing = 0;
const results = [];

for (const url of URLS) {
  const r = lookup(url);
  if (!r.description) {
    missing++;
    results.push({ url, source: r.source, length: 0, description: '<NONE>' });
  } else if (r.description === '<inline-in-app>') {
    inline++;
    results.push({ url, source: r.source, length: -1, description: '<inline>' });
  } else {
    const rendered = truncateMetaDescription(r.description);
    const len = rendered.length;
    if (len < THRESHOLD) short++;
    results.push({ url, source: r.source, length: len, description: rendered, sourceLen: r.description.length });
  }
}

results.sort((a, b) => a.length - b.length);

console.log(`Audited ${TOTAL} URLs. Short (<${THRESHOLD}): ${short}. Inline-in-app pages: ${inline}. Missing description: ${missing}.\n`);

for (const r of results) {
  console.log(`[${String(r.length).padStart(4)}] ${r.url}`);
  console.log(`         src: ${r.source}`);
  if (r.length >= 0) console.log(`         desc: ${r.description.slice(0, 200)}`);
  console.log('');
}
