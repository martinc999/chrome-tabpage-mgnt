// modalManager.js
class ModalManager {
  constructor(tabManager, aiManager, categoryManager) {
    this.tabManager = tabManager;
    this.aiManager = aiManager;
    this.categoryManager = categoryManager;
    this.predefinedCache = {
        tabsCount: 0,
        categories: null,
        categorizedTabs: null
    };
    this.discoverCache = {
        prompt: '',
        tabsCount: 0,
        categories: null,
        categorizedTabs: null
    };
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
    const currentTabsCount = this.tabManager.tabs.length;

    if (this.predefinedCache.tabsCount === currentTabsCount && this.predefinedCache.categorizedTabs) {
        console.log('Using cached predefined categories.');
        categoryList.style.display = 'none';
        container.style.display = 'block';
        this.renderCategoryTree(this.predefinedCache.categorizedTabs, container, 'Predefined Categories (Cached)');
        return;
    }

    categoryList.innerHTML = '<div class="loading">🤖 AI analyzing your tabs...</div>';
    container.style.display = 'none';

    try {
        const initialCategories = await this.categoryManager.generatePredefinedCategories(this.updateProgress.bind(this));
        
        categoryList.style.display = 'none';
        container.style.display = 'block';
        container.innerHTML = '<div class="loading">🔄 Organizing tabs...</div>';
        
        const categorizedTabs = await this.categoryManager.categorizeTabs(initialCategories);

        container.innerHTML = '<div class="loading">🤖 Merging synonymous categories...</div>';
        const synonymGroups = await this.aiManager.mergeCategoriesWithAI(Object.keys(categorizedTabs));
        const finalCategorizedTabs = this.categoryManager.mergeCategorizedTabs(categorizedTabs, synonymGroups);

        this.predefinedCache = {
            tabsCount: currentTabsCount,
            categories: Object.keys(finalCategorizedTabs),
            categorizedTabs: finalCategorizedTabs
        };
        
        this.renderCategoryTree(finalCategorizedTabs, container, 'Predefined Categories');

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

    const container = document.getElementById('discoverCategoryTree');
    const currentTabsCount = this.tabManager.tabs.length;

    if (this.discoverCache.tabsCount === currentTabsCount && this.discoverCache.prompt === prompt && this.discoverCache.categorizedTabs) {
        console.log('Using cached discover categories.');
        document.getElementById('discoverCategoryStatus').style.display = 'none';
        container.style.display = 'block';
        this.renderCategoryTree(this.discoverCache.categorizedTabs, container, `Discovered Categories: "${prompt}" (Cached)`);
        return;
    }

    this.showDiscoverCategoryProcessing();

    try {
        const initialCategories = await this.categoryManager.generateDiscoverCategories(prompt, this.updateProgress.bind(this));
        
        container.style.display = 'block';
        container.innerHTML = '<div class="loading">🔄 Organizing tabs...</div>';

        const categorizedTabs = await this.categoryManager.categorizeTabs(initialCategories);

        container.innerHTML = '<div class="loading">🤖 Merging synonymous categories...</div>';
        const synonymGroups = await this.aiManager.mergeCategoriesWithAI(Object.keys(categorizedTabs));
        const finalCategorizedTabs = this.categoryManager.mergeCategorizedTabs(categorizedTabs, synonymGroups);

        this.discoverCache = {
            prompt: prompt,
            tabsCount: currentTabsCount,
            categories: Object.keys(finalCategorizedTabs),
            categorizedTabs: finalCategorizedTabs
        };

        this.renderCategoryTree(finalCategorizedTabs, container, `Discovered Categories: "${prompt}"`);

    } catch (error) {
        console.error('Discover category generation failed:', error);
        this.showDiscoverCategoryError('Failed to discover categories. Please try again.');
    }
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

  updateProgress(progress, processed, total) {
    const categoryList = document.getElementById('predefinedCategoryList');
    const discoverCategoryStatus = document.getElementById('discoverCategoryStatus');

    const message = `🤖 AI analyzing your tabs... (${processed}/${total} tabs, ${progress}%)`;

    if (categoryList.style.display !== 'none') {
        categoryList.innerHTML = `<div class="loading">${message}</div>`;
    }

    if (discoverCategoryStatus.style.display !== 'none') {
        discoverCategoryStatus.innerHTML = `<div class="loading">${message}</div>`;
    }
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