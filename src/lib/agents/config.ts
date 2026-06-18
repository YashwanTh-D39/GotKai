export const AGENTS = {
  reasoning: {
    id: "reasoning",
    label: "Reasoning",
    emoji: "🧠",
    description: "Analytical thinking, problem-solving, math, logic, and general-purpose assistance",
    modelTier: "balanced",
    temperature: 0.3,
    top_p: 0.9,
    max_tokens: 4096,
  },
  code: {
    id: "code",
    label: "Code",
    emoji: "💻",
    description: "Write, debug, review, and explain code in any programming language",
    modelTier: "powerful",
    temperature: 0.2,
    top_p: 0.95,
    max_tokens: 8192,
  },
  research: {
    id: "research",
    label: "Research",
    emoji: "🔍",
    description: "Deep research with web search, source verification, and structured reports",
    modelTier: "powerful",
    temperature: 0.1,
    top_p: 0.9,
    max_tokens: 4096,
  },
  writing: {
    id: "writing",
    label: "Writing",
    emoji: "✍️",
    description: "Creative writing, editing, content creation, storytelling, and communication",
    modelTier: "balanced",
    temperature: 0.7,
    top_p: 0.95,
    max_tokens: 4096,
  },
} as const;

export type AgentType = keyof typeof AGENTS;

export const AGENT_LIST = Object.values(AGENTS);

export const MODEL_TIERS = {
  fast: {
    label: "Fast (cheap tasks)",
    max_tokens: 1024,
    temperature: 0.5,
  },
  balanced: {
    label: "Balanced",
    max_tokens: 4096,
    temperature: 0.3,
  },
  powerful: {
    label: "Powerful (complex tasks)",
    max_tokens: 8192,
    temperature: 0.2,
  },
} as const;

export type ModelTier = keyof typeof MODEL_TIERS;
