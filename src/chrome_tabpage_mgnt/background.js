chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "openOptions",
    title: "Options",
    contexts: ["action"]
  });

  // Set default categories on installation
  chrome.storage.sync.get('predefinedCategories', (data) => {
    if (!data.predefinedCategories) {
      const defaultCategories = [
        "Coding",
        "Data Science",
        "Social Media",
        "Development",
        "News/AI"
      ];
      chrome.storage.sync.set({ predefinedCategories: defaultCategories });
    }
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "openOptions") {
    chrome.runtime.openOptionsPage();
  }
});