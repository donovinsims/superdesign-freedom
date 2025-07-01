# Custom Agent Service Implementation Plan

## Overview

Replace `ClaudeCodeService` with a custom agent using Vercel AI SDK while maintaining compatibility with existing frontend chat interface and design generation workflow.

## Architecture

```
Frontend (useChat.ts) → ChatMessageService → CustomAgentService (AI SDK) → Tools → File System
                   ↑                                    ↓
                   └── Message Transformation ←────────┘
```

## Phase 1: Setup & Core Service

### 1.1 Install Dependencies
```bash
npm install ai @ai-sdk/openai @ai-sdk/anthropic zod
```

### 1.2 Create Base Service
**File: `src/services/customAgentService.ts`**

```typescript
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import * as vscode from 'vscode';
import { z } from 'zod';

export class CustomAgentService {
    private workingDirectory: string;
    private outputChannel: vscode.OutputChannel;
    
    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        this.workingDirectory = this.setupWorkingDirectory();
    }
    
    async query(
        prompt: string, 
        options?: any, 
        abortController?: AbortController,
        onMessage?: (message: any) => void
    ): Promise<any[]> {
        // Implementation here
    }
}
```

## Phase 2: Message Format Transformation

### 2.1 AI SDK vs Claude Code Structure

**AI SDK Format:**
```typescript
interface Message {
    role: 'user' | 'assistant';
    content: string;
    toolInvocations?: ToolInvocation[];  // ← Tools embedded in message
}

type ToolInvocation = {
    state: 'partial-call' | 'call' | 'result';
    toolCallId: string;
    toolName: string;
    args: any;
    result?: any;
}
```

**Claude Code Format:**
```typescript
// Separate messages for each tool interaction
{ type: 'assistant', message: { content: [{ type: 'tool_use', id, name, input }] } }
{ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id, content }] } }
{ type: 'result', subtype: 'success', result: string }
```

### 2.2 AI SDK FullStream Chunk Types

AI SDK's `fullStream` provides these chunk types:

```typescript
// Text streaming
{ type: 'text-delta', textDelta: string }

// Tool interactions  
{ type: 'tool-call', toolCallId: string, toolName: string, args: any }
{ type: 'tool-result', toolCallId: string, toolName: string, args: any, result: any }

// Stream control
{ type: 'finish', finishReason: 'stop' | 'length' | 'tool-calls', usage: Usage }
{ type: 'error', error: Error }

// Step boundaries (for maxSteps)
{ type: 'step-finish', stepType: string, finishReason: string }
```

### 2.3 Transformation Strategy

AI SDK embeds tools within messages, while Claude Code uses separate messages. We need to:

1. **Extract tool calls** from AI SDK fullStream chunks
2. **Create separate Claude Code messages** for each tool interaction
3. **Handle streaming properly** with real-time chunk processing
4. **Preserve parent-child relationships** using `parent_tool_use_id`
5. **Map AI SDK states** to Claude Code message types

```typescript
async query(prompt: string, options?: any, abortController?: AbortController, onMessage?: (message: any) => void): Promise<any[]> {
    const result = streamText({
        model: this.getModel(),
        system: DESIGN_SYSTEM_PROMPT,
        prompt: prompt,
        tools: this.getTools(),
        maxSteps: 10
    });

    const messages: any[] = [];
    let sessionId = `session_${Date.now()}`;
    let stepCounter = 0;

    for await (const chunk of result.fullStream) {
        stepCounter++;
        
        switch (chunk.type) {
            case 'text-delta':
                // Handle streaming text (assistant message chunks)
                const textMessage = {
                    type: 'assistant',
                    message: chunk.textDelta,
                    session_id: sessionId,
                    parent_tool_use_id: null
                };
                onMessage?.(textMessage);
                messages.push(textMessage);
                break;

            case 'tool-call':
                // Convert to Claude Code tool_use format
                const toolCallMessage = {
                    type: 'assistant',
                    message: {
                        content: [{
                            type: 'tool_use',
                            id: chunk.toolCallId,
                            name: chunk.toolName,
                            input: chunk.args
                        }]
                    },
                    session_id: sessionId,
                    parent_tool_use_id: null
                };
                onMessage?.(toolCallMessage);
                messages.push(toolCallMessage);
                break;

            case 'tool-result':
                // Convert to Claude Code tool_result format
                const toolResultMessage = {
                    type: 'user',
                    message: {
                        content: [{
                            type: 'tool_result',
                            tool_use_id: chunk.toolCallId,
                            content: typeof chunk.result === 'string' ? chunk.result : JSON.stringify(chunk.result),
                            is_error: chunk.isError || false
                        }]
                    },
                    session_id: sessionId,
                    parent_tool_use_id: chunk.toolCallId
                };
                onMessage?.(toolResultMessage);
                messages.push(toolResultMessage);
                break;

            case 'finish':
                // Final result message
                const resultMessage = {
                    type: 'result',
                    subtype: 'success',
                    result: chunk.finishReason === 'stop' ? 'Task completed successfully' : 'Task completed',
                    session_id: sessionId,
                    total_cost_usd: chunk.usage?.totalTokens * 0.00001 || 0, // Estimate
                    usage: chunk.usage || {}
                };
                onMessage?.(resultMessage);
                messages.push(resultMessage);
                break;

            case 'error':
                // Error handling
                const errorMessage = {
                    type: 'result',
                    subtype: 'error',
                    result: chunk.error?.message || 'Unknown error occurred',
                    session_id: sessionId,
                    is_error: true
                };
                onMessage?.(errorMessage);
                messages.push(errorMessage);
                break;
        }

        // Check for abort signal
        if (abortController?.signal.aborted) {
            throw new Error('Operation cancelled');
        }
    }

    return messages;
}
```

## Phase 4: Design System Integration

### 4.1 System Prompt

Extract Claude Code's design prompt and adapt for AI SDK:

```typescript
const DESIGN_SYSTEM_PROMPT = `
# Role
You are a senior front-end designer creating HTML designs.

# Design Requirements
1. Generate 3 design variations by default using parallel sub-agents
2. Save files in '.superdesign/design_iterations' folder  
3. Use naming convention: {design_name}_{n}.html
4. Include responsive design with Tailwind CSS
5. Focus on elegant minimalism and functional design

# Technical Specs
- No external images (use CSS placeholders)
- Tailwind CSS via CDN
- 4pt/8pt spacing system (all margins/padding multiples of 8px)
- Black/white/neutral color palette only
- WCAG contrast compliance (4.5:1 minimum)
- Responsive: mobile-first approach

# File Naming Conventions
- New designs: design_1.html, design_2.html, etc.
- Iterations: ui_1_1.html, ui_1_2.html, etc.
- Components: component_name_1.html
- Wireframes: wireframe_name_1.html

# When asked to design UI:
1. Build one single HTML page per variation
2. Create 3 parallel variations concurrently
3. Each variation should explore different approaches
4. Focus on pixel-perfect spacing and typography
5. Use refined rounded corners and subtle shadows

# When asked to iterate designs:
1. Don't edit existing files - create new versions
2. Use incremental naming (ui_1_1.html, ui_1_2.html)
3. Generate 3 variations of the iteration

# When asked to design components:
1. Focus on single component per file
2. Include mock data within component
3. Don't add extra elements outside component scope
`;
```

### 4.2 Enhanced Tool Definitions

```typescript
private getTools() {
    return {
        edit_file: {
            description: 'Create or edit a file in the project',
            parameters: z.object({
                path: z.string().describe('File path relative to working directory'),
                content: z.string().describe('Complete file content')
            }),
            execute: async ({ path, content }) => {
                return await this.executeFileEdit(path, content);
            }
        },
        
        read_file: {
            description: 'Read file contents',
            parameters: z.object({
                path: z.string().describe('File path to read')
            }),
            execute: async ({ path }) => {
                return await this.executeFileRead(path);
            }
        },
        
        create_design_variations: {
            description: 'Create multiple HTML design variations',
            parameters: z.object({
                designName: z.string().describe('Base name for design files'),
                variations: z.number().min(1).max(5).default(3).describe('Number of variations to create'),
                requirements: z.string().describe('Design requirements and specifications'),
                iterationBase: z.string().optional().describe('Base file if this is an iteration')
            }),
            execute: async ({ designName, variations, requirements, iterationBase }) => {
                return await this.executeDesignVariations(designName, variations, requirements, iterationBase);
            }
        },

        list_design_files: {
            description: 'List existing design files in iterations folder',
            parameters: z.object({
                pattern: z.string().optional().describe('Optional pattern to filter files')
            }),
            execute: async ({ pattern }) => {
                return await this.listDesignFiles(pattern);
            }
        }
    };
}
```

### 4.3 Design Generation Logic

```typescript
private async executeDesignVariations(
    designName: string, 
    variations: number, 
    requirements: string,
    iterationBase?: string
): Promise<string> {
    const results: string[] = [];
    
    // Determine naming convention
    let baseFileName = designName;
    if (iterationBase) {
        // This is an iteration - use incremental naming
        baseFileName = `${iterationBase}_`;
    }
    
    // Generate each variation
    for (let i = 1; i <= variations; i++) {
        const fileName = iterationBase 
            ? `${baseFileName}${i}.html`
            : `${designName}_${i}.html`;
            
        const designContent = await this.generateSingleDesign(
            requirements, 
            i, 
            variations,
            fileName
        );
        
        await this.executeFileEdit(
            `design_iterations/${fileName}`, 
            designContent
        );
        
        results.push(fileName);
    }
    
    return `Created ${variations} design variations: ${results.join(', ')}`;
}

private async generateSingleDesign(
    requirements: string,
    variationNumber: number,
    totalVariations: number,
    fileName: string
): Promise<string> {
    // This would use AI SDK to generate individual design
    // Could be a separate streamText call for each variation
    const result = await streamText({
        model: this.getModel(),
        system: `${DESIGN_SYSTEM_PROMPT}

# Current Task
Create variation ${variationNumber} of ${totalVariations} for file: ${fileName}

# Requirements
${requirements}

# Output
Return ONLY the complete HTML content for this design variation.`,
        prompt: `Create an HTML design that meets the requirements. This is variation ${variationNumber}, so make it distinct from other variations while following the same design principles.`,
        maxSteps: 1 // Simple generation, no tools needed
    });

    let htmlContent = '';
    for await (const chunk of result.fullStream) {
        if (chunk.type === 'text-delta') {
            htmlContent += chunk.textDelta;
        }
    }

    return htmlContent;
}

// Alternative: Parallel Generation Approach
private async executeDesignVariationsParallel(
    designName: string, 
    variations: number, 
    requirements: string
): Promise<string> {
    // Generate all variations in parallel (like Claude Code's sub-agents)
    const promises = Array.from({ length: variations }, (_, i) =>
        this.generateSingleDesign(requirements, i + 1, variations, `${designName}_${i + 1}.html`)
    );
    
    const designs = await Promise.all(promises);
    const results: string[] = [];
    
    // Save all designs
    for (let i = 0; i < designs.length; i++) {
        const fileName = `${designName}_${i + 1}.html`;
        await this.executeFileEdit(`design_iterations/${fileName}`, designs[i]);
        results.push(fileName);
    }
    
    return `Created ${variations} design variations in parallel: ${results.join(', ')}`;
}
```

### 4.4 Parallel vs Sequential Generation

**Claude Code Approach:**
- Uses "parallel sub-agents" via Task tool
- Each sub-agent works independently  
- All 3 variations generated simultaneously

**AI SDK Options:**

1. **Sequential (Simpler):**
   ```typescript
   for (let i = 1; i <= variations; i++) {
       const design = await generateSingleDesign(...);
       await saveDesign(design);
   }
   ```

2. **Parallel (Faster):**
   ```typescript
   const promises = Array.from({ length: 3 }, (_, i) => 
       generateSingleDesign(...)
   );
   const designs = await Promise.all(promises);
   ```

**Recommendation:** Start with sequential for simplicity, add parallel later for performance.
```

✅ ## Phase 3: Tool Implementation

### 3.1 Core Tools Needed

Based on Claude Code's system prompt, implement these tools:

1. **File Operations**
   - `edit_file` - Create/modify files
   - `read_file` - Read file contents
   - `list_files` - Directory listing

2. **Design-Specific Tools**
   - `create_design_file` - Generate HTML designs
   - `create_design_variations` - Generate multiple versions
   - `copy_svg_file` - For logo/icon work

### 3.2 Tool Definitions

```typescript
const tools = {
    edit_file: {
        description: 'Create or edit a file',
        parameters: z.object({
            path: z.string().describe('File path relative to working directory'),
            content: z.string().describe('File content')
        }),
        execute: async ({ path, content }) => {
            return await this.executeFileEdit(path, content);
        }
    },
    
    read_file: {
        description: 'Read file contents',
        parameters: z.object({
            path: z.string().describe('File path to read')
        }),
        execute: async ({ path }) => {
            return await this.executeFileRead(path);
        }
    },
    
    create_design_variations: {
        description: 'Create multiple design variations',
        parameters: z.object({
            designName: z.string(),
            variations: z.number().min(1).max(5).default(3),
            requirements: z.string()
        }),
        execute: async ({ designName, variations, requirements }) => {
            return await this.executeDesignVariations(designName, variations, requirements);
        }
    }
};
```

### 3.3 File System Operations

```typescript
private async executeFileEdit(path: string, content: string): Promise<string> {
    try {
        const fullPath = vscode.Uri.joinPath(
            vscode.Uri.file(this.workingDirectory), 
            path
        );
        
        // Ensure directory exists
        const dirPath = vscode.Uri.joinPath(fullPath, '..');
        await vscode.workspace.fs.createDirectory(dirPath);
        
        // Write file
        await vscode.workspace.fs.writeFile(
            fullPath, 
            Buffer.from(content, 'utf8')
        );
        
        return `File ${path} created successfully`;
    } catch (error) {
        throw new Error(`Failed to create file: ${error}`);
    }
}
```


## Phase 5: Integration & Testing

### 5.1 Replace in Extension

```typescript
// In extension.ts
// Replace:
// import { ClaudeCodeService } from './services/claudeCodeService';
// const claudeService = new ClaudeCodeService(outputChannel);

import { CustomAgentService } from './services/customAgentService';
const customAgent = new CustomAgentService(outputChannel);

// Update message service:
const messageHandler = new ChatMessageService(customAgent, outputChannel);
```

### 5.2 Configuration

Add AI provider configuration:

```typescript
// In package.json contributions
"configuration": {
    "properties": {
        "superdesign.aiProvider": {
            "type": "string",
            "enum": ["openai", "anthropic"],
            "default": "openai",
            "description": "AI provider for design generation"
        },
        "superdesign.openaiApiKey": {
            "type": "string",
            "description": "OpenAI API key"
        },
        "superdesign.anthropicApiKey": {
            "type": "string", 
            "description": "Anthropic API key"
        }
    }
}
```

### 5.3 Model Selection

```typescript
private getModel() {
    const config = vscode.workspace.getConfiguration('superdesign');
    const provider = config.get<string>('aiProvider', 'openai');
    
    switch (provider) {
        case 'anthropic':
            return anthropic('claude-3-5-sonnet-20241022');
        case 'openai':
        default:
            return openai('gpt-4o');
    }
}
```

## Phase 6: Advanced Features

### 6.1 Multi-Step Design Process

```typescript
const result = streamText({
    model: this.getModel(),
    system: DESIGN_SYSTEM_PROMPT,
    prompt: prompt,
    tools: tools,
    maxSteps: 10, // Allow multiple tool calls
    onStepFinish: (step) => {
        // Send progress updates
        this.outputChannel.appendLine(`Step completed: ${step.type}`);
    }
});
```

### 6.2 Progress Tracking

```typescript
// Enhanced progress reporting
private reportProgress(step: any, stepNumber: number, totalSteps: number) {
    const progress = {
        type: 'progress',
        step: stepNumber,
        total: totalSteps,
        action: step.toolName || 'Processing...',
        percentage: Math.round((stepNumber / totalSteps) * 100)
    };
    
    // Send to frontend via onMessage callback
    this.onMessage?.(progress);
}
```

### 6.3 Error Handling

```typescript
try {
    for await (const step of result.fullStream) {
        if (abortController?.signal.aborted) {
            throw new Error('Operation cancelled');
        }
        
        const claudeMessage = this.transformToClaudeFormat(step);
        onMessage?.(claudeMessage);
        messages.push(claudeMessage);
    }
} catch (error) {
    // Handle cancellation and errors
    const errorMessage = {
        type: 'result',
        subtype: 'error',
        result: error.message,
        session_id: 'custom_session'
    };
    
    onMessage?.(errorMessage);
    messages.push(errorMessage);
}
```

## Testing Strategy

### 7.1 Unit Tests
- Test message transformations
- Test tool executions
- Test error handling

### 7.2 Integration Tests
- Test with real AI providers
- Test design generation workflow
- Test canvas integration

### 7.3 Manual Testing
- Compare output with Claude Code
- Test design quality
- Test multi-step workflows

## Migration Checklist

### Phase 1: Setup
- [ ] Install AI SDK dependencies (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `zod`)
- [ ] Implement CustomAgentService base class
- [ ] Add working directory setup logic
- [ ] Add model selection configuration

### Phase 2: Message Transformation  
- [ ] Implement fullStream chunk processing
- [ ] Add text-delta → assistant message transformation
- [ ] Add tool-call → Claude Code tool_use transformation
- [ ] Add tool-result → Claude Code tool_result transformation
- [ ] Add finish → result message transformation
- [ ] Test message format compatibility with existing frontend

### Phase 3: Tool Implementation
- [ ] Implement core file operations (edit_file, read_file, list_files)
- [ ] Add design-specific tools (create_design_variations)
- [ ] Test file system operations
- [ ] Add proper error handling for tool execution

### Phase 4: Design System
- [ ] Port Claude Code system prompt to AI SDK format
- [ ] Implement design variation generation logic
- [ ] Add file naming convention handling
- [ ] Test design generation quality vs Claude Code

### Phase 5: Integration
- [ ] Add AI provider configuration to package.json
- [ ] Replace ClaudeCodeService import in extension.ts
- [ ] Update ChatMessageService to use CustomAgentService
- [ ] Test basic chat functionality end-to-end
- [ ] Test streaming message display in frontend

### Phase 6: Validation
- [ ] Test design generation produces valid HTML
- [ ] Test canvas integration loads generated files
- [ ] Performance testing vs Claude Code
- [ ] Error handling validation
- [ ] AbortController integration testing
- [ ] Multi-step tool execution testing
- [ ] Documentation updates

## Expected Benefits

1. **Better Model Support** - Use latest OpenAI/Anthropic models
2. **Active Development** - AI SDK is actively maintained
3. **Multi-Step Tools** - Better sequential tool calling
4. **Performance** - Potentially faster than Claude Code SDK
5. **Flexibility** - Easy to swap AI providers
6. **Cost Control** - Better visibility into token usage

## Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| Message format incompatibility | Comprehensive transformation functions |
| Missing Claude Code features | Implement equivalent functionality |
| Performance regression | Benchmark against current implementation |
| Design quality changes | A/B test design outputs |
| Breaking changes in AI SDK | Pin to stable versions | 