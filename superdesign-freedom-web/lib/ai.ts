import { GoogleGenerativeAI } from "@google/generative-ai";

export type AIProvider = 'gemini' | 'ollama';

interface AIConfig {
    provider: AIProvider;
    apiKey?: string; // For Gemini
    model?: string; // e.g., 'gemini-pro' or 'llama3'
    baseUrl?: string; // For Ollama (default: http://localhost:11434)
}

export class AIService {
    private config: AIConfig;
    private genAI?: GoogleGenerativeAI;

    constructor(config: AIConfig) {
        this.config = config;
        if (config.provider === 'gemini' && config.apiKey) {
            this.genAI = new GoogleGenerativeAI(config.apiKey);
        }
    }

    async generateStream(prompt: string, onChunk: (chunk: string) => void): Promise<void> {
        if (this.config.provider === 'gemini') {
            await this.generateGeminiStream(prompt, onChunk);
        } else {
            await this.generateOllamaStream(prompt, onChunk);
        }
    }

    private async generateGeminiStream(prompt: string, onChunk: (chunk: string) => void) {
        if (!this.genAI) throw new Error("Gemini API key not configured");

        const model = this.genAI.getGenerativeModel({ model: this.config.model || "gemini-pro" });
        const result = await model.generateContentStream(prompt);

        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            onChunk(chunkText);
        }
    }

    private async generateOllamaStream(prompt: string, onChunk: (chunk: string) => void) {
        const baseUrl = this.config.baseUrl || "http://localhost:11434";
        const model = this.config.model || "llama3";

        const response = await fetch(`${baseUrl}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model,
                prompt,
                stream: true,
            }),
        });

        if (!response.body) throw new Error("Failed to connect to Ollama");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const json = JSON.parse(line);
                    if (json.response) {
                        onChunk(json.response);
                    }
                    if (json.done) return;
                } catch (e) {
                    console.error("Error parsing Ollama chunk:", e);
                }
            }
        }
    }
}
