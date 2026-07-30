"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";

type QuestionType = "mcq" | "true_false" | "descriptive";

const schema = z.object({
  type: z.enum(["mcq", "true_false", "descriptive"]),
  text: z.string().min(5, "Question text must be at least 5 characters"),
  category: z.string().min(2, "Category is required"),
  difficulty: z.enum(["easy", "medium", "hard"]),
  marks: z.coerce.number().min(1, "Marks must be at least 1"),
  explanation: z.string().optional(),
  correctAnswer: z.string().optional(),
  options: z
    .array(z.object({ label: z.string(), text: z.string() }))
    .optional(),
});

type FormValues = z.infer<typeof schema>;

interface AddQuestionFormProps {
  initialType?: QuestionType;
}

const DIFFICULTY_OPTIONS = [
  { value: "easy" as const, label: "Easy" },
  { value: "medium" as const, label: "Medium" },
  { value: "hard" as const, label: "Hard" },
];

export default function AddQuestionForm({ initialType = "mcq" }: AddQuestionFormProps) {
  const [qType, setQType] = useState<QuestionType>(initialType);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: initialType,
      difficulty: "medium",
      marks: 1,
      options: [
        { label: "A", text: "" },
        { label: "B", text: "" },
        { label: "C", text: "" },
        { label: "D", text: "" },
      ],
    },
  });

  const { fields } = useFieldArray({ control, name: "options" });

  const onSubmit = async (data: FormValues) => {
    // TODO: call adminApi.createQuestion(data)
    console.log("Add Question:", data);
    reset();
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Add Question</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Fill in the details below to add a new question to the test bank.
        </p>
      </div>

      {isSubmitSuccessful && (
        <div role="status" className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400">
          Question added successfully.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {/* Question Type selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Question Type</label>
          <div className="flex gap-2">
            {(["mcq", "true_false", "descriptive"] as QuestionType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setQType(t)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all
                  ${qType === t
                    ? "border-[#F97316] bg-orange-50 text-[#F97316] dark:bg-orange-950/30 dark:text-orange-400"
                    : "border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300"
                  }`}
              >
                {t === "mcq" ? "MCQ" : t === "true_false" ? "True / False" : "Descriptive"}
              </button>
            ))}
          </div>
          <input type="hidden" value={qType} {...register("type")} />
        </div>

        {/* Question text */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Question Text</label>
          <textarea
            rows={3}
            placeholder="Write the question here..."
            className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition resize-none dark:text-gray-100 dark:placeholder-gray-500
              focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20
              ${errors.text ? "border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950/30" : "border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-800"}`}
            {...register("text")}
          />
          {errors.text && <p className="text-xs text-red-500">{errors.text.message}</p>}
        </div>

        {/* MCQ options */}
        {qType === "mcq" && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Answer Options</label>
            {fields.map((field, i) => (
              <div key={field.id} className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                  {field.label}
                </span>
                <input
                  type="text"
                  placeholder={`Option ${field.label}`}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                  {...register(`options.${i}.text`)}
                />
              </div>
            ))}
            <Input
              label="Correct Answer (A / B / C / D)"
              type="text"
              placeholder="e.g. A"
              error={errors.correctAnswer?.message}
              {...register("correctAnswer")}
            />
          </div>
        )}

        {/* True/False correct answer */}
        {qType === "true_false" && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Correct Answer</label>
            <div className="flex gap-4">
              {["True", "False"].map((val) => (
                <label key={val} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value={val} className="accent-[#F97316]" {...register("correctAnswer")} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{val}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Category + difficulty + marks */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="Category"
            type="text"
            placeholder="e.g. Logical"
            error={errors.category?.message}
            {...register("category")}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Difficulty</label>
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              {...register("difficulty")}
            >
              {DIFFICULTY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <Input
            label="Marks"
            type="number"
            placeholder="1"
            error={errors.marks?.message}
            {...register("marks")}
          />
        </div>

        {/* Explanation */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Explanation <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="Explain the correct answer..."
            className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition resize-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
            {...register("explanation")}
          />
        </div>

        <div className="pt-2">
          <Button type="submit" loading={isSubmitting}>
            Save Question
          </Button>
        </div>
      </form>
    </div>
  );
}
