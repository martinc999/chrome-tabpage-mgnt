// categoryManager.js
class CategoryManager {
    constructor(tabManager, aiManager) {
        console.log('CategoryManager: Initializing with tabManager and aiManager');
        this.tabManager = tabManager;
        this.aiManager = aiManager;
        console.log('CategoryManager: Constructor completed');
    }

    async generatePredefinedCategories(progressCallback = null) {
        console.log('CategoryManager: generatePredefinedCategories() called');

        if (this.aiManager.isAIAvailable) {
            console.log('CategoryManager: AI is available, generating AI-based categories');

            const allCategories = await this.processAllTabsInChunks('predefined', null, progressCallback);
            console.log('CategoryManager: Final merged AI categories:', allCategories);
            return allCategories;
        } else {
            console.log('CategoryManager: AI not available, using fallback categories');
            return this.generateFallbackCategories();
        }
    }

    async generateDiscoverCategories(prompt, progressCallback = null) {
        console.log('CategoryManager: generateDiscoverCategories() called with prompt:', prompt);

        if (this.aiManager.isAIAvailable) {
            console.log('CategoryManager: AI is available, generating custom categories');

            const allCategories = await this.processAllTabsInChunks('custom', prompt, progressCallback);
            console.log('CategoryManager: Final merged custom AI categories:', allCategories);
            return allCategories;
        } else {
            console.log('CategoryManager: AI not available, using fallback categories');
            return this.generateFallbackCategories();
        }
    }


    generateFallbackCategories() {
        console.log('CategoryManager: generateFallbackCategories() called');

        // Process ALL tabs for fallback analysis, not just first 20
        const domainAnalysis = this.analyzeDomains();
        console.log('CategoryManager: Domain analysis result:', domainAnalysis);

        const categories = [];

        if (domainAnalysis.hasWork) {
            categories.push('Work & Productivity');
            console.log('CategoryManager: Added Work & Productivity category');
        }
        if (domainAnalysis.hasSocial) {
            categories.push('Social Media');
            console.log('CategoryManager: Added Social Media category');
        }
        if (domainAnalysis.hasNews) {
            categories.push('News & Information');
            console.log('CategoryManager: Added News & Information category');
        }
        if (domainAnalysis.hasEntertainment) {
            categories.push('Entertainment');
            console.log('CategoryManager: Added Entertainment category');
        }
        if (domainAnalysis.hasShopping) {
            categories.push('Shopping');
            console.log('CategoryManager: Added Shopping category');
        }
        if (domainAnalysis.hasDev) {
            categories.push('Development');
            console.log('CategoryManager: Added Development category');
        }

        console.log('CategoryManager: Categories after domain analysis:', categories);

        while (categories.length < 4) {
            const defaults = ['Reference', 'Utilities', 'Personal', 'Research'];
            const toAdd = defaults[categories.length];
            categories.push(toAdd);
            console.log('CategoryManager: Added default category:', toAdd);
        }

        const finalCategories = categories.slice(0, 6);
        console.log('CategoryManager: Final fallback categories:', finalCategories);
        return finalCategories;
    }

    async processInParallel(items, asyncFn, concurrencyLimit = 5) {
        const results = [];
        const totalItems = items.length;
        let itemIndex = 0;
        const workers = [];

        const worker = async () => {
            while (itemIndex < totalItems) {
                const currentIndex = itemIndex++;
                if (currentIndex < totalItems) {
                    const item = items[currentIndex];
                    results[currentIndex] = await asyncFn(item, currentIndex).catch(error => {
                        console.error(`Error processing item at index ${currentIndex}:`, error);
                        return null; // Ensure promise resolves so Promise.all doesn't fail early
                    });
                }
            }
        };

        const workerCount = Math.min(concurrencyLimit, totalItems);
        for (let i = 0; i < workerCount; i++) {
            workers.push(worker());
        }

        await Promise.all(workers);
        return results;
    }

    // categoryManager.js - Modify processAllTabsInChunks method
    async processAllTabsInChunks(mode, customPrompt = null, progressCallback = null) {
        console.log('CategoryManager: processAllTabsInChunks() called with mode:', mode);

        const allTabs = this.tabManager.tabs;
        const totalTabs = allTabs.length;
        const chunkSize = 1;
        const totalChunks = Math.ceil(totalTabs / chunkSize);

        console.log(`CategoryManager: Processing ${totalTabs} tabs with a concurrency limit.`);

        const chunks = [];
        for (let i = 0; i < totalChunks; i++) {
            const startIndex = i * chunkSize;
            const endIndex = Math.min(startIndex + chunkSize, totalTabs);
            chunks.push(allTabs.slice(startIndex, endIndex));
        }

        let processedTabs = 0;

        const processChunk = async (chunk, index) => {
            const tabInfo = chunk.map(tab => {
                const url = new URL(tab.url);
                const url_ext = url.pathname + url.search + url.hash;
                return `'domain:${tab.domain}', 'description: ${tab.title}', 'url_ext': ${url_ext}`;
            }).join('\n');

            try {
                console.log(`CategoryManager: Processing chunk ${index + 1}/${totalChunks}`);
                console.log(`CategoryManager: Chunk ${index + 1} tab info:`, tabInfo);

                let categories;
                if (mode === 'predefined') {
                    categories = await this.aiManager.generateCategoriesFromTabNames(tabInfo);
                } else if (mode === 'custom') {
                    categories = await this.aiManager.generateCategoriesWithCustomPrompt(customPrompt, tabInfo);
                }

                console.log(`CategoryManager: Chunk ${index + 1} generated categories:`, categories);

                // Update progress inside the resolved promise
                processedTabs += chunk.length;
                if (progressCallback) {
                    const progress = Math.round((processedTabs / totalTabs) * 100);
                    progressCallback(progress, processedTabs, totalTabs);
                }

                return (categories && categories.length > 0) ? categories : null;
            } catch (error) {
                console.error(`CategoryManager: Error processing chunk ${index + 1}:`, error);
                return null; // Return null on error
            }
        };

        const concurrencyLimit = 5; // Limit to 5 concurrent requests
        const allCategorySets = (await this.processInParallel(chunks, processChunk, concurrencyLimit)).filter(set => set !== null);

        // Final progress update
        if (progressCallback) {
            progressCallback(100, totalTabs, totalTabs);
        }

        console.log('CategoryManager: All chunks processed. Category sets collected:', allCategorySets.length);

        if (allCategorySets.length === 0) {
            console.log('CategoryManager: No categories generated from any chunk, falling back to fallback categories');
            return this.generateFallbackCategories();
        }

        const mergedCategories = this.mergeCategories(allCategorySets);
        console.log('CategoryManager: Final merged categories:', mergedCategories);

        return mergedCategories;
    }

    mergeCategories(categorySets) {
        console.log('CategoryManager: mergeCategories() called with sets:', categorySets.length);
        console.log('CategoryManager: Raw category sets:', categorySets);

        if (categorySets.length === 0) return [];
        if (categorySets.length === 1) {
            console.log('CategoryManager: Single set found, returning all categories:', categorySets[0]);
            return categorySets[0];
        }

        // Flatten all categories - REMOVED ALL FILTERS, showing everything
        const allCategories = [];

        categorySets.forEach((categories, setIndex) => {
            console.log(`CategoryManager: Processing category set ${setIndex + 1}:`, categories);
            categories.forEach(category => {
                allCategories.push(category);
                console.log(`CategoryManager: Added category from set ${setIndex + 1}: "${category}"`);
            });
        });

        console.log('CategoryManager: ALL categories found (no filters applied):', allCategories);

        // Count frequency of each category (case-insensitive for counting only)
        const categoryCount = {};
        allCategories.forEach(category => {
            const normalizedCategory = category.toLowerCase().trim();
            categoryCount[normalizedCategory] = (categoryCount[normalizedCategory] || 0) + 1;
        });

        console.log('CategoryManager: Category frequency count:', categoryCount);

        // Create unique list preserving original case of most frequent occurrence
        const uniqueCategories = [];
        const seenNormalized = new Set();

        // Sort by frequency first
        const sortedByFrequency = Object.entries(categoryCount)
            .sort(([, a], [, b]) => b - a)
            .map(([normalizedCat]) => normalizedCat);

        console.log('CategoryManager: Categories sorted by frequency:', sortedByFrequency);

        sortedByFrequency.forEach(normalizedCategory => {
            if (!seenNormalized.has(normalizedCategory)) {
                // Find the original case version of this category
                const originalCategory = allCategories.find(cat =>
                    cat.toLowerCase().trim() === normalizedCategory
                );
                if (originalCategory) {
                    uniqueCategories.push(originalCategory);
                    seenNormalized.add(normalizedCategory);
                    console.log(`CategoryManager: Added unique category: "${originalCategory}" (frequency: ${categoryCount[normalizedCategory]})`);
                }
            }
        });

        console.log('CategoryManager: ALL FOUND CATEGORIES (no limits, no filters):', uniqueCategories);
        console.log('CategoryManager: Total unique categories found:', uniqueCategories.length);

        // Return ALL categories found, no artificial limits
        return uniqueCategories;
    }

    mergeCategorizedTabs(categorizedTabs, synonymGroups) {
        console.log('CategoryManager: mergeCategorizedTabs() called');
        const finalCategorization = {};

        for (const primaryCategory in synonymGroups) {
            const synonyms = synonymGroups[primaryCategory];
            let allTabsForPrimary = [];

            synonyms.forEach(synonym => {
                if (categorizedTabs[synonym]) {
                    allTabsForPrimary = allTabsForPrimary.concat(categorizedTabs[synonym]);
                }
            });

            finalCategorization[primaryCategory] = allTabsForPrimary;
        }

        console.log('CategoryManager: Final merged categorization:', finalCategorization);
        return finalCategorization;
    }

    analyzeDomains() {
        console.log('CategoryManager: analyzeDomains() called');

        const domains = this.tabManager.tabs.map(tab => tab.domain.toLowerCase());
        console.log('CategoryManager: All domains:', domains);
        console.log('CategoryManager: Total number of domains:', domains.length);

        const analysis = {
            hasWork: domains.some(d => ['docs', 'office', 'teams', 'slack', 'gmail'].some(w => d.includes(w))),
            hasSocial: domains.some(d => ['facebook', 'twitter', 'instagram', 'linkedin'].some(s => d.includes(s))),
            hasNews: domains.some(d => ['news', 'bbc', 'cnn', 'reuters'].some(n => d.includes(n))),
            hasEntertainment: domains.some(d => ['youtube', 'netflix', 'spotify', 'twitch'].some(e => d.includes(e))),
            hasShopping: domains.some(d => ['amazon', 'shop', 'buy', 'store'].some(s => d.includes(s))),
            hasDev: domains.some(d => ['github', 'stackoverflow', 'developer'].some(dev => d.includes(dev)))
        };

        console.log('CategoryManager: Domain analysis breakdown:');
        Object.entries(analysis).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
        });

        return analysis;
    }

    async categorizeTabs(categories) {
        console.log('CategoryManager: categorizeTabs() called with categories:', categories);
        console.log('CategoryManager: Number of tabs to categorize:', this.tabManager.tabs.length);

        // MAJOR FIX: Check if AI is available and use AI for categorization when possible
        if (this.aiManager.isAIAvailable) {
            console.log('CategoryManager: Using AI for tab categorization');
            return await this.categorizeWithAI(categories, this.tabManager.tabs);
        } else {
            console.log('CategoryManager: Using logic-based categorization');
            return this.categorizeWithLogic(categories, this.tabManager.tabs);
        }
    }

    async categorizeWithAI(categories, tabs) {
        console.log('CategoryManager: categorizeWithAI() called with one-shot mapping approach');
        console.log('CategoryManager: Categories to use:', categories);
        console.log('CategoryManager: Tabs to categorize:', tabs.length);

        const categorization = {};
        categories.forEach(cat => categorization[cat] = []);

        // Create distinct category list to avoid synonyms
        const distinctCategories = this.createDistinctCategoryList(categories);
        console.log('CategoryManager: Distinct categories for AI:', distinctCategories);

        // Prepare all tabs data for one-shot processing
        const tabsData = tabs.map((tab, index) => ({
            index: index,
            title: tab.title,
            domain: tab.domain,
            url: tab.url
        }));

        // Create comprehensive one-shot prompt
        const tabDescriptions = tabsData.map(tab =>
            `${tab.index}: "${tab.title}" (${tab.domain})`
        ).join('\n');

        const prompt = `You are a browser tab categorization expert. Analyze ALL the following browser tabs and create a mapping between each tab and the most appropriate category.

AVAILABLE CATEGORIES (use these exact names):
${distinctCategories.map((cat, i) => `${i + 1}. ${cat}`).join('\n')}

TABS TO CATEGORIZE:
${tabDescriptions}

Create a mapping in the format: TAB_INDEX:CATEGORY_NAME
Example:
0:Development
1:Entertainment
2:Work & Productivity

Rules:
- Use ONLY the category names provided above (exact match)
- Every tab must be assigned to exactly one category
- Choose the most logical category based on tab title, domain, and purpose
- If uncertain, choose the closest match

MAPPING:`;

        console.log('CategoryManager: Sending one-shot categorization prompt');
        console.log('CategoryManager: Prompt preview:', prompt.substring(0, 500) + '...');

        try {
            const response = await this.aiManager.prompt(prompt);
            console.log('CategoryManager: AI one-shot response:', response);

            // Parse the mapping response
            const mappings = this.parseAIMappingResponse(response, tabs, distinctCategories);
            console.log('CategoryManager: Parsed AI mappings:', mappings);

            // Apply the mappings
            tabs.forEach((tab, index) => {
                let assignedCategory = mappings[index];

                // Validate category exists
                if (!distinctCategories.includes(assignedCategory)) {
                    console.warn(`CategoryManager: AI returned invalid category "${assignedCategory}" for tab "${tab.title}". Using first category.`);
                    assignedCategory = distinctCategories[0];
                }

                console.log(`CategoryManager: Assigning tab "${tab.title}" to category "${assignedCategory}"`);
                categorization[assignedCategory].push(tab);
            });

        } catch (error) {
            console.error('CategoryManager: Error in AI one-shot categorization:', error);

            // Fallback to distributing tabs evenly across categories
            tabs.forEach((tab, index) => {
                const categoryIndex = index % distinctCategories.length;
                const assignedCategory = distinctCategories[categoryIndex];
                console.log(`CategoryManager: Fallback assignment for tab "${tab.title}" to category "${assignedCategory}"`);
                categorization[assignedCategory].push(tab);
            });
        }

        console.log('CategoryManager: AI one-shot categorization completed');

        // Log categorization summary
        Object.entries(categorization).forEach(([category, tabs]) => {
            console.log(`CategoryManager: Category "${category}" has ${tabs.length} tabs`);
            tabs.forEach(tab => {
                console.log(`  - ${tab.title} (${tab.domain})`);
            });
        });

        return categorization;
    }

    createDistinctCategoryList(categories) {
        console.log('CategoryManager: Creating distinct category list from:', categories);

        // Remove duplicates and create distinct list
        const distinctCategories = [];
        const seenLower = new Set();

        categories.forEach(category => {
            const normalized = category.toLowerCase().trim();

            // Check for similar categories (basic synonym detection)
            let isDuplicate = false;
            for (const seen of seenLower) {
                if (this.areCategoriesSimilar(normalized, seen)) {
                    console.log(`CategoryManager: Detected similar categories: "${category}" ~ "${seen}" - skipping duplicate`);
                    isDuplicate = true;
                    break;
                }
            }

            if (!isDuplicate) {
                distinctCategories.push(category);
                seenLower.add(normalized);
                console.log(`CategoryManager: Added distinct category: "${category}"`);
            }
        });

        console.log('CategoryManager: Final distinct categories:', distinctCategories);
        return distinctCategories;
    }

    areCategoriesSimilar(cat1, cat2) {
        // Basic similarity detection for common synonyms
        const synonymGroups = [
            ['work', 'productivity', 'business', 'professional'],
            ['entertainment', 'media', 'fun', 'leisure'],
            ['social', 'communication', 'messaging'],
            ['development', 'coding', 'programming', 'dev'],
            ['news', 'information', 'articles'],
            ['shopping', 'commerce', 'buying', 'retail'],
            ['research', 'reference', 'learning', 'education'],
            ['tools', 'utilities', 'apps'],
            ['finance', 'banking', 'money'],
            ['health', 'medical', 'wellness']
        ];

        for (const group of synonymGroups) {
            const cat1InGroup = group.some(word => cat1.includes(word));
            const cat2InGroup = group.some(word => cat2.includes(word));
            if (cat1InGroup && cat2InGroup) {
                return true;
            }
        }

        // Check for exact substring matches
        return cat1.includes(cat2) || cat2.includes(cat1);
    }

    parseAIMappingResponse(response, tabs, categories) {
        console.log('CategoryManager: Parsing AI mapping response');

        const mappings = {};
        const lines = response.split('\n').filter(line => line.trim());

        lines.forEach(line => {
            const trimmedLine = line.trim();

            // Try to parse format: INDEX:CATEGORY
            const match = trimmedLine.match(/^(\d+):(.+)$/);
            if (match) {
                const tabIndex = parseInt(match[1]);
                const categoryName = match[2].trim();

                if (tabIndex >= 0 && tabIndex < tabs.length) {
                    mappings[tabIndex] = categoryName;
                    console.log(`CategoryManager: Parsed mapping ${tabIndex} -> "${categoryName}"`);
                }
            }
        });

        // Fill in missing mappings with first category
        for (let i = 0; i < tabs.length; i++) {
            if (!(i in mappings)) {
                mappings[i] = categories[0];
                console.log(`CategoryManager: Missing mapping for tab ${i}, using default: "${categories[0]}"`);
            }
        }

        return mappings;
    }

    categorizeWithLogic(categories, tabs) {
        console.log('CategoryManager: categorizeWithLogic() called');
        console.log('CategoryManager: Categories to use:', categories);
        console.log('CategoryManager: Tabs to categorize:', tabs.length);

        const categorization = {};
        categories.forEach(cat => categorization[cat] = []);
        console.log('CategoryManager: Initialized categorization structure:', Object.keys(categorization));

        tabs.forEach((tab, index) => {
            console.log(`CategoryManager: Processing tab ${index + 1}/${tabs.length}: "${tab.title}"`);
            const category = this.assignCategoryLogic(tab, categories);
            console.log(`CategoryManager: Assigned tab "${tab.title}" to category "${category}"`);
            categorization[category].push(tab);
        });

        console.log('CategoryManager: Logic-based categorization completed');
        return categorization;
    }

    assignCategoryLogic(tab, categories) {
        console.log(`CategoryManager: assignCategoryLogic() for tab: "${tab.title}"`);
        console.log(`CategoryManager: Tab URL: ${tab.url}`);
        console.log(`CategoryManager: Tab domain: ${tab.domain}`);

        const url = tab.url.toLowerCase();
        const title = tab.title.toLowerCase();
        const domain = tab.domain.toLowerCase();

        console.log(`CategoryManager: Processing lowercase - URL: ${url.substring(0, 50)}...`);
        console.log(`CategoryManager: Processing lowercase - Title: ${title}`);
        console.log(`CategoryManager: Processing lowercase - Domain: ${domain}`);

        // If we only have one category, assign all tabs to it
        if (categories.length === 1) {
            console.log(`CategoryManager: Only one category available, assigning to: ${categories[0]}`);
            return categories[0];
        }

        for (const category of categories) {
            const categoryLower = category.toLowerCase();
            console.log(`CategoryManager: Checking category: ${category}`);

            if (categoryLower.includes('work') || categoryLower.includes('productivity')) {
                const workKeywords = ['docs', 'office', 'teams', 'slack', 'calendar', 'email', 'gmail'];
                const matchedKeyword = workKeywords.find(w => url.includes(w) || domain.includes(w));
                if (matchedKeyword) {
                    console.log(`CategoryManager: Work category matched on keyword: ${matchedKeyword}`);
                    return category;
                }
            }

            if (categoryLower.includes('social')) {
                const socialKeywords = ['facebook', 'twitter', 'instagram', 'linkedin', 'reddit'];
                const matchedKeyword = socialKeywords.find(s => domain.includes(s));
                if (matchedKeyword) {
                    console.log(`CategoryManager: Social category matched on keyword: ${matchedKeyword}`);
                    return category;
                }
            }

            if (categoryLower.includes('entertainment')) {
                const entertainmentDomains = ['youtube', 'netflix', 'spotify', 'twitch'];
                const entertainmentTitles = ['video', 'music', 'game'];
                const matchedDomain = entertainmentDomains.find(e => domain.includes(e));
                const matchedTitle = entertainmentTitles.find(t => title.includes(t));
                if (matchedDomain || matchedTitle) {
                    console.log(`CategoryManager: Entertainment category matched on: ${matchedDomain || matchedTitle}`);
                    return category;
                }
            }

            if (categoryLower.includes('shopping')) {
                const shoppingKeywords = ['amazon', 'shop', 'buy', 'cart', 'store'];
                const matchedKeyword = shoppingKeywords.find(s => url.includes(s) || domain.includes(s));
                if (matchedKeyword) {
                    console.log(`CategoryManager: Shopping category matched on keyword: ${matchedKeyword}`);
                    return category;
                }
            }

            if (categoryLower.includes('news') || categoryLower.includes('information')) {
                const newsDomains = ['news', 'bbc', 'cnn', 'reuters'];
                const matchedDomain = newsDomains.find(n => domain.includes(n));
                const titleMatch = title.includes('news');
                if (matchedDomain || titleMatch) {
                    console.log(`CategoryManager: News category matched on: ${matchedDomain || 'title contains news'}`);
                    return category;
                }
            }

            if (categoryLower.includes('development') || categoryLower.includes('dev')) {
                const devDomains = ['github', 'stackoverflow', 'codepen', 'developer'];
                const devTitles = ['api', 'documentation', 'tutorial'];
                const matchedDomain = devDomains.find(d => domain.includes(d));
                const matchedTitle = devTitles.find(t => title.includes(t));
                if (matchedDomain || matchedTitle) {
                    console.log(`CategoryManager: Development category matched on: ${matchedDomain || matchedTitle}`);
                    return category;
                }
            }

            // Generic matching based on category keywords in tab content
            if (title.includes(categoryLower) || domain.includes(categoryLower)) {
                console.log(`CategoryManager: Generic match found for category: ${category}`);
                return category;
            }
        }

        // If no specific match found, assign to first category
        console.log(`CategoryManager: No specific match found, assigning to first category: ${categories[0]}`);
        return categories[0];
    }
}

// Expose globally
console.log('CategoryManager: Class definition loaded and exposed globally');
window.CategoryManager = CategoryManager;