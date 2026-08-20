"use client";

import { ArrowUpRight, Building2, Layers, ShieldCheck, Users } from "lucide-react";

import usePermissions from "@/lib/hooks/usePermissions";
import Badge from "@/components/common/Badge";
import { headingClasses } from "@/components/common/PageHeading";
import {
  ActionCard,
  EntityCard,
  FeatureSlab,
  MetricCard,
  SurfaceCard,
} from "@/components/common/cards";
import ActivityFeed from "@/components/common/ActivityFeed";
import {
  BarChart,
  BulletChart,
  ChartEmpty,
  ChartFrame,
  ChartSkeleton,
  DataBarTable,
  DivergingStackedBar,
  FunnelChart,
  ScaleLegend,
  DivergingBar,
  Dumbbell,
  EmphasisChart,
  GroupedBar,
  Heatmap,
  HeroFigure,
  Meter,
  SmallMultiples,
  Sparkline,
  StackedBar,
  TrendChart,
  seriesColor,
} from "@/components/common/charts";

/**
 * A live preview of the design system's components, on the dashboard, for the
 * super-admin only.
 *
 * The card set and the chart set were both built ready-to-use and wired into
 * nothing, which meant nobody could see them — including the person who asked for
 * them. This puts every variant on a real screen, in the real theme, in whichever
 * mode the viewer is in, so they can be judged rather than described.
 *
 * ## 🔴 Every figure below is invented, and it says so
 *
 * A chart of made-up numbers sitting on the dashboard is indistinguishable from a
 * chart of real ones. That is precisely the failure `ANTI_SLOP.md` § 3 exists to
 * prevent — "no number on the page that is not backed by a live query" — and it is
 * more dangerous here than on a marketing page, because this surface is where
 * someone comes to find out what is actually happening.
 *
 * So the section carries a heading that says it is a preview, every panel is inside
 * that section, and the values are shaped to be obviously illustrative. **Never
 * connect this to a real endpoint** — if a chart here becomes useful, move it into
 * the dashboard proper with its own data and delete it from here.
 *
 * ## Gating — `hasAdminAccess`, not a list of role names
 *
 * Widened 2026-08-20 from super-admin only to everyone with admin access, which is
 * exactly the set the owner asked for. `has_admin_access` is computed on the server
 * from `core/roles.py`'s own constant:
 *
 * ```python
 * ADMIN_ACCESS_ROLES = {ROLE_ROOT, ROLE_SUPER_ADMIN, ROLE_BACKEND_DEVELOPER, ROLE_ADMIN}
 * ```
 *
 * — so **RootUser, SuperAdmin, BackendDeveloper and Admin** all see it.
 *
 * **Not a hardcoded list of role names, deliberately.** `roles.py` makes the point
 * itself, about `BackendDeveloper`: *"a role whose name is a security rule must not
 * be renameable, or the rename silently detaches the rule."* The same trap applies
 * in reverse here — a list in this file would have to be edited every time a core
 * role is added, and until someone remembered, the new role would silently lose
 * access. Reading the derived boolean means the set is maintained in one place, on
 * the server, next to the roles themselves.
 *
 * ⚠️ **There is no `Director` role.** The owner asked for one; the live roles are
 * RootUser, SuperAdmin, Admin, Staff, Partner, User, BackendDeveloper and Sales.
 * Nothing was invented to cover it — if Director is created and given admin access,
 * it will appear here automatically, which is the point of gating this way.
 *
 * `Staff` and `Sales` are internal but are **not** in `ADMIN_ACCESS_ROLES`, so they
 * do not see this. That is the project's own line between "manages the platform" and
 * "works in it", not a new one drawn here.
 *
 * Still a **presentation** decision rather than a security one: it renders no real
 * data, so there is nothing here to protect. A client-side check hides UI and
 * nothing more — a real query here would need a server-side guard.
 */

// ── Illustrative figures. Shapes, not measurements. ──────────────────────────
const WEEKS = ["Wk 1", "Wk 2", "Wk 3", "Wk 4", "Wk 5", "Wk 6", "Wk 7", "Wk 8"];
const ENQUIRIES = [12, 19, 14, 23, 21, 28, 26, 34];
const REPLIES = [8, 14, 11, 18, 17, 22, 21, 27];
const SPARK = [4, 6, 5, 8, 7, 9, 8, 11, 10, 13, 12, 15];

const CATEGORIES = [
  { label: "Managed hosting", value: 148 },
  { label: "Colocation", value: 96 },
  { label: "Cloud migration", value: 74 },
  { label: "Backup and DR", value: 41 },
  { label: "Security audit", value: 23 },
];

const MONTHS = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];
const VS_TARGET = [
  { label: "Managed hosting", value: 18 },
  { label: "Colocation", value: 6 },
  { label: "Cloud migration", value: 0 },
  { label: "Backup and DR", value: -9 },
  { label: "Security audit", value: -21 },
];
const REGIONS = [
  { label: "West", values: [14, 18, 22, 26, 31, 38] },
  { label: "South", values: [11, 13, 12, 16, 19, 24] },
  { label: "North", values: [7, 9, 11, 10, 13, 16] },
  { label: "East", values: [4, 5, 7, 6, 8, 11] },
  { label: "Central", values: [3, 4, 4, 6, 7, 9] },
];
const TIERS = [
  { label: "Gold", before: 12, after: 19 },
  { label: "Silver", before: 28, after: 31 },
  { label: "Bronze", before: 41, after: 34 },
  { label: "Unranked", before: 22, after: 14 },
];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// A deterministic wave — no randomness, so the preview renders the same every time
// and never invents a "spike" that someone might read as a real event.
const GRID_VALUES = DAYS.map((_, r) =>
  Array.from({ length: 18 }, (_, cIdx) =>
    Math.max(0, Math.round(6 + 5 * Math.sin((cIdx + r * 2) / 2.6) + (r < 5 ? 4 : -3)))
  )
);

const FUNNEL = [
  { label: "Listing viewed", value: 4120 },
  { label: "Enquiry started", value: 986 },
  { label: "Enquiry sent", value: 612 },
  { label: "Partner replied", value: 447 },
  { label: "Marked resolved", value: 288 },
];
const SENTIMENT = [
  { label: "Response speed", negative: [4, 9], neutral: 14, positive: [38, 35] },
  { label: "Listing accuracy", negative: [2, 6], neutral: 11, positive: [42, 39] },
  { label: "Pricing clarity", negative: [11, 18], neutral: 22, positive: [28, 21] },
  { label: "Onboarding", negative: [6, 12], neutral: 19, positive: [34, 29] },
];
const LONG_TAIL = [
  { label: "Managed hosting", value: 148 }, { label: "Colocation", value: 96 },
  { label: "Cloud migration", value: 74 }, { label: "Backup and DR", value: 41 },
  { label: "Security audit", value: 23 }, { label: "Networking", value: 19 },
  { label: "Compliance", value: 14 }, { label: "Database ops", value: 11 },
  { label: "Kubernetes", value: 8 }, { label: "Load testing", value: 5 },
  { label: "CDN setup", value: 3 },
];
const FEED = [
  { id: 1, title: "Northwind Cloud published a listing", meta: "Approved by Root", time: "14:02", tone: "good" as const },
  { id: 2, title: "Aravali Systems submitted for review", meta: "Awaiting a decision", time: "13:41", tone: "warning" as const },
  { id: 3, title: "Two API credentials rotated", meta: "Root", time: "11:18" },
  { id: 4, title: "Background job failed twice", meta: "digest-mailer", time: "09:55", tone: "critical" as const },
  { id: 5, title: "Role 'Partner Manager' gained 3 permissions", meta: "Root", time: "08:30" },
];

const QUEUE = [
  { label: "Published", value: 62 },
  { label: "In review", value: 18 },
  { label: "Changes requested", value: 7 },
  { label: "Draft", value: 11 },
];

export default function ComponentPreview() {
  const { hasAdminAccess } = usePermissions();
  if (!hasAdminAccess) return null;

  return (
    <section className="mt-12" aria-labelledby="component-preview">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-brand/20 pt-6 dark:border-night-border">
        <div className="min-w-0">
          <h2 id="component-preview" className={`${headingClasses()} text-ink dark:text-white`}>
            Component preview
          </h2>
          <p className="mt-1 text-sm text-ink-label dark:text-night-muted">
            Every card and chart in the design system, on a real screen. Visible to
            RootUser, SuperAdmin, BackendDeveloper and Admin.
          </p>
        </div>
        {/* Said once, prominently, and again on the chart frames. The whole section
            is worthless if a single figure is mistaken for a real one. */}
        <Badge tone="warning">Sample figures — not live data</Badge>
      </div>

      {/* ── Slabs ─────────────────────────────────────────────────────────── */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <FeatureSlab
          ground="brand"
          eyebrow="FeatureSlab · brand"
          title="The band that opens a page."
          description="One per page at most — the slab reads as emphatic because the rest of the page is lighter."
        />
        <FeatureSlab
          ground="ink"
          eyebrow="FeatureSlab · ink"
          title="The same component, darker ground."
          description="Amber carries the eyebrow on a dark ground; the brand carries it on a light one."
        />
      </div>

      {/* ── Metrics, one per ground ────────────────────────────────────────── */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard ground="paper" label="Paper" hint="white card" value="1,284" icon={<Users />} delta="+12.4%" direction="up" sentiment="good" />
        <MetricCard ground="sunken" label="Sunken" hint="tinted fill" value="318" icon={<Layers />} delta="−3" direction="down" sentiment="bad" />
        <MetricCard ground="ink" label="Ink" hint="the dark slab" value="62" icon={<Building2 />} delta="unchanged" direction="flat" />
        <MetricCard ground="brand" label="Brand" hint="the pine slab" value="9" icon={<ShieldCheck />} delta="+2" direction="up" sentiment="good" />
      </div>

      {/* ── Charts ────────────────────────────────────────────────────────── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartFrame
          title="Enquiries and replies"
          description="Two series · crosshair readout · sample figures"
          series={[
            { label: "Enquiries", color: seriesColor(0) },
            { label: "Replies", color: seriesColor(1) },
          ]}
          tableColumns={WEEKS}
          tableRows={[
            { label: "Enquiries", values: ENQUIRIES },
            { label: "Replies", values: REPLIES },
          ]}
          height={210}
        >
          <TrendChart
            labels={WEEKS}
            series={[
              { label: "Enquiries", values: ENQUIRIES },
              { label: "Replies", values: REPLIES },
            ]}
            height={210}
          />
        </ChartFrame>

        <ChartFrame
          title="Enquiries by service"
          description="One measure, one colour · sample figures"
          tableColumns={CATEGORIES.map((c) => c.label)}
          tableRows={[{ label: "Enquiries", values: CATEGORIES.map((c) => c.value) }]}
          height={210}
        >
          <BarChart data={CATEGORIES} height={160} />
        </ChartFrame>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SurfaceCard ground="paper" padding="md">
          <h3 className={`${headingClasses("section")} text-ink dark:text-white`}>Listing states</h3>
          <p className="mb-4 mt-0.5 text-xs text-ink-label dark:text-night-muted">
            Part-to-whole · sample figures
          </p>
          <StackedBar segments={QUEUE} />
        </SurfaceCard>

        <SurfaceCard ground="paper" padding="md">
          <h3 className={`${headingClasses("section")} text-ink dark:text-white`}>Meters and sparkline</h3>
          <p className="mb-4 mt-0.5 text-xs text-ink-label dark:text-night-muted">
            Single ratios and an inline trend · sample figures
          </p>
          <div className="space-y-3.5">
            <Meter label="Profiles complete" value={62} max={98} severity="good" />
            <Meter label="Storage used" value={78} max={100} severity="warning" display="78%" />
            <Meter label="Failed jobs" value={9} max={10} severity="critical" />
            <div className="flex items-center justify-between gap-4 border-t border-brand/20 pt-3.5 dark:border-night-border">
              <span className="text-xs font-semibold text-ink dark:text-white">Activity, 12 weeks</span>
              <Sparkline values={SPARK} ariaLabel="Rising over twelve weeks" />
            </div>
          </div>
        </SurfaceCard>
      </div>

      {/* ── The lead number, and faceting ─────────────────────────────────── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <SurfaceCard ground="paper" padding="md">
          <HeroFigure
            label="Enquiries this month"
            value={1284}
            delta={<span className="font-semibold text-tone-success dark:text-brand-on-dark">+18%</span>}
            sub="vs last month · sample"
            trend={<Sparkline values={SPARK} />}
          />
        </SurfaceCard>
        <SurfaceCard ground="paper" padding="md" className="lg:col-span-2">
          <h3 className={`${headingClasses("section")} text-ink dark:text-white`}>Enquiries by region</h3>
          <p className="mb-4 mt-0.5 text-xs text-ink-label dark:text-night-muted">
            Small multiples · one shared scale, one colour · sample figures
          </p>
          <SmallMultiples facets={REGIONS} labels={MONTHS} columns={5} />
        </SurfaceCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartFrame
          title="Against target"
          description="Diverging — direction and hue both carry the sign · sample figures"
          tableColumns={VS_TARGET.map((d) => d.label)}
          tableRows={[{ label: "Δ to target", values: VS_TARGET.map((d) => d.value) }]}
          height={190}
        >
          <DivergingBar data={VS_TARGET} height={180} />
        </ChartFrame>

        <ChartFrame
          title="West is the story"
          description="Emphasis — one series in colour, the rest as context · sample figures"
          tableColumns={MONTHS}
          tableRows={REGIONS.map((r) => ({ label: r.label, values: r.values }))}
          height={190}
        >
          <EmphasisChart series={REGIONS} labels={MONTHS} emphasis={0} height={180} />
        </ChartFrame>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartFrame
          title="Enquiries by day"
          description="Heatmap — sequential, one hue, hover any cell · sample figures"
          height={150}
        >
          <div className="flex h-full flex-col">
            <Heatmap rows={DAYS} columns={GRID_VALUES[0].map((_, i) => `W${i + 1}`)} values={GRID_VALUES} valueLabel="enquiries" />
            {/* A value scale needs its key. Hover text alone leaves out anyone on a
                keyboard, a screen reader, a touch device or a printout. */}
            <div className="mt-2">
              <ScaleLegend
                min={Math.min(...GRID_VALUES.flat())}
                max={Math.max(...GRID_VALUES.flat())}
                label="Enquiries"
              />
            </div>
          </div>
        </ChartFrame>

        <ChartFrame
          title="Tier movement"
          description="Dumbbell — the gap is the change · sample figures"
          tableColumns={TIERS.map((t) => t.label)}
          tableRows={[
            { label: "Before", values: TIERS.map((t) => t.before) },
            { label: "After", values: TIERS.map((t) => t.after) },
          ]}
          height={150}
        >
          <Dumbbell data={TIERS} height={140} />
        </ChartFrame>
      </div>

      <div className="mt-4">
        <ChartFrame
          title="Enquiries and replies by region"
          description="Grouped bars — the one form where categorical colour is the job · sample figures"
          series={[
            { label: "Enquiries", color: seriesColor(0) },
            { label: "Replies", color: seriesColor(1) },
          ]}
          tableColumns={REGIONS.map((r) => r.label)}
          tableRows={[
            { label: "Enquiries", values: REGIONS.map((r) => r.values[5]) },
            { label: "Replies", values: REGIONS.map((r) => Math.round(r.values[5] * 0.72)) },
          ]}
          height={210}
        >
          <GroupedBar
            categories={REGIONS.map((r) => r.label)}
            series={[
              { label: "Enquiries", values: REGIONS.map((r) => r.values[5]) },
              { label: "Replies", values: REGIONS.map((r) => Math.round(r.values[5] * 0.72)) },
            ]}
            height={210}
          />
        </ChartFrame>
      </div>

      {/* ── Ordered scales, targets, and the long tail ─────────────────────── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartFrame
          title="Enquiry funnel"
          description="Ordinal — the colour carries the order, not the size · sample figures"
          tableColumns={FUNNEL.map((f) => f.label)}
          tableRows={[{ label: "Reached", values: FUNNEL.map((f) => f.value) }]}
          height={180}
        >
          <FunnelChart stages={FUNNEL} />
        </ChartFrame>

        <ChartFrame
          title="Buyer sentiment"
          description="Diverging stacked — the lean is the answer · sample figures"
          height={180}
        >
          <DivergingStackedBar
            rows={SENTIMENT}
            legend={["Very poor", "Poor", "Neutral", "Good", "Very good"]}
          />
        </ChartFrame>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SurfaceCard ground="paper" padding="md">
          <h3 className={`${headingClasses("section")} text-ink dark:text-white`}>Against target</h3>
          <p className="mb-4 mt-0.5 text-xs text-ink-label dark:text-night-muted">
            Bullet — actual, target and the verdict in words · sample figures
          </p>
          <div className="space-y-3.5">
            <BulletChart label="Partners published" value={62} target={50} />
            <BulletChart label="Enquiries answered" value={447} target={500} severity="warning" />
            <BulletChart label="Verification backlog cleared" value={18} target={40} severity="critical" />
          </div>
        </SurfaceCard>

        <ChartFrame
          title="Every service category"
          description="Eleven categories — a table with bars, tail folded into Other · sample figures"
          height={260}
        >
          <DataBarTable rows={LONG_TAIL} limit={6} valueLabel="Enquiries" />
        </ChartFrame>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <SurfaceCard ground="paper" padding="md">
          <h3 className={`${headingClasses("section")} text-ink dark:text-white`}>Recent activity</h3>
          <p className="mb-2 mt-0.5 text-xs text-ink-label dark:text-night-muted">
            A list, not a chart · sample figures
          </p>
          <ActivityFeed items={FEED} />
        </SurfaceCard>

        <SurfaceCard ground="paper" padding="md">
          <h3 className={`${headingClasses("section")} text-ink dark:text-white`}>Loading</h3>
          <p className="mb-3 mt-0.5 text-xs text-ink-label dark:text-night-muted">
            Sized to the chart it replaces
          </p>
          <ChartSkeleton height={150} />
        </SurfaceCard>

        <SurfaceCard ground="paper" padding="md">
          <h3 className={`${headingClasses("section")} text-ink dark:text-white`}>Nothing yet</h3>
          <p className="mb-3 mt-0.5 text-xs text-ink-label dark:text-night-muted">
            Says why, and never shows a zero it does not have
          </p>
          <ChartEmpty
            title="No enquiries yet"
            description="They will appear here as soon as a buyer sends one."
            height={150}
          />
        </SurfaceCard>
      </div>

      {/* ── Actions and entities ──────────────────────────────────────────── */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ActionCard ground="paper" icon={<Users />} title="ActionCard" description="Paper ground. The arrow nudges on hover." />
        <ActionCard ground="lilac" icon={<ShieldCheck />} title="On lilac" description="The action ground, bordered because lilac has no edge." />
        <ActionCard ground="ink" icon={<Layers />} title="On ink" description="Amber icon and emphasis on a dark ground." trailing={<ArrowUpRight className="h-4 w-4" />} />
        <ActionCard ground="amber" icon={<Building2 />} title="On amber" description="Ink text on the accent, for a callout." />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <EntityCard
          title="Northwind Cloud"
          subtitle="Managed hosting · Pune"
          status={<Badge tone="success">Live</Badge>}
          meta={[
            { label: "Tier", value: "Gold" },
            { label: "Enquiries", value: "312" },
            { label: "Joined", value: "Mar 2026" },
          ]}
        />
        <EntityCard
          title="Aravali Systems"
          subtitle="Colocation · Jaipur"
          status={<Badge tone="pending">In review</Badge>}
          meta={[
            { label: "Tier", value: "—" },
            { label: "Enquiries", value: "0" },
            { label: "Joined", value: "Aug 2026" },
          ]}
        />
      </div>
    </section>
  );
}
