// uiManager.js - Fixed Favicon CORS Issues
class UIManager {
  constructor(tabManager) {
    this.tabManager = tabManager;
    this.faviconCache = new Map();
  }

  showLoadingState() {
    const tabsList = document.getElementById('tabsList');
    const tabCount = document.getElementById('tabCount');
    
    tabsList.innerHTML = '<div class="loading-state">🔄 Scanning browser tabs...</div>';
    tabCount.textContent = 'Loading...';
  }

  renderTabList() {
    const container = document.getElementById('tabsList');
    const tabs = this.tabManager.filteredTabs;
    
    if (!tabs.length) {
      container.innerHTML = '<div class="no-results">No tabs match your search</div>';
      return;
    }

    const tabsByWindow = this.groupTabsByWindow(tabs);
    let html = '';

    Object.entries(tabsByWindow).forEach(([windowId, windowTabs]) => {
      html += this.renderWindowGroup(windowId, windowTabs);
    });

    container.innerHTML = html;
    this.attachTabEventListeners();
    this.attachFaviconErrorHandlers();
  }

  groupTabsByWindow(tabs) {
    return tabs.reduce((groups, tab) => {
      const windowId = tab.windowId;
      if (!groups[windowId]) groups[windowId] = [];
      groups[windowId].push(tab);
      return groups;
    }, {});
  }

  renderWindowGroup(windowId, tabs) {
    const activeTab = tabs.find(tab => tab.isActive);
    const pinnedTabs = tabs.filter(tab => tab.isPinned);
    
    return `
      <div class="window-group" data-window-id="${windowId}">
        <div class="window-header">
          <span class="window-toggle">▼</span>
          <span class="window-title">Window ${windowId}</span>
          <div class="window-stats">
            <span class="tab-count">${tabs.length} tabs</span>
            ${pinnedTabs.length ? `<span class="pinned-count">${pinnedTabs.length} pinned</span>` : ''}
          </div>
          <div class="window-actions">
            <button class="focus-window-btn" data-window-id="${windowId}">Focus</button>
          </div>
        </div>
        <div class="window-content">
          ${tabs.map(tab => this.renderTabItem(tab)).join('')}
        </div>
      </div>
    `;
  }

  renderTabItem(tab) {
    const activeClass = tab.isActive ? 'active' : '';
    const pinnedClass = tab.isPinned ? 'pinned' : '';
    const faviconUrl = this.getSafeFaviconUrl(tab);
    
    return `
      <div class="tab-item ${activeClass} ${pinnedClass}" data-tab-id="${tab.id}">
        <div class="tab-favicon">
          <img src="${faviconUrl}" alt="" loading="lazy" class="tab-favicon-img" data-domain="${tab.domain}" data-original-favicon="${tab.favicon}">
          ${tab.isPinned ? '<div class="pin-indicator">📌</div>' : ''}
        </div>
        <div class="tab-info">
          <div class="tab-title" title="${this.escapeHtml(tab.title)}">
            ${this.escapeHtml(this.truncateText(tab.title, 60))}
          </div>
          <div class="tab-domain">${tab.domain}</div>
          ${tab.description !== 'No description available' ? 
            `<div class="tab-description">${this.escapeHtml(this.truncateText(tab.description, 100))}</div>` : ''}
        </div>
        <div class="tab-actions">
          <button class="activate-tab-btn" data-tab-id="${tab.id}">Switch</button>
        </div>
      </div>
    `;
  }

  /**
   * Get safe favicon URL with fallback to Google Favicon API
   */
  getSafeFaviconUrl(tab) {
    // For chrome:// and other system URLs, use default icon immediately
    if (this.isSystemUrl(tab.url)) {
      return this.getDefaultFavicon();
    }

    // If we have a valid favicon URL from the tab, use it
    if (tab.favicon && tab.favicon.startsWith('data:')) {
      return tab.favicon;
    }

    // Use Google Favicon API as primary source (more reliable for CORS)
    if (tab.domain && tab.domain !== 'invalid-url') {
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(tab.domain)}&sz=32`;
    }

    return this.getDefaultFavicon();
  }

  isSystemUrl(url) {
    if (!url) return true;
    const systemPrefixes = ['chrome://', 'chrome-extension://', 'edge://', 'about:', 'devtools://'];
    return systemPrefixes.some(prefix => url.startsWith(prefix));
  }

  getDefaultFavicon() {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSIjZGRkIiByeD0iMiIvPgo8L3N2Zz4K';
  }

  attachFaviconErrorHandlers() {
    const defaultFavicon = this.getDefaultFavicon();
    
    document.querySelectorAll('.tab-favicon-img').forEach(img => {
      // Remove any existing error handler to prevent duplicates
      const newImg = img.cloneNode(true);
      img.parentNode.replaceChild(newImg, img);
      
      newImg.addEventListener('error', function(e) {
        const domain = this.getAttribute('data-domain');
        const originalFavicon = this.getAttribute('data-original-favicon');
        
        // Try original favicon if we were using Google API
        if (this.src.includes('google.com/s2/favicons') && originalFavicon && !originalFavicon.includes('google.com')) {
          console.log(`Google Favicon API failed for ${domain}, trying original: ${originalFavicon}`);
          this.src = originalFavicon;
          this.removeAttribute('data-original-favicon'); // Prevent infinite loop
        } else {
          // Ultimate fallback
          console.log(`All favicon sources failed for ${domain}, using default icon`);
          this.src = defaultFavicon;
        }
      }, { once: false }); // Allow multiple attempts
    });
  }

  attachTabEventListeners() {
    const container = document.getElementById('tabsList');
    
    // Window header toggle
    container.querySelectorAll('.window-header').forEach(header => {
      header.addEventListener('click', (e) => {
        if (e.target.closest('.window-actions')) return;
        
        const content = header.nextElementSibling;
        const toggle = header.querySelector('.window-toggle');
        
        if (content.style.display === 'none') {
          content.style.display = 'block';
          toggle.textContent = '▼';
        } else {
          content.style.display = 'none';
          toggle.textContent = '▶';
        }
      });
    });

    // Activate tab button
    container.querySelectorAll('.activate-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tabId = parseInt(e.target.dataset.tabId);
        this.tabManager.activateTab(tabId);
      });
    });

    // Tab item click
    container.querySelectorAll('.tab-item').forEach(item => {
      item.addEventListener('click', () => {
        const tabId = parseInt(item.dataset.tabId);
        this.tabManager.activateTab(tabId);
      });
    });

    // Focus window button
    container.querySelectorAll('.focus-window-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const windowId = parseInt(e.target.dataset.windowId);
        this.tabManager.focusWindow(windowId);
      });
    });
  }

  updateStatistics() {
    const stats = this.tabManager.getStatistics();
    document.getElementById('tabCount').textContent = 
      `${stats.totalTabs} tabs across ${stats.windowCount} window${stats.windowCount !== 1 ? 's' : ''}${stats.pinnedCount ? ` • ${stats.pinnedCount} pinned` : ''}`;
  }

  showError(message) {
    const container = document.getElementById('tabsList');
    container.innerHTML = `<div class="error-state">⚠️ ${message}</div>`;
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