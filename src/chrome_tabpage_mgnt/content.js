// Content script for extracting page information
// This script runs on all pages to help extract descriptions

// Function to get page description
function getPageDescription() {
  // Try meta description first
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && metaDesc.content.trim()) {
    return metaDesc.content.trim().substring(0, 120);
  }
  
  // Try Open Graph description
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc && ogDesc.content.trim()) {
    return ogDesc.content.trim().substring(0, 120);
  }
  
  // Try Twitter description
  const twitterDesc = document.querySelector('meta[name="twitter:description"]');
  if (twitterDesc && twitterDesc.content.trim()) {
    return twitterDesc.content.trim().substring(0, 120);
  }
  
  // Try first paragraph with substantial text
  const paragraphs = document.querySelectorAll('p');
  for (const p of paragraphs) {
    const text = p.textContent.trim();
    if (text.length > 30) {
      return text.substring(0, 120);
    }
  }
  
  // Try article content
  const article = document.querySelector('article');
  if (article) {
    const text = article.textContent.trim();
    if (text.length > 30) {
      return text.substring(0, 120);
    }
  }
  
  // Try main content area
  const main = document.querySelector('main');
  if (main) {
    const text = main.textContent.trim();
    if (text.length > 30) {
      return text.substring(0, 120);
    }
  }
  
  // Last resort - body text
  const bodyText = document.body.textContent.trim();
  if (bodyText.length > 30) {
    return bodyText.substring(0, 120);
  }
  
  return 'No description available';
}

// Function to get additional page metadata
function getPageMetadata() {
  return {
    title: document.title,
    description: getPageDescription(),
    url: window.location.href,
    domain: window.location.hostname,
    hasImages: document.images.length > 0,
    hasVideos: document.querySelectorAll('video').length > 0,
    wordCount: document.body.textContent.trim().split(/\s+/).length
  };
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageInfo') {
    sendResponse(getPageMetadata());
  }
});

// Store page info for quick access
window.tabScannerPageInfo = getPageMetadata();