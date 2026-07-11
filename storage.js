const DB_NAME = "digitalLibrary";
const DB_VERSION = 1;
const STORE_NAME = "files";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true
        });
        store.createIndex("libraryYear", ["library", "year"], { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveFile(library, year, file) {
  const db = await openDB();
  const record = {
    library,
    year,
    name: file.name,
    type: file.type || "Document File",
    blob: file,
    uploadedAt: Date.now()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(record);

    request.onsuccess = () => {
      resolve({
        id: request.result,
        name: record.name,
        type: record.type,
        url: URL.createObjectURL(record.blob)
      });
    };
    request.onerror = () => reject(request.error);
  });
}

async function getFiles(library, year) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("libraryYear");
    const request = index.getAll([library, year]);

    request.onsuccess = () => {
      const files = (request.result || []).map((record) => ({
        id: record.id,
        name: record.name,
        type: record.type,
        url: URL.createObjectURL(record.blob)
      }));
      resolve(files);
    };
    request.onerror = () => reject(request.error);
  });
}

async function deleteFile(id) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
