// categoryManager.js
class CategoryManager {
    constructor(tabManager, aiManager) {
        console.log('CategoryManager: Initializing with tabManager and aiManager');
        this.tabManager = tabManager;
        this.aiManager = aiManager;
        console.log('CategoryManager: Constructor completed');
        this.TAB_CATEGORY_CACHE_KEY = 'tabCategories';
    }

    async clearCategoryCache() {
        console.log('CategoryManager: Clearing category cache');

        return new Promise((resolve) => {
            chrome.storage.local.remove(this.TAB_CATEGORY_CACHE_KEY, () => {
                console.log('CategoryManager: Category cache cleared successfully');
                resolve(true);
            });
        });
    }

    async getCacheSize() {
        return new Promise((resolve) => {
            chrome.storage.local.get(this.TAB_CATEGORY_CACHE_KEY, (data) => {
                const cache = data[this.TAB_CATEGORY_CACHE_KEY] || {};
                const size = Object.keys(cache).length;
                console.log(`CategoryManager: Current cache size: ${size} entries`);
                resolve(size);
            });
        });
    }

    async generatePredefinedCategories(progressCallback = null) {
        console.log('CategoryManager: generatePredefinedCategories() called');

        if (this.aiManager.isAIAvailable) {
            console.log('CategoryManager: AI is available, generating AI-based categories');
            const result = await this.processAllTabsInChunks('predefined', null, progressCallback);
            console.log('CategoryManager: Final merged AI categories:', result.categories.join('\\'));
            return result;
        } else {
            console.log('CategoryManager: AI not available, using fallback categories');
            return {
                categories: this.generateFallbackCategories(),
                groupedTabs: {}
            };
        }
    }

    async generateDiscoverCategories(prompt, progressCallback = null) {
        console.log('CategoryManager: generateDiscoverCategories() called with prompt:', prompt);

        console.log('CategoryManager: AI not available, using fallback categories');
        return {
            categories: this.generateFallbackCategories(),
            groupedTabs: {}
        };
    }

    generateFallbackCategories() {
        console.log('CategoryManager: generateFallbackCategories() called');

        const domainAnalysis = this.analyzeDomains();
        console.log('CategoryManager: Domain analysis result:', domainAnalysis);

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
                        return null;
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

    async processAllTabsInChunks(mode, customPrompt = null, progressCallback = null) {
        console.log('CategoryManager: processAllTabsInChunks() called with mode:', mode);

        const allTabs = this.tabManager.tabs;
        const totalTabs = allTabs.length;

        // Load cache from chrome.storage.local
        let cache = await new Promise((resolve) => {
            chrome.storage.local.get(this.TAB_CATEGORY_CACHE_KEY, (data) => {
                resolve(data[this.TAB_CATEGORY_CACHE_KEY] || {});
            });
        });

        // Split tabs into known (cached) and unknown
        const knownTabs = [];
        const unknownTabs = [];
        for (const tab of allTabs) {
            const key = `${tab.id}_${tab.windowId}_${encodeURIComponent(tab.title)}_${tab.domain}`;
            if (cache[key]) {
                tab.cachedCategory = cache[key];
                knownTabs.push(tab);
            } else {
                unknownTabs.push(tab);
            }
        }

        console.log(`CategoryManager: ${knownTabs.length} known tabs from cache, ${unknownTabs.length} unknown tabs to process.`);

        let newCategories = [];
        let newGroupedTabs = {};
        let processedTabs = knownTabs.length;

        if (unknownTabs.length > 0) {
            const chunkSize = 1;
            const totalChunks = Math.ceil(unknownTabs.length / chunkSize);

            console.log(`CategoryManager: Processing ${unknownTabs.length} unknown tabs with concurrency limit.`);

            const chunks = [];
            for (let i = 0; i < totalChunks; i++) {
                const startIndex = i * chunkSize;
                const endIndex = Math.min(startIndex + chunkSize, unknownTabs.length);
                chunks.push(unknownTabs.slice(startIndex, endIndex));
            }

            const processChunk = async (chunk, index) => {
                const tabInfoList = chunk.map(tab => {
                    const url = new URL(tab.url);
                    const url_ext = url.pathname + url.search + url.hash;
                    return {
                        formatted: `${tab.id}\\${tab.windowId}\\${tab.domain}\\${tab.title}\\${url_ext}`,
                        tabObject: tab
                    };
                });

                const tabInfo = tabInfoList.map(t => t.formatted).join('\n');

                try {
                    console.log(`CategoryManager: Processing chunk ${index + 1}/${totalChunks}`);

                    let result;
                    if (mode === 'predefined') {
                        result = await this.aiManager.generateCategoriesFromTabNames(tabInfo);
                    } else if (mode === 'custom') {
                        result = await this.aiManager.generateCategoriesWithCustomPrompt(customPrompt, tabInfo);
                    }

                    console.log(`CategoryManager: Chunk ${index + 1} generated categories:`, result.categories);

                    processedTabs += chunk.length;
                    if (progressCallback) {
                        const progress = Math.round((processedTabs / totalTabs) * 100);
                        progressCallback(progress, processedTabs, totalTabs);
                    }

                    return {
                        categories: result.categories,
                        tabInfoList: tabInfoList
                    };

                } catch (error) {
                    console.error(`CategoryManager: Error processing chunk ${index + 1}:`, error);
                    return {
                        categories: ['Unknown'],
                        tabInfoList: tabInfoList
                    };
                }
            };

            const concurrencyLimit = 1;
            const allResults = (await this.processInParallel(chunks, processChunk, concurrencyLimit))
                .filter(res => res !== null);

            // Download mapping file with allResults for unknown tabs
            console.log('CategoryManager: Downloading mapping with allResults including categories for unknown tabs');
            // this.downloadMapping(allResults);

            const allCategorySets = allResults.map(res => res.categories).filter(set => set && set.length > 0);
            console.log('CategoryManager: All chunks processed. Category sets collected:', allCategorySets.length);

            if (allCategorySets.length === 0) {
                newCategories = this.generateFallbackCategories();
                newGroupedTabs = {};
            } else {
                newCategories = this.mergeCategories(allCategorySets);
                newGroupedTabs = this.groupTabsByCategories(allResults, newCategories);
            }
        } else {
            if (progressCallback) {
                progressCallback(100, totalTabs, totalTabs);
            }
        }

        // Group known tabs
        const knownGroupedTabs = {};
        knownTabs.forEach(tab => {
            const category = tab.cachedCategory;
            if (!knownGroupedTabs[category]) {
                knownGroupedTabs[category] = [];
            }
            knownGroupedTabs[category].push(tab);
        });

        // Merge grouped tabs
        const finalGroupedTabs = { ...knownGroupedTabs };
        Object.entries(newGroupedTabs).forEach(([category, tabs]) => {
            if (!finalGroupedTabs[category]) {
                finalGroupedTabs[category] = [];
            }
            finalGroupedTabs[category].push(...tabs);
        });

        // Merge categories: unique list from all used categories
        const finalCategories = [...new Set([...newCategories, ...Object.keys(knownGroupedTabs)])];

        console.log('CategoryManager: Final result with grouped tabs:', {
            categories: finalCategories,
            groupedTabsKeys: Object.keys(finalGroupedTabs)
        });

        // Clean and update cache: recreate cache with only current tabs
        const updatedCache = {};
        allTabs.forEach(tab => {
            const key = `${tab.id}_${tab.windowId}_${encodeURIComponent(tab.title)}_${tab.domain}`;
            // Find category for this tab from finalGroupedTabs
            let category = null;
            for (const [cat, tabs] of Object.entries(finalGroupedTabs)) {
                if (tabs.some(t => t.id === tab.id)) {
                    category = cat;
                    break;
                }
            }
            if (category) {
                updatedCache[key] = category;
            }
        });

        await new Promise((resolve) => {
            chrome.storage.local.set({ [this.TAB_CATEGORY_CACHE_KEY]: updatedCache }, () => {
                resolve();
            });
        });
        console.log('CategoryManager: Cleaned and updated cache with current tab categories.');

        return {
            categories: finalCategories,
            groupedTabs: finalGroupedTabs
        };
    }

    groupTabsByCategories(results, categories) {
        console.log('CategoryManager: Grouping tabs by categories');

        const grouped = {};
        categories.forEach(cat => grouped[cat] = []);

        results.forEach((result, resultIndex) => {
            const assignedCategories = result.categories;
            const tabInfoList = result.tabInfoList;

            tabInfoList.forEach((tabInfo, tabIndex) => {
                // Assign to the first category from this result, or distribute evenly
                const categoryIndex = tabIndex % assignedCategories.length;
                const assignedCategory = assignedCategories[categoryIndex];

                // Find matching category in merged list (case-insensitive)
                const matchingCategory = categories.find(cat =>
                    cat.toLowerCase().trim() === assignedCategory.toLowerCase().trim()
                ) || categories[0];

                grouped[matchingCategory].push(tabInfo.tabObject);

                console.log(`CategoryManager: Assigned tab "${tabInfo.tabObject.title}" to "${matchingCategory}"`);
            });
        });

        // Log summary
        Object.entries(grouped).forEach(([category, tabs]) => {
            console.log(`CategoryManager: Category "${category}" contains ${tabs.length} tabs`);
        });

        return grouped;
    }

    downloadMapping(allResults, filenamePrefix = 'categorization-mapping') {
        if (!allResults || allResults.length === 0) {
            console.log('CategoryManager: No mapping data to download.');
            return;
        }

        // Extract formatted strings from allResults with category information using res.categories
        const mappingArray = allResults.flatMap(res =>
            res.tabInfoList.map((t, tabIndex) => {
                // Use the category from res.categories based on tab index
                const categoryIndex = tabIndex % res.categories.length;
                const category = res.categories[categoryIndex] || 'Unknown';
                return `${t.formatted}\\${category}`;
            })
        );

        console.log('CategoryManager: Extracted mapping array with categories:', mappingArray.length, 'entries');

        const content = mappingArray.join('\n');
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        // chrome.downloads.download({
        //     url: url,
        //     filename: `${filenamePrefix}-${Date.now()}.txt`,
        //     saveAs: false
        // }, () => {
        //     if (chrome.runtime.lastError) {
        //         console.error('CategoryManager: Download failed:', chrome.runtime.lastError);
        //     }
        // });

        console.log(`CategoryManager: Triggered download for mapping file with ${mappingArray.length} entries including categories.`);
    }

    mergeCategories(categorySets) {
        console.log('CategoryManager: mergeCategories() called with sets:', categorySets.length);

        if (categorySets.length === 0) return [];
        if (categorySets.length === 1) return categorySets[0];

        const allCategories = [];
        categorySets.forEach((categories, setIndex) => {
            categories.forEach(category => {
                allCategories.push(category);
            });
        });

        const categoryCount = {};
        allCategories.forEach(category => {
            const normalized = category.toLowerCase().trim();
            categoryCount[normalized] = (categoryCount[normalized] || 0) + 1;
        });

        const uniqueCategories = [];
        const seenNormalized = new Set();

        const sortedByFrequency = Object.entries(categoryCount)
            .sort(([, a], [, b]) => b - a)
            .map(([normalizedCat]) => normalizedCat);

        sortedByFrequency.forEach(normalizedCategory => {
            if (!seenNormalized.has(normalizedCategory)) {
                const originalCategory = allCategories.find(cat =>
                    cat.toLowerCase().trim() === normalizedCategory
                );
                if (originalCategory) {
                    uniqueCategories.push(originalCategory);
                    seenNormalized.add(normalizedCategory);
                }
            }
        });

        console.log('CategoryManager: Merged unique categories:', uniqueCategories);
        return uniqueCategories;
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
        console.log('CategoryManager: categorizeTabs() called with categories:', categories);

        // Uproszczenie: Zakładamy brak AI, więc zawsze używamy logiki
        console.log('CategoryManager: Using logic-based categorization');
        return this.categorizeWithLogic(categories, this.tabManager.tabs);
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

        if (categories.length === 1) return categories[0];

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

            if (title.includes(categoryLower) || domain.includes(categoryLower)) {
                return category;
            }
        }

        return categories[0];
    }

    async simplifyCategoriesAI(categorizedTabs) {
        console.log('CategoryManager: simplifyCategoriesAI() called');
        const currentCategories = Object.keys(categorizedTabs);

        if (currentCategories.length < 2) {
            console.log('Not enough categories to simplify.');
            return {
                simplifiedTabs: categorizedTabs,
                simplifiedCategories: currentCategories
            };
        }

        // Get the mapping from old to new categories from the AI
        const categoryMap = await this.aiManager.simplifyCategoryList(currentCategories);
        console.log('AI simplification map:', categoryMap);

        const simplifiedTabs = {};
        const newCategorySet = new Set();

        // Re-group tabs based on the new mapping
        for (const oldCategory in categoryMap) {
            if (categorizedTabs[oldCategory]) {
                const newCategory = categoryMap[oldCategory];
                newCategorySet.add(newCategory);

                if (!simplifiedTabs[newCategory]) {
                    simplifiedTabs[newCategory] = [];
                }
                simplifiedTabs[newCategory].push(...categorizedTabs[oldCategory]);
            }
        }

        console.log('Simplified categories result:', simplifiedTabs);
        return {
            simplifiedTabs: simplifiedTabs,
            simplifiedCategories: Array.from(newCategorySet)
        };
    }
}

console.log('CategoryManager: Class definition loaded and exposed globally');
window.CategoryManager = CategoryManager;