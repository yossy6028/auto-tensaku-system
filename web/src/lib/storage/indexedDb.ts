/**
 * IndexedDB操作の基盤ユーティリティ
 * SSR対応、エラーハンドリング、バージョン管理を含む
 */

const DB_NAME = 'auto-tensaku-db';
const DB_VERSION = 1;
const STORE_SAVED_PROBLEMS = 'saved-problems';

let dbInstance: IDBDatabase | null = null;

/**
 * IndexedDBが利用可能かチェック
 */
export function isIndexedDBAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return 'indexedDB' in window && window.indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * データベースを開く（シングルトン）
 */
export async function openDatabase(): Promise<IDBDatabase> {
  if (!isIndexedDBAvailable()) {
    throw new Error('IndexedDBはこのブラウザでは利用できません');
  }

  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`データベースを開けませんでした: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      dbInstance = request.result;

      // 接続が閉じられた場合のクリーンアップ
      dbInstance.onclose = () => {
        dbInstance = null;
      };

      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // saved-problemsストアの作成
      if (!db.objectStoreNames.contains(STORE_SAVED_PROBLEMS)) {
        const store = db.createObjectStore(STORE_SAVED_PROBLEMS, { keyPath: 'id' });
        store.createIndex('title', 'title', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });
}

/**
 * トランザクションを取得
 */
async function getTransaction(
  storeName: string,
  mode: IDBTransactionMode
): Promise<IDBObjectStore> {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

/**
 * 全レコードを取得
 */
export async function getAll<T>(storeName: string): Promise<T[]> {
  const store = await getTransaction(storeName, 'readonly');

  return new Promise((resolve, reject) => {
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(new Error(`データの取得に失敗しました: ${request.error?.message}`));
    };
  });
}

/**
 * IDでレコードを取得
 */
export async function getById<T>(storeName: string, id: string): Promise<T | undefined> {
  const store = await getTransaction(storeName, 'readonly');

  return new Promise((resolve, reject) => {
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(new Error(`データの取得に失敗しました: ${request.error?.message}`));
    };
  });
}

/**
 * レコードを保存（追加または更新）
 */
export async function put<T>(storeName: string, data: T): Promise<void> {
  const store = await getTransaction(storeName, 'readwrite');

  return new Promise((resolve, reject) => {
    const request = store.put(data);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`データの保存に失敗しました: ${request.error?.message}`));
    };
  });
}

/**
 * IDでレコードを削除
 */
export async function deleteById(storeName: string, id: string): Promise<void> {
  const store = await getTransaction(storeName, 'readwrite');

  return new Promise((resolve, reject) => {
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`データの削除に失敗しました: ${request.error?.message}`));
    };
  });
}

/**
 * ストア名の定数をエクスポート
 */
export const STORES = {
  SAVED_PROBLEMS: STORE_SAVED_PROBLEMS,
} as const;
