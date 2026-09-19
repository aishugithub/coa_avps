# AVPS Assignment — setup guide

Three files, two Google steps, one GitHub step. Total time ~15 minutes. No coding needed — you only paste one URL into one place.

```
[ index.html on GitHub Pages ]  --POST-->  [ Code.gs Web App ]  -->  [ Google Sheet ]
        the student form                     the tiny backend          your data
```

---

## Step 1 — Create the Google Sheet + backend (5 min)

1. Go to **sheets.google.com** and create a new blank spreadsheet. Name it e.g. **AVPS Assignment Responses**.
2. In that sheet, open **Extensions → Apps Script**. A code editor opens in a new tab.
3. Delete whatever starter code is there, then **paste the entire contents of `Code.gs`** (from this folder).
4. Click the **Save** icon (💾).

*(You don't need to create the "Responses" tab or any headers — the script makes them automatically on the first submission.)*

## Step 2 — Publish the backend as a Web App (3 min)

1. In the Apps Script editor, click **Deploy → New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Set:
   - **Description:** anything, e.g. "AVPS assignment endpoint"
   - **Execute as:** **Me** (your account — so it can write to your sheet)
   - **Who has access:** **Anyone**  ← this is required so students' browsers can post to it
4. Click **Deploy**. Google will ask you to **authorize** — approve it (you'll click through a "Google hasn't verified this app" screen; it's your own script, so choose *Advanced → Go to … (unsafe)* and Allow).
5. Copy the **Web app URL**. It looks like:
   `https://script.google.com/macros/s/AKfy............/exec`

*(Optional sanity check: paste that URL into a browser. You should see `{"ok":true,"message":"AVPS assignment endpoint is live..."}`.)*

## Step 3 — Wire the URL into the form (1 min)

1. Open `index.html` in any text editor.
2. Near the top, find:
   ```js
   APPS_SCRIPT_URL: "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE",
   ```
3. Replace the placeholder with the Web app URL you copied. Save.

## Step 4 — Put the form on your GitHub (5 min)

1. Create a new **public** repository on GitHub, e.g. `avps-assignment`.
2. Upload **`index.html`** to it (drag-and-drop in the GitHub web UI is fine).
3. Go to the repo's **Settings → Pages**. Under "Build and deployment", set **Source: Deploy from a branch**, **Branch: main / (root)**, Save.
4. Wait ~1 minute. GitHub shows your live URL, e.g. `https://<your-username>.github.io/avps-assignment/`.
5. That link is what you share with students.

## Step 5 — Test it yourself first

1. Open your GitHub Pages link.
2. Enter a fake register number (e.g. `E02-25-007`), a name, and any text as the session ID.
3. Click through all three sections + feedback and submit.
4. Open your Google Sheet — a row should appear in the **Responses** tab, with headers on row 1.

If the row appears, you're done. Share the link on Monday.

---

## Good to know

- **Session ID → real logs.** The "AVPS Session ID" column lets you join each student's answers here to their actual tutor usage on the AVPS backend (query count, thumbs-up rate). Students copy it from the banner under the AVPS title. Remind them to **keep the same AVPS tab open** for the whole assignment, or the ID changes.

- **Assignment is automatic and per-student.** Everything is derived from the register number: which of data/load is shown as a **built-in example** vs typed as a **custom program** (the "swap" — every student does both types), which **control** built-in they get, and the **order** the three sections appear in (varies student to student). It's deterministic (stable if a student refreshes) and reproducible (you can re-derive anyone's assignment). The assignment is saved in the `group`, `order`, `dataMode/dataItem`, `loadMode/loadItem`, `controlItem` columns.

- **Auto-scoring.** The five factual questions in each section are graded automatically against a key verified against the real simulator (so forwarding examples with 0 stalls and no-forwarding cases are scored correctly). Look at the `data_score`, `load_score`, `control_score` (each out of 5) and `total_score` (out of 15) columns. The 6th question in each section ("did the simulator help you understand this better?") is **not** scored — it's collected so you can correlate perceived helpfulness with actual accuracy.

- **Column layout.** Identity + assignment first, then each section's answers, then the score columns, then the feedback fields (`fb_*`) and diagnostics last — so accuracy data stays separate from the subjective ratings.

- **If you change `Code.gs` later**, you must **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy** for the change to take effect. Editing `index.html` just means re-uploading it to GitHub.

- **Capacity for 400 students.** The form and Sheet handle the load fine. The one thing to check is the **Groq tier for the AVPS tutor** — on the free tier the tutor will hit its daily/'per-minute token caps within minutes of a 400-student session. Add a payment method to Groq (Developer tier) before Monday; the whole cohort costs roughly a dollar or two.

- **Duplicate safety.** The submit button disables itself after one click, and a server-side lock prevents two submissions from clobbering each other. If a student somehow submits twice, you can de-duplicate later by `regno` + `sessionId`.
