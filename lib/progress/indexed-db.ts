import type {
  ProgressState,
  ProgressStore,
  Supply,
} from '../curriculum/types.js';
import { validateState } from './validation.js';
import { profileDatabaseName } from './profile-storage.js';
export class RevisionConflict extends Error {
  constructor() {
    super(
      'REVISION_CONFLICT: данные изменились в другой вкладке; перечитайте сохранение',
    );
    this.name = 'RevisionConflict';
  }
}
export class IndexedDbProgressStore implements ProgressStore {
  private connection: Promise<IDBDatabase> | undefined;
  constructor(
    private supply: Supply,
    private factory: IDBFactory = indexedDB,
    private name = profileDatabaseName(),
  ) {}
  private open(): Promise<IDBDatabase> {
    if (!this.connection)
      this.connection = new Promise<IDBDatabase>((resolve, reject) => {
        const request = this.factory.open(this.name, 1);
        let blocked = false;
        request.onupgradeneeded = () => {
          request.result.createObjectStore('state');
          request.result.createObjectStore('backups');
        };
        request.onerror = () =>
          reject(request.error ?? new Error('STORAGE_OPEN_FAILED'));
        request.onblocked = () => {
          blocked = true;
          reject(new Error('STORAGE_BLOCKED: закройте старую вкладку'));
        };
        request.onsuccess = () => {
          const db = request.result;
          if (blocked) {
            db.close();
            return;
          }
          db.onversionchange = () => {
            db.close();
            this.connection = undefined;
          };
          resolve(db);
        };
      }).catch((error) => {
        this.connection = undefined;
        throw error;
      });
    return this.connection;
  }
  async read(): Promise<ProgressState | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('state', 'readonly');
      const req = tx.objectStore('state').get('local');
      let result: ProgressState | null = null;
      req.onsuccess = () => {
        try {
          if (req.result !== undefined) {
            validateState(req.result, this.supply);
            result = req.result;
          }
        } catch (error) {
          reject(error);
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () =>
        reject(tx.error ?? new Error('STORAGE_READ_FAILED'));
    });
  }
  async commit(
    next: ProgressState,
    expectedRevision: number | null,
    backupPrevious = false,
  ): Promise<ProgressState> {
    const candidate = structuredClone(next);
    validateState(candidate, this.supply);
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['state', 'backups'], 'readwrite');
      const store = tx.objectStore('state'),
        req = store.get('local');
      let saved: ProgressState;
      let reason: unknown;
      req.onsuccess = () => {
        try {
          const old: ProgressState | undefined = req.result;
          if ((old?.storageRevision ?? null) !== expectedRevision)
            throw new RevisionConflict();
          if (old) validateState(old, this.supply);
          saved = {
            ...candidate,
            storageRevision: (old?.storageRevision ?? -1) + 1,
          };
          validateState(saved, this.supply);
          if (backupPrevious && old)
            tx.objectStore('backups').add(old, old.storageRevision);
          store.put(saved, 'local');
        } catch (error) {
          reason = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(structuredClone(saved));
      tx.onabort = tx.onerror = () =>
        reject(reason ?? tx.error ?? new Error('STORAGE_COMMIT_FAILED'));
    });
  }
  async readBackup(revision: number): Promise<ProgressState | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('backups', 'readonly'),
        req = tx.objectStore('backups').get(revision);
      tx.oncomplete = () => {
        try {
          if (req.result === undefined) resolve(null);
          else {
            validateState(req.result, this.supply);
            resolve(req.result);
          }
        } catch (error) {
          reject(error);
        }
      };
      tx.onabort = tx.onerror = () =>
        reject(tx.error ?? new Error('STORAGE_READ_FAILED'));
    });
  }
  async close() {
    if (this.connection) (await this.connection).close();
    this.connection = undefined;
  }
}
