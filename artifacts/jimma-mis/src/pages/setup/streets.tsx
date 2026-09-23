import { useState, useMemo } from "react";
import { Redirect, Link } from "wouter";
import {
  useListStreets, useListKebeles, useCreateStreet, useUpdateStreet, useDeleteStreet,
  getListStreetsQueryKey, type StreetInputCondition,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Search, Pencil, Trash2, Loader2, Navigation, AlertTriangle, Calculator,
  Lightbulb, Footprints, Droplets, MapPin, Gauge, Wrench
} from "lucide-react";

type Street = {
  id: number; name: string; code: string; kebeleId: number; kebeleName: string | null;
  streetType: string | null; roadSurface: string | null;
  startLat: number | null; startLng: number | null; endLat: number | null; endLng: number | null;
  lengthMeters: number | null; widthMeters: number | null; condition: string | null;
  startIntersection: string | null; endIntersection: string | null; lanes: number | null;
  hasSidewalk: boolean | null; hasStreetLights: boolean | null; hasDrainage: boolean | null;
  description: string | null; status: string; createdAt: string; updatedAt: string;
};

type Kebele = { id: number; name: string; code: string };

type FormData = {
  name: string; code: string; kebeleId: string; streetType: string; roadSurface: string;
  startLat: string; startLng: string; endLat: string; endLng: string;
  lengthMeters: string; widthMeters: string; condition: string;
  startIntersection: string; endIntersection: string; lanes: string;
  hasSidewalk: boolean; hasStreetLights: boolean; hasDrainage: boolean;
  description: string; status: string;
};

const EMPTY: FormData = {
  name: "", code: "", kebeleId: "", streetType: "", roadSurface: "",
  startLat: "", startLng: "", endLat: "", endLng: "",
  lengthMeters: "", widthMeters: "", condition: "good",
  startIntersection: "", endIntersection: "", lanes: "2",
  hasSidewalk: false, hasStreetLights: false, hasDrainage: false,
  description: "", status: "active",
};

const STREET_TYPES = ["Main Road", "Side Road", "Alley", "Highway", "Boulevard", "Avenue", "Lane", "Other"];
const ROAD_SURFACES = ["Asphalt", "Gravel", "Cobblestone", "Dirt", "Concrete", "Mixed"];
const ROAD_CONDITIONS = [
  { value: "good", label: "Good (Well Paved / Intact)", badge: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { value: "fair", label: "Fair (Minor Wear / Passable)", badge: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "poor", label: "Poor (Potholes / Damaged)", badge: "bg-rose-100 text-rose-800 border-rose-200" },
  { value: "under_maintenance", label: "Under Maintenance", badge: "bg-blue-100 text-blue-800 border-blue-200" },
];

function StreetFormDialog({ open, onOpenChange, editItem, kebeles, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; editItem: Street | null;
  kebeles: Kebele[]; onSaved: () => void;
}) {
  const { toast } = useToast();
  const createStreet = useCreateStreet();
  const updateStreet = useUpdateStreet();
  const isEdit = editItem !== null;

  function makeForm(s: Street | null): FormData {
    if (!s) return EMPTY;
    return {
      name: s.name, code: s.code, kebeleId: s.kebeleId.toString(),
      streetType: s.streetType ?? "", roadSurface: s.roadSurface ?? "",
      startLat: s.startLat?.toString() ?? "", startLng: s.startLng?.toString() ?? "",
      endLat: s.endLat?.toString() ?? "", endLng: s.endLng?.toString() ?? "",
      lengthMeters: s.lengthMeters?.toString() ?? "",
      widthMeters: s.widthMeters?.toString() ?? "",
      condition: s.condition ?? "good",
      startIntersection: s.startIntersection ?? "",
      endIntersection: s.endIntersection ?? "",
      lanes: s.lanes?.toString() ?? "2",
      hasSidewalk: Boolean(s.hasSidewalk),
      hasStreetLights: Boolean(s.hasStreetLights),
      hasDrainage: Boolean(s.hasDrainage),
      description: s.description ?? "", status: s.status,
    };
  }

  const [form, setForm] = useState<FormData>(() => makeForm(editItem));
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  function handleCalculateLength() {
    const sLat = parseFloat(form.startLat);
    const sLng = parseFloat(form.startLng);
    const eLat = parseFloat(form.endLat);
    const eLng = parseFloat(form.endLng);
    if (!isNaN(sLat) && !isNaN(sLng) && !isNaN(eLat) && !isNaN(eLng)) {
      const R = 6371000;
      const dLat = ((eLat - sLat) * Math.PI) / 180;
      const dLon = ((eLng - sLng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((sLat * Math.PI) / 180) * Math.cos((eLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
      const d = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
      setForm((f) => ({ ...f, lengthMeters: d.toString() }));
      toast({ title: "Length Calculated", description: `${d.toLocaleString()} meters based on GPS coordinates.` });
    } else {
      toast({ variant: "destructive", title: "Incomplete Coordinates", description: "Enter valid start and end Lat/Lng coordinates first." });
    }
  }

  function handleOpen(v: boolean) {
    if (v) { setForm(makeForm(editItem)); setErrors({}); }
    onOpenChange(v);
  }

  function validate() {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = "Street name is required";
    if (!form.code.trim()) e.code = "Street code is required";
    if (!form.kebeleId) e.kebeleId = "Kebele is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      kebeleId: parseInt(form.kebeleId, 10),
      streetType: form.streetType || null,
      roadSurface: form.roadSurface || null,
      startLat: form.startLat ? parseFloat(form.startLat) : null,
      startLng: form.startLng ? parseFloat(form.startLng) : null,
      endLat: form.endLat ? parseFloat(form.endLat) : null,
      endLng: form.endLng ? parseFloat(form.endLng) : null,
      lengthMeters: form.lengthMeters ? parseFloat(form.lengthMeters) : null,
      widthMeters: form.widthMeters ? parseFloat(form.widthMeters) : null,
      condition: (form.condition as StreetInputCondition) || "good",
      startIntersection: form.startIntersection.trim() || null,
      endIntersection: form.endIntersection.trim() || null,
      lanes: form.lanes ? parseInt(form.lanes, 10) : 2,
      hasSidewalk: form.hasSidewalk,
      hasStreetLights: form.hasStreetLights,
      hasDrainage: form.hasDrainage,
      description: form.description.trim() || null,
      status: form.status as "active" | "inactive",
    };
    if (isEdit) {
      updateStreet.mutate({ id: editItem.id, data: payload }, {
        onSuccess: () => { toast({ title: "Street updated" }); handleOpen(false); onSaved(); },
        onError: () => toast({ variant: "destructive", title: "Failed to update. Code may be duplicate in this kebele." }),
      });
    } else {
      createStreet.mutate({ data: payload }, {
        onSuccess: () => { toast({ title: "Street created" }); handleOpen(false); onSaved(); },
        onError: () => toast({ variant: "destructive", title: "Failed to create. Code may be duplicate in this kebele." }),
      });
    }
  }

  const isPending = createStreet.isPending || updateStreet.isPending;
  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-primary" />
            {isEdit ? "Edit Street & Road Inventory" : "Add Street & Road Inventory"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-5 py-2">
          {/* Section 1: General Info */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              General Information
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Street Name <span className="text-destructive">*</span></Label>
                <Input value={form.name} onChange={set("name")} placeholder="e.g. Aba Jifar Road" />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="grid gap-1.5">
                <Label>Street Code <span className="text-destructive">*</span></Label>
                <Input value={form.code} onChange={set("code")} placeholder="e.g. ST001" className="uppercase font-mono" />
                {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Assigned Kebele <span className="text-destructive">*</span></Label>
                <select value={form.kebeleId} onChange={set("kebeleId")}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="">Select kebele…</option>
                  {kebeles.map((k) => <option key={k.id} value={k.id}>{k.name} ({k.code})</option>)}
                </select>
                {errors.kebeleId && <p className="text-xs text-destructive">{errors.kebeleId}</p>}
              </div>
              <div className="grid gap-1.5">
                <Label>Street Type</Label>
                <select value={form.streetType} onChange={set("streetType")}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="">Select type…</option>
                  {STREET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label>Road Surface</Label>
                <select value={form.roadSurface} onChange={set("roadSurface")}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="">Select surface…</option>
                  {ROAD_SURFACES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Corridor & Intersections */}
          <div className="space-y-3 pt-2 border-t">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-primary" /> Corridor Intersections & Landmarks
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Start Landmark / Intersection</Label>
                <Input value={form.startIntersection} onChange={set("startIntersection")} placeholder="e.g. Aba Jifar Roundabout" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">End Landmark / Intersection</Label>
                <Input value={form.endIntersection} onChange={set("endIntersection")} placeholder="e.g. Bonga Checkpoint / Square" />
              </div>
            </div>
          </div>

          {/* Section 3: GPS Coordinates */}
          <div className="space-y-3 pt-2 border-t">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5 text-primary" /> Geographic Coordinates (WGS84)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Start Latitude</Label>
                <Input type="number" step="any" value={form.startLat} onChange={set("startLat")} placeholder="e.g. 7.6731" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Start Longitude</Label>
                <Input type="number" step="any" value={form.startLng} onChange={set("startLng")} placeholder="e.g. 36.8344" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">End Latitude</Label>
                <Input type="number" step="any" value={form.endLat} onChange={set("endLat")} placeholder="e.g. 7.6750" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">End Longitude</Label>
                <Input type="number" step="any" value={form.endLng} onChange={set("endLng")} placeholder="e.g. 36.8360" />
              </div>
            </div>
          </div>

          {/* Section 4: Dimensions, Lanes & Condition */}
          <div className="space-y-3 pt-2 border-t">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5 text-primary" /> Road Dimensions & Condition
            </h4>
            <div className="grid grid-cols-4 gap-3">
              <div className="grid gap-1.5 col-span-2">
                <div className="flex items-center justify-between">
                  <Label>Length (meters)</Label>
                  <button
                    type="button"
                    onClick={handleCalculateLength}
                    className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
                    title="Auto-calculate distance from GPS start and end coordinates"
                  >
                    <Calculator className="h-3 w-3" /> Auto-calc GPS
                  </button>
                </div>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={form.lengthMeters}
                  onChange={set("lengthMeters")}
                  placeholder="e.g. 1450"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Width (m)</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={form.widthMeters}
                  onChange={set("widthMeters")}
                  placeholder="e.g. 12"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Lanes</Label>
                <select
                  value={form.lanes}
                  onChange={set("lanes")}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="1">1 Lane</option>
                  <option value="2">2 Lanes</option>
                  <option value="3">3 Lanes</option>
                  <option value="4">4 Lanes</option>
                  <option value="6">6 Lanes</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              <Label>Current Road Condition</Label>
              <select
                value={form.condition}
                onChange={set("condition")}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {ROAD_CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 5: Infrastructure & Amenities */}
          <div className="space-y-3 pt-2 border-t">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Municipal Infrastructure & Utilities
            </h4>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-input hover:bg-muted/40 cursor-pointer transition-colors">
                <Checkbox
                  checked={form.hasSidewalk}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, hasSidewalk: Boolean(checked) }))}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <div className="text-xs font-medium flex items-center gap-1.5">
                    <Footprints className="h-3.5 w-3.5 text-primary" /> Sidewalk
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">Pedestrian walkway</p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-input hover:bg-muted/40 cursor-pointer transition-colors">
                <Checkbox
                  checked={form.hasStreetLights}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, hasStreetLights: Boolean(checked) }))}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <div className="text-xs font-medium flex items-center gap-1.5">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> Street Lights
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">Working light poles</p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-input hover:bg-muted/40 cursor-pointer transition-colors">
                <Checkbox
                  checked={form.hasDrainage}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, hasDrainage: Boolean(checked) }))}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <div className="text-xs font-medium flex items-center gap-1.5">
                    <Droplets className="h-3.5 w-3.5 text-blue-500" /> Drainage
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">Gutters & runoff</p>
                </div>
              </label>
            </div>
          </div>

          {/* Section 6: Notes & Status */}
          <div className="space-y-3 pt-2 border-t">
            <div className="grid gap-1.5">
              <Label>Description / Maintenance Notes</Label>
              <textarea value={form.description} onChange={set("description")} rows={2} placeholder="Optional engineering or maintenance notes about this street…"
                className="min-h-[50px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <select value={form.status} onChange={set("status")}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => handleOpen(false)} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Street"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function StreetsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const canEdit = user?.role === "admin" || user?.role === "city_officer";
  const canDelete = user?.role === "admin";
  if (!canEdit && user?.role !== "kebele_officer" && user?.role !== "viewer") return <Redirect to="/dashboard" />;

  const [search, setSearch] = useState("");
  const [kebeleFilter, setKebeleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<Street | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Street | null>(null);

  const { data: streets = [], isLoading, error } = useListStreets();
  const { data: kebeles = [] } = useListKebeles();
  const deleteStreet = useDeleteStreet();

  function invalidate() { queryClient.invalidateQueries({ queryKey: getListStreetsQueryKey() }); }

  const filtered = useMemo(() => {
    return (streets as Street[]).filter((s) => {
      if (kebeleFilter && s.kebeleId.toString() !== kebeleFilter) return false;
      if (statusFilter && s.status !== statusFilter) return false;
      if (conditionFilter && (s.condition || "good") !== conditionFilter) return false;
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
  }, [streets, search, kebeleFilter, statusFilter, conditionFilter]);

  function handleDelete() {
    if (!deleteTarget) return;
    deleteStreet.mutate({ id: deleteTarget.id }, {
      onSuccess: () => { invalidate(); toast({ title: "Street deleted" }); setDeleteTarget(null); },
      onError: (err: Error) => {
        const msg = err?.message?.includes("400") ? "Cannot delete: street is in use by properties or has blocks." : "Failed to delete";
        toast({ variant: "destructive", title: msg }); setDeleteTarget(null);
      },
    });
  }

  const activeCount = (streets as Street[]).filter((s) => s.status === "active").length;
  const goodCount = (streets as Street[]).filter((s) => (s.condition || "good") === "good").length;
  const issueCount = (streets as Street[]).filter((s) => s.condition === "poor" || s.condition === "under_maintenance").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Streets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage streets, measured road lengths, condition ratings, and codes within kebeles.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/setup/road-inventory">
            <Button variant="outline" className="gap-2 shrink-0">
              <Wrench className="h-4 w-4" /> Road Inventory & PCI
            </Button>
          </Link>
          {canEdit && (
            <Button onClick={() => { setEditItem(null); setFormOpen(true); }} className="gap-2 shrink-0">
              <Plus className="h-4 w-4" /> Add Street
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Streets", value: (streets as Street[]).length, color: "bg-slate-500" },
          { label: "Active", value: activeCount, color: "bg-emerald-500" },
          { label: "Good Condition", value: goodCount, color: "bg-teal-500" },
          { label: "Needs Maintenance", value: issueCount, color: "bg-rose-500" },
        ].map((c) => (
          <Card key={c.label}><div className="flex items-center gap-3 p-4">
            <div className={`p-2.5 rounded-lg ${c.color} shrink-0`}><Navigation className="h-4 w-4 text-white" /></div>
            <div><p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-xl font-bold tabular-nums">{isLoading ? "—" : c.value}</p>
            </div>
          </div></Card>
        ))}
      </div>

      <Card><CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by name, code, or kebele…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select value={kebeleFilter} onChange={(e) => setKebeleFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-w-[150px]">
            <option value="">All Kebeles</option>
            {(kebeles as Kebele[]).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
          <select value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-w-[140px]">
            <option value="">All Conditions</option>
            {ROAD_CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label.split(" (")[0]}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-w-[120px]">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          {(search || kebeleFilter || statusFilter || conditionFilter) && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setKebeleFilter(""); setStatusFilter(""); setConditionFilter(""); }}>Clear</Button>
          )}
        </div>
      </CardContent></Card>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 flex items-center gap-3 text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" /><span className="text-sm">Failed to load streets.</span>
        </div>
      )}

      <Card><CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <Navigation className="h-10 w-10" /><p className="text-sm font-medium">No streets found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  {["Code", "Name", "Kebele", "Type", "Surface", "Dimensions", "Infra", "Condition", "Status", "Created", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, idx) => (
                  <tr key={s.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${idx % 2 !== 0 ? "bg-muted/10" : ""}`}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{s.code}</td>
                    <td className="px-4 py-3 font-medium">
                      <div>{s.name}</div>
                      {(s.startIntersection || s.endIntersection) && (
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 font-normal">
                          <MapPin className="h-3 w-3 shrink-0 text-primary/70" />
                          <span className="truncate max-w-[220px]" title={`${s.startIntersection || ""} → ${s.endIntersection || ""}`}>
                            {s.startIntersection && s.endIntersection
                              ? `${s.startIntersection} → ${s.endIntersection}`
                              : s.startIntersection || s.endIntersection}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.kebeleName || `#${s.kebeleId}`}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.streetType || "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.roadSurface || "—"}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      <div className="font-mono text-muted-foreground font-medium">
                        {s.lengthMeters != null
                          ? s.lengthMeters >= 1000
                            ? `${(s.lengthMeters / 1000).toFixed(2)} km`
                            : `${Math.round(s.lengthMeters).toLocaleString()} m`
                          : "—"}
                      </div>
                      {s.widthMeters != null && (
                        <div className="text-[11px] text-muted-foreground">
                          {s.widthMeters}m • {s.lanes ?? 2} lane{s.lanes === 1 ? "" : "s"}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {s.hasSidewalk && (
                          <span className="inline-flex items-center p-1 rounded bg-slate-100 text-slate-700" title="Sidewalk walkway present">
                            <Footprints className="h-3.5 w-3.5" />
                          </span>
                        )}
                        {s.hasStreetLights && (
                          <span className="inline-flex items-center p-1 rounded bg-amber-50 text-amber-600" title="Street lighting present">
                            <Lightbulb className="h-3.5 w-3.5" />
                          </span>
                        )}
                        {s.hasDrainage && (
                          <span className="inline-flex items-center p-1 rounded bg-blue-50 text-blue-600" title="Stormwater drainage present">
                            <Droplets className="h-3.5 w-3.5" />
                          </span>
                        )}
                        {!s.hasSidewalk && !s.hasStreetLights && !s.hasDrainage && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {(() => {
                        const cond = ROAD_CONDITIONS.find((c) => c.value === (s.condition || "good")) ?? ROAD_CONDITIONS[0];
                        return (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cond.badge}`}>
                            {cond.label.split(" (")[0]}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={s.status === "active" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0" : "bg-red-100 text-red-700 hover:bg-red-100 border-0"}>
                        {s.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                      {new Date(s.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canEdit && (
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditItem(s); setFormOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {canDelete && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteTarget(s)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2.5 border-t bg-muted/20 text-xs text-muted-foreground">
              Showing {filtered.length} of {(streets as Street[]).length} street{(streets as Street[]).length !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </CardContent></Card>

      {formOpen && (
        <StreetFormDialog open={formOpen} onOpenChange={setFormOpen} editItem={editItem} kebeles={kebeles as Kebele[]} onSaved={invalidate} />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Street</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{deleteTarget?.name}</strong> ({deleteTarget?.code})? Streets referenced by properties or with assigned blocks cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteStreet.isPending}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              {deleteStreet.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
