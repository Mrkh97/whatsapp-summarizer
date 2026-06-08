# WhatsApp AI Summarizer

Chrome extension for summarizing the currently open WhatsApp Web conversation with an OpenRouter model.

## Setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Build the extension:

   ```sh
   npm run build
   ```

3. Open Chrome and go to `chrome://extensions`.
4. Enable Developer mode.
5. Click **Load unpacked** and select this folder.
6. Open `https://web.whatsapp.com`, select a chat, then open the extension popup.

## Usage

Enter:

- OpenRouter API key
- OpenRouter model name
- Lookback value and unit, such as `8 hours`
- Summary language: Auto, Turkish, or English

The extension auto-scrolls the current chat upward, collects messages in the requested time window, and sends only those extracted messages to OpenRouter for summarization.

## Notes

- This targets WhatsApp Web, not the native macOS WhatsApp app.
- The API key and model name are stored in `chrome.storage.local`.
- WhatsApp Web DOM selectors are unofficial and may require updates if WhatsApp changes its markup.
