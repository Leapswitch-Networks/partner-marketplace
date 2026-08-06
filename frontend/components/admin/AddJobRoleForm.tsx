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
        <div className="mb-5 flex items-center gap-2 rounded-[5px] border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-brand dark:border-brand/40 dark:bg-brand/20 dark:text-brand-on-dark">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <span>
            Linked to category: <span className="font-semibold">{categoryId}</span>
          </span>
        </div>
      )}

      {isSubmitSuccessful && (
        <div role="status" className="mb-5 rounded-[5px] border border-tone-success/40 bg-tone-success/10 px-4 py-3 text-sm font-medium text-tone-success dark:border-tone-success/50 dark:bg-tone-success/20 dark:text-brand-on-dark">
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
            className={`w-full rounded-[5px] border px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition resize-none
              focus:border-brand focus:ring-2 focus:ring-brand/20
              dark:text-gray-100 dark:placeholder-gray-500
              ${errors.description ? "border-tone-danger/40 bg-tone-danger/10 dark:border-tone-danger/50 dark:bg-tone-danger/15" : "border-surface-border bg-white dark:border-night-border dark:bg-night-card"}`}
            {...register("description")}
          />
          {errors.description && (
            <p className="text-xs text-tone-danger">{errors.description.message}</p>
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
