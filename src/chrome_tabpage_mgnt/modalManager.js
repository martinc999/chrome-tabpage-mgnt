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
  }

  setupModalEventHandlers() {
    // Modal controls
    document.getElementById('predefinedCategoriesBtn')?.addEventListener('click', () => this.openPredefinedCategoriesModal());
    document.getElementById('simplifyCategoriesBtn')?.addEventListener('click', () => this.handleSimplifyCategories());
    document.getElementById('createAllGroupsBtn')?.addEventListener('click', () => this.handleCreateAllGroups());
    document.getElementById('closePredefinedCategoriesModal')?.addEventListener('click', () => this.closeModal('predefinedCategoriesModal'));


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


  async generatePredefinedCategories() {
    const container = document.getElementById('predefinedCategoryTree');
    const categoryList = document.getElementById('predefinedCategoryList');
    const currentTabsCount = this.tabManager.tabs.length;

    // Check cache
    if (this.predefinedCache.tabsCount === currentTabsCount && this.predefinedCache.categorizedTabs) {
      console.log('Using cached predefined categories.');
      document.getElementById('predefinedCategoriesActions').style.display = 'flex';
      categoryList.style.display = 'none';
      container.style.display = 'block';
      this.renderCategoryTree(this.predefinedCache.categorizedTabs, container, 'Predefined Categories (Cached)');
      return;
    }
    document.getElementById('predefinedCategoriesActions').style.display = 'none';

    categoryList.innerHTML = '<div class="loading">🤖 AI analyzing your tabs...</div>';
    container.style.display = 'none';

    try {
      const result = await this.categoryManager.generatePredefinedCategories(this.updateProgress.bind(this));

      console.log('CategoryManager result:', result);

      let finalCategorizedTabs;

      if (result.groupedTabs && Object.keys(result.groupedTabs).length > 0) {
        finalCategorizedTabs = result.groupedTabs;
      } else {
        console.log('No grouped tabs from generation, categorizing now...');
        categoryList.style.display = 'none';
        container.style.display = 'block';
        container.innerHTML = '<div class="loading">📄 Organizing tabs...</div>';

        finalCategorizedTabs = await this.categoryManager.categorizeTabs(result.categories);
      }

      // Update cache
      this.predefinedCache = {
        tabsCount: currentTabsCount,
        categories: result.categories,
        categorizedTabs: finalCategorizedTabs
      };

      // Render the tree
      categoryList.style.display = 'none';
      container.style.display = 'block';
      document.getElementById('predefinedCategoriesActions').style.display = 'flex';
      this.renderCategoryTree(finalCategorizedTabs, container, 'Predefined Categories');

    } catch (error) {
      console.error('Category generation failed:', error);
      categoryList.innerHTML = '<div class="error">Failed to categorize tabs. Please try again.</div>';
      document.getElementById('predefinedCategoriesActions').style.display = 'none';
      container.style.display = 'none';
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
            <div class="category-actions">
              <button class="move-category-to-window-btn" title="Move all tabs to new window with tab group" data-category-name="${this.escapeHtml(categoryName)}">
                🪟 Move to New Window
              </button>
              <button class="close-category-tabs-btn" title="Close all tabs in this category" data-category-name="${this.escapeHtml(categoryName)}">×</button>
            </div>
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
    console.log('Attaching category event listeners to container:', container.id);

    // Handle category header clicks for toggling
    container.querySelectorAll('.category-header').forEach(header => {
      header.addEventListener('click', (e) => {
        // Prevent toggling when action buttons are clicked
        if (e.target.closest('.category-actions')) {
          return;
        }
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

    // Handle tab item clicks
    container.querySelectorAll('.category-tab-item').forEach(item => {
      item.addEventListener('click', () => {
        const tabId = parseInt(item.dataset.tabId);
        this.tabManager.activateTab(tabId);
      });
    });

    // Handle close category tabs button
    container.querySelectorAll('.close-category-tabs-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const categoryName = button.dataset.categoryName;
        console.log('Close category button clicked:', categoryName);
        this.handleCloseCategoryTabs(categoryName, container);
      });
    });

    // Handle move to window button
    container.querySelectorAll('.move-category-to-window-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const categoryName = button.dataset.categoryName;
        console.log('Move category button clicked:', categoryName);
        this.handleMoveCategoryToWindow(categoryName, container);
      });
    });

    console.log('Event listeners attached successfully');
  }

  async handleMoveCategoryToWindow(categoryName, container, showConfirmation = true) {
    console.log('handleMoveCategoryToWindow called for:', categoryName);

    const cache = this.predefinedCache;

    if (!cache.categorizedTabs || !cache.categorizedTabs[categoryName]) {
      console.error('Could not find tabs for category:', categoryName, cache);
      this.showNotification('Error: Could not find tabs for this category', 'error');
      return;
    }

    const tabsToMove = cache.categorizedTabs[categoryName];
    const tabIdsToMove = tabsToMove.map(tab => tab.id);

    console.log(`Found ${tabsToMove.length} tabs to move for category: ${categoryName}`, tabsToMove);

    if (showConfirmation && !confirm(`Move all ${categoryName} tabs (${tabsToMove.length} tabs) to a new window with a tab group?`)) {
      return;
    }

    try {
      const button = container.querySelector(`.move-category-to-window-btn[data-category-name="${this.escapeHtml(categoryName)}"]`);
      if (button) {
        const originalText = button.textContent;
        button.textContent = 'Moving...';
        button.disabled = true;
      }

      console.log('Calling tabManager.moveTabsToWindow...');

      // Use TabManager to move tabs
      const result = await this.tabManager.moveTabsToWindow(tabIdsToMove, categoryName);

      console.log('moveTabsToWindow result:', result);

      if (result.success) {
        console.log('Successfully moved tabs, updating UI...');

        // Remove the category from cache and UI
        delete cache.categorizedTabs[categoryName];
        const categoryGroup = container.querySelector(`.category-header[data-category="${categoryName}"]`)?.parentElement;
        if (categoryGroup) {
          categoryGroup.remove();
        }

        // Show success notification
        const message = result.tabGroup
          ? `Successfully moved ${tabsToMove.length} tabs to new window with "${categoryName}" tab group`
          : `Successfully moved ${tabsToMove.length} tabs to new window`;

        this.showNotification(message, 'success');

        // Update statistics
        if (window.tabAnalyzer?.uiManager) {
          window.tabAnalyzer.uiManager.updateStatistics();
        }
      } else {
        throw new Error('Move operation returned success: false');
      }

    } catch (error) {
      console.error(`Failed to move tabs for category ${categoryName}:`, error);
      this.showNotification(`Error moving tabs: ${error.message}`, 'error');


      // Reset button state
      const button = container.querySelector(`.move-category-to-window-btn[data-category-name="${this.escapeHtml(categoryName)}"]`);
      if (button) {
        button.textContent = '🪟 Move to New Window';
        button.disabled = false;
      }
    }
    return;
  }


  updateProgress(progress, processed, total) {
    const categoryList = document.getElementById('predefinedCategoryList');

    const message = `🤖 AI analyzing your tabs... (${processed}/${total} tabs, ${progress}%)`;

    if (categoryList && categoryList.style.display !== 'none') {
      categoryList.innerHTML = `<div class="loading">${message}</div>`;
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

  async handleCloseCategoryTabs(categoryName, container) {
    if (!confirm(`Are you sure you want to close all ${categoryName} tabs?`)) {
      return;
    }

    const cache = this.predefinedCache;

    if (!cache.categorizedTabs || !cache.categorizedTabs[categoryName]) {
      console.error('Could not find tabs for category:', categoryName);
      return;
    }

    const tabsToClose = cache.categorizedTabs[categoryName];
    const tabIdsToClose = tabsToClose.map(tab => tab.id);

    try {
      await this.tabManager.closeTabs(tabIdsToClose);

      // Remove the category group from the UI
      const categoryGroup = container.querySelector(`.category-header[data-category="${categoryName}"]`)?.parentElement;
      if (categoryGroup) {
        categoryGroup.remove();
      }

      // Update the cache
      delete cache.categorizedTabs[categoryName];

    } catch (error) {
      console.error(`Failed to close tabs for category ${categoryName}:`, error);
      alert(`An error occurred while closing tabs for ${categoryName}.`);
    }
  }

  showNotification(message, type = 'info') {
    // Use the main TabAnalyzer's notification system if available
    if (window.tabAnalyzer && typeof window.tabAnalyzer.showNotification === 'function') {
      window.tabAnalyzer.showNotification(message, type);
    } else {
      // Fallback notification
      alert(`${type.toUpperCase()}: ${message}`);
    }
  }

  async handleSimplifyCategories() {
    console.log('Simplify Categories button clicked');
    const simplifyBtn = document.getElementById('simplifyCategoriesBtn');
    const originalBtnText = simplifyBtn.textContent;
    simplifyBtn.disabled = true;
    simplifyBtn.textContent = 'Simplifying...';

    try {
      const currentCategorizedTabs = this.predefinedCache.categorizedTabs;

      if (!currentCategorizedTabs || Object.keys(currentCategorizedTabs).length < 2) {
        this.showNotification('Not enough categories to simplify.', 'info');
        return;
      }

      const existingGroupTitles = await this.tabManager.getTabGroupTitles();
      const { simplifiedTabs, simplifiedCategories, categoryMap } = await this.categoryManager.simplifyCategoriesAI(currentCategorizedTabs, existingGroupTitles);

      // Check if any actual simplification occurred
      const hasChanges = Object.keys(categoryMap).some(oldCat => categoryMap[oldCat] !== oldCat);

      if (!hasChanges) {
        this.showNotification('No significant simplifications proposed by AI.', 'info');
        return;
      }

      // Prepare confirmation message
      let confirmationMessage = 'AI proposes the following category simplifications:\n\n';
      for (const oldCat in categoryMap) {
        if (categoryMap[oldCat] !== oldCat) { // Only show actual changes
          confirmationMessage += `"${oldCat}" -> "${categoryMap[oldCat]}"\n`;
        }
      }
      confirmationMessage += '\nDo you want to apply these changes?';

      if (!confirm(confirmationMessage)) {
        this.showNotification('Category simplification cancelled.', 'info');
        return;
      }

      // Update cache
      this.predefinedCache.categorizedTabs = simplifiedTabs;
      this.predefinedCache.categories = simplifiedCategories;

      // Re-render the tree
      const container = document.getElementById('predefinedCategoryTree');
      this.renderCategoryTree(this.predefinedCache.categorizedTabs, container, 'Predefined Categories (Simplified)');

      this.showNotification('Categories have been simplified.', 'success');

    } catch (error) {
      console.error('Error simplifying categories:', error);
      this.showNotification(`Failed to simplify categories: ${error.message}`, 'error');
    } finally {
      simplifyBtn.disabled = false;
      simplifyBtn.textContent = originalBtnText;
    }
  }

  handleCreateAllGroups() {
    // TODO: Implement logic for creating all groups
    console.log('Create All Groups button clicked');
    this.showNotification('Funkcjonalność "Create all groups" nie jest jeszcze zaimplementowana.', 'info');
  }
}