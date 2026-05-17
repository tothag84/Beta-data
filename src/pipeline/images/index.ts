/**
 * Step C.5 — generate an image for a curated trend and host it ourselves.
 *
 *   1. Compose the final prompt by prepending the brand STYLE_PREAMBLE to
 *      the subject-only prompt produced by the Filter Agent.
 *   2. Call the configured image provider for raw PNG bytes.
 *   3. Upload to Supabase Storage under the trend's pre-generated UUID.
 *   4. Return the permanent public URL for trends.image_url.
 *
 * If GEMINI_API_KEY is not set the function returns null and the pipeline
 * carries on — trends are still inserted, just without an image.
 */

import { env } from "../../lib/env.js";
import { composeImagePrompt } from "./style.js";
import { generateImageBytes } from "./google.js";
import { uploadTrendImage } from "./storage.js";

export async function generateAndStoreImage(
    trendId: string,
    subjectPrompt: string,
): Promise<string | null> {
    if (!env.googleApiKey) {
        console.warn(`[image] GEMINI_API_KEY missing — skipping image for ${trendId}`);
        return null;
    }

    const fullPrompt = composeImagePrompt(subjectPrompt);
    const bytes = await generateImageBytes(fullPrompt);
    const url   = await uploadTrendImage(trendId, bytes);
    return url;
}

export { STYLE_NAME, STYLE_PREAMBLE, composeImagePrompt } from "./style.js";
