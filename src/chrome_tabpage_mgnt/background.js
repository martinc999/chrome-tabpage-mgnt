chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "openOptions",
    title: "Options",
    contexts: ["action"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "openOptions") {
    chrome.runtime.openOptionsPage();
  }
});