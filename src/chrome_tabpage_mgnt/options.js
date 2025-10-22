document.addEventListener('DOMContentLoaded', () => {
  const loggingCheckbox = document.getElementById('loggingEnabled');
  const categoriesTextarea = document.getElementById('predefinedCategories');
  const saveButton = document.getElementById('saveCategories');

  // Load the saved settings
  chrome.storage.sync.get(['loggingEnabled', 'predefinedCategories'], (data) => {
    loggingCheckbox.checked = !!data.loggingEnabled;
    if (data.predefinedCategories) {
      categoriesTextarea.value = data.predefinedCategories.join('\n');
    }
  });

  // Save the logging setting when the checkbox is changed
  loggingCheckbox.addEventListener('change', () => {
    chrome.storage.sync.set({ loggingEnabled: loggingCheckbox.checked });
  });

  // Save the categories when the save button is clicked
  saveButton.addEventListener('click', () => {
    const categories = categoriesTextarea.value.split('\n').filter(c => c.trim() !== '');
    chrome.storage.sync.set({ predefinedCategories: categories }, () => {
      alert('Categories saved!');
    });
  });
});