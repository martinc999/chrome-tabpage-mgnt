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
}

// Initialize the Tab Analyzer when the popup loads
document.addEventListener('DOMContentLoaded', () => {
  new TabAnalyzer();
});