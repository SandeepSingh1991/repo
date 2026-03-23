const SUPABASE_URL = "https://domskxftgijzhsrvuxhj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvbXNreGZ0Z2l6amhzcnZ1eGhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMzE4NjMsImV4cCI6MjA4OTgwNzg2M30.kb3ftTaSOPIdK8_6RLqTWPxfKYGNbmVqsI7_XQhP24w";
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let inactivityTimeout;
let viewerTab = "video";

function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

function pageName() {
  return window.location.pathname.split("/").pop() || "index.html";
}

function setMessage(elementId, message, type = "") {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message || "";
  el.className = `status-text ${type}`.trim();
}

function normalizeDriveUrl(url, type) {
  if (!url) return "";
  let clean = url.trim();
  if (type === "video") {
    clean = clean.replace("/view", "/preview");
  }
  return clean;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function getCurrentUser() {
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  return data.user;
}

async function getRoleByEmail(email) {
  const { data, error } = await client
    .from("users_role")
    .select("role")
    .ilike("email", normalizeEmail(email))
    .single();

  if (error) throw error;
  return data?.role;
}

async function requireSession(expectedRole) {
  const user = await getCurrentUser();

  if (!user) {
    window.location.href = "index.html";
    return null;
  }

  const role = await getRoleByEmail(user.email);

  if (!role) {
    await logout("Your account is authenticated but no role was found in users_role. Please ask the admin to add your email there.");
    return null;
  }
  const roleBadge = document.getElementById("sessionRoleBadge");
  if (roleBadge) {
    roleBadge.textContent = `${role || "unknown"} session • auto logout in 5 min`;
  }

  if (expectedRole && role !== expectedRole) {
    window.location.href = role === "admin" ? "admin.html" : "dashboard.html";
    return null;
  }

  startInactivityTimer();
  return { user, role };
}

function bindLogoutButton() {
  const button = document.getElementById("logoutBtn");
  if (!button) return;
  button.addEventListener("click", async () => {
    await logout("You have been logged out.");
  });
}

async function logout(message = "Session expired due to inactivity.") {
  clearTimeout(inactivityTimeout);
  await client.auth.signOut();
  sessionStorage.setItem("logout_message", message);
  window.location.href = "index.html";
}

function resetInactivityTimer() {
  clearTimeout(inactivityTimeout);
  inactivityTimeout = setTimeout(() => logout(), SESSION_TIMEOUT_MS);
}

function startInactivityTimer() {
  ["mousemove", "mousedown", "keydown", "scroll", "touchstart"].forEach((eventName) => {
    document.removeEventListener(eventName, resetInactivityTimer);
    document.addEventListener(eventName, resetInactivityTimer, { passive: true });
  });
  resetInactivityTimer();
}

function installContentRestrictions() {
  document.addEventListener("contextmenu", (event) => event.preventDefault());
  document.addEventListener("dragstart", (event) => {
    if (event.target.closest("img, iframe, video")) {
      event.preventDefault();
    }
  });
  document.addEventListener("keydown", (event) => {
    const blocked =
      event.key === "F12" ||
      ((event.ctrlKey || event.metaKey) && ["s", "u", "p"].includes(event.key.toLowerCase())) ||
      (event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(event.key.toLowerCase()));

    if (blocked) {
      event.preventDefault();
    }
  });
}

async function login(event) {
  event.preventDefault();
  setMessage("authMessage", "Signing in...");

  const email = normalizeEmail(document.getElementById("email")?.value);
  const password = document.getElementById("password")?.value;

  try {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const role = await getRoleByEmail(email);
    if (!role) {
      throw new Error("Login ho gaya, lekin users_role table me is email ka role nahi mila. Supabase SQL Editor me admin/user role add karo.");
    }
    setMessage("authMessage", `Login successful as ${role}. Redirecting...`, "success");
    window.location.href = role === "admin" ? "admin.html" : "dashboard.html";
  } catch (error) {
    setMessage("authMessage", error.message || "Unable to sign in.", "error");
  }
}

async function fetchContent() {
  const { data, error } = await client
    .from("content")
    .select("id, title, type, folder, url, description, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

function adminItemTemplate(item) {
  return `
    <article class="admin-item">
      <div class="admin-item-head">
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          <p class="muted">${escapeHtml(item.folder || "Unsorted")} • ${escapeHtml(item.type)}</p>
        </div>
        <span class="badge">${escapeHtml(item.type)}</span>
      </div>
      <p class="muted">${escapeHtml(item.description || "No description added.")}</p>
      <p class="muted"><strong>URL:</strong> ${escapeHtml(item.url)}</p>
      <div class="admin-item-actions">
        <button type="button" class="small-btn" data-action="edit" data-id="${item.id}">Edit</button>
        <button type="button" class="small-btn danger" data-action="delete" data-id="${item.id}">Delete</button>
      </div>
    </article>
  `;
}

async function loadAdminContent() {
  const container = document.getElementById("adminList");
  const count = document.getElementById("contentCount");
  if (!container) return;

  try {
    const rows = await fetchContent();
    count.textContent = `${rows.length} item${rows.length === 1 ? "" : "s"}`;

    if (!rows.length) {
      container.className = "admin-list empty-state";
      container.textContent = "No content added yet. Use the form to create your first video or photo card.";
      return;
    }

    container.className = "admin-list";
    container.innerHTML = rows.map(adminItemTemplate).join("");

    container.querySelectorAll("[data-action='edit']").forEach((button) => {
      button.addEventListener("click", () => startEdit(rows.find((row) => row.id === button.dataset.id)));
    });

    container.querySelectorAll("[data-action='delete']").forEach((button) => {
      button.addEventListener("click", () => deleteContent(button.dataset.id));
    });
  } catch (error) {
    container.className = "admin-list empty-state";
    container.textContent = error.message || "Unable to load content.";
  }
}

function resetForm() {
  document.getElementById("contentForm")?.reset();
  document.getElementById("contentId").value = "";
  document.getElementById("formTitle").textContent = "Add content";
  document.getElementById("submitBtn").textContent = "Save content";
  document.getElementById("cancelEditBtn").hidden = true;
}

function startEdit(item) {
  if (!item) return;
  document.getElementById("contentId").value = item.id;
  document.getElementById("title").value = item.title || "";
  document.getElementById("type").value = item.type || "video";
  document.getElementById("folder").value = item.folder || "";
  document.getElementById("url").value = item.url || "";
  document.getElementById("description").value = item.description || "";
  document.getElementById("formTitle").textContent = "Edit content";
  document.getElementById("submitBtn").textContent = "Update content";
  document.getElementById("cancelEditBtn").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function saveContent(event) {
  event.preventDefault();
  setMessage("adminMessage", "Saving content...");

  const id = document.getElementById("contentId").value;
  const payload = {
    title: document.getElementById("title").value.trim(),
    type: document.getElementById("type").value,
    folder: document.getElementById("folder").value.trim(),
    url: normalizeDriveUrl(document.getElementById("url").value, document.getElementById("type").value),
    description: document.getElementById("description").value.trim(),
  };

  try {
    let query = client.from("content");
    if (id) {
      const { error } = await query.update(payload).eq("id", id);
      if (error) throw error;
      setMessage("adminMessage", "Content updated successfully.", "success");
    } else {
      const { error } = await query.insert([payload]);
      if (error) throw error;
      setMessage("adminMessage", "Content added successfully.", "success");
    }
    resetForm();
    await loadAdminContent();
  } catch (error) {
    setMessage("adminMessage", error.message || "Unable to save content.", "error");
  }
}

async function deleteContent(id) {
  const confirmed = window.confirm("Delete this content item?");
  if (!confirmed) return;

  try {
    const { error } = await client.from("content").delete().eq("id", id);
    if (error) throw error;
    setMessage("adminMessage", "Content deleted successfully.", "success");
    await loadAdminContent();
  } catch (error) {
    setMessage("adminMessage", error.message || "Unable to delete content.", "error");
  }
}

function groupByFolder(items) {
  return items.reduce((acc, item) => {
    const folder = item.folder?.trim() || (item.type === "video" ? "Videos" : "Photos");
    acc[folder] = acc[folder] || [];
    acc[folder].push(item);
    return acc;
  }, {});
}

function mediaCardTemplate(item) {
  const title = escapeHtml(item.title);
  const description = escapeHtml(item.description || "No description available.");

  if (item.type === "video") {
    return `
      <article class="media-card">
        <iframe
          class="preview-frame"
          src="${escapeHtml(normalizeDriveUrl(item.url, "video"))}"
          title="${title}"
          loading="lazy"
          referrerpolicy="no-referrer"
          allow="autoplay; encrypted-media"
          sandbox="allow-same-origin allow-scripts allow-presentation"
        ></iframe>
        <div class="media-copy">
          <div class="media-meta"><h3>${title}</h3><span class="badge">Video</span></div>
          <p>${description}</p>
        </div>
      </article>
    `;
  }

  return `
    <article class="media-card">
      <img
        class="preview-image"
        src="${escapeHtml(item.url)}"
        alt="${title}"
        loading="lazy"
        referrerpolicy="no-referrer"
        draggable="false"
      >
      <div class="media-copy">
        <div class="media-meta"><h3>${title}</h3><span class="badge">Photo</span></div>
        <p>${description}</p>
      </div>
    </article>
  `;
}

async function loadViewerContent() {
  const container = document.getElementById("viewerContent");
  const heading = document.getElementById("viewerHeading");
  if (!container) return;

  try {
    const allContent = await fetchContent();
    const filtered = allContent.filter((item) => item.type === viewerTab);
    heading.textContent = viewerTab === "video" ? "Video folders" : "Photo folders";

    if (!filtered.length) {
      container.className = "folder-stack empty-state";
      container.textContent = `No ${viewerTab}s are available yet.`;
      return;
    }

    const grouped = groupByFolder(filtered);
    container.className = "folder-stack";
    container.innerHTML = Object.entries(grouped)
      .map(([folder, items]) => `
        <section class="folder-block">
          <div class="folder-head">
            <div>
              <h3>${escapeHtml(folder)}</h3>
              <p class="muted">${items.length} item${items.length === 1 ? "" : "s"}</p>
            </div>
            <span class="badge">${viewerTab}</span>
          </div>
          <div class="folder-grid">
            ${items.map(mediaCardTemplate).join("")}
          </div>
        </section>
      `)
      .join("");
  } catch (error) {
    container.className = "folder-stack empty-state";
    container.textContent = error.message || "Unable to load media.";
  }
}

function bindViewerTabs() {
  document.querySelectorAll(".tab-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      viewerTab = button.dataset.type;
      document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.toggle("active", btn === button));
      await loadViewerContent();
    });
  });
}

async function initIndexPage() {
  const logoutMessage = sessionStorage.getItem("logout_message");
  if (logoutMessage) {
    setMessage("authMessage", logoutMessage, "success");
    sessionStorage.removeItem("logout_message");
  }

  const loginForm = document.getElementById("loginForm");
  loginForm?.addEventListener("submit", login);

  try {
    const user = await getCurrentUser();
    if (user) {
      const role = await getRoleByEmail(user.email);

  if (!role) {
    await logout("Your account is authenticated but no role was found in users_role. Please ask the admin to add your email there.");
    return null;
  }
      window.location.href = role === "admin" ? "admin.html" : "dashboard.html";
    }
  } catch {
    // Stay on login page when session check fails.
  }
}

async function initAdminPage() {
  bindLogoutButton();
  installContentRestrictions();
  const session = await requireSession("admin");
  if (!session) return;

  document.getElementById("contentForm")?.addEventListener("submit", saveContent);
  document.getElementById("cancelEditBtn")?.addEventListener("click", resetForm);
  resetForm();
  await loadAdminContent();
}

async function initDashboardPage() {
  bindLogoutButton();
  installContentRestrictions();
  const session = await requireSession("user");
  if (!session) return;

  bindViewerTabs();
  await loadViewerContent();
}

(async function bootstrap() {
  const page = pageName();
  if (page === "index.html" || page === "") {
    await initIndexPage();
  } else if (page === "admin.html") {
    await initAdminPage();
  } else if (page === "dashboard.html") {
    await initDashboardPage();
  }
})();
