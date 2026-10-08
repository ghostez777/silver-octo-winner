/**
 * PokéRogue Cloud Save Integration (Autosave Only)
 * 
 * This script integrates cloud saves with PokéRogue's localStorage system.
 * Uses only autosave slot - no manual save slots.
 * When a user is logged in, game saves are synced to their cloud account.
 * When logged out, saves use local browser storage.
 */

class PokéRogueCloudSave {
  constructor() {
    this.cloudSaveManager = window.gameHubCloudSaves;
    this.gameId = 'pokerouge';
    this.slotName = 'autosave'; // Always use autosave
    this.isReady = false;
    this.saveTimeout = null;
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
    console.log('[PokéRogueCloudSave] Initialized (autosave only)');

    // Load any existing cloud save on init
    this.load();

    // Hook into window unload to save on exit
    window.addEventListener('beforeunload', () => this.forceSaveAll());

    // Intercept localStorage writes to sync automatically
    this.hookLocalStorage();
  }

  /**
   * Hook into localStorage to auto-sync saves
   */
  hookLocalStorage() {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = (key, value) => {
      originalSetItem.call(this, key, value);

      // If this is a PokéRogue save key, queue a sync
      if (key.includes('pokerouge') || key.includes('save') || key.includes('session')) {
        if (this.isReady) {
          clearTimeout(this.saveTimeout);
          this.saveTimeout = setTimeout(() => {
            this.save();
            this.saveTimeout = null;
          }, 2000); // Wait 2 seconds after last change
        }
      }
    };
  }

  /**
   * Get the current game save data from localStorage
   */
  getCurrentSaveData() {
    try {
      const saveData = {};

      // Grab all PokéRogue-related keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('pokerouge') || key.includes('save') || key.includes('session'))) {
          saveData[key] = localStorage.getItem(key);
        }
      }

      return Object.keys(saveData).length > 0 ? saveData : null;
    } catch (error) {
      console.error('[PokéRogueCloudSave] Error getting save data:', error);
      return null;
    }
  }

  /**
   * Save game to cloud (if logged in) or local storage
   */
  async save() {
    if (!this.isReady) return false;

    const saveData = this.getCurrentSaveData();
    if (!saveData) {
      console.log('[PokéRogueCloudSave] No save data to persist');
      return false;
    }

    try {
      const payload = {
        timestamp: Date.now(),
        version: '1.0',
        saveData: saveData
      };

      if (this.cloudSaveManager.getAuthStatus().isAuthenticated) {
        const success = await this.cloudSaveManager.saveGame(
          this.gameId,
          this.slotName,
          payload
        );

        if (success) {
          console.log('[PokéRogueCloudSave] ☁️ Cloud autosave successful');
          return true;
        }
      }

      // Local storage already has it, just note it
      console.log('[PokéRogueCloudSave] 💾 Local autosave (not logged in)');
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

      // Try cloud first if logged in
      if (this.cloudSaveManager.getAuthStatus().isAuthenticated) {
        const cloudState = await this.cloudSaveManager.loadGame(this.gameId, this.slotName);
        if (cloudState && cloudState.saveData) {
          saveData = cloudState.saveData;
          console.log('[PokéRogueCloudSave] ☁️ Loaded from cloud');
        }
      }

      // If no cloud save, local storage is already in place
      if (!saveData) {
        console.log('[PokéRogueCloudSave] Using browser storage');
        return false;
      }

      // Restore the save data to localStorage
      Object.entries(saveData).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });

      console.log('[PokéRogueCloudSave] ✓ Autosave restored from cloud');
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
    if (!saveData) return;

    try {
      if (this.cloudSaveManager && this.cloudSaveManager.getAuthStatus().isAuthenticated) {
        await this.cloudSaveManager.saveGame(
          this.gameId,
          this.slotName,
          {
            timestamp: Date.now(),
            version: '1.0',
            saveData: saveData
          }
        );
        console.log('[PokéRogueCloudSave] ☁️ Forced autosave on exit');
      }
    } catch (error) {
      console.error('[PokéRogueCloudSave] Forced save failed:', error);
    }
  }

  /**
   * Check if user is logged in
   */
  isLoggedIn() {
    return this.cloudSaveManager && this.cloudSaveManager.getAuthStatus().isAuthenticated;
  }

  /**
   * Get autosave info
   */
  async getAutosaveInfo() {
    try {
      if (!this.cloudSaveManager.getAuthStatus().isAuthenticated) {
        return { status: 'local', message: 'Using browser storage' };
      }

      const saves = await this.cloudSaveManager.getSavesForGame(this.gameId);
      const autosave = saves?.find(s => s.slotName === this.slotName);

      return {
        status: 'cloud',
        lastSaved: autosave?.formattedDate || 'Never',
        message: `Cloud autosave${autosave ? ' - Last saved: ' + autosave.formattedDate : ''}`
      };
    } catch (error) {
      return { status: 'error', message: 'Could not get autosave info' };
    }
  }
}

// Initialize globally
window.pokéRogueCloudSave = new PokéRogueCloudSave();

console.log('[PokéRogueCloudSave] Autosave-only integration loaded');
