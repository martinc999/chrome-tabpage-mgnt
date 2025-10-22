document.addEventListener('DOMContentLoaded', () => {
  const loggingCheckbox = document.getElementById('loggingEnabled');

  // Load the saved setting
  chrome.storage.sync.get('loggingEnabled', (data) => {
    loggingCheckbox.checked = !!data.loggingEnabled;
  });

  // Save the setting when the checkbox is changed
  loggingCheckbox.addEventListener('change', () => {
    chrome.storage.sync.set({ loggingEnabled: loggingCheckbox.checked });
  });
});