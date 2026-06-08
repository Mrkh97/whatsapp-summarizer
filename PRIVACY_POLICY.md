# Privacy Policy for WhatsApp AI Summarizer

Effective date: June 8, 2026

WhatsApp AI Summarizer is a Chrome extension that summarizes the currently open WhatsApp Web conversation using an OpenRouter-compatible language model selected by the user.

## Single Purpose

The single purpose of this extension is to summarize the currently open WhatsApp Web conversation when the user explicitly requests a summary.

## Data the Extension Accesses

When the user clicks **Summarize current chat**, the extension reads message text from the currently open WhatsApp Web chat. This may include messages from one-to-one chats or group chats, depending on which conversation is open in WhatsApp Web.

The extension may process:

- Message text visible or loaded in the current WhatsApp Web conversation
- Sender names shown in the current conversation
- Message timestamps shown in the current conversation
- User settings entered in the extension popup, including OpenRouter API key, model name, lookback window, and summary language preference

The extension does not read all WhatsApp chats automatically. It only operates on the currently open WhatsApp Web conversation after the user clicks the summarize button.

## How Data Is Used

Collected chat text is used only to generate a summary for the user. The extension sends the collected chat text to OpenRouter's API using the OpenRouter API key provided by the user.

The extension asks the selected language model to return a structured summary, including a short summary, key decisions, action items, and mentioned names or dates when present.

## Data Storage

The extension stores the following settings locally in Chrome extension storage:

- OpenRouter API key
- Model name
- Lookback window
- Summary language preference

These settings are stored locally on the user's device through Chrome's extension storage. They are not stored on a server operated by this extension.

## Data Sharing

The extension sends collected chat text to OpenRouter only when the user requests a summary. OpenRouter processes the request according to its own terms and privacy policy.

The extension does not:

- Sell user data
- Use user data for advertising
- Transfer user data to data brokers
- Use user data for credit, lending, employment, or insurance decisions
- Run its own backend server
- Store chat message content after the summary request is complete

## Remote Code

The extension does not load or execute remotely hosted code. It sends data to OpenRouter's API and receives a text response. The response is displayed to the user and is not executed as code.

## Permissions

The extension requests the following Chrome permissions:

- `activeTab`: Used to access the currently active WhatsApp Web tab after the user clicks the extension.
- `scripting`: Used to inject the extension's local content script into the active WhatsApp Web tab when needed.
- `storage`: Used to save the user's OpenRouter API key, model name, lookback window, and summary language preference locally.
- `https://web.whatsapp.com/*`: Used to read the currently open WhatsApp Web conversation after the user requests a summary.
- `https://openrouter.ai/*`: Used to send the summary request to OpenRouter.

## User Control

The user controls when summarization happens by clicking the extension's summarize button. The user also controls which OpenRouter model is used by entering the model name in the extension popup.

The user can remove locally stored settings by uninstalling the extension or clearing the extension's site and extension storage through Chrome.

## Contact

For privacy questions or support, use the support contact listed on the Chrome Web Store listing or open an issue in the project repository:

https://github.com/Mrkh97/whatsapp-summarizer
