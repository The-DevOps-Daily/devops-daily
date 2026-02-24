import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { getAllPosts } from './posts';
import { getAllGuides } from './guides';

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

export async function getAllExperts(): Promise<Expert[]> {
  try {
    const files = await fs.readdir(EXPERTS_DIR);
    const [posts, guides] = await Promise.all([getAllPosts(), getAllGuides()]);

    const experts = await Promise.all(
      files
        .filter((f) => f.endsWith('.md'))
        .map(async (filename) => {
          const filePath = path.join(EXPERTS_DIR, filename);
          const file = await fs.readFile(filePath, 'utf-8');
          const { data, content } = matter(file);
          const slug = filename.replace(/\.md$/, '');

          const postCount = posts.filter((post) => post.author?.slug === slug).length;
          const guideCount = guides.filter((guide) => guide.author?.slug === slug).length;

          return {
            ...data,
            slug,
            content,
            postCount,
            guideCount,
          } as Expert;
        })
    );

    return experts.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.warn('Error reading experts directory:', error);
    return [];
  }
}

export async function getExpertBySlug(slug: string): Promise<Expert | null> {
  const filePath = path.join(EXPERTS_DIR, `${slug}.md`);
  try {
    const file = await fs.readFile(filePath, 'utf-8');
    const { data, content } = matter(file);

    const [posts, guides] = await Promise.all([getAllPosts(), getAllGuides()]);
    const postCount = posts.filter((post) => post.author?.slug === slug).length;
    const guideCount = guides.filter((guide) => guide.author?.slug === slug).length;

    return {
      ...data,
      slug,
      content,
      postCount,
      guideCount,
    } as Expert;
  } catch {
    return null;
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
