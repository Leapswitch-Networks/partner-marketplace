import { memo, useCallback } from "react";
import type { Test } from "@/types";
import Button from "@/components/common/Button";

interface TestCardProps {
  test: Test;
  onStart: (test: Test) => void;
}

function TestCard({ test, onStart }: TestCardProps) {
  const handleStart = useCallback(() => onStart(test), [onStart, test]);

  return (
    <article className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md sm:p-6">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="truncate text-base font-semibold text-gray-900 sm:text-lg">
            {test.title}
          </h3>
          <span className="mt-1 inline-block rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-[#F97316]">
            {test.category}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="mt-3 line-clamp-2 text-sm text-gray-500">{test.description}</p>

      {/* Stats row */}
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <ClockIcon />
          {test.duration_minutes} min
        </span>
        <span className="flex items-center gap-1">
          <QuestionIcon />
          {test.total_questions} questions
        </span>
      </div>

      {/* CTA */}
      <div className="mt-5 pt-4 border-t border-gray-100">
        <Button fullWidth onClick={handleStart}>
          View Test
        </Button>
      </div>
    </article>
  );
}

function ClockIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" d="M12 6v6l4 2" />
    </svg>
  );
}

function QuestionIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export default memo(TestCard);
