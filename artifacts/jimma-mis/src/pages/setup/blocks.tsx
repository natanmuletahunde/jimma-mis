import { useState, useMemo } from "react";
import { Redirect } from "wouter";
import {
  useListBlocks, useListKebeles, useListStreets, useCreateBlock, useUpdateBlock, useDeleteBlock,
  getListBlocksQueryKey,
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
import { Plus, Search, Pencil, Trash2, Loader2, Grid3x3, AlertTriangle } from "lucide-react";

type Block = {
  id: number; code: string; kebeleId: number; kebeleName: string | null;
  streetId: number; streetName: string | null; streetCode: string | null;
  description: string | null; status: string; createdAt: string; updatedAt: string;
};
type Kebele = { id: number; name: string; code: string };
type Street = { id: number; name: string; code: string; kebeleId: number };

type FormData = { code: string; kebeleId: string; streetId: string; description: string; status: string; };
const EMPTY: FormData = { code: "", kebeleId: "", streetId: "", description: "", status: "active" };

function BlockFormDialog({ open, onOpenChange, editItem, kebeles, allStreets, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; editItem: Block | null;
  kebeles: Kebele[]; allStreets: Street[]; onSaved: () => void;
}) {
  const { toast } = useToast();
  const createBlock = useCreateBlock();
  const updateBlock = useUpdateBlock();
  const isEdit = editItem !== null;

  function makeForm(b: Block | null): FormData {
    if (!b) return EMPTY;
    return { code: b.code, kebeleId: b.kebeleId.toString(), streetId: b.streetId.toString(), description: b.description ?? "", status: b.status };
  }

  const [form, setForm] = useState<FormData>(() => makeForm(editItem));
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const filteredStreets = useMemo(() =>
    form.kebeleId ? allStreets.filter((s) => s.kebeleId === parseInt(form.kebeleId, 10)) : [],
    [form.kebeleId, allStreets]);

  function handleOpen(v: boolean) {
    if (v) { setForm(makeForm(editItem)); setErrors({}); }
    onOpenChange(v);
  }

  function validate() {
    const e: typeof errors = {};
    if (!form.code.trim()) e.code = "Block code is required";
    if (!form.kebeleId) e.kebeleId = "Kebele is required";
    if (!form.streetId) e.streetId = "Street is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    const payload = {
      code: form.code.trim().toUpperCase(), kebeleId: parseInt(form.kebeleId, 10),
      streetId: parseInt(form.streetId, 10), description: form.description.trim() || null,
      status: form.status as "active" | "inactive",
    };
    if (isEdit) {
      updateBlock.mutate({ id: editItem.id, data: payload }, {
        onSuccess: () => { toast({ title: "Block updated" }); handleOpen(false); onSaved(); },
        onError: () => toast({ variant: "destructive", title: "Failed to update. Code may be duplicate in this street." }),
      });
    } else {
      createBlock.mutate({ data: payload }, {
        onSuccess: () => { toast({ title: "Block created" }); handleOpen(false); onSaved(); },
        onError: () => toast({ variant: "destructive", title: "Failed to create. Code may be duplicate in this street." }),
      });
    }
  }

  const isPending = createBlock.isPending || updateBlock.isPending;
  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Edit Block" : "Add Block"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Block Code <span className="text-destructive">*</span></Label>
            <Input value={form.code} onChange={set("code")} placeholder="e.g. BL01" className="uppercase" />
            {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label>Kebele <span className="text-destructive">*</span></Label>
            <select value={form.kebeleId} onChange={(e) => setForm((f) => ({ ...f, kebeleId: e.target.value, streetId: "" }))}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">Select kebele…</option>
              {kebeles.map((k) => <option key={k.id} value={k.id}>{k.name} ({k.code})</option>)}
            </select>
            {errors.kebeleId && <p className="text-xs text-destructive">{errors.kebeleId}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label>Street <span className="text-destructive">*</span></Label>
            <select value={form.streetId} onChange={set("streetId")} disabled={!form.kebeleId}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50">
              <option value="">{form.kebeleId ? "Select street…" : "Select kebele first"}</option>
              {filteredStreets.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
            {errors.streetId && <p className="text-xs text-destructive">{errors.streetId}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label>Description</Label>
            <textarea value={form.description} onChange={set("description")} rows={2} placeholder="Optional notes…"
              className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
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
            {isEdit ? "Save Changes" : "Create Block"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BlocksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const canEdit = user?.role === "admin" || user?.role === "city_officer";
  const canDelete = user?.role === "admin";
  if (!canEdit && user?.role !== "kebele_officer" && user?.role !== "viewer") return <Redirect to="/dashboard" />;

  const [search, setSearch] = useState("");
  const [kebeleFilter, setKebeleFilter] = useState("");
  const [streetFilter, setStreetFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<Block | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Block | null>(null);

  const { data: blocks = [], isLoading, error } = useListBlocks();
  const { data: kebeles = [] } = useListKebeles();
  const { data: streets = [] } = useListStreets();
  const deleteBlock = useDeleteBlock();

  function invalidate() { queryClient.invalidateQueries({ queryKey: getListBlocksQueryKey() }); }

  const streetsByKebele = useMemo(() =>
    kebeleFilter ? (streets as Street[]).filter((s) => s.kebeleId === parseInt(kebeleFilter, 10)) : (streets as Street[]),
    [streets, kebeleFilter]);

  const filtered = useMemo(() => {
    return (blocks as Block[]).filter((b) => {
      if (kebeleFilter && b.kebeleId.toString() !== kebeleFilter) return false;
      if (streetFilter && b.streetId.toString() !== streetFilter) return false;
      if (statusFilter && b.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return b.code.toLowerCase().includes(q) || (b.kebeleName ?? "").toLowerCase().includes(q) || (b.streetName ?? "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [blocks, search, kebeleFilter, streetFilter, statusFilter]);

  function handleDelete() {
    if (!deleteTarget) return;
    deleteBlock.mutate({ id: deleteTarget.id }, {
      onSuccess: () => { invalidate(); toast({ title: "Block deleted" }); setDeleteTarget(null); },
      onError: (err: Error) => {
        const msg = err?.message?.includes("400") ? "Cannot delete: block is in use by properties." : "Failed to delete";
        toast({ variant: "destructive", title: msg }); setDeleteTarget(null);
      },
    });
  }

  const activeCount = (blocks as Block[]).filter((b) => b.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Blocks</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage block codes within streets for address generation.</p>
        </div>
        {canEdit && (
          <Button onClick={() => { setEditItem(null); setFormOpen(true); }} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" /> Add Block
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Total", value: (blocks as Block[]).length, color: "bg-slate-500" },
          { label: "Active", value: activeCount, color: "bg-emerald-500" },
          { label: "Inactive", value: (blocks as Block[]).length - activeCount, color: "bg-amber-500" },
        ].map((c) => (
          <Card key={c.label}><div className="flex items-center gap-3 p-4">
            <div className={`p-2.5 rounded-lg ${c.color} shrink-0`}><Grid3x3 className="h-4 w-4 text-white" /></div>
            <div><p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-xl font-bold tabular-nums">{isLoading ? "—" : c.value}</p>
            </div>
          </div></Card>
        ))}
      </div>

      <Card><CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by code, kebele, or street…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select value={kebeleFilter} onChange={(e) => { setKebeleFilter(e.target.value); setStreetFilter(""); }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-w-[140px]">
            <option value="">All Kebeles</option>
            {(kebeles as Kebele[]).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
          <select value={streetFilter} onChange={(e) => setStreetFilter(e.target.value)} disabled={!kebeleFilter}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-w-[140px] disabled:opacity-50">
            <option value="">All Streets</option>
            {streetsByKebele.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-w-[120px]">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          {(search || kebeleFilter || streetFilter || statusFilter) && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setKebeleFilter(""); setStreetFilter(""); setStatusFilter(""); }}>Clear</Button>
          )}
        </div>
      </CardContent></Card>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 flex items-center gap-3 text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" /><span className="text-sm">Failed to load blocks.</span>
        </div>
      )}

      <Card><CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <Grid3x3 className="h-10 w-10" /><p className="text-sm font-medium">No blocks found</p>
            {canEdit && <p className="text-xs">Add blocks to enable address code generation</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  {["Code", "Kebele", "Street", "Street Code", "Status", "Created", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((b, idx) => (
                  <tr key={b.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${idx % 2 !== 0 ? "bg-muted/10" : ""}`}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{b.code}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{b.kebeleName || `#${b.kebeleId}`}</td>
                    <td className="px-4 py-3 text-xs">{b.streetName || `#${b.streetId}`}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{b.streetCode || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge className={b.status === "active" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0" : "bg-red-100 text-red-700 hover:bg-red-100 border-0"}>
                        {b.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                      {new Date(b.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canEdit && (
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditItem(b); setFormOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {canDelete && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteTarget(b)}>
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
              Showing {filtered.length} of {(blocks as Block[]).length} block{(blocks as Block[]).length !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </CardContent></Card>

      {formOpen && (
        <BlockFormDialog open={formOpen} onOpenChange={setFormOpen} editItem={editItem}
          kebeles={kebeles as Kebele[]} allStreets={streets as Street[]} onSaved={invalidate} />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Block</AlertDialogTitle>
            <AlertDialogDescription>
              Delete block <strong>{deleteTarget?.code}</strong>? Blocks referenced by properties cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteBlock.isPending}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              {deleteBlock.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
