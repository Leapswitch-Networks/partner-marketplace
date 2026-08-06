"use client";

type QuestionType = "mcq" | "true_false" | "descriptive";

interface SelectQuestionTypeProps {
  onSelect: (type: QuestionType) => void;
}

const types: {
  id: QuestionType;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "mcq",
    label: "Multiple Choice (MCQ)",
    description: "Candidate selects one correct answer from 4 options. Marks are awarded per correct selection.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "true_false",
    label: "True / False",
    description: "Candidate selects True or False for a given statement. Best for conceptual verification.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
      </svg>
    ),
  },
  {
    id: "descriptive",
    label: "Descriptive",
    description: "Candidate writes a free-text response. Useful for subjective or open-ended questions.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
      </svg>
    ),
  },
];

export default function SelectQuestionType({ onSelect }: SelectQuestionTypeProps) {
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Select Question Type</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Choose the format of the question you want to add to the test.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-1">
        {types.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => onSelect(type.id)}
            className="group flex items-start gap-4 rounded-[5px] border-2 border-surface-border bg-white p-5 text-left transition-all duration-150 hover:border-brand hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand/30 dark:border-night-border dark:bg-night-card dark:hover:border-brand/40"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[5px] bg-brand/10 text-brand dark:text-brand-on-dark transition-colors group-hover:bg-brand group-hover:text-white dark:bg-brand/20 dark:text-brand-on-dark">
              {type.icon}
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-brand transition-colors dark:text-gray-100 dark:group-hover:text-brand-on-dark">
                {type.label}
              </p>
              <p className="mt-1 text-sm text-gray-500 leading-relaxed dark:text-gray-400">
                {type.description}
              </p>
            </div>
            <svg
              className="ml-auto mt-0.5 h-5 w-5 shrink-0 text-gray-300 transition-colors group-hover:text-brand dark:text-gray-600 dark:group-hover:text-brand-on-dark"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
