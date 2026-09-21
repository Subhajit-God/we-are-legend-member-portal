/* ================================================================
   WE ARE LEGEND — MEMBER PORTAL APP
   PIN-authenticated self-service: a member can view and edit their
   own contact info/photo, but every submission becomes a *draft*
   (a ProfileEdits row) that a registry admin has to review and
   approve before it touches the live Members record. This file
   never writes to Members directly — only submitProfileEdit does,
   and that runs entirely server-side.
   ================================================================ */

function fmtDate(d){
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString(undefined, { year:"numeric", month:"short", day:"numeric" });
}
function initials(name){
  if (!name) return "?";
  return name.trim().split(/\s+/).map(p=>p[0]).join("").toUpperCase().slice(0,2);
}

function lookupUrlFor(member){
  if (!CONFIG.MEMBER_LOOKUP_URL || CONFIG.MEMBER_LOOKUP_URL.includes("YOUR_MEMBER_LOOKUP_SITE_URL")) return null;
  return CONFIG.MEMBER_LOOKUP_URL.replace(/\/$/, "") + "/?id=" + encodeURIComponent(member.MemberID);
}

function buildCardFront(member){
  return `
    <div class="idc-header">
      <svg class="idc-header-svg" viewBox="0 0 380 108" preserveAspectRatio="none">
        <rect x="0" y="0" width="380" height="82" fill="#0F2A4A"/>
        <path d="M0,50 C 70,88 130,34 210,54 C 290,74 330,36 380,54 L380,108 L0,108 Z" fill="#2E6DA4"/>
        <path d="M0,66 C 80,100 140,52 220,70 C 300,88 340,54 380,70 L380,108 L0,108 Z" fill="#FFFFFF"/>
      </svg>
      <div class="idc-header-content">
        <div class="idc-logo-hex"><span>⚜</span></div>
        <div class="idc-header-text">
          <div class="idc-org">WE ARE LEGEND</div>
          <div class="idc-tagline">Official Digital Registry</div>
        </div>
      </div>
    </div>
    <div class="idc-photo-wrap">
      <div class="idc-photo">${member.PhotoURL ? `<img src="${esc(driveThumb(member.PhotoURL, 150))}" alt="">` : `<span class="idc-photo-fallback">${esc(initials(member.FullName))}</span>`}</div>
    </div>
    <div class="idc-body">
      <div class="idc-name">${esc(member.FullName)}</div>
      <div class="idc-role">${esc(member.Role || "Member")}</div>
      <div class="idc-fields">
        <div class="idc-field"><span class="idc-field-label">ID</span><span class="idc-field-colon">:</span><span class="idc-field-value idc-mono">${esc(member.MemberID)}</span></div>
        <div class="idc-field"><span class="idc-field-label">D.O.B</span><span class="idc-field-colon">:</span><span class="idc-field-value">${member.DOB ? fmtDate(member.DOB) : "—"}</span></div>
        <div class="idc-field"><span class="idc-field-label">Phone</span><span class="idc-field-colon">:</span><span class="idc-field-value">${esc(member.ContactNumber || "—")}</span></div>
      </div>
    </div>
    <div class="idc-barcode"></div>
    <div class="idc-barcode-label idc-mono">${esc(member.MemberID)}</div>`;
}

function buildCardBack(member){
  const lookupUrl = lookupUrlFor(member);
  const qrSrc = lookupUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=4&data=${encodeURIComponent(lookupUrl)}` : "";
  const issueDate = member.JoiningDate ? fmtDate(member.JoiningDate) : fmtDate(CONFIG.ESTABLISHED_DATE);
  return `
    <div class="idc-header idc-header-back">
      <svg class="idc-header-svg" viewBox="0 0 380 62" preserveAspectRatio="none"><rect x="0" y="0" width="380" height="62" fill="#0F2A4A"/></svg>
      <div class="idc-header-content">
        <div class="idc-logo-hex idc-logo-hex-sm"><span>⚜</span></div>
        <div class="idc-header-text">
          <div class="idc-org idc-org-sm">WE ARE LEGEND</div>
          <div class="idc-tagline">Official Digital Registry</div>
        </div>
      </div>
    </div>
    <div class="idc-terms-title">Terms &amp; Conditions</div>
    <div class="idc-terms-text">This card certifies membership in WE ARE LEGEND and remains the property of the registry. It is non-transferable. If found, please return it to any registry administrator.</div>
    <div class="idc-back-row">
      <div class="idc-sig">${member.SignatureURL ? `<img class="idc-sig-img" src="${esc(driveThumb(member.SignatureURL, 200))}" alt="Signature">` : ""}<div class="idc-sig-line"></div><div class="idc-sig-label">Member Signature</div></div>
      <div class="idc-qr">${qrSrc ? `<img src="${qrSrc}" alt="QR code linking to member lookup">` : `<div class="idc-qr-missing">QR unavailable</div>`}</div>
    </div>
    <div class="idc-dates"><span>Issue Date: <strong>${esc(issueDate)}</strong></span></div>
    <svg class="idc-back-wave" viewBox="0 0 380 30" preserveAspectRatio="none">
      <path d="M0,20 C 90,0 170,28 260,10 C 320,-2 350,14 380,8 L380,30 L0,30 Z" fill="#2E6DA4"/>
      <path d="M0,26 C 100,10 180,30 270,18 C 330,10 355,22 380,18 L380,30 L0,30 Z" fill="#0F2A4A"/>
    </svg>`;
}

const loginStep = document.getElementById("loginStep");
const editStep = document.getElementById("editStep");
const successStep = document.getElementById("successStep");

const loginForm = document.getElementById("loginForm");
const loginStatus = document.getElementById("loginStatus");
const loginBtn = document.getElementById("loginBtn");

const editForm = document.getElementById("editForm");
const editStatus = document.getElementById("editStatus");
const editName = document.getElementById("editName");
const submitBtn = document.getElementById("submitBtn");

function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
// Requests a small, fast-loading resized version of a Drive-hosted
// photo instead of the (potentially multi-MB) original.
function driveThumb(url, size){
  if (!url) return url;
  if (url.indexOf("lh3.googleusercontent.com") === -1) return url;
  return url.replace(/=s\d+.*$/, "").replace(/=w\d+.*$/, "") + "=s" + size;
}

/* Kept in memory only for the duration of this page session — never
   written to localStorage/sessionStorage, so a PIN never lingers in
   the browser after the tab closes or is refreshed. */
/* The session token replaces the PIN for every request after login.
   The PIN itself is used exactly once, at sign-in, and is never
   stored — not in memory, not in localStorage. The server maps the
   token to a MemberID, so this browser cannot claim to be anyone
   else by editing a request. */
let session = { token: null, memberId: null, original: null, full: null };

async function postAction(action, payload){
  if (!CONFIG.API_URL || CONFIG.API_URL.includes("YOUR_GOOGLE_APPS_SCRIPT")){
    throw new Error("This portal isn't connected to the registry yet. Please contact an administrator.");
  }
  const res = await fetch(CONFIG.API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload })
  });
  if (!res.ok) throw new Error("Could not reach the registry (network error).");
  const data = await res.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}

function showStep(step){
  [loginStep, editStep, successStep].forEach(s => s.classList.add("hidden"));
  step.classList.remove("hidden");
}

/* ---------------- LOGIN ---------------- */

loginForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const memberId = document.getElementById("memberIdInput").value.trim();
  const pin = document.getElementById("pinInput").value.trim();
  if (!memberId || !pin){ loginStatus.textContent = "Enter your Member ID and PIN."; loginStatus.className = "status-line error"; return; }

  loginBtn.disabled = true;
  loginStatus.textContent = "Checking…";
  loginStatus.className = "status-line";
  try{
    const data = await postAction("memberLogin", { memberId, pin });
    session = { token: data.sessionToken, memberId: data.member.MemberID, original: data.member, full: null };
    populateEditForm(data.member);
    resetPortalTabs();
    showStep(editStep);
  }catch(err){
    loginStatus.textContent = err.message;
    loginStatus.className = "status-line error";
  }finally{
    loginBtn.disabled = false;
  }
});

/* ---------------- EDIT ---------------- */

function populateEditForm(member){
  editName.textContent = member.FullName || member.MemberID;
  ["ContactNumber","Email","Address","School","Class","EmergencyContactName","EmergencyContactNumber"].forEach(key=>{
    const el = editForm.querySelector(`[name="${key}"]`);
    if (el) el.value = member[key] || "";
  });
  document.getElementById("photoUrlInput").value = member.PhotoURL || "";
  updatePhotoPreview(member.PhotoURL);
  editStatus.textContent = "";
}

function updatePhotoPreview(url){
  const preview = document.getElementById("photoPreview");
  preview.innerHTML = url ? `<img src="${esc(driveThumb(url, 150))}" alt="">` : "No photo";
}

const photoTrigger = document.getElementById("photoUploadTrigger");
const photoFileInput = document.getElementById("photoFileInput");
const photoStatus = document.getElementById("photoStatus");

photoTrigger.addEventListener("click", ()=> photoFileInput.click());
photoFileInput.addEventListener("change", async ()=>{
  const file = photoFileInput.files[0];
  if (!file) return;
  photoStatus.textContent = "Uploading " + file.name + "…";
  photoTrigger.disabled = true;
  try{
    const base64 = await fileToBase64(file);
    const result = await postAction("memberUploadPhoto", {
      sessionToken: session.token,
      fileName: file.name, mimeType: file.type || "image/jpeg", base64Data: base64
    });
    document.getElementById("photoUrlInput").value = result.url;
    updatePhotoPreview(result.url);
    photoStatus.textContent = "✓ Uploaded";
  }catch(err){
    photoStatus.textContent = "⚠ " + err.message;
  }finally{
    photoTrigger.disabled = false;
  }
});

function fileToBase64(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}

editForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const fields = ["ContactNumber","Email","Address","School","Class","EmergencyContactName","EmergencyContactNumber","PhotoURL"];
  const changes = {};
  fields.forEach(key=>{
    const el = key === "PhotoURL" ? document.getElementById("photoUrlInput") : editForm.querySelector(`[name="${key}"]`);
    const val = el ? el.value.trim() : "";
    if (val !== String(session.original[key] || "")) changes[key] = val;
  });

  if (!Object.keys(changes).length){
    editStatus.textContent = "You haven't changed anything yet.";
    editStatus.className = "status-line error";
    return;
  }

  submitBtn.disabled = true;
  editStatus.textContent = "Submitting…";
  editStatus.className = "status-line";
  try{
    await postAction("memberSubmitEdit", { sessionToken: session.token, changes });
    showStep(successStep);
  }catch(err){
    editStatus.textContent = err.message;
    editStatus.className = "status-line error";
  }finally{
    submitBtn.disabled = false;
  }
});

document.getElementById("logoutBtn").addEventListener("click", ()=>{
  session = { token: null, memberId: null, original: null, full: null };
  editForm.reset();
  document.getElementById("memberIdInput").value = "";
  document.getElementById("pinInput").value = "";
  loginStatus.textContent = "";
  showStep(loginStep);
});

document.getElementById("backBtn").addEventListener("click", ()=>{
  session = { token: null, memberId: null, original: null, full: null };
  editForm.reset();
  showStep(loginStep);
});

/* ================================================================
   PORTAL TABS: Edit Profile / My Activity / My ID Card
   ================================================================ */

function resetPortalTabs(){
  document.querySelectorAll(".portal-tab").forEach(b=>b.classList.toggle("active", b.dataset.tab === "edit"));
  document.querySelectorAll(".portal-panel").forEach(p=>p.classList.toggle("active", p.id === "panel-edit"));
}

document.querySelectorAll(".portal-tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".portal-tab").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".portal-panel").forEach(p=>p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("panel-" + btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "activity") loadMyActivity();
    if (btn.dataset.tab === "idcard") loadMyIdCard();
  });
});

// Both My Activity and My ID Card are driven by one fetch of the
// member's full record (the same data the public Lookup page and
// the admin dashboard use) — fetched once per session and reused.
async function ensureFullMemberData(){
  if (session.full) return session.full;
  const data = await postAction("memberActivity", { sessionToken: session.token });
  session.full = data;
  return data;
}

/* ---------------- MY ACTIVITY ---------------- */

async function loadMyActivity(){
  const statusEl = document.getElementById("activityStatus");
  const contentEl = document.getElementById("activityContent");
  statusEl.textContent = "Loading…";
  statusEl.className = "status-line";
  try{
    const data = await ensureFullMemberData();
    statusEl.textContent = "";

    // Stats and upcoming meetings are computed server-side now — the
    // browser no longer receives every meeting in order to filter them.
    const stats = data.stats || { awards:0, achievements:0, meetingsAttended:0 };
    const upcomingMeetings = data.upcomingMeetings || [];

    const section = (icon, title, rows, renderer) => `
      <div class="activity-section">
        <div class="activity-section-title">${icon} ${title}</div>
        ${rows.length ? rows.map(renderer).join("") : `<div class="activity-empty">Nothing here yet.</div>`}
      </div>`;

    contentEl.innerHTML = `
      <div class="activity-stats">
        <div class="activity-stat"><div class="activity-stat-num">${stats.awards}</div><div class="activity-stat-label">Awards</div></div>
        <div class="activity-stat"><div class="activity-stat-num">${stats.achievements}</div><div class="activity-stat-label">Achievements</div></div>
        <div class="activity-stat"><div class="activity-stat-num">${stats.meetingsAttended}</div><div class="activity-stat-label">Meetings Attended</div></div>
      </div>
      ${section("🗓️", "Upcoming Meetings", upcomingMeetings, m=>`<div class="activity-row"><div class="activity-row-title">${esc(m.Title)}</div><div class="activity-row-sub">${fmtDate(m.Date)}${m.Time?" · "+esc(m.Time):""}${m.Location?" · "+esc(m.Location):""}</div></div>`)}
      ${section("🏆", "Awards", data.awards||[], a=>`<div class="activity-row"><div class="activity-row-title">${esc(a.Title)}</div><div class="activity-row-sub">${fmtDate(a.DateAwarded)}</div></div>`)}
      ${section("🏅", "Achievements", data.achievements||[], a=>`<div class="activity-row"><div class="activity-row-title">${esc(a.Title)}</div><div class="activity-row-sub">${fmtDate(a.Date)}</div></div>`)}
      ${section("🎯", "Activities", data.activities||[], a=>`<div class="activity-row"><div class="activity-row-title">${esc(a.Title)}</div><div class="activity-row-sub">${fmtDate(a.Date)} · ${esc(a.Status||"")}</div></div>`)}
      ${section("📸", "Memories", data.memories||[], m=>`<div class="activity-row"><div class="activity-row-title">${esc(m.Title)}</div><div class="activity-row-sub">${fmtDate(m.Date)}</div></div>`)}
      ${section("📔", "Diary Entries", data.diary||[], d=>`<div class="activity-row"><div class="activity-row-title">${esc(d.Title)}</div><div class="activity-row-sub">${fmtDate(d.Date)}</div></div>`)}
    `;
  }catch(err){
    statusEl.textContent = err.message;
    statusEl.className = "status-line error";
  }
}

/* ---------------- MY ID CARD ---------------- */

async function loadMyIdCard(){
  const statusEl = document.getElementById("idcardStatus");
  const wrap = document.getElementById("idcardWrap");
  statusEl.textContent = "Loading…";
  statusEl.className = "status-line";
  wrap.style.display = "none";
  try{
    const res = await postAction("memberIdCard", { sessionToken: session.token });
    const member = res.member;
    statusEl.textContent = "";
    document.getElementById("idcardFront").innerHTML = buildCardFront(member);
    document.getElementById("idcardBack").innerHTML = buildCardBack(member);
    document.getElementById("idcardPrintSheet").innerHTML = `
      <div class="id-card-face id-card-front">${buildCardFront(member)}</div>
      <div class="id-card-face id-card-back">${buildCardBack(member)}</div>`;
    wrap.style.display = "";
    if (!lookupUrlFor(member)){
      statusEl.textContent = "QR code needs MEMBER_LOOKUP_URL set in config.js.";
    }
  }catch(err){
    statusEl.textContent = err.message;
    statusEl.className = "status-line error";
  }
}

document.getElementById("idcardFlipBtn").addEventListener("click", ()=>{
  document.getElementById("idcardFlipper").classList.toggle("flipped");
});

document.getElementById("idcardPrintBtn").addEventListener("click", ()=>{
  document.body.classList.add("printing-id-card");
  window.print();
  setTimeout(()=> document.body.classList.remove("printing-id-card"), 500);
});
