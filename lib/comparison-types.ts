export interface ToolInfo {
  name: string;
  icon: string;
  website: string;
  description: string;
  color: string;
  pros: string[];
  cons: string[];
}

export interface FeatureRating {
  value: string;
  rating: "good" | "neutral" | "bad";
}

export interface FeatureComparison {
  name: string;
  category: string;
  toolA: FeatureRating;
  toolB: FeatureRating;
}

export interface UseCase {
  scenario: string;
  recommendation: "toolA" | "toolB" | "either";
  explanation: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface DecisionMatrixItem {
  criteria: string;
  recommendation: "toolA" | "toolB" | "either";
}

export interface Verdict {
  summary: string;
  toolAScore: number;
  toolBScore: number;
  recommendation: string;
}

export interface Comparison {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  createdDate: string;
  updatedDate: string;
  estimatedReadTime: string;
  introduction: string;
  toolA: ToolInfo;
  toolB: ToolInfo;
  features: FeatureComparison[];
  useCases: UseCase[];
  faqs: FAQ[];
  decisionMatrix: DecisionMatrixItem[];
  verdict: Verdict;
  relatedTags: string[];
}
