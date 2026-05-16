import "dotenv/config";

function required(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Missing required env var: ${name}`);
    return v;
}

function optionalInt(name: string, fallback: number): number {
    const v = process.env[name];
    if (!v) return fallback;
    const n = Number.parseInt(v, 10);
    if (Number.isNaN(n)) throw new Error(`Env var ${name} must be an integer, got "${v}"`);
    return n;
}

function optionalFloat(name: string, fallback: number): number {
    const v = process.env[name];
    if (!v) return fallback;
    const n = Number.parseFloat(v);
    if (Number.isNaN(n)) throw new Error(`Env var ${name} must be a number, got "${v}"`);
    return n;
}

export const env = {
    supabaseUrl:            required("SUPABASE_URL"),
    supabaseAnonKey:        required("SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    anthropicApiKey:        required("ANTHROPIC_API_KEY"),
    anthropicModel:         process.env.ANTHROPIC_MODEL ?? "claude-opus-4-7",
    trendsPerRun:           optionalInt("TRENDS_PER_RUN", 5),
    feedbackWindowDays:     optionalInt("FEEDBACK_WINDOW_DAYS", 7),
    feedbackMinSwipes:      optionalInt("FEEDBACK_MIN_SWIPES", 10),
    feedbackPositiveThreshold: optionalFloat("FEEDBACK_POSITIVE_THRESHOLD", 0.8),
};
