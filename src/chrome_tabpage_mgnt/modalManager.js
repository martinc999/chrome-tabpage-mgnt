// modalManager.js
class ModalManager {
  constructor(tabManager, aiManager, categoryManager) {
    this.tabManager = tabManager;
    this.aiManager = aiManager;
    this.categoryManager = categoryManager;
  }

  setupModalEventHandlers() {
    // Modal controls
    document.getElementById('predefinedCategoriesBtn')?.addEventListener('click', () => this.openPredefinedCategoriesModal());
    document.getElementById('discoverCategoriesBtn')?.addEventListener('click', () => this.openDiscoverCategoriesModal());
    
    // Predefined categories modal
    document.getElementById('closePredefinedCategoriesModal')?.addEventListener('click', () => this.closeModal('predefinedCategoriesModal'));
    
    // Discover categories modal
    document.getElementById('closeDiscoverCategoriesModal')?.addEventListener('click', () => this.closeModal('discoverCategoriesModal'));
    document.getElementById('generateDiscoverCategories')?.addEventListener('click', () => this.generateDiscoverCategories());
    
    // Close modals on outside click
    window.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
      }
    });
  }

  closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
  }

  async openPredefinedCategoriesModal() {
    document.getElementById('predefinedCategoriesModal').style.display = 'flex';
    await this.generatePredefinedCategories();
  }

  async openDiscoverCategoriesModal() {
    document.getElementById('discoverCategoriesModal').style.display = 'flex';
  }

  async generatePredefinedCategories() {
    const container = document.getElementById('predefinedCategoryTree');
    const categoryList = document.getElementById('predefinedCategoryList');
    
    categoryList.innerHTML = '<div class="loading">🤖 AI analyzing your tabs...</div>';
    container.style.display = 'none';
    
    try {
      const categories = await this.categoryManager.generatePredefinedCategories();
      await this.buildPredefinedCategoryTree(categories);
    } catch (error) {
      console.error('Category generation failed:', error);
      categoryList.innerHTML = '<div class="error">Failed to categorize tabs. Please try again.</div>';
    }
  }

  async generateDiscoverCategories() {
    const prompt = document.getElementById('discoverPromptInput')?.value?.trim();
    if (!prompt) {
      alert('Please enter a prompt to discover categories');
      return;
    }

    this.showDiscoverCategoryProcessing();
    
    try {
      const categories = await this.categoryManager.generateDiscoverCategories(prompt);
      await this.buildDiscoverCategoryTree(categories, prompt);
    } catch (error) {
      console.error('Discover category generation failed:', error);
      this.showDiscoverCategoryError('Failed to discover categories. Please try again.');
    }
  }

  async buildPredefinedCategoryTree(categories) {
    const container = document.getElementById('predefinedCategoryTree');
    const categoryList = document.getElementById('predefinedCategoryList');
    
    categoryList.style.display = 'none';
    container.style.display = 'block';
    container.innerHTML = '<div class="loading">🔄 Organizing tabs...</div>';
    
    const categorizedTabs = await this.categoryManager.categorizeTabs(categories);
    this.renderCategoryTree(categorizedTabs, container, 'Predefined Categories');
  }

  async buildDiscoverCategoryTree(categories, prompt) {
    const container = document.getElementById('discoverCategoryTree');
    
    container.style.display = 'block';
    container.innerHTML = '<div class="loading">🔄 Organizing tabs...</div>';
    
    const categorizedTabs = await this.categoryManager.categorizeTabs(categories);
    this.renderCategoryTree(categorizedTabs, container, `Discovered Categories: "${prompt}"`);
  }

  renderCategoryTree(categorizedTabs, container, title) {
    let html = `<div class="category-tree-root">${title}</div>`;
    
    Object.entries(categorizedTabs).forEach(([categoryName, tabs]) => {
      if (tabs.length === 0) return;
      
      html += `
        <div class="category-group">
          <div class="category-header" data-category="${categoryName}">
            <span class="category-toggle">▼</span>
            <span class="category-name">${categoryName}</span>
            <span class="category-count">(${tabs.length})</span>
          </div>
          <div class="category-content">
            ${tabs.map(tab => this.renderCategoryTab(tab)).join('')}
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
    this.attachCategoryEventListeners(container);
  }

  renderCategoryTab(tab) {
    return `
      <div class="category-tab-item" data-tab-id="${tab.id}">
        <img src="${tab.favicon}" class="category-tab-favicon" alt="" 
             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSIjZGRkIiByeD0iMiIvPgo8L3N2Zz4K'">
        <div class="category-tab-info">
          <div class="category-tab-title">${this.escapeHtml(this.truncateText(tab.title, 50))}</div>
          <div class="category-tab-meta">
            <span class="category-tab-domain">${tab.domain}</span>
            <span class="category-tab-window">Window ${tab.windowId}</span>
            ${tab.isActive ? '<span class="category-tab-active">Active</span>' : ''}
          </div>
        </div>
      </div>
    `;
  }

  attachCategoryEventListeners(container) {
    container.querySelectorAll('.category-header').forEach(header => {
      header.addEventListener('click', () => {
        const content = header.nextElementSibling;
        const toggle = header.querySelector('.category-toggle');
        
        if (content.style.display === 'none') {
          content.style.display = 'block';
          toggle.textContent = '▼';
        } else {
          content.style.display = 'none';
          toggle.textContent = '▶';
        }
      });
    });
    
    container.querySelectorAll('.category-tab-item').forEach(item => {
      item.addEventListener('click', () => {
        const tabId = parseInt(item.dataset.tabId);
        this.tabManager.activateTab(tabId);
      });
    });
  }

  showDiscoverCategoryProcessing() {
    document.getElementById('discoverCategoryStatus').style.display = 'block';
    document.getElementById('discoverCategoryTree').style.display = 'none';
  }

  showDiscoverCategoryError(message) {
    document.getElementById('discoverCategoryStatus').style.display = 'none';
    document.getElementById('discoverCategoryTree').innerHTML = `<div class="error-message">${message}</div>`;
    document.getElementById('discoverCategoryTree').style.display = 'block';
  }

  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}