/**
 * PokéRogue Cloud Save Integration
 * 
 * This script integrates cloud saves with PokéRogue's localStorage system.
 * When a user is logged in, game saves are synced to their cloud account.
 * When logged out, saves use local browser storage.
 */

class PokéRogueCloudSave {
  constructor() {
    this.cloudSaveManager = window.gameHubCloudSaves;
    this.gameId = 'pokerouge';
    this.isReady = false;
    this.init();
  }

  /**
   * Initialize the cloud save integration
   */
  init() {
    if (!this.cloudSaveManager) {
      console.warn('[PokéRogueCloudSave] CloudSaveManager not available');
      return;
    }

    this.isReady = true;
    console.log('[PokéRogueCloudSave] Initialized and ready');

    // Hook into window unload to save on exit
    window.addEventListener('beforeunload', () => this.forceSaveAll());
  }

  /**
   * Get the current game save data from localStorage
   */
  getCurrentSaveData() {
    try {
      // PokéRogue stores game data in multiple localStorage keys
      const saveData = {};
      
      // Common PokéRogue save keys
      const keys = [
        'pokerogueSession',
        'pokerogueData',
        'pokerogueSettings',
        'pokerogueStats'
      ];

      keys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          saveData[key] = value;
        }
      });

      // Also try to grab any key that starts with 'pokerouge' or looks like save data
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('pokerouge') || key.includes('save') || key.includes('session'))) {
          if (!saveData[key]) {
            saveData[key] = localStorage.getItem(key);
          }
        }
      }

      return saveData;
    } catch (error) {
      console.error('[PokéRogueCloudSave] Error getting save data:', error);
      return null;
    }
  }

  /**
   * Save game to cloud (if logged in) and local storage
   */
  async save() {
    if (!this.isReady) return false;

    const saveData = this.getCurrentSaveData();
    if (!saveData || Object.keys(saveData).length === 0) {
      console.log('[PokéRogueCloudSave] No save data to persist');
      return false;
    }

    try {
      if (this.cloudSaveManager.getAuthStatus().isAuthenticated) {
        const payload = {
          timestamp: Date.now(),
          version: '1.0',
          saveData: saveData
        };

        const success = await this.cloudSaveManager.saveGame(
          this.gameId,
          'autosave',
          payload
        );

        if (success) {
          console.log('[PokéRogueCloudSave] Cloud save successful');
          return true;
        }
      }

      console.log('[PokéRogueCloudSave] Using local storage (not logged in)');
      return true;
    } catch (error) {
      console.error('[PokéRogueCloudSave] Save failed:', error);
      return false;
    }
  }

  /**
   * Load game from cloud (if available) or local storage
   */
  async load() {
    if (!this.isReady) return false;

    try {
      let saveData = null;

      // Try cloud first
      if (this.cloudSaveManager.getAuthStatus().isAuthenticated) {
        const cloudState = await this.cloudSaveManager.loadGame(this.gameId, 'autosave');
        if (cloudState && cloudState.saveData) {
          saveData = cloudState.saveData;
          console.log('[PokéRogueCloudSave] Loaded from cloud');
        }
      }

      // If no cloud save, use local storage (already in place)
      if (!saveData) {
        console.log('[PokéRogueCloudSave] Using local storage');
        return false; // Let PokéRogue handle its own local storage
      }

      // Restore the save data to localStorage
      Object.entries(saveData).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });

      console.log('[PokéRogueCloudSave] Save data restored from cloud');
      return true;
    } catch (error) {
      console.error('[PokéRogueCloudSave] Load failed:', error);
      return false;
    }
  }

  /**
   * Force an immediate save
   */
  async forceSaveAll() {
    const saveData = this.getCurrentSaveData();
    if (!saveData || Object.keys(saveData).length === 0) return;

    try {
      if (this.cloudSaveManager && this.cloudSaveManager.getAuthStatus().isAuthenticated) {
        await this.cloudSaveManager.saveGame(
          this.gameId,
          'autosave',
          {
            timestamp: Date.now(),
            version: '1.0',
            saveData: saveData
          }
        );
        console.log('[PokéRogueCloudSave] Forced cloud save on exit');
      }
    } catch (error) {
      console.error('[PokéRogueCloudSave] Forced save failed:', error);
    }
  }

  /**
   * Get all saved games for this user
   */
  async listSaves() {
    try {
      if (!this.cloudSaveManager.getAuthStatus().isAuthenticated) {
        return null;
      }

      return await this.cloudSaveManager.getSavesForGame(this.gameId);
    } catch (error) {
      console.error('[PokéRogueCloudSave] Failed to list saves:', error);
      return null;
    }
  }

  /**
   * Delete a specific save
   */
  async deleteSave(slotName = 'autosave') {
    try {
      if (!this.cloudSaveManager.getAuthStatus().isAuthenticated) {
        return false;
      }

      await this.cloudSaveManager.deleteSave(this.gameId, slotName);
      console.log(`[PokéRogueCloudSave] Deleted save slot: ${slotName}`);
      return true;
    } catch (error) {
      console.error('[PokéRogueCloudSave] Failed to delete save:', error);
      return false;
    }
  }

  /**
   * Check if user is logged in
   */
  isLoggedIn() {
    return this.cloudSaveManager && this.cloudSaveManager.getAuthStatus().isAuthenticated;
  }
}

// Initialize globally
window.pokéRogueCloudSave = new PokéRogueCloudSave();

// Hook into PokéRogue's save points
// This runs every time PokéRogue saves to localStorage
if (window.addEventListener) {
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    originalSetItem.call(this, key, value);

    // If this is a PokéRogue save key and cloud save is ready, sync it
    if (key.includes('pokerouge') || key.includes('save') || key.includes('session')) {
      if (window.pokéRogueCloudSave && window.pokéRogueCloudSave.isReady) {
        // Debounce rapid saves
        if (!window.pokéRogueCloudSave._saveTimeout) {
          window.pokéRogueCloudSave._saveTimeout = setTimeout(() => {
            window.pokéRogueCloudSave.save();
            window.pokéRogueCloudSave._saveTimeout = null;
          }, 2000); // Wait 2 seconds after last change before saving
        }
      }
    }
  };
}

console.log('[PokéRogueCloudSave] Integration loaded');
