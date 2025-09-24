// categoryManager.js
class CategoryManager {
  constructor(tabManager, aiManager) {
    this.tabManager = tabManager;
    this.aiManager = aiManager;
  }

  async generatePredefinedCategories() {
    if (this.aiManager.isAIAvailable) {
      const tabTitles = this.tabManager.tabs.slice(0, 20)
        .map(tab => `"${tab.title}" (${tab.domain})`)
        .join(', ');
      
      return await this.aiManager.generateAICategories(tabTitles);
    } else {
      return this.generateFallbackCategories();
    }
  }

  async generateDiscoverCategories(prompt) {
    if (this.aiManager.isAIAvailable) {
      const tabTitles = this.tabManager.tabs.slice(0, 20)
        .map(tab => `"${tab.title}" (${tab.domain})`)
        .join(', ');
      
      return await this.aiManager.generateAICategoriesWithPrompt(prompt, tabTitles);
    } else {
      return this.generateFallbackCategories();
    }
  }

  generateFallbackCategories() {
    const domainAnalysis = this.analyzeDomains();
    const categories = [];
    
    if (domainAnalysis.hasWork) categories.push('Work & Productivity');
    if (domainAnalysis.hasSocial) categories.push('Social Media');
    if (domainAnalysis.hasNews) categories.push('News & Information');
    if (domainAnalysis.hasEntertainment) categories.push('Entertainment');
    if (domainAnalysis.hasShopping) categories.push('Shopping');
    if (domainAnalysis.hasDev) categories.push('Development');
    
    while (categories.length < 4) {
      const defaults = ['Reference', 'Utilities', 'Personal', 'Research'];
      categories.push(defaults[categories.length]);
    }
    
    return categories.slice(0, 6);
  }

  analyzeDomains() {
    const domains = this.tabManager.tabs.map(tab => tab.domain.toLowerCase());
    
    return {
      hasWork: domains.some(d => ['docs', 'office', 'teams', 'slack', 'gmail'].some(w => d.includes(w))),
      hasSocial: domains.some(d => ['facebook', 'twitter', 'instagram', 'linkedin'].some(s => d.includes(s))),
      hasNews: domains.some(d => ['news', 'bbc', 'cnn', 'reuters'].some(n => d.includes(n))),
      hasEntertainment: domains.some(d => ['youtube', 'netflix', 'spotify', 'twitch'].some(e => d.includes(e))),
      hasShopping: domains.some(d => ['amazon', 'shop', 'buy', 'store'].some(s => d.includes(s))),
      hasDev: domains.some(d => ['github', 'stackoverflow', 'developer'].some(dev => d.includes(dev)))
    };
  }

  async categorizeTabs(categories) {
    if (this.aiManager.isAIAvailable) {
      return await this.aiManager.categorizeWithAI(categories, this.tabManager.tabs);
    } else {
      return this.categorizeWithLogic(categories, this.tabManager.tabs);
    }
  }

  categorizeWithLogic(categories, tabs) {
    const categorization = {};
    categories.forEach(cat => categorization[cat] = []);
    
    tabs.forEach(tab => {
      const category = this.assignCategoryLogic(tab, categories);
      categorization[category].push(tab);
    });
    
    return categorization;
  }

  assignCategoryLogic(tab, categories) {
    const url = tab.url.toLowerCase();
    const title = tab.title.toLowerCase();
    const domain = tab.domain.toLowerCase();
    
    for (const category of categories) {
      const categoryLower = category.toLowerCase();
      
      if (categoryLower.includes('work') || categoryLower.includes('productivity')) {
        if (['docs', 'office', 'teams', 'slack', 'calendar', 'email', 'gmail'].some(w => url.includes(w) || domain.includes(w))) {
          return category;
        }
      }
      
      if (categoryLower.includes('social')) {
        if (['facebook', 'twitter', 'instagram', 'linkedin', 'reddit'].some(s => domain.includes(s))) {
          return category;
        }
      }
      
      if (categoryLower.includes('entertainment')) {
        if (['youtube', 'netflix', 'spotify', 'twitch'].some(e => domain.includes(e)) || 
            ['video', 'music', 'game'].some(t => title.includes(t))) {
          return category;
        }
      }
      
      if (categoryLower.includes('shopping')) {
        if (['amazon', 'shop', 'buy', 'cart', 'store'].some(s => url.includes(s) || domain.includes(s))) {
          return category;
        }
      }
      
      if (categoryLower.includes('news') || categoryLower.includes('information')) {
        if (['news', 'bbc', 'cnn', 'reuters'].some(n => domain.includes(n)) || title.includes('news')) {
          return category;
        }
      }
      
      if (categoryLower.includes('development') || categoryLower.includes('dev')) {
        if (['github', 'stackoverflow', 'codepen', 'developer'].some(d => domain.includes(d)) || 
            ['api', 'documentation', 'tutorial'].some(t => title.includes(t))) {
          return category;
        }
      }
    }
    
    return categories[0];
  }
}