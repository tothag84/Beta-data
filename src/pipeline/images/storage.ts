/**
 * Uploads PNG bytes to the Supabase Storage bucket and returns a permanent
 * public URL. Idempotent on the same key (upsert).
 */

import { createServiceClient } from "../../lib/supabase.js";
import { env } from "../../lib/env.js";

export async function uploadTrendImage(trendId: string, bytes: Buffer): Promise<string> {
    const supabase = createServiceClient();
    const path = `${trendId}.png`;

    const { error: uploadError } = await supabase.storage
        .from(env.imageBucket)
        .upload(path, bytes, {
            contentType: "image/png",
            cacheControl: "31536000, immutable",
            upsert: true,
        });

    if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const { data } = supabase.storage.from(env.imageBucket).getPublicUrl(path);
    if (!data?.publicUrl) throw new Error("Storage returned no public URL");
    return data.publicUrl;
}
