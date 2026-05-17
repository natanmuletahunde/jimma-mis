import { useOfflineDB } from "@/hooks/use-offline-db";
import { CheckCircle2, ChevronRight, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function SyncedRecords() {
  const { syncedDrafts, loading } = useOfflineDB();

  return (
    <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Synced Records</h1>
        <p className="text-sm text-slate-500">{syncedDrafts.length} records uploaded to the server</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">Loading…</div>
      ) : syncedDrafts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
          <CheckCircle2 className="w-10 h-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">No synced records yet</p>
          <p className="text-xs text-center">Properties you sync from Offline Drafts appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {syncedDrafts.map((d) => (
            <div key={d.localId} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-slate-800">{d.ownerName}</p>
                  <p className="text-xs text-slate-500 capitalize">{d.propertyType}</p>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">
                  Synced
                </span>
              </div>
              <div className="text-sm text-slate-600">
                <span>{d.kebeleName || d.kebele}</span>
                {d.streetName && <span> · {d.streetName}</span>}
                {d.houseNumber && <span> · HN {d.houseNumber}</span>}
              </div>
              {d.syncedAt && (
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="w-3 h-3" />
                  Synced {format(parseISO(d.syncedAt), "dd MMM yyyy, HH:mm")}
                </div>
              )}
              {d.serverId && (
                <a
                  href={`${import.meta.env.BASE_URL}properties/${d.serverId}`}
                  className="flex items-center justify-between h-10 px-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700 font-semibold mt-1"
                >
                  View property #{d.serverId}
                  <ChevronRight className="w-4 h-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
