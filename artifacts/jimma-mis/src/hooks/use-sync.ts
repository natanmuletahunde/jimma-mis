import { useState, useCallback } from "react";
import { useOfflineDB, type OfflineDraft } from "./use-offline-db";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function dataUrlToFile(dataUrl: string, fileName: string, mime: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], fileName, { type: mime });
}

async function doSync(draft: OfflineDraft, token: string | null): Promise<number> {
  const payload: Record<string, unknown> = {
    kebele: draft.kebele,
    streetName: draft.streetName,
    ownerName: draft.ownerName,
    propertyType: draft.propertyType,
  };
  if (draft.blockCode) payload.blockCode = draft.blockCode;
  if (draft.houseNumber) payload.houseNumber = draft.houseNumber;
  if (draft.buildingName) payload.buildingName = draft.buildingName;
  if (draft.ownerPhone) payload.ownerPhone = draft.ownerPhone;
  if (draft.latitude != null) payload.latitude = draft.latitude;
  if (draft.longitude != null) payload.longitude = draft.longitude;
  if (draft.remark) payload.remark = draft.remark;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const createRes = await fetch(`${BASE}/api/properties`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Server error ${createRes.status}`);
  }

  const property = (await createRes.json()) as { id: number };
  const propertyId = property.id;
  let hasPhoto = false;

  if (draft.photoDataUrl) {
    try {
      const file = await dataUrlToFile(
        draft.photoDataUrl,
        draft.photoFileName ?? "photo.jpg",
        draft.photoMime ?? "image/jpeg",
      );
      const fd = new FormData();
      fd.append("photo", file);
      fd.append("category", "front_view");
      const photoRes = await fetch(`${BASE}/api/properties/${propertyId}/photos`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      hasPhoto = photoRes.ok;
    } catch {
      // Photo failed — property still created; submit will fail validation
    }
  }

  if (draft.latitude != null && draft.longitude != null && hasPhoto) {
    const subRes = await fetch(`${BASE}/api/properties/${propertyId}/submit`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    if (!subRes.ok) {
      const err = await subRes.json().catch(() => ({})) as { error?: string };
      throw new Error(err.error ?? "Property saved but could not be submitted for review");
    }
  }

  return propertyId;
}

export function useSync() {
  const { unsyncedDrafts, markSynced, markSyncError, refresh } = useOfflineDB();
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [syncingAll, setSyncingAll] = useState(false);

  const syncOne = useCallback(
    async (draft: OfflineDraft, token: string | null) => {
      if (syncing[draft.localId] || draft.synced) return;
      setSyncing((s) => ({ ...s, [draft.localId]: true }));
      try {
        const serverId = await doSync(draft, token);
        await markSynced(draft.localId, serverId);
      } catch (err) {
        await markSyncError(
          draft.localId,
          err instanceof Error ? err.message : "Unknown error",
        );
      } finally {
        setSyncing((s) => {
          const n = { ...s };
          delete n[draft.localId];
          return n;
        });
      }
    },
    [syncing, markSynced, markSyncError],
  );

  const syncAll = useCallback(
    async (token: string | null) => {
      if (syncingAll || unsyncedDrafts.length === 0) return;
      setSyncingAll(true);
      for (const draft of unsyncedDrafts) {
        await syncOne(draft, token);
      }
      await refresh();
      setSyncingAll(false);
    },
    [syncingAll, unsyncedDrafts, syncOne, refresh],
  );

  const isSyncing = (localId: string) => !!syncing[localId];

  return { syncOne, syncAll, isSyncing, syncingAll, pendingCount: unsyncedDrafts.length };
}
