import { useState, useRef, useCallback } from "react";
import { useOfflineDB, type OfflineDraft } from "./use-offline-db";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Helpers ───────────────────────────────────────────────────────────────────

async function dataUrlToFile(dataUrl: string, fileName: string, mime: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], fileName, { type: mime });
}

/**
 * Core sync logic. Accepts an `onServerCreated` callback that is invoked
 * immediately after the server-side property record is created (before photo
 * upload / submission). This lets the caller persist the serverId so that if
 * the subsequent steps fail, a retry will skip re-creation and avoid creating
 * a duplicate record on the server.
 */
async function doSync(
  draft: OfflineDraft,
  token: string | null,
  onServerCreated: (serverId: number) => Promise<void>,
): Promise<number> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // ── Step 1: Create property (skip if already created in a previous attempt)
  let propertyId = draft.serverId;

  if (!propertyId) {
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

    const createRes = await fetch(`${BASE}/api/properties`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!createRes.ok) {
      const err = (await createRes.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? `Server error ${createRes.status}`);
    }

    const property = (await createRes.json()) as { id: number };
    propertyId = property.id;

    // Persist serverId immediately — if the next steps fail, retry will not
    // call POST /api/properties again and will not create a duplicate record.
    await onServerCreated(propertyId);
  }

  // ── Step 2: Upload front-view photo (if present)
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
      if (!photoRes.ok) {
        const err = (await photoRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Photo upload failed");
      }
    } catch (err) {
      // Re-throw photo errors so the draft is marked with the failure reason
      throw err;
    }
  }

  // ── Step 3: Submit for review (requires GPS + photo)
  if (draft.latitude != null && draft.longitude != null && hasPhoto) {
    const subRes = await fetch(`${BASE}/api/properties/${propertyId}/submit`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    if (!subRes.ok) {
      const err = (await subRes.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? "Property saved but could not be submitted for review");
    }
  }

  return propertyId;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSync() {
  const { unsyncedDrafts, markSynced, markSyncError, savePartialServerId, refresh } =
    useOfflineDB();

  // Use a Ref for in-flight tracking so the check is synchronous and immune to
  // React's batched state updates — prevents double-sync from rapid taps.
  const inFlight = useRef(new Set<string>());

  const [syncingIds, setSyncingIds] = useState<Record<string, boolean>>({});
  const [syncingAll, setSyncingAll] = useState(false);

  const syncOne = useCallback(
    async (draft: OfflineDraft, token: string | null) => {
      // Guard: already in-flight (ref check is synchronous) or already synced
      if (inFlight.current.has(draft.localId) || draft.synced) return;

      inFlight.current.add(draft.localId);
      setSyncingIds((s) => ({ ...s, [draft.localId]: true }));

      try {
        const serverId = await doSync(draft, token, (partialId) =>
          savePartialServerId(draft.localId, partialId),
        );
        await markSynced(draft.localId, serverId);
      } catch (err) {
        await markSyncError(
          draft.localId,
          err instanceof Error ? err.message : "Unknown sync error",
        );
      } finally {
        inFlight.current.delete(draft.localId);
        setSyncingIds((s) => {
          const next = { ...s };
          delete next[draft.localId];
          return next;
        });
      }
    },
    // syncOne only depends on stable IDB callbacks — NOT on `syncingIds` state,
    // which would cause syncAll to use stale closures during sequential iteration.
    [markSynced, markSyncError, savePartialServerId],
  );

  const syncAll = useCallback(
    async (token: string | null) => {
      if (syncingAll) return;
      // Snapshot the unsynced list at the moment sync-all is triggered
      const toSync = [...unsyncedDrafts];
      if (toSync.length === 0) return;
      setSyncingAll(true);
      for (const draft of toSync) {
        await syncOne(draft, token);
      }
      await refresh();
      setSyncingAll(false);
    },
    [syncingAll, unsyncedDrafts, syncOne, refresh],
  );

  const isSyncing = useCallback(
    (localId: string) => inFlight.current.has(localId) || !!syncingIds[localId],
    [syncingIds],
  );

  return {
    syncOne,
    syncAll,
    isSyncing,
    syncingAll,
    pendingCount: unsyncedDrafts.length,
  };
}
