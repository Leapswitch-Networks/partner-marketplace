import type { SelectHTMLAttributes } from "react";
import { forwardRef } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options: SelectOption[];
  /** Shown as the first, empty-valued option — use for "All statuses" etc. */
  placeholder?: string;
  label?: string;
}

/**
 * Native `<select>`, styled to match `Input`.
 *
 * Deliberately native rather than a custom listbox: it is keyboard accessible and
 * mobile-friendly for free, and this project has no component library to borrow a
 * tested popover from.
 */
const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, placeholder, label, id, className = "", ...props }, ref) => {
    const selectId = id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className={label ? "flex flex-col gap-1" : ""}>
        {label && (
          <label
            htmlFor={selectId}
            className="text-xs font-semibold text-gray-700 dark:text-gray-300"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`h-9 w-full truncate rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-900 outline-none transition focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 disabled:bg-gray-50 disabled:text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 2xl:text-sm ${className}`}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
);

Select.displayName = "Select";
export default Select;
