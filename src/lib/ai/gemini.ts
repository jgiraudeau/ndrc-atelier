import { GoogleGenAI, type Content, type GenerateContentConfig } from "@google/genai";
import { getGenAI, getGeminiDeveloperApiClient } from "@/src/lib/rag";

type GeminiTextOptions = {
  model?: string;
  fileSearchStoreNames?: string[];
  metadataFilter?: string;
  fileSearchTopK?: number;
  temperature?: number;
  maxOutputTokens?: number;
};

function getClient(options?: GeminiTextOptions): GoogleGenAI {
  // File Search est porté par l'API Gemini Developer.
  if (options?.fileSearchStoreNames?.length) {
    try {
      return getGeminiDeveloperApiClient();
    } catch {
      // Fallback défensif: on tente malgré tout avec la config globale.
      return getGenAI();
    }
  }

  return getGenAI();
}

export async function generateText(
  systemInstruction: string,
  userMessage: string,
  options?: GeminiTextOptions
): Promise<string> {
  const model = options?.model || "gemini-2.5-flash";
  const config: GenerateContentConfig = {
    systemInstruction,
    temperature: options?.temperature ?? 0.7,
    maxOutputTokens: options?.maxOutputTokens ?? 8192,
  };

  if (options?.fileSearchStoreNames?.length) {
    const fileSearchConfig: {
      fileSearchStoreNames: string[];
      metadataFilter?: string;
      topK?: number;
    } = {
      fileSearchStoreNames: options.fileSearchStoreNames,
    };

    if (options.metadataFilter) {
      fileSearchConfig.metadataFilter = options.metadataFilter;
    }
    if (typeof options.fileSearchTopK === "number") {
      fileSearchConfig.topK = options.fileSearchTopK;
    }

    config.tools = [
      {
        fileSearch: fileSearchConfig,
      },
    ];
  }

  const response = await getClient(options).models.generateContent({
    model,
    contents: userMessage,
    config,
  });

  return response.text ?? "";
}

export async function* generateTextStream(
  systemInstruction: string,
  messages: Content[],
  options?: GeminiTextOptions
): AsyncIterable<string> {
  const model = options?.model || "gemini-2.5-flash";
  const config: GenerateContentConfig = {
    systemInstruction,
    temperature: options?.temperature ?? 0.7,
    maxOutputTokens: options?.maxOutputTokens ?? 4096,
  };

  if (options?.fileSearchStoreNames?.length) {
    const fileSearchConfig: {
      fileSearchStoreNames: string[];
      metadataFilter?: string;
      topK?: number;
    } = {
      fileSearchStoreNames: options.fileSearchStoreNames,
    };

    if (options.metadataFilter) {
      fileSearchConfig.metadataFilter = options.metadataFilter;
    }
    if (typeof options.fileSearchTopK === "number") {
      fileSearchConfig.topK = options.fileSearchTopK;
    }

    config.tools = [
      {
        fileSearch: fileSearchConfig,
      },
    ];
  }

  const stream = await getClient(options).models.generateContentStream({
    model,
    contents: messages,
    config,
  });

  for await (const chunk of stream) {
    if (chunk.text) {
      yield chunk.text;
    }
  }
}
