// aiManager.js - Fixed Language Configuration
class AIManager {
  constructor() {
    this.aiSession = null;
    this.isAIAvailable = false;
    this.logger = new AILogger({ flushOnUnload: true });
    this.systemPrompt = '';
    this.promptCount = 0;
    this.refreshThreshold = 50;
    this.isRefreshing = false;
    this.initializationPromise = null;
    this.nextAiSessionPromise = null;
  }

  async initializeAI(retryCount = 3, delay = 1000) {
    if (this.initializationPromise) return this.initializationPromise;
    this.initializationPromise = (async () => {
      for (let i = 0; i < retryCount; i++) {
        try {
          console.log('AIManager: Initializing AI session...');

          let exampleCategories = [];

          const { predefinedCategories } = await chrome.storage.sync.get('predefinedCategories');
          if (predefinedCategories && predefinedCategories.length > 0) {
              exampleCategories.push(...new Set(predefinedCategories));
          }

          try {
            const groups = await chrome.tabGroups.query({});
            const existingGroupTitles = groups.map(g => g.title).filter(t => t && t.trim() !== '');
            if (existingGroupTitles.length > 0) {
              const uniqueTitles = [...new Set(existingGroupTitles)];
              uniqueTitles.forEach(title => {
                  if (!exampleCategories.includes(title)) {
                      exampleCategories.push(title);
                  }
              });
            }
          } catch (e) {
            console.warn("Could not query tab groups to generate dynamic examples.", e);
          }

          if (exampleCategories.length === 0) {
              exampleCategories = [
                  "Coding",
                  "Data Science",
                  "Social Media",
                  "Development",
                  "News/AI"
              ];
          }

          const categoryExamples = exampleCategories.map((cat, i) => `${i}: ${cat}`).join('\n');

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
          
          // FIXED: Added outputLanguage to initial session creation
          this.aiSession = await LanguageModel.create({
            temperature: 0.2,
            topK: 1,
            outputLanguage: 'en',  // ← THIS WAS MISSING
            initialPrompts: [{
              role: "system",
              content: systemPromptContent
            }]
          });
          
          this.isAIAvailable = true;
          this.promptCount = 0;
          console.log('AI ready for category generation');
          this.initializationPromise = null;
          return;
        } catch (error) {
          console.error(`AI initialization attempt ${i + 1} failed:`, error.message);
          if (i < retryCount - 1) {
            console.log(`Retrying in ${delay / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            console.error('AI initialization failed after multiple retries.');
            this.initializationPromise = null;
            throw error;
          }
        }
      }
    })();
    return this.initializationPromise;
  }

  async prompt(promptText) {
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
        this.nextAiSessionPromise = null;
      }
    }

    this.promptCount++;

    if (this.promptCount >= this.refreshThreshold && !this.nextAiSessionPromise) {
      this.prepareNextSession();
    }

    if (!this.aiSession) {
      throw new Error("AI session is not available.");
    }

    return this.aiSession.prompt(promptText);
  }

  prepareNextSession() {
    console.log(`AIManager: Refresh threshold reached. Preparing new AI session in the background.`);
    this.nextAiSessionPromise = LanguageModel.create({
      temperature: 0.2,  // Added for consistency
      topK: 1,           // Added for consistency
      outputLanguage: 'en',
      initialPrompts: [{
        role: "system",
        content: this.systemPrompt
      }]
    }).catch(error => {
      console.error('AIManager: Failed to prepare next AI session.', error);
      this.nextAiSessionPromise = null;
      throw error;
    });
  }

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

  async generateThematicCategories(tabNames, theme) {
    const customPrompt = `Generate category names specifically for ${theme}-related browser tabs. Focus on categories that would be most relevant for ${theme} activities and organization.`;
    return await this.generateCategoriesWithCustomPrompt(customPrompt, tabNames);
  }

  async simplifyCategoryList(categories, preferredCategories = []) {
    if (!this.isAIAvailable || !this.aiSession) {
      throw new Error('AI not available for category simplification.');
    }

    const categoryListString = categories.map(c => `- ${c}`).join('\n');

    let preferredCategoriesPromptPart = '';
    if (preferredCategories.length > 0) {
      const preferredListString = preferredCategories.map(c => `- ${c}`).join('\n');
      preferredCategoriesPromptPart = `
**Primary Rule: Use Existing Category Names**
You are given a list of "Preferred Categories" that already exist as tab groups in the user's browser. Your highest priority is to use these names.

1.  When merging categories, if a name from the "Preferred Categories" list is a logical parent, you **MUST** use it.
2.  Do **NOT** invent a new general category if a suitable one already exists in the list below.

**Preferred Categories List:**
${preferredListString}
`;
    }

    const prompt = `You are an expert at organizing information. Your task is to simplify the following list of browser tab categories by merging similar or related items.${preferredCategoriesPromptPart}

**Instructions:**
1.  Analyze the provided list of categories to be simplified.
2.  Identify categories that can be grouped under a more general, common name (e.g., 'React Dev' and 'Vue Dev' could become 'Web Development').
3.  If a category is already distinct and general enough, keep its name.
4.  Respond **ONLY** with a JSON object that maps every old category to a new (or same) category name.

**Example Input:**
- React Development
- Customer Support Tickets
- Vue.js Project
- Zendesk Queue

**Example Output (JSON format ONLY):**
{
  "React Development": "Web Development",
  "Customer Support Tickets": "Support",
  "Vue.js Project": "Web Development",
  "Zendesk Queue": "Support"
}

**Categories to simplify:**
${categoryListString}`;

    const response = await this.prompt(prompt);
    this.logger.log("Simplify Categories Prompt", prompt, response);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("AI response for simplification did not contain a JSON object. Response:", response);
      throw new Error("AI response did not contain a valid JSON object.");
    }

    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("Failed to parse extracted JSON from AI response:", jsonMatch[0], e);
      throw new Error("Invalid JSON format in AI response after extraction.");
    }
  }

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

  destroy() {
    if (this.aiSession) {
      this.aiSession.destroy();
      this.aiSession = null;
      this.isAIAvailable = false;
      this.initializationPromise = null;
    }
  }
}