/* ================================================================
   WE ARE LEGEND — MESSAGE BOARD (member portal)
   Anyone can read; posting a thread or reply requires a Member ID +
   PIN, verified server-side on every single post (the PIN is kept
   in memory only for this page session, never in browser storage).
   ================================================================ */

function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function fmtDate(d){
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleString(undefined, { year:"numeric", month:"short", day:"numeric", hour:"numeric", minute:"2-digit" });
}

/* Session token replaces the PIN after login — the PIN is sent once
   and never retained. */
let session = { token: null, memberId: null, name: null };
let currentThreadId = null;

async function postAction(action, payload){
  if (!CONFIG.API_URL || CONFIG.API_URL.includes("YOUR_GOOGLE_APPS_SCRIPT")){
    throw new Error("This board isn't connected to the registry yet.");
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

const boardStatus = document.getElementById("boardStatus");
function setStatus(msg, isError){
  boardStatus.textContent = msg || "";
  boardStatus.className = "status-line" + (isError ? " error" : "");
}

/* ---------------- SIGN IN ---------------- */

document.getElementById("bSigninBtn").addEventListener("click", async ()=>{
  const memberId = document.getElementById("bMemberId").value.trim();
  const pin = document.getElementById("bPin").value.trim();
  if (!memberId || !pin){ setStatus("Enter your Member ID and PIN.", true); return; }
  setStatus("Checking…");
  try{
    const data = await postAction("memberLogin", { memberId, pin });
    session = { token: data.sessionToken, memberId: data.member.MemberID, name: data.member.FullName };
    document.getElementById("boardSignin").classList.add("hidden");
    document.getElementById("boardSignedIn").classList.remove("hidden");
    document.getElementById("bSignedName").textContent = session.name;
    document.getElementById("bNewThreadBtn").classList.remove("hidden");
    setStatus("");
    if (currentThreadId) showThread(currentThreadId); // refresh reply box state
    else loadThreadList();
  }catch(err){
    setStatus(err.message, true);
  }
});

document.getElementById("bSignoutBtn").addEventListener("click", ()=>{
  session = { token: null, memberId: null, name: null };
  document.getElementById("boardSignin").classList.remove("hidden");
  document.getElementById("boardSignedIn").classList.add("hidden");
  document.getElementById("bNewThreadBtn").classList.add("hidden");
  document.getElementById("bMemberId").value = "";
  document.getElementById("bPin").value = "";
  if (currentThreadId) showThread(currentThreadId);
});

/* ---------------- THREAD LIST ---------------- */

async function loadThreadList(){
  // The board is internal discussion, so reading now requires a
  // member (or admin) session — it is no longer world-readable.
  if (!session.token){
    document.getElementById("boardListView").classList.remove("hidden");
    document.getElementById("boardThreadView").classList.add("hidden");
    document.getElementById("threadList").innerHTML =
      `<div class="empty-hint">Sign in with your Member ID and PIN above to view and join the discussion.</div>`;
    setStatus("");
    return;
  }
  document.getElementById("boardListView").classList.remove("hidden");
  document.getElementById("boardThreadView").classList.add("hidden");
  document.getElementById("newThreadForm").classList.add("hidden");
  currentThreadId = null;
  setStatus("Loading threads…");
  try{
    const data = await postAction("listThreads", { sessionToken: session.token });
    const threads = data.threads || [];
    setStatus("");
    const list = document.getElementById("threadList");
    list.innerHTML = threads.length ? threads.map(t=>`
      <div class="thread-row" data-id="${esc(t.ThreadID)}">
        <div style="display:flex; justify-content:space-between; gap:10px;">
          <div>
            <div class="thread-title">${t.Pinned==="Yes"?"📌 ":""}${t.Locked==="Yes"?"🔒 ":""}${esc(t.Title)}</div>
            <div class="thread-meta">by ${esc(t.AuthorName)} · ${fmtDate(t.CreatedAt)}</div>
          </div>
          <div class="thread-count">${t.postCount} repl${t.postCount===1?"y":"ies"}</div>
        </div>
      </div>`).join("") : `<div class="empty-hint">No threads yet — be the first to post.</div>`;
    list.querySelectorAll(".thread-row").forEach(row=>{
      row.addEventListener("click", ()=> showThread(row.dataset.id));
    });
  }catch(err){
    setStatus(err.message, true);
  }
}

document.getElementById("bNewThreadBtn").addEventListener("click", ()=>{
  document.getElementById("newThreadForm").classList.remove("hidden");
});
document.getElementById("bCancelNewThread").addEventListener("click", ()=>{
  document.getElementById("newThreadForm").classList.add("hidden");
});
document.getElementById("bPostThreadBtn").addEventListener("click", async ()=>{
  const title = document.getElementById("newThreadTitle").value.trim();
  const content = document.getElementById("newThreadContent").value.trim();
  if (!title || !content){ setStatus("Title and message are required.", true); return; }
  setStatus("Posting…");
  try{
    const res = await postAction("createThread", { sessionToken: session.token, title, content });
    document.getElementById("newThreadTitle").value = "";
    document.getElementById("newThreadContent").value = "";
    document.getElementById("newThreadForm").classList.add("hidden");
    showThread(res.threadId);
  }catch(err){
    setStatus(err.message, true);
  }
});

/* ---------------- THREAD DETAIL ---------------- */

async function showThread(threadId){
  currentThreadId = threadId;
  document.getElementById("boardListView").classList.add("hidden");
  document.getElementById("boardThreadView").classList.remove("hidden");
  setStatus("Loading…");
  try{
    const [threadsData, postsData] = await Promise.all([
      postAction("listThreads", { sessionToken: session.token }),
      postAction("listPosts", { sessionToken: session.token, threadId })
    ]);
    const thread = (threadsData.threads || []).find(t=>t.ThreadID===threadId);
    if (!thread){ setStatus("Thread not found.", true); return; }
    setStatus("");

    document.getElementById("threadTitle").textContent = (thread.Pinned==="Yes"?"📌 ":"") + (thread.Locked==="Yes"?"🔒 ":"") + thread.Title;
    document.getElementById("threadMeta").textContent = `Started by ${thread.AuthorName} · ${fmtDate(thread.CreatedAt)}`;

    const posts = postsData.posts || [];
    document.getElementById("postList").innerHTML = posts.length ? posts.map(p=>`
      <div class="post-row">
        <span class="post-author">${esc(p.AuthorName)}</span><span class="post-meta">${fmtDate(p.CreatedAt)}</span>
        <div class="post-content">${esc(p.Content)}</div>
      </div>`).join("") : `<div class="empty-hint">No replies yet.</div>`;

    const canReply = session.memberId && thread.Locked !== "Yes";
    document.getElementById("replyBox").classList.toggle("hidden", !canReply);
    document.getElementById("replyLockedNote").classList.toggle("hidden", !!session.memberId || thread.Locked === "Yes");
    if (thread.Locked === "Yes" && session.memberId){
      document.getElementById("replyLockedNote").classList.remove("hidden");
      document.getElementById("replyLockedNote").textContent = "This thread is locked.";
    }
  }catch(err){
    setStatus(err.message, true);
  }
}

document.getElementById("bBackBtn").addEventListener("click", loadThreadList);

document.getElementById("bReplyBtn").addEventListener("click", async ()=>{
  const content = document.getElementById("replyContent").value.trim();
  if (!content){ setStatus("Write a reply first.", true); return; }
  setStatus("Posting…");
  try{
    await postAction("createPost", { sessionToken: session.token, threadId: currentThreadId, content });
    document.getElementById("replyContent").value = "";
    showThread(currentThreadId);
  }catch(err){
    setStatus(err.message, true);
  }
});

loadThreadList();
