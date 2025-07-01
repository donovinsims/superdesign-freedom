import * as vscode from 'vscode';

export interface ExecutionContext {
  workingDirectory: string;
  sessionId: string;
  outputChannel: vscode.OutputChannel;
  abortController?: AbortController;
}

export interface AgentService {
    query(
        prompt: string,
        options?: any,
        abortController?: AbortController,
        onMessage?: (message: any) => void
    ): Promise<any[]>;
} 