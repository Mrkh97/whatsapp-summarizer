# WhatsApp AI Summarizer

Chrome extension for summarizing the currently open WhatsApp Web conversation with local Ollama.

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

Choose:

- Ollama endpoint, defaulting to `http://localhost:11434`
- One of the downloaded Ollama models loaded from `/api/tags`
- Lookback value and unit, such as `8 hours`
- Summary language: Auto, Turkish, or English

The extension auto-scrolls the current chat upward, collects messages in the requested time window, and summarizes those extracted messages with local Ollama.

## Notes

- This targets WhatsApp Web, not the native macOS WhatsApp app.
- Ollama must be running locally and at least one model must be downloaded.
- Run `ollama pull gemma4:e4b` to install the recommended model if the dropdown is empty.
- If the extension shows HTTP 403, Ollama is running but rejecting the extension origin. Allow the shown `chrome-extension://...` origin in `OLLAMA_ORIGINS`, restart Ollama, then refresh models.
- Ollama endpoint, Ollama model name, lookback window, and summary language are stored in `chrome.storage.local`.
- WhatsApp Web DOM selectors are unofficial and may require updates if WhatsApp changes its markup.

## Allow Chrome Extensions in Ollama

If Ollama returns HTTP 403 on macOS, run:

```sh
launchctl setenv OLLAMA_ORIGINS "chrome-extension://*"
pkill -x Ollama
open -a Ollama
```

On Windows, run in PowerShell:

```powershell
[Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS", "chrome-extension://*", "User")
Stop-Process -Name "ollama app" -ErrorAction SilentlyContinue
Start-Process "$env:LOCALAPPDATA\Programs\Ollama\Ollama app.exe"
```

On Linux with the systemd service, run:

```sh
sudo mkdir -p /etc/systemd/system/ollama.service.d
printf '[Service]\nEnvironment="OLLAMA_ORIGINS=chrome-extension://*"\n' | sudo tee /etc/systemd/system/ollama.service.d/origins.conf >/dev/null
sudo systemctl daemon-reload
sudo systemctl restart ollama
```
