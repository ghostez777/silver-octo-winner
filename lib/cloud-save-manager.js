/**
 * Cloud Save Manager - Syncs all game saves to user account via Supabase
 * Provides automatic save/load of game data to cloud storage
 */
class CloudSaveManager {
  constructor(supabaseClient) {
    this.supabaseClient = supabaseClient;
    this.currentUser = null;
    this.syncEnabled = false;
    this.localCache = new Map();
    this.initializeSync();
  }

  /**
   * Initialize sync by checking auth status
   */
  async initializeSync() {
    try {
      const { data } = await this.supabaseClient.auth.getSession();
      if (data.session) {
        this.currentUser = data.session.user;
        this.syncEnabled = true;
        console.log('[CloudSaveManager] Sync enabled for user:', this.currentUser.email);
        // Sync local saves to cloud on startup
        await this.syncLocalToCloud();
      }
    } catch (error) {
      console.error('[CloudSaveManager] Failed to initialize sync:', error);
    }

    // Listen for auth changes
    this.supabaseClient.auth.onAuthStateChange((event, session) => {
      if (session) {
        this.currentUser = session.user;
        this.syncEnabled = true;
        console.log('[CloudSaveManager] User logged in:', this.currentUser.email);
        this.syncLocalToCloud();
      } else {
        this.currentUser = null;
        this.syncEnabled = false;
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
      const saveData = {
        timestamp: new Date().toISOString(),
        gameState: gameState,
        slotName: slotName,
        gameId: gameId
      };

      if (this.syncEnabled && this.currentUser) {
        // Save to cloud
        await this.saveToCloud(gameId, slotName, saveData);
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
      let saveData = null;

      if (this.syncEnabled && this.currentUser) {
        // Try to load from cloud first
        saveData = await this.loadFromCloud(gameId, slotName);
      }

      // Fall back to local storage
      if (!saveData) {
        saveData = this.loadLocal(gameId, slotName);
      }

      if (saveData) {
        console.log(`[CloudSaveManager] Game loaded: ${gameId}/${slotName}`);
        return saveData.gameState;
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
   * Manually sync local saves to cloud
   */
  async syncLocalToCloud() {
    if (!this.syncEnabled || !this.currentUser) {
      console.log('[CloudSaveManager] Sync skipped - not authenticated');
      return;
    }

    try {
      console.log('[CloudSaveManager] Syncing local saves to cloud...');
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('game-save-')) {
          const data = localStorage.getItem(key);
          if (data) {
            const saveData = JSON.parse(data);
            const gameId = saveData.gameId;
            const slotName = saveData.slotName || 'autosave';

            if (gameId) {
              await this.saveToCloud(gameId, slotName, saveData);
            }
          }
        }
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
          timestamp: save.created_at,
          gameState: save.game_state,
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
      const { error } = await this.supabaseClient
        .from('game_saves')
        .upsert({
          user_id: this.currentUser.id,
          game_id: gameId,
          slot_name: slotName,
          game_state: saveData.gameState,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,game_id,slot_name'
        });

      if (error) throw error;
    } catch (error) {
      console.error('[CloudSaveManager] Cloud save failed:', error);
      throw error;
    }
  }

  async loadFromCloud(gameId, slotName) {
    try {
      const { data, error } = await this.supabaseClient
        .from('game_saves')
        .select('*')
        .eq('user_id', this.currentUser.id)
        .eq('game_id', gameId)
        .eq('slot_name', slotName)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      
      return data ? {
        timestamp: data.created_at,
        gameState: data.game_state,
        slotName: data.slot_name,
        gameId: data.game_id
      } : null;
    } catch (error) {
      console.error('[CloudSaveManager] Cloud load failed:', error);
      return null;
    }
  }

  async getCloudSaves(gameId) {
    try {
      const { data, error } = await this.supabaseClient
        .from('game_saves')
        .select('*')
        .eq('user_id', this.currentUser.id)
        .eq('game_id', gameId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map(save => ({
        slotName: save.slot_name,
        timestamp: save.created_at,
        formattedDate: new Date(save.created_at).toLocaleString(),
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
    try {
      const key = `game-save-${gameId}-${slotName}`;
      localStorage.setItem(key, JSON.stringify(saveData));
    } catch (error) {
      console.error('[CloudSaveManager] Local save failed:', error);
    }
  }

  loadLocal(gameId, slotName) {
    try {
      const key = `game-save-${gameId}-${slotName}`;
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
        if (key && key.startsWith(`game-save-${gameId}-`)) {
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
      const key = `game-save-${gameId}-${slotName}`;
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
