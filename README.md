# Upload Tools

React + Express app for:

- showing a shared file list
- uploading, downloading, and deleting files with Firebase Storage
- saving shared text in Firebase Realtime Database so other users still see it after reload

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

Frontend runs on `http://localhost:5173`.
Backend runs on `http://localhost:3001`.

Shared text is stored in Firebase Realtime Database.
Uploaded files are stored in your Firebase Storage bucket.

## Firebase setup

1. Create or use an existing Firebase project with Cloud Storage and Realtime Database enabled.
2. Copy `.env.example` to `.env`.
3. Fill in either the service-account env vars:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_DATABASE_URL`
- `FIREBASE_TEXT_PATH`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_STORAGE_FOLDER`

Or set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account JSON file path and still provide:

- `FIREBASE_DATABASE_URL`
- `FIREBASE_TEXT_PATH`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_STORAGE_FOLDER`

The server uses Firebase Admin SDK, so shared text is stored in Realtime Database and upload, list, signed download URL, and delete all run through your backend.
