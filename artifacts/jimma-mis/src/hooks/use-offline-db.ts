import { useState, useEffect, useCallback } from "react";

const DB_NAME = "jimma-mis-offline";
const DB_VERSION = 1;
const STORE = "offline_drafts";

export interface OfflineDraft {
  localId: string;
  kebele: string;
  kebeleId?: number;
  kebeleName?: string;
  streetName: string;
  streetId?: number;
  blockCode?: string;
  houseNumber?: string;
  buildingName?: string;
  ownerName: string;
  ownerPhone?: string;
  propertyType: "residential" | "commercial" | "government" | "institution" | "mixed";
  latitude?: number;
  longitude?: number;
  photoDataUrl?: string;
  photoFileName?: string;
  photoMime?: string;
  remark?: string;
  status: "offline_draft";
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  syncedAt?: string;
  syncError?: string;
  serverId?: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "localId" });
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
}

function idbGet(store: IDBObjectStore, key: string): Promise<OfflineDraft | undefined> {
  return new Promise((res, rej) => {
    const r = store.get(key);
    r.onsuccess = () => res(r.result as OfflineDraft | undefined);
    r.onerror = () => rej(r.error);
  });
}

function idbGetAll(store: IDBObjectStore): Promise<OfflineDraft[]> {
  return new Promise((res, rej) => {
    const r = store.getAll();
    r.onsuccess = () => res(r.result as OfflineDraft[]);
    r.onerror = () => rej(r.error);
  });
}

function idbPut(store: IDBObjectStore, val: OfflineDraft): Promise<void> {
  return new Promise((res, rej) => {
    const r = store.put(val);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}

function idbDelete(store: IDBObjectStore, key: string): Promise<void> {
  return new Promise((res, rej) => {
    const r = store.delete(key);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}

export type DraftInput = Omit<OfflineDraft, "status" | "createdAt" | "updatedAt" | "synced" | "localId"> & {
  localId?: string;
};

export function useOfflineDB() {
  const [drafts, setDrafts] = useState<OfflineDraft[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE, "readonly");
      const all = await idbGetAll(tx.objectStore(STORE));
      db.close();
      setDrafts(all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    } catch {
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveDraft = useCallback(
    async (input: DraftInput): Promise<OfflineDraft> => {
      const db = await openDB();
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const now = new Date().toISOString();
      const localId = input.localId ?? crypto.randomUUID();
      const existing = input.localId ? await idbGet(store, input.localId) : undefined;
      const record: OfflineDraft = {
        ...input,
        localId,
        status: "offline_draft",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        synced: false,
        syncError: undefined,
        syncedAt: undefined,
      };
      await idbPut(store, record);
      db.close();
      await refresh();
      return record;
    },
    [refresh],
  );

  const updateDraft = useCallback(
    async (localId: string, changes: Partial<OfflineDraft>): Promise<void> => {
      const db = await openDB();
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const existing = await idbGet(store, localId);
      if (!existing) { db.close(); return; }
      await idbPut(store, { ...existing, ...changes, updatedAt: new Date().toISOString() });
      db.close();
      await refresh();
    },
    [refresh],
  );

  const deleteDraft = useCallback(
    async (localId: string): Promise<void> => {
      const db = await openDB();
      const tx = db.transaction(STORE, "readwrite");
      await idbDelete(tx.objectStore(STORE), localId);
      db.close();
      await refresh();
    },
    [refresh],
  );

  const getDraft = useCallback(async (localId: string): Promise<OfflineDraft | undefined> => {
    const db = await openDB();
    const tx = db.transaction(STORE, "readonly");
    const draft = await idbGet(tx.objectStore(STORE), localId);
    db.close();
    return draft;
  }, []);

  const markSynced = useCallback(
    async (localId: string, serverId: number): Promise<void> => {
      await updateDraft(localId, {
        synced: true,
        syncedAt: new Date().toISOString(),
        serverId,
        syncError: undefined,
      });
    },
    [updateDraft],
  );

  const markSyncError = useCallback(
    async (localId: string, error: string): Promise<void> => {
      await updateDraft(localId, { syncError: error });
    },
    [updateDraft],
  );

  const unsyncedDrafts = drafts.filter((d) => !d.synced);
  const syncedDrafts = drafts.filter((d) => d.synced);

  return {
    drafts,
    unsyncedDrafts,
    syncedDrafts,
    loading,
    refresh,
    saveDraft,
    updateDraft,
    deleteDraft,
    getDraft,
    markSynced,
    markSyncError,
  };
}
