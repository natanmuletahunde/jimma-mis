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
  /** Set as soon as the server-side property record is created, even if
   *  photo upload or submission then fails.  Lets us skip re-creation on retry. */
  serverId?: number;
}

// ── Low-level IDB helpers ─────────────────────────────────────────────────────

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

// ── Safe two-transaction read-then-write helpers ──────────────────────────────
// Safari and some older browsers auto-commit IDB transactions when the JS
// engine yields (e.g. between two `await` calls on the same transaction).
// Using separate transactions for read and write avoids TransactionInactiveError.

async function readOne(localId: string): Promise<OfflineDraft | undefined> {
  const db = await openDB();
  const tx = db.transaction(STORE, "readonly");
  const result = await idbGet(tx.objectStore(STORE), localId);
  db.close();
  return result;
}

async function writeOne(record: OfflineDraft): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  await idbPut(tx.objectStore(STORE), record);
  db.close();
}

async function removeOne(localId: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  await idbDelete(tx.objectStore(STORE), localId);
  db.close();
}

// ── Public type ───────────────────────────────────────────────────────────────

export type DraftInput = Omit<
  OfflineDraft,
  "status" | "createdAt" | "updatedAt" | "synced" | "localId"
> & { localId?: string };

// ── Hook ──────────────────────────────────────────────────────────────────────

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

  // ── saveDraft ──
  // Uses two separate transactions (read then write) for Safari safety.
  const saveDraft = useCallback(
    async (input: DraftInput): Promise<OfflineDraft> => {
      const now = new Date().toISOString();
      const localId = input.localId ?? crypto.randomUUID();

      // Read existing record (readonly tx) to preserve createdAt
      const existing = input.localId ? await readOne(input.localId) : undefined;

      const record: OfflineDraft = {
        ...input,
        localId,
        status: "offline_draft",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        synced: false,
        syncError: undefined,
        syncedAt: undefined,
        // Preserve serverId if the property was already created on server
        // (partial sync: creation succeeded but submission failed).
        serverId: existing?.serverId,
      };

      // Write in a fresh readwrite tx
      await writeOne(record);
      await refresh();
      return record;
    },
    [refresh],
  );

  // ── updateDraft ──
  // Merges partial changes. Uses two separate transactions for Safari safety.
  const updateDraft = useCallback(
    async (localId: string, changes: Partial<OfflineDraft>): Promise<void> => {
      const existing = await readOne(localId);
      if (!existing) return;
      await writeOne({ ...existing, ...changes, updatedAt: new Date().toISOString() });
      await refresh();
    },
    [refresh],
  );

  const deleteDraft = useCallback(async (localId: string): Promise<void> => {
    await removeOne(localId);
    await refresh();
  }, [refresh]);

  const getDraft = useCallback(
    async (localId: string): Promise<OfflineDraft | undefined> => readOne(localId),
    [],
  );

  // ── Sync state helpers ──

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

  /** Called immediately after the server-side property record is created,
   *  before photo upload / submission.  Persists the serverId so that if the
   *  next steps fail and the user retries, we skip re-creation and avoid
   *  duplicate server records. */
  const savePartialServerId = useCallback(
    async (localId: string, serverId: number): Promise<void> => {
      await updateDraft(localId, { serverId });
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
    savePartialServerId,
  };
}
