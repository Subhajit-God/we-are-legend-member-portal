# ⚜️ WE ARE LEGEND — Member Portal (Self-Service)

A third, separate site with two pages: **My Profile** (`index.html`) — with three tabs, **Edit Profile**, **My Activity**, and **My ID Card** — and **Message Board** (`board.html`), threaded discussion any member can read and, once signed in with their PIN, post to.

## My Profile — how it works

1. Member enters their **Member ID** and **PIN**. The backend (`memberAuth` action) verifies the PIN against a SHA-256 hash stored on their record — the plaintext PIN is never stored anywhere, including here in the browser (it's kept in memory only for the length of the session, never in localStorage/sessionStorage).
2. On success, they land on the **Edit Profile** tab: a form pre-filled with their current Contact Number, Email, Address, School, Class, Emergency Contact, and Photo. They can never see or edit anything else (Role, Status, Notes, other members' records, etc.) — the backend only ever returns and accepts those specific fields.
3. Uploading a new photo goes straight to the same shared Google Drive folder the admin dashboard uses (via `memberUploadPhoto`, PIN-verified — no admin login required).
4. Submitting the form only sends the fields that actually changed, wrapped as a new row in the **ProfileEdits** sheet with status `Pending`. The registry admin gets an email notification (if `ADMIN_EMAIL` and notifications are configured in `Code.gs`).
5. The admin reviews it under **Profile Edits** in the main dashboard, can tweak any value before publishing, and approves (writes it into the live Members record) or rejects it (member can resubmit).

## My Activity

A read-only summary tab: total Awards/Achievements/Meetings-Attended as quick stat tiles, then their Upcoming Meetings, Awards, Achievements, Activities, Memories, and Diary Entries — the same data the public Lookup page and the admin dashboard show, fetched with one call (`memberFull`) and reused for the ID Card tab too, so signing in only costs one extra request, not two.

## My ID Card

The same flippable, printable membership card design as the admin dashboard — front (photo, name, role, ID/D.O.B/Phone fields, barcode) and back (terms, signature line, QR code linking to their own public Lookup page, issue date) — available to every member without needing an admin to generate it for them. **⟳ Flip Card** shows either side; **🖨️ Print Both Sides** prints a plain black-and-white layout with front and back placed **side by side** (not stacked), sized to fit a standard sheet. Requires `MEMBER_LOOKUP_URL` to be set in `config.js` for the QR code to appear (same setting as the admin dashboard's).

## Setting up a member's PIN

PINs aren't self-registered — an admin sets one from the Member Profile → Edit screen in the main dashboard, in the **Self-Service PIN** field. It's write-only: once saved, it's never shown again (only its hash is stored), so if a member forgets their PIN, the admin sets a new one.

## Message Board

`board.html` is open for anyone to read — no PIN needed to browse threads. Posting a new thread or a reply asks for a **Member ID + PIN** (verified server-side the same way as My Profile), which is kept in memory only for that page's session and cleared on sign-out or page close. From the admin dashboard's Message Board tab, a registry admin can pin, lock (blocks member replies), and delete threads/posts — none of that is available here.

## Deploying

Static site — upload all six files (`index.html`, `board.html`, `style.css`, `config.js`, `app.js`, `board.js`) anywhere, or open either HTML file directly. `config.js` is already pointed at your live Apps Script Web App URL, same as the other two WE ARE LEGEND sites. If you redeploy `Code.gs` with a new URL, update `API_URL` here too. Set `MEMBER_LOOKUP_URL` to wherever you deployed `member-lookup` to enable QR codes on ID cards.

## Security notes

- The PIN is a **convenience** control, not a full authentication system — it's a single shared secret per member, hashed with SHA-256 server-side, sent once over HTTPS per request. That's reasonable for a low-stakes members' registry; it is not bank-grade security.
- A member can only ever affect their *own* record, and only ever by creating a draft — there's no action in `Code.gs` that lets a PIN-authenticated request write directly to Members.
- If a PIN is compromised, the fix is the same as forgetting it: an admin sets a new one from the dashboard.


## Authentication (security refactor)

Sign-in now issues a **server-side session token**. The PIN is sent exactly once, at login, and is never stored — not in memory, not in localStorage.

Every subsequent request carries only the token, and the server derives the MemberID from its own session record. A `memberId` in the request body is ignored. This closes an IDOR hole: previously `memberFull` was unauthenticated, so anyone could pass any Member ID and receive that member's DOB, phone, email, address and emergency contacts.

Members still only ever submit **drafts** — no action lets a member session write directly to the Members sheet. Uploads are type- and size-validated server-side. The message board now requires a session to read as well as post, since it is internal discussion rather than public content.
