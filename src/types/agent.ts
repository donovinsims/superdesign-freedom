export interface AgentService {
    query(
        prompt: string,
        options?: any,
        abortController?: AbortController,
        onMessage?: (message: any) => void
    ): Promise<any[]>;
} 