import fs from 'fs';
import path from 'path';

export interface FlashCard {
  id: string;
  front: string;
  back: string;
  category: string;
  tags: string[];
}

export interface FlashCardSet {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  cardCount: number;
  theme: {
    primaryColor: string;
    gradientFrom: string;
    gradientTo: string;
  };
  cards: FlashCard[];
}

export interface FlashCardSetMetadata {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  cardCount: number;
  theme: {
    primaryColor: string;
    gradientFrom: string;
    gradientTo: string;
  };
}

const FLASHCARDS_DIR = path.join(process.cwd(), 'content', 'flashcards');

/**
 * Load a single flashcard set by ID
 */
export async function getFlashCardSet(id: string): Promise<FlashCardSet | null> {
  try {
    const filePath = path.join(FLASHCARDS_DIR, `${id}.json`);
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const flashCardSet: FlashCardSet = JSON.parse(fileContents);
    return flashCardSet;
  } catch (error) {
    console.error(`Failed to load flashcard set: ${id}`, error);
    return null;
  }
}

/**
 * Get metadata for all flashcard sets (without full card data)
 */
export async function getFlashCardSetsMetadata(): Promise<FlashCardSetMetadata[]> {
  try {
    if (!fs.existsSync(FLASHCARDS_DIR)) {
      return [];
    }

    const files = fs.readdirSync(FLASHCARDS_DIR).filter((file) => file.endsWith('.json'));

    const metadata: FlashCardSetMetadata[] = [];

    for (const file of files) {
      const filePath = path.join(FLASHCARDS_DIR, file);
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const flashCardSet: FlashCardSet = JSON.parse(fileContents);

      // Extract metadata (exclude cards)
      metadata.push({
        id: flashCardSet.id,
        title: flashCardSet.title,
        description: flashCardSet.description,
        category: flashCardSet.category,
        icon: flashCardSet.icon,
        difficulty: flashCardSet.difficulty,
        estimatedTime: flashCardSet.estimatedTime,
        cardCount: flashCardSet.cardCount,
        theme: flashCardSet.theme,
      });
    }

    // Sort by title
    metadata.sort((a, b) => a.title.localeCompare(b.title));

    return metadata;
  } catch (error) {
    console.error('Failed to load flashcard sets metadata', error);
    return [];
  }
}

/**
 * Get all unique categories from flashcard sets
 */
export async function getFlashCardCategories(): Promise<string[]> {
  const metadata = await getFlashCardSetsMetadata();
  const categories = [...new Set(metadata.map((set) => set.category))];
  return categories.sort();
}
