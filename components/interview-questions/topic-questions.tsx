'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { InterviewQuestion } from '@/lib/interview-utils';
import { QuestionPractice } from './question-practice';
import { ShareButton } from './share-button';

interface TopicQuestionsProps {
  questions: InterviewQuestion[];
}

export function TopicQuestions({ questions }: TopicQuestionsProps) {
  const [showAll, setShowAll] = useState(false);

  return (
    <div className="min-w-0 break-words">
      <div className="mb-4 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAll((value) => !value)}
          aria-pressed={showAll}
        >
          {showAll ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
          {showAll ? 'Hide all answers' : 'Show all answers'}
        </Button>
      </div>

      <div className="space-y-10">
        {questions.map((question) => (
          <section key={question.id} id={question.slug} className="scroll-mt-24 min-w-0">
            <QuestionPractice
              question={question}
              showTitle
              showCategory={false}
              showTier
              startRevealed={showAll}
            />
            <div className="mt-3 flex justify-end">
              <ShareButton title={question.title} anchor={question.slug} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
