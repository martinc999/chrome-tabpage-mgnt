// aiManager.js
class AIManager {
  constructor() {
    this.aiSessions = {
      categorizer: null,
      analyzer: null
    };
    this.isAIAvailable = false;
  }

  async initializeAI() {
    try {
      // Enhanced detection with more detailed logging
      console.log('Checking Chrome AI availability...');
      console.log('window.ai exists:', !!window.ai);
      console.log('window.ai.languageModel exists:', !!window.ai?.languageModel);
      
      if (!window.ai) {
        console.log('Chrome AI not available - window.ai is undefined');
        console.log('Make sure you are using Chrome Canary/Dev with AI features enabled');
        return;
      }

      if (!window.ai.languageModel) {
        console.log('Chrome AI languageModel not available');
        console.log('Check if the Prompt API is enabled in chrome://flags/');
        return;
      }

      // Check capabilities with better error handling
      let capabilities;
      try {
        capabilities = await window.ai.languageModel.capabilities();
        console.log('AI capabilities:', capabilities);
      } catch (capError) {
        console.error('Failed to get AI capabilities:', capError);
        return;
      }
      
      if (capabilities.available === 'no') {
        console.log('AI model not available - capabilities.available is "no"');
        return;
      }

      if (capabilities.available === 'after-download') {
        console.log('AI model needs to be downloaded first...');
        await this.waitForModelDownload();
        // Re-check capabilities after download
        capabilities = await window.ai.languageModel.capabilities();
        console.log('Post-download capabilities:', capabilities);
      }

      // Only proceed if model is readily available
      if (capabilities.available !== 'readily') {
        console.log('AI model still not ready after download attempt');
        return;
      }

      await this.createAISessions();
      this.isAIAvailable = true;
      console.log('Chrome AI ready for advanced analysis');
      
    } catch (error) {
      console.error('AI initialization failed:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
  }

  async createAISessions() {
    try {
      console.log('Creating AI sessions...');
      
      // Test basic session creation first
      const testSession = await window.ai.languageModel.create({
        temperature: 0.3,
        topK: 20
      });
      
      console.log('Basic session created successfully');
      testSession.destroy(); // Clean up test session

      // Create actual sessions
      this.aiSessions.categorizer = await window.ai.languageModel.create({
        temperature: 0.3,
        topK: 20,
        // Note: initialPrompts might not be supported in all Chrome AI versions
        // Remove this if it causes issues
        initialPrompts: [
          {
            role: "system",
            content: "You categorize browser tabs into logical groups. Respond only with comma-separated category names that are specific yet broad enough to group multiple tabs meaningfully."
          },
          {
            role: "user",
            content: "Tabs: Gmail, Slack, Zoom meeting, GitHub repo, Stack Overflow, YouTube music, Netflix, Amazon cart, Google Docs"
          },
          {
            role: "assistant", 
            content: "Work Communication, Development, Entertainment, Shopping, Productivity"
          }
        ]
      });

      this.aiSessions.analyzer = await window.ai.languageModel.create({
        temperature: 0.6,
        topK: 30,
        initialPrompts: [
          {
            role: "system",
            content: "You provide detailed browser usage analysis with productivity insights, time management suggestions, and organization recommendations. Focus on actionable advice."
          }
        ]
      });

      console.log('AI sessions created successfully');
      
    } catch (sessionError) {
      console.error('Failed to create AI sessions:', sessionError);
      
      // Try creating sessions without initialPrompts as fallback
      if (sessionError.message?.includes('initialPrompts')) {
        console.log('Retrying without initialPrompts...');
        try {
          this.aiSessions.categorizer = await window.ai.languageModel.create({
            temperature: 0.3,
            topK: 20
          });

          this.aiSessions.analyzer = await window.ai.languageModel.create({
            temperature: 0.6,
            topK: 30
          });
          
          console.log('AI sessions created without initialPrompts');
        } catch (fallbackError) {
          console.error('Fallback session creation also failed:', fallbackError);
          throw fallbackError;
        }
      } else {
        throw sessionError;
      }
    }
  }

  async waitForModelDownload() {
    console.log('Waiting for model download...');
    let attempts = 0;
    const maxAttempts = 60; // 1 minute timeout
    
    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        attempts++;
        try {
          const capabilities = await window.ai.languageModel.capabilities();
          console.log(`Download check ${attempts}: ${capabilities.available}`);
          
          if (capabilities.available === 'readily') {
            console.log('Model download completed');
            clearInterval(checkInterval);
            resolve();
          } else if (attempts >= maxAttempts) {
            console.log('Model download timeout after 60 seconds');
            clearInterval(checkInterval);
            resolve();
          }
        } catch (error) {
          console.error('Error checking download status:', error);
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000);
    });
  }

  // Add a method to check browser compatibility
  static checkBrowserCompatibility() {
    const isChrome = /Chrome/.test(navigator.userAgent);
    const chromeVersion = navigator.userAgent.match(/Chrome\/(\d+)/)?.[1];
    
    console.log('Browser compatibility check:');
    console.log('- Is Chrome:', isChrome);
    console.log('- Chrome version:', chromeVersion);
    console.log('- window.ai available:', !!window.ai);
    
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

  async generateAICategories(tabTitles) {
    if (!this.isAIAvailable || !this.aiSessions.categorizer) {
      throw new Error('AI not available for categorization');
    }
    
    const sessionClone = await this.aiSessions.categorizer.clone();
    
    // If we don't have initialPrompts, provide context in the prompt
    const prompt = this.aiSessions.categorizer.initialPrompts ? 
      `Tabs: ${tabTitles}` :
      `Categorize these browser tabs into logical groups. Respond only with comma-separated category names:
      
Tabs: ${tabTitles}`;
    
    const response = await sessionClone.prompt(prompt);
    sessionClone.destroy(); // Clean up
    
    return response.split(',').map(cat => cat.trim()).filter(cat => cat.length > 0);
  }

  async generateAICategoriesWithPrompt(prompt, tabTitles) {
    if (!this.isAIAvailable || !this.aiSessions.categorizer) {
      throw new Error('AI not available for categorization');
    }
    
    const sessionClone = await this.aiSessions.categorizer.clone();
    
    const enhancedPrompt = `
${prompt}

Tabs to categorize: ${tabTitles}

Respond only with comma-separated category names that match the prompt request.
    `.trim();
    
    const response = await sessionClone.prompt(enhancedPrompt);
    sessionClone.destroy(); // Clean up
    
    return response.split(',').map(cat => cat.trim()).filter(cat => cat.length > 0);
  }

  async categorizeWithAI(categories, tabs) {
    if (!this.isAIAvailable || !this.aiSessions.categorizer) {
      throw new Error('AI not available for categorization');
    }
    
    const sessionClone = await this.aiSessions.categorizer.clone();
    const categorization = {};
    
    categories.forEach(cat => categorization[cat] = []);
    
    const batchSize = 10;
    for (let i = 0; i < tabs.length; i += batchSize) {
      const batch = tabs.slice(i, i + batchSize);
      
      const batchData = batch.map((tab, index) => 
        `${i + index + 1}: "${tab.title}" (${tab.domain})`
      ).join('\n');
      
      const prompt = `
Categorize each tab into one of these categories: ${categories.join(', ')}

Tabs:
${batchData}

Respond with format:
1: Category Name
2: Category Name
etc.
      `.trim();

      try {
        const response = await sessionClone.prompt(prompt);
        const assignments = this.parseAssignments(response);
        
        assignments.forEach((category, index) => {
          const tabIndex = i + index;
          if (tabIndex < tabs.length) {
            const targetCategory = categorization[category] ? category : categories[0];
            categorization[targetCategory].push(tabs[tabIndex]);
          }
        });
      } catch (error) {
        console.error('Batch categorization error:', error);
        // Fallback: distribute tabs evenly across categories
        batch.forEach((tab, index) => {
          const categoryIndex = (i + index) % categories.length;
          categorization[categories[categoryIndex]].push(tab);
        });
      }
    }
    
    sessionClone.destroy(); // Clean up
    return categorization;
  }

  parseAssignments(response) {
    return response.split('\n')
      .map(line => line.match(/^\d+:\s*(.+)$/)?.[1]?.trim())
      .filter(Boolean);
  }

  // Clean up method
  destroy() {
    if (this.aiSessions.categorizer) {
      this.aiSessions.categorizer.destroy();
    }
    if (this.aiSessions.analyzer) {
      this.aiSessions.analyzer.destroy();
    }
    this.aiSessions = { categorizer: null, analyzer: null };
    this.isAIAvailable = false;
  }
}

// Usage example with compatibility check:
/*
// Before initializing AIManager:
if (AIManager.checkBrowserCompatibility()) {
  const aiManager = new AIManager();
  await aiManager.initializeAI();
} else {
  console.log('Browser not compatible with Chrome AI');
}
*/