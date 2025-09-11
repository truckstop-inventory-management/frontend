// src/utils/sync.js
import { getAllItems, updateItem, deleteItem } from "./db";
import { fetchWithAuth } from "./fetchWithAuth";

// --- API base setup (safe) ---
const RAW_API_URL =
  (import.meta.env && import.meta.env.VITE_BACKEND_URL) || window.__API_URL__ || "";
const API_URL = (RAW_API_URL || "").replace(/\/+$/, ""); // strip trailing slashes
if (!API_URL) {
  console.warn("[SYNC] VITE_BACKEND_URL not set; defaulting to same-origin base ('').");
}

// --- Helper: ensure response is JSON ---
async function jsonIfPossible(res) {
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `[SYNC] HTTP ${res.status} ${res.statusText}; URL=${res.url}; BodyStart="${body.slice(
        0,
        120
      )}"`
    );
  }
  if (ct.includes("application/json")) return res.json();
  const text = await res.text();
  throw new Error(
    `[SYNC] Expected JSON but got "${ct}". URL=${res.url}; BodyStart="${text.slice(
      0,
      120
    )}"`
  );
}

// --- NEW: lightweight event bus to broadcast sync state to UI ---
export const syncBus = new EventTarget();

async function deleteOnServer(id) {
  try {
    const res = await fetchWithAuth(`${API_URL}/inventory/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
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
  // --- NEW: notify UI that sync has started
  try {
    syncBus.dispatchEvent(new CustomEvent("syncstart"));
  } catch (_) {
    // no-op if CustomEvent/EventTarget not available
  }

  try {
    // 1) Pull server inventory
    console.log("[SYNC] Fetching server inventory...");
    const serverResponse = await fetchWithAuth(`${API_URL}/api/inventory`);
    const serverItems = await jsonIfPossible(serverResponse);

    // 2) Snapshot local items
    let localItems = await getAllItems();

    // 3) Map server items by (itemName + location) and de-duplicate (keep newest)
    const serverMap = new Map();
    for (const srv of serverItems) {
      const k = `${srv.itemName}-${srv.location}`;
      const arr = serverMap.get(k) || [];
      arr.push(srv);
      serverMap.set(k, arr);
    }

    for (const [, list] of serverMap.entries()) {
      if (list.length > 1) {
        list.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
        const dups = list.slice(1); // first (newest) is implicitly kept
        for (const dup of dups) {
          console.log(
            `[SYNC] Removing duplicate on server "${dup.itemName}" at ${dup.location}`
          );
          try {
            await fetchWithAuth(`${API_URL}/inventory/${dup._id}`, {
              method: "DELETE",
            });
          } catch (err) {
            console.error("[SYNC] Failed to delete duplicate from server:", err);
          }
        }
      }
    }

    // 4) Pre-cleanup merge: add any server items missing locally,
    //    but do not resurrect things we soft-deleted locally.
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

    // 5) Push local deletions (tombstones): delete locally, then delete on server
    console.log("[SYNC] Local items before cleanup:", localItems);
    for (const it of localItems) {
      if (it.isDeleted) {
        await deleteItem(it._id);
        await deleteOnServer(it._id);
      }
    }
    // refresh snapshot after local deletions
    localItems = await getAllItems();

    // 6) Reconcile: if server no longer has an item that is locally 'synced', remove it locally
    const serverIds = new Set(serverItems.map((s) => s._id));
    for (const loc of await getAllItems()) {
      if (loc.syncStatus === "synced" && !serverIds.has(loc._id)) {
        await deleteItem(loc._id);
        console.log(`[SYNC] Removed local item ${loc._id} missing on server`);
      }
    }

    // 7) Push pending local items (create or update)
    for (const it of localItems) {
      if (it.syncStatus === "pending" && !it.isDeleted) {
        try {
          const res = await fetchWithAuth(`${API_URL}/inventory`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(it),
          });

          if (res.ok) {
            const saved = await res.json();
            console.log(`[SYNC] Pushed new item -> ${saved.itemName} (${saved._id})`);
            await updateItem({ ...saved, syncStatus: "synced", isDeleted: false });

            if (it._id && String(it._id).startsWith("local_")) {
              await deleteItem(it._id);
              console.log(
                `[SYNC] Removed stale local item ${it._id} after successful push`
              );
            }
          } else if (res.status === 409) {
            console.warn("[SYNC] Item exists, updating instead:", it.itemName);

            const k = `${it.itemName}-${it.location}`;
            const serverMatch = serverItems.find(
              (s) => `${s.itemName}-${s.location}` === k
            );

            if (serverMatch) {
              const updateRes = await fetchWithAuth(
                `${API_URL}/inventory/${serverMatch._id}`,
                {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(it),
                }
              );

              if (updateRes.ok) {
                const updated = await updateRes.json();
                console.log(
                  `[SYNC] Updated existing item -> ${updated.itemName} (${updated._id})`
                );
                await updateItem({
                  ...updated,
                  syncStatus: "synced",
                  isDeleted: false,
                });

                if (it._id && String(it._id).startsWith("local_")) {
                  await deleteItem(it._id);
                  console.log(
                    `[SYNC] Removed stale local item ${it._id} after conflict resolution`
                  );
                }
              } else {
                console.error(
                  "[SYNC] Failed to update after conflict",
                  await updateRes.text()
                );
              }
            } else {
              console.error(
                "[SYNC] Conflict detected but no matching server item found"
              );
            }
          } else {
            console.error(
              "[SYNC] Failed to push pending item",
              it,
              await res.text()
            );
          }
        } catch (err) {
          console.error("[SYNC] Error pushing pending item", it, err);
        }
      }
    }

    console.log("[SYNC] Local items after cleanup:", await getAllItems());
    console.log("[SYNC] Sync completed successfully");
  } catch (err) {
    console.error("[SYNC] Sync failed:", err);
  } finally {
    // --- NEW: notify UI that sync has ended (slight delay to avoid flicker)
    try {
      setTimeout(() => {
        syncBus.dispatchEvent(new CustomEvent("syncend"));
      }, 120);
    } catch (_) {
      // no-op
    }
  }
}
