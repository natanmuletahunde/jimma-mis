import { useState, useMemo } from "react";
import { Redirect } from "wouter";
import {
  useListUsers,
  useCreateUser,
  useUpdateUser,
  useUpdateUserStatus,
  useDeleteUser,
  useGetRoles,
  useGetByKebele,
  getListUsersQueryKey,
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
  Plus,
  Search,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
  Loader2,
  Users,
  ShieldCheck,
  Eye,
  AlertTriangle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────────

type ApiUser = {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string;
  kebeleId: number | null;
  kebeleName?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string | null;
};

type UserFormData = {
  username: string;
  password: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  kebeleId: string;
  isActive: boolean;
};

const EMPTY_FORM: UserFormData = {
  username: "",
  password: "",
  fullName: "",
  email: "",
  phone: "",
  role: "enumerator",
  kebeleId: "",
  isActive: true,
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  city_officer: "City Officer",
  kebele_officer: "Kebele Officer",
  enumerator: "Enumerator",
  viewer: "Viewer",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-800",
  city_officer: "bg-blue-100 text-blue-800",
  kebele_officer: "bg-cyan-100 text-cyan-800",
  enumerator: "bg-orange-100 text-orange-800",
  viewer: "bg-gray-100 text-gray-700",
};

const KEBELE_REQUIRED_ROLES = ["kebele_officer", "enumerator"];

// ─── User Form Dialog ─────────────────────────────────────────────────────────────

function UserFormDialog({
  open,
  onOpenChange,
  editUser,
  kebeles,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editUser: ApiUser | null;
  kebeles: { kebele: string }[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const isEdit = editUser !== null;

  function makeForm(u: ApiUser | null): UserFormData {
    if (!u) return EMPTY_FORM;
    return {
      username: u.username,
      password: "",
      fullName: u.fullName,
      email: u.email ?? "",
      phone: u.phone ?? "",
      role: u.role,
      kebeleId: u.kebeleId?.toString() ?? "",
      isActive: u.isActive,
    };
  }

  const [form, setForm] = useState<UserFormData>(() => makeForm(editUser));
  const [errors, setErrors] = useState<Partial<Record<keyof UserFormData, string>>>({});

  function handleOpen(v: boolean) {
    if (v) setForm(makeForm(editUser));
    setErrors({});
    onOpenChange(v);
  }

  function validate() {
    const e: typeof errors = {};
    if (!form.fullName.trim()) e.fullName = "Full name is required";
    if (!isEdit && !form.username.trim()) e.username = "Username is required";
    if (!isEdit && !form.password.trim()) e.password = "Password is required";
    if (!form.role) e.role = "Role is required";
    if (KEBELE_REQUIRED_ROLES.includes(form.role) && !form.kebeleId)
      e.kebeleId = "Kebele is required for this role";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Invalid email address";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;

    const kebeleIdNum = form.kebeleId ? parseInt(form.kebeleId, 10) : null;

    if (isEdit) {
      const updatePayload: Record<string, unknown> = {
        fullName: form.fullName,
        email: form.email || null,
        phone: form.phone || null,
        role: form.role,
        kebeleId: isNaN(kebeleIdNum!) ? null : kebeleIdNum,
        isActive: form.isActive,
      };
      if (form.password) updatePayload.password = form.password;

      updateUser.mutate(
        { id: editUser.id, data: updatePayload as Parameters<typeof updateUser.mutate>[0]["data"] },
        {
          onSuccess: () => {
            toast({ title: "User updated successfully" });
            handleOpen(false);
            onSaved();
          },
          onError: () => {
            toast({ variant: "destructive", title: "Failed to update user. Check for duplicate email." });
          },
        },
      );
    } else {
      const createPayload = {
        username: form.username,
        fullName: form.fullName,
        email: form.email || undefined,
        phone: form.phone || undefined,
        role: form.role,
        kebeleId: isNaN(kebeleIdNum!) ? null : kebeleIdNum,
        ...(form.password ? { password: form.password } : {}),
      };

      createUser.mutate(
        { data: createPayload as Parameters<typeof createUser.mutate>[0]["data"] },
        {
          onSuccess: () => {
            toast({ title: "User created successfully" });
            handleOpen(false);
            onSaved();
          },
          onError: () => {
            toast({ variant: "destructive", title: "Failed to create user. Email or username may be duplicate." });
          },
        },
      );
    }
  }

  const isPending = createUser.isPending || updateUser.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit User" : "Add New User"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Full Name <span className="text-destructive">*</span></Label>
            <Input
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              placeholder="e.g. Abebe Girma"
            />
            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
          </div>

          {!isEdit && (
            <div className="grid gap-1.5">
              <Label>Username <span className="text-destructive">*</span></Label>
              <Input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="e.g. abebe.girma"
                autoComplete="off"
              />
              {errors.username && <p className="text-xs text-destructive">{errors.username}</p>}
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="e.g. abebe@example.com"
              autoComplete="off"
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          <div className="grid gap-1.5">
            <Label>Phone Number</Label>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="e.g. +251 91 234 5678"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Role <span className="text-destructive">*</span></Label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value, kebeleId: "" }))}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {Object.entries(ROLE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              {errors.role && <p className="text-xs text-destructive">{errors.role}</p>}
            </div>

            <div className="grid gap-1.5">
              <Label>
                Assigned Kebele
                {KEBELE_REQUIRED_ROLES.includes(form.role) && <span className="text-destructive"> *</span>}
              </Label>
              <select
                value={form.kebeleId}
                onChange={(e) => setForm((f) => ({ ...f, kebeleId: e.target.value }))}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">None</option>
                {kebeles.map((k) => (
                  <option key={k.kebele} value={k.kebele}>{k.kebele}</option>
                ))}
              </select>
              {errors.kebeleId && <p className="text-xs text-destructive">{errors.kebeleId}</p>}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>
              {isEdit ? "New Password" : "Password"}
              {!isEdit && <span className="text-destructive"> *</span>}
            </Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder={isEdit ? "Leave blank to keep current" : "Default: Password@123"}
              autoComplete="new-password"
            />
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            {!isEdit && (
              <p className="text-xs text-muted-foreground">
                If blank, default password <strong>Password@123</strong> will be set.
              </p>
            )}
          </div>

          {isEdit && (
            <div className="flex items-center gap-3 pt-1">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <Label htmlFor="isActive" className="cursor-pointer font-normal">
                Account is active
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? "Save Changes" : "Create User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isAdmin = user?.role === "admin";
  const isCityOfficer = user?.role === "city_officer";

  if (!isAdmin && !isCityOfficer) {
    return <Redirect to="/dashboard" />;
  }

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editUser, setEditUser] = useState<ApiUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiUser | null>(null);

  const { data: users, isLoading, error } = useListUsers();
  const { data: kebeles = [] } = useGetByKebele();
  const { data: roles = [] } = useGetRoles();
  const deleteUser = useDeleteUser();
  const updateStatus = useUpdateUserStatus();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
  }

  const filtered = useMemo(() => {
    if (!users) return [];
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (statusFilter === "active" && !u.isActive) return false;
      if (statusFilter === "inactive" && u.isActive) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          u.fullName.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q) ||
          (u.phone ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  function handleToggleStatus(u: ApiUser) {
    updateStatus.mutate(
      { id: u.id, data: { isActive: !u.isActive } },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: `User ${u.isActive ? "deactivated" : "activated"} successfully` });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Failed to update user status" });
        },
      },
    );
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteUser.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "User deleted successfully" });
          setDeleteTarget(null);
        },
        onError: () => {
          toast({ variant: "destructive", title: "Failed to delete user" });
          setDeleteTarget(null);
        },
      },
    );
  }

  const activeCount = users?.filter((u) => u.isActive).length ?? 0;
  const totalCount = users?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isAdmin
              ? "Manage system users, roles, and access permissions."
              : "View system users and their roles (read-only)."}
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => { setEditUser(null); setFormOpen(true); }}
            className="gap-2 shrink-0"
          >
            <Plus className="h-4 w-4" /> Add User
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Users", value: totalCount, icon: Users, color: "bg-slate-500" },
          { label: "Active", value: activeCount, icon: UserCheck, color: "bg-emerald-500" },
          { label: "Inactive", value: totalCount - activeCount, icon: UserX, color: "bg-red-400" },
          { label: "Roles", value: roles.length, icon: ShieldCheck, color: "bg-blue-500" },
        ].map((c) => (
          <Card key={c.label} className="hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 p-4">
              <div className={`p-2.5 rounded-lg ${c.color} shrink-0`}>
                <c.icon className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-xl font-bold tabular-nums">{isLoading ? "—" : c.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Search + Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name, username, email or phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-w-[140px]"
            >
              <option value="">All Roles</option>
              {Object.entries(ROLE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-w-[120px]"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            {(search || roleFilter || statusFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearch(""); setRoleFilter(""); setStatusFilter(""); }}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 flex items-center gap-3 text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="text-sm">Failed to load users. Please refresh.</span>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <Users className="h-10 w-10" />
              <p className="text-sm font-medium">No users found</p>
              {(search || roleFilter || statusFilter) && (
                <p className="text-xs">Try adjusting your search or filters</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground w-10">#</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">User</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Contact</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Role</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Kebele</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Created</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u, idx) => {
                    const isSelf = u.id === user?.id;
                    return (
                      <tr
                        key={u.id}
                        className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${idx % 2 !== 0 ? "bg-muted/10" : ""}`}
                      >
                        <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">{u.id}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-xs font-semibold text-primary">
                                {u.fullName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium flex items-center gap-1.5 flex-wrap">
                                <span className="truncate">{u.fullName}</span>
                                {isSelf && (
                                  <span className="text-[10px] px-1 py-0.5 bg-primary/10 text-primary rounded font-semibold shrink-0">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">@{u.username}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="text-xs space-y-0.5">
                            {u.email ? (
                              <div className="text-foreground truncate max-w-[180px]">{u.email}</div>
                            ) : (
                              <span className="text-muted-foreground italic">No email</span>
                            )}
                            {u.phone && (
                              <div className="text-muted-foreground">{u.phone}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                              ROLE_COLORS[u.role] ?? "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {ROLE_LABELS[u.role] ?? u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                          {(u as ApiUser).kebeleName ?? (u.kebeleId ? `#${u.kebeleId}` : "—")}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            className={
                              u.isActive
                                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0"
                                : "bg-red-100 text-red-700 hover:bg-red-100 border-0"
                            }
                          >
                            {u.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                          {new Date(u.createdAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isAdmin ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => { setEditUser(u as ApiUser); setFormOpen(true); }}
                                title="Edit user"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-7 w-7 p-0 ${
                                  u.isActive
                                    ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                    : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                }`}
                                onClick={() => handleToggleStatus(u as ApiUser)}
                                disabled={isSelf || updateStatus.isPending}
                                title={u.isActive ? "Deactivate" : "Activate"}
                              >
                                {u.isActive ? (
                                  <UserX className="h-3.5 w-3.5" />
                                ) : (
                                  <UserCheck className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteTarget(u as ApiUser)}
                                disabled={isSelf}
                                title="Delete user"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                              <Eye className="h-3 w-3" /> Read only
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="px-4 py-2.5 border-t bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
                <span>
                  Showing {filtered.length} of {totalCount} user{totalCount !== 1 ? "s" : ""}
                </span>
                {isAdmin && (
                  <span className="hidden sm:block">
                    Default password: <strong>Password@123</strong>
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      {formOpen && (
        <UserFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          editUser={editUser}
          kebeles={kebeles}
          onSaved={invalidate}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete{" "}
              <strong>{deleteTarget?.fullName}</strong>{" "}
              (@{deleteTarget?.username})? This action cannot be undone and will remove all
              associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
