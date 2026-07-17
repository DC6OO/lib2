const SUPABASE_URL = "https://mwulewothbgkhhazfrtq.supabase.co";
const SUPABASE_KEY = "sb_publishable_TEH_6lJ1_7j6JTX8T9mfCg_bF6aPZA-";
const BUCKET = "library-files";

// Change this password to whatever you want for admin access
const ADMIN_PASSWORD = "DrDOOM!!";
const ADMIN_STORAGE_KEY = "libraryAdmin";

let client = null;
let adminLoggedIn = false;

function getClient() {
  if (client) return client;

  const lib = window.supabase;
  if (!lib || typeof lib.createClient !== "function") {
    throw new Error(
      "Supabase library failed to load. Check your internet connection and refresh the page."
    );
  }

  client = lib.createClient(SUPABASE_URL, SUPABASE_KEY);
  return client;
}

function publicUrl(path) {
  const { data } = getClient().storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function refreshAdminState() {
  adminLoggedIn = sessionStorage.getItem(ADMIN_STORAGE_KEY) === "1";
  return adminLoggedIn;
}

function isAdmin() {
  return adminLoggedIn;
}

async function adminLogin(password) {
  if (password !== ADMIN_PASSWORD) {
    throw new Error("Incorrect password.");
  }
  sessionStorage.setItem(ADMIN_STORAGE_KEY, "1");
  adminLoggedIn = true;
  return true;
}

async function adminLogout() {
  sessionStorage.removeItem(ADMIN_STORAGE_KEY);
  adminLoggedIn = false;
}

async function getFiles(library, year, query) {
  let request = getClient()
    .from("documents")
    .select("id, name, type, storage_path")
    .eq("library", library)
    .eq("year", String(year))
    .order("created_at", { ascending: false });

  const term = (query || "").trim();
  if (term) {
    const safe = term.replace(/[%_\\]/g, "\\$&");
    request = request.ilike("name", `%${safe}%`);
  }

  const { data, error } = await request;

  if (error) throw new Error(error.message);

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    url: publicUrl(row.storage_path)
  }));
}

async function saveFile(library, year, file) {
  await refreshAdminState();
  if (!isAdmin()) {
    throw new Error("Admin login required to add documents.");
  }

  const supabase = getClient();
  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^\w.\-()+ ]/g, "_");
  const storagePath = `${library}/year-${year}/${id}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false
    });

  if (uploadError) throw new Error(uploadError.message);

  const { error: insertError } = await supabase.from("documents").insert({
    id,
    name: file.name,
    type: file.type || "Document File",
    library,
    year: String(year),
    storage_path: storagePath
  });

  if (insertError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error(insertError.message);
  }

  return { id, name: file.name, type: file.type, url: publicUrl(storagePath) };
}

async function deleteFile(id) {
  await refreshAdminState();
  if (!isAdmin()) {
    throw new Error("Admin login required to delete files.");
  }

  const supabase = getClient();

  const { data: row, error: fetchError } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([row.storage_path]);

  if (storageError) throw new Error(storageError.message);

  const { error: deleteError } = await supabase
    .from("documents")
    .delete()
    .eq("id", id);

  if (deleteError) throw new Error(deleteError.message);
}

async function getChatMessages(limit) {
  const { data, error } = await getClient()
    .from("chat_messages")
    .select("id, nickname, body, created_at, votes, author_key")
    .order("votes", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit || 100);

  if (error) throw new Error(error.message);
  return data || [];
}

async function sendChatMessage(nickname, body) {
  const name = (nickname || "").trim().slice(0, 40);
  const text = (body || "").trim().slice(0, 500);
  const authorKey = getChatVoterKey();

  if (!name) throw new Error("Enter a display name.");
  if (!text) throw new Error("Message cannot be empty.");
  if (!authorKey || authorKey.length < 8) {
    throw new Error("Could not create a chat identity. Try refreshing the page.");
  }

  const payload = {
    nickname: name,
    body: text,
    votes: 0,
    author_key: authorKey
  };

  let result = await getClient()
    .from("chat_messages")
    .insert(payload)
    .select("id, nickname, body, created_at, votes, author_key")
    .single();

  // Fallback if author_key column is missing on an older database
  if (result.error && /author_key/i.test(result.error.message)) {
    result = await getClient()
      .from("chat_messages")
      .insert({ nickname: name, body: text, votes: 0 })
      .select("id, nickname, body, created_at, votes")
      .single();
  }

  if (result.error) throw new Error(result.error.message);
  return result.data;
}

function getChatVoterKey() {
  const keyName = "libraryChatVoterKey";
  let key = localStorage.getItem(keyName);
  if (!key) {
    key =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `voter-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(keyName, key);
  }
  return key;
}

async function upvoteChatMessage(messageId) {
  const { data, error } = await getClient().rpc("upvote_chat_message", {
    p_message_id: messageId,
    p_voter_key: getChatVoterKey()
  });

  if (error) throw new Error(error.message);
  return data;
}

async function cleanupLowVoteChat() {
  const { data, error } = await getClient().rpc("cleanup_low_vote_chat");
  if (error) throw new Error(error.message);
  return data;
}

async function deleteChatMessage(id) {
  await refreshAdminState();
  if (!isAdmin()) {
    throw new Error("Admin login required to delete messages.");
  }

  const { error } = await getClient()
    .from("chat_messages")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}

function subscribeChat(onInsert, onUpdate) {
  return getClient()
    .channel("community-chat")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages" },
      (payload) => {
        if (payload.new && onInsert) onInsert(payload.new);
      }
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "chat_messages" },
      (payload) => {
        if (payload.new && onUpdate) onUpdate(payload.new);
      }
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "chat_messages" },
      (payload) => {
        if (payload.old && onUpdate) onUpdate({ ...payload.old, _deleted: true });
      }
    )
    .subscribe();
}

window.getClient = getClient;
window.getFiles = getFiles;
window.saveFile = saveFile;
window.deleteFile = deleteFile;
window.refreshAdminState = refreshAdminState;
window.isAdmin = isAdmin;
window.adminLogin = adminLogin;
window.adminLogout = adminLogout;
window.getChatMessages = getChatMessages;
window.sendChatMessage = sendChatMessage;
window.upvoteChatMessage = upvoteChatMessage;
window.cleanupLowVoteChat = cleanupLowVoteChat;
window.deleteChatMessage = deleteChatMessage;
window.subscribeChat = subscribeChat;
window.getChatVoterKey = getChatVoterKey;

function formatFileType(type, name) {
  const mime = (type || "").toLowerCase();
  const lowerName = (name || "").toLowerCase();

  if (mime.includes("pdf") || lowerName.endsWith(".pdf")) return "PDF";
  if (
    mime.includes("word") ||
    mime.includes("officedocument.wordprocessing") ||
    lowerName.endsWith(".doc") ||
    lowerName.endsWith(".docx")
  ) {
    return "Word";
  }
  if (
    mime.includes("powerpoint") ||
    mime.includes("presentation") ||
    lowerName.endsWith(".ppt") ||
    lowerName.endsWith(".pptx")
  ) {
    return "PowerPoint";
  }
  if (mime.startsWith("image/")) return "Image";
  if (mime) return mime.split("/").pop().toUpperCase();
  return "Document File";
}

window.formatFileType = formatFileType;
