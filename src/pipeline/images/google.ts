/**
 * Google Imagen image provider (Imagen 4, via the Gemini API).
 *
 * Returns raw PNG bytes so we can hand them straight to Supabase Storage and
 * own the hosted URL ourselves.
 *
 * Endpoint:  POST https://generativelanguage.googleapis.com/v1beta/models/<model>:predict
 * Auth:      x-goog-api-key: $GEMINI_API_KEY
 * Defaults:  1:1 aspect ratio, no person generation (we ban humans/faces in
 *            the style preamble anyway).
 *
 * Docs: https://ai.google.dev/gemini-api/docs/image-generation
 */

import { env } from "../../lib/env.js";

interface ImagenPrediction {
    bytesBase64Encoded?: string;
    mimeType?: string;
}
interface ImagenResponse {
    predictions?: ImagenPrediction[];
}

export async function generateImageBytes(prompt: string): Promise<Buffer> {
    if (!env.googleApiKey) {
        throw new Error("GEMINI_API_KEY not set");
    }

    const url =
        `https://generativelanguage.googleapis.com/v1beta/models/` +
        `${encodeURIComponent(env.imageModel)}:predict`;

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "x-goog-api-key": env.googleApiKey,
            "Content-Type":   "application/json",
        },
        body: JSON.stringify({
            instances: [{ prompt }],
            parameters: {
                sampleCount:      1,
                aspectRatio:      "1:1",
                personGeneration: "dont_allow",
            },
        }),
    });

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Imagen API ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as ImagenResponse;
    const b64  = data.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) throw new Error("Imagen API returned no bytesBase64Encoded payload");
    return Buffer.from(b64, "base64");
}
