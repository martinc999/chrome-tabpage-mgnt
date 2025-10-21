// aiManager.js
class AIManager {
  constructor() {
    this.aiSession = null;
    this.isAIAvailable = false;
    this.logger = new AILogger({ flushOnUnload: true });
    this.systemPrompt = '';
    this.promptCount = 0;
    this.refreshThreshold = 50; // Refresh session after this many prompts
    this.isRefreshing = false;
    this.initializationPromise = null;
    this.nextAiSessionPromise = null; // For the hot-swap
  }

  async initializeAI(retryCount = 3, delay = 1000) {
    if (this.initializationPromise) return this.initializationPromise;
    this.initializationPromise = (async () => {
      for (let i = 0; i < retryCount; i++) {
        try {
          console.log('AIManager: Initializing AI session...');

          // Get existing tab group titles to use as dynamic examples
          let categoryExamples = "0: Coding\n1: Data Science\n2: Social Media\n3: Development\n4: News/AI";
          try {
            const groups = await chrome.tabGroups.query({});
            const existingGroupTitles = groups.map(g => g.title).filter(t => t && t.trim() !== '');
            if (existingGroupTitles.length > 0) {
              // Create a unique set of titles
              const uniqueTitles = [...new Set(existingGroupTitles)];
              categoryExamples = uniqueTitles.map((title, i) => `${i}: ${title}`).join('\n');
            }
          } catch (e) {
            console.warn("Could not query tab groups to generate dynamic examples, using static list.", e);
          }

          const systemPromptContent = `You are an expert browser tab organizer. Your task is to analyze a list of tab data (domain, description, and URL extension) and assign a single, logical category name to each tab.

**Primary Goal:** Create the most relevant set of category names that efficiently groups the *entire batch* of tabs.

**Instructions:**
1.**Analyze Content First (Priority):** Prioritize the **'description'** and **'url_ext'** to determine the content. The content is always paramount. Use the **'domain'** only as a fallback for generic or uninformative descriptions.

2.**Handling Major Platforms (CRITICAL):**
    * **YouTube/Video Sites:** If the domain is a video platform (e.g., youtube.com) and the description indicates a video, the category must reflect the **topic of the video** (e.g., 'ML Video' or 'History Video'), or simply **'Video Content'** if the topic is too broad.
    * **AI/Chatbot Platforms:** If the domain is a specific AI platform (e.g., chatgpt.com, grok.com), the category must be **'AI/Chatbots'** or a related term, regardless of the conversation's internal topic (e.g., a conversation about history on ChatGPT is still categorized as 'AI/Chatbots').
    * **Social Media/News:** Use a single, consolidated category (e.g., 'Social Media' or 'News') for general feeds and homepages.

3.**Category Granularity:**
* Keep category names **concise** (1-3 words) and **specific** to the content (e.g., use 'Machine Learning' instead of 'Coding' or 'Research').
* **Minimize Redundancy:** Use a limited, consolidated set of categories for the entire batch. Use one term like **'Development'** instead of multiple overlapping terms. The total number of unique categories should typically not exceed **10** for a batch of 20 elements.
* **Prefer Existing Categories:** If the provided examples are relevant, prefer them over creating new ones.

4.**Output Format (STRICT):** Respond **ONLY** with a strictly formatted list of index-to-category mappings.
* The output must be a sequence of lines, where each line contains the tab's **index** (starting from 0), a **colon**, and a **single space**, followed by the **Category Name**.
* **NO** introductory text, **NO** headers, **NO** trailing punctuation, and **NO** bullet points.
* The index **must** be present for every element in the batch (0 to N-1, where N is the total number of tabs).

**Example of Desired Output (use these as inspiration):**
${categoryExamples}`;
          this.systemPrompt = systemPromptContent;
          this.aiSession = await LanguageModel.create({
            temperature: 0.2,
            topK: 1, 
            outputLanguage: 'en',
            initialPrompts: [{
              role: "system",
              content: systemPromptContent
            }]
          });
          this.isAIAvailable = true;
          this.promptCount = 0; // Reset counter on successful initialization
          console.log('AI ready for category generation');
          this.initializationPromise = null;
          return; // Success
        } catch (error) {
          console.error(`AI initialization attempt ${i + 1} failed:`, error.message);
          if (i < retryCount - 1) {
            console.log(`Retrying in ${delay / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            console.error('AI initialization failed after multiple retries.');
            this.initializationPromise = null;
            throw error; // Re-throw the error after the last attempt
          }
        }
      }
    })();
    return this.initializationPromise;
  }

  /**
   * A wrapper for aiSession.prompt that handles session refreshing.
   * @param {string} promptText The prompt to send to the AI.
   * @returns {Promise<string>} The AI's response.
   */
  async prompt(promptText) {
    // If a new session is ready, perform the hot-swap
    if (this.nextAiSessionPromise) {
      try {
        const newSession = await this.nextAiSessionPromise;
        if (this.aiSession) {
          this.aiSession.destroy();
        }
        this.aiSession = newSession;
        this.promptCount = 0;
        this.nextAiSessionPromise = null;
        console.log('AIManager: Hot-swapped to new AI session.');
      } catch (error) {
        console.error('AIManager: Failed to swap to new AI session, continuing with old one.', error);
        this.nextAiSessionPromise = null; // Clear the failed promise
      }
    }

    this.promptCount++;

    // Trigger a non-blocking refresh if threshold is met
    if (this.promptCount >= this.refreshThreshold && !this.nextAiSessionPromise) {
      this.prepareNextSession();
    }

    if (!this.aiSession) {
      throw new Error("AI session is not available.");
    }

    return this.aiSession.prompt(promptText);
  }

  /**
   * Creates a new AI session in the background without blocking ongoing requests.
   */
  prepareNextSession() {
    console.log(`AIManager: Refresh threshold reached. Preparing new AI session in the background.`);
    this.nextAiSessionPromise = LanguageModel.create({
      outputLanguage: 'en',
      initialPrompts: [{
        role: "system",
        content: this.systemPrompt
      }]
    }).catch(error => {
      console.error('AIManager: Failed to prepare next AI session.', error);
      // Ensure we can try again later by nullifying the failed promise
      this.nextAiSessionPromise = null;
      throw error; // Rethrow so the original caller knows, if it was awaited
    });
  }

  /**
   * Generate a list of categories based on tab names
   * @param {string|Array} tabNames - Either a comma-separated string or array of tab names
   * @returns {Array} Array of category names
   */
  async generateCategoriesFromTabNames(tabNames) {
    console.log("System Prompt for categorization:", this.systemPrompt);
    if (!this.isAIAvailable || !this.aiSession) {
      throw new Error('AI not available for category generation');
    }

    const tabNamesString = Array.isArray(tabNames) ? tabNames.join(', ') : tabNames;
    const prompt = `Tab names: ${tabNamesString}`;

    try {
      const response = await this.prompt(prompt);
      this.logger.log(this.systemPrompt, prompt, response);

      const tabInfoArray = tabNamesString.split('\n');
      const rawCategorizationLog = [];

      const lines = response.split('\n');
      const categories = lines.map(line => {
        const parts = line.split(':');
        if (parts.length > 1) {
          const index = parseInt(parts[0], 10);
          const category = parts[1].trim();
          if (!isNaN(index) && index < tabInfoArray.length) {
            rawCategorizationLog.push(`${tabInfoArray[index]}|${category}`);
          }
          return category;
        }
        return null;
      }).filter(cat => cat !== null);

      console.log('AIManager: Raw Tab-to-Category mapping before merging:\n', rawCategorizationLog.join('\n'));
      const uniqueCategories = [...new Set(categories)];
      console.log('Generated categories:', uniqueCategories);
      return { categories: uniqueCategories, mapping: rawCategorizationLog };
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
    console.log("System Prompt for categorization:", this.systemPrompt);
    if (!this.isAIAvailable || !this.aiSession) {
      throw new Error('AI not available for category generation');
    }

    const tabNamesString = Array.isArray(tabNames) ? tabNames.join(', ') : tabNames;

    try {
      const response = await this.prompt(`${customPrompt}\n\nTab names: ${tabNamesString}`);

      const tabInfoArray = tabNamesString.split('\n');
      const rawCategorizationLog = [];

      const lines = response.split('\n');
      const categories = lines.map(line => {
        const parts = line.split(':');
        if (parts.length > 1) {
          const index = parseInt(parts[0], 10);
          const category = parts[1].trim();
          if (!isNaN(index) && index < tabInfoArray.length) {
            rawCategorizationLog.push(`${tabInfoArray[index]}|${category}`);
          }
          return category;
        }
        return null;
      }).filter(cat => cat !== null);

      console.log('AIManager: Raw Tab-to-Category mapping before merging (custom prompt):\n', rawCategorizationLog.join('\n'));
      const uniqueCategories = [...new Set(categories)];
      console.log('Generated categories with custom prompt:', uniqueCategories);
      return { categories: uniqueCategories, mapping: rawCategorizationLog };
    } catch (error) {
      console.error('Error generating categories with custom prompt:', error.message);
      throw error;
    }
  }

  /**
   * Generate categories with specified count limit
   * @param {string|Array} tabNames - Tab names to analyze
   * @param {number} maxCategories - Maximum number of categories to generate
   * @returns {Array} Array of category names
   */
  async generateLimitedCategories(tabNames, maxCategories = 5) {
    console.log("System Prompt for categorization:", this.systemPrompt);
    if (!this.isAIAvailable || !this.aiSession) {
      throw new Error('AI not available for category generation');
    }

    const tabNamesString = Array.isArray(tabNames) ? tabNames.join(', ') : tabNames;
    const prompt = `Generate exactly ${maxCategories} category names for these browser tabs: ${tabNamesString}`;

    try {
      const response = await this.prompt(prompt);

      const tabInfoArray = tabNamesString.split('\n');
      const rawCategorizationLog = [];

      const lines = response.split('\n');
      const categories = lines.map(line => {
        const parts = line.split(':');
        if (parts.length > 1) {
          const index = parseInt(parts[0], 10);
          const category = parts[1].trim();
          if (!isNaN(index) && index < tabInfoArray.length) {
            rawCategorizationLog.push(`${tabInfoArray[index]}|${category}`);
          }
          return category;
        }
        return null;
      }).filter(cat => cat !== null);

      console.log('AIManager: Raw Tab-to-Category mapping before merging (limited categories):\n', rawCategorizationLog.join('\n'));
      const uniqueCategories = [...new Set(categories)];
      console.log('Generated limited categories:', uniqueCategories);
      return { categories: uniqueCategories, mapping: rawCategorizationLog };
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
      this.initializationPromise = null;
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
