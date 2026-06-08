import type {
  CollectMessagesResponse,
  LookbackUnit,
  SummaryLanguage,
  SummarizeMessagesResponse
} from "./types";

const apiKeyInput = requiredElement<HTMLInputElement>("#apiKey");
const modelNameInput = requiredElement<HTMLInputElement>("#modelName");
const lookbackValueInput = requiredElement<HTMLInputElement>("#lookbackValue");
const lookbackUnitInput = requiredElement<HTMLSelectElement>("#lookbackUnit");
const summaryLanguageInput = requiredElement<HTMLSelectElement>("#summaryLanguage");
const summarizeButton = requiredElement<HTMLButtonElement>("#summarizeButton");
const statusElement = requiredElement<HTMLElement>("#status");
const resultElement = requiredElement<HTMLElement>("#result");

void restoreSettings();

summarizeButton.addEventListener("click", () => {
  void summarizeCurrentChat();
});

async function restoreSettings(): Promise<void> {
  const settings = await chrome.storage.local.get({
    apiKey: "",
    modelName: "openai/gpt-4o-mini",
    lookbackValue: 8,
    lookbackUnit: "hours",
    summaryLanguage: "auto"
  });

  apiKeyInput.value = readString(settings.apiKey);
  modelNameInput.value = readString(settings.modelName) || "openai/gpt-4o-mini";
  lookbackValueInput.value = String(readNumber(settings.lookbackValue, 8));
  lookbackUnitInput.value = readLookbackUnit(settings.lookbackUnit);
  summaryLanguageInput.value = readSummaryLanguage(settings.summaryLanguage);
}

async function summarizeCurrentChat(): Promise<void> {
  clearOutput();

  const apiKey = apiKeyInput.value.trim();
  const modelName = modelNameInput.value.trim();
  const lookbackValue = Number(lookbackValueInput.value);
  const lookbackUnit = lookbackUnitInput.value as LookbackUnit;
  const summaryLanguage = readSummaryLanguage(summaryLanguageInput.value);

  if (!apiKey) {
    setStatus("Enter an OpenRouter API key.", true);
    return;
  }

  if (!modelName) {
    setStatus("Enter an OpenRouter model name.", true);
    return;
  }

  if (!Number.isInteger(lookbackValue) || lookbackValue < 1) {
    setStatus("Enter a whole lookback value greater than zero.", true);
    return;
  }

  await chrome.storage.local.set({ apiKey, modelName, lookbackValue, lookbackUnit, summaryLanguage });

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
    setStatus(`Summarizing ${collected.messages.length} message${collected.messages.length === 1 ? "" : "s"}...${warning}`);

    const summarized = await chrome.runtime.sendMessage({
      type: "SUMMARIZE_MESSAGES",
      apiKey,
      modelName,
      summaryLanguage,
      lookbackLabel: `${lookbackValue} ${lookbackUnit}`,
      messages: collected.messages
    }) as SummarizeMessagesResponse;

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
