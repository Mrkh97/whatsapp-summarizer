import type { SummarizeMessagesRequest, SummarizeMessagesResponse } from "./types";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const request = message as Partial<SummarizeMessagesRequest>;

  if (request.type !== "SUMMARIZE_MESSAGES") {
    return false;
  }

  summarize(request as SummarizeMessagesRequest)
    .then(sendResponse)
    .catch((error: unknown) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "OpenRouter request failed."
      } satisfies SummarizeMessagesResponse);
    });

  return true;
});

async function summarize(request: SummarizeMessagesRequest): Promise<SummarizeMessagesResponse> {
  if (!request.apiKey.trim()) {
    return { ok: false, error: "Enter an OpenRouter API key." };
  }

  if (!request.modelName.trim()) {
    return { ok: false, error: "Enter an OpenRouter model name." };
  }

  if (request.messages.length === 0) {
    return { ok: false, error: "No messages were collected for this time window." };
  }

  const transcript = request.messages
    .map((message) => `[${message.timestamp}] ${message.sender}: ${message.text}`)
    .join("\n");
  const languageInstruction = readLanguageInstruction(request.summaryLanguage);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${request.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: request.modelName,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: [
            "You summarize WhatsApp conversations for the user.",
            "Return exactly these sections: Short summary, Key decisions, Action items, Mentioned names/dates.",
            languageInstruction,
            "Keep it concise. If a section has nothing useful, write None."
          ].join(" ")
        },
        {
          role: "user",
          content: `Summarize this WhatsApp chat from the last ${request.lookbackLabel}.\n\n${transcript}`
        }
      ]
    })
  });

  const payload = await response.json().catch(() => null) as OpenRouterResponse | null;

  if (!response.ok) {
    return {
      ok: false,
      error: readOpenRouterError(payload) ?? `OpenRouter returned HTTP ${response.status}.`
    };
  }

  const summary = payload?.choices?.[0]?.message?.content?.trim();

  if (!summary) {
    return { ok: false, error: "OpenRouter returned an empty summary." };
  }

  return { ok: true, summary };
}

function readLanguageInstruction(summaryLanguage: SummarizeMessagesRequest["summaryLanguage"]): string {
  if (summaryLanguage === "tr") {
    return "Write the summary in Turkish.";
  }

  if (summaryLanguage === "en") {
    return "Write the summary in English.";
  }

  return "Detect the main language used in the chat transcript and write the summary in that language. If the main language is unclear, write the summary in English.";
}

function readOpenRouterError(payload: OpenRouterResponse | null): string | undefined {
  if (typeof payload?.error?.message === "string") {
    return payload.error.message;
  }

  if (typeof payload?.message === "string") {
    return payload.message;
  }

  return undefined;
}

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
  message?: string;
};
