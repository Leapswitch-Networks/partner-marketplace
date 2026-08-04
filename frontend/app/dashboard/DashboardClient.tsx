"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import WelcomeBanner from "@/components/dashboard/WelcomeBanner";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import Sidebar, { type AdminSection, SECTION_URLS } from "@/components/dashboard/Sidebar";
import TopNav from "@/components/common/TopNav";
import AddCategoryForm from "@/components/admin/AddCategoryForm";
import AddJobRoleForm from "@/components/admin/AddJobRoleForm";
import AddTestSectionForm from "@/components/admin/AddTestSectionForm";
import SelectQuestionType from "@/components/admin/SelectQuestionType";
import AddQuestionForm from "@/components/admin/AddQuestionForm";
import UsersModule from "@/components/admin/UsersModule";
import RolesModule from "@/components/admin/RolesModule";
import ActivityModule from "@/components/admin/ActivityModule";
import Candidate from "@/components/admin/Candidate";

type QuestionType = "mcq" | "true_false" | "descriptive";

/**
 * Sections that own a URL. Everything else is an in-page authoring section that
 * lives in local state — see `handleNavigate`.
 */
const URL_ROUTED_SECTIONS = new Set<AdminSection>(
  Object.values(SECTION_URLS).filter((s) => s !== "dashboard")
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

  // When the URL has a routed section, sync local state to match
  useEffect(() => {
    if (urlSection !== null) {
      setLocalSection(urlSection);
    }
  }, [urlSection]);



  // The section actually in use: URL wins when it maps to a routed section
  const activeSection: AdminSection = urlSection !== null ? urlSection : localSection;

  const handleNavigate = useCallback((section: AdminSection) => {
    // Profile moved to /settings/profile. Kept as an explicit branch because
    // DashboardOverview still offers it as a quick action.
    if (section === "profile") {
      router.push("/settings/profile");
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
        <TopNav />

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

    </>
  );
}
