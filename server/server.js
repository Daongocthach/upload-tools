import "dotenv/config";
import cors from "cors";
import express from "express";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getStorage } from "firebase-admin/storage";
import fs from "fs";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const stateFile = path.join(dataDir, "state.json");
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
const firebaseDatabaseUrl = process.env.FIREBASE_DATABASE_URL;
const firebaseStorageBucket = process.env.FIREBASE_STORAGE_BUCKET;
const firebaseTextPath = process.env.FIREBASE_TEXT_PATH || "shared/text";
const storageFolder = process.env.FIREBASE_STORAGE_FOLDER || "uploads";

fs.mkdirSync(dataDir, { recursive: true });

if (!fs.existsSync(stateFile)) {
  fs.writeFileSync(stateFile, JSON.stringify({ text: "" }, null, 2));
}

function getFirebaseOptions() {
  if (!firebaseStorageBucket && !firebaseDatabaseUrl) {
    return null;
  }

  if (firebaseProjectId && firebaseClientEmail && firebasePrivateKey) {
    return {
      credential: cert({
        projectId: firebaseProjectId,
        clientEmail: firebaseClientEmail,
        privateKey: firebasePrivateKey
      }),
      storageBucket: firebaseStorageBucket,
      databaseURL: firebaseDatabaseUrl
    };
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return {
      credential: applicationDefault(),
      storageBucket: firebaseStorageBucket,
      databaseURL: firebaseDatabaseUrl
    };
  }

  return null;
}

const firebaseOptions = getFirebaseOptions();
const firebaseApp = firebaseOptions ? getApps()[0] || initializeApp(firebaseOptions) : null;
const database = firebaseApp && firebaseDatabaseUrl ? getDatabase(firebaseApp) : null;
const storage = firebaseApp ? getStorage(firebaseApp) : null;

function readStateFile() {
  const raw = fs.readFileSync(stateFile, "utf8");
  return JSON.parse(raw);
}

function writeStateFile(nextState) {
  fs.writeFileSync(stateFile, JSON.stringify(nextState, null, 2));
}

async function readSharedText() {
  if (!database) {
    const state = readStateFile();
    return state.text ?? "";
  }

  const snapshot = await database.ref(firebaseTextPath).get();
  return typeof snapshot.val() === "string" ? snapshot.val() : "";
}

async function writeSharedText(nextText) {
  if (!database) {
    writeStateFile({ text: nextText });
    return nextText;
  }

  await database.ref(firebaseTextPath).set(nextText);
  return nextText;
}

function requireStorage() {
  if (!storage) {
    const error = new Error(
      "Firebase Storage is not configured. Set FIREBASE_STORAGE_BUCKET and Firebase service account credentials."
    );
    error.statusCode = 500;
    throw error;
  }

  return storage.bucket();
}

function sanitizeFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function buildStoragePath(fileName) {
  const safeName = sanitizeFileName(fileName);
  return `${storageFolder}/${Date.now()}-${safeName}`;
}

async function getFiles() {
  const bucket = requireStorage();
  const [files] = await bucket.getFiles({
    prefix: `${storageFolder}/`,
    maxResults: 100
  });

  const uploadFiles = files.filter((file) => file.name !== `${storageFolder}/`);
  const fileDetails = await Promise.all(
    uploadFiles.map(async (file) => {
      const [metadata] = await file.getMetadata();
      const [downloadUrl] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 60 * 60 * 1000
      });

      return {
        name: path.basename(file.name).replace(/^\d+-/, ""),
        path: file.name,
        size: Number(metadata.size || 0),
        updatedAt: metadata.updated || metadata.timeCreated || new Date().toISOString(),
        downloadUrl
      };
    })
  );

  return fileDetails.sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

const upload = multer({ storage: multer.memoryStorage() });
const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/state", async (_req, res) => {
  try {
    const text = await readSharedText();
    const files = storage ? await getFiles() : [];

    res.json({
      text,
      files,
      storageConfigured: Boolean(storage)
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      message: error.message || "Cannot load data"
    });
  }
});

app.put("/api/text", async (req, res) => {
  try {
    const nextText = typeof req.body?.text === "string" ? req.body.text : "";
    const text = await writeSharedText(nextText);
    res.json({ text });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      message: error.message || "Cannot save text"
    });
  }
});

app.post("/api/files", upload.single("file"), async (req, res) => {
  try {
    const bucket = requireStorage();
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const storagePath = buildStoragePath(file.originalname);
    await bucket.file(storagePath).save(file.buffer, {
      resumable: false,
      metadata: {
        contentType: file.mimetype,
        cacheControl: "public, max-age=3600"
      },
      preconditionOpts: {
        ifGenerationMatch: 0
      }
    });

    return res.status(201).json({ ok: true });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Cannot upload file"
    });
  }
});

app.delete("/api/files/:path(*)", async (req, res) => {
  try {
    const bucket = requireStorage();
    const targetPath = req.params.path;

    if (!targetPath) {
      return res.status(400).json({ message: "Missing file path" });
    }

    await bucket.file(targetPath).delete();

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
