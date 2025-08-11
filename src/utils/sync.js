// utils/sync.js
import axios from 'axios';
import {
  initDB,
  getAllItems,
  getPendingDeletedItems,
  addItem,
  updateItem,
  deleteItem,
  purgeDeletedSynced,
  markConflict,
} from './db';

const API_BASE = 'https://backend-nlxq.onrender.com/api/inventory';

// Ping the backend with a short timeout
async function backendReachable(headers) {
  try {
    await axios.get(API_BASE, { headers, timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

// Include lastUpdated for LWW
function toPayload(local) {
  const { itemName, quantity, price, location, lastUpdated } = local;
  return {
    itemName,
    quantity,
    price,
    location,
    lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : new Date().toISOString(),
  };
}

export async function runFullSync(token) {
  try {
    await initDB();

    if (!token) {
      console.warn('⚠️ No token — skipping sync.');
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    // ✅ Hard gate on real reachability
    const ok = await backendReachable(headers);
    if (!ok) {
      console.log('⏭️ Backend not reachable — skipping sync.');
      return;
    }

    // ===== Phase 0: Pull server IDs to detect "missing on server" =====
    let serverItems = [];
    try {
      const res = await axios.get(API_BASE, { headers });
      serverItems = res.data || [];
    } catch (err) {
      console.error('❌ Initial pull failed', err?.response?.data || err);
      // We can still continue with pushes
    }
    const serverIdSet = new Set(serverItems.map(it => it._id));

    // Any local active item that is "synced" but missing on server -> mark pending
    let all = await getAllItems();
    for (const local of all) {
      if (!local.isDeleted && local.syncStatus === 'synced' && !serverIdSet.has(local._id)) {
        await updateItem({ ...local, syncStatus: 'pending' });
      }
    }

    // Re-read all after potential re-marking
    all = await getAllItems();

    // ===== Phase 1: Push creates/updates (pending & not deleted) =====
    const pendings = all.filter(it => it.syncStatus === 'pending' && !it.isDeleted);
    for (const local of pendings) {
      const payload = toPayload(local);
      const isTemp = String(local._id || '').startsWith('temp-');

      try {
        if (isTemp) {
          // Create on server
          const res = await axios.post(API_BASE, payload, { headers });
          const serverItem = res.data;

          // Replace temp with server version
          await deleteItem(local._id);
          await addItem({ ...serverItem, isDeleted: false, syncStatus: 'synced', conflictServer: null });
          console.log(`✅ Created on server & replaced temp id: ${local._id} → ${serverItem._id}`);
        } else {
          // Update existing on server (LWW)
          try {
            await axios.put(`${API_BASE}/${local._id}`, payload, { headers });
            // Server accepted -> mark synced
            await updateItem({ ...local, syncStatus: 'synced', conflictServer: null });
            console.log(`✅ Updated on server: ${local._id}`);
          } catch (e) {
            const status = e?.response?.status;
            if (status === 404) {
              // Server doesn't have this id anymore -> POST then swap local id
              const res = await axios.post(API_BASE, payload, { headers });
              const serverItem = res.data;
              await deleteItem(local._id);
              await addItem({ ...serverItem, isDeleted: false, syncStatus: 'synced', conflictServer: null });
              console.log(`↩️ Upserted missing item via POST and replaced id: ${local._id} → ${serverItem._id}`);
            } else if (status === 409 && e?.response?.data?.server) {
              // Conflict -> store server copy + mark conflict
              const serverCopy = e.response.data.server;
              await markConflict(local._id, serverCopy);
              console.warn(`⚠️ Conflict on ${local._id} — marked 'conflict' with server copy.`);
            } else {
              throw e;
            }
          }
        }
      } catch (err) {
        console.error(`❌ Failed to push create/update for ${local._id}`, err?.response?.data || err);
      }
    }

    // ===== Phase 2: Push deletes (tombstones) =====
    const tombstones = await getPendingDeletedItems();
    for (const local of tombstones) {
      try {
        await axios.delete(`${API_BASE}/${local._id}`, { headers });
      } catch (e) {
        if (e?.response?.status !== 404) throw e; // 404 means already gone
      }
      await updateItem({ ...local, syncStatus: 'synced' });
      console.log(`🗑️ Deleted on server (tombstone synced): ${local._id}`);
    }

    // ===== Phase 3: Pull server items and upsert (avoid overwriting pending/conflict) =====
    try {
      const res = await axios.get(API_BASE, { headers });
      const latestServerItems = res.data || [];
      // Refresh 'all' to see current local states
      all = await getAllItems();

      for (const item of latestServerItems) {
        const existing = all.find(x => x._id === item._id);
        if (existing && (existing.syncStatus === 'pending' || existing.syncStatus === 'conflict')) {
          // Skip overwrite; user needs to resolve or we’ll push later
          continue;
        }
        const maybeExisting = await addItem({ ...item, isDeleted: false, syncStatus: 'synced', conflictServer: null });
        if (maybeExisting._id === item._id && !['pending', 'conflict'].includes(maybeExisting.syncStatus)) {
          await updateItem({ ...item, isDeleted: false, syncStatus: 'synced', conflictServer: null });
        }
      }
    } catch (err) {
      console.error('❌ Failed to pull server items', err?.response?.data || err);
    }

    // ===== Phase 4: Purge synced tombstones =====
    try {
      await purgeDeletedSynced();
    } catch (err) {
      console.warn('⚠️ Purge of synced tombstones failed (non-critical)', err);
    }

    console.log('✅ Full sync completed.');
  } catch (err) {
    console.error('❌ Sync failed (non-fatal):', err?.response?.data || err);
  }
}