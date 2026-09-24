import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  LandPlot,
  Search,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  MapPin,
  Building2,
  FileCheck,
  Shield,
  Layers,
  ExternalLink,
  Compass,
  CheckCircle2,
} from "lucide-react";

export type LandParcel = {
  id: number;
  parcelUpi: string;
  kebeleId?: number | null;
  kebele: string;
  blockCode?: string | null;
  streetId?: number | null;
  streetName?: string | null;
  areaSqm?: number | null;
  perimeterMeters?: number | null;
  landTenure: string;
  titleDeedNumber?: string | null;
  zoningClassification: string;
  centerLat?: number | null;
  centerLng?: number | null;
  status: string;
  notes?: string | null;
  buildingCount: number;
  unitCount: number;
  createdAt: string;
  updatedAt: string;
};

const ZONING_TYPES = [
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "mixed", label: "Mixed-Use" },
  { value: "industrial", label: "Industrial" },
  { value: "public", label: "Public / Civic" },
  { value: "recreational", label: "Recreational / Green" },
];

const TENURE_TYPES = [
  { value: "leasehold", label: "Leasehold (Municipal)" },
  { value: "freehold", label: "Freehold / Private" },
  { value: "customary", label: "Customary Tenure" },
  { value: "state", label: "State / Federal Property" },
];

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("jimma_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function LandParcelsPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [parcels, setParcels] = useState<LandParcel[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [kebeleFilter, setKebeleFilter] = useState("all");
  const [zoningFilter, setZoningFilter] = useState("all");
  const [tenureFilter, setTenureFilter] = useState("all");

  // Create / Edit modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingParcel, setEditingParcel] = useState<LandParcel | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete modal state
  const [deletingParcel, setDeletingParcel] = useState<LandParcel | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form Fields
  const [parcelUpi, setParcelUpi] = useState("");
  const [kebele, setKebele] = useState("");
  const [blockCode, setBlockCode] = useState("");
  const [streetName, setStreetName] = useState("");
  const [areaSqm, setAreaSqm] = useState("");
  const [landTenure, setLandTenure] = useState("leasehold");
  const [titleDeedNumber, setTitleDeedNumber] = useState("");
  const [zoningClassification, setZoningClassification] = useState("residential");
  const [centerLat, setCenterLat] = useState("");
  const [centerLng, setCenterLng] = useState("");
  const [notes, setNotes] = useState("");

  const canEdit = user?.role === "admin" || user?.role === "city_officer";

  const fetchParcels = async () => {
    setIsLoading(true);
    try {
      const qParams = new URLSearchParams();
      if (search.trim()) qParams.set("search", search.trim());
      if (kebeleFilter !== "all") qParams.set("kebele", kebeleFilter);
      if (zoningFilter !== "all") qParams.set("zoning", zoningFilter);
      if (tenureFilter !== "all") qParams.set("tenure", tenureFilter);

      const res = await fetch(`/api/parcels?${qParams.toString()}`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error("Failed to load cadastral parcels");
      const data = await res.json();
      setParcels(data.parcels || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      toast({
        title: "Error fetching parcels",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchParcels();
  }, [search, kebeleFilter, zoningFilter, tenureFilter]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalArea = parcels.reduce((sum, p) => sum + (p.areaSqm || 0), 0);
    const multiUnit = parcels.filter((p) => p.unitCount > 1).length;
    const withBuildings = parcels.filter((p) => p.buildingCount > 0).length;
    return { totalArea: Math.round(totalArea), multiUnit, withBuildings };
  }, [parcels]);

  const openCreateModal = () => {
    setEditingParcel(null);
    setParcelUpi(`ET-OR-AGA-${Date.now().toString().slice(-6)}`);
    setKebele("Kebele 01");
    setBlockCode("BLK-01");
    setStreetName("");
    setAreaSqm("450");
    setLandTenure("leasehold");
    setTitleDeedNumber(`TD-AGA-${Math.floor(100000 + Math.random() * 900000)}`);
    setZoningClassification("residential");
    setCenterLat("7.8540");
    setCenterLng("36.6500");
    setNotes("");
    setIsFormOpen(true);
  };

  const openEditModal = (p: LandParcel) => {
    setEditingParcel(p);
    setParcelUpi(p.parcelUpi);
    setKebele(p.kebele);
    setBlockCode(p.blockCode || "");
    setStreetName(p.streetName || "");
    setAreaSqm(p.areaSqm != null ? String(p.areaSqm) : "");
    setLandTenure(p.landTenure || "leasehold");
    setTitleDeedNumber(p.titleDeedNumber || "");
    setZoningClassification(p.zoningClassification || "residential");
    setCenterLat(p.centerLat != null ? String(p.centerLat) : "");
    setCenterLng(p.centerLng != null ? String(p.centerLng) : "");
    setNotes(p.notes || "");
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parcelUpi.trim() || !kebele.trim()) {
      toast({ title: "Validation Error", description: "UPI and Kebele are required", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        parcelUpi: parcelUpi.trim(),
        kebele: kebele.trim(),
        blockCode: blockCode.trim() || undefined,
        streetName: streetName.trim() || undefined,
        areaSqm: areaSqm ? parseFloat(areaSqm) : undefined,
        landTenure,
        titleDeedNumber: titleDeedNumber.trim() || undefined,
        zoningClassification,
        centerLat: centerLat ? parseFloat(centerLat) : undefined,
        centerLng: centerLng ? parseFloat(centerLng) : undefined,
        notes: notes.trim() || undefined,
      };

      const url = editingParcel ? `/api/parcels/${editingParcel.id}` : "/api/parcels";
      const method = editingParcel ? "PUT" : "POST";

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
        throw new Error(err.error || "Failed to save cadastral parcel");
      }

      toast({
        title: editingParcel ? "Parcel updated" : "Parcel registered",
        description: `Cadastral plot ${parcelUpi} successfully recorded.`,
      });

      setIsFormOpen(false);
      fetchParcels();
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
    if (!deletingParcel) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/parcels/${deletingParcel.id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete parcel");
      }
      toast({
        title: "Parcel deleted",
        description: `Cadastral plot ${deletingParcel.parcelUpi} removed.`,
      });
      setDeletingParcel(null);
      fetchParcels();
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
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <LandPlot className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Cadastral Land Parcels</h1>
            <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-800 border-emerald-300 font-mono">
              ISO 19152 LADM
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Official municipal cadastral plots, title deeds, land tenure, and registered spatial boundaries.
          </p>
        </div>

        {canEdit && (
          <Button onClick={openCreateModal} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" />
            Register Land Parcel
          </Button>
        )}
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold">{total}</div>
              <div className="text-xs text-muted-foreground">Total Cadastral Plots</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <LandPlot className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.totalArea.toLocaleString()} m²</div>
              <div className="text-xs text-muted-foreground">Total Registered Area</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.withBuildings}</div>
              <div className="text-xs text-muted-foreground">Plots with Buildings</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.multiUnit}</div>
              <div className="text-xs text-muted-foreground">Multi-Unit Parcels</div>
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
              placeholder="Search by UPI, title deed, or street..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={kebeleFilter} onValueChange={setKebeleFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Kebele" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Kebeles</SelectItem>
              <SelectItem value="Kebele 01">Kebele 01</SelectItem>
              <SelectItem value="Kebele 02">Kebele 02</SelectItem>
              <SelectItem value="Kebele 03">Kebele 03</SelectItem>
              <SelectItem value="Kebele 04">Kebele 04</SelectItem>
              <SelectItem value="Kebele 05">Kebele 05</SelectItem>
              <SelectItem value="AJR">AJR</SelectItem>
              <SelectItem value="BCH">BCH</SelectItem>
              <SelectItem value="FMG">FMG</SelectItem>
            </SelectContent>
          </Select>

          <Select value={zoningFilter} onValueChange={setZoningFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Zoning" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zoning</SelectItem>
              {ZONING_TYPES.map((z) => (
                <SelectItem key={z.value} value={z.value}>{z.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={tenureFilter} onValueChange={setTenureFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tenure" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tenures</SelectItem>
              {TENURE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-auto" />}
        </CardContent>
      </Card>

      {/* Parcels Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">UPI / Parcel Code</th>
                <th className="px-4 py-3">Location & Block</th>
                <th className="px-4 py-3">Area (m²)</th>
                <th className="px-4 py-3">Land Tenure</th>
                <th className="px-4 py-3">Title Deed #</th>
                <th className="px-4 py-3">Zoning</th>
                <th className="px-4 py-3">Built Structures</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && parcels.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading cadastral plots...
                  </td>
                </tr>
              ) : parcels.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-muted-foreground">
                    No cadastral parcels found matching your search criteria.
                  </td>
                </tr>
              ) : (
                parcels.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-primary font-mono text-xs">{p.parcelUpi}</div>
                      <div className="text-[11px] text-muted-foreground">ID #{p.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.kebele}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.blockCode ? `Block ${p.blockCode}` : "No block"} {p.streetName ? `• ${p.streetName}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {p.areaSqm ? `${p.areaSqm.toLocaleString()} m²` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="capitalize text-xs font-normal">
                        {p.landTenure}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {p.titleDeedNumber || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="capitalize text-xs">
                        {p.zoningClassification}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-xs bg-slate-50 border-slate-200">
                          <Building2 className="w-3 h-3 mr-1 text-slate-600" />
                          {p.buildingCount} {p.buildingCount === 1 ? "Building" : "Buildings"}
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-800 border-emerald-200">
                          {p.unitCount} {p.unitCount === 1 ? "Unit" : "Units"}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {p.centerLat && p.centerLng && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs text-emerald-700 hover:text-emerald-800"
                            onClick={() => navigate(`/map?lat=${p.centerLat}&lng=${p.centerLng}`)}
                            title="View coordinates on GIS Map"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {canEdit && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={() => openEditModal(p)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                              onClick={() => setDeletingParcel(p)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Register / Edit Parcel Modal */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LandPlot className="w-5 h-5 text-emerald-600" />
              {editingParcel ? "Edit Cadastral Parcel" : "Register Cadastral Land Parcel"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="parcelUpi">Unique Parcel Identifier (UPI) *</Label>
                <Input
                  id="parcelUpi"
                  value={parcelUpi}
                  onChange={(e) => setParcelUpi(e.target.value)}
                  placeholder="e.g. ET-OR-JMA-KB01-PL001"
                  required
                />
              </div>

              <div>
                <Label htmlFor="titleDeed">Title Deed / Cadasre Certificate #</Label>
                <Input
                  id="titleDeed"
                  value={titleDeedNumber}
                  onChange={(e) => setTitleDeedNumber(e.target.value)}
                  placeholder="e.g. TD-JMA-834912"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="kebele">Kebele *</Label>
                <Input
                  id="kebele"
                  value={kebele}
                  onChange={(e) => setKebele(e.target.value)}
                  placeholder="e.g. Ginjo"
                  required
                />
              </div>

              <div>
                <Label htmlFor="blockCode">Block Code</Label>
                <Input
                  id="blockCode"
                  value={blockCode}
                  onChange={(e) => setBlockCode(e.target.value)}
                  placeholder="e.g. BLK-04"
                />
              </div>

              <div>
                <Label htmlFor="streetName">Street Name</Label>
                <Input
                  id="streetName"
                  value={streetName}
                  onChange={(e) => setStreetName(e.target.value)}
                  placeholder="e.g. Aba Jifar St"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="areaSqm">Cadastral Area (m²)</Label>
                <Input
                  id="areaSqm"
                  type="number"
                  step="0.01"
                  value={areaSqm}
                  onChange={(e) => setAreaSqm(e.target.value)}
                  placeholder="e.g. 500"
                />
              </div>

              <div>
                <Label>Land Tenure</Label>
                <Select value={landTenure} onValueChange={setLandTenure}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TENURE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Zoning Classification</Label>
                <Select value={zoningClassification} onValueChange={setZoningClassification}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ZONING_TYPES.map((z) => (
                      <SelectItem key={z.value} value={z.value}>{z.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="centerLat">Centroid Latitude (°N)</Label>
                <Input
                  id="centerLat"
                  type="number"
                  step="any"
                  value={centerLat}
                  onChange={(e) => setCenterLat(e.target.value)}
                  placeholder="e.g. 7.6734"
                />
              </div>

              <div>
                <Label htmlFor="centerLng">Centroid Longitude (°E)</Label>
                <Input
                  id="centerLng"
                  type="number"
                  step="any"
                  value={centerLng}
                  onChange={(e) => setCenterLng(e.target.value)}
                  placeholder="e.g. 36.8344"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Cadastral Registry Notes</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Boundary survey notes, easements, restrictions..."
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingParcel ? "Update Parcel" : "Save Parcel"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deletingParcel} onOpenChange={(open) => !open && setDeletingParcel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cadastral Parcel?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete cadastral parcel <strong>{deletingParcel?.parcelUpi}</strong>?
              {deletingParcel && deletingParcel.buildingCount > 0 && (
                <div className="mt-2 text-destructive font-medium">
                  Warning: This parcel has {deletingParcel.buildingCount} registered building(s) and {deletingParcel.unitCount} unit(s) linked to it.
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
