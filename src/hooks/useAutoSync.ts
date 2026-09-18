/**
 * useAutoSync — keeps the CRM in lock-step with the user's Excel workbook by
 * persisting a File System Access API handle (in IndexedDB) and re-reading it
 * on every dashboard mount. The server already short-circuits on a SHA256
 * match, so re-syncing an unchanged file is essentially free (~250ms).
 *
 * Browser support: Chrome, Edge, Opera, Brave. Safari/Firefox fall back to
 * the manual file picker (the existing button still works there).
 */
import { useCallback, useEffect, useRef, useState } from "react";

const DB_NAME = "videa-master-autosync";
const STORE = "handles";
const KEY = "dashboard-workbook";

type AnyFileHandle = FileSystemFileHandle & {
  queryPermission?: (opts: { mode: "read" }) => Promise<PermissionState>;
  requestPermission?: (opts: { mode: "read" }) => Promise<PermissionState>;
};

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openIdb();
  return new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openIdb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDel(key: string): Promise<void> {
  const db = await openIdb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function isFsAccessSupported(): boolean {
  return typeof window !== "undefined" && "showOpenFilePicker" in window;
}

export interface AutoSyncStatus {
  enabled: boolean;
  fileName: string | null;
  lastError: string | null;
  syncing: boolean;
}

export interface UseAutoSyncOptions {
  /** Called with the file bytes whenever the file is read. */
  onFile: (file: File) => Promise<void>;
}

export function useAutoSync({ onFile }: UseAutoSyncOptions) {
  const [status, setStatus] = useState<AutoSyncStatus>({
    enabled: false,
    fileName: null,
    lastError: null,
    syncing: false,
  });
  const onFileRef = useRef(onFile);
  onFileRef.current = onFile;

  const readAndSync = useCallback(async (handle: AnyFileHandle, opts?: { silent?: boolean }) => {
    setStatus((s) => ({ ...s, syncing: true, lastError: null }));
    try {
      let perm: PermissionState = "granted";
      if (handle.queryPermission) {
        perm = await handle.queryPermission({ mode: "read" });
      }
      if (perm !== "granted") {
        if (opts?.silent) {
          // Silent path on page load — don't pop a permission prompt.
          setStatus((s) => ({ ...s, syncing: false }));
          return;
        }
        if (handle.requestPermission) {
          perm = await handle.requestPermission({ mode: "read" });
        }
        if (perm !== "granted") {
          throw new Error("Permission to read the workbook was denied");
        }
      }
      const file = await handle.getFile();
      await onFileRef.current(file);
      setStatus({ enabled: true, fileName: file.name, lastError: null, syncing: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus((s) => ({ ...s, syncing: false, lastError: msg }));
    }
  }, []);

  // Restore handle on mount + auto-sync silently.
  useEffect(() => {
    let cancelled = false;
    if (!isFsAccessSupported()) return;
    (async () => {
      try {
        const handle = await idbGet<AnyFileHandle>(KEY);
        if (cancelled || !handle) return;
        setStatus((s) => ({ ...s, enabled: true, fileName: handle.name }));
        await readAndSync(handle, { silent: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setStatus((s) => ({ ...s, lastError: msg }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [readAndSync]);

  /** Pick a workbook and persist its handle for future auto-syncs. */
  const enableAutoSync = useCallback(async () => {
    if (!isFsAccessSupported()) {
      throw new Error(
        "This browser doesn't support persistent file access. Use Chrome, Edge or Brave for auto-sync."
      );
    }
    // @ts-expect-error - showOpenFilePicker is not in older lib.dom typings
    const [handle] = (await window.showOpenFilePicker({
      types: [
        {
          description: "Excel workbook",
          accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx", ".xls"] },
        },
      ],
      multiple: false,
      excludeAcceptAllOption: false,
    })) as AnyFileHandle[];
    if (!handle) return;
    await idbSet(KEY, handle);
    await readAndSync(handle, { silent: false });
  }, [readAndSync]);

  /** Forget the saved handle so the dashboard stops auto-syncing. */
  const disableAutoSync = useCallback(async () => {
    try {
      await idbDel(KEY);
    } catch {
      // ignore
    }
    setStatus({ enabled: false, fileName: null, lastError: null, syncing: false });
  }, []);

  /** Force a re-read of the saved handle (used by the manual Refresh button). */
  const refreshNow = useCallback(async () => {
    if (!isFsAccessSupported()) return;
    const handle = await idbGet<AnyFileHandle>(KEY);
    if (!handle) return;
    await readAndSync(handle, { silent: false });
  }, [readAndSync]);

  return { status, enableAutoSync, disableAutoSync, refreshNow };
}
