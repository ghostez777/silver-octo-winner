/**
 * Universal Save Manager for Browser Games
 * Handles game state persistence to localStorage
 */
class GameSaveManager {
  constructor(gameId) {
    this.gameId = gameId;
    this.storagePrefix = `game-save-${gameId}`;
  }

  /**
   * Save game state to localStorage
   * @param {Object} gameState - The complete game state object
   * @param {string} slotName - Optional slot name (default: "autosave")
   */
  saveGame(gameState, slotName = "autosave") {
    try {
      const saveData = {
        timestamp: Date.now(),
        slotName: slotName,
        gameState: gameState
      };
      const key = `${this.storagePrefix}-${slotName}`;
      localStorage.setItem(key, JSON.stringify(saveData));
      this.updateSaveIndex(slotName);
      console.log(`[${this.gameId}] Game saved to slot: ${slotName}`);
      return true;
    } catch (error) {
      console.error(`[${this.gameId}] Failed to save game:`, error);
      return false;
    }
  }

  /**
   * Load game state from localStorage
   * @param {string} slotName - Slot name to load from
   * @returns {Object|null} The saved game state or null if not found
   */
  loadGame(slotName = "autosave") {
    try {
      const key = `${this.storagePrefix}-${slotName}`;
      const data = localStorage.getItem(key);
      if (!data) {
        console.log(`[${this.gameId}] No save found in slot: ${slotName}`);
        return null;
      }
      const saveData = JSON.parse(data);
      console.log(`[${this.gameId}] Game loaded from slot: ${slotName}`);
      return saveData.gameState;
    } catch (error) {
      console.error(`[${this.gameId}] Failed to load game:`, error);
      return null;
    }
  }

  /**
   * Get all available save slots
   * @returns {Array} Array of save slot info objects
   */
  getSaveSlots() {
    const slots = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(this.storagePrefix)) {
          const data = localStorage.getItem(key);
          if (data) {
            const saveData = JSON.parse(data);
            slots.push({
              slotName: saveData.slotName,
              timestamp: saveData.timestamp,
              formattedDate: new Date(saveData.timestamp).toLocaleString()
            });
          }
        }
      }
    } catch (error) {
      console.error(`[${this.gameId}] Failed to get save slots:`, error);
    }
    return slots;
  }

  /**
   * Delete a save slot
   * @param {string} slotName - Slot name to delete
   */
  deleteSave(slotName) {
    try {
      const key = `${this.storagePrefix}-${slotName}`;
      localStorage.removeItem(key);
      this.removeFromSaveIndex(slotName);
      console.log(`[${this.gameId}] Save deleted: ${slotName}`);
      return true;
    } catch (error) {
      console.error(`[${this.gameId}] Failed to delete save:`, error);
      return false;
    }
  }

  /**
   * Check if a save slot exists
   * @param {string} slotName - Slot name to check
   */
  hasSave(slotName = "autosave") {
    try {
      const key = `${this.storagePrefix}-${slotName}`;
      return localStorage.getItem(key) !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear all saves for this game
   */
  clearAllSaves() {
    try {
      const keysToDelete = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.storagePrefix)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => localStorage.removeItem(key));
      console.log(`[${this.gameId}] All saves cleared`);
      return true;
    } catch (error) {
      console.error(`[${this.gameId}] Failed to clear saves:`, error);
      return false;
    }
  }

  // Helper methods for save index tracking
  updateSaveIndex(slotName) {
    try {
      const indexKey = `${this.storagePrefix}-index`;
      const index = JSON.parse(localStorage.getItem(indexKey) || "{}");
      index[slotName] = Date.now();
      localStorage.setItem(indexKey, JSON.stringify(index));
    } catch (error) {
      console.warn(`[${this.gameId}] Could not update save index:`, error);
    }
  }

  removeFromSaveIndex(slotName) {
    try {
      const indexKey = `${this.storagePrefix}-index`;
      const index = JSON.parse(localStorage.getItem(indexKey) || "{}");
      delete index[slotName];
      localStorage.setItem(indexKey, JSON.stringify(index));
    } catch (error) {
      console.warn(`[${this.gameId}] Could not update save index:`, error);
    }
  }
}

// Export for use in games
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameSaveManager;
}
