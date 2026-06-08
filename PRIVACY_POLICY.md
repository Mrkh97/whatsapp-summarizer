# Privacy Policy for WhatsApp AI Summarizer

Effective date: June 8, 2026

WhatsApp AI Summarizer is a Chrome extension that summarizes the currently open WhatsApp Web conversation using local Ollama.

## Single Purpose

The single purpose of this extension is to summarize the currently open WhatsApp Web conversation when the user explicitly requests a summary.

## Data the Extension Accesses

When the user clicks **Summarize current chat**, the extension reads message text from the currently open WhatsApp Web chat. This may include messages from one-to-one chats or group chats, depending on which conversation is open in WhatsApp Web.

The extension may process:

- Message text visible or loaded in the current WhatsApp Web conversation
- Sender names shown in the current conversation
- Message timestamps shown in the current conversation
- User settings entered in the extension popup, including local Ollama endpoint, Ollama model name, lookback window, and summary language preference

The extension does not read all WhatsApp chats automatically. It only operates on the currently open WhatsApp Web conversation after the user clicks the summarize button.

## How Data Is Used

Collected chat text is used only to generate a summary for the user. The extension sends the collected chat text only to the local Ollama endpoint configured by the user, such as `http://localhost:11434`.

The extension asks the selected language model to return a structured summary, including a short summary, key decisions, action items, and mentioned names or dates when present.

## Data Storage

The extension stores the following settings locally in Chrome extension storage:

- Local Ollama endpoint
- Ollama model name
- Lookback window
- Summary language preference

These settings are stored locally on the user's device through Chrome's extension storage. They are not stored on a server operated by this extension.

## Data Sharing

The extension does not send collected chat text to a server operated by this extension. Collected chat text is sent only to the local Ollama endpoint configured by the user, such as `http://localhost:11434`.

The extension does not:

- Sell user data
- Use user data for advertising
- Transfer user data to data brokers
- Use user data for credit, lending, employment, or insurance decisions
- Run its own backend server
- Store chat message content after the summary request is complete

## Remote Code

The extension does not load or execute remotely hosted code. Summary responses are displayed to the user and are not executed as code.

## Permissions

The extension requests the following Chrome permissions:

- `activeTab`: Used to access the currently active WhatsApp Web tab after the user clicks the extension.
- `scripting`: Used to inject the extension's local content script into the active WhatsApp Web tab when needed.
- `storage`: Used to save the user's local Ollama endpoint, Ollama model name, lookback window, and summary language preference locally.
- `https://web.whatsapp.com/*`: Used to read the currently open WhatsApp Web conversation after the user requests a summary.
- `http://localhost/*` and `http://127.0.0.1/*`: Used to load downloaded model names and send the summary request to a local Ollama server.

## User Control

The user controls when summarization happens by clicking the extension's summarize button. The user also controls which local Ollama model is used.

The user can remove locally stored settings by uninstalling the extension or clearing the extension's site and extension storage through Chrome.

## Contact

For privacy questions or support, use the support contact listed on the Chrome Web Store listing or open an issue in the project repository:

https://github.com/Mrkh97/whatsapp-summarizer
