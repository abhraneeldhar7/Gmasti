

## What we do with your data

When you use Gmasti, three things happen:

**1. Sign in with Google**
Your Google email address and a Google-assigned ID number are stored in our database. That is the only personal information we hold. No name, no profile picture, no phone number.

**2. Post text gets rewritten**
When a post enters your viewport, its text is sent to our server, which forwards it to Groq's AI API for rewriting. The text is not stored on our server after the response comes back. The rewritten result is cached in your own browser so future views of the same post don't need another API call.

**3. Usage is counted**
We track how many posts you have rewritten today to enforce the 100 posts/day limit. This is a number in a database row. Nothing else.

That's the full list. We do not read your DMs, your followers, your likes, or anything else on X or LinkedIn.

---

## The source code is public

Gmasti is fully open source. Every line of code — the Chrome extension and the backend server — is publicly available for anyone to read, audit, or run themselves.

**GitHub repository:** [github.com/yourusername/gmasti](https://github.com/yourusername/gmasti)

If you find a security vulnerability, please open a GitHub issue or reach out privately before disclosing it publicly.

---

## Host it yourself

If you don't want to trust our servers at all, you can run Gmasti entirely on your own machine or your own server. Your data never leaves your control.

Here's how, step by step.

### What you'll need

Before starting, make sure you have these installed:

- **Node.js** (version 20 or newer) — download from nodejs.org
- **Python 3.13** — download from python.org
- **Google Chrome**
- A free **Groq API key** — get one at console.groq.com
- A free **Neon database** — get one at neon.tech
- A **Google Cloud account** — for login to work

If you're not sure whether something is installed, open a terminal and type `node -v`, `py --version` to check.

---

### Step 1 — Download the code

Go to the GitHub repository and click the green **Code** button, then **Download ZIP**. Extract it somewhere on your computer, for example `C:\Projects\gmasti` on Windows or `~/Projects/gmasti` on Mac.

Alternatively, if you have Git installed:

```
git clone https://github.com/yourusername/gmasti
```

---

### Step 2 — Get a Groq API key

1. Go to [console.groq.com](https://console.groq.com) and create a free account
2. Click **API Keys** in the sidebar
3. Click **Create API Key**, give it a name like "gmasti"
4. Copy the key and keep it somewhere safe — you'll need it in Step 5

---

### Step 3 — Create a Neon database

1. Go to [neon.tech](https://neon.tech) and create a free account
2. Create a new project, give it any name
3. On the dashboard, find the **Connection string** — it looks like `postgresql://user:password@host/dbname`
4. Copy that connection string — you'll need it in Step 5

---

### Step 4 — Set up Google login

This is the most involved step but you only do it once.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in
2. Click the project dropdown at the top and create a **New Project**, name it anything
3. In the left menu go to **APIs & Services → OAuth consent screen**
   - Choose **External**
   - Fill in your app name (e.g. "My Gmasti") and your email
   - Under **Test users**, add your own Google email address
   - Save
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name it anything
   - Leave redirect URIs empty for now — you'll add one after loading the extension
   - Click **Create**
5. Copy the **Client ID** and **Client Secret** shown — you'll need both in Step 5

---

### Step 5 — Configure the server

Open the folder `apps/server` inside the project. Find the file called `.env` (if it doesn't exist, create it). Fill it in like this:

```
DATABASE_URL=your-neon-connection-string-here
JWT_SECRET_KEY=any-long-random-string-you-make-up
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GROQ_API_KEY=your-groq-api-key
```

For `JWT_SECRET_KEY`, just type any long random string — something like `mygmasti-secret-key-2026-xyz-random`. It's used to sign login tokens and doesn't need to come from anywhere.

---

### Step 6 — Start the server

Open a terminal, navigate to `apps/server`, and run these commands one at a time:

```
py -3.13 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python scripts\init_db.py
uvicorn app.main:app --reload
```

On Mac/Linux, the activation command is slightly different:

```
source .venv/bin/activate
```

After the last command, you should see something like `Uvicorn running on http://localhost:8000`. Open that URL in your browser and you should see `{"status":"ok"}`. That means the server is running correctly.

Leave this terminal open — the server needs to stay running while you use the extension.

---

### Step 7 — Build the extension

Open a **second terminal** and navigate to `apps/extension`. Create a file called `.env` there and fill it in:

```
VITE_API_BASE_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

Then run:

```
npm install
npm run build
```

This creates a folder called `dist` inside `apps/extension`.

---

### Step 8 — Load the extension into Chrome

1. Open Chrome and go to `chrome://extensions`
2. Turn on **Developer mode** using the toggle in the top right
3. Click **Load unpacked**
4. Select the `apps/extension/dist` folder
5. Gmasti will appear as an installed extension
6. Note the **extension ID** shown on its card — a long string of letters

---

### Step 9 — Finish Google login setup

Now that you have your extension ID, go back to Google Cloud Console:

1. Go to **APIs & Services → Credentials**
2. Click on the OAuth client you created in Step 4
3. Under **Authorized redirect URIs**, click **Add URI** and enter:
   ```
   https://YOUR_EXTENSION_ID.chromiumapp.org/
   ```
   Replace `YOUR_EXTENSION_ID` with the actual ID you noted above
4. Save

---

### Step 10 — Use it

1. Click the Gmasti extension icon in Chrome
2. Click **Sign in with Google** and complete the login
3. Pick a tone in the popup
4. Go to X or LinkedIn
5. Posts in your feed will be rewritten

Everything runs on your own machine. Your data goes from your browser to your local server to Groq and back. Nothing touches our infrastructure.

---

## Questions or concerns

If something seems wrong or you have a security concern, open an issue on the GitHub repository. We read everything.