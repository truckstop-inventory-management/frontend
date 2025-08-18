// src/utils/sync.js
import {
  getAllItems,
  addItem,
  updateItem,
  // deleteItem, // ❌ removed unused
  markItemSynced, // ✅ now used
} from "./db";

export async function syncWithServer(token) {
  try {
    console.log("🔄 Starting sync with server...");

    const localItems = await getAllItems();
    console.log("📦 Local items:", localItems);

    const res = await fetch("https://backend-nlxq.onrender.com/api/inventory", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const serverItems = await res.json();
    console.log("🌐 Server items:", serverItems);

    // Push local changes
    for (const item of localItems) {
      if (item.syncStatus === "pending") {
        console.log("⬆️ Syncing pending item:", item);

        const tempId = item._id;
        const body = { ...item };
        delete body._id;
        delete body.syncStatus;

        let response;
        if (tempId.startsWith("local-")) {
          response = await fetch("https://backend-nlxq.onrender.com/api/inventory", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
          });
        } else {
          response = await fetch(
            `https://backend-nlxq.onrender.com/api/inventory/${tempId}`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(body),
            }
          );
        }

        if (response.ok) {
          const savedItem = await response.json();
          console.log("✅ Item synced successfully:", savedItem);

          // ✅ mark as synced in IndexedDB
          await markItemSynced(tempId, savedItem);
        } else {
          console.error("❌ Failed to sync item:", tempId, response.status);
        }
      }
    }

    // Pull latest from server
    for (const serverItem of serverItems) {
      if (!serverItem._id) {
        console.error("❌ Server item missing _id:", serverItem);
        continue;
      }

      const local = localItems.find((i) => i._id === serverItem._id);

      if (!local) {
        await addItem({ ...serverItem, syncStatus: "synced" });
        console.log(`[IDB] addItem -> _id=${serverItem._id}, syncStatus=synced`);
      } else if (
        serverItem.lastUpdated &&
        local.lastUpdated &&
        new Date(serverItem.lastUpdated) > new Date(local.lastUpdated)
      ) {
        await updateItem(serverItem._id, {
          _id: serverItem._id,
          itemName: serverItem.itemName,
          quantity: serverItem.quantity,
          price: serverItem.price,
          location: serverItem.location,
          lastUpdated: serverItem.lastUpdated,
          syncStatus: "synced",
        });
        console.log(`[IDB] updateItem -> _id=${serverItem._id}, syncStatus=synced`);
      }
    }

    console.log("✅ Sync completed successfully.");
  } catch (err) {
    console.error("⚠️ Sync failed:", err);
  }
}