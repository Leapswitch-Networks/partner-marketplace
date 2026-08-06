"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Test } from "@/types";
import Button from "@/components/common/Button";

interface RulesModalProps {
  test: Test;
  onAgree: () => void;
  onClose: () => void;
  loading: boolean;
}

export default function RulesModal({ test, onAgree, onClose, loading }: RulesModalProps) {
  const [agreed, setAgreed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Block Escape key dismissal per spec
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") e.preventDefault();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleCheckbox = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAgreed(e.target.checked);
  }, []);

  return (
    /* Backdrop — clicking outside does nothing per spec */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
    >
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-none shadow-xl dark:bg-night-card">

        {/* Fixed header */}
        <div className="flex items-center justify-between border-b border-surface-border px-6 py-4 dark:border-night-border">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] bg-brand/10 text-brand dark:text-brand-on-dark">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </span>
            <div>
              <h2 id="rules-title" className="text-base font-bold text-gray-900 dark:text-gray-100">
                Test Rules &amp; Instructions
              </h2>
              <p className="text-xs text-gray-400 mt-0.5 dark:text-gray-500">Please read carefully before starting</p>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto scrollbar-hide scroll-smooth px-6 py-5 text-sm text-gray-700 space-y-5 dark:text-gray-300"
          style={{ maxHeight: "52vh" }}
        >
          {/* Test Overview */}
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">1</span>
              Test Overview
            </h3>
            <ul className="space-y-1.5 pl-7 list-disc text-gray-600 dark:text-gray-400">
              <li><span className="font-medium text-gray-800 dark:text-gray-200">Title:</span> {test.title}</li>
              <li><span className="font-medium text-gray-800 dark:text-gray-200">Total questions:</span> {test.total_questions}</li>
              <li><span className="font-medium text-gray-800 dark:text-gray-200">Time limit:</span> {test.duration_minutes} minutes</li>
            </ul>
          </section>

          {/* Attempt Rules */}
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">2</span>
              Attempt Rules
            </h3>
            <ul className="space-y-1.5 pl-7 list-disc text-gray-600 dark:text-gray-400">
              <li>You can navigate back to any question using the question panel.</li>
              <li>Each question can be skipped and flagged for later review.</li>
              <li>Only one answer is allowed per MCQ / True-False question.</li>
            </ul>
          </section>

          {/* Time & Submission */}
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">3</span>
              Time &amp; Submission
            </h3>
            <ul className="space-y-1.5 pl-7 list-disc text-gray-600 dark:text-gray-400">
              <li>The timer starts immediately after you click <strong className="text-gray-800">Start Test</strong>.</li>
              <li>The test auto-submits when the timer reaches zero.</li>
              <li>You may submit early at any time using the Submit button.</li>
            </ul>
          </section>

          {/* Integrity Guidelines */}
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">4</span>
              Integrity Guidelines
            </h3>
            <ul className="space-y-1.5 pl-7 list-disc text-gray-600 dark:text-gray-400">
              <li>Do not switch tabs or minimise the window — a warning will appear. Repeated violations may auto-submit the test.</li>
              <li>Do not refresh the page; your progress is auto-saved every few seconds.</li>
            </ul>
          </section>

          {/* Scoring */}
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">5</span>
              Scoring
            </h3>
            <ul className="space-y-1.5 pl-7 list-disc text-gray-600 dark:text-gray-400">
              <li>MCQ / True-False: marks awarded as configured per question.</li>
              <li>Descriptive: manually reviewed (if applicable).</li>
              <li>No negative marking unless stated otherwise.</li>
            </ul>
          </section>
        </div>

        {/* Fixed footer */}
        <div className="border-t border-surface-border px-6 py-4 space-y-3 dark:border-night-border dark:bg-night-card">
          {/* Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer select-none group">
            <div className="relative mt-0.5 shrink-0">
              <input
                type="checkbox"
                checked={agreed}
                onChange={handleCheckbox}
                disabled={loading}
                className="peer h-4 w-4 cursor-pointer appearance-none rounded border-2 border-surface-border bg-white transition-colors
                  checked:border-brand checked:bg-brand
                  focus:outline-none focus:ring-2 focus:ring-brand/30
                  disabled:cursor-not-allowed disabled:opacity-60
                  dark:border-night-border dark:bg-night-card"
              />
              {/* Custom checkmark */}
              <svg
                className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2 6l3 3 5-5" />
              </svg>
            </div>
            <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors dark:text-gray-400 dark:group-hover:text-gray-200">
              I have read all the instructions and agree to the test rules.
            </span>
          </label>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button
              fullWidth
              onClick={onAgree}
              disabled={!agreed || loading}
              loading={loading}
            >
              Start Test
            </Button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-full rounded-[5px] border border-surface-border py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 sm:w-auto sm:px-5 dark:border-night-border dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
