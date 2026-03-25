import { useEffect, useState } from "react";

const defaultState = {
  text: "",
  files: []
};

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
  const [storageConfigured, setStorageConfigured] = useState(true);

  async function loadState() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/state");
      if (!response.ok) throw new Error("Cannot load data");
      const data = await response.json();
      setState(data);
      setTextDraft(data.text ?? "");
      setStorageConfigured(Boolean(data.storageConfigured));
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
      const response = await fetch("/api/text", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: textDraft })
      });

      if (!response.ok) throw new Error("Cannot save text");
      const data = await response.json();
      setState((current) => ({ ...current, text: data.text }));
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
      setMessage("Supabase Storage chưa được cấu hình.");
      event.target.value = "";
      return;
    }

    setUploading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/files", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Cannot upload file");
      }

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
      const response = await fetch(`/api/files/${encodeURIComponent(filePath)}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Cannot delete file");
      }

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
          Upload files, download or delete them, and keep a shared text note saved on the server.
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
                Upload a file to Supabase Storage, then manage it from the shared list.
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
              Supabase Storage chưa được cấu hình. Thêm biến môi trường rồi chạy lại server.
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
