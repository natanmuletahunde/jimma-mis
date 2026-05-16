import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  useGetAuditLogsSummary,
  useListAuditLogs,
  useTrackAuditEvent,
  type AuditLog,
  type ListAuditLogsParams,
} from "@workspace/api-client-react";
import {
  Activity,
  LogIn,
  Building2,
  CheckCircle2,
  Users,
  BarChart3,
  Calendar,
  Search,
  Filter,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type AuditLogItem = AuditLog;


interface Filters {
  search: string;
  action: string;
  entity_type: string;
  role: string;
  from_date: string;
  to_date: string;
}

const EMPTY_FILTERS: Filters = {
  search: "",
  action: "",
  entity_type: "",
  role: "",
  from_date: "",
  to_date: "",
};

const PAGE_SIZE = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function actionLabel(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function actionBadgeVariant(action: string): "default" | "secondary" | "destructive" | "outline" {
  if (action.includes("delete") || action.includes("reject")) return "destructive";
  if (action.includes("approve") || action.includes("verify") || action === "login") return "default";
  if (action.includes("create") || action.includes("submit")) return "secondary";
  return "outline";
}

function roleBadgeColor(role: string | null): string {
  switch (role) {
    case "admin": return "bg-purple-100 text-purple-800";
    case "city_officer": return "bg-blue-100 text-blue-800";
    case "kebele_officer": return "bg-teal-100 text-teal-800";
    case "enumerator": return "bg-amber-100 text-amber-800";
    case "viewer": return "bg-gray-100 text-gray-800";
    default: return "bg-gray-100 text-gray-600";
  }
}

function formatDateTime(iso: string) {
  try {
    return format(parseISO(iso), "dd MMM yyyy, HH:mm:ss");
  } catch {
    return iso;
  }
}

function downloadCsv(logs: AuditLogItem[]) {
  const headers = ["ID", "Date/Time", "User", "Role", "Action", "Entity Type", "Entity", "Details", "IP Address"];
  const rows = logs.map((l) => [
    l.id,
    formatDateTime(l.createdAt),
    l.userName ?? "",
    l.userRole ?? "",
    l.action,
    l.entityType ?? "",
    l.entityName ?? "",
    l.details ?? "",
    l.ipAddress ?? "",
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | undefined;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-card rounded-lg border p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums">{value ?? "—"}</p>
        <p className="text-xs text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
}

// ─── Detail modal ─────────────────────────────────────────────────────────────

function DetailModal({ log, onClose }: { log: AuditLogItem; onClose: () => void }) {
  const fields: [string, string | number | null | undefined][] = [
    ["ID", log.id],
    ["Date / Time", formatDateTime(log.createdAt)],
    ["User", log.userName ?? (log.userId ? `User #${log.userId}` : "System")],
    ["Role", log.userRole],
    ["Action", log.action],
    ["Entity Type", log.entityType],
    ["Entity ID", log.entityId],
    ["Entity Name", log.entityName],
    ["Previous Value", log.oldValue],
    ["New Value", log.newValue],
    ["Details / Remark", log.details],
    ["IP Address", log.ipAddress],
    ["Device / Browser", log.deviceInfo],
  ];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Audit Log Detail
          </DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-2">
          {fields.map(([label, value]) => {
            if (value === null || value === undefined || value === "") return null;
            return (
              <div key={label} className="grid grid-cols-5 gap-2 text-sm">
                <span className="col-span-2 text-muted-foreground font-medium">{label}</span>
                <span className="col-span-3 break-all font-mono text-xs bg-muted rounded px-2 py-1">
                  {String(value)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AuditLogs() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canSeeAllRoles = isAdmin;

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const { data: summary } = useGetAuditLogsSummary();

  const params = useMemo((): ListAuditLogsParams => {
    const p: ListAuditLogsParams = {
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    };
    if (appliedFilters.action) p.action = appliedFilters.action;
    if (appliedFilters.entity_type) p.entity_type = appliedFilters.entity_type;
    if (appliedFilters.role && canSeeAllRoles) p.role = appliedFilters.role;
    if (appliedFilters.from_date) p.from_date = appliedFilters.from_date;
    if (appliedFilters.to_date) p.to_date = appliedFilters.to_date;
    if (appliedFilters.search) p.search = appliedFilters.search;
    return p;
  }, [appliedFilters, page, canSeeAllRoles]);

  const { data: logsData, isLoading, isError } = useListAuditLogs(params);

  const { mutate: trackEvent } = useTrackAuditEvent();

  const logs: AuditLogItem[] = logsData?.logs ?? [];
  const hasMore = logsData?.hasMore ?? false;

  function applyFilters() {
    setAppliedFilters({ ...filters });
    setPage(0);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPage(0);
  }

  const hasActiveFilters = Object.values(appliedFilters).some(Boolean);

  function handleExport() {
    if (!logs.length) return;
    downloadCsv(logs);
    trackEvent({ data: { action: "export_report", entityType: "report", details: `Exported ${logs.length} audit log entries` } });
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Full activity trail — who did what and when
          </p>
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!logs.length}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Summary cards */}
      {(isAdmin || user?.role === "city_officer") && summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <SummaryCard label="Total Events" value={summary.total} icon={Activity} color="bg-primary/10 text-primary" />
          <SummaryCard label="Today" value={summary.today} icon={Calendar} color="bg-blue-100 text-blue-600" />
          <SummaryCard label="Logins" value={summary.logins} icon={LogIn} color="bg-green-100 text-green-600" />
          <SummaryCard label="Property Changes" value={summary.propertyChanges} icon={Building2} color="bg-amber-100 text-amber-600" />
          <SummaryCard label="Approvals" value={summary.approvalActions} icon={CheckCircle2} color="bg-teal-100 text-teal-600" />
          <SummaryCard label="User Management" value={summary.userManagement} icon={Users} color="bg-purple-100 text-purple-600" />
          <SummaryCard label="Report Exports" value={summary.reportExports} icon={BarChart3} color="bg-pink-100 text-pink-600" />
        </div>
      )}

      {/* Filters */}
      <div className="bg-card border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search user, action, entity…"
              className="pl-8"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            />
          </div>

          <Select value={filters.action || "__all__"} onValueChange={(v) => setFilters((f) => ({ ...f, action: v === "__all__" ? "" : v }))}>
            <SelectTrigger><SelectValue placeholder="All Actions" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Actions</SelectItem>
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="create_property">Create Property</SelectItem>
              <SelectItem value="update_property">Update Property</SelectItem>
              <SelectItem value="submit_property">Submit Property</SelectItem>
              <SelectItem value="approve_property">Approve Property</SelectItem>
              <SelectItem value="verify_property">Verify (Kebele)</SelectItem>
              <SelectItem value="reject_property">Reject Property</SelectItem>
              <SelectItem value="resubmit_property">Resubmit Property</SelectItem>
              <SelectItem value="delete_property">Delete Property</SelectItem>
              <SelectItem value="upload_photo">Upload Photo</SelectItem>
              <SelectItem value="delete_photo">Delete Photo</SelectItem>
              <SelectItem value="create_user">Create User</SelectItem>
              <SelectItem value="update_user">Update User</SelectItem>
              <SelectItem value="delete_user">Delete User</SelectItem>
              <SelectItem value="export_report">Export Report</SelectItem>
              <SelectItem value="create_kebele">Create Kebele</SelectItem>
              <SelectItem value="create_street">Create Street</SelectItem>
              <SelectItem value="create_block">Create Block</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.entity_type || "__all__"} onValueChange={(v) => setFilters((f) => ({ ...f, entity_type: v === "__all__" ? "" : v }))}>
            <SelectTrigger><SelectValue placeholder="All Entities" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Entities</SelectItem>
              <SelectItem value="property">Property</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="kebele">Kebele</SelectItem>
              <SelectItem value="street">Street</SelectItem>
              <SelectItem value="block">Block</SelectItem>
              <SelectItem value="report">Report</SelectItem>
            </SelectContent>
          </Select>

          {canSeeAllRoles && (
            <Select value={filters.role || "__all__"} onValueChange={(v) => setFilters((f) => ({ ...f, role: v === "__all__" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="All Roles" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="city_officer">City Officer</SelectItem>
                <SelectItem value="kebele_officer">Kebele Officer</SelectItem>
                <SelectItem value="enumerator">Enumerator</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          )}

          <div className="flex gap-2">
            <Input
              type="date"
              className="flex-1 text-xs"
              value={filters.from_date}
              onChange={(e) => setFilters((f) => ({ ...f, from_date: e.target.value }))}
              title="From date"
            />
            <Input
              type="date"
              className="flex-1 text-xs"
              value={filters.to_date}
              onChange={(e) => setFilters((f) => ({ ...f, to_date: e.target.value }))}
              title="To date"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={applyFilters}>
            <Filter className="h-4 w-4 mr-1.5" />
            Apply Filters
          </Button>
          {hasActiveFilters && (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {logs.length} result{logs.length !== 1 ? "s" : ""}
            {hasMore && " (more available)"}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <Activity className="h-5 w-5 animate-spin mr-2" />
            Loading audit logs…
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center h-48 text-destructive gap-2">
            <AlertCircle className="h-5 w-5" />
            Failed to load audit logs
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <Activity className="h-8 w-8 opacity-30" />
            <p className="text-sm">No audit log entries found</p>
            {hasActiveFilters && (
              <Button variant="link" size="sm" onClick={clearFilters}>Clear filters</Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Date / Time</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">User</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Entity</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Details</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap font-mono">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {log.userName ?? <span className="text-muted-foreground italic">System</span>}
                    </td>
                    <td className="px-4 py-3">
                      {log.userRole ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadgeColor(log.userRole)}`}>
                          {log.userRole.replace("_", " ")}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={actionBadgeVariant(log.action)} className="text-xs whitespace-nowrap">
                        {actionLabel(log.action)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {log.entityType && (
                        <span className="capitalize text-muted-foreground">{log.entityType}</span>
                      )}
                      {log.entityName && (
                        <span className="ml-1 font-medium text-foreground">· {log.entityName}</span>
                      )}
                      {!log.entityType && !log.entityName && "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px]">
                      <span className="truncate block">{log.details ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {(page > 0 || hasMore) && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Detail modal */}
      {selectedLog && (
        <DetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}
