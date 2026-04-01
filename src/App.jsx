import { useEffect, useState } from "react";
import { get, ref as databaseRef, set } from "firebase/database";
import {
  deleteObject,
  getDownloadURL,
  getMetadata,
  listAll,
  ref as storageRef,
  uploadBytes
} from "firebase/storage";
import { database, isFirebaseConfigured, storage } from "./firebase";

const defaultState = {
  text: "",
  files: []
};

const textPath = import.meta.env.VITE_FIREBASE_TEXT_PATH || "shared/text";
const storageFolder = (import.meta.env.VITE_FIREBASE_STORAGE_FOLDER || "uploads").replace(
  /^\/+|\/+$/g,
  ""
);

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export default function App() {
  const [state, setState] = useState(defaultState);
  const [textDraft, setTextDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingText, setSavingText] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const storageConfigured = isFirebaseConfigured();

  async function getFiles() {
    if (!storage) return [];

    const folderRef = storageRef(storage, storageFolder);
    const listResult = await listAll(folderRef);
    const files = await Promise.all(
      listResult.items.map(async (item) => {
        const [metadata, downloadUrl] = await Promise.all([getMetadata(item), getDownloadURL(item)]);

        return {
          name: item.name.replace(/^\d+-/, ""),
          path: item.fullPath,
          size: Number(metadata.size || 0),
          updatedAt: metadata.updated || metadata.timeCreated || new Date().toISOString(),
          downloadUrl
        };
      })
    );

    return files.sort((left, right) => {
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
  }

  async function getText() {
    if (!database) return "";

    const snapshot = await get(databaseRef(database, textPath));
    return typeof snapshot.val() === "string" ? snapshot.val() : "";
  }

  async function loadState() {
    setLoading(true);
    setMessage("");

    try {
      if (!storageConfigured) {
        throw new Error("Firebase client config is missing");
      }

      const [text, files] = await Promise.all([getText(), getFiles()]);
      setState({ text, files });
      setTextDraft(text);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadState();
  }, []);

  async function saveText() {
    setSavingText(true);
    setMessage("");

    try {
      if (!database) {
        throw new Error("Realtime Database is not configured");
      }

      await set(databaseRef(database, textPath), textDraft);
      setState((current) => ({ ...current, text: textDraft }));
      setMessage("Text saved");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSavingText(false);
    }
  }

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!storageConfigured) {
      setMessage("Firebase client config chưa được cấu hình.");
      event.target.value = "";
      return;
    }

    setUploading(true);
    setMessage("");

    try {
      if (!storage) {
        throw new Error("Storage is not configured");
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileRef = storageRef(storage, `${storageFolder}/${Date.now()}-${safeName}`);
      await uploadBytes(fileRef, file, {
        contentType: file.type || "application/octet-stream"
      });

      await loadState();
      setMessage("File uploaded");
    } catch (error) {
      setMessage(error.message);
    } finally {
      event.target.value = "";
      setUploading(false);
    }
  }

  async function deleteFile(filePath) {
    setMessage("");

    try {
      if (!storage) {
        throw new Error("Storage is not configured");
      }

      await deleteObject(storageRef(storage, filePath));

      await loadState();
      setMessage("File deleted");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Shared Upload Workspace</p>
        <h1>Files and text persist for every reload.</h1>
        <p className="hero-copy">
          Upload files, download or delete them, and keep a shared text note saved directly in Firebase.
        </p>
      </section>

      <section className="grid">
        <article className="card">
          <div className="card-header">
            <div>
              <h2>Shared Text</h2>
              <p>Anyone opening this app will see the latest saved content.</p>
            </div>
            <button className="primary-button" onClick={saveText} disabled={savingText}>
              {savingText ? "Saving..." : "Save text"}
            </button>
          </div>

          <textarea
            className="text-area"
            value={textDraft}
            onChange={(event) => setTextDraft(event.target.value)}
            placeholder="Paste text here..."
            rows={12}
          />

          <div className="saved-preview">
            <span>Saved version</span>
            <div className="preview-box">{state.text || "No text saved yet."}</div>
          </div>
        </article>

        <article className="card">
          <div className="card-header">
            <div>
              <h2>Files</h2>
              <p>
                Upload a file to Firebase Storage, then manage it from the shared list.
              </p>
            </div>
            <label className={`upload-button${uploading ? " disabled" : ""}`}>
              {uploading ? "Uploading..." : "Upload file"}
              <input
                type="file"
                onChange={handleUpload}
                disabled={uploading || !storageConfigured}
                hidden
              />
            </label>
          </div>

          {!storageConfigured ? (
            <div className="empty-state">
              Firebase client config chưa được cấu hình. Thêm `VITE_FIREBASE_*` rồi build lại app.
            </div>
          ) : null}

          {loading ? (
            <div className="empty-state">Loading data...</div>
          ) : storageConfigured && state.files.length === 0 ? (
            <div className="empty-state">No files uploaded yet.</div>
          ) : storageConfigured ? (
            <div className="file-list">
              {state.files.map((file) => (
                <div className="file-row" key={file.path}>
                  <div>
                    <div className="file-name">{file.name}</div>
                    <div className="file-meta">
                      {formatBytes(file.size)} • {new Date(file.updatedAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="file-actions">
                    <a className="ghost-button" href={file.downloadUrl} target="_blank" rel="noreferrer">
                      Download
                    </a>
                    <button className="danger-button" onClick={() => deleteFile(file.path)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </article>
      </section>

      {message ? <div className="status-bar">{message}</div> : null}
    </main>
  );
}
