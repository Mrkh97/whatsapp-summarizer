declare const chrome: {
  runtime: {
    id: string;
    onMessage: {
      addListener(
        callback: (
          message: unknown,
          sender: unknown,
          sendResponse: (response?: unknown) => void
        ) => boolean | void
      ): void;
    };
    sendMessage(message: unknown): Promise<unknown>;
  };
  storage: {
    local: {
      get(keys: string[] | Record<string, unknown>): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  };
  scripting: {
    executeScript(injection: {
      target: {
        tabId: number;
      };
      files: string[];
    }): Promise<unknown>;
  };
  tabs: {
    query(queryInfo: Record<string, unknown>): Promise<Array<{ id?: number; url?: string }>>;
    sendMessage(tabId: number, message: unknown): Promise<unknown>;
  };
};

interface Navigator {
  userAgentData?: {
    platform?: string;
  };
}
