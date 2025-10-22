// aiLogger.js
class AILogger {
    constructor(options = {}) {
        this.logEntries = [];
        this.batchSize = 100;
        this.flushOnUnload = options.flushOnUnload || false;
        if (this.flushOnUnload) {
            window.addEventListener('beforeunload', () => this.flush());
        }
    }

    log(systemPrompt, prompt, response) {
        // Log to console for immediate debugging visibility
        console.groupCollapsed(`AI Interaction Log: ${systemPrompt.substring(0, 100).replace(/\n/g, ' ')}...`);
        console.log('System Prompt:', systemPrompt);
        console.log('Prompt:', prompt);
        console.log('Response:', response);
        const content = `Timestamp: ${new Date().toISOString()}\n\n--- SYSTEM PROMPT ---\n${systemPrompt}\n\n--- PROMPT ---\n${prompt}\n\n--- RESPONSE ---\n${response}\n\n====================\n\n`;
        this.logEntries.push(content);

        if (this.logEntries.length >= this.batchSize) {
            this.downloadLogBatch();
        }
        console.groupEnd();
    }

    downloadLogBatch() {
        if (this.logEntries.length === 0) {
            return;
        }

        const fullContent = this.logEntries.join('');
        const blob = new Blob([fullContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        chrome.downloads.download({
            url: url,
            filename: `ai-log-batch-${Date.now()}.txt`,
            saveAs: false
        });

        // Clear the entries after downloading
        this.logEntries = [];
    }

    flush() {
        this.downloadLogBatch();
    }
}
