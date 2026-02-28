'use client';

import { InterviewQuestion, ExperienceTier } from '@/lib/interview-utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CodeBlock } from '@/components/code-block';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Lightbulb, AlertTriangle, Tag } from 'lucide-react';

interface InterviewQuestionPageProps {
  question: InterviewQuestion;
  tier: ExperienceTier;
}

const tierColors = {
  junior: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  mid: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
  senior: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
};

const difficultyColors = {
  beginner: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400',
  intermediate: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
  advanced: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
};

export function InterviewQuestionPage({ question, tier }: InterviewQuestionPageProps) {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Back button */}
      <div className="mb-6">
        <Button variant="ghost" asChild className="-ml-4">
          <Link href={`/interview-questions/${tier}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to {tier} questions
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge className={tierColors[tier]}>{tier}</Badge>
          <Badge className={difficultyColors[question.difficulty as keyof typeof difficultyColors]}>
            {question.difficulty}
          </Badge>
          <Badge variant="outline">{question.category}</Badge>
        </div>
        <h1 className="text-4xl font-bold mb-4">{question.title}</h1>
      </div>

      {/* Question */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-xl">Question</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg leading-relaxed">{question.question}</p>
        </CardContent>
      </Card>

      {/* Answer */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-xl">Answer</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="leading-relaxed whitespace-pre-line">{question.answer}</p>
        </CardContent>
      </Card>

      {/* Explanation */}
      {question.explanation && (
        <Card className="mb-6 border-blue-200 dark:border-blue-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Lightbulb className="w-5 h-5 text-blue-500" />
              Why This Matters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="leading-relaxed">{question.explanation}</p>
          </CardContent>
        </Card>
      )}

      {/* Code Examples */}
      {question.codeExamples && question.codeExamples.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-xl">Code Examples</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {question.codeExamples.map((example, index) => (
              <div key={index}>
                {example.label && (
                  <p className="text-sm font-medium mb-2 text-muted-foreground">{example.label}</p>
                )}
                <CodeBlock code={example.code} language={example.language} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Common Mistakes */}
      {question.commonMistakes && question.commonMistakes.length > 0 && (
        <Card className="mb-6 border-orange-200 dark:border-orange-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Common Mistakes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2">
              {question.commonMistakes.map((mistake, index) => (
                <li key={index} className="leading-relaxed">
                  {mistake}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Follow-up Questions */}
      {question.followUpQuestions && question.followUpQuestions.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <BookOpen className="w-5 h-5" />
              Follow-up Questions
            </CardTitle>
            <CardDescription>
              Interviewers often ask these as follow-up questions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2">
              {question.followUpQuestions.map((followUp, index) => (
                <li key={index} className="leading-relaxed">
                  {followUp}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Tags */}
      {question.tags && question.tags.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Tag className="w-5 h-5" />
              Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {question.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="mt-8 flex justify-center">
        <Button asChild>
          <Link href={`/interview-questions/${tier}`}>
            View all {tier} questions
          </Link>
        </Button>
      </div>
    </div>
  );
}
