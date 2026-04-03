import { getAllPosts } from '@/lib/posts';
import { getAllCategories } from '@/lib/categories';
import { getAllGuides } from '@/lib/guides';
import { getAllExercises } from '@/lib/exercises';
import { getQuizMetadata } from '@/lib/quiz-loader';
import { getAllAdventDays } from '@/lib/advent';
import { getAllNews } from '@/lib/news';
import { getActiveGames } from '@/lib/games';
import { getAllFlashCardSets } from '@/lib/flashcard-loader';
import { getAllChecklists } from '@/lib/checklists';
import { interviewQuestions } from '@/content/interview-questions';
import { getAllComparisons } from '@/lib/comparisons';

export const dynamic = 'force-static';

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://devops-daily.com';

  const [posts, categories, guides, exercises, quizzes, adventDays, news, games, flashcards, checklists] =
    await Promise.all([
      getAllPosts(),
      getAllCategories(),
      getAllGuides(),
      getAllExercises(),
      getQuizMetadata(),
      getAllAdventDays(),
      getAllNews(),
      getActiveGames(),
      getAllFlashCardSets(),
      getAllChecklists(),
    ]);

  const md = `# DevOps Daily

> DevOps Daily is an educational platform providing tutorials, guides, exercises, quizzes, and news for DevOps engineers. Content covers Docker, Kubernetes, Terraform, CI/CD, Linux, AWS, Git, Python, and more.

- Last updated: ${new Date().toISOString().split('T')[0]}
- Content: ${posts.length} posts, ${guides.length} guides, ${exercises.length} exercises, ${quizzes.length} quizzes, ${flashcards.length} flashcard decks, ${checklists.length} checklists, ${interviewQuestions.length} interview questions, ${games.length} interactive simulators
- License: Open source (GitHub)
- Contact: info@devops-daily.com

## Pages

- [Home](${baseUrl}): DevOps tutorials, guides, exercises, and weekly news
- [Posts](${baseUrl}/posts): ${posts.length}+ technical articles on DevOps tools and practices
- [Guides](${baseUrl}/guides): Multi-part comprehensive learning resources
- [Exercises](${baseUrl}/exercises): Hands-on labs with step-by-step instructions
- [Quizzes](${baseUrl}/quizzes): Test your DevOps knowledge with interactive quizzes
- [Flashcards](${baseUrl}/flashcards): Review key concepts with spaced-repetition flashcards
- [Checklists](${baseUrl}/checklists): Actionable security and best-practice checklists
- [Interview Questions](${baseUrl}/interview-questions): DevOps interview prep for junior to senior
- [News](${baseUrl}/news): Weekly curated DevOps news digests
- [Games](${baseUrl}/games): ${games.length}+ interactive DevOps simulators and learning tools
- [Roadmap](${baseUrl}/roadmap): DevOps learning path from beginner to expert
- [Roadmaps](${baseUrl}/roadmaps): Structured learning paths (Junior, DevSecOps)
- [Books](${baseUrl}/books): Curated DevOps book recommendations
- [DevOps Survival Guide](${baseUrl}/books/devops-survival-guide): Free DevOps learning resource
- [About](${baseUrl}/about): About DevOps Daily
- [Editorial Standards](${baseUrl}/editorial): Our editorial and correction policy

## Categories

${categories.map((c) => `- [${c.name}](${baseUrl}/categories/${c.slug}): ${c.description || `Articles and guides about ${c.name}`}`).join('\n')}

## Guides

${guides.map((g) => `- [${g.title}](${baseUrl}/guides/${g.slug}): ${g.description || ''} (${g.partsCount} parts)`).join('\n')}

## Posts

${posts.map((p) => `- [${p.title}](${baseUrl}/posts/${p.slug}.md): ${p.excerpt || ''}`).join('\n')}

## Exercises

${exercises.map((e) => `- [${e.title}](${baseUrl}/exercises/${e.id}): ${e.description} (${e.difficulty}, ${e.estimatedTime})`).join('\n')}

## Quizzes

${quizzes.map((q) => `- [${q.title}](${baseUrl}/quizzes/${q.id}): ${q.description || ''}`).join('\n')}

## Flashcards

${flashcards.map((f) => `- [${f.title}](${baseUrl}/flashcards/${f.id}): ${f.description || ''} (${f.cardCount} cards)`).join('\n')}

## Checklists

${checklists.map((c) => `- [${c.title}](${baseUrl}/checklists/${c.slug}): ${c.description || ''}`).join('\n')}

## Interview Questions

${interviewQuestions.map((q) => `- [${q.title}](${baseUrl}/interview-questions/${q.tier}/${q.slug}): ${q.question}`).join('\n')}

## Interactive Simulators & Games

${games.map((g) => `- [${g.title}](${baseUrl}${g.href}): ${g.description}`).join('\n')}

## News Digests

${news.slice(0, 12).map((n) => `- [${n.title}](${baseUrl}/news/${n.slug}): ${n.summary || n.excerpt || ''}`).join('\n')}

## Advent of DevOps

${adventDays.map((d) => `- [Day ${d.day}: ${d.title}](${baseUrl}/advent-of-devops/${d.slug}.md): ${d.excerpt || d.description || ''}`).join('\n')}
`;

  return new Response(md, { headers: { 'Content-Type': 'text/plain' } });
}
