const logo = (name: string) =>
  `https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/${name}.svg`;

export const LOCUS_MODELS = [
  {
    id: "gpt-6-luna",
    label: "GPT-6 Luna",
    lab: "OpenAI",
    logo: logo("openai"),
    protocol: "responses",
  },
  {
    id: "claude-haiku-5.5",
    label: "Claude Haiku 5.5",
    lab: "Anthropic",
    logo: logo("anthropic"),
    protocol: "chat",
  },
  {
    id: "muse-spark-1.3-contributor",
    label: "Muse Spark 1.3",
    lab: "Meta",
    logo: logo("meta"),
    protocol: "responses",
  },
  {
    id: "mimo-v2.6-flash",
    label: "MiMo V2.6 Flash",
    lab: "Xiaomi",
    logo: "/logos/xiaomi.svg",
    protocol: "chat",
  },
  {
    id: "glm-5.3-flash",
    label: "GLM-5.3 Flash",
    lab: "Z.ai",
    logo: logo("zhipu"),
    protocol: "chat",
  },
  {
    id: "deepseek-v4.1-flash",
    label: "DeepSeek V4.1 Flash",
    lab: "DeepSeek",
    logo: logo("deepseek"),
    protocol: "chat",
  },
  {
    id: "space-bunny-free",
    label: "Space Bunny",
    lab: "OpenCode",
    logo: logo("opencode"),
    protocol: "chat",
  },
  {
    id: "longcat-2.5-preview-free",
    label: "LongCat 2.5 Preview Free",
    lab: "LongCat",
    logo: "/logos/longcat.svg",
    protocol: "chat",
  },
] as const;

export type LocusModelId = (typeof LOCUS_MODELS)[number]["id"];
export const DEFAULT_LOCUS_MODEL: LocusModelId = "gpt-6-luna";

export function isLocusModelId(value: unknown): value is LocusModelId {
  return LOCUS_MODELS.some((model) => model.id === value);
}
