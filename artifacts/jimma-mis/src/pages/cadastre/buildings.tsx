import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Building2,
  Building,
  LandPlot,
  Search,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Layers,
  FileCheck2,
  Calendar,
  CheckCircle2,
  Home,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

export type CadastralBuilding = {
  id: number;
  buildingCode: string;
  buildingName?: string | null;
  parcelId: number;
  parcelUpi?: string | null;
  parcelKebele?: string | null;
  parcelStreet?: string | null;
  structureType: string;
  foundationType?: string | null;
  roofMaterial?: string | null;
  constructionYear?: number | null;
  numberOfFloors: number;
  footprintAreaSqm?: number | null;
  grossFloorAreaSqm?: number | null;
  buildingUse: string;
  buildingCondition: string;
  permitNumber?: string | null;
  occupancyPermitIssued: boolean;
  unitCount: number;
  createdAt: string;
  updatedAt: string;
};

type ParcelOption = {
  id: number;
  parcelUpi: string;
  kebele: string;
};

const STRUCTURE_TYPES = [
  { value: "reinforced_concrete", label: "Reinforced Concrete Frame" },
  { value: "masonry_stone", label: "Stone / Block Masonry" },
  { value: "steel_frame", label: "Structural Steel Frame" },
  { value: "timber_mud", label: "Timber & Mud (Chika)" },
  { value: "precast_composite", label: "Precast Concrete" },
  { value: "other", label: "Other Typology" },
];

const CONDITION_RATINGS = [
  { value: "good", label: "Good / Modern", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { value: "fair", label: "Fair / Adequate", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "poor", label: "Poor / Degraded", color: "bg-rose-100 text-rose-800 border-rose-200" },
  { value: "under_construction", label: "Under Construction", color: "bg-blue-100 text-blue-800 border-blue-200" },
];

const USE_CATEGORIES = [
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "mixed", label: "Mixed-Use" },
  { value: "institutional", label: "Public / Institutional" },
  { value: "industrial", label: "Industrial / Warehouse" },
];

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("jimma_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function BuildingsRegistryPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [buildings, setBuildings] = useState<CadastralBuilding[]>([]);
  const [parcelsList, setParcelsList] = useState<ParcelOption[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [structureFilter, setStructureFilter] = useState("all");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [useFilter, setUseFilter] = useState("all");

  // Create / Edit modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<CadastralBuilding | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete modal state
  const [deletingBuilding, setDeletingBuilding] = useState<CadastralBuilding | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form Fields
  const [buildingCode, setBuildingCode] = useState("");
  const [buildingName, setBuildingName] = useState("");
  const [parcelId, setParcelId] = useState<number | "">("");
  const [structureType, setStructureType] = useState("reinforced_concrete");
  const [foundationType, setFoundationType] = useState("isolated_pad");
  const [roofMaterial, setRoofMaterial] = useState("corrugated_iron");
  const [constructionYear, setConstructionYear] = useState("");
  const [numberOfFloors, setNumberOfFloors] = useState("1");
  const [footprintAreaSqm, setFootprintAreaSqm] = useState("");
  const [grossFloorAreaSqm, setGrossFloorAreaSqm] = useState("");
  const [buildingUse, setBuildingUse] = useState("residential");
  const [buildingCondition, setBuildingCondition] = useState("good");
  const [permitNumber, setPermitNumber] = useState("");
  const [occupancyPermitIssued, setOccupancyPermitIssued] = useState(true);

  const canEdit = user?.role === "admin" || user?.role === "city_officer";

  const fetchBuildings = async () => {
    setIsLoading(true);
    try {
      const qParams = new URLSearchParams();
      if (search.trim()) qParams.set("search", search.trim());
      if (structureFilter !== "all") qParams.set("structureType", structureFilter);
      if (conditionFilter !== "all") qParams.set("condition", conditionFilter);
      if (useFilter !== "all") qParams.set("buildingUse", useFilter);

      const res = await fetch(`/api/buildings?${qParams.toString()}`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error("Failed to load buildings registry");
      const data = await res.json();
      setBuildings(data.buildings || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      toast({
        title: "Error fetching buildings",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchParcelsList = async () => {
    try {
      const res = await fetch("/api/parcels?limit=100", { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        setParcelsList(data.parcels || []);
      }
    } catch {}
  };

  useEffect(() => {
    fetchBuildings();
  }, [search, structureFilter, conditionFilter, useFilter]);

  useEffect(() => {
    fetchParcelsList();
  }, []);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalFootprint = buildings.reduce((sum, b) => sum + (b.footprintAreaSqm || 0), 0);
    const multiStory = buildings.filter((b) => b.numberOfFloors > 1).length;
    const permitted = buildings.filter((b) => !!b.permitNumber || b.occupancyPermitIssued).length;
    return {
      totalFootprint: Math.round(totalFootprint),
      multiStory,
      permitted,
    };
  }, [buildings]);

  const openCreateModal = () => {
    setEditingBuilding(null);
    setBuildingCode(`BLD-JMA-${Date.now().toString().slice(-5)}`);
    setBuildingName("");
    setParcelId(parcelsList[0]?.id || "");
    setStructureType("reinforced_concrete");
    setFoundationType("isolated_pad");
    setRoofMaterial("corrugated_iron");
    setConstructionYear("2021");
    setNumberOfFloors("2");
    setFootprintAreaSqm("180");
    setGrossFloorAreaSqm("360");
    setBuildingUse("residential");
    setBuildingCondition("good");
    setPermitNumber(`BP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setOccupancyPermitIssued(true);
    setIsFormOpen(true);
  };

  const openEditModal = (b: CadastralBuilding) => {
    setEditingBuilding(b);
    setBuildingCode(b.buildingCode);
    setBuildingName(b.buildingName || "");
    setParcelId(b.parcelId);
    setStructureType(b.structureType || "reinforced_concrete");
    setFoundationType(b.foundationType || "isolated_pad");
    setRoofMaterial(b.roofMaterial || "corrugated_iron");
    setConstructionYear(b.constructionYear ? String(b.constructionYear) : "");
    setNumberOfFloors(String(b.numberOfFloors || 1));
    setFootprintAreaSqm(b.footprintAreaSqm ? String(b.footprintAreaSqm) : "");
    setGrossFloorAreaSqm(b.grossFloorAreaSqm ? String(b.grossFloorAreaSqm) : "");
    setBuildingUse(b.buildingUse || "residential");
    setBuildingCondition(b.buildingCondition || "good");
    setPermitNumber(b.permitNumber || "");
    setOccupancyPermitIssued(b.occupancyPermitIssued ?? true);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buildingCode.trim() || !parcelId) {
      toast({ title: "Validation Error", description: "Building code and parent parcel are required", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        buildingCode: buildingCode.trim(),
        buildingName: buildingName.trim() || undefined,
        parcelId: Number(parcelId),
        structureType,
        foundationType: foundationType || undefined,
        roofMaterial: roofMaterial || undefined,
        constructionYear: constructionYear ? parseInt(constructionYear, 10) : undefined,
        numberOfFloors: numberOfFloors ? parseInt(numberOfFloors, 10) : 1,
        footprintAreaSqm: footprintAreaSqm ? parseFloat(footprintAreaSqm) : undefined,
        grossFloorAreaSqm: grossFloorAreaSqm ? parseFloat(grossFloorAreaSqm) : undefined,
        buildingUse,
        buildingCondition,
        permitNumber: permitNumber.trim() || undefined,
        occupancyPermitIssued,
      };

      const url = editingBuilding ? `/api/buildings/${editingBuilding.id}` : "/api/buildings";
      const method = editingBuilding ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save building");
      }

      toast({
        title: editingBuilding ? "Building updated" : "Building registered",
        description: `Structure ${buildingCode} successfully recorded.`,
      });

      setIsFormOpen(false);
      fetchBuildings();
    } catch (err: any) {
      toast({
        title: "Submission failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingBuilding) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/buildings/${deletingBuilding.id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete building");
      }
      toast({
        title: "Building deleted",
        description: `Structure ${deletingBuilding.buildingCode} removed.`,
      });
      setDeletingBuilding(null);
      fetchBuildings();
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Building className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Cadastral Buildings Registry</h1>
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-800 border-blue-300 font-mono">
              ISO 19152 LADM
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Physical structures, architectural typology, foundations, materials, permits, and occupancy units.
          </p>
        </div>

        {canEdit && (
          <Button onClick={openCreateModal} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" />
            Register Structure
          </Button>
        )}
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold">{total}</div>
              <div className="text-xs text-muted-foreground">Total Structures</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.totalFootprint.toLocaleString()} m²</div>
              <div className="text-xs text-muted-foreground">Total Footprint Area</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.multiStory}</div>
              <div className="text-xs text-muted-foreground">Multi-Story Buildings</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.permitted}</div>
              <div className="text-xs text-muted-foreground">Permitted Structures</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search by code, building name, or permit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={structureFilter} onValueChange={setStructureFilter}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Structure Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Structures</SelectItem>
              {STRUCTURE_TYPES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={useFilter} onValueChange={setUseFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Building Use" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Uses</SelectItem>
              {USE_CATEGORIES.map((u) => (
                <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={conditionFilter} onValueChange={setConditionFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Condition" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Conditions</SelectItem>
              {CONDITION_RATINGS.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-auto" />}
        </CardContent>
      </Card>

      {/* Buildings Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">Building Code & Name</th>
                <th className="px-4 py-3">Parent Parcel (UPI)</th>
                <th className="px-4 py-3">Typology & Floors</th>
                <th className="px-4 py-3">Footprint / Gross Area</th>
                <th className="px-4 py-3">Use & Condition</th>
                <th className="px-4 py-3">Permit Status</th>
                <th className="px-4 py-3">Linked Units</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && buildings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading buildings registry...
                  </td>
                </tr>
              ) : buildings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-muted-foreground">
                    No buildings found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                buildings.map((b) => {
                  const cond = CONDITION_RATINGS.find((c) => c.value === b.buildingCondition);
                  return (
                    <tr key={b.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-primary font-mono text-xs">{b.buildingCode}</div>
                        <div className="text-xs text-muted-foreground">
                          {b.buildingName || "Main Structure"} {b.constructionYear ? `(${b.constructionYear})` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-mono text-xs text-emerald-700">
                          <LandPlot className="w-3.5 h-3.5" />
                          {b.parcelUpi || `Parcel #${b.parcelId}`}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {b.parcelKebele ? `${b.parcelKebele}` : ""} {b.parcelStreet ? `• ${b.parcelStreet}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-xs capitalize">
                          {b.structureType.replace(/_/g, " ")}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {b.numberOfFloors} Floor{b.numberOfFloors > 1 ? "s" : ""}
                          {b.roofMaterial ? ` • ${b.roofMaterial.replace(/_/g, " ")}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {b.footprintAreaSqm ? `${b.footprintAreaSqm} m²` : "—"}
                        </div>
                        {b.grossFloorAreaSqm && (
                          <div className="text-[11px] text-muted-foreground">
                            Gross: {b.grossFloorAreaSqm} m²
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="capitalize text-xs mb-1 block w-fit">
                          {b.buildingUse}
                        </Badge>
                        <Badge variant="outline" className={`text-[11px] ${cond?.color || ""}`}>
                          {cond?.label || b.buildingCondition}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {b.permitNumber ? (
                          <div>
                            <div className="font-mono text-xs text-slate-700 font-medium">{b.permitNumber}</div>
                            <div className="text-[11px] text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              {b.occupancyPermitIssued ? "Occupancy Certified" : "Construction Permit"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No permit on file</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-800 border-emerald-200">
                          {b.unitCount} {b.unitCount === 1 ? "Unit" : "Units"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={() => openEditModal(b)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                                onClick={() => setDeletingBuilding(b)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Register / Edit Building Modal */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              {editingBuilding ? "Edit Cadastral Building" : "Register Cadastral Building"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="buildingCode">Building Code / Structure ID *</Label>
                <Input
                  id="buildingCode"
                  value={buildingCode}
                  onChange={(e) => setBuildingCode(e.target.value)}
                  placeholder="e.g. BLD-JMA-001"
                  required
                />
              </div>

              <div>
                <Label htmlFor="buildingName">Building Name / Complex</Label>
                <Input
                  id="buildingName"
                  value={buildingName}
                  onChange={(e) => setBuildingName(e.target.value)}
                  placeholder="e.g. Aba Jifar Plaza or Villa A"
                />
              </div>
            </div>

            <div>
              <Label>Parent Cadastral Parcel (UPI) *</Label>
              <Select
                value={parcelId ? String(parcelId) : ""}
                onValueChange={(v) => setParcelId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select parent parcel plot" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {parcelsList.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.parcelUpi} — Kebele {p.kebele}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Structure Typology</Label>
                <Select value={structureType} onValueChange={setStructureType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STRUCTURE_TYPES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="foundationType">Foundation Type</Label>
                <Input
                  id="foundationType"
                  value={foundationType}
                  onChange={(e) => setFoundationType(e.target.value)}
                  placeholder="e.g. isolated_pad or strip"
                />
              </div>

              <div>
                <Label htmlFor="roofMaterial">Roof Material</Label>
                <Input
                  id="roofMaterial"
                  value={roofMaterial}
                  onChange={(e) => setRoofMaterial(e.target.value)}
                  placeholder="e.g. corrugated_iron or concrete"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="floors">Number of Floors</Label>
                <Input
                  id="floors"
                  type="number"
                  min="1"
                  max="50"
                  value={numberOfFloors}
                  onChange={(e) => setNumberOfFloors(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="constructionYear">Year Built</Label>
                <Input
                  id="constructionYear"
                  type="number"
                  placeholder="e.g. 2020"
                  value={constructionYear}
                  onChange={(e) => setConstructionYear(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="footprintArea">Footprint Area (m²)</Label>
                <Input
                  id="footprintArea"
                  type="number"
                  step="0.01"
                  value={footprintAreaSqm}
                  onChange={(e) => setFootprintAreaSqm(e.target.value)}
                  placeholder="e.g. 150"
                />
              </div>

              <div>
                <Label htmlFor="grossArea">Gross Area (m²)</Label>
                <Input
                  id="grossArea"
                  type="number"
                  step="0.01"
                  value={grossFloorAreaSqm}
                  onChange={(e) => setGrossFloorAreaSqm(e.target.value)}
                  placeholder="e.g. 300"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Primary Building Use</Label>
                <Select value={buildingUse} onValueChange={setBuildingUse}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {USE_CATEGORIES.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Structural Condition</Label>
                <Select value={buildingCondition} onValueChange={setBuildingCondition}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_RATINGS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div>
                <Label htmlFor="permitNumber">Municipal Building Permit #</Label>
                <Input
                  id="permitNumber"
                  value={permitNumber}
                  onChange={(e) => setPermitNumber(e.target.value)}
                  placeholder="e.g. BP-2024-8192"
                />
              </div>

              <div className="flex items-center space-x-2 pt-6">
                <Checkbox
                  id="occupancyPermit"
                  checked={occupancyPermitIssued}
                  onCheckedChange={(checked) => setOccupancyPermitIssued(Boolean(checked))}
                />
                <Label htmlFor="occupancyPermit" className="text-sm font-medium cursor-pointer">
                  Certificate of Occupancy Issued
                </Label>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingBuilding ? "Update Building" : "Save Building"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deletingBuilding} onOpenChange={(open) => !open && setDeletingBuilding(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cadastral Building?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete structure <strong>{deletingBuilding?.buildingCode}</strong>?
              {deletingBuilding && deletingBuilding.unitCount > 0 && (
                <div className="mt-2 text-destructive font-medium">
                  Warning: This structure has {deletingBuilding.unitCount} registered property unit(s) linked to it.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
