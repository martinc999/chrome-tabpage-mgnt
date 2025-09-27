// aiManager.js
class AIManager {
  constructor() {
    this.aiSession = null;
    this.isAIAvailable = false;
    this.logger = new AILogger();
    this.systemPrompt = '';
  }

  async initializeAI() {
    try {
      console.log('Checking AI availability...');
      const systemPromptContent = "You analyze browser tab names and generate logical category names for organizing them. Respond with a mapping of tab index to category name. For example: 0: Coding";
      this.systemPrompt = systemPromptContent;
      this.aiSession = await LanguageModel.create({
        initialPrompts: [{
          role: "system",
          content: systemPromptContent
        }]
      });
      this.isAIAvailable = true;
      console.log('AI ready for category generation');
    } catch (error) {
      console.error('AI initialization failed:', error.message);
    }
  }

  /**
   * Generate a list of categories based on tab names
   * @param {string|Array} tabNames - Either a comma-separated string or array of tab names
   * @returns {Array} Array of category names
   */
  async generateCategoriesFromTabNames(tabNames) {
    if (!this.isAIAvailable || !this.aiSession) {
      throw new Error('AI not available for category generation');
    }

    const tabNamesString = Array.isArray(tabNames) ? tabNames.join(', ') : tabNames;
    const prompt = `Tab names: ${tabNamesString}`;

    try {
      const response = await this.aiSession.prompt(prompt);
      this.logger.log(this.systemPrompt, prompt, response);
      const lines = response.split('\n');
      const categories = lines.map(line => {
        const parts = line.split(':');
        if (parts.length > 1) {
          return parts[1].trim();
        }
        return null;
      }).filter(cat => cat !== null);
      const uniqueCategories = [...new Set(categories)];
      console.log('Generated categories:', uniqueCategories);
      return uniqueCategories;
    } catch (error) {
      console.error('Error generating categories:', error.message);
      throw error;
    }
  }

  /**
   * Generate categories with a custom prompt
   * @param {string} customPrompt - Custom instruction for category generation
   * @param {string|Array} tabNames - Tab names to analyze
   * @returns {Array} Array of category names
   */
  async generateCategoriesWithCustomPrompt(customPrompt, tabNames) {
    if (!this.isAIAvailable || !this.aiSession) {
      throw new Error('AI not available for category generation');
    }
    
    const tabNamesString = Array.isArray(tabNames) ? tabNames.join(', ') : tabNames;
    
    try {
      const response = await this.aiSession.prompt(`${customPrompt}\n\nTab names: ${tabNamesString}`);
      const lines = response.split('\n');
      const categories = lines.map(line => {
        const parts = line.split(':');
        if (parts.length > 1) {
          return parts[1].trim();
        }
        return null;
      }).filter(cat => cat !== null);
      const uniqueCategories = [...new Set(categories)];
      console.log('Generated categories with custom prompt:', uniqueCategories);
      return uniqueCategories;
    } catch (error) {
      console.error('Error generating categories with custom prompt:', error.message);
      throw error;
    }
  }

  async mergeCategoriesWithAI(categories) {
    if (!this.isAIAvailable || !this.aiSession) {
        throw new Error('AI not available for category merging');
    }

    const categoryListString = categories.join(', ');
    const prompt = `Analyze the following list of categories and group synonyms. For each group, choose the best primary category name.
Respond with a JSON object where keys are the primary category names and values are arrays of the synonyms.
Example input: "Work, Productivity, Dev, Development, Entertainment"
Example output:
{
  "Work": ["Work", "Productivity"],
  "Development": ["Dev", "Development"],
  "Entertainment": ["Entertainment"]
}

Categories to analyze: ${categoryListString}
`;

    try {
        const response = await this.aiSession.prompt(prompt);
        const cleanedResponse = response.replace(/```json/g, '').replace(/```/g, '').trim();
        const synonymGroups = JSON.parse(cleanedResponse);
        return synonymGroups;
    } catch (error) {
        console.error('Error merging categories with AI:', error);
        const fallbackGroups = {};
        categories.forEach(cat => fallbackGroups[cat] = [cat]);
        return fallbackGroups;
    }
  }

  /**
   * Generate categories with specified count limit
   * @param {string|Array} tabNames - Tab names to analyze
   * @param {number} maxCategories - Maximum number of categories to generate
   * @returns {Array} Array of category names
   */
  async generateLimitedCategories(tabNames, maxCategories = 5) {
    if (!this.isAIAvailable || !this.aiSession) {
      throw new Error('AI not available for category generation');
    }

    const tabNamesString = Array.isArray(tabNames) ? tabNames.join(', ') : tabNames;
    const prompt = `Generate exactly ${maxCategories} category names for these browser tabs: ${tabNamesString}`;
    
    try {
      const response = await this.aiSession.prompt(prompt);
      const lines = response.split('\n');
      const categories = lines.map(line => {
        const parts = line.split(':');
        if (parts.length > 1) {
          return parts[1].trim();
        }
        return null;
      }).filter(cat => cat !== null);
      const uniqueCategories = [...new Set(categories)];
      console.log('Generated limited categories:', uniqueCategories);
      return uniqueCategories;
    } catch (error) {
      console.error('Error generating limited categories:', error.message);
      throw error;
    }
  }

  /**
   * Generate categories by theme/purpose
   * @param {string|Array} tabNames - Tab names to analyze
   * @param {string} theme - Theme like 'work', 'personal', 'research', etc.
   * @returns {Array} Array of category names
   */
  async generateThematicCategories(tabNames, theme) {
    const customPrompt = `Generate category names specifically for ${theme}-related browser tabs. Focus on categories that would be most relevant for ${theme} activities and organization.`;
    return await this.generateCategoriesWithCustomPrompt(customPrompt, tabNames);
  }

  // Add a method to check browser compatibility
  static checkBrowserCompatibility() {
    const isChrome = /Chrome/.test(navigator.userAgent);
    const chromeVersion = navigator.userAgent.match(/Chrome\/(\d+)/)?.[1];
    
    console.log('Browser compatibility check:');
    console.log('- Is Chrome:', isChrome);
    console.log('- Chrome version:', chromeVersion);
    
    if (!isChrome) {
      console.warn('Chrome AI requires Chrome browser');
      return false;
    }
    
    if (chromeVersion && parseInt(chromeVersion) < 127) {
      console.warn('Chrome AI requires Chrome 127 or later');
      return false;
    }
    
    return true;
  }

  // Clean up method
  destroy() {
    if (this.aiSession) {
      this.aiSession.destroy();
      this.aiSession = null;
      this.isAIAvailable = false;
    }
  }
}

// Usage examples:
/*
// Basic usage:
const aiManager = new AIManager();
await aiManager.initializeAI();

// From array of tab names
const tabNames = ['Gmail', 'Slack', 'GitHub', 'Stack Overflow', 'YouTube', 'Netflix'];
const categories = await aiManager.generateCategoriesFromTabNames(tabNames);
console.log('Categories:', categories); // e.g., ['Work Communication', 'Development', 'Entertainment']

// From comma-separated string
const tabString = 'Gmail, Slack, GitHub, Stack Overflow, YouTube, Netflix';
const categories2 = await aiManager.generateCategoriesFromTabNames(tabString);

// With custom prompt
const customCategories = await aiManager.generateCategoriesWithCustomPrompt(
  'Generate categories focused on productivity and time management',
  tabNames
);

// Limited number of categories
const limitedCategories = await aiManager.generateLimitedCategories(tabNames, 3);

// Thematic categories
const workCategories = await aiManager.generateThematicCategories(tabNames, 'work');
*/