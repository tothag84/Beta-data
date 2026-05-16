/**
 * OpenAI image provider (gpt-image-1).
 *
 * Returns raw PNG bytes so we can hand them straight to Supabase Storage and
 * own the hosted URL ourselves (provider-hosted URLs expire).
 */

import { env } from "../../lib/env.js";

interface OpenAiImageResponse {
    data: Array<{ b64_json?: string; url?: string }>;
}

export async function generateImageBytes(prompt: string): Promise<Buffer> {
    if (!env.openaiApiKey) {
        throw new Error("OPENAI_API_KEY not set");
    }

    const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${env.openaiApiKey}`,
            "Content-Type":  "application/json",
        },
        body: JSON.stringify({
            model:   env.imageModel,
            prompt,
            n:       1,
            size:    "1024x1024",
            quality: "medium",
        }),
    });

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`OpenAI image API ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as OpenAiImageResponse;
    const b64 = data.data[0]?.b64_json;
    if (!b64) throw new Error("OpenAI image API returned no b64_json payload");
    return Buffer.from(b64, "base64");
}
