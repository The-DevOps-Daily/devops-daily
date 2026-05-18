import path from 'path';
import { getAllPosts } from './posts';
import { getAllGuides } from './guides';
import {
  createCachedLoader,
  isFileNotFound,
  readMarkdownFile,
  readMarkdownFiles,
} from './content-loader';

const EXPERTS_DIR = path.join(process.cwd(), 'content', 'experts');

export type Expert = {
  name: string;
  slug: string;
  title?: string;
  bio?: string;
  avatar?: string;
  specialties?: string[];
  availability?: string;
  location?: string;
  rate?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  email?: string;
  content?: string;
  showPosts?: boolean;
  postCount?: number;
  guideCount?: number;
};

async function withExpertCounts(expert: Omit<Expert, 'postCount' | 'guideCount'>): Promise<Expert> {
  const [posts, guides] = await Promise.all([getAllPosts(), getAllGuides()]);
  const postCount = posts.filter((post) => post.author?.slug === expert.slug).length;
  const guideCount = guides.filter((guide) => guide.author?.slug === expert.slug).length;

  return {
    ...expert,
    postCount,
    guideCount,
  };
}

function mapExpert(data: Partial<Expert>, content: string, filename: string) {
  const slug = filename.replace(/\.md$/, '');

  return {
    ...data,
    slug,
    content,
  } as Omit<Expert, 'postCount' | 'guideCount'>;
}

const loadExperts = createCachedLoader(async () => {
  try {
    const experts = await readMarkdownFiles<Omit<Expert, 'postCount' | 'guideCount'>, Partial<Expert>>(
      EXPERTS_DIR,
      mapExpert
    );
    const expertsWithCounts = await Promise.all(experts.map(withExpertCounts));

    return expertsWithCounts.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    if (isFileNotFound(error)) {
      return [];
    }
    throw error;
  }
});

export async function getAllExperts(): Promise<Expert[]> {
  return loadExperts();
}

export async function getExpertBySlug(slug: string): Promise<Expert | null> {
  try {
    const expert = await readMarkdownFile<Omit<Expert, 'postCount' | 'guideCount'>, Partial<Expert>>(
      path.join(EXPERTS_DIR, `${slug}.md`),
      mapExpert
    );
    return withExpertCounts(expert);
  } catch (error) {
    if (isFileNotFound(error)) {
      return null;
    }
    throw error;
  }
}

export async function getExpertsBySpecialty(specialty: string): Promise<Expert[]> {
  const experts = await getAllExperts();
  return experts.filter((expert) =>
    expert.specialties?.some((s) => s.toLowerCase() === specialty.toLowerCase())
  );
}

export function getAllSpecialties(experts: Expert[]): string[] {
  const specialtiesSet = new Set<string>();
  experts.forEach((expert) => {
    expert.specialties?.forEach((specialty) => specialtiesSet.add(specialty));
  });
  return Array.from(specialtiesSet).sort();
}

export async function getPostsByExpert(expertSlug: string) {
  const posts = await getAllPosts();
  return posts.filter((post) => post.author?.slug === expertSlug);
}

export async function getGuidesByExpert(expertSlug: string) {
  const guides = await getAllGuides();
  return guides.filter((guide) => guide.author?.slug === expertSlug);
}
