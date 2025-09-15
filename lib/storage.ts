import type { MetafileData } from "./types";

class MetafileStorage {
  private dbName = "esbuild-analyser";
  private dbVersion = 2; // Increment version for schema changes
  private storeName = "bundles";
  private currentBundleKey = "current-bundle-id";

  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create bundles store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }

        // Create current bundle ID store if it doesn't exist
        if (!db.objectStoreNames.contains("metadata")) {
          db.createObjectStore("metadata");
        }
      };
    });
  }

  async storeMetafile(data: string, name?: string): Promise<string> {
    try {
      const db = await this.openDatabase();
      const tx = db.transaction([this.storeName, "metadata"], "readwrite");

      // Generate unique ID for the bundle
      const bundleId = `bundle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const bundleStore = tx.objectStore(this.storeName);
      // Ensure name uniqueness by appending (n) if needed
      const allExisting: MetafileData[] = await new Promise(
        (resolve, reject) => {
          const req = bundleStore.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        }
      );

      const baseName = (name || "stats.json").trim();
      let finalName = baseName;
      if (
        allExisting.some(
          (b) => (b.name || "").toLowerCase() === baseName.toLowerCase()
        )
      ) {
        const pattern = new RegExp(
          `^${baseName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\s*\\((\\d+)\\)$`,
          "i"
        );
        let maxN = 1;
        for (const b of allExisting) {
          const n = (b.name || "").match(pattern)?.[1];
          if (n) maxN = Math.max(maxN, parseInt(n, 10) + 1);
        }
        // If we didn't find existing (n) pattern, start with (1)
        if (maxN === 1) {
          finalName = `${baseName} (1)`;
        } else {
          finalName = `${baseName} (${maxN})`;
        }
      }

      const metafileData: MetafileData = {
        data,
        name: finalName,
        id: bundleId,
        createdAt: Date.now(),
      };

      // Store the bundle
      await bundleStore.put(metafileData, bundleId);

      // Set this as the current bundle
      const metadataStore = tx.objectStore("metadata");
      await metadataStore.put(bundleId, this.currentBundleKey);

      tx.commit();
      db.close();

      return bundleId;
    } catch (err) {
      console.error("Failed to store metafile:", err);
      throw err;
    }
  }

  async loadMetafile(): Promise<MetafileData | null> {
    try {
      const db = await this.openDatabase();
      const tx = db.transaction(["metadata", this.storeName], "readonly");

      // First get the current bundle ID
      const metadataStore = tx.objectStore("metadata");
      const currentBundleId = await new Promise<string | null>(
        (resolve, reject) => {
          const request = metadataStore.get(this.currentBundleKey);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
        }
      );

      if (!currentBundleId) {
        db.close();
        return null;
      }

      // Then load the bundle data
      const bundleStore = tx.objectStore(this.storeName);
      const bundleData = await new Promise<MetafileData | null>(
        (resolve, reject) => {
          const request = bundleStore.get(currentBundleId);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
        }
      );

      db.close();
      return bundleData;
    } catch (err) {
      console.error("Failed to load metafile:", err);
      return null;
    }
  }

  async loadMetafileById(bundleId: string): Promise<MetafileData | null> {
    try {
      const db = await this.openDatabase();
      const tx = db.transaction([this.storeName], "readonly");
      const store = tx.objectStore(this.storeName);
      const request = store.get(bundleId);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          db.close();
          resolve(request.result || null);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error("Failed to load metafile by ID:", err);
      return null;
    }
  }

  async setCurrentBundle(bundleId: string): Promise<void> {
    try {
      const db = await this.openDatabase();
      const tx = db.transaction(["metadata"], "readwrite");
      const store = tx.objectStore("metadata");
      await store.put(bundleId, this.currentBundleKey);
      tx.commit();
      db.close();
    } catch (err) {
      console.error("Failed to set current bundle:", err);
      throw err;
    }
  }

  async getAllBundles(): Promise<MetafileData[]> {
    try {
      const db = await this.openDatabase();
      const tx = db.transaction([this.storeName], "readonly");
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          db.close();
          // Sort by creation date, oldest first so new tabs append at the end
          const bundles = request.result || [];
          bundles.sort(
            (a: MetafileData, b: MetafileData) => a.createdAt - b.createdAt
          );
          resolve(bundles);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error("Failed to get all bundles:", err);
      return [];
    }
  }

  async deleteBundle(bundleId: string): Promise<void> {
    try {
      const db = await this.openDatabase();
      const tx = db.transaction([this.storeName, "metadata"], "readwrite");
      const store = tx.objectStore(this.storeName);

      // Delete the bundle
      await store.delete(bundleId);

      // If this was the current bundle, clear it
      const metadataStore = tx.objectStore("metadata");
      const currentId = await new Promise<string | null>((resolve, reject) => {
        const request = metadataStore.get(this.currentBundleKey);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });

      if (currentId === bundleId) {
        await metadataStore.delete(this.currentBundleKey);
      }

      tx.commit();
      db.close();
    } catch (err) {
      console.error("Failed to delete bundle:", err);
      throw err;
    }
  }

  async clearMetafile(): Promise<void> {
    try {
      const db = await this.openDatabase();
      const tx = db.transaction([this.storeName, "metadata"], "readwrite");
      const store = tx.objectStore(this.storeName);
      const metadataStore = tx.objectStore("metadata");
      await store.clear();
      await metadataStore.delete(this.currentBundleKey);
      tx.commit();
      db.close();
    } catch (err) {
      console.error("Failed to clear metafile:", err);
      throw err;
    }
  }

  async hasMetafile(): Promise<boolean> {
    const data = await this.loadMetafile();
    return data !== null;
  }

  async getCurrentBundleId(): Promise<string | null> {
    try {
      const db = await this.openDatabase();
      const tx = db.transaction(["metadata"], "readonly");
      const store = tx.objectStore("metadata");
      const request = store.get(this.currentBundleKey);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          db.close();
          resolve(request.result || null);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error("Failed to get current bundle ID:", err);
      return null;
    }
  }
}

export const metafileStorage = new MetafileStorage();
