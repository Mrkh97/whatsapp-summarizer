export type LookbackUnit = "hours" | "days";
export type SummaryLanguage = "auto" | "tr" | "en";

export type ChatMessage = {
  sender: string;
  timestamp: string;
  text: string;
};

export type CollectMessagesRequest = {
  type: "COLLECT_MESSAGES";
  cutoffIso: string;
  maxScrolls: number;
};

export type CollectMessagesResponse = {
  ok: boolean;
  messages: ChatMessage[];
  unparsedCount: number;
  reachedCutoff: boolean;
  warning?: string;
  error?: string;
};

export type SummarizeMessagesRequest = {
  type: "SUMMARIZE_MESSAGES";
  apiKey: string;
  modelName: string;
  summaryLanguage: SummaryLanguage;
  lookbackLabel: string;
  messages: ChatMessage[];
};

export type SummarizeMessagesResponse = {
  ok: boolean;
  summary?: string;
  error?: string;
};
