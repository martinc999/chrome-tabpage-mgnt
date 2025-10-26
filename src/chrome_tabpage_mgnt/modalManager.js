// modalManager.js - Fixed Multi-Window Support
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
        container.innerHTML = '<div class="loading">🔄 Organizing tabs...</div>';

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

      html += /*html*/`
        <div class="category-group">
          <div class="category-header" data-category="${this.escapeHtml(categoryName)}">
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
    this.attachFaviconErrorHandlers(container);
  }

  renderCategoryTab(tab) {
    // Check if tab is a system page
    const isSystemPage = this.isSystemPage(tab.url);
    const systemPageClass = isSystemPage ? 'system-page' : '';
    const systemPageIndicator = isSystemPage ? '<span class="system-page-badge" title="System page - cannot be moved">🔒</span>' : '';
    
    return `
      <div class="category-tab-item ${systemPageClass}" data-tab-id="${tab.id}">
        <img src="${tab.favicon}" class="category-tab-favicon" alt="" data-default-favicon="true">
        <div class="category-tab-info">
          <div class="category-tab-title">${this.escapeHtml(this.truncateText(tab.title, 50))} ${systemPageIndicator}</div>
          <div class="category-tab-meta">
            <span class="category-tab-domain">${tab.domain}</span>
            <span class="category-tab-window">Window ${tab.windowId}</span>
            ${tab.isActive ? '<span class="category-tab-active">Active</span>' : ''}
          </div>
        </div>
      </div>
    `;
  }

  // Helper method to check if URL is a system page
  isSystemPage(url) {
    if (!url) return false;
    
    const systemPatterns = [
      'chrome://',
      'chrome-extension://',
      'edge://',
      'about:',
      'chrome-search://',
      'devtools://',
      'chrome://newtab/',
      'chrome://new-tab-page/',
      'edge://newtab/',
      'about:newtab',
      'about:blank'
    ];
    
    return systemPatterns.some(pattern => url.startsWith(pattern)) || url.length < 10;
  }

  // Handle favicon errors with proper event listeners
  attachFaviconErrorHandlers(container) {
    const defaultFavicon = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSIjZGRkIiByeD0iMiIvPgo8L3N2Zz4K';
    
    container.querySelectorAll('.category-tab-favicon[data-default-favicon]').forEach(img => {
      img.addEventListener('error', function() {
        this.src = defaultFavicon;
        this.removeAttribute('data-default-favicon');
      });
    });
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

    // Handle category renaming
    container.querySelectorAll('.category-name').forEach(nameSpan => {
      nameSpan.addEventListener('dblclick', () => {
        const oldName = nameSpan.textContent;
        nameSpan.setAttribute('contenteditable', 'true');
        nameSpan.setAttribute('data-original-name', oldName);
        nameSpan.focus();
        
        // Select all text
        const range = document.createRange();
        range.selectNodeContents(nameSpan);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        const onFinishEditing = (e) => {
          nameSpan.removeEventListener('blur', onFinishEditing);
          nameSpan.removeEventListener('keydown', onKeyDown);
          nameSpan.setAttribute('contenteditable', 'false');

          const newName = nameSpan.textContent.trim();
          if (e.key !== 'Escape' && newName !== oldName) {
            this.handleRenameCategory(nameSpan, oldName, newName);
          } else {
            nameSpan.textContent = oldName;
          }
        };

        const onKeyDown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.target.blur();
          } else if (e.key === 'Escape') {
            e.target.blur();
          }
        };

        nameSpan.addEventListener('blur', onFinishEditing);
        nameSpan.addEventListener('keydown', onKeyDown);
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

  handleRenameCategory(nameSpanElement, oldName, newName) {
    console.log(`Attempting to rename category from "${oldName}" to "${newName}"`);

    // Validation
    if (!newName) {
      this.showNotification('Category name cannot be empty.', 'error');
      nameSpanElement.textContent = oldName;
      return;
    }

    if (this.predefinedCache.categorizedTabs[newName]) {
      this.showNotification(`Category "${newName}" already exists.`, 'error');
      nameSpanElement.textContent = oldName;
      return;
    }

    // Update cache: categorizedTabs
    this.predefinedCache.categorizedTabs[newName] = this.predefinedCache.categorizedTabs[oldName];
    delete this.predefinedCache.categorizedTabs[oldName];

    // Update cache: categories array
    const categoryIndex = this.predefinedCache.categories.indexOf(oldName);
    if (categoryIndex > -1) {
      this.predefinedCache.categories[categoryIndex] = newName;
    } else {
      this.predefinedCache.categories.push(newName);
    }

    // Update DOM attributes
    const header = nameSpanElement.closest('.category-header');
    if (header) {
      header.dataset.category = newName;
      header.querySelector('.move-category-to-window-btn').dataset.categoryName = newName;
      header.querySelector('.close-category-tabs-btn').dataset.categoryName = newName;
    }

    this.showNotification(`Category renamed to "${newName}"`, 'success');
    console.log('Category renamed successfully. New cache:', this.predefinedCache);
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

    // Only show confirmation for manual single category moves, not during "Create All Groups"
    if (showConfirmation && !confirm(`Move all ${categoryName} tabs (${tabsToMove.length} tabs) to a new window with a tab group?`)) {
      return;
    }

    try {
      const button = container.querySelector(`.move-category-to-window-btn[data-category-name="${this.escapeHtml(categoryName)}"]`);
      if (button) {
        button.textContent = 'Moving...';
        button.disabled = true;
      }

      console.log('Calling tabManager.moveTabsToWindow...');

      const result = await this.tabManager.moveTabsToWindow(tabIdsToMove, categoryName);

      console.log('moveTabsToWindow result:', result);

      if (result.success) {
        console.log('Successfully moved tabs, updating UI...');

        delete cache.categorizedTabs[categoryName];
        const categoryGroup = container.querySelector(`.category-header[data-category="${categoryName}"]`)?.parentElement;
        if (categoryGroup) {
          categoryGroup.remove();
        }

        if (window.tabAnalyzer?.uiManager) {
          window.tabAnalyzer.uiManager.updateStatistics();
        }

        // Only log to console, don't show notification for each group
        const movedCount = result.movedTabs.length;
        const skippedCount = tabsToMove.length - movedCount;
        
        if (skippedCount > 0) {
          console.log(`✓ Moved ${movedCount} tabs to "${categoryName}" group (${skippedCount} system/new-tab pages skipped)`);
        } else {
          console.log(`✓ Successfully moved ${movedCount} tabs to "${categoryName}" group`);
        }
      } else {
        throw new Error('Move operation returned success: false');
      }

    } catch (error) {
      console.error(`Failed to move tabs for category ${categoryName}:`, error);
      
      // Provide more helpful error messages
      let errorMsg = error.message;
      if (errorMsg.includes('system/new-tab pages')) {
        errorMsg = 'Cannot move system pages or new tab pages. These tabs have been skipped.';
      }
      
      this.showNotification(`Error moving tabs: ${errorMsg}`, 'error');

      const button = container.querySelector(`.move-category-to-window-btn[data-category-name="${this.escapeHtml(categoryName)}"]`);
      if (button) {
        button.textContent = '🪟 Move to New Window';
        button.disabled = false;
      }
    }
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

      const categoryGroup = container.querySelector(`.category-header[data-category="${categoryName}"]`)?.parentElement;
      if (categoryGroup) {
        categoryGroup.remove();
      }

      delete cache.categorizedTabs[categoryName];

    } catch (error) {
      console.error(`Failed to close tabs for category ${categoryName}:`, error);
      alert(`An error occurred while closing tabs for ${categoryName}.`);
    }
  }

  showNotification(message, type = 'info') {
    if (window.tabAnalyzer && typeof window.tabAnalyzer.showNotification === 'function') {
      window.tabAnalyzer.showNotification(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
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

      const hasChanges = Object.keys(categoryMap).some(oldCat => categoryMap[oldCat] !== oldCat);

      if (!hasChanges) {
        this.showNotification('No significant simplifications proposed by AI.', 'info');
        return;
      }

      let confirmationMessage = 'AI proposes the following category simplifications:\n\n';
      for (const oldCat in categoryMap) {
        if (categoryMap[oldCat] !== oldCat) {
          confirmationMessage += `"${oldCat}" -> "${categoryMap[oldCat]}"\n`;
        }
      }
      confirmationMessage += '\nDo you want to apply these changes?';

      if (!confirm(confirmationMessage)) {
        this.showNotification('Category simplification cancelled.', 'info');
        return;
      }

      this.predefinedCache.categorizedTabs = simplifiedTabs;
      this.predefinedCache.categories = simplifiedCategories;

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

  async handleCreateAllGroups() {
    console.log('Create All Groups button clicked');
    const categorizedTabs = this.predefinedCache.categorizedTabs;
    const container = document.getElementById('predefinedCategoryTree');

    if (!categorizedTabs || Object.keys(categorizedTabs).length === 0) {
      this.showNotification('No categories to create groups for.', 'info');
      return;
    }

    const categoryCount = Object.keys(categorizedTabs).length;
    if (!confirm(`Are you sure you want to create groups for all ${categoryCount} categories? This will move tabs to new or existing windows.`)) {
      return;
    }

    const createAllBtn = document.getElementById('createAllGroupsBtn');
    const originalBtnText = createAllBtn.textContent;
    createAllBtn.disabled = true;

    try {
      const result = await this.createGroupsSequentially(categorizedTabs, container, (processed, total, currentCategory) => {
        createAllBtn.textContent = `Creating ${processed}/${total}...`;
        console.log(`Progress: ${processed}/${total} - Processing "${currentCategory}"`);
      });

      // After all groups are created, refresh the tab list
      console.log('All groups created, refreshing tab list...');
      await this.tabManager.loadAllTabs();
      
      if (window.tabAnalyzer?.uiManager) {
        window.tabAnalyzer.uiManager.updateStatistics();
        window.tabAnalyzer.uiManager.renderTabList();
      }

      if (result.failureCount > 0) {
        this.showNotification(
          `Finished creating groups. Success: ${result.successCount}, Failed: ${result.failureCount}.`,
          'warning'
        );
      } else {
        this.showNotification(
          `Successfully created all ${result.successCount} tab groups! All ungrouped tabs have been organized.`,
          'success'
        );
      }

      // Close modal if all categories processed
      if (Object.keys(this.predefinedCache.categorizedTabs).length === 0) {
        this.closeModal('predefinedCategoriesModal');
      }

    } catch (error) {
      console.error('Error in group creation process:', error);
      this.showNotification('Failed to create groups. Check console for details.', 'error');
    } finally {
      createAllBtn.disabled = false;
      createAllBtn.textContent = originalBtnText;
    }
  }

  async createGroupsSequentially(groupedTabs, container, progressCallback = null) {
    const categories = Object.keys(groupedTabs);
    const totalCategories = categories.length;
    let processedCategories = 0;
    const results = [];

    console.log(`\n=== Starting sequential group creation for ${totalCategories} categories ===`);

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

      console.log(`\n--- Processing category: "${category}" (${tabs.length} tabs) ---`);

      try {
        const tabIds = [];
        for (const tab of tabs) {
          try {
            await chrome.tabs.get(tab.id);
            tabIds.push(tab.id);
          } catch (error) {
            console.warn(`Tab ${tab.id} (${tab.title}) no longer exists, skipping`);
          }
        }

        if (tabIds.length === 0) {
          console.warn(`No valid tabs found for category: ${category}`);
          results.push({
            category,
            success: false,
            error: 'No valid tabs found',
            skipped: true
          });
          processedCategories++;
          if (progressCallback) {
            progressCallback(processedCategories, totalCategories, category);
          }
          continue;
        }

        console.log(`Moving ${tabIds.length} tabs to group "${category}"`);

        try {
          await this.handleMoveCategoryToWindow(category, container, false);
          
          results.push({
            category,
            success: true,
            tabCount: tabIds.length
          });

          console.log(`✓ Successfully created group "${category}" with ${tabIds.length} tabs`);
        } catch (moveError) {
          console.error(`✗ Failed to move tabs for "${category}":`, moveError);
          results.push({
            category,
            success: false,
            error: moveError.message,
            tabCount: tabIds.length
          });
        }

        await new Promise(resolve => setTimeout(resolve, 1500));

      } catch (error) {
        console.error(`✗ Unexpected error for category "${category}":`, error);
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

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`\n=== Group Creation Summary ===`);
    console.log(`Total categories: ${totalCategories}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failureCount}`);

    results.forEach(result => {
      if (result.success) {
        console.log(`  ✓ ${result.category}: ${result.tabCount} tabs`);
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
}