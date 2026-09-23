import { useState, useMemo } from "react";
import { Redirect } from "wouter";
import {
  useGetRoadInventorySummary,
  useListRoadMaintenanceRecords,
  useCreateRoadMaintenanceRecord,
  useUpdateRoadMaintenanceRecord,
  useDeleteRoadMaintenanceRecord,
  useListStreets,
  useListKebeles,
  getGetRoadInventorySummaryQueryKey,
  getListRoadMaintenanceRecordsQueryKey,
  getListStreetsQueryKey,
  type RoadMaintenanceRecord,
  type RoadMaintenanceRecordInput,
  type RoadMaintenanceRecordInputActivityType,
  type RoadMaintenanceRecordInputFundingSource,
  type RoadMaintenanceRecordInputStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Wrench,
  Search,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Calendar,
  AlertTriangle,
  Clock,
  History,
  Coins,
  Footprints,
  Lightbulb,
  Droplets,
  MapPin,
  CheckCircle2,
  AlertCircle,
  FileText,
  Activity,
  ArrowUpRight,
} from "lucide-react";

type Street = {
  id: number;
  name: string;
  code: string;
  kebeleId: number;
  kebeleName: string | null;
  streetType: string | null;
  roadSurface: string | null;
  lengthMeters: number | null;
  widthMeters: number | null;
  lanes: number | null;
  hasSidewalk: boolean | null;
  hasStreetLights: boolean | null;
  hasDrainage: boolean | null;
  condition: string | null;
  lastResurfacedYear: number | null;
  lastPciScore: number | null;
  lastPciRating: string | null;
  nextInspectionDate: string | null;
  maintenancePriority: string | null;
  startIntersection: string | null;
  endIntersection: string | null;
  status: string;
};

type Kebele = { id: number; name: string; code: string };

const ACTIVITY_TYPES: { value: RoadMaintenanceRecordInputActivityType; label: string; badge: string }[] = [
  { value: "inspection", label: "Periodic PCI Inspection", badge: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "resurfacing", label: "Full Resurfacing / Paving", badge: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { value: "pothole_patching", label: "Pothole Patching & Crack Seal", badge: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "drainage_clearing", label: "Drainage & Gutter Clearing", badge: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  { value: "lighting_repair", label: "Street Lighting Maintenance", badge: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "expansion", label: "Road Widening / Expansion", badge: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "emergency_repair", label: "Emergency Washout Repair", badge: "bg-rose-100 text-rose-800 border-rose-200" },
];

const FUNDING_SOURCES: { value: string; label: string }[] = [
  { value: "municipal_budget", label: "Jimma Municipal Capital Budget" },
  { value: "regional_grant", label: "Oromia Regional Road Fund" },
  { value: "federal_grant", label: "Federal Urban Safety Net Grant" },
  { value: "community_fund", label: "Community / Idadir Contribution" },
];

function getPciDescriptor(score: number | null | undefined) {
  if (score == null || isNaN(score)) return { rating: "Not Inspected", color: "text-muted-foreground", bg: "bg-slate-100 text-slate-700", bar: "bg-slate-400" };
  if (score >= 85) return { rating: "Good (85–100)", color: "text-emerald-700", bg: "bg-emerald-100 text-emerald-800 border-emerald-200", bar: "bg-emerald-500" };
  if (score >= 70) return { rating: "Satisfactory (70–84)", color: "text-teal-700", bg: "bg-teal-100 text-teal-800 border-teal-200", bar: "bg-teal-500" };
  if (score >= 55) return { rating: "Fair (55–69)", color: "text-amber-700", bg: "bg-amber-100 text-amber-800 border-amber-200", bar: "bg-amber-500" };
  if (score >= 40) return { rating: "Poor (40–54)", color: "text-orange-700", bg: "bg-orange-100 text-orange-800 border-orange-200", bar: "bg-orange-500" };
  if (score >= 25) return { rating: "Very Poor (25–39)", color: "text-rose-700", bg: "bg-rose-100 text-rose-800 border-rose-200", bar: "bg-rose-500" };
  if (score >= 10) return { rating: "Serious (10–24)", color: "text-rose-800", bg: "bg-rose-200 text-rose-900 border-rose-300", bar: "bg-rose-700" };
  return { rating: "Failed (0–9)", color: "text-red-950", bg: "bg-neutral-900 text-white", bar: "bg-neutral-950" };
}

function getPriorityBadge(priority: string | null | undefined) {
  switch (priority) {
    case "critical":
      return <Badge className="bg-rose-600 text-white border-0">Critical Priority</Badge>;
    case "high":
      return <Badge className="bg-amber-500 text-white border-0">High Priority</Badge>;
    case "medium":
      return <Badge className="bg-blue-500 text-white border-0">Medium</Badge>;
    default:
      return <Badge variant="outline" className="text-muted-foreground border-slate-300">Routine</Badge>;
  }
}

// ─── Modal 1: Log Maintenance / Inspection ─────────────────────────
function MaintenanceRecordDialog({
  open,
  onOpenChange,
  editItem,
  preselectedStreetId,
  streets,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editItem: RoadMaintenanceRecord | null;
  preselectedStreetId: number | null;
  streets: Street[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const createRecord = useCreateRoadMaintenanceRecord();
  const updateRecord = useUpdateRoadMaintenanceRecord();
  const isEdit = editItem !== null;

  const [streetId, setStreetId] = useState<string>(() => {
    if (editItem) return editItem.streetId.toString();
    if (preselectedStreetId) return preselectedStreetId.toString();
    return streets[0]?.id?.toString() ?? "";
  });
  const [activityType, setActivityType] = useState<string>(
    editItem?.activityType ?? "inspection"
  );
  const [pciScore, setPciScore] = useState<string>(editItem?.pciScore?.toString() ?? "80");
  const [distressTypes, setDistressTypes] = useState(editItem?.distressTypes ?? "");
  const [performedDate, setPerformedDate] = useState(
    editItem?.performedDate ? editItem.performedDate.split("T")[0] : new Date().toISOString().split("T")[0]
  );
  const [contractor, setContractor] = useState(editItem?.contractor ?? "Jimma Municipal Works Bureau");
  const [costEtb, setCostEtb] = useState(editItem?.costEtb?.toString() ?? "");
  const [fundingSource, setFundingSource] = useState<string>(
    editItem?.fundingSource ?? "municipal_budget"
  );
  const [nextInspectionDue, setNextInspectionDue] = useState(
    editItem?.nextInspectionDue ? editItem.nextInspectionDue.split("T")[0] : ""
  );
  const [status, setStatus] = useState<string>(
    editItem?.status ?? "completed"
  );
  const [inspectorName, setInspectorName] = useState(editItem?.inspectorName ?? "");
  const [notes, setNotes] = useState(editItem?.notes ?? "");

  const numPci = parseInt(pciScore, 10);
  const pciDesc = getPciDescriptor(isNaN(numPci) ? null : numPci);

  function handleSubmit() {
    if (!streetId) {
      toast({ variant: "destructive", title: "Street is required" });
      return;
    }
    if (!performedDate) {
      toast({ variant: "destructive", title: "Date is required" });
      return;
    }

    const payload: RoadMaintenanceRecordInput = {
      streetId: parseInt(streetId, 10),
      activityType: (activityType as RoadMaintenanceRecordInputActivityType) || "inspection",
      pciScore: !isNaN(numPci) && numPci >= 0 && numPci <= 100 ? numPci : null,
      distressTypes: distressTypes.trim() || null,
      performedDate: new Date(performedDate).toISOString(),
      contractor: contractor.trim() || null,
      costEtb: costEtb ? parseFloat(costEtb) : null,
      fundingSource: (fundingSource as RoadMaintenanceRecordInputFundingSource) || null,
      nextInspectionDue: nextInspectionDue ? new Date(nextInspectionDue).toISOString() : null,
      status: (status as RoadMaintenanceRecordInputStatus) || "completed",
      inspectorName: inspectorName.trim() || null,
      notes: notes.trim() || null,
    };

    if (isEdit) {
      updateRecord.mutate(
        { id: editItem.id, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Maintenance record updated" });
            onOpenChange(false);
            onSaved();
          },
          onError: () => toast({ variant: "destructive", title: "Failed to update record" }),
        }
      );
    } else {
      createRecord.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Activity / Inspection logged successfully" });
            onOpenChange(false);
            onSaved();
          },
          onError: () => toast({ variant: "destructive", title: "Failed to log maintenance record" }),
        }
      );
    }
  }

  const isPending = createRecord.isPending || updateRecord.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            {isEdit ? "Edit Maintenance / Inspection Record" : "Log Road Maintenance / PCI Inspection"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Target Street */}
          <div className="grid gap-1.5">
            <Label>Target Street Corridor <span className="text-destructive">*</span></Label>
            <select
              value={streetId}
              onChange={(e) => setStreetId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select a street…</option>
              {streets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code}) — {s.kebeleName ?? `Kebele #${s.kebeleId}`}
                </option>
              ))}
            </select>
          </div>

          {/* Activity Type & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Activity / Work Type <span className="text-destructive">*</span></Label>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value as RoadMaintenanceRecordInputActivityType)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {ACTIVITY_TYPES.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>Date Performed / Inspected <span className="text-destructive">*</span></Label>
              <Input
                type="date"
                value={performedDate}
                onChange={(e) => setPerformedDate(e.target.value)}
              />
            </div>
          </div>

          {/* PCI Rating Section */}
          <div className="rounded-lg border p-3.5 bg-slate-50/60 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-semibold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-primary" /> Pavement Condition Index (PCI)
                </Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">ASTM D6433 rating scale ($0–100$)</p>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${pciDesc.bg}`}>
                {pciDesc.rating}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-3 items-center">
              <div className="col-span-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={pciScore}
                  onChange={(e) => setPciScore(e.target.value)}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>
              <div>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={pciScore}
                  onChange={(e) => setPciScore(e.target.value)}
                  className="font-mono text-center font-bold"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Observed Surface Distress / Deterioration Notes</Label>
              <Input
                value={distressTypes}
                onChange={(e) => setDistressTypes(e.target.value)}
                placeholder="e.g. Alligator cracking, edge ravelling, localized rutting"
              />
            </div>
          </div>

          {/* Contractor & Cost */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Contractor / Implementing Entity</Label>
              <Input
                value={contractor}
                onChange={(e) => setContractor(e.target.value)}
                placeholder="e.g. Sur Construction PLC or Jimma Works"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Maintenance Cost (ETB)</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={costEtb}
                onChange={(e) => setCostEtb(e.target.value)}
                placeholder="e.g. 450000"
              />
            </div>
          </div>

          {/* Funding Source & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Funding Source</Label>
              <select
                value={fundingSource}
                onChange={(e) => setFundingSource(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {FUNDING_SOURCES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>Work Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="completed">Completed</option>
                <option value="in_progress">In Progress</option>
                <option value="scheduled">Scheduled</option>
                <option value="deferred">Deferred / Postponed</option>
              </select>
            </div>
          </div>

          {/* Next Inspection Due & Inspector */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Next Scheduled Inspection Due</Label>
              <Input
                type="date"
                value={nextInspectionDue}
                onChange={(e) => setNextInspectionDue(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Inspector / Supervising Engineer</Label>
              <Input
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                placeholder="e.g. Eng. Dawit Bekele"
              />
            </div>
          </div>

          {/* Engineering Notes */}
          <div className="grid gap-1.5">
            <Label>Technical Notes & Recommendations</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Engineering remarks, material specifications, or structural notes…"
              className="min-h-[50px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? "Save Changes" : "Log Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal 2: Single Road Lifecycle History Drawer ──────────────────
function RoadHistoryDialog({
  street,
  open,
  onOpenChange,
  records,
  onLogNew,
}: {
  street: Street | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  records: RoadMaintenanceRecord[];
  onLogNew: () => void;
}) {
  if (!street) return null;

  const streetRecords = records.filter((r) => r.streetId === street.id);
  const totalSpent = streetRecords.reduce((acc, r) => acc + (r.costEtb || 0), 0);
  const pciDesc = getPciDescriptor(street.lastPciScore);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between pr-6">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                {street.name} <span className="font-mono text-xs font-normal text-muted-foreground">({street.code})</span>
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {street.kebeleName ?? `Kebele #${street.kebeleId}`} • {street.streetType || "Road"} • {street.roadSurface || "Paved"}
              </p>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${pciDesc.bg}`}>
                PCI: {street.lastPciScore ?? "—"} • {pciDesc.rating.split(" ")[0]}
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* Quick specs grid */}
        <div className="grid grid-cols-4 gap-2.5 p-3 rounded-lg bg-slate-50 border text-xs">
          <div>
            <p className="text-muted-foreground">Corridor Length</p>
            <p className="font-bold tabular-nums">
              {street.lengthMeters ? (street.lengthMeters >= 1000 ? `${(street.lengthMeters / 1000).toFixed(2)} km` : `${street.lengthMeters} m`) : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Width & Lanes</p>
            <p className="font-bold">
              {street.widthMeters ? `${street.widthMeters}m` : "—"} ({street.lanes ?? 2} lanes)
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Last Resurfaced</p>
            <p className="font-bold">{street.lastResurfacedYear ?? "Not recorded"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Capital Spent</p>
            <p className="font-bold text-emerald-700 font-mono">
              {totalSpent.toLocaleString()} ETB
            </p>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <History className="h-3.5 w-3.5 text-primary" /> Lifecycle Maintenance & Inspection History ({streetRecords.length})
            </h4>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onLogNew}>
              <Plus className="h-3.5 w-3.5" /> Log Activity
            </Button>
          </div>

          {streetRecords.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-xs border border-dashed rounded-lg">
              No previous maintenance records or inspection logs found for this corridor.
            </div>
          ) : (
            <div className="space-y-2.5">
              {streetRecords.map((r) => {
                const act = ACTIVITY_TYPES.find((a) => a.value === r.activityType) ?? ACTIVITY_TYPES[0];
                const recPci = getPciDescriptor(r.pciScore);
                return (
                  <div key={r.id} className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${act.badge}`}>
                          {act.label}
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {new Date(r.performedDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      {r.pciScore != null && (
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${recPci.bg}`}>
                          PCI {r.pciScore}
                        </span>
                      )}
                    </div>
                    {r.distressTypes && (
                      <p className="text-slate-600 italic">
                        &quot;{r.distressTypes}&quot;
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground pt-1 border-t text-[11px]">
                      {r.contractor && <span>Contractor: <strong className="text-foreground">{r.contractor}</strong></span>}
                      {r.costEtb != null && (
                        <span>Cost: <strong className="text-foreground font-mono">{r.costEtb.toLocaleString()} ETB</strong></span>
                      )}
                      {r.inspectorName && <span>Inspector: <strong className="text-foreground">{r.inspectorName}</strong></span>}
                      {r.nextInspectionDue && (
                        <span>Next Due: <strong className="text-foreground">{new Date(r.nextInspectionDue).toLocaleDateString("en-GB")}</strong></span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page Component ──────────────────────────────────────────
export default function RoadInventoryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const canEdit = user?.role === "admin" || user?.role === "city_officer";
  const canDelete = user?.role === "admin";
  if (!canEdit && user?.role !== "kebele_officer" && user?.role !== "viewer") return <Redirect to="/dashboard" />;

  const [activeTab, setActiveTab] = useState<"assets" | "records">("assets");
  const [search, setSearch] = useState("");
  const [kebeleFilter, setKebeleFilter] = useState("");
  const [pciFilter, setPciFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<RoadMaintenanceRecord | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Street | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoadMaintenanceRecord | null>(null);
  const [preselectedStreetId, setPreselectedStreetId] = useState<number | null>(null);

  // Queries
  const { data: summary, isLoading: isSummaryLoading } = useGetRoadInventorySummary();
  const { data: streets = [], isLoading: isStreetsLoading } = useListStreets();
  const { data: kebeles = [] } = useListKebeles();
  const { data: records = [], isLoading: isRecordsLoading } = useListRoadMaintenanceRecords();
  const deleteRecord = useDeleteRoadMaintenanceRecord();

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: getGetRoadInventorySummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListRoadMaintenanceRecordsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListStreetsQueryKey() });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteRecord.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: "Maintenance record deleted" });
          setDeleteTarget(null);
        },
        onError: () => {
          toast({ variant: "destructive", title: "Failed to delete record" });
          setDeleteTarget(null);
        },
      }
    );
  }

  // Filtered streets
  const filteredStreets = useMemo(() => {
    return (streets as Street[]).filter((s) => {
      if (kebeleFilter && s.kebeleId.toString() !== kebeleFilter) return false;
      if (priorityFilter && (s.maintenancePriority || "routine") !== priorityFilter) return false;
      if (pciFilter) {
        const score = s.lastPciScore ?? 70;
        if (pciFilter === "good" && score < 85) return false;
        if (pciFilter === "satisfactory" && (score < 70 || score >= 85)) return false;
        if (pciFilter === "fair" && (score < 55 || score >= 70)) return false;
        if (pciFilter === "poor" && score >= 55) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          (s.kebeleName ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [streets, kebeleFilter, priorityFilter, pciFilter, search]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return (records as RoadMaintenanceRecord[]).filter((r) => {
      if (activityFilter && r.activityType !== activityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (r.streetName ?? "").toLowerCase().includes(q) ||
          (r.streetCode ?? "").toLowerCase().includes(q) ||
          (r.contractor ?? "").toLowerCase().includes(q) ||
          (r.inspectorName ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, activityFilter, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <Wrench className="h-6 w-6 text-primary" /> Road Inventory & Maintenance
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Municipal asset management, ASTM D6433 Pavement Condition Index (PCI) ratings, and repaving project schedules.
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={() => {
              setEditItem(null);
              setPreselectedStreetId(null);
              setDialogOpen(true);
            }}
            className="gap-2 shrink-0"
          >
            <Plus className="h-4 w-4" /> Log Maintenance / Inspection
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card>
          <div className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-slate-600 text-white shrink-0">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Monitored Network</p>
              <p className="text-lg font-bold tabular-nums">
                {isSummaryLoading ? "—" : `${summary?.totalStreets ?? 0} streets`}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {summary?.totalKilometers ?? 0} km total length
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-teal-600 text-white shrink-0">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Average PCI Score</p>
              <p className="text-lg font-bold tabular-nums text-teal-700">
                {isSummaryLoading ? "—" : `${summary?.averagePci ?? 0} / 100`}
              </p>
              <p className="text-[11px] font-medium text-teal-800">
                {getPciDescriptor(summary?.averagePci).rating.split(" ")[0]}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-rose-600 text-white shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Needs Repaving</p>
              <p className="text-lg font-bold tabular-nums text-rose-700">
                {isSummaryLoading ? "—" : summary?.needsRepavingCount ?? 0}
              </p>
              <p className="text-[11px] text-muted-foreground">PCI &lt; 55 or Critical</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-600 text-white shrink-0">
              <Coins className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Capital Invested</p>
              <p className="text-lg font-bold tabular-nums text-emerald-800">
                {isSummaryLoading ? "—" : `${((summary?.totalMaintenanceSpentEtb ?? 0) / 1000000).toFixed(1)}M`}
              </p>
              <p className="text-[11px] text-muted-foreground font-mono">ETB completed</p>
            </div>
          </div>
        </Card>

        <Card className="col-span-2 lg:col-span-1">
          <div className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-600 text-white shrink-0">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Inspections Due</p>
              <p className="text-lg font-bold tabular-nums text-amber-700">
                {isSummaryLoading ? "—" : summary?.upcomingInspectionsCount ?? 0}
              </p>
              <p className="text-[11px] text-muted-foreground">Within next 60 days</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-2">
          <TabsList className="bg-muted">
            <TabsTrigger value="assets" className="gap-2">
              <MapPin className="h-4 w-4" /> Road Assets & PCI Matrix ({streets.length})
            </TabsTrigger>
            <TabsTrigger value="records" className="gap-2">
              <History className="h-4 w-4" /> Maintenance & Inspection Audit ({records.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Tab 1: Road Assets & PCI Matrix ── */}
        <TabsContent value="assets" className="space-y-4">
          <Card>
            <CardContent className="p-3.5">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search road by name, code, or kebele…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  value={kebeleFilter}
                  onChange={(e) => setKebeleFilter(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-w-[140px]"
                >
                  <option value="">All Kebeles</option>
                  {(kebeles as Kebele[]).map((k) => (
                    <option key={k.id} value={k.id}>{k.name}</option>
                  ))}
                </select>
                <select
                  value={pciFilter}
                  onChange={(e) => setPciFilter(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-w-[150px]"
                >
                  <option value="">All PCI Tiers</option>
                  <option value="good">Good (85–100)</option>
                  <option value="satisfactory">Satisfactory (70–84)</option>
                  <option value="fair">Fair (55–69)</option>
                  <option value="poor">Poor / Critical (&lt;55)</option>
                </select>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-w-[140px]"
                >
                  <option value="">All Priorities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="routine">Routine</option>
                </select>
                {(search || kebeleFilter || pciFilter || priorityFilter) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setKebeleFilter("");
                      setPciFilter("");
                      setPriorityFilter("");
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {isStreetsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredStreets.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                  <Wrench className="h-10 w-10 text-muted-foreground/50" />
                  <p className="text-sm font-medium">No road assets match the selected criteria</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        {["Code", "Corridor / Name", "Kebele", "Specs & Dimensions", "Utilities", "PCI Score & Condition", "Resurfaced", "Next Inspection", "Priority", ""].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStreets.map((s, idx) => {
                        const pci = getPciDescriptor(s.lastPciScore);
                        const isInspectionSoon = s.nextInspectionDate && new Date(s.nextInspectionDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                        return (
                          <tr
                            key={s.id}
                            className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${idx % 2 !== 0 ? "bg-muted/10" : ""}`}
                          >
                            <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{s.code}</td>
                            <td className="px-4 py-3 font-medium">
                              <div>{s.name}</div>
                              {(s.startIntersection || s.endIntersection) && (
                                <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 font-normal">
                                  <MapPin className="h-3 w-3 shrink-0 text-primary/70" />
                                  <span className="truncate max-w-[200px]">
                                    {s.startIntersection && s.endIntersection
                                      ? `${s.startIntersection} → ${s.endIntersection}`
                                      : s.startIntersection || s.endIntersection}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{s.kebeleName ?? `#${s.kebeleId}`}</td>
                            <td className="px-4 py-3 text-xs whitespace-nowrap">
                              <div className="font-medium text-slate-700">{s.roadSurface || "Paved"}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {s.lengthMeters ? (s.lengthMeters >= 1000 ? `${(s.lengthMeters / 1000).toFixed(2)} km` : `${s.lengthMeters}m`) : "—"} • {s.widthMeters ? `${s.widthMeters}m wide` : ""}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                {s.hasSidewalk && (
                                  <span className="inline-flex items-center p-1 rounded bg-slate-100 text-slate-700" title="Pedestrian sidewalk present">
                                    <Footprints className="h-3.5 w-3.5" />
                                  </span>
                                )}
                                {s.hasStreetLights && (
                                  <span className="inline-flex items-center p-1 rounded bg-amber-50 text-amber-600" title="Street lighting poles present">
                                    <Lightbulb className="h-3.5 w-3.5" />
                                  </span>
                                )}
                                {s.hasDrainage && (
                                  <span className="inline-flex items-center p-1 rounded bg-blue-50 text-blue-600" title="Stormwater drainage channels present">
                                    <Droplets className="h-3.5 w-3.5" />
                                  </span>
                                )}
                                {!s.hasSidewalk && !s.hasStreetLights && !s.hasDrainage && (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${pci.bg}`}>
                                  {s.lastPciScore ?? "—"}
                                </span>
                                <div>
                                  <span className="text-xs font-medium block leading-none">{pci.rating.split(" ")[0]}</span>
                                  <div className="w-16 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                                    <div
                                      className={`h-full ${pci.bar}`}
                                      style={{ width: `${Math.min(100, Math.max(5, s.lastPciScore ?? 50))}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs font-mono whitespace-nowrap">
                              {s.lastResurfacedYear ?? <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-3 text-xs whitespace-nowrap">
                              {s.nextInspectionDate ? (
                                <div className="flex items-center gap-1.5">
                                  {isInspectionSoon && <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                                  <span className={isInspectionSoon ? "text-amber-700 font-semibold" : "text-muted-foreground"}>
                                    {new Date(s.nextInspectionDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {getPriorityBadge(s.maintenancePriority)}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1 px-2 text-primary"
                                  onClick={() => setHistoryTarget(s)}
                                  title="View full maintenance lifecycle"
                                >
                                  <History className="h-3.5 w-3.5" /> History
                                </Button>
                                {canEdit && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs gap-1 px-2"
                                    onClick={() => {
                                      setEditItem(null);
                                      setPreselectedStreetId(s.id);
                                      setDialogOpen(true);
                                    }}
                                  >
                                    <Plus className="h-3 w-3" /> Log
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="px-4 py-2.5 border-t bg-muted/20 text-xs text-muted-foreground">
                    Showing {filteredStreets.length} of {streets.length} road corridors
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: Maintenance & Inspection Audit Trail ── */}
        <TabsContent value="records" className="space-y-4">
          <Card>
            <CardContent className="p-3.5">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search logs by street, contractor, or inspector…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  value={activityFilter}
                  onChange={(e) => setActivityFilter(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-w-[180px]"
                >
                  <option value="">All Activity Types</option>
                  {ACTIVITY_TYPES.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
                {(search || activityFilter) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setActivityFilter("");
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {isRecordsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                  <History className="h-10 w-10 text-muted-foreground/50" />
                  <p className="text-sm font-medium">No maintenance records logged yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        {["Date", "Street Corridor", "Activity Type", "PCI Score", "Contractor", "Expenditure (ETB)", "Funding", "Status", "Inspector", ""].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map((r, idx) => {
                        const act = ACTIVITY_TYPES.find((a) => a.value === r.activityType) ?? ACTIVITY_TYPES[0];
                        const pci = getPciDescriptor(r.pciScore);

                        return (
                          <tr
                            key={r.id}
                            className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${idx % 2 !== 0 ? "bg-muted/10" : ""}`}
                          >
                            <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                              {new Date(r.performedDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                            </td>
                            <td className="px-4 py-3 font-medium">
                              <div>{r.streetName}</div>
                              <span className="text-[11px] font-mono text-muted-foreground">
                                {r.streetCode} • {r.kebeleName ?? "Kebele"}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${act.badge}`}>
                                {act.label.split(" (")[0]}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {r.pciScore != null ? (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${pci.bg}`}>
                                  {r.pciScore} • {pci.rating.split(" ")[0]}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-700 max-w-[180px] truncate" title={r.contractor ?? ""}>
                              {r.contractor ?? "—"}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                              {r.costEtb != null ? `${r.costEtb.toLocaleString()} ETB` : "—"}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap capitalize">
                              {r.fundingSource ? r.fundingSource.replace("_", " ") : "—"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Badge
                                className={
                                  r.status === "completed"
                                    ? "bg-emerald-100 text-emerald-800 border-0"
                                    : r.status === "in_progress"
                                    ? "bg-blue-100 text-blue-800 border-0"
                                    : "bg-amber-100 text-amber-800 border-0"
                                }
                              >
                                {r.status.replace("_", " ")}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                              {r.inspectorName ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              {canEdit && (
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => {
                                      setEditItem(r);
                                      setPreselectedStreetId(r.streetId);
                                      setDialogOpen(true);
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  {canDelete && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => setDeleteTarget(r)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="px-4 py-2.5 border-t bg-muted/20 text-xs text-muted-foreground">
                    Showing {filteredRecords.length} of {records.length} records
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog 1: Log / Edit Maintenance */}
      {dialogOpen && (
        <MaintenanceRecordDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editItem={editItem}
          preselectedStreetId={preselectedStreetId}
          streets={streets as Street[]}
          onSaved={invalidateAll}
        />
      )}

      {/* Dialog 2: Single Road Lifecycle History */}
      {historyTarget && (
        <RoadHistoryDialog
          street={historyTarget}
          open={!!historyTarget}
          onOpenChange={(v) => !v && setHistoryTarget(null)}
          records={records as RoadMaintenanceRecord[]}
          onLogNew={() => {
            setEditItem(null);
            setPreselectedStreetId(historyTarget.id);
            setHistoryTarget(null);
            setDialogOpen(true);
          }}
        />
      )}

      {/* Alert Dialog: Delete Record */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Maintenance Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this maintenance record for <strong>{deleteTarget?.streetName}</strong> ({deleteTarget?.activityType})? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteRecord.isPending}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {deleteRecord.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
