"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";

const schema = z.object({
  name: z.string().min(2, "Section name must be at least 2 characters"),
  description: z.string().min(5, "Description is required"),
  duration: z.string().min(1, "Duration is required"),
  totalMarks: z.string().min(1, "Total marks are required"),
});

type FormValues = z.infer<typeof schema>;

export default function AddTestSectionForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    // TODO: call adminApi.createTestSection(data)
    console.log("Add Test Section:", data);
    reset();
  };

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Add Test Section</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Create a new section to organise questions within a test.
        </p>
      </div>

      {isSubmitSuccessful && (
        <div role="status" className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400">
          Test section added successfully.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Input
          label="Section Name"
          type="text"
          placeholder="e.g. Logical Reasoning"
          error={errors.name?.message}
          {...register("name")}
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
          <textarea
            rows={3}
            placeholder="Briefly describe what this section covers..."
            className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition resize-none
              focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20
              dark:text-gray-100 dark:placeholder-gray-500
              ${errors.description ? "border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950/30" : "border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-800"}`}
            {...register("description")}
          />
          {errors.description && (
            <p className="text-xs text-red-500">{errors.description.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Duration (minutes)"
            type="number"
            placeholder="e.g. 30"
            error={errors.duration?.message}
            {...register("duration")}
          />
          <Input
            label="Total Marks"
            type="number"
            placeholder="e.g. 50"
            error={errors.totalMarks?.message}
            {...register("totalMarks")}
          />
        </div>

        <div className="pt-2">
          <Button type="submit" loading={isSubmitting}>
            Save Section
          </Button>
        </div>
      </form>
    </div>
  );
}
