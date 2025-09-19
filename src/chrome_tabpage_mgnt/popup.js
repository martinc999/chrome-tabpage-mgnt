class TabScanner {
  constructor() {
    this.tabs = [];
    this.filteredTabs = [];
    this.aiSession = null;
    this.init();
  }

  async init() {
    await this.loadTabs();
    await this.initializeAI();
    this.setupEventListeners();
    this.renderTabs();
  }

  async loadTabs() {
    try {
      // Get all windows and their tabs
      const windows = await chrome.windows.getAll({ populate: true });
      this.tabs = [];
      
      for (const window of windows) {
        for (const tab of window.tabs) {
          const tabInfo = {
            id: tab.id,
            windowId: window.id,
            title: tab.title,
            url: tab.url,
            favIconUrl: tab.favIconUrl,
            active: tab.active,
            description: await this.getTabDescription(tab)
          };
          this.tabs.push(tabInfo);
        }
      }
      
      this.filteredTabs = [...this.tabs];
      this.updateStats();
    } catch (error) {
      console.error('Error loading tabs:', error);
    }
  }

  async getTabDescription(tab) {
    try {
      // Skip chrome:// and extension pages
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        return 'System page';
      }

      // Try to execute script to get page description
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Try to get meta description first
          const metaDesc = document.querySelector('meta[name="description"]');
          if (metaDesc && metaDesc.content) {
            return metaDesc.content.substring(0, 100);
          }
          
          // Fallback to first paragraph or text content
          const firstP = document.querySelector('p');
          if (firstP && firstP.textContent) {
            return firstP.textContent.substring(0, 100).trim();
          }
          
          // Last fallback to body text
          const bodyText = document.body.textContent || '';
          return bodyText.substring(0, 100).trim();
        }
      });

      return results[0]?.result || 'No description available';
    } catch (error) {
      return 'Unable to access page content';
    }
  }

  async initializeAI() {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    
    try {
      // Check if Prompt API is available
      if (!('ai' in window) || !('languageModel' in window.ai)) {
        this.updateAIStatus('ℹ️', 'Using built-in analysis (Chrome AI not available)', 'fallback');
        return;
      }

      // Check availability
      const availability = await window.ai.languageModel.capabilities();
      
      if (availability.available === 'no') {
        this.updateAIStatus('ℹ️', 'Using built-in analysis (AI model not available)', 'fallback');
        return;
      }

      if (availability.available === 'after-download') {
        this.updateAIStatus('⏳', 'AI model downloading...', 'downloading');
        // Wait for download
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Create AI session
      this.aiSession = await window.ai.languageModel.create({
        temperature: 0.7,
        topK: 3
      });

      this.updateAIStatus('✅', 'Chrome AI ready for tab analysis', 'ready');
      
    } catch (error) {
      console.error('AI initialization error:', error);
      this.updateAIStatus('ℹ️', 'Using built-in analysis (Chrome AI unavailable)', 'fallback');
    }
  }

  updateAIStatus(indicator, text, status) {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const promptSection = document.getElementById('promptSection');
    
    statusIndicator.textContent = indicator;
    statusText.textContent = text;
    
    // Always show prompt section - fallback analysis is available
    promptSection.style.display = 'block';
  }

  setupEventListeners() {
    // Refresh button
    document.getElementById('refreshButton').addEventListener('click', () => {
      this.loadTabs().then(() => this.renderTabs());
    });

    // Search functionality
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.filterTabs(e.target.value);
    });

    // Toolbar buttons
    document.getElementById('customPromptBtn').addEventListener('click', () => {
      document.getElementById('customPromptModal').style.display = 'flex';
    });

    document.getElementById('categoriesBtn').addEventListener('click', () => {
      document.getElementById('categoriesModal').style.display = 'flex';
    });

    // Modal close buttons
    document.getElementById('closePromptModal').addEventListener('click', () => {
      document.getElementById('customPromptModal').style.display = 'none';
    });

    document.getElementById('closeCategoriesModal').addEventListener('click', () => {
      document.getElementById('categoriesModal').style.display = 'none';
    });

    // Custom prompt submit
    document.getElementById('submitPrompt').addEventListener('click', () => {
      this.processCustomPrompt();
    });

    // Quick summary button
    document.getElementById('quickSummary').addEventListener('click', () => {
      this.processQuickSummary();
    });

    // New prompt button
    document.getElementById('newPrompt').addEventListener('click', () => {
      this.resetPromptInterface();
    });

    // Create groups button
    document.getElementById('createGroups').addEventListener('click', () => {
      this.createCategoryTree();
    });

    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
      }
    });
  }

  filterTabs(searchTerm) {
    const term = searchTerm.toLowerCase();
    this.filteredTabs = this.tabs.filter(tab => 
      tab.title.toLowerCase().includes(term) ||
      tab.url.toLowerCase().includes(term) ||
      tab.description.toLowerCase().includes(term)
    );
    this.renderTabs();
  }

  updateStats() {
    const windows = new Set(this.tabs.map(tab => tab.windowId)).size;
    document.getElementById('tabCount').textContent = 
      `${this.tabs.length} tabs in ${windows} windows`;
  }

  renderTabs() {
    const container = document.getElementById('tabsList');
    
    if (this.filteredTabs.length === 0) {
      container.innerHTML = '<div class="no-results">No tabs found</div>';
      return;
    }

    // Group tabs by window
    const tabsByWindow = {};
    this.filteredTabs.forEach(tab => {
      if (!tabsByWindow[tab.windowId]) {
        tabsByWindow[tab.windowId] = [];
      }
      tabsByWindow[tab.windowId].push(tab);
    });

    let html = '';
    Object.entries(tabsByWindow).forEach(([windowId, tabs]) => {
      html += `<div class="window-group">
        <div class="window-header" data-window-id="${windowId}">
          <span class="window-toggle">▼</span>
          <span>Window ${windowId} (${tabs.length} tabs)</span>
          <div class="window-toolbar">
            <button class="collapse-all" data-window-id="${windowId}">−</button>
          </div>
        </div>
        <div class="window-content" data-window-id="${windowId}">`;
      
      tabs.forEach(tab => {
        const favicon = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%23ddd"/></svg>';
        const shortUrl = this.shortenUrl(tab.url);
        const isActive = tab.active ? 'active' : '';
        
        html += `
          <div class="tab-item ${isActive}" data-tab-id="${tab.id}">
            <div class="tab-icon">
              <img src="${favicon}" alt="favicon" onerror="this.src='data:image/svg+xml,<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"16\\" height=\\"16\\"><rect width=\\"16\\" height=\\"16\\" fill=\\"%23ddd\\"/></svg>'">
            </div>
            <div class="tab-content">
              <div class="tab-title">${this.escapeHtml(tab.title)}</div>
              <div class="tab-url">${shortUrl}</div>
            </div>
            <div class="tab-actions">
              <button class="switch-btn" data-tab-id="${tab.id}">Switch</button>
            </div>
          </div>`;
      });
      
      html += '</div></div>';
    });

    container.innerHTML = html;

    // Add window toggle functionality
    container.querySelectorAll('.window-header').forEach(header => {
      header.addEventListener('click', (e) => {
        if (e.target.classList.contains('collapse-all')) return;
        
        const windowId = header.dataset.windowId;
        const content = container.querySelector(`.window-content[data-window-id="${windowId}"]`);
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

    // Add click listeners for switching tabs
    container.querySelectorAll('.switch-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tabId = parseInt(e.target.dataset.tabId);
        chrome.tabs.update(tabId, { active: true });
        chrome.tabs.get(tabId, (tab) => {
          chrome.windows.update(tab.windowId, { focused: true });
        });
        window.close();
      });
    });

    // Add click listeners for tab items
    container.querySelectorAll('.tab-item').forEach(item => {
      item.addEventListener('click', () => {
        const tabId = parseInt(item.dataset.tabId);
        chrome.tabs.update(tabId, { active: true });
        chrome.tabs.get(tabId, (tab) => {
          chrome.windows.update(tab.windowId, { focused: true });
        });
        window.close();
      });
    });
  }

  shortenUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url.substring(0, 30) + '...';
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  createCategoryTree() {
    const categories = ['Science', 'Entertainment', 'News', 'Technology', 'Social Media', 'Shopping', 'Education', 'Work'];
    const treeContainer = document.getElementById('categoryTree');
    
    // Hide the category list and create groups button
    document.getElementById('categoryList').style.display = 'none';
    document.getElementById('createGroups').style.display = 'none';
    
    // Show the tree
    treeContainer.style.display = 'block';
    
    let treeHtml = '<div class="tree-root">Categories</div>';
    
    categories.forEach(category => {
      // Randomly assign 2-4 tabs to each category
      const categoryTabs = this.getRandomTabs(2, 4);
      
      treeHtml += `
        <div class="tree-category">
          <div class="tree-category-header">
            <span class="tree-toggle">▼</span>
            <span class="tree-category-name">${category}</span>
            <span class="tree-count">(${categoryTabs.length})</span>
          </div>
          <div class="tree-category-content">`;
      
      categoryTabs.forEach(tab => {
        const favicon = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%23ddd"/></svg>';
        treeHtml += `
          <div class="tree-tab-item" data-tab-id="${tab.id}">
            <img src="${favicon}" class="tree-tab-icon" alt="favicon">
            <span class="tree-tab-title">${this.escapeHtml(tab.title)}</span>
            <span class="tree-window-info">Window ${tab.windowId}</span>
          </div>`;
      });
      
      treeHtml += '</div></div>';
    });
    
    treeContainer.innerHTML = treeHtml;
    
    // Add toggle functionality for tree categories
    treeContainer.querySelectorAll('.tree-category-header').forEach(header => {
      header.addEventListener('click', () => {
        const content = header.nextElementSibling;
        const toggle = header.querySelector('.tree-toggle');
        
        if (content.style.display === 'none') {
          content.style.display = 'block';
          toggle.textContent = '▼';
        } else {
          content.style.display = 'none';
          toggle.textContent = '▶';
        }
      });
    });
    
    // Add click functionality to tree tab items
    treeContainer.querySelectorAll('.tree-tab-item').forEach(item => {
      item.addEventListener('click', () => {
        const tabId = parseInt(item.dataset.tabId);
        chrome.tabs.update(tabId, { active: true });
        chrome.tabs.get(tabId, (tab) => {
          chrome.windows.update(tab.windowId, { focused: true });
        });
        window.close();
      });
    });
  }

  getRandomTabs(min, max) {
    const count = Math.floor(Math.random() * (max - min + 1)) + min;
    const shuffled = [...this.tabs].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, this.tabs.length));
  }

  async processCustomPrompt() {
    const prompt = document.getElementById('promptInput').value.trim();
    if (!prompt) {
      alert('Please enter a prompt first.');
      return;
    }

    this.showProcessingState();

    try {
      let response;
      
      if (this.aiSession) {
        // Use Chrome's built-in AI
        const tabData = await this.prepareTabDataForAI();
        const fullPrompt = this.buildFullPrompt(prompt, tabData);
        response = await this.aiSession.prompt(fullPrompt);
      } else {
        // Use fallback analysis
        response = await this.performFallbackAnalysis(prompt);
      }
      
      this.showResults(response);
      
    } catch (error) {
      console.error('Processing error:', error);
      this.showError('Error processing your request. Please try again.');
    }
  }

  async processQuickSummary() {
    this.showProcessingState();

    try {
      let response;
      
      if (this.aiSession) {
        // Use Chrome's built-in AI
        const tabData = await this.prepareTabDataForAI();
        const summaryPrompt = `Please provide a brief summary of what topics and activities these browser tabs represent. Group similar topics together and identify the main themes:

${tabData}`;
        response = await this.aiSession.prompt(summaryPrompt);
      } else {
        // Use fallback analysis
        response = this.generateFallbackSummary();
      }
      
      this.showResults(response);
      
    } catch (error) {
      console.error('Processing error:', error);
      this.showError('Error generating summary. Please try again.');
    }
  }

  async prepareTabDataForAI() {
    const includeContent = document.getElementById('includeContent').checked;
    const includeUrls = document.getElementById('includeUrls').checked;
    
    let tabData = `I have ${this.tabs.length} tabs open across ${new Set(this.tabs.map(t => t.windowId)).size} browser windows:\n\n`;
    
    for (let i = 0; i < Math.min(this.tabs.length, 20); i++) { // Limit to 20 tabs to avoid token limits
      const tab = this.tabs[i];
      tabData += `Tab ${i + 1}: "${tab.title}"`;
      
      if (includeUrls && tab.url) {
        const domain = new URL(tab.url).hostname;
        tabData += ` (${domain})`;
      }
      
      if (includeContent && tab.description && tab.description !== 'No description available') {
        tabData += ` - ${tab.description}`;
      }
      
      tabData += `\n`;
    }
    
    if (this.tabs.length > 20) {
      tabData += `\n... and ${this.tabs.length - 20} more tabs.`;
    }
    
    return tabData;
  }

  buildFullPrompt(userPrompt, tabData) {
    return `${userPrompt}

Here are my current browser tabs:
${tabData}

Please provide a helpful and organized response based on this information.`;
  }

  showProcessingState() {
    document.getElementById('promptSection').style.display = 'none';
    document.getElementById('promptStatus').style.display = 'block';
    document.getElementById('promptResults').style.display = 'none';
  }

  showResults(response) {
    document.getElementById('promptStatus').style.display = 'none';
    document.getElementById('promptResults').style.display = 'block';
    
    const resultsContent = document.getElementById('resultsContent');
    resultsContent.innerHTML = `<div class="ai-response">${this.formatAIResponse(response)}</div>`;
  }

  showError(message) {
    document.getElementById('promptStatus').style.display = 'none';
    document.getElementById('promptResults').style.display = 'block';
    
    const resultsContent = document.getElementById('resultsContent');
    resultsContent.innerHTML = `<div class="error-message">${message}</div>`;
  }

  resetPromptInterface() {
    document.getElementById('promptSection').style.display = 'block';
    document.getElementById('promptStatus').style.display = 'none';
    document.getElementById('promptResults').style.display = 'none';
    document.getElementById('promptInput').value = '';
  }

  formatAIResponse(response) {
    // Simple formatting: convert line breaks to HTML and handle basic formatting
    return response
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  }

  // Fallback analysis methods for when Chrome AI is not available
  async performFallbackAnalysis(prompt) {
    const analysis = this.analyzeTabs();
    const promptLower = prompt.toLowerCase();
    
    // Simple keyword-based responses
    if (promptLower.includes('summary') || promptLower.includes('summarize')) {
      return this.generateFallbackSummary();
    }
    
    if (promptLower.includes('category') || promptLower.includes('group') || promptLower.includes('organize')) {
      return this.generateCategoryAnalysis();
    }
    
    if (promptLower.includes('duplicate') || promptLower.includes('similar')) {
      return this.findSimilarTabs();
    }
    
    if (promptLower.includes('work') || promptLower.includes('productivity')) {
      return this.analyzeWorkTabs();
    }
    
    if (promptLower.includes('social') || promptLower.includes('entertainment')) {
      return this.analyzeSocialTabs();
    }
    
    // Default response with basic analysis
    return `**Tab Analysis Results:**

**Total Overview:**
- ${analysis.totalTabs} tabs across ${analysis.windowCount} windows
- ${analysis.domains.length} unique domains
- ${analysis.activeTabInfo}

**Top Domains:**
${analysis.topDomains.map(d => `• ${d.domain}: ${d.count} tab${d.count > 1 ? 's' : ''}`).join('\n')}

**Window Breakdown:**
${Object.entries(analysis.tabsByWindow).map(([windowId, tabs]) => 
  `• Window ${windowId}: ${tabs.length} tabs`).join('\n')}

*Note: For more advanced AI analysis, use Chrome Canary/Dev with AI features enabled.*`;
  }

  generateFallbackSummary() {
    const analysis = this.analyzeTabs();
    
    return `**Quick Summary of Your ${analysis.totalTabs} Open Tabs:**

**Main Categories Detected:**
${analysis.categories.map(cat => `• **${cat.name}**: ${cat.count} tabs (${cat.examples.join(', ')})`).join('\n')}

**Top Active Domains:**
${analysis.topDomains.slice(0, 5).map(d => `• ${d.domain} - ${d.count} tab${d.count > 1 ? 's' : ''}`).join('\n')}

**Browsing Pattern:**
${analysis.windowCount > 1 ? 
  `You have tabs spread across ${analysis.windowCount} windows, suggesting multitasking between different projects or topics.` :
  'All tabs are in a single window, indicating focused browsing on related topics.'}

**Recommendations:**
${analysis.recommendations.join('\n')}`;
  }

  generateCategoryAnalysis() {
    const analysis = this.analyzeTabs();
    
    return `**Tab Categorization:**

${analysis.categories.map(cat => `**${cat.name} (${cat.count} tabs):**
${cat.tabs.map(tab => `• ${tab.title.substring(0, 50)}${tab.title.length > 50 ? '...' : ''}`).join('\n')}
`).join('\n')}

**Organization Suggestions:**
• Consider bookmarking frequently visited sites
• Group related tabs into separate windows
• Close inactive tabs to improve browser performance`;
  }

  findSimilarTabs() {
    const analysis = this.analyzeTabs();
    const duplicates = [];
    
    // Find tabs with same domain
    const domainGroups = analysis.domains.filter(d => d.count > 1);
    
    domainGroups.forEach(domain => {
      const tabs = this.tabs.filter(tab => {
        try {
          return new URL(tab.url).hostname === domain.domain;
        } catch {
          return false;
        }
      });
      
      if (tabs.length > 1) {
        duplicates.push({
          domain: domain.domain,
          tabs: tabs,
          count: tabs.length
        });
      }
    });

    if (duplicates.length === 0) {
      return "**No Similar Tabs Found**\n\nAll your tabs appear to be from different domains with unique content.";
    }

    return `**Similar/Duplicate Tabs Found:**

${duplicates.map(dup => `**${dup.domain} (${dup.count} tabs):**
${dup.tabs.map(tab => `• ${tab.title}`).join('\n')}
`).join('\n')}

**Cleanup Suggestions:**
• Review these similar tabs and close unnecessary duplicates
• Keep only the most relevant version of each page
• Consider bookmarking important pages before closing`;
  }

  analyzeWorkTabs() {
    const workKeywords = ['docs', 'drive', 'office', 'excel', 'word', 'powerpoint', 'teams', 'slack', 'zoom', 'meeting', 'calendar', 'email', 'gmail', 'outlook', 'jira', 'github', 'gitlab', 'confluence'];
    const workTabs = this.tabs.filter(tab => 
      workKeywords.some(keyword => 
        tab.url.toLowerCase().includes(keyword) || 
        tab.title.toLowerCase().includes(keyword)
      )
    );

    return `**Work-Related Tabs Analysis:**

**Work Tabs Found: ${workTabs.length}/${this.tabs.length}**

${workTabs.length > 0 ? `**Work Activities:**
${workTabs.map(tab => `• ${tab.title} (${new URL(tab.url).hostname})`).join('\n')}

**Work Focus Areas:**
${this.getWorkCategories(workTabs).map(cat => `• ${cat}`).join('\n')}` : 
'No obvious work-related tabs detected.'}

**Productivity Insights:**
${workTabs.length / this.tabs.length > 0.5 ? 
  '• High work focus - most tabs are work-related' :
  '• Mixed browsing - consider separating work and personal tabs'}`;
  }

  analyzeSocialTabs() {
    const socialKeywords = ['facebook', 'twitter', 'instagram', 'linkedin', 'tiktok', 'youtube', 'reddit', 'pinterest', 'snapchat', 'discord', 'telegram', 'whatsapp'];
    const socialTabs = this.tabs.filter(tab => 
      socialKeywords.some(keyword => 
        tab.url.toLowerCase().includes(keyword)
      )
    );

    return `**Social Media & Entertainment Analysis:**

**Social/Entertainment Tabs: ${socialTabs.length}/${this.tabs.length}**

${socialTabs.length > 0 ? `**Platforms:**
${socialTabs.map(tab => `• ${tab.title} (${new URL(tab.url).hostname})`).join('\n')}` : 
'No social media tabs currently open.'}

**Usage Pattern:**
${socialTabs.length > 3 ? 
  '• High social media usage - consider dedicated time blocks' :
  socialTabs.length > 0 ? 
  '• Moderate social media usage' :
  '• Focused browsing session with minimal social media'}`;
  }

  analyzeTabs() {
    const domains = {};
    const categories = {
      'Work & Productivity': { count: 0, tabs: [], examples: [] },
      'Social Media': { count: 0, tabs: [], examples: [] },
      'News & Information': { count: 0, tabs: [], examples: [] },
      'Entertainment': { count: 0, tabs: [], examples: [] },
      'Shopping': { count: 0, tabs: [], examples: [] },
      'Development': { count: 0, tabs: [], examples: [] },
      'Education': { count: 0, tabs: [], examples: [] },
      'Other': { count: 0, tabs: [], examples: [] }
    };

    const tabsByWindow = {};
    
    this.tabs.forEach(tab => {
      // Count domains
      try {
        const hostname = new URL(tab.url).hostname;
        domains[hostname] = (domains[hostname] || 0) + 1;
      } catch (e) {
        // Invalid URL
      }

      // Categorize tabs
      const category = this.categorizeTab(tab);
      categories[category].count++;
      categories[category].tabs.push(tab);
      if (categories[category].examples.length < 3) {
        categories[category].examples.push(new URL(tab.url).hostname);
      }

      // Group by window
      if (!tabsByWindow[tab.windowId]) {
        tabsByWindow[tab.windowId] = [];
      }
      tabsByWindow[tab.windowId].push(tab);
    });

    const sortedDomains = Object.entries(domains)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count);

    const activeCategories = Object.entries(categories)
      .filter(([name, data]) => data.count > 0)
      .map(([name, data]) => ({ name, ...data }));

    return {
      totalTabs: this.tabs.length,
      windowCount: Object.keys(tabsByWindow).length,
      domains: sortedDomains,
      topDomains: sortedDomains.slice(0, 5),
      categories: activeCategories,
      tabsByWindow: tabsByWindow,
      activeTabInfo: `Active tab: ${this.tabs.find(t => t.active)?.title || 'Unknown'}`,
      recommendations: this.generateRecommendations(sortedDomains, activeCategories)
    };
  }

  categorizeTab(tab) {
    const url = tab.url.toLowerCase();
    const title = tab.title.toLowerCase();

    if (url.includes('github') || url.includes('stackoverflow') || url.includes('codepen') || 
        title.includes('developer') || title.includes('api') || title.includes('documentation')) {
      return 'Development';
    }
    if (url.includes('facebook') || url.includes('twitter') || url.includes('instagram') || 
        url.includes('linkedin') || url.includes('reddit') || url.includes('tiktok')) {
      return 'Social Media';
    }
    if (url.includes('youtube') || url.includes('netflix') || url.includes('spotify') || 
        url.includes('twitch') || title.includes('video') || title.includes('music')) {
      return 'Entertainment';
    }
    if (url.includes('amazon') || url.includes('shop') || url.includes('buy') || 
        url.includes('cart') || title.includes('store')) {
      return 'Shopping';
    }
    if (url.includes('news') || url.includes('bbc') || url.includes('cnn') || 
        url.includes('reuters') || title.includes('news')) {
      return 'News & Information';
    }
    if (url.includes('docs') || url.includes('office') || url.includes('teams') || 
        url.includes('slack') || url.includes('calendar') || url.includes('email')) {
      return 'Work & Productivity';
    }
    if (url.includes('edu') || url.includes('course') || url.includes('learn') || 
        title.includes('tutorial') || title.includes('course')) {
      return 'Education';
    }
    return 'Other';
  }

  getWorkCategories(workTabs) {
    const categories = new Set();
    workTabs.forEach(tab => {
      const url = tab.url.toLowerCase();
      if (url.includes('docs') || url.includes('office')) categories.add('Document editing');
      if (url.includes('email') || url.includes('gmail') || url.includes('outlook')) categories.add('Email management');
      if (url.includes('calendar')) categories.add('Calendar/Scheduling');
      if (url.includes('teams') || url.includes('slack') || url.includes('zoom')) categories.add('Communication/Meetings');
      if (url.includes('github') || url.includes('gitlab') || url.includes('jira')) categories.add('Development/Project management');
    });
    return Array.from(categories);
  }

  generateRecommendations(domains, categories) {
    const recommendations = [];
    
    if (domains.length > 20) {
      recommendations.push('• Consider closing unused tabs to improve performance');
    }
    if (categories.find(c => c.name === 'Social Media')?.count > 3) {
      recommendations.push('• High social media usage detected - consider time management');
    }
    if (domains.some(d => d.count > 5)) {
      recommendations.push('• Multiple tabs from same domain - consider bookmarking instead');
    }
    if (categories.length > 5) {
      recommendations.push('• Diverse browsing detected - consider organizing into separate windows');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('• Your tab usage looks well-organized!');
    }
    
    return recommendations;
  }
}

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', () => {
  new TabScanner();
});