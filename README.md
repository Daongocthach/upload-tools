# Upload Tools

React + Express app for:

- showing a shared file list
- uploading, downloading, and deleting files with Supabase Storage
- saving shared text so other users still see it after reload

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

Frontend runs on `http://localhost:5173`.
Backend runs on `http://localhost:3001`.

Shared text is stored in `data/state.json`.
Uploaded files are stored in your Supabase Storage bucket.

## Supabase setup

1. Create a bucket in Supabase Storage, for example `shared-files`.
2. Copy `.env.example` to `.env`.
3. Fill in:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `SUPABASE_STORAGE_FOLDER`

The server uses the service role key so file upload, list, signed download URL, and delete all run through your backend.
