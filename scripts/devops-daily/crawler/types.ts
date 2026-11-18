/**
 * Source tier, used for ranking:
 * 1 = official project blogs and release notes,
 * 2 = engineering blogs and tech news,
 * 3 = vendor marketing blogs.
 */
export type Tier = 1 | 2 | 3;

/**
 * Source configuration from YAML
 */
export interface Source {
  name: string;
  type: 'rss' | 'web';
  url: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  tier?: Tier;
}

/**
 * A project whose releases go into the "Releases" block. A GitHub project
 * is read from its releases Atom feed; `feed` is for PostgreSQL, whose
 * releases are posts in the postgresql.org news feed.
 */
export interface ReleaseSource {
  name: string;
  github?: string;
  feed?: string;
  /** Also list x.y.0 release candidates (Kubernetes, PostgreSQL majors). */
  majorRc?: boolean;
  /** Regex for tags to ignore, such as Prometheus' v0.x Go module tags. */
  skip?: string;
}

/**
 * News item extracted from sources
 */
export interface NewsItem {
  title: string;
  url: string;
  excerpt: string;
  source: string;
  publishedAt: string;
  category?: string;
  tags?: string[];
  summary?: string;
  include?: boolean;
  tier?: Tier;
  score?: number;
}

/**
 * One release entry read from a release feed.
 */
export interface ReleaseEntry {
  project: string;
  version: string;
  url: string;
  publishedAt: string;
}

/**
 * The releases of one project in the digest window, newest first.
 */
export interface ProjectReleases {
  project: string;
  releases: ReleaseEntry[];
}

/**
 * A DevOps Daily post published in the digest window.
 */
export interface OwnPost {
  slug: string;
  title: string;
  publishedAt: string;
}

/**
 * Keyword classification result
 */
export interface Classification {
  include: boolean;
  category: string;
  tags: string[];
  summary: string;
}

/**
 * Sources configuration
 */
export interface SourcesConfig {
  sources: Source[];
  releases?: ReleaseSource[];
}

/**
 * Digest metadata
 */
export interface DigestMetadata {
  title: string;
  date: string;
  week: number;
  year: number;
  summary: string;
}

/**
 * Digest structure
 */
export interface Digest {
  metadata: DigestMetadata;
  topPicks: NewsItem[];
  categories: Record<string, NewsItem[]>;
  releases: ProjectReleases[];
  ownPosts: OwnPost[];
}
