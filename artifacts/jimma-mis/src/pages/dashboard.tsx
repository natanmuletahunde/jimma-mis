import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetDashboardStats,
  useGetRecentProperties,
  useGetDashboardTrend,
  useGetEnumeratorPerformance,
  useGetByKebele,
  useListProperties,
  getListPropertiesQueryKey,
} from "@workspace/api-client-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Building,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  MapPinOff,
  Home,
  Landmark,
  Layers,
  FileText,
  ShieldCheck,
  Filter,
  RotateCcw,
  Eye,
  TrendingUp,
  Loader2,
  AlertTriangle,
  PencilLine,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  approved: "#10b981",
  pending: "#f59e0b",
  rejected: "#ef4444",
  kebele_verified: "#3b82f6",
  draft: "#94a3b8",
};

const STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  pending: "Pending",
  rejected: "Rejected",
  kebele_verified: "Kebele Verified",
  draft: "Draft",
};

const TYPE_COLORS: Record<string, string> = {
  residential: "#3b82f6",
  commercial: "#f97316",
  government: "#10b981",
  institution: "#8b5cf6",
  mixed: "#94a3b8",
};

const TYPE_LABELS: Record<string, string> = {
  residential: "Residential",
  commercial: "Commercial",
  government: "Government",
  institution: "Institution",
  mixed: "Mixed Use",
};

const STATUS_BADGE: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-800",
  kebele_verified: "bg-blue-100 text-blue-800",
  draft: "bg-slate-100 text-slate-700",
};

const EMPTY_FILTERS = {
  from_date: "",
  to_date: "",
  kebele: "",
  property_type: "",
  status: "",
};

// ─── Types ───────────────────────────────────────────────────────────────────

type CardFilter = {
  status?: string;
  property_type?: string;
};

type ActiveCard = {
  title: string;
  filter: CardFilter;
  /** If true, navigate to map instead of showing a dialog */
  mapLink?: boolean;
};

// ─── Compact KPI Card ─────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  icon: Icon,
  colorClass,
  loading,
  onClick,
}: {
  title: string;
  value: number | undefined;
  icon: React.ElementType;
  colorClass: string;
  loading: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer select-none transition-all duration-150 hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 active:scale-[0.98]"
    >
      <CardContent className="p-3 flex items-center gap-2.5">
        {/* Icon badge */}
        <div className={`p-1.5 rounded-md ${colorClass} shrink-0`}>
          <Icon className="h-3 w-3 text-white" />
        </div>

        {/* Label + value */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide truncate leading-none">
            {title}
          </p>
          {loading ? (
            <div className="h-4 w-8 bg-muted animate-pulse rounded mt-1" />
          ) : (
            <p className="text-base font-bold tabular-nums leading-none mt-0.5">
              {value ?? 0}
            </p>
          )}
        </div>

        {/* Arrow hint */}
        <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0 transition-colors group-hover:text-muted-foreground/80" />
      </CardContent>
    </Card>
  );
}

// ─── KPI Drill-down Dialog ────────────────────────────────────────────────────

function KpiDetailDialog({
  active,
  baseParams,
  onClose,
}: {
  active: ActiveCard | null;
  baseParams: Record<string, string>;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);

  const queryFilter: Record<string, string | number> = {
    ...baseParams,
    ...(active?.filter.status        ? { status:        active.filter.status }        : {}),
    ...(active?.filter.property_type ? { property_type: active.filter.property_type } : {}),
    page,
    limit: 8,
  };

  const { data, isLoading } = useListProperties(queryFilter as any, {
    query: {
      queryKey: getListPropertiesQueryKey(queryFilter as any),
      enabled: !!active && !active.mapLink,
    },
  });

  // Reset page when a different card is opened
  const cardKey = active ? `${active.filter.status ?? ""}|${active.filter.property_type ?? ""}` : "";

  return (
    <Dialog
      open={!!active && !active.mapLink}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setPage(1);
        }
      }}
    >
      <DialogContent className="max-w-3xl w-full flex flex-col gap-0 p-0 max-h-[85vh]">
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            {active?.title}
            {data?.total != null && (
              <span className="text-sm font-normal text-muted-foreground">
                — {data.total} propert{data.total === 1 ? "y" : "ies"}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !data?.properties.length ? (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <Building className="h-8 w-8" />
              <p className="text-sm">No properties found</p>
            </div>
          ) : (
            <table key={cardKey} className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Code</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Owner</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">Kebele</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">Type</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {data.properties.map((p, idx) => (
                  <tr
                    key={p.id}
                    className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${
                      idx % 2 !== 0 ? "bg-muted/10" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      {p.addressCode ? (
                        <span className="font-mono text-xs text-emerald-700 font-semibold">
                          {p.addressCode}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-medium truncate max-w-[130px]">
                      {p.ownerName}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                      {p.kebele}
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell">
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                        style={{
                          background: (TYPE_COLORS[p.propertyType] ?? "#94a3b8") + "22",
                          color: TYPE_COLORS[p.propertyType] ?? "#94a3b8",
                        }}
                      >
                        {TYPE_LABELS[p.propertyType] ?? p.propertyType}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          STATUS_BADGE[p.status] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/properties/${p.id}`} onClick={onClose}>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
                          <Eye className="h-3 w-3" /> View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {data && data.total > 8 && (
          <div className="border-t px-5 py-3 flex items-center justify-between text-xs text-muted-foreground shrink-0">
            <span>
              Showing {(page - 1) * 8 + 1}–{Math.min(page * 8, data.total)} of{" "}
              {data.total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={page * 8 >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Chart helpers ───────────────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <div className="h-64 bg-muted/40 animate-pulse rounded-lg flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-64 flex flex-col items-center justify-center gap-2 text-muted-foreground">
      <AlertTriangle className="h-8 w-8" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [pending, setPending] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [activeCard, setActiveCard] = useState<ActiveCard | null>(null);

  const statsParams = Object.fromEntries(
    Object.entries(applied).filter(([, v]) => v !== ""),
  ) as Record<string, string>;

  const recentParams = { ...statsParams, limit: 10 };

  const { data: kebeles } = useGetByKebele();
  const { data: stats, isLoading: statsLoading, error: statsError } =
    useGetDashboardStats(statsParams);
  const { data: trend, isLoading: trendLoading } = useGetDashboardTrend();
  const { data: recent, isLoading: recentLoading } =
    useGetRecentProperties(recentParams);
  const { data: perfData, isLoading: perfLoading } =
    useGetEnumeratorPerformance();

  function handleApply() { setApplied(pending); }
  function handleReset() { setPending(EMPTY_FILTERS); setApplied(EMPTY_FILTERS); }

  const hasActiveFilters = Object.values(applied).some((v) => v !== "");

  function openCard(title: string, filter: CardFilter, mapLink?: boolean) {
    if (mapLink) { navigate("/map"); return; }
    setActiveCard({ title, filter });
  }

  // Chart data
  const statusChartData = stats
    ? [
        { name: "Approved",  value: stats.approved,             color: STATUS_COLORS.approved },
        { name: "Pending",   value: stats.pending,              color: STATUS_COLORS.pending },
        { name: "Rejected",  value: stats.rejected,             color: STATUS_COLORS.rejected },
        { name: "Verified",  value: stats.kebeleVerified ?? 0,  color: STATUS_COLORS.kebele_verified },
        { name: "Draft",     value: stats.draft ?? 0,           color: STATUS_COLORS.draft },
      ].filter((d) => d.value > 0)
    : [];

  const typeChartData = stats
    ? [
        { name: "Residential", value: stats.residential, color: TYPE_COLORS.residential },
        { name: "Commercial",  value: stats.commercial,  color: TYPE_COLORS.commercial },
        { name: "Government",  value: stats.government,  color: TYPE_COLORS.government },
        { name: "Institution", value: stats.institution, color: TYPE_COLORS.institution },
        { name: "Mixed Use",   value: stats.mixed,       color: TYPE_COLORS.mixed },
      ].filter((d) => d.value > 0)
    : [];

  const kebeleChartData = (stats?.kebeleBreakdown ?? [])
    .slice(0, 10)
    .map((k) => ({ name: k.kebele, count: k.count }));

  const trendChartData = (trend ?? []).map((t) => ({
    date: t.date.slice(5),
    count: t.count,
  }));

  const perfChartData = (perfData ?? [])
    .filter((e) => e.totalRegistered > 0)
    .slice(0, 10)
    .map((e) => ({
      name: e.enumeratorName.split(" ")[0],
      fullName: e.enumeratorName,
      approved: e.approved,
      pending: e.pending,
      rejected: e.rejected,
    }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {user?.role === "enumerator"
              ? "Your registered properties overview"
              : user?.role === "kebele_officer"
              ? "Your kebele's property overview"
              : "City-wide property registration analytics"}
          </p>
        </div>
        {user?.role === "enumerator" && (
          <Link href="/properties/new">
            <Button size="sm">Register Property</Button>
          </Link>
        )}
      </div>

      {/* Filter Panel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-semibold">
                Active
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">From Date</label>
              <Input
                type="date"
                value={pending.from_date}
                onChange={(e) => setPending((p) => ({ ...p, from_date: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">To Date</label>
              <Input
                type="date"
                value={pending.to_date}
                onChange={(e) => setPending((p) => ({ ...p, to_date: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Kebele</label>
              <select
                value={pending.kebele}
                onChange={(e) => setPending((p) => ({ ...p, kebele: e.target.value }))}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">All Kebeles</option>
                {(kebeles ?? []).map((k) => (
                  <option key={k.kebele} value={k.kebele}>{k.kebele}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Property Type</label>
              <select
                value={pending.property_type}
                onChange={(e) => setPending((p) => ({ ...p, property_type: e.target.value }))}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">All Types</option>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="government">Government</option>
                <option value="institution">Institution</option>
                <option value="mixed">Mixed Use</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <select
                value={pending.status}
                onChange={(e) => setPending((p) => ({ ...p, status: e.target.value }))}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="kebele_verified">Kebele Verified</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="h-8 flex-1" onClick={handleApply}>Apply</Button>
              <Button size="sm" variant="outline" className="h-8 px-2.5" onClick={handleReset} title="Reset filters">
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {statsError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 flex items-center gap-3 text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="text-sm">Failed to load dashboard statistics. Please try again.</span>
        </div>
      )}

      {/* KPI Cards — Row 1: Registration Status */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Registration Status
          <span className="ml-1.5 font-normal normal-case text-muted-foreground/60">— click any card to see the list</span>
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <KpiCard title="Total"           value={stats?.total}             icon={Building}    colorClass="bg-slate-500"  loading={statsLoading} onClick={() => openCard("All Properties",   {})} />
          <KpiCard title="Draft"           value={stats?.draft ?? 0}        icon={PencilLine}  colorClass="bg-slate-400"  loading={statsLoading} onClick={() => openCard("Draft",           { status: "draft" })} />
          <KpiCard title="Pending"         value={stats?.pending}           icon={Clock}       colorClass="bg-amber-500"  loading={statsLoading} onClick={() => openCard("Pending Review",  { status: "pending" })} />
          <KpiCard title="Verified"        value={stats?.kebeleVerified ?? 0} icon={ShieldCheck} colorClass="bg-blue-500" loading={statsLoading} onClick={() => openCard("Kebele Verified", { status: "kebele_verified" })} />
          <KpiCard title="Approved"        value={stats?.approved}          icon={CheckCircle2} colorClass="bg-emerald-500" loading={statsLoading} onClick={() => openCard("Approved",      { status: "approved" })} />
          <KpiCard title="Rejected"        value={stats?.rejected}          icon={XCircle}     colorClass="bg-red-500"    loading={statsLoading} onClick={() => openCard("Rejected",        { status: "rejected" })} />
        </div>
      </div>

      {/* KPI Cards — Row 2: Property Types */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Property Types
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          <KpiCard title="Residential" value={stats?.residential} icon={Home}      colorClass="bg-blue-400"   loading={statsLoading} onClick={() => openCard("Residential Properties", { property_type: "residential" })} />
          <KpiCard title="Commercial"  value={stats?.commercial}  icon={Building2} colorClass="bg-orange-400" loading={statsLoading} onClick={() => openCard("Commercial Properties",  { property_type: "commercial" })} />
          <KpiCard title="Government"  value={stats?.government}  icon={Landmark}  colorClass="bg-green-500"  loading={statsLoading} onClick={() => openCard("Government Properties",  { property_type: "government" })} />
          <KpiCard title="Institution" value={stats?.institution} icon={FileText}  colorClass="bg-purple-500" loading={statsLoading} onClick={() => openCard("Institution Properties", { property_type: "institution" })} />
          <KpiCard title="No GPS"      value={stats?.withoutGps}  icon={MapPinOff} colorClass="bg-rose-500"   loading={statsLoading} onClick={() => openCard("Missing GPS", {}, true)} />
        </div>
      </div>

      {/* Drill-down dialog */}
      <KpiDetailDialog
        active={activeCard}
        baseParams={statsParams}
        onClose={() => setActiveCard(null)}
      />

      {/* Charts Row 1: Kebele Bar + Status Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              Registration by Kebele
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <ChartSkeleton />
            ) : kebeleChartData.length === 0 ? (
              <EmptyChart message="No kebele data available" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={kebeleChartData} margin={{ top: 4, right: 8, left: -16, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [v, "Properties"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Approval Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <ChartSkeleton />
            ) : statusChartData.length === 0 ? (
              <EmptyChart message="No status data available" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%" cy="45%"
                    innerRadius={60} outerRadius={95} paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }: { name: string; percent: number }) =>
                      percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ""}
                    labelLine={false}
                  >
                    {statusChartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, "Properties"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend iconType="circle" iconSize={8} formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart: Daily Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Daily Registration Trend — Last 30 Days
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trendLoading ? (
            <ChartSkeleton />
          ) : !trendChartData.some((d) => d.count > 0) ? (
            <EmptyChart message="No registrations in the last 30 days" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendChartData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v: number) => [v, "Registrations"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Charts Row 2: Property Type Pie + Enumerator Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Home className="h-4 w-4 text-muted-foreground" />
              Property Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <ChartSkeleton />
            ) : typeChartData.length === 0 ? (
              <EmptyChart message="No type data available" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={typeChartData}
                    cx="50%" cy="45%"
                    outerRadius={95} paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }: { name: string; percent: number }) =>
                      percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ""}
                    labelLine={false}
                  >
                    {typeChartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, "Properties"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend iconType="circle" iconSize={8} formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {user?.role !== "enumerator" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Enumerator Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {perfLoading ? (
                <ChartSkeleton />
              ) : perfChartData.length === 0 ? (
                <EmptyChart message="No enumerator data available" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={perfChartData} margin={{ top: 4, right: 8, left: -16, bottom: 48 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      labelFormatter={(label: string) => {
                        const row = perfChartData.find((d) => d.name === label);
                        return row?.fullName ?? label;
                      }}
                      formatter={(v: number, name: string) => [v, name.charAt(0).toUpperCase() + name.slice(1)]}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Legend iconType="circle" iconSize={8} formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>} />
                    <Bar dataKey="approved" fill={STATUS_COLORS.approved} radius={[2, 2, 0, 0]} stackId="a" />
                    <Bar dataKey="pending"  fill={STATUS_COLORS.pending}  stackId="a" />
                    <Bar dataKey="rejected" fill={STATUS_COLORS.rejected} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Submissions Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Recent Submissions
          </CardTitle>
          <Link href="/properties">
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
              <Eye className="h-3.5 w-3.5" /> View All
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !recent || recent.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Building className="h-8 w-8" />
              <p className="text-sm">No properties found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Address Code</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Owner</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">Type</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Kebele</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden lg:table-cell">Street</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Registered</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {recent.map((p, idx) => (
                    <tr
                      key={p.id}
                      className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${
                        idx % 2 !== 0 ? "bg-muted/10" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        {p.addressCode ? (
                          <span className="font-mono text-xs text-emerald-700 font-semibold">{p.addressCode}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Not assigned</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-medium truncate max-w-[120px] block">{p.ownerName}</span>
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        <span
                          className="px-1.5 py-0.5 rounded text-xs font-medium"
                          style={{
                            background: (TYPE_COLORS[p.propertyType] ?? "#94a3b8") + "22",
                            color: TYPE_COLORS[p.propertyType] ?? "#94a3b8",
                          }}
                        >
                          {TYPE_LABELS[p.propertyType] ?? p.propertyType}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell text-xs text-muted-foreground">{p.kebele}</td>
                      <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-muted-foreground">{p.streetName}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[p.status] ?? "bg-gray-100 text-gray-700"}`}>
                          {STATUS_LABELS[p.status] ?? p.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell text-xs text-muted-foreground">
                        {p.createdAt
                          ? new Date(p.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link href={`/properties/${p.id}`}>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
                            <Eye className="h-3 w-3" /> View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
