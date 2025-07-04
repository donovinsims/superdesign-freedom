import { streamText, CoreMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { AgentService, ExecutionContext } from '../types/agent';
import { createReadTool } from '../tools/read-tool';
import { createWriteTool } from '../tools/write-tool';
import { createBashTool } from '../tools/bash-tool';
import { createEditTool } from '../tools/edit-tool';
import { createGlobTool } from '../tools/glob-tool';
import { createGrepTool } from '../tools/grep-tool';
import { createThemeTool } from '../tools/theme-tool';
import { createLsTool } from '../tools/ls-tool';
import { createMultieditTool } from '../tools/multiedit-tool';

export class CustomAgentService implements AgentService {
    private workingDirectory: string = '';
    private outputChannel: vscode.OutputChannel;
    private isInitialized = false;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        this.outputChannel.appendLine('CustomAgentService constructor called');
        this.setupWorkingDirectory();
    }

    private async setupWorkingDirectory(): Promise<void> {
        try {
            // Try to get workspace root first
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            this.outputChannel.appendLine(`Workspace root detected: ${workspaceRoot}`);
            
            if (workspaceRoot) {
                // Create .superdesign folder in workspace root
                const superdesignDir = path.join(workspaceRoot, '.superdesign');
                this.outputChannel.appendLine(`Setting up .superdesign directory at: ${superdesignDir}`);
                
                // Create directory if it doesn't exist
                if (!fs.existsSync(superdesignDir)) {
                    fs.mkdirSync(superdesignDir, { recursive: true });
                    this.outputChannel.appendLine(`Created .superdesign directory: ${superdesignDir}`);
                } else {
                    this.outputChannel.appendLine(`.superdesign directory already exists: ${superdesignDir}`);
                }
                
                this.workingDirectory = superdesignDir;
                this.outputChannel.appendLine(`Working directory set to: ${this.workingDirectory}`);
            } else {
                this.outputChannel.appendLine('No workspace root found, using fallback');
                // Fallback to OS temp directory if no workspace
                const tempDir = path.join(os.tmpdir(), 'superdesign-custom');
                
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                    this.outputChannel.appendLine(`Created temporary superdesign directory: ${tempDir}`);
                }
                
                this.workingDirectory = tempDir;
                this.outputChannel.appendLine(`Working directory set to (fallback): ${this.workingDirectory}`);
                
                vscode.window.showWarningMessage(
                    'No workspace folder found. Using temporary directory for Custom Agent operations.'
                );
            }
            
            this.isInitialized = true;
        } catch (error) {
            this.outputChannel.appendLine(`Failed to setup working directory: ${error}`);
            // Final fallback to current working directory
            this.workingDirectory = process.cwd();
            this.outputChannel.appendLine(`Working directory set to (final fallback): ${this.workingDirectory}`);
            this.isInitialized = true;
        }
    }

    private getModel() {
        const config = vscode.workspace.getConfiguration('superdesign');
        const provider = config.get<string>('aiModelProvider', 'openai');
        
        this.outputChannel.appendLine(`Using AI provider: ${provider}`);
        
        switch (provider) {
            case 'anthropic':
                const anthropicKey = config.get<string>('anthropicApiKey');
                if (!anthropicKey) {
                    throw new Error('Anthropic API key not configured. Please run "Configure Anthropic API Key" command.');
                }
                
                this.outputChannel.appendLine(`Anthropic API key found: ${anthropicKey.substring(0, 12)}...`);
                
                const anthropic = createAnthropic({
                    apiKey: anthropicKey
                });
                
                return anthropic('claude-3-5-sonnet-20241022');
                
            case 'openai':
            default:
                const openaiKey = config.get<string>('openaiApiKey');
                if (!openaiKey) {
                    throw new Error('OpenAI API key not configured. Please run "Configure OpenAI API Key" command.');
                }
                
                this.outputChannel.appendLine(`OpenAI API key found: ${openaiKey.substring(0, 7)}...`);
                
                const openai = createOpenAI({
                    apiKey: openaiKey
                });
                
                return openai('gpt-4o');
        }
    }

    private getSystemPrompt(): string {
        const config = vscode.workspace.getConfiguration('superdesign');
        const provider = config.get<string>('aiModelProvider', 'openai');
        
        return `# Role
You are superdesign, a senior frontend designer integrated into VS Code as part of the Super Design extension.
Your goal is to help user generate amazing design using code

# Current Context
- Extension: Super Design (Design Agent for VS Code)
- AI Provider: ${provider}
- Working directory: ${this.workingDirectory}

# Available Tools
- **read**: Read file contents within the workspace (supports text files, images, with line range options)
- **write**: Write content to files in the workspace (creates parent directories automatically)
- **edit**: Replace text within files using exact string matching (requires precise text matching including whitespace and indentation)
- **multiedit**: Perform multiple find-and-replace operations on a single file in sequence (each edit applied to result of previous edit)
- **glob**: Find files and directories matching glob patterns (e.g., "*.js", "src/**/*.ts") - efficient for locating files by name or path structure
- **grep**: Search for text patterns within file contents using regular expressions (can filter by file types and paths)
- **ls**: List directory contents with optional filtering, sorting, and detailed information (shows files and subdirectories)
- **bash**: Execute shell/bash commands within the workspace (secure execution with timeouts and output capture)
- **generateTheme**: Generate a theme for the design

# Instructions
- Use the available tools when needed to help with file operations and code analysis
- When creating design file:
  - Build one single html page of just one screen to build a design based on users' feedback/task
  - You ALWAYS output design files in 'design_iterations' folder as {design_name}_{n}.html (Where n needs to be unique like table_1.html, table_2.html, etc.) or svg file
  - If you are iterating design based on existing file, then the naming convention should be {current_file_name}_{n}.html, e.g. if we are iterating ui_1.html, then each version should be ui_1_1.html, ui_1_2.html, etc.
- You should ALWAYS use tools above for write/edit html files, don't just output in a message, always do tool calls

## Styling
1. superdesign tries to use the shadcn/ui library unless the user specifies otherwise.
2. superdesign avoids using indigo or blue colors unless specified in the user's request.
3. superdesign MUST generate responsive designs.
4. When designing component, poster or any other design that is not full app, you should make sure the background fits well with the actual poster or component UI color; e.g. if component is light then background should be dark, vice versa.

## Images & icons
1. For images, just use placeholder image from public source like placehold.co or others; Don't make up urls
2. For icons, we should use lucid icons or other public icons, import like <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>

## Script
1. When importing tailwind css, just use <script src="https://cdn.tailwindcss.com"></script>, don't load CSS directly as a stylesheet resource like <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">

## Workflow
You should always follow workflow below unless user explicitly ask you to do something else:
1. Layout design
2. Theme design (Color, font, spacing, shadown), using generateTheme tool
3. Animation design
4. Generate a css file for the style theme, and then a singlehtml file for the UI
5. You HAVE TO confirm with user step by step, don't do theme design until user sign off the layout design, same for all follownig steps
6. When creating CSS, make sure you include !important for all properties that might be overwritten by tailwind, e.g. h1, body, etc.

### 1. Layout design
Think through how should the layout of interface look like, what are different UI components
And present the layout in ASCII wireframe format

### 2. Theme design
Think through what are the colors, fonts, spacing, etc. 
Output the theme in JSON format

### 3. Animation design
Think through what are the animations, transitions, etc. 

### 4. Generate html file for each UI component and then combine them together to form a single html file
Generate html file for each UI component and then combine them together to form a single html file

<example>
<user>design an AI chat UI</user>

<assistant>
Let's think through the layout design for an AI chat UI. Here are the key components and layout considerations:

## Core UI Components

**Header Area**
- Settings/menu button (Top left)
- Chat title/AI name (Top left)
- Conversation controls (new chat, clear, etc.) (Top right)

**Main Chat Area**
- Message container (scrollable) (Full width & height)
- User messages (typically right-aligned)
- AI messages (typically left-aligned)
- Message timestamps (Small subtle text at the bottom of each message, aligned to the right/left depending on the message)

**Input Area**
- Text input field (Full width left)
- Send button (Embed within the input field,Bottom right side of the screen)
- Additional controls (attach files, voice input, etc.) (Embed within the input field, Bottom left)
- Character/token counter (optional) (Embed within the input field, top right corner, small text)


## Layout Structure Options

┌─────────────────────────────────────┐
│ ☰          HEADER BAR            + │
├─────────────────────────────────────┤
│                                     │
│ ┌─────────────────────────────┐     │
│ │     AI Message Bubble       │     │
│ └─────────────────────────────┘     │
│                                     │
│     ┌─────────────────────────────┐ │
│     │     User Message Bubble     │ │
│     └─────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────┐     │
│ │     AI Message Bubble       │     │
│ └─────────────────────────────┘     │
│                                     │
│              [CHAT AREA]            │
│                                     │
├─────────────────────────────────────┤
│ [Text Input Field]           [Send] │
└─────────────────────────────────────┘

When hamburger (☰) is clicked, sidebar slides out:
┌──────────────┬─────────────────────────────────────┐
│   SIDEBAR    │ ☰           HEADER BAR           + │
│ ┌──────────┐ ├─────────────────────────────────────┤
│ │ Chat 1   │ │                                     │
│ │ Chat 2   │ │ ┌─────────────────────────────┐     │
│ │ Chat 3   │ │ │     AI Message Bubble       │     │
│ │ + New    │ │ └─────────────────────────────┘     │
│ └──────────┘ │                                     │
│              │     ┌─────────────────────────────┐ │
│              │     │     User Message Bubble     │ │
│              │     └─────────────────────────────┘ │
│              │                                     │
│              │ ┌─────────────────────────────┐     │
│              │ │     AI Message Bubble       │     │
│              │ └─────────────────────────────┘     │
│              │                                     │
│              │              [CHAT AREA]            │
│              │                                     │
│              ├─────────────────────────────────────┤
│              │ [Text Input Field]           [Send] │
└──────────────┘─────────────────────────────────────┘

## Key Layout Considerations

**Message Flow**
- Should messages stack vertically with clear visual separation?
- How do we handle long messages vs short ones?
- Should we group consecutive messages from the same sender?

**Responsive Behavior**
- How does the layout adapt from desktop to tablet to mobile?
- Should the sidebar collapse or hide on smaller screens?

**Content Width**
- Maximum width for readability (prevent overly long lines)
- Centering vs full-width approach

Would you like to go ahead with this layout or needs any modification?
</assistant>

<user>
Layout looks good
</user>

<assistant>
Great, next let's design the color & font theme,

<tool-call>
generateTheme(theme_name='Vercel dark mode style', reasoning_reference='Reference classic shadcn style that has ...', cssSheet=':root {
  --background: oklch(1.0000 0 0);
  --foreground: oklch(0.1448 0 0);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0.1448 0 0);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.1448 0 0);
  --primary: oklch(0.5555 0 0);
  --primary-foreground: oklch(0.9851 0 0);
  --secondary: oklch(0.9702 0 0);
  --secondary-foreground: oklch(0.2046 0 0);
  --muted: oklch(0.9702 0 0);
  --muted-foreground: oklch(0.5486 0 0);
  --accent: oklch(0.9702 0 0);
  --accent-foreground: oklch(0.2046 0 0);
  --destructive: oklch(0.5830 0.2387 28.4765);
  --destructive-foreground: oklch(0.9702 0 0);
  --border: oklch(0.9219 0 0);
  --input: oklch(0.9219 0 0);
  --ring: oklch(0.7090 0 0);
  --chart-1: oklch(0.5555 0 0);
  --chart-2: oklch(0.5555 0 0);
  --chart-3: oklch(0.5555 0 0);
  --chart-4: oklch(0.5555 0 0);
  --chart-5: oklch(0.5555 0 0);
  --sidebar: oklch(0.9851 0 0);
  --sidebar-foreground: oklch(0.1448 0 0);
  --sidebar-primary: oklch(0.2046 0 0);
  --sidebar-primary-foreground: oklch(0.9851 0 0);
  --sidebar-accent: oklch(0.9702 0 0);
  --sidebar-accent-foreground: oklch(0.2046 0 0);
  --sidebar-border: oklch(0.9219 0 0);
  --sidebar-ring: oklch(0.7090 0 0);
  --font-sans: Geist Mono, monospace;
  --font-serif: Geist Mono, monospace;
  --font-mono: Geist Mono, monospace;
  --radius: 0rem;
  --shadow-2xs: 0px 1px 0px 0px hsl(0 0% 0% / 0.00);
  --shadow-xs: 0px 1px 0px 0px hsl(0 0% 0% / 0.00);
  --shadow-sm: 0px 1px 0px 0px hsl(0 0% 0% / 0.00), 0px 1px 2px -1px hsl(0 0% 0% / 0.00);
  --shadow: 0px 1px 0px 0px hsl(0 0% 0% / 0.00), 0px 1px 2px -1px hsl(0 0% 0% / 0.00);
  --shadow-md: 0px 1px 0px 0px hsl(0 0% 0% / 0.00), 0px 2px 4px -1px hsl(0 0% 0% / 0.00);
  --shadow-lg: 0px 1px 0px 0px hsl(0 0% 0% / 0.00), 0px 4px 6px -1px hsl(0 0% 0% / 0.00);
  --shadow-xl: 0px 1px 0px 0px hsl(0 0% 0% / 0.00), 0px 8px 10px -1px hsl(0 0% 0% / 0.00);
  --shadow-2xl: 0px 1px 0px 0px hsl(0 0% 0% / 0.00);
  --tracking-normal: 0em;
  --spacing: 0.25rem;

  /* Additional derived variables for easier use */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

.dark {
  --background: oklch(0.1448 0 0);
  --foreground: oklch(0.9851 0 0);
  --card: oklch(0.2134 0 0);
  --card-foreground: oklch(0.9851 0 0);
  --popover: oklch(0.2686 0 0);
  --popover-foreground: oklch(0.9851 0 0);
  --primary: oklch(0.5555 0 0);
  --primary-foreground: oklch(0.9851 0 0);
  --secondary: oklch(0.2686 0 0);
  --secondary-foreground: oklch(0.9851 0 0);
  --muted: oklch(0.2686 0 0);
  --muted-foreground: oklch(0.7090 0 0);
  --accent: oklch(0.3715 0 0);
  --accent-foreground: oklch(0.9851 0 0);
  --destructive: oklch(0.7022 0.1892 22.2279);
  --destructive-foreground: oklch(0.2686 0 0);
  --border: oklch(0.3407 0 0);
  --input: oklch(0.4386 0 0);
  --ring: oklch(0.5555 0 0);
  --chart-1: oklch(0.5555 0 0);
  --chart-2: oklch(0.5555 0 0);
  --chart-3: oklch(0.5555 0 0);
  --chart-4: oklch(0.5555 0 0);
  --chart-5: oklch(0.5555 0 0);
  --sidebar: oklch(0.2046 0 0);
  --sidebar-foreground: oklch(0.9851 0 0);
  --sidebar-primary: oklch(0.9851 0 0);
  --sidebar-primary-foreground: oklch(0.2046 0 0);
  --sidebar-accent: oklch(0.2686 0 0);
  --sidebar-accent-foreground: oklch(0.9851 0 0);
  --sidebar-border: oklch(1.0000 0 0);
  --sidebar-ring: oklch(0.4386 0 0);
  --font-sans: Geist Mono, monospace;
  --font-serif: Geist Mono, monospace;
  --font-mono: Geist Mono, monospace;
  --radius: 0rem;
  --shadow-2xs: 0px 1px 0px 0px hsl(0 0% 0% / 0.00);
  --shadow-xs: 0px 1px 0px 0px hsl(0 0% 0% / 0.00);
  --shadow-sm: 0px 1px 0px 0px hsl(0 0% 0% / 0.00), 0px 1px 2px -1px hsl(0 0% 0% / 0.00);
  --shadow: 0px 1px 0px 0px hsl(0 0% 0% / 0.00), 0px 1px 2px -1px hsl(0 0% 0% / 0.00);
  --shadow-md: 0px 1px 0px 0px hsl(0 0% 0% / 0.00), 0px 2px 4px -1px hsl(0 0% 0% / 0.00);
  --shadow-lg: 0px 1px 0px 0px hsl(0 0% 0% / 0.00), 0px 4px 6px -1px hsl(0 0% 0% / 0.00);
  --shadow-xl: 0px 1px 0px 0px hsl(0 0% 0% / 0.00), 0px 8px 10px -1px hsl(0 0% 0% / 0.00);
  --shadow-2xl: 0px 1px 0px 0px hsl(0 0% 0% / 0.00);
}')
</tool-call>

Here is a few proposal that might provides some inspiration:
...

<user>
I like the vintage style
</user>

<assistant>
Great, next let's design the animation:

# Chat UI Animation System - CSS Keyframes

## Message Animations

### New User Message (Send)
@keyframes userMessageSend {
  0%   { opacity: 0; transform: translateY(20px) translateX(10px) scale(0.9); }
  70%  { opacity: 1; transform: translateY(-3px) translateX(0px) scale(1.02); }
  100% { opacity: 1; transform: translateY(0px) translateX(0px) scale(1.0); }
}
Duration: 400ms
Easing: cubic-bezier(0.25, 0.46, 0.45, 0.94)

### AI Message Reveal
@keyframes aiMessageReveal {
  0%   { opacity: 0; transform: translateY(15px) scale(0.95); }
  50%  { opacity: 0.8; transform: translateY(-2px) scale(1.01); }
  100% { opacity: 1; transform: translateY(0px) scale(1.0); }
}
Duration: 600ms
Easing: cubic-bezier(0.34, 1.56, 0.64, 1)
Delay: 200ms (after typing indicator)

### Typing Indicator Dots
@keyframes typingDot {
  0%, 60%, 100% { transform: translateY(0px); opacity: 0.4; }
  30%           { transform: translateY(-8px); opacity: 1.0; }
}
Duration: 1400ms
Easing: ease-in-out
Infinite: true
Stagger: dot1(0ms), dot2(200ms), dot3(400ms)

### Message State Transitions
@keyframes messageStatus {
  /* Sending → Sent */
  0%   { opacity: 0.6; transform: scale(1.0); }
  50%  { opacity: 0.8; transform: scale(1.05); }
  100% { opacity: 1.0; transform: scale(1.0); }
}
Duration: 300ms
Easing: ease-out

## Interface Transitions

### Sidebar Slide In/Out
@keyframes sidebarSlideIn {
  0%   { transform: translateX(-280px); opacity: 0; }
  100% { transform: translateX(0px); opacity: 1; }
}

@keyframes sidebarSlideOut {
  0%   { transform: translateX(0px); opacity: 1; }
  100% { transform: translateX(-280px); opacity: 0; }
}
Duration: 350ms
Easing: cubic-bezier(0.4, 0.0, 0.2, 1)

### Sidebar Overlay (Mobile)
@keyframes overlayFadeIn {
  0%   { opacity: 0; backdrop-filter: blur(0px); }
  100% { opacity: 1; backdrop-filter: blur(4px); }
}
Duration: 300ms
Easing: ease-out

### Input Field Focus
@keyframes inputFocus {
  0%   { transform: scale(1.0); box-shadow: var(--shadow-sm); }
  100% { transform: scale(1.01); box-shadow: var(--shadow-lg), 0 0 0 2px var(--ring); }
}
Duration: 200ms
Easing: ease-out

### Input Field Blur
@keyframes inputBlur {
  0%   { transform: scale(1.01); box-shadow: var(--shadow-lg), 0 0 0 2px var(--ring); }
  100% { transform: scale(1.0); box-shadow: var(--shadow-sm); }
}
Duration: 150ms
Easing: ease-in

## Button Interactions

### Send Button Press
@keyframes sendButtonPress {
  0%   { transform: scale(1.0) rotate(0deg); }
  50%  { transform: scale(0.95) rotate(-2deg); }
  100% { transform: scale(1.0) rotate(0deg); }
}
Duration: 150ms
Easing: cubic-bezier(0.25, 0.46, 0.45, 0.94)


### Send Button Hover
@keyframes sendButtonHover {
  0%   { transform: scale(1.0); box-shadow: var(--shadow); }
  100% { transform: scale(1.05); box-shadow: var(--shadow-lg); }
}
Duration: 200ms
Easing: ease-out


### Button Ripple Effect
@keyframes buttonRipple {
  0%   { transform: scale(0); opacity: 1; }
  100% { transform: scale(2); opacity: 0; }
}
Duration: 400ms
Easing: ease-out


## Loading States

### Initial Chat Load
@keyframes chatContainerLoad {
  0%   { opacity: 0; transform: translateY(40px); }
  100% { opacity: 1; transform: translateY(0px); }
}
Duration: 500ms
Easing: cubic-bezier(0.25, 0.46, 0.45, 0.94)


### Message Loading Skeleton
@keyframes skeletonPulse {
  0%   { background-color: var(--muted); }
  50%  { background-color: var(--accent); }
  100% { background-color: var(--muted); }
}
Duration: 2000ms
Easing: ease-in-out
Infinite: true


### Spinner Loading
css
@keyframes spinnerRotate {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
Duration: 1000ms
Easing: linear
Infinite: true


## Scroll Behaviors

### Auto-scroll to Bottom
css
@keyframes smoothScrollDown {
  0%   { scroll-behavior: smooth; }
  100% { scroll-behavior: smooth; }
}
Duration: 400ms
Easing: cubic-bezier(0.25, 0.46, 0.45, 0.94)


### New Message Scroll Indicator
css
@keyframes scrollIndicatorBounce {
  0%, 100% { transform: translateY(0px); }
  50%      { transform: translateY(-5px); }
}
Duration: 800ms
Easing: ease-in-out
Infinite: true (3 cycles, then stop)


## Error & Success States

### Error Message Shake
css
@keyframes errorShake {
  0%, 100% { transform: translateX(0px); }
  25%      { transform: translateX(-5px); }
  75%      { transform: translateX(5px); }
}
Duration: 400ms
Easing: ease-in-out


### Success Checkmark
css
@keyframes successCheck {
  0%   { transform: scale(0) rotate(0deg); opacity: 0; }
  50%  { transform: scale(1.2) rotate(180deg); opacity: 1; }
  100% { transform: scale(1.0) rotate(360deg); opacity: 1; }
}
Duration: 600ms
Easing: cubic-bezier(0.68, -0.55, 0.265, 1.55)


## Message Bubble Interactions

### Message Hover (Desktop)
css
@keyframes messageHover {
  0%   { transform: translateY(0px); box-shadow: var(--shadow-sm); }
  100% { transform: translateY(-2px); box-shadow: var(--shadow-md); }
}
Duration: 200ms
Easing: ease-out


### Message Selection
css
@keyframes messageSelect {
  0%   { background-color: var(--card); transform: scale(1.0); }
  100% { background-color: var(--accent); transform: scale(1.02); }
}
Duration: 200ms
Easing: ease-out


This animation system creates a cohesive, responsive feel throughout the chat interface. Each animation has specific timing and easing to feel natural and purposeful. Would you like me to adjust any of these animations or add additional ones?

</assistant>

<user>
This looks great, lets do it
</user>

<assistant>
Great, I will generate the html file for each UI component and then combine them together to form a single html file

<tool-call>
write(file_path='design_iterations/chat_ui.css', content='...')
write(file_path='design_iterations/chat_ui.html', content='...')
</tool-call>

I've created the html design, please reveiw and let me know if you need any changes
</assistant>

</example>

IMPORTANT RULES:
1. You MUST use tools listed in # Available Tools for any actions to take, do NOT just output text like 'Called tool: write with arguments: ...', this won't actually call the tool.
2. You MUST confirm the layout, and then theme style, and then animation
`;}

    async query(
        prompt?: string,
        conversationHistory?: CoreMessage[],
        options?: any, 
        abortController?: AbortController,
        onMessage?: (message: any) => void
    ): Promise<any[]> {
        this.outputChannel.appendLine('=== CUSTOM AGENT QUERY CALLED ===');
        
        // Determine which input format we're using
        const usingConversationHistory = !!conversationHistory && conversationHistory.length > 0;
        
        if (usingConversationHistory) {
            this.outputChannel.appendLine(`Query using conversation history: ${conversationHistory!.length} messages`);
        } else if (prompt) {
            this.outputChannel.appendLine(`Query prompt: ${prompt.substring(0, 200)}...`);
        } else {
            throw new Error('Either prompt or conversationHistory must be provided');
        }
        
        this.outputChannel.appendLine(`Query options: ${JSON.stringify(options, null, 2)}`);
        this.outputChannel.appendLine(`Streaming enabled: ${!!onMessage}`);

        if (!this.isInitialized) {
            await this.setupWorkingDirectory();
        }

        const responseMessages: any[] = [];
        const sessionId = `session_${Date.now()}`;
        let messageBuffer = '';
        
        // Tool call streaming state
        let currentToolCall: any = null;
        let toolCallBuffer = '';

        try {
            this.outputChannel.appendLine('Starting AI SDK streamText...');

            // Create execution context for tools
            const executionContext: ExecutionContext = {
                workingDirectory: this.workingDirectory,
                sessionId: sessionId,
                outputChannel: this.outputChannel,
                abortController: abortController,
            };

            // Create tools with context
            const tools = {
                read: createReadTool(executionContext),
                write: createWriteTool(executionContext),
                edit: createEditTool(executionContext),
                multiedit: createMultieditTool(executionContext),
                glob: createGlobTool(executionContext),
                grep: createGrepTool(executionContext),
                ls: createLsTool(executionContext),
                bash: createBashTool(executionContext),
                generateTheme: createThemeTool(executionContext)
            };

            // Prepare AI SDK input based on available data
            const streamTextConfig: any = {
                model: this.getModel(),
                system: this.getSystemPrompt(),
                tools: tools,
                toolCallStreaming: true,
                maxSteps: 10, // Enable multi-step reasoning with tools
                maxTokens: 8192 // Increase token limit to prevent truncation
            };
            
            if (usingConversationHistory) {
                // Use conversation messages
                streamTextConfig.messages = conversationHistory;
                this.outputChannel.appendLine(`Using conversation history with ${conversationHistory!.length} messages`);
                
                // Debug: Log the actual messages being sent to AI SDK
                this.outputChannel.appendLine('=== AI SDK MESSAGES DEBUG ===');
                conversationHistory!.forEach((msg, index) => {
                    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                    this.outputChannel.appendLine(`  [${index}] ${msg.role}: "${content.substring(0, 150)}..."`);
                });
                this.outputChannel.appendLine('=== END AI SDK MESSAGES DEBUG ===');
            } else {
                // Use single prompt
                streamTextConfig.prompt = prompt;
                this.outputChannel.appendLine(`Using single prompt: ${prompt!.substring(0, 100)}...`);
            }

            const result = streamText(streamTextConfig);

            this.outputChannel.appendLine('AI SDK streamText created, starting to process chunks...');

            

            for await (const chunk of result.fullStream) {
                // Check for abort signal
                if (abortController?.signal.aborted) {
                    this.outputChannel.appendLine('Operation aborted by user');
                    throw new Error('Operation cancelled');
                }

                this.outputChannel.appendLine(`Received chunk type: ${chunk.type}`);

                switch (chunk.type) {
                    case 'text-delta':
                        // Handle streaming text (assistant message chunks)
                        messageBuffer += chunk.textDelta;
                        
                        const textMessage = {
                            type: 'assistant',
                            message: chunk.textDelta,
                            session_id: sessionId,
                            parent_tool_use_id: null
                        };
                        
                        onMessage?.(textMessage);
                        responseMessages.push(textMessage);
                        break;

                    case 'finish':
                        // Final result message
                        this.outputChannel.appendLine(`===Stream finished with reason: ${chunk.finishReason}`);
                        this.outputChannel.appendLine(`${JSON.stringify(chunk)}`);
                        this.outputChannel.appendLine(`========================================`);
                        
                        const resultMessage = {
                            type: 'result',
                            subtype: 'success',
                            result: chunk.finishReason === 'stop' ? 'Response completed successfully' : 'Response completed',
                            session_id: sessionId,
                            duration_ms: Date.now() - parseInt(sessionId.split('_')[1]),
                            total_cost_usd: chunk.usage?.totalTokens ? chunk.usage.totalTokens * 0.00001 : 0,
                            usage: chunk.usage || {}
                        };
                        
                        onMessage?.(resultMessage);
                        responseMessages.push(resultMessage);
                        break;

                    case 'error':
                        // Error handling
                        const errorMsg = (chunk as any).error?.message || 'Unknown error occurred';
                        this.outputChannel.appendLine(`Stream error: ${errorMsg}`);
                        
                        const errorMessage = {
                            type: 'result',
                            subtype: 'error',
                            result: errorMsg,
                            session_id: sessionId,
                            is_error: true
                        };
                        
                        onMessage?.(errorMessage);
                        responseMessages.push(errorMessage);
                        break;

                    case 'tool-call-streaming-start':
                        // Tool call streaming started
                        const streamStart = chunk as any;
                        currentToolCall = {
                            toolCallId: streamStart.toolCallId,
                            toolName: streamStart.toolName,
                            args: {}
                        };
                        toolCallBuffer = '';
                        
                        this.outputChannel.appendLine(`Tool call streaming started: ${streamStart.toolName} (ID: ${streamStart.toolCallId})`);
                        
                        // Send initial tool call message to frontend in Claude Code format
                        const toolCallStartMessage = {
                            type: 'assistant',
                            message: {
                                content: [{
                                    type: 'tool_use',
                                    id: streamStart.toolCallId,
                                    name: streamStart.toolName,
                                    input: {} // Empty initially, will be updated with deltas
                                }]
                            },
                            session_id: sessionId,
                            parent_tool_use_id: null
                        };
                        
                        onMessage?.(toolCallStartMessage);
                        responseMessages.push(toolCallStartMessage);
                        break;

                    case 'tool-call-delta':
                        // Streaming tool call parameters
                        const delta = chunk as any;
                        if (currentToolCall && delta.argsTextDelta) {
                            toolCallBuffer += delta.argsTextDelta;
                            // this.outputChannel.appendLine(`Tool call delta: +${delta.argsTextDelta.length} chars (total: ${toolCallBuffer.length})`);
                            
                            // Try to parse current buffer as JSON and send parameter update
                            try {
                                const parsedArgs = JSON.parse(toolCallBuffer);
                                
                                // Send parameter update to frontend via ChatMessageService
                                const parameterUpdateMessage = {
                                    type: 'user',
                                    message: {
                                        content: [{
                                            type: 'tool_parameter_update',
                                            tool_use_id: currentToolCall.toolCallId,
                                            parameters: parsedArgs
                                        }]
                                    },
                                    session_id: sessionId,
                                    parent_tool_use_id: null
                                };
                                
                                onMessage?.(parameterUpdateMessage);
                                
                                // this.outputChannel.appendLine(`Sent parameter update: ${JSON.stringify(parsedArgs).substring(0, 100)}...`);
                            } catch (parseError) {
                                // JSON not complete yet, continue buffering
                                // Only log every 100 characters to avoid spam
                                if (toolCallBuffer.length % 100 === 0) {
                                    this.outputChannel.appendLine(`Tool call progress: ${toolCallBuffer.length} characters received (parsing...)`);
                                }
                            }
                        }
                        break;

                    case 'tool-call':
                        // Handle final complete tool call - transform to Claude Code format
                        const toolCall = chunk as any;
                        this.outputChannel.appendLine(`=====Tool call complete: ${JSON.stringify(toolCall)}`);
                        this.outputChannel.appendLine(`========================================`);
                        
                        // Skip sending duplicate tool call message if we already sent streaming start
                        if (!currentToolCall) {
                            // Only send if we didn't already send a streaming start message
                            const toolCallMessage = {
                                type: 'assistant',
                                message: {
                                    content: [{
                                        type: 'tool_use',
                                        id: toolCall.toolCallId,
                                        name: toolCall.toolName,
                                        input: toolCall.args
                                    }]
                                },
                                session_id: sessionId,
                                parent_tool_use_id: null
                            };
                            
                            onMessage?.(toolCallMessage);
                            responseMessages.push(toolCallMessage);
                        } else {
                            this.outputChannel.appendLine(`Skipping duplicate tool call message - already sent streaming start for ID: ${toolCall.toolCallId}`);
                        }
                        
                        // Reset tool call streaming state
                        currentToolCall = null;
                        toolCallBuffer = '';
                        break;

                    case 'step-start':
                        // Log step start with details
                        const stepStart = chunk as any;
                        this.outputChannel.appendLine(`====Step ${stepStart.step || 'unknown'} started: ${stepStart.stepType || 'reasoning'}`);
                        this.outputChannel.appendLine(`${JSON.stringify(chunk)}`);
                        this.outputChannel.appendLine(`========================================`);
                        break;

                    case 'step-finish':
                        // Log step completion with details
                        const stepFinish = chunk as any;
                        this.outputChannel.appendLine(`====Step ${stepFinish.step || 'unknown'} finished: ${stepFinish.stepType || 'reasoning'} (${stepFinish.finishReason || 'completed'})`);
                        this.outputChannel.appendLine(`${JSON.stringify(chunk)}`);
                        this.outputChannel.appendLine(`========================================`);
                        break;

                    default:
                        // Handle tool results and other unknown chunk types
                        if ((chunk as any).type === 'tool-result') {
                            const toolResult = chunk as any;
                            this.outputChannel.appendLine(`Tool result for ID: ${toolResult.toolCallId}: ${JSON.stringify(toolResult.result).substring(0, 200)}...`);
                            
                            const toolResultMessage = {
                                type: 'user',
                                message: {
                                    content: [{
                                        type: 'tool_result',
                                        tool_use_id: toolResult.toolCallId,
                                        content: JSON.stringify(toolResult.result, null, 2),
                                        is_error: false
                                    }]
                                },
                                session_id: sessionId,
                                parent_tool_use_id: null
                            };
                            
                            onMessage?.(toolResultMessage);
                            responseMessages.push(toolResultMessage);
                        } else {
                            this.outputChannel.appendLine(`Unknown chunk type: ${chunk.type}`);
                        }
                        break;
                }
            }

            this.outputChannel.appendLine(`Query completed successfully. Total messages: ${responseMessages.length}`);
            this.outputChannel.appendLine(`Complete response: "${messageBuffer}"`);
            
            return responseMessages;

        } catch (error) {
            this.outputChannel.appendLine(`Custom Agent query failed: ${error}`);
            this.outputChannel.appendLine(`Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
            
            // Send error message if streaming callback is available
            if (onMessage) {
                const errorMessage = {
                    type: 'result',
                    subtype: 'error',
                    result: error instanceof Error ? error.message : String(error),
                    session_id: sessionId,
                    is_error: true
                };
                onMessage(errorMessage);
            }
            
            throw error;
        }
    }

    get isReady(): boolean {
        return this.isInitialized;
    }

    async waitForInitialization(): Promise<boolean> {
        if (!this.isInitialized) {
            await this.setupWorkingDirectory();
        }
        return this.isInitialized;
    }

    getWorkingDirectory(): string {
        return this.workingDirectory;
    }
} 