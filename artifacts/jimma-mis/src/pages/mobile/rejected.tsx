import {
  useListProperties,
  getListPropertiesQueryKey,
} from "@workspace/api-client-react";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { XCircle, WifiOff, ChevronRight, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";

type PropertyItem = {
  id: number;
  ownerName?: string;
  propertyType?: string;
  kebele?: string;
  streetName?: string;
  houseNumber?: string;
  updatedAt?: string;
  rejectionReason?: string | null;
};

export default function RejectedRecords() {
  const { isOnline } = useNetworkStatus();
  const params = { status: "rejected" as const, limit: 50, page: 1 };
  const { data, isLoading } = useListProperties(params, {
    query: {
      queryKey: getListPropertiesQueryKey(params),
      enabled: isOnline,
    },
  });

  const records = ((data as unknown as { properties?: PropertyItem[] })?.properties ?? []);

  return (
    <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Rejected for Correction</h1>
        <p className="text-sm text-slate-500">Properties that need to be fixed and resubmitted</p>
      </div>

      {!isOnline && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-amber-800">
          <WifiOff className="w-4 h-4 shrink-0" />
          You are offline. Rejected records require a connection to load.
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">Loading…</div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
          <XCircle className="w-10 h-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">No rejected records</p>
          <p className="text-xs text-center">Records rejected by officers appear here for correction.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
              <div className="h-1 bg-red-400" />
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-slate-800">{r.ownerName ?? "Unknown owner"}</p>
                    <p className="text-xs text-slate-500 capitalize">{r.propertyType}</p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700">
                    Rejected
                  </span>
                </div>

                <div className="text-sm text-slate-600">
                  <span>{r.kebele}</span>
                  {r.streetName && <span> · {r.streetName}</span>}
                  {r.houseNumber && <span> · HN {r.houseNumber}</span>}
                </div>

                {r.rejectionReason && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">
                    <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {r.rejectionReason}
                  </div>
                )}

                {r.updatedAt && (
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    {format(parseISO(r.updatedAt), "dd MMM yyyy")}
                  </div>
                )}

                <a
                  href={`${import.meta.env.BASE_URL}properties/${r.id}`}
                  className="flex items-center justify-between h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold mt-1"
                >
                  View &amp; Edit Property #{r.id}
                  <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
