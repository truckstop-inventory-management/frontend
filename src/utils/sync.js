import axios from "axios";
import {
  getAllItems,
  updateItem,
  deleteItem,
  remapLocalId,
  markConflict,
} from "./db";

const API_URL =
  import.meta.env.VITE_BACKEND_URL || "https://backend-nlxq.onrender.com/api";

// === Full sync ===
export async function runFullSync(token) {
  if (!token) throw new Error("Missing auth token for sync");

  console.log("🔄 Running full sync with backend…");

  // Phase 1: Push local pending changes
  const all = await getAllItems();
  const pendings = all.filter(
    (it) => it.syncStatus === "pending" || it.syncStatus === "conflict"
  );
  console.log(`📤 Found ${pendings.length} local changes to push`);

  for (const local of pendings) {
    try {
      if (local.isDeleted) {
        if (local._id.startsWith("local-")) {
          await deleteItem(local._id);
          console.log(`🗑️ Deleted unsynced local item ${local._id}`);
          continue;
        }
        const resp = await axios.delete(`${API_URL}/inventory/${local._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.status === 200) {
          await deleteItem(local._id);
          console.log(`🗑️ Deleted remote + local item ${local._id}`);
        }
      } else if (local._id.startsWith("local-")) {
        // Create new server record
        const { _id, ...rest } = local;
        const resp = await axios.post(`${API_URL}/inventory`, rest, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.status === 201) {
          const serverCopy = resp.data;
          await remapLocalId(local._id, {
            ...serverCopy,
            syncStatus: "synced",
            conflictServer: null,
          });
          console.log(`✅ Created server item for ${local._id} → ${serverCopy._id}`);
        }
      } else {
        // Update server record
        const resp = await axios.put(
          `${API_URL}/inventory/${local._id}`,
          local,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (resp.status === 200) {
          const serverCopy = resp.data;
          await updateItem({
            ...serverCopy,
            syncStatus: "synced",
            conflictServer: null,
          });
          console.log(`✅ Updated server item ${local._id}`);
        }
      }
    } catch (e) {
      const status = e?.response?.status;
      if (status === 409 && e?.response?.data?.server) {
        const serverCopy = e.response.data.server;
        await markConflict(local._id, serverCopy);
        console.warn(
          `⚠️ Conflict on ${local._id} — marked 'conflict' with server copy.`
        );
      } else {
        console.error(`❌ Sync push failed for ${local._id}:`, e.message);
      }
    }
  }

  // Phase 2: Fetch latest server copy
  let latestServerItems = [];
  try {
    const resp = await axios.get(`${API_URL}/inventory`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    latestServerItems = resp.data || [];
    console.log(`📥 Pulled ${latestServerItems.length} items from server`);
  } catch (e) {
    console.error("❌ Failed to pull server items:", e.message);
  }

  // Phase 3: Merge server → local
  for (const item of latestServerItems) {
    const existing = all.find((x) => x._id === item._id);

    // ✅ Do not overwrite conflict or pending items
    if (existing && existing.syncStatus === "conflict") {
      console.log(
        `⏭️ Skipping server overwrite for ${item._id} (local is in conflict)`
      );
      continue;
    }
    if (existing && existing.syncStatus === "pending") {
      console.log(
        `⏭️ Skipping server overwrite for ${item._id} (local is pending)`
      );
      continue;
    }

    await updateItem({
      ...item,
      isDeleted: false,
      syncStatus: "synced",
      conflictServer: null,
    });
  }

  console.log("✅ Sync completed");
}