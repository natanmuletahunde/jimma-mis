import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useOfflineDB } from "@/hooks/use-offline-db";
import { useSync } from "@/hooks/use-sync";
import {
  RefreshCw,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  WifiOff,
  MapPin,
  Camera,
  Clock,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

function humanError(raw: string): string {
  if (/duplicate|already exists/i.test(raw)) return "Duplicate: this house number already exists on this street.";
  if (/gps|latitude|longitude|coordinates/i.test(raw)) return "Missing GPS coordinates — add them before syncing.";
  if (/photo|front.?view/i.test(raw)) return "Missing front view photo — add it before syncing.";
  if (/unauthorized|forbidden|403/i.test(raw)) return "Not authorized — you cannot submit this property.";
  if (/validation|invalid|required/i.test(raw)) return `Validation error: ${raw}`;
  return raw;
}

export default function OfflineDrafts() {
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { drafts, unsyncedDrafts, syncedDrafts, loading, deleteDraft } = useOfflineDB();
  const { syncOne, syncAll, isSyncing, syncingAll } = useSync();

  const [tab, setTab] = useState<"unsynced" | "synced">("unsynced");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const handleDelete = async (localId: string) => {
    try {
      await deleteDraft(localId);
      setConfirmDelete(null);
      showToast("success", "Draft deleted.");
    } catch {
      showToast("error", "Could not delete draft.");
    }
  };

  const handleSync = async (localId: string) => {
    if (!isOnline) { showToast("error", "You are offline. Connect to sync."); return; }
    const draft = drafts.find((d) => d.localId === localId);
    if (!draft) return;
    await syncOne(draft, token ?? null);
    // Result visible in card
  };

  const handleSyncAll = async () => {
    if (!isOnline) { showToast("error", "You are offline. Connect to sync."); return; }
    await syncAll(token ?? null);
    showToast("success", "Sync complete. Check each draft for results.");
  };

  const displayed = tab === "unsynced" ? unsyncedDrafts : syncedDrafts;

  return (
    <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Offline Drafts</h1>
          <p className="text-sm text-slate-500">
            {unsyncedDrafts.length} pending · {syncedDrafts.length} synced
          </p>
        </div>
        {unsyncedDrafts.length > 0 && (
          <button
            onClick={handleSyncAll}
            disabled={!isOnline || syncingAll}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all",
              isOnline
                ? "bg-blue-600 text-white active:bg-blue-700"
                : "bg-slate-200 text-slate-500 cursor-not-allowed",
            )}
          >
            {syncingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync All
          </button>
        )}
      </div>

      {!isOnline && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-amber-800">
          <WifiOff className="w-4 h-4 shrink-0" />
          Offline — connect to sync your drafts.
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
        {(["unsynced", "synced"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-semibold transition-all",
              tab === t ? "bg-white text-slate-800 shadow-sm" : "text-slate-500",
            )}
          >
            {t === "unsynced" ? `Pending (${unsyncedDrafts.length})` : `Synced (${syncedDrafts.length})`}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-sm gap-2">
          <CheckCircle2 className="w-10 h-10 text-slate-300" />
          <p className="font-semibold text-slate-500">
            {tab === "unsynced" ? "No pending drafts" : "No synced drafts yet"}
          </p>
          {tab === "unsynced" && (
            <p className="text-xs text-center">
              Save a property on the New tab and it will appear here.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((draft) => {
            const syncing = isSyncing(draft.localId);
            return (
              <div
                key={draft.localId}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
              >
                {/* Status stripe */}
                <div
                  className={cn(
                    "h-1",
                    draft.synced
                      ? "bg-green-400"
                      : draft.syncError
                      ? "bg-red-400"
                      : "bg-amber-400",
                  )}
                />

                <div className="p-4 space-y-3">
                  {/* Owner + type */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-800 text-base leading-tight">
                        {draft.ownerName}
                      </p>
                      <p className="text-xs text-slate-500 capitalize mt-0.5">
                        {draft.propertyType}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap",
                        draft.synced
                          ? "bg-green-100 text-green-700"
                          : draft.syncError
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700",
                      )}
                    >
                      {draft.synced ? "Synced" : draft.syncError ? "Sync Failed" : "Pending"}
                    </span>
                  </div>

                  {/* Location info */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-slate-600">
                    <div>
                      <span className="text-xs text-slate-400">Kebele</span>
                      <p className="font-medium">{draft.kebeleName || draft.kebele || "—"}</p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400">Street</span>
                      <p className="font-medium">{draft.streetName || "—"}</p>
                    </div>
                    {draft.houseNumber && (
                      <div>
                        <span className="text-xs text-slate-400">House No.</span>
                        <p className="font-medium">{draft.houseNumber}</p>
                      </div>
                    )}
                    {draft.blockCode && (
                      <div>
                        <span className="text-xs text-slate-400">Block</span>
                        <p className="font-medium">{draft.blockCode}</p>
                      </div>
                    )}
                  </div>

                  {/* GPS + photo badges */}
                  <div className="flex gap-2 flex-wrap">
                    <span
                      className={cn(
                        "flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium",
                        draft.latitude != null
                          ? "bg-green-50 text-green-700"
                          : "bg-slate-100 text-slate-500",
                      )}
                    >
                      <MapPin className="w-3 h-3" />
                      {draft.latitude != null ? "GPS ✓" : "No GPS"}
                    </span>
                    <span
                      className={cn(
                        "flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium",
                        draft.photoDataUrl
                          ? "bg-green-50 text-green-700"
                          : "bg-slate-100 text-slate-500",
                      )}
                    >
                      <Camera className="w-3 h-3" />
                      {draft.photoDataUrl ? "Photo ✓" : "No Photo"}
                    </span>
                    <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                      <Clock className="w-3 h-3" />
                      {format(parseISO(draft.updatedAt), "dd MMM, HH:mm")}
                    </span>
                  </div>

                  {/* Sync error */}
                  {draft.syncError && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm text-red-700">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-xs mb-0.5">Sync Failed</p>
                        <p className="text-xs">{humanError(draft.syncError)}</p>
                      </div>
                    </div>
                  )}

                  {/* Synced reference */}
                  {draft.synced && draft.serverId && (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-sm text-green-700">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-medium">
                        Saved to server — Property #{draft.serverId}
                        {draft.syncedAt && (
                          <span className="ml-1 text-green-600 font-normal">
                            · {format(parseISO(draft.syncedAt), "dd MMM, HH:mm")}
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  {!draft.synced && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setLocation(`/mobile/field-collection?draft=${draft.localId}`)}
                        className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold active:bg-slate-50"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>

                      <button
                        onClick={() => handleSync(draft.localId)}
                        disabled={!isOnline || syncing}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl text-sm font-semibold text-white transition-all",
                          isOnline ? "bg-blue-600 active:bg-blue-700" : "bg-slate-300 cursor-not-allowed",
                          syncing && "opacity-70",
                        )}
                      >
                        {syncing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        {syncing ? "Syncing…" : "Sync"}
                      </button>

                      {confirmDelete === draft.localId ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDelete(draft.localId)}
                            className="flex items-center justify-center h-11 px-3 rounded-xl bg-red-600 text-white text-sm font-semibold"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="flex items-center justify-center h-11 px-3 rounded-xl border-2 border-slate-200 text-slate-600 text-sm font-semibold"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(draft.localId)}
                          className="flex items-center justify-center h-11 w-11 rounded-xl border-2 border-red-100 text-red-500 active:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Synced: view on server */}
                  {draft.synced && draft.serverId && (
                    <a
                      href={`${import.meta.env.BASE_URL}properties/${draft.serverId}`}
                      className="flex items-center justify-between h-11 px-4 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700 font-semibold"
                    >
                      View on server
                      <ChevronRight className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-24 left-4 right-4 max-w-md mx-auto z-50 rounded-xl px-4 py-3 text-white text-sm font-medium shadow-xl",
            toast.type === "success" ? "bg-green-600" : "bg-red-600",
          )}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
