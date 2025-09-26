class AIManager {
  constructor() {
    this.aiSession = null;
    this.isAIAvailable = false;
  }

  async initializeAI() {
    try {
      console.log('Checking AI availability...');
      this.aiSession = await LanguageModel.create({
        initialPrompts: [{
          role: "system",
          content: "You analyze browser tab names and generate logical category names for organizing them. Respond only with comma-separated category names."
        }]
      });
      this.isAIAvailable = true;
      console.log('AI ready for category generation');
    } catch (error) {
      console.error('AI initialization failed:', error.message);
    }
  }

  async generateCategoriesFromTabNames(tabNames) {
    if (!this.isAIAvailable || !this.aiSession) {
      throw new Error('AI not available');
    }

    const tabNamesString = Array.isArray(tabNames) ? tabNames.join(', ') : tabNames;
    try {
      const response = await this.aiSession.prompt(`Tab names: ${tabNamesString}`);
      const categories = response.split(',').map(cat => cat.trim()).filter(cat => cat.length > 0);
      console.log('Generated categories:', categories);
      return categories;
    } catch (error) {
      console.error('Error generating categories:', error.message);
      throw error;
    }
  }

  async generateLimitedCategories(tabNames, maxCategories = 5) {
    const prompt = `Generate exactly ${maxCategories} category names for these browser tabs: ${Array.isArray(tabNames) ? tabNames.join(', ') : tabNames}`;
    try {
      const response = await this.aiSession.prompt(prompt);
      const categories = response.split(',').map(cat => cat.trim()).filter(cat => cat.length > 0);
      console.log('Generated limited categories:', categories);
      return categories;
    } catch (error) {
      console.error('Error generating limited categories:', error.message);
      throw error;
    }
  }

  destroy() {
    if (this.aiSession) {
      this.aiSession.destroy();
      this.aiSession = null;
      this.isAIAvailable = false;
    }
  }
}