"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import WelcomeBanner from "@/components/dashboard/WelcomeBanner";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import Sidebar, { type AdminSection, SECTION_URLS } from "@/components/dashboard/Sidebar";
import TopNav from "@/components/common/TopNav";
import AddCategoryForm from "@/components/admin/AddCategoryForm";
import AddJobRoleForm from "@/components/admin/AddJobRoleForm";
import AddTestSectionForm from "@/components/admin/AddTestSectionForm";
import SelectQuestionType from "@/components/admin/SelectQuestionType";
import AddQuestionForm from "@/components/admin/AddQuestionForm";
import ProfileForm from "@/components/admin/ProfileForm";
import TwoFactorSettings from "@/components/auth/TwoFactorSettings";
import UsersModule from "@/components/admin/UsersModule";
import RolesModule from "@/components/admin/RolesModule";
import ActivityModule from "@/components/admin/ActivityModule";
import Candidate from "@/components/admin/Candidate";

type QuestionType = "mcq" | "true_false" | "descriptive";

/** Sections that have a dedicated URL route (profile is excluded — it opens as a modal) */
const URL_ROUTED_SECTIONS = new Set<AdminSection>(
  Object.values(SECTION_URLS).filter((s) => s !== "dashboard" && s !== "profile")
);

function pathnameToSection(pathname: string): AdminSection | null {
  if (pathname === "/dashboard") return null;
  return (SECTION_URLS[pathname as keyof typeof SECTION_URLS] as AdminSection) ?? null;
}

export default function DashboardClient() {
  const pathname = usePathname();
  const router = useRouter();

  // URL-derived section (null when on /dashboard with no dedicated route)
  const urlSection = pathnameToSection(pathname);

  const [localSection, setLocalSection] = useState<AdminSection>("dashboard");
  const [selectedQuestionType, setSelectedQuestionType] = useState<QuestionType | null>(null);
  const [createdCategoryId, setCreatedCategoryId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  // When the URL has a routed section, sync local state to match
  useEffect(() => {
    if (urlSection !== null) {
      setLocalSection(urlSection);
    }
  }, [urlSection]);

  // Lock body scroll when profile modal is open
  useEffect(() => {
    if (profileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [profileOpen]);

  // Close modal on Escape key
  useEffect(() => {
    if (!profileOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [profileOpen]);

  // The section actually in use: URL wins when it maps to a routed section
  const activeSection: AdminSection = urlSection !== null ? urlSection : localSection;

  const handleNavigate = useCallback((section: AdminSection) => {
    if (section === "profile") {
      setProfileOpen(true);
      return;
    }
    if (URL_ROUTED_SECTIONS.has(section)) {
      const url = Object.entries(SECTION_URLS).find(([, v]) => v === section)?.[0];
      if (url) router.push(url);
    } else {
      if (section !== "add-question") setSelectedQuestionType(null);
      if (section !== "add-job-role") setCreatedCategoryId(null);
      setLocalSection(section);
      if (urlSection !== null) router.push("/dashboard");
    }
  }, [router, urlSection]);

  const handleCategoryCreated = (categoryId: string) => {
    setCreatedCategoryId(categoryId);
  };

  const handleSelectQuestionType = (type: QuestionType) => {
    setSelectedQuestionType(type);
    setLocalSection("add-question");
    if (urlSection !== null) router.push("/dashboard");
  };

  const userInfoSections: AdminSection[] = ["user-info", "user-add"];

  /**
   * Sections that own the full viewport height.
   *
   * These render a viewport-locked Card whose table scrolls internally, so they
   * must NOT sit inside the padded, scrolling panel the other sections use —
   * two nested scroll containers means neither behaves.
   */
  const FULL_HEIGHT_SECTIONS: AdminSection[] = ["user-info", "user-add", "roles", "activity"];
  const isFullHeight = FULL_HEIGHT_SECTIONS.includes(activeSection);
  const hideWelcomeBanner = isFullHeight;

  return (
    <>
      <Sidebar activeSection={activeSection} onNavigate={handleNavigate} />

      {/* Page area: gray canvas so the rounded corner of the inner panel is visible */}
      <div className="flex flex-1 flex-col min-w-0 bg-gray-100 dark:bg-gray-950">
        <TopNav onNavigate={handleNavigate} activeSection={activeSection} />

        {isFullHeight ? (
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-100 px-3 pb-3 pt-20 md:pt-3 sm:px-4 dark:bg-gray-950">
            {userInfoSections.includes(activeSection) && (
              <UsersModule initialModal={activeSection === "user-add" ? "create" : undefined} />
            )}
            {activeSection === "roles" && <RolesModule />}
            {activeSection === "activity" && <ActivityModule />}
          </main>
        ) : (
        <main className="flex-1 overflow-y-auto scrollbar-hide scroll-smooth h-screen bg-gray-100 px-4 py-6 pt-20 md:pt-4 sm:px-6 sm:py-6 lg:px-6 2xl:px-8 2xl:py-8 dark:bg-gray-950">
          {!hideWelcomeBanner && (
            <div className="mb-8 animate-fade-in">
              <WelcomeBanner />
            </div>
          )}

          <div className="mx-auto w-full">
            <div className="rounded-2xl bg-white p-4 sm:p-6 lg:p-8 shadow-sm ring-1 ring-gray-100 animate-fade-in dark:bg-gray-900 dark:ring-gray-800">
              {activeSection === "dashboard" && <DashboardOverview onNavigate={handleNavigate} />}
              {activeSection === "candidate" && <Candidate />}
              {activeSection === "add-category" && (
                <AddCategoryForm
                  onNavigate={handleNavigate}
                  onCategoryCreated={handleCategoryCreated}
                />
              )}
              {activeSection === "add-job-role" && (
                <AddJobRoleForm categoryId={createdCategoryId ?? undefined} />
              )}
              {activeSection === "add-test-section" && <AddTestSectionForm />}
              {activeSection === "select-question-type" && (
                <SelectQuestionType onSelect={handleSelectQuestionType} />
              )}
              {activeSection === "add-question" && (
                <AddQuestionForm initialType={selectedQuestionType ?? "mcq"} />
              )}
            </div>
          </div>
        </main>
        )}
      </div>

      {/* Profile modal — rendered via portal so it overlays the entire viewport */}
      {profileOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Profile"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200"
            onClick={() => setProfileOpen(false)}
          />

          {/* Panel */}
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800 animate-scale-in">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Profile</h2>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                aria-label="Close profile"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-6">
              <ProfileForm />

              {/* Security lives in the same modal as the profile because that is
                  where a user looks for it, and it is separated by a rule rather
                  than a second tab — two clicks to find 2FA is two chances to not
                  bother. */}
              <div className="mt-8 border-t border-gray-100 pt-6 dark:border-gray-800">
                <TwoFactorSettings />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
