import type { MetafileData } from "./types";

class MetafileStorage {
  private dbName = "esbuild-analyser";
  private dbVersion = 1;
  private storeName = "metafile";
  private keyName = "current";

  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  async storeMetafile(data: string, name?: string): Promise<void> {
    try {
      const db = await this.openDatabase();
      const tx = db.transaction([this.storeName], "readwrite");
      const store = tx.objectStore(this.storeName);
      const metafileData: MetafileData = { data, name };
      await store.put(metafileData, this.keyName);
      tx.commit();
      db.close();
    } catch (err) {
      console.error("Failed to store metafile:", err);
      throw err;
    }
  }

  async loadMetafile(): Promise<{ data: string; name?: string } | null> {
    try {
      const db = await this.openDatabase();
      const tx = db.transaction([this.storeName], "readonly");
      const store = tx.objectStore(this.storeName);
      const request = store.get(this.keyName);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          db.close();
          resolve(request.result || null);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error("Failed to load metafile:", err);
      return null;
    }
  }

  async clearMetafile(): Promise<void> {
    try {
      const db = await this.openDatabase();
      const tx = db.transaction([this.storeName], "readwrite");
      const store = tx.objectStore(this.storeName);
      await store.clear();
      tx.commit();
      db.close();
    } catch (err) {
      console.error("Failed to clear metafile:", err);
    }
  }

  async hasMetafile(): Promise<boolean> {
    const data = await this.loadMetafile();
    return data !== null;
  }
}

export const metafileStorage = new MetafileStorage();
