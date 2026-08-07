import OpenAI from "openai";

/** SpaceXAI / xAI OpenAI-compatible client. */
export function getAiClient() {
  const apiKey = process.env.XAI_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL: process.env.AI_BASE_URL || "https://api.x.ai/v1",
  });
}

export function aiModel() {
  return process.env.AI_MODEL || "grok-4.5";
}

export function aiEnabled() {
  return !!(process.env.XAI_API_KEY || process.env.AI_API_KEY);
}
