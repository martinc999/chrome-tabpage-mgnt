// aiLogger.js
class AILogger {
    log(systemPrompt, prompt, response) {
        const content = `Timestamp: ${new Date().toISOString()}\n\n--- SYSTEM PROMPT ---\n${systemPrompt}\n\n--- PROMPT ---\n${prompt}\n\n--- RESPONSE ---\n${response}`;
        const blob = new Blob([content], {type: 'text/plain'});
        const url = URL.createObjectURL(blob);
        
        chrome.downloads.download({
            url: url,
            filename: `ai-log-${Date.now()}.txt`,
            saveAs: false
        });
    }
}

