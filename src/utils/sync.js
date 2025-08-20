import { getAllItems, updateItem, deleteItem } from "./db";

const API_URL = import.meta.env.VITE_API_URL;

async function deleteOnServer(id) {
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/inventory/${id}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.error(`[SYNC] Failed to delete on server id=${id}`);
    } else {
      console.log(`[SYNC] Confirmed delete on server id=${id}`);
    }
  } catch (err) {
    console.error(`[SYNC] Error deleting on server id=${id}`, err);
  }
}

export async function syncWithServer() {
  console.log("[SYNC] Starting sync...");

  try {
    // 1. Fetch server inventory
    console.log("[SYNC] Fetching server inventory...");
    const serverResponse = await fetch(`${API_URL}/inventory`, {
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
    });
    const serverItems = await serverResponse.json();

    // 2. Get local items
    const localItems = await getAllItems();

    // 3. Map server items by key (name + location)
    const serverMap = new Map();
    for (const item of serverItems) {
      const key = `${item.itemName}-${item.location}`;
      serverMap.set(key, [...(serverMap.get(key) || []), item]);
    }

    // 4. Deduplicate server items
    for (const [key, items] of serverMap.entries()) {
      if (items.length > 1) {
        items.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
        const [keep, ...dups] = items;

        for (const dup of dups) {
          console.log(
            `[SYNC] Removing duplicate on server "${dup.itemName}" at ${dup.location}`
          );
          try {
            await fetch(`${API_URL}/inventory/${dup._id}`, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
            });
          } catch (err) {
            console.error("[SYNC] Failed to delete duplicate from server:", err);
          }
        }
      }
    }

    // 5. Sync local with server
    for (const serverItem of serverItems) {
      const key = `${serverItem.itemName}-${serverItem.location}`;
      const localMatch = localItems.find(
        (i) => `${i.itemName}-${i.location}` === key
      );

      // 🚫 Skip if item exists locally and is marked deleted
      if (localMatch && localMatch.isDeleted) {
        console.log(
          `[SYNC] Skipping re-add of deleted item "${serverItem.itemName}" at ${serverItem.location}`
        );
        continue;
      }

      // ✅ Add missing server item into local if not found
      if (!localMatch) {
        await updateItem({
          ...serverItem,
          syncStatus: "synced",
          //isDeleted: false,
        });
        console.log("[IDB] updateItem =>", serverItem);
      }
    }

    console.log("[SYNC] Local items before cleanup:", localItems);
    for (const item of localItems) {
      if (item.isDeleted) {
        await deleteItem(item._id);
        await deleteOnServer(item._id);
        continue;
      }
    }

  // 6. Sync local with server (after cleanup, so deleted items don’t come back)
      for (const serverItem of serverItems) {
        const key = `${serverItem.itemName}-${serverItem.location}`;
        const localMatch = localItems.find(
          (i) => `${i.itemName}-${i.location}` === key
        );

        if (localMatch && localMatch.isDeleted) {
          console.log(
            `[SYNC] Skipping re-add of deleted item "${serverItem.itemName}" at ${serverItem.location}`
          );
          continue;
        }

        if (!localMatch) {
          await updateItem({
            ...serverItem,
            syncStatus: "synced",
            isDeleted: false,
          });
          console.log("[IDB] updateItem =>", serverItem);
        }
      }

    // 7. Push pending local items
    for (const item of localItems) {
      if (item.syncStatus === "pending" && !item.isDeleted) {
        try {
          const res = await fetch(`${API_URL}/inventory`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(item),
          });

          if (res.ok) {
            const saved = await res.json();
            console.log(
              `[SYNC] Pushed new item -> ${saved.itemName} (${saved._id})`
            );
            await updateItem({ ...saved, syncStatus: "synced", isDeleted: false });

            if (item._id && item._id.startsWith("local_")) {
              await deleteItem(item._id);
              console.log(`[SYNC] Removed stale local item ${item._id} after successful push`);
            }
          } else if (res.status === 409) {
            console.warn(
              "[SYNC] Item exists, updating instead:",
              item.itemName
            );

            // Find correct server item by key
            const key = `${item.itemName}-${item.location}`;
            const serverMatch = serverItems.find(
              (s) => `${s.itemName}-${s.location}` === key
            );

            if (serverMatch) {
              const updateRes = await fetch(`${API_URL}/inventory/${serverMatch._id}`, {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${localStorage.getItem("token")}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(item),
              });

              if (updateRes.ok) {
                const updated = await updateRes.json();
                console.log(
                  `[SYNC] Updated existing item -> ${updated.itemName} (${updated._id})`
                );
                await updateItem({ ...updated, syncStatus: "synced", isDeleted: false });

                // Remove stale local pending entry if it had a local_ id
                if (item._id && item._id.startsWith("local_")) {
                  await deleteItem(item._id);
                  console.log(`[SYNC] Removed stale local item ${item._id} after conflict resolution`);
                }

              } else {
                console.error("[SYNC] Failed to update after conflict", await updateRes.text());
              }
            } else {
              console.error(
                "[SYNC] Conflict detected but no matching server item found"
              );
            }

          } else {
            console.error(
              "[SYNC] Failed to push pending item",
              item,
              await res.text()
            );
          }
        } catch (err) {
          console.error("[SYNC] Error pushing pending item", item, err);
        }
      }
    }

    console.log("[SYNC] Local items after cleanup:", await getAllItems());
    console.log("[SYNC] Sync completed successfully");
  } catch (err) {
    console.error("[SYNC] Sync failed:", err);
  }
}