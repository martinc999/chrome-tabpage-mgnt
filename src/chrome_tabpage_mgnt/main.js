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
