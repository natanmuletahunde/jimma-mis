import { useState, useMemo } from "react";
import {
  useGetPropertyReport,
  useGetEnumeratorPerformance,
  useListKebeles,
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Download,
  Printer,
  Filter,
  RotateCcw,
  FileSpreadsheet,
  CheckCircle2,
  MapPin,
  AlertCircle,
  Users,
  Home,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId =
  | "all"
  | "approved"
  | "commercial"
  | "residential"
  | "missing_gps"
  | "rejected"
  | "performance";

interface UserFilters {
  dateFrom: string;
  dateTo: string;
  kebele: string;
  street: string;
  propertyType: string;
  status: string;
  enumeratorName: string;
}

const EMPTY_FILTERS: UserFilters = {
  dateFrom: "",
  dateTo: "",
  kebele: "",
  street: "",
  propertyType: "",
  status: "",
  enumeratorName: "",
};

// ─── Tab config ───────────────────────────────────────────────────────────────

const ALL_TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "all", label: "All Property Registry", icon: FileSpreadsheet },
  { id: "approved", label: "Approved Addresses", icon: CheckCircle2 },
  { id: "commercial", label: "Commercial", icon: Store },
  { id: "residential", label: "Residential", icon: Home },
  { id: "missing_gps", label: "Missing GPS", icon: MapPin },
  { id: "rejected", label: "Rejected Records", icon: AlertCircle },
  { id: "performance", label: "Enumerator Performance", icon: Users },
];

const TAB_FIXED_STATUS: Partial<Record<TabId, string>> = {
  approved: "approved",
  rejected: "rejected",
};

const TAB_FIXED_TYPE: Partial<Record<TabId, string>> = {
  commercial: "commercial",
  residential: "residential",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, string> = {
    approved: "bg-green-100 text-green-800 border-green-200",
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    rejected: "bg-red-100 text-red-800 border-red-200",
    kebele_verified: "bg-blue-100 text-blue-800 border-blue-200",
    draft: "bg-gray-100 text-gray-700 border-gray-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
        map[status] ?? "bg-gray-100 text-gray-700 border-gray-200",
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function fmt(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function escapeCsv(val: unknown): string {
  const s = String(val ?? "").replace(/"/g, '""');
  return `"${s}"`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Reports() {
  const { user } = useAuth();
  const role = user?.role ?? "viewer";
  const isEnumerator = role === "enumerator";
  const canExport = role !== "viewer";

  // ── Active tab ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>(
    isEnumerator ? "performance" : "all",
  );

  const visibleTabs = useMemo(
    () =>
      isEnumerator
        ? ALL_TABS.filter((t) => t.id === "all" || t.id === "performance")
        : ALL_TABS,
    [isEnumerator],
  );

  // ── Filters ──────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<UserFilters>(EMPTY_FILTERS);
  const [pending, setPending] = useState<UserFilters>(EMPTY_FILTERS);

  const applyFilters = () => setFilters({ ...pending });
  const resetFilters = () => {
    setPending(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
  };

  const { data: kebeles } = useListKebeles();

  // ── Computed query params for property reports ────────────────────────────
  const queryParams = useMemo(() => {
    if (activeTab === "performance") return undefined;

    const p: Record<string, string> = {};
    if (filters.kebele) p.kebele = filters.kebele;
    if (filters.street) p.street_name = filters.street;
    if (filters.enumeratorName) p.enumerator_name = filters.enumeratorName;
    if (filters.dateFrom) p.from_date = filters.dateFrom;
    if (filters.dateTo) p.to_date = filters.dateTo;

    // Status: user filter can be overridden by tab fixed filter
    const fixedStatus = TAB_FIXED_STATUS[activeTab];
    if (fixedStatus) p.status = fixedStatus;
    else if (filters.status) p.status = filters.status;

    // Type: user filter can be overridden by tab fixed type
    const fixedType = TAB_FIXED_TYPE[activeTab];
    if (fixedType) p.property_type = fixedType;
    else if (filters.propertyType) p.property_type = filters.propertyType;

    return p;
  }, [activeTab, filters]);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const {
    data: reportData,
    isLoading: loadingReport,
    isFetching: fetchingReport,
  } = useGetPropertyReport(
    activeTab !== "performance"
      ? (queryParams as Parameters<typeof useGetPropertyReport>[0])
      : undefined,
  );

  const { data: perfData, isLoading: loadingPerf } = useGetEnumeratorPerformance();

  // ── Derived property list (client-side missing GPS filter) ────────────────
  const displayProperties = useMemo(() => {
    const all = reportData?.properties ?? [];
    if (activeTab === "missing_gps") {
      return all.filter((p) => p.latitude == null || p.longitude == null);
    }
    return all;
  }, [reportData, activeTab]);

  const summary = reportData?.summary;

  // ── CSV export ────────────────────────────────────────────────────────────
  const handleExportCsv = () => {
    if (activeTab === "performance") {
      if (!perfData?.length) return;
      const headers = [
        "Enumerator Name",
        "Kebele",
        "Total Registered",
        "Draft",
        "Submitted",
        "Verified",
        "Approved",
        "Rejected",
        "Missing GPS",
      ];
      const rows = [
        headers,
        ...perfData.map((p) => [
          p.enumeratorName,
          p.kebele ?? "—",
          p.totalRegistered,
          p.draft,
          p.pending,
          p.kebeleVerified,
          p.approved,
          p.rejected,
          p.missingGps,
        ]),
      ];
      downloadCsv(`jimma_enumerator_performance_${today()}.csv`, rows as string[][]);
    } else {
      if (!displayProperties.length) return;
      const headers = [
        "Address Code",
        "Owner Name",
        "Owner Phone",
        "Property Type",
        "Kebele",
        "Street Name",
        "Block Code",
        "House Number",
        "Status",
        "Created By",
        "Created Date",
      ];
      const rows = [
        headers,
        ...displayProperties.map((p) => [
          p.addressCode ?? "—",
          p.ownerName,
          p.ownerPhone ?? "—",
          p.propertyType,
          p.kebele,
          p.streetName,
          p.blockCode ?? "—",
          p.houseNumber ?? "—",
          p.status,
          (p as { createdByUser?: { fullName?: string } }).createdByUser?.fullName ?? "—",
          fmt(p.createdAt),
        ]),
      ];
      downloadCsv(`jimma_report_${activeTab}_${today()}.csv`, rows as string[][]);
    }
  };

  const handlePrint = () => window.print();

  // ── Filter panel: which controls to show ─────────────────────────────────
  const showStatusFilter =
    activeTab !== "approved" && activeTab !== "rejected" && activeTab !== "performance";
  const showTypeFilter =
    activeTab !== "commercial" && activeTab !== "residential" && activeTab !== "performance";

  // ── Active filter summary for print ──────────────────────────────────────
  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (filters.dateFrom) parts.push(`From: ${filters.dateFrom}`);
    if (filters.dateTo) parts.push(`To: ${filters.dateTo}`);
    if (filters.kebele) parts.push(`Kebele: ${filters.kebele}`);
    if (filters.street) parts.push(`Street: ${filters.street}`);
    if (filters.status) parts.push(`Status: ${filters.status}`);
    if (filters.propertyType) parts.push(`Type: ${filters.propertyType}`);
    if (filters.enumeratorName) parts.push(`Enumerator: ${filters.enumeratorName}`);
    return parts.join(" | ");
  }, [filters]);

  const loading =
    activeTab === "performance" ? loadingPerf : loadingReport || fetchingReport;

  return (
    <div className="space-y-6 pb-8">
      {/* ─── Print-only header ─────────────────────────────────────────── */}
      <div className="hidden print:block mb-4 border-b pb-4">
        <div className="font-bold text-xl">Jimma City Address MIS — Reports</div>
        <div className="text-sm text-gray-600 mt-1">
          Report: {ALL_TABS.find((t) => t.id === activeTab)?.label}
        </div>
        <div className="text-sm text-gray-500 mt-0.5">
          Generated: {new Date().toLocaleString()}
        </div>
        {filterSummary && (
          <div className="text-sm text-gray-500 mt-0.5">Filters: {filterSummary}</div>
        )}
      </div>

      {/* ─── Page header ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reports &amp; Export</h2>
          <p className="text-sm text-muted-foreground">
            Generate, filter, and export property data.
          </p>
        </div>
        <div className="flex gap-2">
          {canExport && (
            <Button
              onClick={handleExportCsv}
              disabled={
                activeTab === "performance"
                  ? !perfData?.length
                  : !displayProperties.length
              }
              variant="outline"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          )}
          <Button onClick={handlePrint} variant="outline" size="sm">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* ─── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1 border-b print:hidden">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors",
              activeTab === tab.id
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/40",
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Filter panel ─────────────────────────────────────────────── */}
      <Card className="print:hidden">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {/* Date From */}
            <div className="space-y-1">
              <Label className="text-xs">Date From</Label>
              <Input
                type="date"
                value={pending.dateFrom}
                onChange={(e) => setPending((f) => ({ ...f, dateFrom: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>

            {/* Date To */}
            <div className="space-y-1">
              <Label className="text-xs">Date To</Label>
              <Input
                type="date"
                value={pending.dateTo}
                onChange={(e) => setPending((f) => ({ ...f, dateTo: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>

            {/* Kebele */}
            <div className="space-y-1">
              <Label className="text-xs">Kebele</Label>
              <Select
                value={pending.kebele || "all"}
                onValueChange={(v) => setPending((f) => ({ ...f, kebele: v === "all" ? "" : v }))}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="All Kebeles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Kebeles</SelectItem>
                  {kebeles?.map((k) => (
                    <SelectItem key={k.id} value={k.name}>
                      {k.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Street */}
            <div className="space-y-1">
              <Label className="text-xs">Street</Label>
              <Input
                placeholder="Search street…"
                value={pending.street}
                onChange={(e) => setPending((f) => ({ ...f, street: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>

            {/* Property Type */}
            {showTypeFilter && (
              <div className="space-y-1">
                <Label className="text-xs">Property Type</Label>
                <Select
                  value={pending.propertyType || "all"}
                  onValueChange={(v) =>
                    setPending((f) => ({ ...f, propertyType: v === "all" ? "" : v }))
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="residential">Residential</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="government">Government</SelectItem>
                    <SelectItem value="institution">Institution</SelectItem>
                    <SelectItem value="mixed_use">Mixed Use</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Status */}
            {showStatusFilter && (
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select
                  value={pending.status || "all"}
                  onValueChange={(v) =>
                    setPending((f) => ({ ...f, status: v === "all" ? "" : v }))
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="kebele_verified">Kebele Verified</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Enumerator */}
            <div className="space-y-1">
              <Label className="text-xs">Enumerator</Label>
              <Input
                placeholder="Name search…"
                value={pending.enumeratorName}
                onChange={(e) => setPending((f) => ({ ...f, enumeratorName: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Filter action buttons */}
          <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t">
            <Button onClick={applyFilters} size="sm" className="h-8">
              <Filter className="w-3.5 h-3.5 mr-1.5" />
              Apply Filter
            </Button>
            <Button onClick={resetFilters} size="sm" variant="outline" className="h-8">
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Reset
            </Button>
            <div className="flex-1" />
            {canExport && (
              <Button
                onClick={handleExportCsv}
                disabled={
                  activeTab === "performance"
                    ? !perfData?.length
                    : !displayProperties.length
                }
                size="sm"
                variant="outline"
                className="h-8"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Export CSV
              </Button>
            )}
            <Button onClick={handlePrint} size="sm" variant="outline" className="h-8">
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Print
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Summary cards (property tabs only) ───────────────────────── */}
      {activeTab !== "performance" && summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 print:hidden">
          <SummaryCard label="Total" value={summary.total} color="bg-primary text-primary-foreground" />
          <SummaryCard label="Approved" value={summary.approved} color="bg-green-50 text-green-700" />
          <SummaryCard label="Pending" value={summary.pending} color="bg-amber-50 text-amber-700" />
          <SummaryCard label="Rejected" value={summary.rejected} color="bg-red-50 text-red-700" />
          <SummaryCard label="Kebele Verified" value={summary.kebeleVerified ?? 0} color="bg-blue-50 text-blue-700" />
          <SummaryCard label="No GPS" value={summary.withoutGps} color="bg-gray-50 text-gray-700" />
        </div>
      )}

      {/* ─── Main data table ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="py-3 px-4 border-b print:hidden">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            {ALL_TABS.find((t) => t.id === activeTab)?.label}
            <Badge variant="outline" className="ml-auto text-xs">
              {activeTab === "performance"
                ? `${perfData?.length ?? 0} enumerators`
                : `${displayProperties.length} records`}
            </Badge>
          </CardTitle>
        </CardHeader>

        {/* Print-only table title */}
        <div className="hidden print:block px-4 py-2 border-b font-semibold text-sm">
          {ALL_TABS.find((t) => t.id === activeTab)?.label}
          {" — "}
          {activeTab === "performance"
            ? `${perfData?.length ?? 0} enumerators`
            : `${displayProperties.length} records`}
        </div>

        <CardContent className="p-0">
          {activeTab === "performance" ? (
            <PerformanceTable data={perfData ?? []} loading={loadingPerf} />
          ) : (
            <PropertyTable
              properties={displayProperties}
              loading={loading}
              tabId={activeTab}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card className={cn("border", color)}>
      <CardContent className="p-4">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs opacity-80 mt-0.5">{label}</div>
      </CardContent>
    </Card>
  );
}

// ─── Property table ───────────────────────────────────────────────────────────

type PropertyRow = {
  id: number;
  addressCode?: string | null;
  ownerName: string;
  ownerPhone?: string | null;
  propertyType: string;
  kebele: string;
  streetName: string;
  blockCode?: string | null;
  houseNumber?: string | null;
  status: string;
  createdAt: string;
  createdByUser?: { fullName?: string } | null;
  latitude?: number | null;
  longitude?: number | null;
};

function PropertyTable({
  properties,
  loading,
  tabId,
}: {
  properties: PropertyRow[];
  loading: boolean;
  tabId: TabId;
}) {
  const COLS = 11;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="text-xs">
            <TableHead className="whitespace-nowrap">Address Code</TableHead>
            <TableHead className="whitespace-nowrap">Owner Name</TableHead>
            <TableHead className="whitespace-nowrap">Phone</TableHead>
            <TableHead className="whitespace-nowrap">Type</TableHead>
            <TableHead className="whitespace-nowrap">Kebele</TableHead>
            <TableHead className="whitespace-nowrap">Street</TableHead>
            <TableHead className="whitespace-nowrap">Block</TableHead>
            <TableHead className="whitespace-nowrap">House No.</TableHead>
            {tabId !== "approved" && tabId !== "rejected" && tabId !== "commercial" && tabId !== "residential" && (
              <TableHead className="whitespace-nowrap">Status</TableHead>
            )}
            <TableHead className="whitespace-nowrap">Created By</TableHead>
            <TableHead className="whitespace-nowrap">Date</TableHead>
            {tabId === "missing_gps" && (
              <TableHead className="whitespace-nowrap">GPS</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={COLS} className="h-28 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
              </TableCell>
            </TableRow>
          ) : properties.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLS} className="h-28 text-center text-muted-foreground text-sm">
                No records match the current filters.
              </TableCell>
            </TableRow>
          ) : (
            properties.map((p) => (
              <TableRow key={p.id} className="text-xs hover:bg-muted/30">
                <TableCell className="font-mono font-medium whitespace-nowrap">
                  {p.addressCode ?? (
                    <span className="text-muted-foreground italic">pending</span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">{p.ownerName}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {p.ownerPhone ?? "—"}
                </TableCell>
                <TableCell className="capitalize whitespace-nowrap">
                  {p.propertyType.replace(/_/g, " ")}
                </TableCell>
                <TableCell className="whitespace-nowrap">{p.kebele}</TableCell>
                <TableCell className="whitespace-nowrap">{p.streetName}</TableCell>
                <TableCell className="whitespace-nowrap">{p.blockCode ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{p.houseNumber ?? "—"}</TableCell>
                {tabId !== "approved" && tabId !== "rejected" && tabId !== "commercial" && tabId !== "residential" && (
                  <TableCell className="whitespace-nowrap">{statusBadge(p.status)}</TableCell>
                )}
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {p.createdByUser?.fullName ?? "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {fmt(p.createdAt)}
                </TableCell>
                {tabId === "missing_gps" && (
                  <TableCell className="whitespace-nowrap">
                    <span className="text-red-500 text-xs">No GPS</span>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Enumerator Performance table ─────────────────────────────────────────────

type PerfRow = {
  enumeratorId: number;
  enumeratorName: string;
  kebele?: string | null;
  totalRegistered: number;
  draft: number;
  pending: number;
  kebeleVerified: number;
  approved: number;
  rejected: number;
  missingGps: number;
};

function PerformanceTable({ data, loading }: { data: PerfRow[]; loading: boolean }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="text-xs">
            <TableHead>Enumerator Name</TableHead>
            <TableHead>Assigned Kebele</TableHead>
            <TableHead className="text-center">Total</TableHead>
            <TableHead className="text-center">Draft</TableHead>
            <TableHead className="text-center">Submitted</TableHead>
            <TableHead className="text-center">Verified</TableHead>
            <TableHead className="text-center">Approved</TableHead>
            <TableHead className="text-center">Rejected</TableHead>
            <TableHead className="text-center">No GPS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={9} className="h-28 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
              </TableCell>
            </TableRow>
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="h-28 text-center text-muted-foreground text-sm">
                No enumerator data available.
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow key={row.enumeratorId} className="text-xs hover:bg-muted/30">
                <TableCell className="font-medium">{row.enumeratorName}</TableCell>
                <TableCell className="text-muted-foreground">{row.kebele ?? "—"}</TableCell>
                <TableCell className="text-center font-semibold">{row.totalRegistered}</TableCell>
                <TableCell className="text-center text-gray-500">{row.draft}</TableCell>
                <TableCell className="text-center text-amber-600">{row.pending}</TableCell>
                <TableCell className="text-center text-blue-600">{row.kebeleVerified}</TableCell>
                <TableCell className="text-center text-green-600 font-medium">{row.approved}</TableCell>
                <TableCell className="text-center text-red-500">{row.rejected}</TableCell>
                <TableCell className="text-center text-gray-400">{row.missingGps}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().split("T")[0];
}
