# Chrome Web Store Privacy Form Text

## Single purpose description

The single purpose of this extension is to summarize the currently open WhatsApp Web conversation using a local Ollama model selected by the user.

## Permission justifications

### activeTab justification

The activeTab permission is used only when the user clicks the extension button while on WhatsApp Web. It allows the extension to communicate with the currently active WhatsApp Web tab and collect messages from the currently open chat for summarization.

### scripting justification

The scripting permission is used to inject the extension's local content script into the active WhatsApp Web tab when needed. This allows the extension to collect messages from the currently open chat after the user clicks summarize.

### storage justification

The storage permission is used to save the user's local Ollama endpoint, selected Ollama model name, lookback window, and summary language preference locally in Chrome extension storage. This prevents the user from needing to re-enter these settings each time.

### Host permission justification

The extension requires access to https://web.whatsapp.com/* to read the currently open WhatsApp Web conversation when the user requests a summary. It also requires access to http://localhost/* and http://127.0.0.1/* to load local Ollama model names and send the extracted chat text to the user's local Ollama server for summarization.

## Remote code

Select: No, I am not using remote code.

## Data usage

Recommended selections:

- Personal communications
- Website content

The extension reads message text, sender names, and timestamps from the currently open WhatsApp Web conversation only after the user clicks summarize. The extension does not run a developer-operated backend, does not sell data, does not use data for advertising, and does not store chat message content after the summary request is complete.

## Privacy policy URL

https://github.com/Mrkh97/whatsapp-summarizer/blob/main/PRIVACY_POLICY.md
