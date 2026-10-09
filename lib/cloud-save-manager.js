/**
 * Cloud Save Manager - Syncs all game saves to user account via Supabase
 * Provides automatic save/load of game data to cloud storage
 *
 * Safety rules (so progress can move between devices without being lost):
 *  - GameHub's own keys ("gamehub-", "sb-") and its local backup copies
 *    ("game-save-") are never included in a game's snapshot. Including the
 *    backup copies made every save contain the previous save, which grew
 *    without limit and filled the browser's storage quota.
 *  - A game's cloud save is only overwritten after this browser has checked
 *    the cloud copy for the signed-in user. That stops a fresh game on a new
 *    device from replacing real progress before it has been downloaded.
 *  - On login, local backups are only uploaded for games that have no cloud
 *    save yet.
 */
const GAMEHUB_LOCAL_SAVE_PREFIX = 'game-save-';

function isSyncableStorageKey(key) {
  return Boolean(key) &&
    !key.startsWith('gamehub-') &&
    !key.startsWith('sb-') &&
    !key.startsWith(GAMEHUB_LOCAL_SAVE_PREFIX);
}

function cleanStorageSnapshot(storage) {
  if (!storage || typeof storage !== 'object') return storage;
  const clean = {};
  for (const [key, value] of Object.entries(storage)) {
    if (isSyncableStorageKey(key) && typeof value === 'string') clean[key] = value;
  }
  return clean;
}

function cleanGameState(gameState) {
  if (gameState && gameState.type === 'localStorage' && gameState.storage) {
    return { ...gameState, storage: cleanStorageSnapshot(gameState.storage) };
  }
  return gameState;
}

class CloudSaveManager {
  constructor(supabaseClient) {
    this.supabaseClient = supabaseClient;
    this.currentUser = null;
    this.syncEnabled = false;
    this.localCache = new Map();
    this.pendingSaves = new Map();
    // Games whose cloud save has been checked for the current user.
    this.cloudChecked = new Set();
    this.cleanLocalBackups();
    this.ready = this.initializeSync();
  }

  /**
   * Remove nested backup copies left by older versions of this file.
   */
  cleanLocalBackups() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(GAMEHUB_LOCAL_SAVE_PREFIX)) keys.push(key);
      }
      for (const key of keys) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        let data;
        try { data = JSON.parse(raw); } catch (_) { continue; }
        const storage = data && data.gameState && data.gameState.storage;
        if (!storage || typeof storage !== 'object') continue;
        const hasNested = Object.keys(storage).some((k) => !isSyncableStorageKey(k));
        if (!hasNested) continue;
        data.gameState = cleanGameState(data.gameState);
        localStorage.removeItem(key);
        try {
          localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
          console.warn('[CloudSaveManager] Could not rewrite local backup:', key, error);
        }
      }
    } catch (error) {
      console.warn('[CloudSaveManager] Local backup cleanup failed:', error);
    }
  }

  setUser(user) {
    const previousId = this.currentUser ? this.currentUser.id : null;
    const nextId = user ? user.id : null;
    this.currentUser = user || null;
    this.syncEnabled = Boolean(user);
    if (previousId !== nextId) this.cloudChecked.clear();
    return previousId !== nextId;
  }

  /**
   * Initialize sync by checking auth status
   */
  async initializeSync() {
    try {
      const { data } = await this.supabaseClient.auth.getSession();
      if (data.session) {
        this.setUser(data.session.user);
        console.log('[CloudSaveManager] Sync enabled for user:', this.currentUser.email);
        await this.syncLocalToCloud();
      }
    } catch (error) {
      console.error('[CloudSaveManager] Failed to initialize sync:', error);
    }

    // Listen for auth changes
    this.supabaseClient.auth.onAuthStateChange((event, session) => {
      const changed = this.setUser(session ? session.user : null);
      if (!changed) return;
      if (session) {
        console.log('[CloudSaveManager] User logged in:', this.currentUser.email);
        // Run outside the auth callback so Supabase is not blocked.
        setTimeout(() => this.syncLocalToCloud(), 0);
      } else {
        console.log('[CloudSaveManager] User logged out - using local storage only');
      }
    });
  }

  /**
   * Save game to cloud (or local if not authenticated)
   * @param {string} gameId - Unique game identifier
   * @param {string} slotName - Save slot name
   * @param {Object} gameState - The game state to save
   */
  async saveGame(gameId, slotName, gameState) {
    try {
      // Never race the first autosave against Supabase session detection.
      if (this.ready) await this.ready;
      const saveData = {
        timestamp: new Date().toISOString(),
        gameState: cleanGameState(gameState),
        slotName: slotName,
        gameId: gameId
      };

      if (this.syncEnabled && this.currentUser) {
        if (this.cloudChecked.has(gameId)) {
          await this.saveToCloud(gameId, slotName, saveData);
        } else {
          console.log(`[CloudSaveManager] Cloud save for ${gameId} not loaded yet - keeping this save local`);
        }
      }

      // Always save locally as backup
      this.saveLocal(gameId, slotName, saveData);

      console.log(`[CloudSaveManager] Game saved: ${gameId}/${slotName}`);
      return true;
    } catch (error) {
      console.error('[CloudSaveManager] Failed to save game:', error);
      return false;
    }
  }

  /**
   * Load game from cloud or local storage
   * @param {string} gameId - Unique game identifier
   * @param {string} slotName - Save slot name
   */
  async loadGame(gameId, slotName) {
    try {
      if (this.ready) await this.ready;
      let saveData = null;

      if (this.syncEnabled && this.currentUser) {
        // Try to load from cloud first
        const result = await this.fetchFromCloud(gameId, slotName);
        if (result.ok) {
          this.cloudChecked.add(gameId);
          saveData = result.data;
        }
      }

      // Fall back to local storage
      if (!saveData) {
        saveData = this.loadLocal(gameId, slotName);
      }

      if (saveData) {
        console.log(`[CloudSaveManager] Game loaded: ${gameId}/${slotName}`);
        return cleanGameState(saveData.gameState);
      }

      console.log(`[CloudSaveManager] No save found: ${gameId}/${slotName}`);
      return null;
    } catch (error) {
      console.error('[CloudSaveManager] Failed to load game:', error);
      return null;
    }
  }

  /**
   * Get all saves for a specific game
   * @param {string} gameId - Unique game identifier
   */
  async getSavesForGame(gameId) {
    try {
      const saves = [];

      if (this.syncEnabled && this.currentUser) {
        const cloudSaves = await this.getCloudSaves(gameId);
        saves.push(...cloudSaves);
      }

      // Also include local-only saves
      const localSaves = this.getLocalSaves(gameId);

      // Merge, preferring cloud versions
      const merged = new Map();
      localSaves.forEach(s => merged.set(s.slotName, s));
      saves.forEach(s => merged.set(s.slotName, s));

      return Array.from(merged.values()).sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
      );
    } catch (error) {
      console.error('[CloudSaveManager] Failed to get saves:', error);
      return [];
    }
  }

  /**
   * Delete a save from cloud and local
   * @param {string} gameId - Unique game identifier
   * @param {string} slotName - Save slot name
   */
  async deleteSave(gameId, slotName) {
    try {
      if (this.syncEnabled && this.currentUser) {
        await this.deleteFromCloud(gameId, slotName);
      }

      this.deleteLocal(gameId, slotName);
      console.log(`[CloudSaveManager] Save deleted: ${gameId}/${slotName}`);
      return true;
    } catch (error) {
      console.error('[CloudSaveManager] Failed to delete save:', error);
      return false;
    }
  }

  /**
   * Upload local saves for games that have no cloud save yet.
   * Existing cloud saves are never replaced here, because a local backup
   * may be older than progress made on another device.
   */
  async syncLocalToCloud() {
    if (!this.syncEnabled || !this.currentUser) {
      console.log('[CloudSaveManager] Sync skipped - not authenticated');
      return;
    }

    try {
      console.log('[CloudSaveManager] Syncing local saves to cloud...');
      const userId = this.currentUser.id;

      const { data: cloudRows, error } = await this.supabaseClient
        .from('game_saves')
        .select('game_id,slot_name')
        .eq('user_id', userId);
      if (error) throw error;
      if (!this.currentUser || this.currentUser.id !== userId) return;

      const existing = new Set((cloudRows || []).map(r => `${r.game_id}/${r.slot_name}`));

      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(GAMEHUB_LOCAL_SAVE_PREFIX)) keys.push(key);
      }

      for (const key of keys) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        let saveData;
        try { saveData = JSON.parse(raw); } catch (_) { continue; }
        const gameId = saveData && saveData.gameId;
        const slotName = (saveData && saveData.slotName) || 'autosave';
        if (!gameId || existing.has(`${gameId}/${slotName}`)) continue;
        saveData.gameState = cleanGameState(saveData.gameState);
        await this.saveToCloud(gameId, slotName, saveData);
      }

      console.log('[CloudSaveManager] Sync complete');
    } catch (error) {
      console.error('[CloudSaveManager] Sync failed:', error);
    }
  }

  /**
   * Manually sync cloud saves to local
   */
  async syncCloudToLocal() {
    if (!this.syncEnabled || !this.currentUser) {
      console.log('[CloudSaveManager] Sync skipped - not authenticated');
      return;
    }

    try {
      console.log('[CloudSaveManager] Syncing cloud saves to local...');

      const { data, error } = await this.supabaseClient
        .from('game_saves')
        .select('*')
        .eq('user_id', this.currentUser.id);

      if (error) throw error;

      data.forEach(save => {
        this.saveLocal(save.game_id, save.slot_name, {
          timestamp: save.updated_at || save.created_at,
          gameState: cleanGameState(save.game_state),
          slotName: save.slot_name,
          gameId: save.game_id
        });
      });

      console.log('[CloudSaveManager] Sync complete');
    } catch (error) {
      console.error('[CloudSaveManager] Sync failed:', error);
    }
  }

  // ===== CLOUD OPERATIONS =====

  async saveToCloud(gameId, slotName, saveData) {
    try {
      const userId = this.currentUser.id;
      const key = `${gameId}/${slotName}`;
      const previous = this.pendingSaves.get(key) || Promise.resolve();
      const operation = previous.catch(() => {}).then(async () => {
        const { error } = await this.supabaseClient
          .from('game_saves')
          .upsert({
            user_id: userId,
            game_id: gameId,
            slot_name: slotName,
            game_state: cleanGameState(saveData.gameState),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,game_id,slot_name'
          });

        if (error) throw error;
      });
      this.pendingSaves.set(key, operation);
      try {
        await operation;
      } finally {
        if (this.pendingSaves.get(key) === operation) this.pendingSaves.delete(key);
      }
    } catch (error) {
      console.error('[CloudSaveManager] Cloud save failed:', error);
      throw error;
    }
  }

  /**
   * Returns { ok: true, data } when the cloud was reached (data may be null
   * if there is no save yet), or { ok: false } on a network/server error.
   */
  async fetchFromCloud(gameId, slotName) {
    try {
      const { data, error } = await this.supabaseClient
        .from('game_saves')
        .select('*')
        .eq('user_id', this.currentUser.id)
        .eq('game_id', gameId)
        .eq('slot_name', slotName)
        .maybeSingle();

      if (error) throw error;

      return {
        ok: true,
        data: data ? {
          timestamp: data.updated_at || data.created_at,
          gameState: data.game_state,
          slotName: data.slot_name,
          gameId: data.game_id
        } : null
      };
    } catch (error) {
      console.error('[CloudSaveManager] Cloud load failed:', error);
      return { ok: false, data: null };
    }
  }

  async loadFromCloud(gameId, slotName) {
    const result = await this.fetchFromCloud(gameId, slotName);
    return result.data;
  }

  async getCloudSaves(gameId) {
    try {
      const { data, error } = await this.supabaseClient
        .from('game_saves')
        .select('slot_name,created_at,updated_at')
        .eq('user_id', this.currentUser.id)
        .eq('game_id', gameId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return data.map(save => ({
        slotName: save.slot_name,
        timestamp: save.updated_at || save.created_at,
        formattedDate: new Date(save.updated_at || save.created_at).toLocaleString(),
        location: 'cloud'
      }));
    } catch (error) {
      console.error('[CloudSaveManager] Failed to get cloud saves:', error);
      return [];
    }
  }

  async deleteFromCloud(gameId, slotName) {
    try {
      const { error } = await this.supabaseClient
        .from('game_saves')
        .delete()
        .eq('user_id', this.currentUser.id)
        .eq('game_id', gameId)
        .eq('slot_name', slotName);

      if (error) throw error;
    } catch (error) {
      console.error('[CloudSaveManager] Failed to delete from cloud:', error);
      throw error;
    }
  }

  // ===== LOCAL OPERATIONS =====

  saveLocal(gameId, slotName, saveData) {
    const key = `${GAMEHUB_LOCAL_SAVE_PREFIX}${gameId}-${slotName}`;
    const value = JSON.stringify({ ...saveData, gameState: cleanGameState(saveData.gameState) });
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      // Free the old copy first in case it is what fills the quota.
      try {
        localStorage.removeItem(key);
        localStorage.setItem(key, value);
      } catch (retryError) {
        console.error('[CloudSaveManager] Local save failed:', retryError);
      }
    }
  }

  loadLocal(gameId, slotName) {
    try {
      const key = `${GAMEHUB_LOCAL_SAVE_PREFIX}${gameId}-${slotName}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[CloudSaveManager] Local load failed:', error);
      return null;
    }
  }

  getLocalSaves(gameId) {
    const saves = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${GAMEHUB_LOCAL_SAVE_PREFIX}${gameId}-`)) {
          const data = localStorage.getItem(key);
          if (data) {
            const saveData = JSON.parse(data);
            saves.push({
              slotName: saveData.slotName,
              timestamp: saveData.timestamp,
              formattedDate: new Date(saveData.timestamp).toLocaleString(),
              location: 'local'
            });
          }
        }
      }
    } catch (error) {
      console.error('[CloudSaveManager] Failed to get local saves:', error);
    }
    return saves;
  }

  deleteLocal(gameId, slotName) {
    try {
      const key = `${GAMEHUB_LOCAL_SAVE_PREFIX}${gameId}-${slotName}`;
      localStorage.removeItem(key);
    } catch (error) {
      console.error('[CloudSaveManager] Local delete failed:', error);
    }
  }

  /**
   * Get current auth status
   */
  getAuthStatus() {
    return {
      isAuthenticated: this.syncEnabled && this.currentUser !== null,
      user: this.currentUser,
      syncEnabled: this.syncEnabled
    };
  }
}


// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CloudSaveManager;
}

/**
 * Save a game's browser storage as its single autosave.
 * GameHub-owned keys and GameHub's local backup copies are excluded.
 */
CloudSaveManager.prototype.saveStorageSnapshot = async function(gameId, storage = window.localStorage) {
  try {
    if (this.ready) await this.ready;
    const snapshot = {};
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!isSyncableStorageKey(key)) continue;
      const value = storage.getItem(key);
      if (value !== null) snapshot[key] = value;
    }
    if (!Object.keys(snapshot).length) return false;
    return await this.saveGame(gameId, "autosave", {
      version: 1,
      type: "localStorage",
      savedAt: new Date().toISOString(),
      storage: snapshot
    });
  } catch (error) {
    console.error("[CloudSaveManager] Storage snapshot failed:", error);
    return false;
  }
};

CloudSaveManager.prototype.restoreStorageSnapshot = async function(gameId, storage = window.localStorage) {
  try {
    if (this.ready) await this.ready;
    const state = await this.loadGame(gameId, "autosave");
    const snapshot = state && cleanStorageSnapshot(state.storage);
    if (!snapshot || typeof snapshot !== "object") return false;
    let failed = 0;
    for (const [key, value] of Object.entries(snapshot)) {
      try {
        storage.setItem(key, value);
      } catch (error) {
        failed++;
        console.warn("[CloudSaveManager] Could not restore key:", key, error);
      }
    }
    console.log("[CloudSaveManager] Restored autosave:", gameId, failed ? `(${failed} keys failed)` : "");
    return true;
  } catch (error) {
    console.error("[CloudSaveManager] Storage restore failed:", error);
    return false;
  }
};

CloudSaveManager.isSyncableStorageKey = isSyncableStorageKey;

// Create the shared instance used by GameHub and game integrations.
if (typeof window !== "undefined" && window.supabase?.createClient && !window.gameHubCloudSaves) {
  try {
    window.gameHubCloudSaves = new CloudSaveManager(
      window.supabase.createClient(
        "https://fcaurruifyeoofapuqcs.supabase.co",
        "sb_publishable_njYaCOufPHLjbkxo3brV0Q_eD6m6RLW"
      )
    );
  } catch (error) {
    console.error("[CloudSaveManager] Could not create shared instance:", error);
  }
}
