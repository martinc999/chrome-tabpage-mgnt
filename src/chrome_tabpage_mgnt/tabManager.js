// tabManager.js - Fixed Multi-Window Support
class TabManager {
  constructor() {
    this.tabs = [];
    this.filteredTabs = [];
  }

  async loadAllTabs() {
    try {
      const windows = await chrome.windows.getAll({ populate: true });
      this.tabs = [];
      let skippedSystemTabs = 0;
      let skippedGroupedTabs = 0;

      console.log(`TabManager: Loading tabs from ${windows.length} windows`);

      for (const window of windows) {
        console.log(`TabManager: Processing window ${window.id} with ${window.tabs.length} tabs`);

        for (const tab of window.tabs) {
          // Skip tabs that are already grouped
          if (tab.groupId !== -1) {
            skippedGroupedTabs++;
            continue;
          }

          // Skip system pages and new tab pages
          if (!this.isMovableTab(tab)) {
            skippedSystemTabs++;
            continue;
          }

          const tabData = await this.enrichTabData(tab, window.id);
          this.tabs.push(tabData);
        }
      }

      console.log(`TabManager: Loaded ${this.tabs.length} ungrouped tabs from ${windows.length} windows`);
      if (skippedGroupedTabs > 0) {
        console.log(`TabManager: Skipped ${skippedGroupedTabs} already-grouped tabs`);
      }
      if (skippedSystemTabs > 0) {
        console.log(`TabManager: Skipped ${skippedSystemTabs} system/new-tab pages`);
      }

      this.filteredTabs = [...this.tabs];
      return this.tabs;

    } catch (error) {
      console.error('Failed to load tabs:', error);
      throw error;
    }
  }

  async enrichTabData(tab, windowId) {
    const enrichedTab = {
      id: tab.id,
      windowId: windowId,
      title: tab.title || 'Untitled',
      url: tab.url || '',
      favicon: tab.favIconUrl || this.getDefaultFavicon(),
      isActive: tab.active,
      isPinned: tab.pinned,
      description: 'Description will be loaded on demand', // Placeholder
      domain: this.extractDomain(tab.url),
      category: 'uncategorized'
    };

    return enrichedTab;
  }

  async extractPageDescription(tab) {
    if (this.isSystemPage(tab.url)) {
      return 'System page';
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: this.getPageMetadata
      });

      const description = results[0]?.result?.description || 'No description available';
      return description.replace(/(\r\n|\n|\r)/gm, " ").trim();
    } catch {
      return 'Content not accessible';
    }
  }

  getPageMetadata() {
    const selectors = [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]'
    ];

    for (const selector of selectors) {
      const meta = document.querySelector(selector);
      if (meta?.content?.trim()) {
        return { description: meta.content.trim().substring(0, 150) };
      }
    }

    const paragraphs = document.querySelectorAll('p, article p, main p');
    for (const p of paragraphs) {
      const text = p.textContent?.trim();
      if (text && text.length > 50) {
        return { description: text.substring(0, 150) };
      }
    }

    return { description: 'No description available' };
  }

  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return 'invalid-url';
    }
  }

  isSystemPage(url) {
    return url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('edge://') ||
      url.startsWith('about:') ||
      url.startsWith('chrome-search://') ||
      url.startsWith('devtools://');
  }

  /**
   * Check if a tab can be moved/grouped
   * New tab pages and system pages cannot be manipulated
   */
  isMovableTab(tab) {
    // System pages cannot be moved
    if (this.isSystemPage(tab.url)) {
      return false;
    }

    // Check for new tab pages (various patterns)
    const newTabPatterns = [
      'chrome://newtab/',
      'chrome://new-tab-page/',
      'edge://newtab/',
      'about:newtab',
      'about:blank'
    ];

    for (const pattern of newTabPatterns) {
      if (tab.url.startsWith(pattern)) {
        return false;
      }
    }

    // Check if URL is empty or just a protocol
    if (!tab.url || tab.url === 'about:blank' || tab.url.length < 10) {
      return false;
    }

    return true;
  }

  getDefaultFavicon() {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSIjZGRkIiByeD0iMiIvPgo8L3N2Zz4K';
  }

  filterTabs(searchTerm) {
    const term = searchTerm.toLowerCase().trim();

    if (!term) {
      this.filteredTabs = [...this.tabs];
    } else {
      this.filteredTabs = this.tabs.filter(tab =>
        tab.title.toLowerCase().includes(term) ||
        tab.url.toLowerCase().includes(term) ||
        tab.domain.toLowerCase().includes(term) ||
        tab.description.toLowerCase().includes(term)
      );
    }

    return this.filteredTabs;
  }

  async activateTab(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      await chrome.tabs.update(tabId, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
      window.close();
    } catch (error) {
      console.error('Failed to activate tab:', error);
      throw error;
    }
  }

  async focusWindow(windowId) {
    try {
      await chrome.windows.update(windowId, { focused: true });
      window.close();
    } catch (error) {
      console.error('Failed to focus window:', error);
      throw error;
    }
  }

  async closeTabs(tabIds) {
    try {
      await chrome.tabs.remove(tabIds);
      this.tabs = this.tabs.filter(tab => !tabIds.includes(tab.id));
      this.filteredTabs = this.filteredTabs.filter(tab => !tabIds.includes(tab.id));

      console.log(`Successfully closed ${tabIds.length} tabs`);
      return true;
    } catch (error) {
      console.error('Failed to close tabs:', error);
      throw error;
    }
  }

  async windowExists(windowId) {
    try {
      await chrome.windows.get(windowId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Move tabs to window and create group with robust error handling
   * @param {number[]} tabIds - Array of tab IDs to move
   * @param {string} categoryName - Name of the category/group
   * @returns {Promise<Object>} Result object
   */
  async moveTabsToWindow(tabIds, categoryName) {
    try {
      if (tabIds.length === 0) {
        throw new Error('No tabs to move');
      }

      console.log(`\n=== TabManager: Processing category "${categoryName}" with ${tabIds.length} tabs ===`);

      // STEP 1: Verify all tabs exist and collect ONLY movable tabs
      const validTabs = [];
      const skippedTabs = [];

      for (const tabId of tabIds) {
        try {
          const tab = await chrome.tabs.get(tabId);

          // Check if tab can be moved
          if (!this.isMovableTab(tab)) {
            console.warn(`TabManager: Tab ${tabId} "${tab.title}" is a system/new-tab page, skipping`);
            skippedTabs.push({ id: tab.id, title: tab.title, url: tab.url, reason: 'system_page' });
            continue;
          }

          validTabs.push(tab);
        } catch (error) {
          console.warn(`TabManager: Tab ${tabId} no longer exists, skipping`);
          skippedTabs.push({ id: tabId, reason: 'not_found' });
        }
      }

      // Log skipped tabs summary
      if (skippedTabs.length > 0) {
        console.log(`TabManager: Skipped ${skippedTabs.length} tabs (system/new-tab pages):`);
        skippedTabs.forEach(tab => {
          if (tab.title) {
            console.log(`  - "${tab.title}" (${tab.url})`);
          } else {
            console.log(`  - Tab ID ${tab.id} (${tab.reason})`);
          }
        });
      }

      if (validTabs.length === 0) {
        const message = skippedTabs.length > 0
          ? 'No movable tabs found (all tabs are system/new-tab pages)'
          : 'No valid tabs found to move';
        throw new Error(message);
      }

      console.log(`TabManager: Found ${validTabs.length} valid movable tabs (${skippedTabs.length} skipped)`);

      // STEP 2: Check if group with this name already exists
      const existingGroups = await chrome.tabGroups.query({ title: categoryName });
      let targetWindowId = null;
      let targetGroupId = null;

      if (existingGroups.length > 0) {
        // Find first valid existing group
        for (const group of existingGroups) {
          if (await this.windowExists(group.windowId)) {
            targetWindowId = group.windowId;
            targetGroupId = group.id;
            console.log(`TabManager: Found existing group "${categoryName}" in window ${targetWindowId}`);
            break;
          } else {
            console.warn(`TabManager: Group "${categoryName}" exists but window ${group.windowId} is invalid, ignoring`);
          }
        }
      }

      // STEP 3: Create new window if needed
      if (!targetWindowId) {
        console.log(`TabManager: Creating new window for category "${categoryName}"`);
        const firstTab = validTabs[0];

        const newWindow = await chrome.windows.create({
          tabId: firstTab.id,
          focused: true
        });

        targetWindowId = newWindow.id;

        // Remove first tab from list (already in new window)
        validTabs.shift();

        console.log(`TabManager: Created new window ${targetWindowId}`);

        // Wait for window to stabilize
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // STEP 4: Verify target window still exists before moving tabs
      if (!await this.windowExists(targetWindowId)) {
        throw new Error(`Target window ${targetWindowId} no longer exists`);
      }

      // STEP 5: Move ALL remaining tabs to target window FIRST
      console.log(`TabManager: Moving ${validTabs.length} tabs to window ${targetWindowId}`);
      const movedTabIds = [];

      if (validTabs.length > 0) {
        const tabIdsToMove = validTabs.map(t => t.id);

        // Move in batches to avoid overwhelming the API
        const batchSize = 10;
        for (let i = 0; i < tabIdsToMove.length; i += batchSize) {
          const batch = tabIdsToMove.slice(i, i + batchSize);

          try {
            // Verify window still exists before each batch
            if (!await this.windowExists(targetWindowId)) {
              throw new Error(`Window ${targetWindowId} closed during tab move operation`);
            }

            const movedTabs = await chrome.tabs.move(batch, {
              windowId: targetWindowId,
              index: -1
            });

            const movedIds = Array.isArray(movedTabs)
              ? movedTabs.map(t => t.id)
              : [movedTabs.id];

            movedTabIds.push(...movedIds);
            console.log(`TabManager: Moved batch ${Math.floor(i / batchSize) + 1}, total moved: ${movedTabIds.length}`);

            // Small delay between batches
            if (i + batchSize < tabIdsToMove.length) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          } catch (error) {
            console.error(`TabManager: Error moving batch:`, error);
            // Don't throw here, continue with what we have
          }
        }
      }

      // STEP 6: Get all tabs in the target window that belong to this category
      const allTabsInWindow = await chrome.tabs.query({ windowId: targetWindowId });
      const originalTabIds = tabIds;
      const finalTabIdsToGroup = allTabsInWindow
        .filter(tab => originalTabIds.includes(tab.id))
        .map(tab => tab.id);

      console.log(`TabManager: All tabs moved. Found ${finalTabIdsToGroup.length} tabs to group in window ${targetWindowId}`);

      // Wait for tabs to settle before grouping
      await new Promise(resolve => setTimeout(resolve, 2000));

      // STEP 7: Verify window still exists before grouping
      if (!await this.windowExists(targetWindowId)) {
        throw new Error(`Window ${targetWindowId} was closed before grouping could complete`);
      }

      // STEP 8: NOW create/update the group with ALL tabs at once
      let tabGroup = null;
      if (finalTabIdsToGroup.length > 0) {
        try {
          if (targetGroupId) {
            // Add to existing group
            console.log(`TabManager: Adding ${finalTabIdsToGroup.length} tabs to existing group ${targetGroupId}`);
            await chrome.tabs.group({
              groupId: targetGroupId,
              tabIds: finalTabIdsToGroup
            });
            tabGroup = await chrome.tabGroups.get(targetGroupId);
          } else {
            // Create new group with ALL tabs at once
            console.log(`TabManager: Creating new group "${categoryName}" with ${finalTabIdsToGroup.length} tabs`);
            const groupId = await chrome.tabs.group({
              tabIds: finalTabIdsToGroup
            });

            await chrome.tabGroups.update(groupId, {
              title: categoryName,
              color: this.getRandomColor(),
              collapsed: false
            });

            tabGroup = await chrome.tabGroups.get(groupId);
            console.log(`TabManager: Group created successfully with ID ${groupId}`);
          }
        } catch (error) {
          console.error(`TabManager: Failed to create/update group:`, error);
          throw error;
        }
      }

      // STEP 9: Update internal state - REMOVE grouped tabs from internal list
      finalTabIdsToGroup.forEach(tabId => {
        const tabIndex = this.tabs.findIndex(t => t.id === tabId);
        if (tabIndex !== -1) {
          this.tabs.splice(tabIndex, 1);
        }
        const filteredIndex = this.filteredTabs.findIndex(t => t.id === tabId);
        if (filteredIndex !== -1) {
          this.filteredTabs.splice(filteredIndex, 1);
        }
      });

      console.log(`TabManager: Removed ${finalTabIdsToGroup.length} grouped tabs from internal list`);

      // STEP 10: Focus the window (with error handling)
      try {
        // Verify one more time before focusing
        if (await this.windowExists(targetWindowId)) {
          await chrome.windows.update(targetWindowId, { focused: true });
        } else {
          console.warn('TabManager: Window closed before focus, skipping focus step');
        }
      } catch (error) {
        console.warn('TabManager: Failed to focus window (window may be closed):', error.message);
        // Don't throw - the operation was successful, just couldn't focus
      }

      // STEP 11: Get final window state
      let targetWindow;
      try {
        targetWindow = await chrome.windows.get(targetWindowId);
      } catch (error) {
        console.warn('TabManager: Window closed after grouping, using cached data');
        targetWindow = { id: targetWindowId };
      }

      const finalMovedTabs = await Promise.all(
        finalTabIdsToGroup.map(id => chrome.tabs.get(id).catch(() => null))
      ).then(tabs => tabs.filter(t => t !== null));

      console.log(`TabManager: ✓ Successfully processed "${categoryName}": ${finalMovedTabs.length} tabs grouped\n`);

      return {
        success: true,
        movedTabs: finalMovedTabs,
        newWindow: targetWindow,
        tabGroup
      };

    } catch (error) {
      console.error(`TabManager: ✗ Failed to process category:`, error);
      throw error;
    }
  }

  getRandomColor() {
    const colors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  getStatistics() {
    const windowCount = new Set(this.tabs.map(tab => tab.windowId)).size;
    const pinnedCount = this.tabs.filter(tab => tab.isPinned).length;

    return {
      totalTabs: this.tabs.length,
      windowCount,
      pinnedCount
    };
  }

  async getTabGroupTitles() {
    try {
      if (chrome.tabGroups && typeof chrome.tabGroups.query === 'function') {
        const groups = await chrome.tabGroups.query({});
        const titles = groups.map(g => g.title).filter(t => t && t.trim() !== '');
        return [...new Set(titles)];
      }
      return [];
    } catch (e) {
      console.warn("Could not query tab groups to get titles.", e);
      return [];
    }
  }
}