"use client";

type Role = "candidate" | "admin";

interface RoleToggleProps {
  role: Role;
  onChange: (role: Role) => void;
}

export default function RoleToggle({ role, onChange }: RoleToggleProps) {
  return (
    <div className="flex items-center justify-center mb-6">
      <div className="relative flex rounded-xl bg-gray-100 p-1">
        {/* Sliding indicator */}
        <span
          aria-hidden="true"
          className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-md transition-all duration-250 ease-in-out ${
            role === "candidate" ? "left-1" : "left-[calc(50%+3px)]"
          }`}
        />

        <button
          type="button"
          onClick={() => onChange("candidate")}
          className={`relative z-10 min-w-[110px] rounded-lg px-5 py-2 text-sm font-semibold tracking-wide transition-all duration-150 cursor-pointer select-none             ${role === "candidate"
              ? "text-gray-900"
              : "text-gray-400 hover:text-gray-600 active:scale-95"
            }`}
          aria-pressed={role === "candidate"}
        >
          Candidate
        </button>

        <button
          type="button"
          onClick={() => onChange("admin")}
          className={`relative z-10 min-w-[110px] rounded-lg px-5 py-2 text-sm font-semibold tracking-wide transition-all duration-150 cursor-pointer select-none             ${role === "admin"
              ? "text-gray-900"
              : "text-gray-400 hover:text-gray-600 active:scale-95"
            }`}
          aria-pressed={role === "admin"}
        >
          Admin
        </button>
      </div>
    </div>
  );
}
