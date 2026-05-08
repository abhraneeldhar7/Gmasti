# Gmasti Local Setup, Testing, and Chrome Publish Guide

This guide walks through the full setup for:

1. Running the FastAPI server locally
2. Building and loading the Chrome extension locally
3. Testing Google login and post rewriting
4. Preparing a production deployment
5. Publishing the extension to the Chrome Web Store

This project has:

- `apps/server`: FastAPI backend
- `apps/extension`: React Chrome extension

## 1. Prerequisites

Install these first:

- Node.js 20+ or newer
- npm
- Python 3.13
- Google Chrome
- A Google Cloud project
- A Groq API key
- A Neon Postgres database

Check your tools:

```powershell
node -v
npm -v
py --version
```

## 2. Clone or open the project

Open the repo root:

```powershell
cd "d:\Workspace\Visual Studio Workspace\gmasti"
```

## 3. Understand the folder structure

```text
gmasti/
  apps/
    extension/
    server/
```

Important files:

- [apps/server/.env](</d:/Workspace/Visual Studio Workspace/gmasti/apps/server/.env>)
- [apps/server/app/sql/schema.sql](</d:/Workspace/Visual Studio Workspace/gmasti/apps/server/app/sql/schema.sql>)
- [apps/server/scripts/init_db.py](</d:/Workspace/Visual Studio Workspace/gmasti/apps/server/scripts/init_db.py>)
- [apps/extension/.env](</d:/Workspace/Visual Studio Workspace/gmasti/apps/extension/.env>)
- [apps/extension/scripts/manifest.template.json](</d:/Workspace/Visual Studio Workspace/gmasti/apps/extension/scripts/manifest.template.json>)
- [apps/extension/src/background.js](</d:/Workspace/Visual Studio Workspace/gmasti/apps/extension/src/background.js>)

## 4. Set up the FastAPI server

### 4.1 Create the virtual environment

```powershell
cd "d:\Workspace\Visual Studio Workspace\gmasti\apps\server"
py -3.13 -m venv .venv
```

### 4.2 Activate the virtual environment

```powershell
.venv\Scripts\Activate.ps1
```

If PowerShell blocks script execution, run this once in a new PowerShell window:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Then activate again:

```powershell
.venv\Scripts\Activate.ps1
```

### 4.3 Install Python dependencies

```powershell
pip install -r requirements.txt
```

### 4.4 Fill in `apps/server/.env`

Open [apps/server/.env](</d:/Workspace/Visual Studio Workspace/gmasti/apps/server/.env>) and replace the placeholder values.

You must fill:

- `DATABASE_URL`
- `JWT_SECRET_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GROQ_API_KEY`

These values are now hardcoded in the backend:

- Groq model in [apps/server/app/services/groq.py](</d:/Workspace/Visual Studio Workspace/gmasti/apps/server/app/services/groq.py>)
- Groq chunk character limit in [apps/server/app/services/groq.py](</d:/Workspace/Visual Studio Workspace/gmasti/apps/server/app/services/groq.py>)
- Daily post limit in [apps/server/app/services/posts.py](</d:/Workspace/Visual Studio Workspace/gmasti/apps/server/app/services/posts.py>)

### 4.5 Set up the Neon database tables

Run:

```powershell
python scripts\init_db.py
```

This creates the tables from [schema.sql](</d:/Workspace/Visual Studio Workspace/gmasti/apps/server/app/sql/schema.sql>):

- `users`
- `posts`
- `usage_logs`

If this fails:

- verify `DATABASE_URL` is valid
- verify the password is correct
- verify the Neon database accepts connections from your machine

### 4.6 Start the FastAPI server

```powershell
uvicorn app.main:app --reload
```

By default it runs on:

```text
http://localhost:8000
```

Health check:

Open this in the browser:

```text
http://localhost:8000/health
```

Expected response:

```json
{"status":"ok"}
```

## 5. Set up Google OAuth for local extension testing

The extension uses this auth flow:

1. Chrome extension opens Google login
2. Google redirects back to the extension
3. The extension gets an auth `code`
4. The extension sends that code to your FastAPI server
5. The server exchanges it with Google and returns your own JWT

### 5.1 Create a Google Cloud project

Go to:

```text
https://console.cloud.google.com/
```

Create or open a project.

### 5.2 Configure OAuth consent screen

Go to:

```text
APIs & Services -> OAuth consent screen
```

Set it up:

- App type: External
- App name: `Gmasti` or your preferred name
- Support email: your email
- Developer contact email: your email

If your app is still in testing mode:

- add your Google account as a test user

### 5.3 Create OAuth credentials

Go to:

```text
APIs & Services -> Credentials -> Create Credentials -> OAuth client ID
```

Choose:

- Application type: `Web application`

Important:

- You are intentionally using a `Web application` OAuth client because the backend performs the token exchange securely with the client secret.

### 5.4 Load the extension once to get the extension ID

You need the extension ID before finishing OAuth setup.

Later in this guide you will load the unpacked extension in Chrome. Once loaded:

1. Open `chrome://extensions`
2. Enable Developer mode
3. Note the extension ID for Gmasti

The redirect URI format will be:

```text
https://YOUR_EXTENSION_ID.chromiumapp.org/
```

Example:

```text
https://abcdefghijklmnopqrstuvwxyzabcdef.chromiumapp.org/
```

### 5.5 Add the authorized redirect URI

In your Google OAuth client settings, add:

```text
https://YOUR_EXTENSION_ID.chromiumapp.org/
```

This must match exactly.

### 5.6 Copy the Google client values into both env files

Set the same Google client ID in:

- [apps/server/.env](</d:/Workspace/Visual Studio Workspace/gmasti/apps/server/.env>) as `GOOGLE_CLIENT_ID`
- [apps/extension/.env](</d:/Workspace/Visual Studio Workspace/gmasti/apps/extension/.env>) as `VITE_GOOGLE_CLIENT_ID`

Set the Google client secret only in:

- [apps/server/.env](</d:/Workspace/Visual Studio Workspace/gmasti/apps/server/.env>) as `GOOGLE_CLIENT_SECRET`

Never put the Google client secret in the extension.

## 6. Build the extension locally

Open a new terminal in the repo root:

```powershell
cd "d:\Workspace\Visual Studio Workspace\gmasti"
```

### 6.1 Install extension dependencies

If you have not already done so:

```powershell
cd apps\extension
npm install
```

Note:

- This repo uses an npm workspace at the root, so `node_modules` may appear in the repo root. That is normal.

### 6.2 Fill in `apps/extension/.env`

Open [apps/extension/.env](</d:/Workspace/Visual Studio Workspace/gmasti/apps/extension/.env>) and set:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

Use your real Google client ID.

### 6.3 Build the extension

```powershell
npm run build
```

This creates:

```text
apps/extension/dist
```

Important:

- The manifest is generated during build.
- If you change `apps/extension/.env`, rebuild the extension again.

## 7. Load the extension into Chrome

### 7.1 Open extensions page

In Chrome, go to:

```text
chrome://extensions
```

### 7.2 Turn on Developer mode

Use the toggle in the top right.

### 7.3 Load unpacked

Click:

```text
Load unpacked
```

Select:

```text
d:\Workspace\Visual Studio Workspace\gmasti\apps\extension\dist
```

### 7.4 Copy the extension ID

After loading, copy the extension ID shown on the card.

If you have not yet added the Google redirect URI:

1. Go back to Google Cloud Console
2. Add `https://YOUR_EXTENSION_ID.chromiumapp.org/`
3. Save the OAuth client
4. Rebuild the extension if you changed `VITE_GOOGLE_CLIENT_ID`
5. Click the refresh icon for the extension in `chrome://extensions`

## 8. Test local auth

### 8.1 Make sure the backend is running

Confirm:

```text
http://localhost:8000/health
```

works in the browser.

### 8.2 Open the extension popup

Click the Gmasti extension icon.

### 8.3 Sign in

Click:

```text
Sign in with Google
```

Expected behavior:

1. Google popup opens
2. You choose your account
3. Consent screen appears if needed
4. Popup closes
5. Extension shows your name/email and usage count

If login fails:

- verify the redirect URI is exact
- verify your Google account is added as a test user if the app is in testing mode
- verify `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID` are the same client
- verify `GOOGLE_CLIENT_SECRET` is correct
- verify the server is reachable at `http://localhost:8000`

## 9. Test post rewriting locally

### 9.1 Pick a tone in the popup

You can choose:

- Randomize per post
- Medieval Victorian English
- Gen Z Slop
- Caveman
- Anime Kitten UwU
- Hood Lingo

### 9.2 Make sure the feature is enabled

The `Mode` toggle must be on.

### 9.3 Open X or LinkedIn

Supported pages:

- `https://x.com/...`
- `https://www.linkedin.com/...`

### 9.4 Scroll the feed

Expected behavior:

- posts in view are scanned
- up to 10 posts are processed at a time
- extra posts below the viewport are queued
- a small `Rewriting` loader appears on posts being fetched
- rewritten text replaces the post text

### 9.5 Confirm caching behavior

Expected cache flow:

1. Extension checks local extension storage first
2. If not found locally, it calls the server
3. Server checks Neon `posts`
4. If found in DB, server returns cached generated text
5. If not found in DB, server calls Groq
6. Extension stores returned result locally

That means:

- first view may be slower
- revisiting the same post and theme should be faster

## 10. Test usage tracking

The rule is:

- 100 posts per day per user

Tracked in:

- `usage_logs`

Important behavior:

- local extension cache hits do not consume server usage
- server requests do consume usage, even if the text already existed in Neon

The popup shows the synced daily number plus runtime increments for the current browser session.

## 11. Check the database manually if needed

Use Neon SQL editor or any Postgres client and inspect:

```sql
SELECT * FROM users ORDER BY joined DESC;
SELECT * FROM posts ORDER BY updated_at DESC LIMIT 20;
SELECT * FROM usage_logs ORDER BY occurred_at DESC LIMIT 50;
```

Useful checks:

- confirm your Google user was created
- confirm rewrites are being stored
- confirm usage logs are being inserted

## 12. Common local issues

### 12.1 Extension popup says sign in failed

Check:

- Google redirect URI exact match
- backend running
- correct client ID in both env files
- correct client secret in server env
- your Google account is allowed as a test user

### 12.2 Extension does not rewrite posts

Check:

- popup `Mode` is enabled
- you are signed in
- backend is running
- Groq key is valid
- browser console for content script errors
- server terminal logs for backend errors

### 12.3 Login works but rewrite fails

Check:

- `GROQ_API_KEY`
- `DATABASE_URL`
- schema initialized
- rate limit not exceeded

### 12.4 Changed env values but nothing changed in Chrome

Rebuild and reload:

```powershell
cd "d:\Workspace\Visual Studio Workspace\gmasti\apps\extension"
npm run build
```

Then in `chrome://extensions`:

- click the reload icon on Gmasti

### 12.5 `init_db.py` fails

Check:

- real password in `DATABASE_URL`
- database exists
- SSL params remain in the connection string

## 13. Prepare for production

Before publishing, you should deploy the backend publicly.

The extension cannot point to `http://localhost:8000` for real users.

You need a public backend URL such as:

```text
https://api.yourdomain.com
```

### 13.1 Deploy the FastAPI backend

You can deploy to any platform that supports Python, for example:

- Railway
- Render
- Fly.io
- a VPS

Your deployed backend must:

- expose HTTPS
- allow Chrome extension origins in CORS
- connect to your Neon DB
- hold your Google client secret safely
- hold your Groq API key safely

### 13.2 Update production env values

In production server env:

- set real production values
- keep `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

In extension env for production build:

```env
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

Then rebuild:

```powershell
cd "d:\Workspace\Visual Studio Workspace\gmasti\apps\extension"
npm run build
```

### 13.3 Verify production backend with the extension

Before publishing:

1. rebuild the extension with production API URL
2. reload it unpacked in Chrome
3. sign in again
4. test X and LinkedIn again

Do this before uploading to the store.

## 14. Prepare assets for Chrome Web Store

You will need:

- extension name
- short description
- detailed description
- screenshots
- icon set
- privacy policy URL
- support email

Recommended icon sizes:

- 16x16
- 32x32
- 48x48
- 128x128

Recommended screenshots:

- popup UI
- X feed with rewritten posts
- LinkedIn feed with rewritten posts

You should also prepare:

- a short explanation of what data is processed
- a short explanation that users sign in with Google
- a short explanation that post text is sent to your backend and Groq for rewriting

## 15. Create a production zip for upload

Chrome Web Store upload should use the built extension output.

From:

```text
apps/extension/dist
```

Create a zip containing the contents of `dist`.

Important:

- zip the files inside `dist`
- do not zip the parent folder itself if Chrome expects the manifest at zip root

The zip root should contain:

- `manifest.json`
- `background.js`
- `content.js`
- `popup.html`
- other built assets

## 16. Publish to Chrome Web Store

### 16.1 Create a developer account

Go to:

```text
https://chrome.google.com/webstore/devconsole
```

Sign up for a Chrome Web Store developer account if you do not already have one.

### 16.2 Create a new item

Upload your extension zip.

### 16.3 Fill the store listing

Add:

- title
- summary
- detailed description
- screenshots
- category
- support contact
- privacy policy URL

### 16.4 Complete privacy disclosures carefully

Because this extension:

- authenticates users with Google
- sends social post text to your backend
- sends text to Groq for rewriting
- stores generated content and usage logs

You should answer the privacy/data usage forms carefully and truthfully.

You will likely need to disclose:

- authentication data
- user-generated or page text content
- stored generated content
- usage metrics/logging

### 16.5 Submit for review

After everything is filled:

1. submit the extension
2. wait for review
3. address any reviewer feedback if requested

## 17. Important production follow-up

Once published, the extension ID may change if you are using a different package identity than your local unpacked build.

That means you may need to update Google OAuth redirect URIs again for the published extension ID.

After the first published draft exists:

1. note the final Chrome Web Store extension ID
2. add its redirect URI to Google OAuth:

```text
https://PUBLISHED_EXTENSION_ID.chromiumapp.org/
```

3. keep both redirect URIs if you want both local unpacked testing and published installs to work

Example:

- local unpacked redirect URI
- published store redirect URI

Both can exist on the same Google OAuth client.

## 18. Recommended final checklist

Before publishing, confirm all of these:

- backend runs in production over HTTPS
- Neon DB is reachable from production
- `users`, `posts`, and `usage_logs` exist
- Google OAuth consent screen is configured
- local unpacked extension login works
- local unpacked extension rewrite works on X
- local unpacked extension rewrite works on LinkedIn
- production API URL is set in `apps/extension/.env`
- extension rebuilt after env changes
- privacy policy exists
- screenshots and icons are ready
- Chrome Web Store zip contains the built `dist` contents

## 19. Quick command reference

### Server

```powershell
cd "d:\Workspace\Visual Studio Workspace\gmasti\apps\server"
py -3.13 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python scripts\init_db.py
uvicorn app.main:app --reload
```

### Extension

```powershell
cd "d:\Workspace\Visual Studio Workspace\gmasti\apps\extension"
npm install
npm run build
```

### Reload after changes

```powershell
cd "d:\Workspace\Visual Studio Workspace\gmasti\apps\extension"
npm run build
```

Then reload the extension in:

```text
chrome://extensions
```
