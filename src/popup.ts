import type {
  ChatMessage,
  CollectMessagesResponse,
  LookbackUnit,
  SummaryLanguage,
  SummarizeMessagesResult
} from "./types";

const DEFAULT_OLLAMA_ENDPOINT = "http://localhost:11434";
const RECOMMENDED_OLLAMA_MODEL = "gemma4:e4b";

const ollamaEndpointInput = requiredElement<HTMLInputElement>("#ollamaEndpoint");
const ollamaModelInput = requiredElement<HTMLSelectElement>("#ollamaModel");
const refreshModelsButton = requiredElement<HTMLButtonElement>("#refreshModelsButton");
const lookbackValueInput = requiredElement<HTMLInputElement>("#lookbackValue");
const lookbackUnitInput = requiredElement<HTMLSelectElement>("#lookbackUnit");
const summaryLanguageInput = requiredElement<HTMLSelectElement>("#summaryLanguage");
const summarizeButton = requiredElement<HTMLButtonElement>("#summarizeButton");
const statusElement = requiredElement<HTMLElement>("#status");
const commandHelpElement = requiredElement<HTMLElement>("#commandHelp");
const commandTextInput = requiredElement<HTMLTextAreaElement>("#commandText");
const copyCommandButton = requiredElement<HTMLButtonElement>("#copyCommandButton");
const resultElement = requiredElement<HTMLElement>("#result");

void restoreSettings();

ollamaEndpointInput.addEventListener("change", () => {
  void refreshOllamaModels(ollamaModelInput.value, true);
});

refreshModelsButton.addEventListener("click", () => {
  void refreshOllamaModels(ollamaModelInput.value, true);
});

copyCommandButton.addEventListener("click", () => {
  void copyCommandText();
});

summarizeButton.addEventListener("click", () => {
  void summarizeCurrentChat();
});

async function restoreSettings(): Promise<void> {
  const settings = await chrome.storage.local.get({
    ollamaEndpoint: DEFAULT_OLLAMA_ENDPOINT,
    ollamaModel: RECOMMENDED_OLLAMA_MODEL,
    lookbackValue: 8,
    lookbackUnit: "hours",
    summaryLanguage: "auto"
  });

  ollamaEndpointInput.value = readString(settings.ollamaEndpoint) || DEFAULT_OLLAMA_ENDPOINT;
  lookbackValueInput.value = String(readNumber(settings.lookbackValue, 8));
  lookbackUnitInput.value = readLookbackUnit(settings.lookbackUnit);
  summaryLanguageInput.value = readSummaryLanguage(settings.summaryLanguage);
  setModelOptions([], readString(settings.ollamaModel) || RECOMMENDED_OLLAMA_MODEL, "Loading Ollama models...");
  await refreshOllamaModels(readString(settings.ollamaModel) || RECOMMENDED_OLLAMA_MODEL, false);
}

async function summarizeCurrentChat(): Promise<void> {
  clearOutput();

  const ollamaEndpoint = ollamaEndpointInput.value.trim() || DEFAULT_OLLAMA_ENDPOINT;
  const ollamaModel = ollamaModelInput.value;
  const lookbackValue = Number(lookbackValueInput.value);
  const lookbackUnit = lookbackUnitInput.value as LookbackUnit;
  const summaryLanguage = readSummaryLanguage(summaryLanguageInput.value);

  if (!ollamaModel) {
    setStatus("Select an Ollama model. Use Refresh after starting Ollama or downloading a model.", true);
    return;
  }

  if (!Number.isInteger(lookbackValue) || lookbackValue < 1) {
    setStatus("Enter a whole lookback value greater than zero.", true);
    return;
  }

  await chrome.storage.local.set({
    ollamaEndpoint,
    ollamaModel,
    lookbackValue,
    lookbackUnit,
    summaryLanguage
  });

  const tab = await findActiveWhatsAppTab();

  if (!tab.id) {
    setStatus("Open WhatsApp Web and select a chat first.", true);
    return;
  }

  const cutoff = new Date();
  cutoff.setTime(cutoff.getTime() - lookbackValue * (lookbackUnit === "hours" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000));

  summarizeButton.disabled = true;
  setStatus("Collecting messages from the current chat...");

  try {
    const collected = await collectFromTab(tab.id, cutoff.toISOString(), lookbackUnit);

    if (!collected.ok) {
      setStatus(collected.error ?? "Could not collect WhatsApp messages.", true);
      return;
    }

    if (collected.messages.length === 0) {
      setStatus("No messages found in that time window.");
      return;
    }

    const warning = collected.warning ? ` ${collected.warning}` : "";
    setStatus(`Summarizing ${collected.messages.length} message${collected.messages.length === 1 ? "" : "s"} with Ollama...${warning}`);

    const summarized = await summarizeWithOllama({
      endpoint: ollamaEndpoint,
      model: ollamaModel,
      summaryLanguage,
      lookbackLabel: `${lookbackValue} ${lookbackUnit}`,
      messages: collected.messages
    });

    if (!summarized.ok || !summarized.summary) {
      setStatus(summarized.error ?? "Could not summarize messages.", true);
      return;
    }

    setStatus(warning.trim() || "Summary ready.");
    resultElement.textContent = summarized.summary;
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Summarization failed.", true);
  } finally {
    summarizeButton.disabled = false;
  }
}

async function summarizeWithOllama(options: {
  endpoint: string;
  model: string;
  summaryLanguage: SummaryLanguage;
  lookbackLabel: string;
  messages: ChatMessage[];
}): Promise<SummarizeMessagesResult> {
  let url: string;

  try {
    url = readLocalOllamaApiUrl(options.endpoint, "chat");
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Enter a valid local Ollama endpoint."
    };
  }

  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: options.model,
        stream: false,
        options: {
          temperature: 0.2
        },
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(options.summaryLanguage)
          },
          {
            role: "user",
            content: buildUserPrompt(options.lookbackLabel, options.messages)
          }
        ]
      })
    });
  } catch {
    return {
      ok: false,
      error: readOllamaUnavailableMessage(options.endpoint)
    };
  }

  const payload = await response.json().catch(() => null) as OllamaChatResponse | null;

  if (!response.ok) {
    return {
      ok: false,
      error: readOllamaHttpError(payload, response.status, "")
    };
  }

  const summary = payload?.message?.content?.trim();

  if (!summary) {
    return { ok: false, error: "Ollama returned an empty summary." };
  }

  return { ok: true, summary };
}

function buildSystemPrompt(summaryLanguage: SummaryLanguage): string {
  return [
    "You summarize WhatsApp conversations for the user.",
    "Return exactly these sections: Short summary, Key decisions, Action items, Mentioned names/dates.",
    readLanguageInstruction(summaryLanguage),
    "Keep it concise. If a section has nothing useful, write None."
  ].join(" ");
}

function buildUserPrompt(lookbackLabel: string, messages: ChatMessage[]): string {
  const transcript = messages
    .map((message) => `[${message.timestamp}] ${message.sender}: ${message.text}`)
    .join("\n");

  return `Summarize this WhatsApp chat from the last ${lookbackLabel}.\n\n${transcript}`;
}

function readLanguageInstruction(summaryLanguage: SummaryLanguage): string {
  if (summaryLanguage === "tr") {
    return "Write the summary in Turkish.";
  }

  if (summaryLanguage === "en") {
    return "Write the summary in English.";
  }

  return "Detect the main language used in the chat transcript and write the summary in that language. If the main language is unclear, write the summary in English.";
}

async function refreshOllamaModels(preferredModel: string, showSuccess: boolean): Promise<void> {
  const endpoint = ollamaEndpointInput.value.trim() || DEFAULT_OLLAMA_ENDPOINT;

  refreshModelsButton.disabled = true;
  setModelOptions([], preferredModel, "Loading Ollama models...");

  try {
    const models = await fetchOllamaModels(endpoint);

    if (models.length === 0) {
      setModelOptions([], preferredModel, "No downloaded models found");
      setStatus(`No downloaded Ollama models found. Run \`ollama pull ${RECOMMENDED_OLLAMA_MODEL}\`, then refresh.`, true);
      return;
    }

    const selectedModel = models.includes(preferredModel) ? preferredModel : models[0];

    setModelOptions(models, selectedModel);
    await chrome.storage.local.set({
      ollamaEndpoint: endpoint,
      ollamaModel: selectedModel
    });

    if (showSuccess) {
      setStatus(`Loaded ${models.length} Ollama model${models.length === 1 ? "" : "s"}.`);
    }
  } catch (error) {
    setModelOptions([], preferredModel, "Ollama unavailable");
    setStatus(error instanceof Error ? error.message : "Could not load Ollama models.", true);
  } finally {
    refreshModelsButton.disabled = false;
  }
}

async function fetchOllamaModels(endpoint: string): Promise<string[]> {
  let response: Response;

  try {
    response = await fetch(readLocalOllamaApiUrl(endpoint, "tags"));
  } catch {
    throw new Error(readOllamaUnavailableMessage(endpoint));
  }

  const payload = await response.json().catch(() => null) as OllamaTagsResponse | null;

  if (!response.ok) {
    throw new Error(readOllamaHttpError(payload, response.status, " while loading models"));
  }

  const models = payload?.models
    ?.map((model) => model.name)
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
    .sort((a, b) => a.localeCompare(b));

  return models ?? [];
}

function readOllamaUnavailableMessage(endpoint: string): string {
  const target = endpoint.trim() || DEFAULT_OLLAMA_ENDPOINT;

  if (target === DEFAULT_OLLAMA_ENDPOINT) {
    return `Ollama is not available at ${DEFAULT_OLLAMA_ENDPOINT}. It may not be downloaded or running, or it may be running on another port.`;
  }

  return `Ollama is not available at ${target}. It may not be downloaded or running, or the endpoint/port may be wrong.`;
}

function readOllamaHttpError(
  payload: OllamaChatResponse | OllamaTagsResponse | null,
  status: number,
  context: string
): string {
  if (status === 403) {
    showCommandHelp(buildOllamaOriginCommands());

    return [
      "Ollama is running, but it rejected this Chrome extension origin.",
      `Allow chrome-extension://${chrome.runtime.id} in OLLAMA_ORIGINS, then restart Ollama and refresh models.`,
      "If Ollama is running on another port, update the endpoint."
    ].join(" ");
  }

  return readOllamaError(payload) ?? `Ollama returned HTTP ${status}${context}.`;
}

function buildOllamaOriginCommands(): string {
  const platform = readPlatform();

  if (platform === "windows") {
    return [
      '[Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS", "chrome-extension://*", "User")',
      'Stop-Process -Name "ollama app" -ErrorAction SilentlyContinue',
      'Start-Process "$env:LOCALAPPDATA\\Programs\\Ollama\\Ollama app.exe"'
    ].join("\n");
  }

  if (platform === "linux") {
    return [
      "sudo mkdir -p /etc/systemd/system/ollama.service.d",
      'printf \'[Service]\\nEnvironment="OLLAMA_ORIGINS=chrome-extension://*"\\n\' | sudo tee /etc/systemd/system/ollama.service.d/origins.conf >/dev/null',
      "sudo systemctl daemon-reload",
      "sudo systemctl restart ollama"
    ].join("\n");
  }

  return [
    'launchctl setenv OLLAMA_ORIGINS "chrome-extension://*"',
    "pkill -x Ollama",
    'open -a Ollama'
  ].join("\n");
}

function readPlatform(): "macos" | "windows" | "linux" {
  const platform = `${navigator.userAgentData?.platform ?? navigator.platform}`.toLowerCase();

  if (platform.includes("win")) {
    return "windows";
  }

  if (platform.includes("linux")) {
    return "linux";
  }

  return "macos";
}

function showCommandHelp(commandText: string): void {
  commandTextInput.value = commandText;
  copyCommandButton.textContent = "Copy commands";
  commandHelpElement.classList.remove("hidden");
}

function hideCommandHelp(): void {
  commandTextInput.value = "";
  copyCommandButton.textContent = "Copy commands";
  commandHelpElement.classList.add("hidden");
}

async function copyCommandText(): Promise<void> {
  await navigator.clipboard.writeText(commandTextInput.value);
  copyCommandButton.textContent = "Copied";
}

function setModelOptions(models: string[], selectedModel: string, placeholder?: string): void {
  ollamaModelInput.textContent = "";

  if (placeholder) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = placeholder;
    option.disabled = true;
    option.selected = true;
    ollamaModelInput.append(option);
    ollamaModelInput.disabled = true;
    return;
  }

  for (const model of models) {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    option.selected = model === selectedModel;
    ollamaModelInput.append(option);
  }

  ollamaModelInput.disabled = models.length === 0;
}

function readLocalOllamaApiUrl(endpoint: string, apiPath: "chat" | "tags"): string {
  const url = new URL(endpoint);

  if (url.protocol !== "http:") {
    throw new Error("Ollama endpoint must use HTTP.");
  }

  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("Ollama endpoint must be local: localhost or 127.0.0.1.");
  }

  const path = url.pathname.replace(/\/+$/, "");

  if (path === "" || path === "/") {
    url.pathname = `/api/${apiPath}`;
  } else if (path === "/api") {
    url.pathname = `/api/${apiPath}`;
  } else if (path === "/api/chat" || path === "/api/tags") {
    url.pathname = `/api/${apiPath}`;
  } else {
    throw new Error("Ollama endpoint must be the local server root, /api, /api/chat, or /api/tags.");
  }

  url.search = "";
  url.hash = "";

  return url.toString();
}

function readOllamaError(payload: OllamaChatResponse | null): string | undefined {
  const error = payload?.error;

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error.message === "string") {
    return error.message;
  }

  return undefined;
}

async function findActiveWhatsAppTab(): Promise<{ id?: number; url?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url?.startsWith("https://web.whatsapp.com/")) {
    return {};
  }

  return tab;
}

async function collectFromTab(
  tabId: number,
  cutoffIso: string,
  lookbackUnit: LookbackUnit
): Promise<CollectMessagesResponse> {
  const request = {
    type: "COLLECT_MESSAGES",
    cutoffIso,
    maxScrolls: lookbackUnit === "hours" ? 18 : 40
  };

  try {
    return await chrome.tabs.sendMessage(tabId, request) as CollectMessagesResponse;
  } catch (error) {
    if (!isMissingContentScriptError(error)) {
      throw error;
    }
  }

  setStatus("Connecting to WhatsApp Web...");
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["dist/contentScript.js"]
  });

  return await chrome.tabs.sendMessage(tabId, request) as CollectMessagesResponse;
}

function isMissingContentScriptError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Receiving end does not exist");
}

function clearOutput(): void {
  statusElement.classList.remove("error");
  statusElement.textContent = "";
  hideCommandHelp();
  resultElement.textContent = "";
}

function setStatus(message: string, isError = false): void {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", isError);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readLookbackUnit(value: unknown): LookbackUnit {
  return value === "days" ? "days" : "hours";
}

function readSummaryLanguage(value: unknown): SummaryLanguage {
  if (value === "tr" || value === "en") {
    return value;
  }

  return "auto";
}

function requiredElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Popup UI is missing ${selector}.`);
  }

  return element;
}

type OllamaChatResponse = {
  message?: {
    content?: string;
  };
  error?: string | {
    message?: string;
  };
};

type OllamaTagsResponse = {
  models?: Array<{
    name?: string;
  }>;
  error?: string | {
    message?: string;
  };
};
