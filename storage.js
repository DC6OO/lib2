const SUPABASE_URL = "https://mwulewothbgkhhazfrtq.supabase.co";
const SUPABASE_KEY = "sb_publishable_TEH_6lJ1_7j6JTX8T9mfCg_bF6aPZA-";
const BUCKET = "library-files";

let client = null;

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

async function getFiles(library, year) {
  const { data, error } = await getClient()
    .from("documents")
    .select("id, name, type, storage_path")
    .eq("library", library)
    .eq("year", String(year))
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    url: publicUrl(row.storage_path)
  }));
}

async function saveFile(library, year, file) {
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

window.getFiles = getFiles;
window.saveFile = saveFile;
window.deleteFile = deleteFile;
