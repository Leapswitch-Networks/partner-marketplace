"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";

const schema = z.object({
  title: z.string().min(2, "Job role title must be at least 2 characters"),
  department: z.string().min(2, "Department is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
});

type FormValues = z.infer<typeof schema>;

interface AddJobRoleFormProps {
  categoryId?: string;
}

export default function AddJobRoleForm({ categoryId }: AddJobRoleFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    // TODO: call adminApi.createJobRole({ ...data, category_id: categoryId })
    void data;
    reset();
  };

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Add Job Role</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Define a new job role that will be associated with tests.
        </p>
      </div>

      {categoryId && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-400">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <span>
            Linked to category: <span className="font-semibold">{categoryId}</span>
          </span>
        </div>
      )}

      {isSubmitSuccessful && (
        <div role="status" className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400">
          Job role added successfully.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Input
          label="Job Role Title"
          type="text"
          placeholder="e.g. Software Engineer"
          error={errors.title?.message}
          {...register("title")}
        />

        <Input
          label="Department"
          type="text"
          placeholder="e.g. Engineering"
          error={errors.department?.message}
          {...register("department")}
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
          <textarea
            rows={4}
            placeholder="Briefly describe this job role and its responsibilities..."
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

        <div className="pt-2">
          <Button type="submit" loading={isSubmitting}>
            Save Job Role
          </Button>
        </div>
      </form>
    </div>
  );
}
