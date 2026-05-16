/**
 * Beta Data brand visual identity.
 *
 * Every AI-generated trend image is composed by prepending this preamble to
 * the subject-only prompt produced by the Filter Agent. Editing this single
 * constant restyles the entire app's card deck on the next pipeline run.
 *
 * The Filter Agent is instructed (in fetchTrends.ts) to describe SUBJECT
 * MATTER ONLY in its `image_prompt` field — never style — so the brand look
 * stays uniform regardless of model variance.
 */

export const STYLE_NAME = "Minimal Tech Brutalist";

export const STYLE_PREAMBLE = [
    "Minimal Tech Brutalist style:",
    "stark geometric composition,",
    "concrete and brushed-metal textures,",
    "monochrome greyscale palette with a single saturated accent color,",
    "exposed structural elements and raw materials,",
    "oversized monospace typography fragments as background texture,",
    "harsh directional studio lighting with deep shadows,",
    "photographic realism, industrial product-shot framing,",
    "no humans, no faces, no readable logos, no readable words,",
    "square 1:1 aspect ratio, ultra-sharp focus.",
].join(" ");

export function composeImagePrompt(subject: string): string {
    return `${STYLE_PREAMBLE} Subject: ${subject.trim()}`;
}
