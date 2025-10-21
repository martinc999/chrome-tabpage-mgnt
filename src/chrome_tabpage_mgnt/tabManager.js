// tabManager.js
class TabManager {
  constructor() {
    this.tabs = [];
    this.filteredTabs = [];
  }

  async loadAllTabs() {
    try {
      const windows = await chrome.windows.getAll({ populate: true });
      this.tabs = [];

      for (const window of windows) {
        for (const tab of window.tabs) {
          if (tab.groupId === -1) {
            const tabData = await this.enrichTabData(tab, window.id);
            this.tabs.push(tabData);
          }
        }
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
      description: await this.extractPageDescription(tab),
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
      // Remove newlines from the description to ensure it's a single line.
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
      url.startsWith('about:');
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
      // Remove tabs from the Chrome browser
      await chrome.tabs.remove(tabIds);
      
      // Update internal tabs array to reflect the closed tabs
      this.tabs = this.tabs.filter(tab => !tabIds.includes(tab.id));
      this.filteredTabs = this.filteredTabs.filter(tab => !tabIds.includes(tab.id));
      
      console.log(`Successfully closed ${tabIds.length} tabs`);
      return true;
    } catch (error) {
      console.error('Failed to close tabs:', error);
      throw error;
    }
  }


  // tabManager.js - Based on working window creation version
  async moveTabsToWindow(tabIds, categoryName) {
    try {
      if (tabIds.length === 0) {
        throw new Error('No tabs to move');
      }

      // Check if a group with this name already exists
      const existingGroups = await chrome.tabGroups.query({ title: categoryName });

      if (existingGroups.length > 0) {
        // Group exists, move tabs to it
        const targetGroup = existingGroups[0];
        const targetWindowId = targetGroup.windowId;
        console.log(`Moving ${tabIds.length} tabs to existing group "${categoryName}" in window ${targetWindowId}`);

        // Move tabs to the window of the existing group
        const movedTabsResult = await chrome.tabs.move(tabIds, { windowId: targetWindowId, index: -1 });
        const movedTabIds = Array.isArray(movedTabsResult) ? movedTabsResult.map(t => t.id) : [movedTabsResult.id];

        // Add tabs to the existing group
        await chrome.tabs.group({
          groupId: targetGroup.id,
          tabIds: movedTabIds
        });
        
        // Focus the window
        await chrome.windows.update(targetWindowId, { focused: true });

        // Update internal state
        movedTabIds.forEach(tabId => {
            const existingTab = this.tabs.find(t => t.id === tabId);
            if (existingTab) {
                existingTab.windowId = targetWindowId;
            }
        });

        console.log(`Successfully moved ${movedTabIds.length} tabs to existing group.`);
        const movedTabs = await Promise.all(movedTabIds.map(id => chrome.tabs.get(id)));
        const targetWindow = await chrome.windows.get(targetWindowId);

        return {
          success: true,
          movedTabs,
          newWindow: targetWindow, // Not a new window, but returning for consistency
          tabGroup: targetGroup
        };

      } else {
        // Group does not exist, create a new window and group
        console.log(`Moving ${tabIds.length} tabs to new window for category: ${categoryName}`);
        
        const firstTabId = tabIds[0];
        const remainingTabIds = tabIds.slice(1);
        
        console.log('Creating new window with first tab:', firstTabId);
        const newWindow = await chrome.windows.create({
          tabId: firstTabId,
          focused: true
        });
        
        console.log('New window created successfully:', newWindow.id);
        const movedTabs = [await chrome.tabs.get(firstTabId)];

        if (remainingTabIds.length > 0) {
          console.log('Moving remaining tabs:', remainingTabIds);
          try {
            const additionalMovedTabs = await chrome.tabs.move(remainingTabIds, {
              windowId: newWindow.id,
              index: -1
            });

            if (Array.isArray(additionalMovedTabs)) {
              additionalMovedTabs.forEach(tab => movedTabs.push(tab));
            } else {
              movedTabs.push(additionalMovedTabs);
            }
          } catch (moveError) {
            console.error('Error moving remaining tabs:', moveError);
          }
        }

        console.log('All tabs moved to new window:', movedTabs.length);

        await new Promise(resolve => setTimeout(resolve, 500));

        const currentTabsInWindow = await chrome.tabs.query({ windowId: newWindow.id });
        console.log('Current tabs in window:', currentTabsInWindow.length);

        let tabGroup = null;
        if (currentTabsInWindow.length > 0) {
          console.log('Attempting to create tab group...');
          
          try {
            const tabIdsToGroup = currentTabsInWindow.map(tab => tab.id);
            console.log('Tab IDs to group:', tabIdsToGroup);

            if (chrome.tabs.group) {
              try {
                console.log('Using chrome.tabs.group API');
                const groupId = await chrome.tabs.group({
                  tabIds: tabIdsToGroup
                });
                
                console.log('Group created with ID:', groupId);
                
                await chrome.tabGroups.update(groupId, {
                  title: categoryName,
                  color: 'blue'
                });
                
                tabGroup = await chrome.tabGroups.get(groupId);
                console.log('Tab group created successfully:', tabGroup);
                
              } catch (groupError) {
                console.error('tabs.group failed:', groupError);
              }
            }
          } catch (error) {
            console.error('Tab group creation failed:', error);
          }
        }

        movedTabs.forEach(tab => {
          const existingTab = this.tabs.find(t => t.id === tab.id);
          if (existingTab) {
            existingTab.windowId = newWindow.id;
          }
        });

        console.log(`Successfully moved ${movedTabs.length} tabs to new window`);
        return {
          success: true,
          movedTabs,
          newWindow,
          tabGroup
        };
      }
    } catch (error) {
      console.error('Failed to move tabs to new window:', error);
      throw error;
    }
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
}