import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import cors from "cors";
import express from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const stateFile = path.join(dataDir, "state.json");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseBucket = process.env.SUPABASE_STORAGE_BUCKET || "shared-files";
const storageFolder = process.env.SUPABASE_STORAGE_FOLDER || "uploads";

fs.mkdirSync(dataDir, { recursive: true });

if (!fs.existsSync(stateFile)) {
  fs.writeFileSync(stateFile, JSON.stringify({ text: "" }, null, 2));
}

const supabase =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      })
    : null;

function readState() {
  const raw = fs.readFileSync(stateFile, "utf8");
  return JSON.parse(raw);
}

function writeState(nextState) {
  fs.writeFileSync(stateFile, JSON.stringify(nextState, null, 2));
}

function requireSupabase() {
  if (!supabase) {
    const error = new Error(
      "Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
    error.statusCode = 500;
    throw error;
  }

  return supabase;
}

function sanitizeFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function buildStoragePath(fileName) {
  const safeName = sanitizeFileName(fileName);
  return `${storageFolder}/${Date.now()}-${safeName}`;
}

async function getFiles() {
  const client = requireSupabase();
  const { data, error } = await client.storage.from(supabaseBucket).list(storageFolder, {
    limit: 100,
    offset: 0,
    sortBy: { column: "updated_at", order: "desc" }
  });

  if (error) {
    throw error;
  }

  const files = (data || []).filter((item) => item.id && item.name);
  const paths = files.map((file) => `${storageFolder}/${file.name}`);
  const signedUrls =
    paths.length > 0
      ? await client.storage.from(supabaseBucket).createSignedUrls(paths, 60 * 60)
      : { data: [], error: null };

  if (signedUrls.error) {
    throw signedUrls.error;
  }

  return files.map((file, index) => ({
    name: file.name.replace(/^\d+-/, ""),
    path: `${storageFolder}/${file.name}`,
    size: file.metadata?.size ?? 0,
    updatedAt: file.updated_at || file.created_at || new Date().toISOString(),
    downloadUrl: signedUrls.data?.[index]?.signedUrl || ""
  }));
}

const upload = multer({ storage: multer.memoryStorage() });
const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/state", async (_req, res) => {
  try {
    const state = readState();
    const files = supabase ? await getFiles() : [];

    res.json({
      text: state.text ?? "",
      files,
      storageConfigured: Boolean(supabase)
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      message: error.message || "Cannot load data"
    });
  }
});

app.put("/api/text", (req, res) => {
  const nextText = typeof req.body?.text === "string" ? req.body.text : "";
  writeState({ text: nextText });
  res.json({ text: nextText });
});

app.post("/api/files", upload.single("file"), async (req, res) => {
  try {
    const client = requireSupabase();
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const storagePath = buildStoragePath(file.originalname);
    const { error } = await client.storage.from(supabaseBucket).upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
      cacheControl: "3600"
    });

    if (error) {
      throw error;
    }

    return res.status(201).json({ ok: true });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Cannot upload file"
    });
  }
});

app.delete("/api/files/:path(*)", async (req, res) => {
  try {
    const client = requireSupabase();
    const targetPath = req.params.path;

    if (!targetPath) {
      return res.status(400).json({ message: "Missing file path" });
    }

    const { error } = await client.storage.from(supabaseBucket).remove([targetPath]);
    if (error) {
      throw error;
    }

    return res.json({ ok: true });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Cannot delete file"
    });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
