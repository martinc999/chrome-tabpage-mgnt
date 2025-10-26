// main.js
class TabAnalyzer {
  constructor() {
    this.tabManager = new TabManager();
    this.aiManager = new AIManager();
    this.categoryManager = new CategoryManager(this.tabManager, this.aiManager);
    this.uiManager = new UIManager(this.tabManager);
    this.modalManager = new ModalManager(this.tabManager, this.aiManager, this.categoryManager);
    
    this.init();
  }

  async init() {
    this.uiManager.showLoadingState();
    await this.tabManager.loadAllTabs();
    await this.aiManager.initializeAI();
    this.setupEventHandlers();
    this.uiManager.renderTabList();
    this.uiManager.updateStatistics();
  }

  setupEventHandlers() {
    // Main controls
    document.getElementById('refreshButton')?.addEventListener('click', () => this.refreshAllData());
    document.getElementById('searchInput')?.addEventListener('input', (e) => this.handleSearch(e.target.value));
    
    // Cache management
    document.getElementById('clearCacheBtn')?.addEventListener('click', () => this.showClearCacheConfirmation());
    document.getElementById('closeClearCacheModal')?.addEventListener('click', () => this.hideClearCacheModal());
    document.getElementById('cancelClearCache')?.addEventListener('click', () => this.hideClearCacheModal());
    document.getElementById('confirmClearCache')?.addEventListener('click', () => this.clearCategoryCache());
    
    // Modal event handlers
    this.modalManager.setupModalEventHandlers();
  }

  async refreshAllData() {
    this.uiManager.showLoadingState();
    await this.tabManager.loadAllTabs();
    this.uiManager.renderTabList();
    this.uiManager.updateStatistics();
  }

  handleSearch(searchTerm) {
    this.tabManager.filterTabs(searchTerm);
    this.uiManager.renderTabList();
  }

  showClearCacheConfirmation() {
    console.log('TabAnalyzer: Showing clear cache confirmation modal');
    const modal = document.getElementById('clearCacheModal');
    if (modal) {
      modal.style.display = 'flex';
    }
  }

  hideClearCacheModal() {
    console.log('TabAnalyzer: Hiding clear cache modal');
    const modal = document.getElementById('clearCacheModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  async clearCategoryCache() {
    console.log('TabAnalyzer: Clearing category cache');
    
    try {
      // Show loading state in the modal
      const confirmButton = document.getElementById('confirmClearCache');
      const originalText = confirmButton.textContent;
      confirmButton.textContent = 'Clearing...';
      confirmButton.disabled = true;

      // Clear the cache using CategoryManager
      await this.categoryManager.clearCategoryCache();
      
      console.log('TabAnalyzer: Category cache cleared successfully');
      
      // Hide the modal
      this.hideClearCacheModal();
      
      // Show success message
      this.showNotification('Category cache cleared successfully!', 'success');
      
      // Reset button state
      confirmButton.textContent = originalText;
      confirmButton.disabled = false;
      
      // Optional: Refresh the tab list to show that cache is cleared
      await this.refreshAllData();
      
    } catch (error) {
      console.error('TabAnalyzer: Error clearing category cache:', error);
      
      // Show error message
      this.showNotification('Error clearing cache. Please try again.', 'error');
      
      // Reset button state
      const confirmButton = document.getElementById('confirmClearCache');
      confirmButton.textContent = 'Clear Cache';
      confirmButton.disabled = false;
    }
  }

  showNotification(message, type = 'info') {
    // Create a simple notification system
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      max-width: 300px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      transition: opacity 0.3s ease;
    `;
    
    // Set colors based on type
    if (type === 'success') {
      notification.style.background = '#34a853';
      notification.style.color = 'white';
    } else if (type === 'error') {
      notification.style.background = '#ea4335';
      notification.style.color = 'white';
    } else {
      notification.style.background = '#4285f4';
      notification.style.color = 'white';
    }
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
}

// Initialize the Tab Analyzer when the popup loads
document.addEventListener('DOMContentLoaded', () => {
  new TabAnalyzer();
});

/**
 * Create groups sequentially to avoid race conditions and conflicts
 * @param {Object} groupedTabs - Object with category names as keys and tab arrays as values
 * @param {TabManager} tabManager - Instance of TabManager
 * @param {Function} progressCallback - Optional callback for progress updates
 */
async function createGroupsSequentially(groupedTabs, tabManager, progressCallback = null) {
    const categories = Object.keys(groupedTabs);
    const totalCategories = categories.length;
    let processedCategories = 0;
    const results = [];

    console.log(`Starting sequential group creation for ${totalCategories} categories`);

    for (const category of categories) {
        const tabs = groupedTabs[category];
        
        if (!tabs || tabs.length === 0) {
            console.warn(`Skipping empty category: ${category}`);
            processedCategories++;
            if (progressCallback) {
                progressCallback(processedCategories, totalCategories, category);
            }
            continue;
        }

        console.log(`\n=== Processing category: "${category}" (${tabs.length} tabs) ===`);

        try {
            // Get tab IDs - verify they still exist
            const tabIds = [];
            for (const tab of tabs) {
                try {
                    await chrome.tabs.get(tab.id);
                    tabIds.push(tab.id);
                } catch (error) {
                    console.warn(`Tab ${tab.id} no longer exists, skipping`);
                }
            }

            if (tabIds.length === 0) {
                console.warn(`No valid tabs found for category: ${category}`);
                processedCategories++;
                if (progressCallback) {
                    progressCallback(processedCategories, totalCategories, category);
                }
                continue;
            }

            console.log(`Moving ${tabIds.length} tabs to group "${category}"`);

            // Move tabs and create group
            const result = await tabManager.moveTabsToWindow(tabIds, category);
            
            results.push({
                category,
                success: result.success,
                tabCount: result.movedTabs.length,
                windowId: result.newWindow.id,
                groupId: result.tabGroup?.id
            });

            console.log(`✓ Successfully created group "${category}" with ${result.movedTabs.length} tabs`);

            // Wait between categories to ensure stability
            await new Promise(resolve => setTimeout(resolve, 800));

        } catch (error) {
            console.error(`✗ Failed to create group for category "${category}":`, error);
            results.push({
                category,
                success: false,
                error: error.message
            });
        }

        processedCategories++;
        if (progressCallback) {
            progressCallback(processedCategories, totalCategories, category);
        }
    }

    // Summary
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    console.log(`\n=== Group Creation Summary ===`);
    console.log(`Total categories: ${totalCategories}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failureCount}`);
    
    results.forEach(result => {
        if (result.success) {
            console.log(`  ✓ ${result.category}: ${result.tabCount} tabs in window ${result.windowId}`);
        } else {
            console.log(`  ✗ ${result.category}: ${result.error}`);
        }
    });

    return {
        results,
        successCount,
        failureCount,
        totalCategories
    };
}

/**
 * Example usage in your modal's "Create all groups" button handler
 */
async function handleCreateAllGroupsButton(groupedTabs, tabManager) {
    const button = document.getElementById('createAllGroupsBtn');
    const statusElement = document.getElementById('groupCreationStatus'); // You'll need to add this to HTML
    
    // Disable button during processing
    button.disabled = true;
    button.textContent = 'Creating groups...';
    
    try {
        const result = await createGroupsSequentially(
            groupedTabs,
            tabManager,
            (processed, total, currentCategory) => {
                // Update UI with progress
                if (statusElement) {
                    statusElement.textContent = `Creating groups: ${processed}/${total} - ${currentCategory}`;
                }
                console.log(`Progress: ${processed}/${total} - Processing "${currentCategory}"`);
            }
        );

        // Show final result
        if (statusElement) {
            statusElement.textContent = `Complete! Created ${result.successCount}/${result.totalCategories} groups`;
            if (result.failureCount > 0) {
                statusElement.textContent += ` (${result.failureCount} failed)`;
                statusElement.style.color = 'orange';
            } else {
                statusElement.style.color = 'green';
            }
        }

        alert(`Groups created!\nSuccess: ${result.successCount}\nFailed: ${result.failureCount}`);

    } catch (error) {
        console.error('Error in group creation process:', error);
        if (statusElement) {
            statusElement.textContent = 'Error creating groups';
            statusElement.style.color = 'red';
        }
        alert('Failed to create groups. Check console for details.');
    } finally {
        button.disabled = false;
        button.textContent = 'Create all groups';
    }
}

// Debug Helper - Add to main.js or use in console
// This helps verify that categorization is working correctly

class CategorizationDebugger {
  constructor(categoryManager, tabManager) {
    this.categoryManager = categoryManager;
    this.tabManager = tabManager;
  }

  /**
   * Verify that all tabs are assigned to exactly one category
   */
  verifyCategorization(groupedTabs) {
    console.group('🔍 Categorization Verification');
    
    const allTabIds = this.tabManager.tabs.map(t => t.id);
    const categorizedTabIds = new Set();
    const duplicateTabIds = new Set();
    
    // Check each category
    Object.entries(groupedTabs).forEach(([category, tabs]) => {
      console.log(`\n📁 Category: "${category}"`);
      console.log(`   Tabs count: ${tabs.length}`);
      
      tabs.forEach(tab => {
        if (categorizedTabIds.has(tab.id)) {
          console.warn(`   ⚠️ DUPLICATE: Tab ${tab.id} "${tab.title}" already assigned!`);
          duplicateTabIds.add(tab.id);
        } else {
          categorizedTabIds.add(tab.id);
          console.log(`   ✓ Tab ${tab.id}: ${tab.title}`);
        }
      });
    });
    
    // Check for missing tabs
    const missingTabIds = allTabIds.filter(id => !categorizedTabIds.has(id));
    
    console.log('\n📊 Summary:');
    console.log(`   Total tabs: ${allTabIds.length}`);
    console.log(`   Categorized tabs: ${categorizedTabIds.size}`);
    console.log(`   Duplicate assignments: ${duplicateTabIds.size}`);
    console.log(`   Missing tabs: ${missingTabIds.length}`);
    
    if (missingTabIds.length > 0) {
      console.warn('\n⚠️ Missing tabs:');
      missingTabIds.forEach(id => {
        const tab = this.tabManager.tabs.find(t => t.id === id);
        if (tab) {
          console.warn(`   - Tab ${id}: ${tab.title}`);
        }
      });
    }
    
    if (duplicateTabIds.size > 0) {
      console.error('\n❌ Duplicate assignments detected!');
    }
    
    const isValid = missingTabIds.length === 0 && duplicateTabIds.size === 0;
    console.log(`\n${isValid ? '✅ Categorization is VALID' : '❌ Categorization has ERRORS'}`);
    
    console.groupEnd();
    
    return {
      isValid,
      totalTabs: allTabIds.length,
      categorizedTabs: categorizedTabIds.size,
      missingTabs: missingTabIds,
      duplicateTabs: Array.from(duplicateTabIds)
    };
  }

  /**
   * Show detailed mapping of tabs to categories
   */
  showDetailedMapping(groupedTabs) {
    console.group('📋 Detailed Tab-to-Category Mapping');
    
    Object.entries(groupedTabs).forEach(([category, tabs]) => {
      console.group(`📁 ${category} (${tabs.length} tabs)`);
      tabs.forEach(tab => {
        console.log(`${tab.id} | Window ${tab.windowId} | ${tab.title} | ${tab.domain}`);
      });
      console.groupEnd();
    });
    
    console.groupEnd();
  }

  /**
   * Export categorization to downloadable file
   */
  exportCategorization(groupedTabs) {
    const lines = [];
    lines.push('=== Tab Categorization Export ===');
    lines.push(`Export Date: ${new Date().toISOString()}`);
    lines.push(`Total Categories: ${Object.keys(groupedTabs).length}`);
    lines.push('');
    
    Object.entries(groupedTabs).forEach(([category, tabs]) => {
      lines.push(`\n### Category: ${category} (${tabs.length} tabs) ###`);
      tabs.forEach(tab => {
        lines.push(`  [${tab.id}] ${tab.title}`);
        lines.push(`      URL: ${tab.url}`);
        lines.push(`      Domain: ${tab.domain}`);
        lines.push(`      Window: ${tab.windowId}`);
        lines.push('');
      });
    });
    
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `tab-categorization-${Date.now()}.txt`;
    a.click();
    
    console.log('✅ Categorization exported to file');
  }

  /**
   * Track category operations in real-time
   */
  async trackGroupCreation(groupedTabs, createGroupFunction) {
    const categories = Object.keys(groupedTabs);
    const startTime = Date.now();
    const results = [];
    
    console.group('🚀 Group Creation Progress');
    
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      const tabs = groupedTabs[category];
      const categoryStartTime = Date.now();
      
      console.log(`\n[${i + 1}/${categories.length}] Processing: "${category}" (${tabs.length} tabs)`);
      
      try {
        await createGroupFunction(category, tabs);
        const duration = Date.now() - categoryStartTime;
        results.push({
          category,
          success: true,
          duration,
          tabCount: tabs.length
        });
        console.log(`✅ Completed in ${duration}ms`);
      } catch (error) {
        const duration = Date.now() - categoryStartTime;
        results.push({
          category,
          success: false,
          duration,
          error: error.message,
          tabCount: tabs.length
        });
        console.error(`❌ Failed in ${duration}ms:`, error.message);
      }
    }
    
    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    
    console.log('\n📊 Final Statistics:');
    console.log(`   Total time: ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}s)`);
    console.log(`   Successful: ${successCount}/${categories.length}`);
    console.log(`   Average time per category: ${Math.round(totalDuration / categories.length)}ms`);
    
    console.groupEnd();
    
    return results;
  }
}

// Make it available globally for debugging
window.CategorizationDebugger = CategorizationDebugger;

// Example usage in console:
/*
// After categorization is complete:
const debugger = new CategorizationDebugger(categoryManager, tabManager);

// Verify categorization
debugger.verifyCategorization(modalManager.predefinedCache.categorizedTabs);

// Show detailed mapping
debugger.showDetailedMapping(modalManager.predefinedCache.categorizedTabs);

// Export to file
debugger.exportCategorization(modalManager.predefinedCache.categorizedTabs);
*/

// Make it available globally
window.createGroupsSequentially = createGroupsSequentially;
window.handleCreateAllGroupsButton = handleCreateAllGroupsButton;
