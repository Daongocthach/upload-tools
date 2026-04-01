# Upload Tools

React + Vite app for:

- showing a shared file list
- uploading, downloading, and deleting files with Firebase Storage
- saving shared text in Firebase Realtime Database so other users still see it after reload

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

Local app runs on `http://localhost:5173`.
Shared text is stored in Firebase Realtime Database.
Uploaded files are stored in Firebase Storage.

## Firebase setup

1. Create or use an existing Firebase project with Cloud Storage and Realtime Database enabled.
2. In Firebase Console, open `Project settings` > `General` > `Your apps`, and copy the Web app config.
3. Copy `.env.example` to `.env`.
4. Fill in:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_TEXT_PATH`
- `VITE_FIREBASE_STORAGE_FOLDER`

Because this app now uses Firebase Client SDK directly in the browser, your Firebase rules must explicitly allow the behavior you want. The permissive storage rule you pasted earlier will work for testing, but do not keep it for production.

## GitHub Pages

This repo now includes `.github/workflows/deploy.yml` to deploy `dist/` to GitHub Pages on every push to `main`.

Set these GitHub repository secrets before pushing:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_TEXT_PATH`
- `VITE_FIREBASE_STORAGE_FOLDER`
