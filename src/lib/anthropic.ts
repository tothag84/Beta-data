import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env.js";

export function createAnthropicClient(): Anthropic {
    return new Anthropic({ apiKey: env.anthropicApiKey });
}

export const ANTHROPIC_MODEL = env.anthropicModel;
