export const aiProviders = [
  {
    id: "openai",
    label: "ChatGPT / OpenAI",
    models: [
      "gpt-5-nano",
      "gpt-5-mini",
      "gpt-5.1",
      "gpt-5",
      "gpt-4-turbo",
      "gpt-4o-mini",
      "gpt-4o",
      "gpt-4.1-nano",
      "gpt-4.1-mini",
      "gpt-4.1",
      "gpt-4",
      "gpt-3.5-turbo",
      "o4-mini",
      "o3-mini",
    ],
  },
  {
    id: "gemini",
    label: "Gemini",
    models: [
      "gemini-1.5-pro",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-1.0-pro",
      "gemini-1.0-pro-vision",
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    models: [
      "deepseek-chat",
      "deepseek-reasoner",
      "deepseek-r1",
      "deepseek-v2.5",
      "deepseek-coder",
      "deepseek-coder-v2",
    ],
  },
  {
    id: "other",
    label: "Other",
    models: [] as string[],
  },
] as const;

export type AIProviderId = (typeof aiProviders)[number]["id"];

