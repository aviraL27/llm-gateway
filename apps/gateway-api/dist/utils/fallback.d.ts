export interface FallbackConfig {
    thresholds?: Array<{
        spend_usd: number;
        action: string;
        from: string;
        to: string;
    }>;
    provider_fallback?: {
        openai_error: string;
        model_map: Record<string, string>;
    };
}
export declare function evaluateModelThresholds(fallbackConfig: FallbackConfig | null, requestedModel: string, currentSpend: number): {
    model: string;
    wasDowngraded: boolean;
};
export declare function selectModel(teamId: string, requestedModel: string, currentSpend: number): Promise<{
    provider: string;
    model: string;
    wasDowngraded: boolean;
}>;
//# sourceMappingURL=fallback.d.ts.map