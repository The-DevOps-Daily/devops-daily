import path from 'path';
import { createCachedLoader, isFileNotFound, readJsonFile, readJsonFiles } from './content-loader';

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

const loadFlashCardSets = createCachedLoader(() => readJsonFiles<FlashCardSet>(FLASHCARDS_DIR));

/**
 * Load a single flashcard set by ID
 */
export async function getFlashCardSet(id: string): Promise<FlashCardSet | null> {
  try {
    return await readJsonFile<FlashCardSet>(path.join(FLASHCARDS_DIR, `${id}.json`));
  } catch (error) {
    if (isFileNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/**
 * Get metadata for all flashcard sets (without full card data)
 */
export async function getAllFlashCardSets(): Promise<FlashCardSetMetadata[]> {
  const sets = await loadFlashCardSets();
  return sets
    .map((flashCardSet) => ({
      id: flashCardSet.id,
      title: flashCardSet.title,
      description: flashCardSet.description,
      category: flashCardSet.category,
      icon: flashCardSet.icon,
      difficulty: flashCardSet.difficulty,
      estimatedTime: flashCardSet.estimatedTime,
      cardCount: flashCardSet.cardCount,
      theme: flashCardSet.theme,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Get all unique categories from flashcard sets
 */
export async function getFlashCardCategories(): Promise<string[]> {
  const metadata = await getAllFlashCardSets();
  const categories = [...new Set(metadata.map((set) => set.category))];
  return categories.sort();
}
