export const CAPABILITY_NAMES = [
  "text",
  "vision",
  "audio",
  "speech",
  "tools",
  "structured",
] as const;

export type CapabilityName = (typeof CAPABILITY_NAMES)[number];
