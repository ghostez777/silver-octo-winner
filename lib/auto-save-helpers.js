/**
 * Game Progress Auto-Save Example
 * 
 * Usage in your HTML games:
 * 
 * 1. Create an autoSaveManager instance when game starts:
 *    const autoSave = new AutoSaveManager('my-game-id', window.gameHubCloudSaves);
 * 
 * 2. Start it with a function that returns current game state:
 *    autoSave.start(() => ({
 *      level: currentLevel,
 *      score: playerScore,
 *      health: playerHealth,
 *      position: { x, y }
 *    }));
 * 
 * 3. Stop it when game ends:
 *    autoSave.stop();
 * 
 * The game state will be saved automatically every 5 seconds (configurable)
 * to both cloud (if logged in) and local storage (as backup).
 */

// Example implementation for Sudoku game
window.SudokuAutoSave = (function() {
  let autoSave = null;

  return {
    /**
     * Initialize auto-save for Sudoku
     * Call this from your Sudoku game script after game starts
     */
    init: function(getGameStateFn) {
      if (!window.AutoSaveManager) {
        console.warn('AutoSaveManager not loaded');
        return;
      }

      autoSave = new AutoSaveManager(
        'sudoku-game',
        window.gameHubCloudSaves,
        5000 // Save every 5 seconds
      );

      autoSave.start(getGameStateFn);
      console.log('[Sudoku] Auto-save initialized');
    },

    /**
     * Stop auto-saving
     */
    stop: function() {
      if (autoSave) {
        autoSave.stop();
      }
    },

    /**
     * Force an immediate save
     */
    forceSave: function() {
      if (autoSave) {
        return autoSave.forceSave();
      }
      return false;
    }
  };
})();

// Example implementation for Flappy Bird
window.FlappyBirdAutoSave = (function() {
  let autoSave = null;

  return {
    init: function(getGameStateFn) {
      if (!window.AutoSaveManager) {
        console.warn('AutoSaveManager not loaded');
        return;
      }

      autoSave = new AutoSaveManager(
        'flappy-bird-game',
        window.gameHubCloudSaves,
        3000 // Save every 3 seconds (faster for fast-paced game)
      );

      autoSave.start(getGameStateFn);
      console.log('[Flappy Bird] Auto-save initialized');
    },

    stop: function() {
      if (autoSave) {
        autoSave.stop();
      }
    },

    forceSave: function() {
      if (autoSave) {
        return autoSave.forceSave();
      }
      return false;
    }
  };
})();

// Generic auto-save helper
window.createGameAutoSave = function(gameId, cloudSaveManager, intervalMs = 5000) {
  return new AutoSaveManager(gameId, cloudSaveManager, intervalMs);
};

// Helper to load auto-saved progress
window.loadAutoSaveProgress = async function(gameId) {
  if (window.gameHubCloudSaves) {
    const cloudState = await window.gameHubCloudSaves.loadGame(gameId, 'autosave');
    if (cloudState) return cloudState;
  }

  // Fall back to local storage
  try {
    const key = `game-save-${gameId}-autosave`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const data = JSON.parse(raw);
      return data.gameState || null;
    }
  } catch (error) {
    console.error('Could not load auto-saved progress:', error);
  }

  return null;
};

console.log('[AutoSave] Global auto-save helpers loaded');
