chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const request = message as Partial<CollectMessagesRequest>;

  if (request.type !== "COLLECT_MESSAGES") {
    return false;
  }

  collectMessages(request as CollectMessagesRequest)
    .then(sendResponse)
    .catch((error: unknown) => {
      sendResponse({
        ok: false,
        messages: [],
        unparsedCount: 0,
        reachedCutoff: false,
        error: error instanceof Error ? error.message : "Could not collect WhatsApp messages."
      } satisfies CollectMessagesResponse);
    });

  return true;
});

async function collectMessages(request: CollectMessagesRequest): Promise<CollectMessagesResponse> {
  const cutoff = new Date(request.cutoffIso);
  const scroller = findChatScroller();

  if (!scroller) {
    return {
      ok: false,
      messages: [],
      unparsedCount: 0,
      reachedCutoff: false,
      error: "Open a WhatsApp Web chat before summarizing."
    };
  }

  await scrollToLatestMessages(scroller);

  let previousSignature = "";
  let stableRounds = 0;
  let reachedCutoff = false;

  for (let attempt = 0; attempt <= request.maxScrolls; attempt += 1) {
    const snapshot = readVisibleMessages(cutoff);
    reachedCutoff = snapshot.oldestParsed !== undefined && snapshot.oldestParsed <= cutoff.getTime();

    if (reachedCutoff || attempt === request.maxScrolls) {
      break;
    }

    const signature = `${snapshot.totalElements}:${scroller.scrollTop}:${scroller.scrollHeight}`;

    if (signature === previousSignature) {
      stableRounds += 1;
    } else {
      stableRounds = 0;
      previousSignature = signature;
    }

    if (stableRounds >= 2 || scroller.scrollTop <= 0) {
      break;
    }

    scroller.scrollTop = Math.max(0, scroller.scrollTop - Math.round(scroller.clientHeight * 0.9));
    await wait(700);
  }

  const finalSnapshot = readVisibleMessages(cutoff);
  const messages = dedupeMessages(finalSnapshot.messages).sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  return {
    ok: true,
    messages,
    unparsedCount: finalSnapshot.unparsedCount,
    reachedCutoff,
    warning: finalSnapshot.unparsedCount > 0
      ? `${finalSnapshot.unparsedCount} loaded message timestamp${finalSnapshot.unparsedCount === 1 ? "" : "s"} could not be parsed.`
      : undefined
  };
}

function readVisibleMessages(cutoff: Date): {
  messages: ChatMessage[];
  unparsedCount: number;
  oldestParsed?: number;
  totalElements: number;
} {
  const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-pre-plain-text]"));
  const messages: ChatMessage[] = [];
  let unparsedCount = 0;
  let oldestParsed: number | undefined;

  for (const element of elements) {
    const parsed = readMessageElement(element);

    if (!parsed) {
      unparsedCount += 1;
      continue;
    }

    const timestamp = parsed.timestamp.getTime();
    oldestParsed = oldestParsed === undefined ? timestamp : Math.min(oldestParsed, timestamp);

    if (parsed.timestamp >= cutoff) {
      messages.push({
        sender: parsed.sender,
        timestamp: parsed.timestamp.toISOString(),
        text: parsed.text
      });
    }
  }

  return { messages, unparsedCount, oldestParsed, totalElements: elements.length };
}

function readMessageElement(element: HTMLElement): {
  sender: string;
  timestamp: Date;
  text: string;
} | undefined {
  const metadata = element.getAttribute("data-pre-plain-text") ?? "";
  const parsedMetadata = parseMetadata(metadata);
  const text = readMessageText(element);

  if (!parsedMetadata || !text) {
    return undefined;
  }

  return {
    sender: parsedMetadata.sender,
    timestamp: parsedMetadata.timestamp,
    text
  };
}

function parseMetadata(metadata: string): { sender: string; timestamp: Date } | undefined {
  const match = metadata.match(/^\[([^\]]+)]\s*(.*?):\s*$/);

  if (!match) {
    return undefined;
  }

  const timestamp = parseWhatsAppTimestamp(match[1]);
  const sender = match[2]?.trim() || "Unknown";

  if (!timestamp) {
    return undefined;
  }

  return { sender, timestamp };
}

function parseWhatsAppTimestamp(value: string): Date | undefined {
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);

  if (parts.length < 2) {
    return undefined;
  }

  const timePart = parts.find((part) => /\d{1,2}:\d{2}/.test(part));
  const datePart = parts.find((part) => part !== timePart);

  if (!timePart || !datePart) {
    return undefined;
  }

  const time = parseTime(timePart);
  const date = parseDate(datePart);

  if (!time || !date) {
    return undefined;
  }

  return new Date(date.year, date.monthIndex, date.day, time.hours, time.minutes);
}

function parseTime(value: string): { hours: number; minutes: number } | undefined {
  const match = value.match(/(\d{1,2}):(\d{2})\s*([AP]M)?/i);

  if (!match) {
    return undefined;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return undefined;
  }

  if (meridiem === "PM" && hours < 12) {
    hours += 12;
  }

  if (meridiem === "AM" && hours === 12) {
    hours = 0;
  }

  return { hours, minutes };
}

function parseDate(value: string): { year: number; monthIndex: number; day: number } | undefined {
  const today = new Date();
  const normalized = value.trim().toLowerCase();

  if (normalized === "today") {
    return { year: today.getFullYear(), monthIndex: today.getMonth(), day: today.getDate() };
  }

  if (normalized === "yesterday") {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return { year: yesterday.getFullYear(), monthIndex: yesterday.getMonth(), day: yesterday.getDate() };
  }

  const slashMatch = value.match(/^(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})$/);

  if (!slashMatch) {
    return undefined;
  }

  const first = Number(slashMatch[1]);
  const second = Number(slashMatch[2]);
  const third = Number(slashMatch[3]);

  if ([first, second, third].some(Number.isNaN)) {
    return undefined;
  }

  if (slashMatch[1].length === 4) {
    return { year: first, monthIndex: second - 1, day: third };
  }

  const year = third < 100 ? 2000 + third : third;
  const useMonthFirst = first <= 12 && (second > 12 || navigator.language.toLowerCase() === "en-us");
  const month = useMonthFirst ? first : second;
  const day = useMonthFirst ? second : first;

  return { year, monthIndex: month - 1, day };
}

function readMessageText(element: HTMLElement): string {
  const selectableText = Array.from(element.querySelectorAll<HTMLElement>("span.selectable-text"))
    .map((node) => node.innerText.trim())
    .filter(Boolean)
    .join("\n");

  if (selectableText) {
    return selectableText;
  }

  return element.innerText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function dedupeMessages(messages: ChatMessage[]): ChatMessage[] {
  const seen = new Set<string>();
  const unique: ChatMessage[] = [];

  for (const message of messages) {
    const key = `${message.timestamp}\u0000${message.sender}\u0000${message.text}`;

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(message);
    }
  }

  return unique;
}

function findChatScroller(): HTMLElement | undefined {
  const messages = Array.from(document.querySelectorAll<HTMLElement>("[data-pre-plain-text]"));

  for (const message of messages) {
    let current: HTMLElement | null = message.parentElement;

    while (current && current.id !== "main") {
      if (current.scrollHeight > current.clientHeight + 100) {
        return current;
      }

      current = current.parentElement;
    }
  }

  const main = document.querySelector<HTMLElement>("#main");

  if (!main) {
    return undefined;
  }

  const candidates = Array.from(main.querySelectorAll<HTMLElement>("*"))
    .filter((element) => element.scrollHeight > element.clientHeight + 100)
    .sort((a, b) => b.scrollHeight - a.scrollHeight);

  return candidates[0];
}

async function scrollToLatestMessages(scroller: HTMLElement): Promise<void> {
  let stableRounds = 0;
  let previousSignature = "";

  for (let attempt = 0; attempt < 30; attempt += 1) {
    scroller.scrollTop = scroller.scrollHeight;
    await wait(400);

    const signature = `${Math.round(scroller.scrollTop)}:${scroller.scrollHeight}`;

    if (signature === previousSignature) {
      stableRounds += 1;
    } else {
      stableRounds = 0;
      previousSignature = signature;
    }

    if (stableRounds >= 2) {
      break;
    }
  }

  scroller.scrollTop = scroller.scrollHeight;
  await wait(1000);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

type ChatMessage = {
  sender: string;
  timestamp: string;
  text: string;
};

type CollectMessagesRequest = {
  type: "COLLECT_MESSAGES";
  cutoffIso: string;
  maxScrolls: number;
};

type CollectMessagesResponse = {
  ok: boolean;
  messages: ChatMessage[];
  unparsedCount: number;
  reachedCutoff: boolean;
  warning?: string;
  error?: string;
};
