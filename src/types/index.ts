export interface TrendRow {
    id: string;
    title: string;
    description: string;
    image_url: string | null;
    source_url: string | null;
    velocity_score: number;
    category: string;
    created_at: string;
}

export interface SwipeRow {
    id: string;
    user_id: string;
    trend_id: string;
    direction: "up" | "down";
    created_at: string;
}

export interface RawSignal {
    source: string;          // e.g. "github", "reddit:r/MechanicalKeyboards"
    title: string;
    snippet: string;
    url?: string;
    raw_score: number;       // source-native popularity / growth metric
    captured_at: string;     // ISO timestamp
}

export interface CuratedTrend {
    title: string;
    description: string;
    category: string;
    image_prompt: string;
    velocity_score: number;
    source_url?: string;
}
