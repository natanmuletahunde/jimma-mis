import { useState, useMemo } from "react";
import { Redirect } from "wouter";
import {
  useListKebeles,
  useCreateKebele,
  useUpdateKebele,
  useDeleteKebele,
  getListKebelesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2, Loader2, MapPin, AlertTriangle } from "lucide-react";

type Kebele = {
  id: number; name: string; code: string; city: string;
  subCity: string | null; woreda: string | null; district: string | null;
  status: string; createdAt: string; updatedAt: string;
};

type FormData = {
  name: string; code: string; city: string; subCity: string;
  woreda: string; district: string; status: string;
};

const EMPTY: FormData = { name: "", code: "", city: "Jimma", subCity: "", woreda: "", district: "", status: "active" };

function KebeleFormDialog({ open, onOpenChange, editItem, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; editItem: Kebele | null; onSaved: () => void;
}) {
  const { toast } = useToast();
  const createKebele = useCreateKebele();
  const updateKebele = useUpdateKebele();
  const isEdit = editItem !== null;

  function makeForm(k: Kebele | null): FormData {
    if (!k) return EMPTY;
    return { name: k.name, code: k.code, city: k.city, subCity: k.subCity ?? "", woreda: k.woreda ?? "", district: k.district ?? "", status: k.status };
  }

  const [form, setForm] = useState<FormData>(() => makeForm(editItem));
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  function handleOpen(v: boolean) {
    if (v) { setForm(makeForm(editItem)); setErrors({}); }
    onOpenChange(v);
  }

  function validate() {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = "Kebele name is required";
    if (!form.code.trim()) e.code = "Kebele code is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    const payload = {
      name: form.name.trim(), code: form.code.trim().toUpperCase(),
      city: form.city.trim() || "Jimma", subCity: form.subCity.trim() || null,
      woreda: form.woreda.trim() || null, district: form.district.trim() || null,
      status: form.status as "active" | "inactive",
    };
    if (isEdit) {
      updateKebele.mutate({ id: editItem.id, data: payload }, {
        onSuccess: () => { toast({ title: "Kebele updated" }); handleOpen(false); onSaved(); },
        onError: () => toast({ variant: "destructive", title: "Failed to update. Code may be duplicate." }),
      });
    } else {
      createKebele.mutate({ data: payload }, {
        onSuccess: () => { toast({ title: "Kebele created" }); handleOpen(false); onSaved(); },
        onError: () => toast({ variant: "destructive", title: "Failed to create. Code may be duplicate." }),
      });
    }
  }

  const isPending = createKebele.isPending || updateKebele.isPending;
  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Edit Kebele / Location" : "Add Kebele / Location"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Kebele Name <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={set("name")} placeholder="e.g. Kebele 01" />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label>Kebele Code <span className="text-destructive">*</span></Label>
              <Input value={form.code} onChange={set("code")} placeholder="e.g. KB01" className="uppercase" />
              {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>City</Label>
              <Input value={form.city} onChange={set("city")} placeholder="Jimma" />
            </div>
            <div className="grid gap-1.5">
              <Label>Sub-City</Label>
              <Input value={form.subCity} onChange={set("subCity")} placeholder="e.g. Jimma Central" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Woreda</Label>
              <Input value={form.woreda} onChange={set("woreda")} placeholder="e.g. Woreda 02" />
            </div>
            <div className="grid gap-1.5">
              <Label>District</Label>
              <Input value={form.district} onChange={set("district")} placeholder="e.g. East District" />
            </div>
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
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpen(false)} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Kebele"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function LocationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const canEdit = user?.role === "admin" || user?.role === "city_officer";
  const canDelete = user?.role === "admin";
  if (!canEdit && user?.role !== "kebele_officer" && user?.role !== "viewer") return <Redirect to="/dashboard" />;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<Kebele | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Kebele | null>(null);

  const { data: kebeles = [], isLoading, error } = useListKebeles();
  const deleteKebele = useDeleteKebele();

  function invalidate() { queryClient.invalidateQueries({ queryKey: getListKebelesQueryKey() }); }

  const filtered = useMemo(() => {
    return (kebeles as Kebele[]).filter((k) => {
      if (statusFilter && k.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return k.name.toLowerCase().includes(q) || k.code.toLowerCase().includes(q) || (k.woreda ?? "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [kebeles, search, statusFilter]);

  function handleDelete() {
    if (!deleteTarget) return;
    deleteKebele.mutate({ id: deleteTarget.id }, {
      onSuccess: () => { invalidate(); toast({ title: "Kebele deleted" }); setDeleteTarget(null); },
      onError: (err: Error) => {
        const msg = err?.message?.includes("400") ? "Cannot delete: kebele is in use by properties or has streets." : "Failed to delete kebele";
        toast({ variant: "destructive", title: msg }); setDeleteTarget(null);
      },
    });
  }

  const activeCount = (kebeles as Kebele[]).filter((k) => k.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Locations / Kebeles</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage kebele locations used in property registration.</p>
        </div>
        {canEdit && (
          <Button onClick={() => { setEditItem(null); setFormOpen(true); }} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" /> Add Kebele
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Total", value: (kebeles as Kebele[]).length, color: "bg-slate-500" },
          { label: "Active", value: activeCount, color: "bg-emerald-500" },
          { label: "Inactive", value: (kebeles as Kebele[]).length - activeCount, color: "bg-amber-500" },
        ].map((c) => (
          <Card key={c.label}><div className="flex items-center gap-3 p-4">
            <div className={`p-2.5 rounded-lg ${c.color} shrink-0`}><MapPin className="h-4 w-4 text-white" /></div>
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
            <Input className="pl-9" placeholder="Search by name, code, or woreda…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-w-[130px]">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          {(search || statusFilter) && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter(""); }}>Clear</Button>
          )}
        </div>
      </CardContent></Card>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 flex items-center gap-3 text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="text-sm">Failed to load kebeles.</span>
        </div>
      )}

      <Card><CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <MapPin className="h-10 w-10" />
            <p className="text-sm font-medium">No kebeles found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  {["Code", "Name", "City", "Sub-City", "Woreda", "Status", "Created", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((k, idx) => (
                  <tr key={k.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${idx % 2 !== 0 ? "bg-muted/10" : ""}`}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{k.code}</td>
                    <td className="px-4 py-3 font-medium">{k.name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{k.city}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{k.subCity || "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{k.woreda || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge className={k.status === "active" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0" : "bg-red-100 text-red-700 hover:bg-red-100 border-0"}>
                        {k.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                      {new Date(k.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canEdit && (
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditItem(k); setFormOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {canDelete && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteTarget(k)}>
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
              Showing {filtered.length} of {(kebeles as Kebele[]).length} kebele{(kebeles as Kebele[]).length !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </CardContent></Card>

      {formOpen && (
        <KebeleFormDialog open={formOpen} onOpenChange={setFormOpen} editItem={editItem} onSaved={invalidate} />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Kebele</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{deleteTarget?.name}</strong> ({deleteTarget?.code})? This cannot be undone.
              Kebeles referenced by properties or with assigned streets cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteKebele.isPending}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              {deleteKebele.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
