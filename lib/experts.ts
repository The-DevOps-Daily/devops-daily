import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

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
};

export async function getAllExperts(): Promise<Expert[]> {
  try {
    const files = await fs.readdir(EXPERTS_DIR);
    const experts = await Promise.all(
      files
        .filter((f) => f.endsWith('.md'))
        .map(async (filename) => {
          const filePath = path.join(EXPERTS_DIR, filename);
          const file = await fs.readFile(filePath, 'utf-8');
          const { data, content } = matter(file);
          const slug = filename.replace(/\.md$/, '');

          return {
            ...data,
            slug,
            content,
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

    return {
      ...data,
      slug,
      content,
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
