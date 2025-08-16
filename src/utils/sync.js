import { getAllItems, updateItem } from "./db.js";
console.log("🔧 VITE_BACKEND_URL =", import.meta.env.VITE_BACKEND_URL);
export async function runFullSync(token) {
  console.log("🔄 Running full sync with backend…");

  try {
    // Step 1: Get all local items
    const localItems = await getAllItems();

    // Step 2: Push local changes to backend
    const pendingChanges = localItems.filter(
      (item) => item.syncStatus !== "synced"
    );

    console.log(`📤 Found ${pendingChanges.length} local changes to push`);

    for (const localItem of pendingChanges) {
      try {
        if (localItem.isDeleted) {
          // DELETE
          const res = await fetch(
            `${import.meta.env.VITE_BACKEND_URL}/api/inventory/${localItem._id}`,
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (res.ok) {
            console.log(`🗑️ Deleted on server: ${localItem._id}`);
            await updateItem({ ...localItem, syncStatus: "synced" });
          }
        } else {
          // UPSERT
          const res = await fetch(
            `${import.meta.env.VITE_BACKEND_URL}/api/inventory/${localItem._id}`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(localItem),
            }
          );

          if (res.ok) {
            const serverItem = await res.json();
            console.log(`✅ Updated on server: ${localItem._id}`);
            await updateItem({
              ...serverItem,
              syncStatus: "synced",
              isDeleted: false,
            });
          } else if (res.status === 409) {
            // Conflict: mark conflict instead of overwriting
            const conflict = await res.json();
            console.warn("⚠️ Conflict detected:", conflict);

            await updateItem({
              ...localItem,
              syncStatus: "conflict",
              conflictServer: conflict.server,
            });
          }
        }
      } catch (err) {
        console.error("❌ Error pushing change:", err);
      }
    }

    // Step 3: Pull from server (authoritative copy)
    const res = await fetch(
      `${import.meta.env.VITE_BACKEND_URL}/api/inventory`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (res.ok) {
      const serverItems = await res.json();
      console.log(`📥 Pulled ${serverItems.length} items from server`);

      for (const serverItem of serverItems) {
        await updateItem({
          ...serverItem,
          syncStatus: "synced",
          isDeleted: false,
        });
      }
    }

    console.log("✅ Sync completed");
  } catch (err) {
    console.error("❌ Full sync error:", err);
  }
}