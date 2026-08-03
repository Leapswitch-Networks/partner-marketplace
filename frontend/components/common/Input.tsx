import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  /** Helper text under the field. Hidden while an `error` is showing, so the
   *  two never stack and compete for the same spot. */
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className = "", ...props }, ref) => {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1">
        {/* An empty label is a deliberate opt-out for filter bars, where the
            placeholder carries the meaning and a visible label wastes a row. */}
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition
            focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20
            dark:text-gray-100 dark:placeholder-gray-500
            ${error ? "border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950/30" : "border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-800"}
            ${className}`}
          {...props}
        />
        {error ? (
          <p className="text-xs text-red-500">{error}</p>
        ) : (
          hint && <p className="text-xs text-gray-400 dark:text-gray-500">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
