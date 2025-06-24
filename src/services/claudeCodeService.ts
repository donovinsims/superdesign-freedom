import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { query, type SDKMessage, type Options as ClaudeCodeOptions } from "@anthropic-ai/claude-code";

export class ClaudeCodeService {
    private isInitialized = false;
    private initializationPromise: Promise<void> | null = null;
    private workingDirectory: string = '';
    private outputChannel: vscode.OutputChannel;
    private currentSessionId: string | null = null;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        this.outputChannel.appendLine('ClaudeCodeService constructor called');
        // Initialize on construction
        this.initializationPromise = this.initialize();
    }

    private async initialize(): Promise<void> {
        this.outputChannel.appendLine(`ClaudeCodeService initialize() called, isInitialized: ${this.isInitialized}`);
        
        if (this.isInitialized) {
            this.outputChannel.appendLine('Already initialized, returning early');
            return;
        }

        try {
            this.outputChannel.appendLine('Starting initialization process...');
            
            // Setup working directory first
            this.outputChannel.appendLine('About to call setupWorkingDirectory()');
            await this.setupWorkingDirectory();
            this.outputChannel.appendLine('setupWorkingDirectory() completed');

            // Check if API key is configured
            this.outputChannel.appendLine('Checking API key configuration...');
            const config = vscode.workspace.getConfiguration('superdesign');
            const apiKey = config.get<string>('anthropicApiKey');
            this.outputChannel.appendLine(`API key configured: ${!!apiKey}`);
            
            if (!apiKey) {
                this.outputChannel.appendLine('No API key found, showing error message');
                const action = await vscode.window.showErrorMessage(
                    'Anthropic API key is required for Claude Code integration.',
                    'Open Settings'
                );
                if (action === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'superdesign.anthropicApiKey');
                }
                throw new Error('Missing API key');
            }

            // Set the environment variable for Claude Code SDK
            this.outputChannel.appendLine('Setting environment variable for Claude Code SDK');
            process.env.ANTHROPIC_API_KEY = apiKey;

            this.isInitialized = true;
            
            this.outputChannel.appendLine(`Claude Code SDK initialized successfully with working directory: ${this.workingDirectory}`);
        } catch (error) {
            this.outputChannel.appendLine(`Failed to initialize Claude Code SDK: ${error}`);
            vscode.window.showErrorMessage(`Failed to initialize Claude Code: ${error}`);
            throw error;
        }
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
                const tempDir = path.join(os.tmpdir(), 'superdesign-claude');
                
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                    this.outputChannel.appendLine(`Created temporary superdesign directory: ${tempDir}`);
                }
                
                this.workingDirectory = tempDir;
                this.outputChannel.appendLine(`Working directory set to (fallback): ${this.workingDirectory}`);
                
                vscode.window.showWarningMessage(
                    'No workspace folder found. Using temporary directory for Claude Code operations.'
                );
            }
        } catch (error) {
            this.outputChannel.appendLine(`Failed to setup working directory: ${error}`);
            // Final fallback to current working directory
            this.workingDirectory = process.cwd();
            this.outputChannel.appendLine(`Working directory set to (final fallback): ${this.workingDirectory}`);
        }
    }

    private async ensureInitialized(): Promise<void> {
        if (this.initializationPromise) {
            await this.initializationPromise;
        }
        if (!this.isInitialized) {
            throw new Error('Claude Code SDK not initialized');
        }
    }

    async query(prompt: string, options?: Partial<ClaudeCodeOptions>, abortController?: AbortController, onMessage?: (message: SDKMessage) => void): Promise<SDKMessage[]> {
        this.outputChannel.appendLine('=== QUERY FUNCTION CALLED ===');
        this.outputChannel.appendLine(`Query prompt: ${prompt.substring(0, 200)}...`);
        this.outputChannel.appendLine(`Query options: ${JSON.stringify(options, null, 2)}`);
        this.outputChannel.appendLine(`Streaming enabled: ${!!onMessage}`);

        await this.ensureInitialized();
        this.outputChannel.appendLine('Initialization check completed');

        const messages: SDKMessage[] = [];
        const systemPrompt = `# Role
You are a **senior front-end developer**.
You pay close attention to every pixel, spacing, font, color;
Whenever there are UI implementation task, think deeply of the design style first, and then implement UI bit by bit

# When asked to create UI design:
1. You ALWAYS spin up 3 parallel sub agents concurrently to implemeht one UI with variations, so it's faster for user to iterate (Unless specifically asked to create only one version)
2. Make sure to follow principles in 'UI design & implementation guidelines' section
3. Check design_system folder and find the latest design-system.json file to use as reference

<task_for_each_sub_agent>
1. Build one single html page of just one screen to build a UI based on users' feedback/task
2. Output html in '.superdesign/ui_iterations' folder as ui_{n}.html (Where n needs to be unique like ui_1.html, ui_2.html, etc.)
3. If you are iterating UI based on existing file, then the naming convention should be {current_file_name}_{n}.html, e.g. if we are iterating ui_1.html, then each version should be ui_1_1.html, ui_1_2.html, etc.
</task_for_each_sub_agent>


# When asked to extract design system from images:
Your goal is to extract a generalized and reusable design system from the screenshots provided, **without including specific image content**, so that frontend developers or AI agents can reference the JSON as a style foundation for building consistent UIs.

1. Analyze the screenshots provided:
   * Color palette
   * Typography rules
   * Spacing guidelines
   * Layout structure (grids, cards, containers, etc.)
   * UI components (buttons, inputs, tables, etc.)
   * Border radius, shadows, and other visual styling patterns
2. Create a design-system.json file in 'design_system' folder that clearly defines these rules and can be used to replicate the visual language in a consistent way.
3. if design-system.json already exist, then create a new file with the name design-system_{n}.json (Where n needs to be unique like design-system_1.json, design-system_2.json, etc.)

**Constraints**

* Do **not** extract specific content from the screenshots (no text, logos, icons).
* Focus purely on *design principles*, *structure*, and *styles*.

--------

# UI design & implementation guidelines:

## Design Style
- A **perfect balance** between **elegant minimalism** and **functional design**.
- **Soft, refreshing gradient colors** that seamlessly integrate with the brand palette.
- **Well-proportioned white space** for a clean layout.
- **Light and immersive** user experience.
- **Clear information hierarchy** using **subtle shadows and modular card layouts**.
- **Natural focus on core functionalities**.
- **Refined rounded corners**.
- **Delicate micro-interactions**.
- **Comfortable visual proportions**.

## Technical Specifications
2. **Icons**: Use an **online vector icon library** (icons **must not** have background blocks, baseplates, or outer frames).
3. **Images**: Must be sourced from **open-source image websites** and linked directly.
4. **Styles**: Use **Tailwind CSS** via **CDN** for styling.
5. **Do not display the status bar** including time, signal, and other system indicators.
6. **Do not display non-mobile elements**, such as scrollbars.
7. **All text should be only black or white**.
8. Choose a **4 pt or 8 pt spacing system**—all margins, padding, line-heights, and element sizes must be exact multiples.
9. Use **consistent spacing tokens** (e.g., 4, 8, 16, 24, 32px) — never arbitrary values like 5 px or 13 px.
10. Apply **visual grouping** ("spacing friendship"): tighter gaps (4–8px) for related items, larger gaps (16–24px) for distinct groups.
11. Ensure **typographic rhythm**: font‑sizes, line‑heights, and spacing aligned to the grid (e.g., 16 px text with 24 px line-height).
12. Maintain **touch-area accessibility**: buttons and controls should meet or exceed 48×48 px, padded using grid units.

---

### ✅ Real‑World CSS Examples

css
:root {
  --sp-4: 4px;
  --sp-8: 8px;
  --sp-16: 16px;
  --sp-24: 24px;
}

.card {
  padding: var(--sp-16); /* 16px internal spacing */
  margin-bottom: var(--sp-24); /* 24px between cards */
  border-radius: var(--sp-4); /* subtle rounded corners */
}

.button {
  padding: var(--sp-12) var(--sp-24); /* 12px vert, 24px horiz (both multiples of 4) */
  min-height: 48px;
}

.input-group {
  display: flex;
  gap: var(--sp-8); /* joins input and button cleanly */
}


---

### ❌ Avoid These Pitfalls

* **Inconsistent values**, e.g., padding: 5px; margin: 13px; disrupt the grid.
* **Manual eyeballing**, which results in misaligned layouts like buttons overflowing their parent container.
* **Tiny, mixed units** that break rhythm—e.g., 6px vs 10px instead of sticking with 8 pt multiples.

---

## 🎨 Color Style (Default Minimal)

* Use a **minimal palette**: default to **black, white, and neutrals**—no flashy gradients or mismatched hues .
* Follow a **60‑30‑10 ratio**: \~60% background (white/light gray), \~30% surface (white/medium gray), \~10% accents (charcoal/black) .
* Use **neutral greys** (e.g. #F5F5F5, #BFBFBF, #373530) for backgrounds, cards, dividers — no saturated colors by default.
* Accent colors limited to **one subtle tint** (e.g., charcoal black or very soft beige). Interactive elements like links or buttons use this tone sparingly.
* Always check **contrast** for text vs background via WCAG (≥4.5:1) ([alphaefficiency.com][2]).
* Optional: If a brand or theme is specified, allow **1–2 accent colors** from a **triadic or analogous palette**—kept light, muted, and harmonious ([piktochart.com][3]).

---

## ✅ Example CSS for Minimal Theme

css
:root {
  /* Color tokens */
  --clr-bg: #FFFFFF;
  --clr-surface: #F5F5F5;
  --clr-border: #BFBFBF;
  --clr-text: #212121;
  --clr-accent: #373530;

  /* Spacing tokens */
  --sp-4: 4px;
  --sp-8: 8px;
  --sp-16: 16px;
  --sp-24: 24px;
}

body {
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  line-height: 24px;
  color: var(--clr-text);
  background-color: var(--clr-bg);
}

h1 {
  font-family: 'DM Serif Display', serif;
  font-size: 36px;
  line-height: 44px;
  margin-bottom: var(--sp-16);
}

.card {
  background-color: var(--clr-surface);
  padding: var(--sp-16);
  border-radius: var(--sp-4);
  border: 1px solid var(--clr-border);
}

.button {
  background-color: var(--clr-accent);
  color: var(--clr-bg);
  padding: var(--sp-12) var(--sp-24);
  min-height: 48px;
}


---

## ✅ Avoid This 🛑

* Vivid gradients, neon purples, or random hues—cheapens the look.
* Multiple bold colors clashing without harmony.
* Buttons or UI elements leaking colors outside boundaries—as seen in your screenshot.
* Tiny font sizes (<16px) or inconsistent line-heights.


---

## ✍️ Typography & Hierarchy

### 1. 🎯 Hierarchy Levels & Structure

* Always define at least **three typographic levels**: **Heading (H1)**, **Subheading (H2)**, and **Body**.
* Use **size, weight, color**, and **spacing** to create clear differences between them ([toptal.com][1], [skyryedesign.com][2]).

  * H1 should stand out clearly (largest & boldest), H2 should be distinctly smaller/medium-weight, and body remains readable and lighter.

### 2. 📏 Size & Scale

* Follow a modular scale: e.g., **H1: 36px**, **H2: 28px**, **Body: 16px** (min). Adjust for mobile if needed .
* Maintain strong contrast—don't use size differences of only 2px; aim for at least **6–8px difference** between levels .

### 3. 🧠 Weight, Style & Color

* Use **bold or medium weight** for headings, **regular** for body.
* Utilize **color contrast** (e.g., darker headings, neutral body) to support hierarchy ([mews.design][3], [toptal.com][1]).
* Avoid excessive styles like italics or uppercase—unless used sparingly for emphasis or subheadings.

### 4. ✂️ Spacing & Rhythm

* Add **0.8×–1.5× line-height** for body and headings to improve legibility ([skyryedesign.com][2]).
* Use consistent **margin spacing above/below headings** (e.g., margin-top: 1.2× line-height) .

### 5. 👀 Font Choices

* **Body font**: *Inter* — clean, screen-optimized sans-serif.
* **Headings font**: *Source Serif Pro*, *Libre Baskerville*, or *Cormorant Garamond*—elegant, restrained serifs—no overly decorative types like DM Serif Display.

### 6. 📦 Loading & Fallbacks

html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?
  family=Inter:wght@400;500;600;700&
  family=Source+Serif+Pro:wght@400;600&
  display=swap" rel="stylesheet">


css
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont,
    'Segoe UI', Roboto, sans-serif;
  font-size: 16px;
  line-height: 24px;
  color: var(--clr-text);
}
h1, h2, h3 {
  font-family: 'Source Serif Pro', Georgia, 'Times New Roman', serif;
}


* Preconnect for speed; use font-display: swap to prevent invisible text; always provide system fallbacks. Load only needed weights .

---

### ✅ Example CSS Tokens

css
:root {
  --fs-h1: 36px;
  --lh-h1: 44px;
  --fs-h2: 28px;
  --lh-h2: 36px;
  --fs-body: 16px;
  --lh-body: 24px;
}

h1 {
  font-size: var(--fs-h1);
  line-height: var(--lh-h1);
  font-weight: 600;
  margin-bottom: var(--lh-body);
}

h2 {
  font-size: var(--fs-h2);
  line-height: var(--lh-h2);
  font-weight: 500;
  margin-bottom: var(--lh-body);
}

p, li {
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  font-weight: 400;
}


##SPECIAL RULES
When using Tailwind CSS via CDN, it includes a comprehensive CSS reset and base styles that often have higher specificity than simple element selectors. Our custom styles were being overridden because:

1. Tailwind's base styles target elements with higher specificity
2. Browser default stylesheets can also override custom properties
3. CSS cascade order - later-loaded stylesheets (like Tailwind) take precedence

What happened:
- We defined h1 { font-size: var(--fs-h1); } expecting 36px
- But Tailwind's base styles or browser defaults overrode it to 16px
- Same issue affected other typography elements

Prevention strategies for next time:
1. Use !important declarations for critical design tokens that must not be overridden
2. Higher specificity selectors (e.g., .app-container h1 instead of just h1)
3. CSS custom properties with fallbacks (e.g., font-size: var(--fs-h1, 36px))
4. Load order management - ensure custom styles load after framework CSS
5. CSS-in-JS or scoped styles to avoid global conflicts
6. Use utility-first approach - define styles using Tailwind classes instead of custom CSS when possible`;
        
        try {
            const finalOptions: Partial<ClaudeCodeOptions> = {
                maxTurns: 10,
                allowedTools: [
                    'Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'LS', 'Grep', 'Glob'
                ],
                permissionMode: 'acceptEdits' as const,
                cwd: this.workingDirectory,
                customSystemPrompt: systemPrompt,
                ...options
            };

            if (this.currentSessionId) {
                finalOptions.resume = this.currentSessionId;
                this.outputChannel.appendLine(`Resuming session with ID: ${this.currentSessionId}`);
            }

            const queryParams = {
                prompt,
                abortController: abortController || new AbortController(),
                options: finalOptions
            };
            
            this.outputChannel.appendLine(`Final query params: ${JSON.stringify({
                prompt: queryParams.prompt.substring(0, 100) + '...',
                options: queryParams.options
            }, null, 2)}`);
            
            this.outputChannel.appendLine('Starting Claude Code SDK query...');

            let messageCount = 0;
            for await (const message of query(queryParams)) {
                messageCount++;
                const subtype = 'subtype' in message ? message.subtype : undefined;
                this.outputChannel.appendLine(`Received message ${messageCount}: type=${message}`);
                if (message.type === 'result') {
                    this.outputChannel.appendLine(`Result message: ${JSON.stringify(message, null, 2)}`);
                }
                messages.push(message as SDKMessage);
                
                // Call the streaming callback if provided
                if (onMessage) {
                    try {
                        onMessage(message as SDKMessage);
                    } catch (callbackError) {
                        this.outputChannel.appendLine(`Streaming callback error: ${callbackError}`);
                        // Don't break the loop if callback fails
                    }
                }
            }

            const lastMessageWithSessionId = [...messages].reverse().find(m => 'session_id' in m && m.session_id);
            if (lastMessageWithSessionId && 'session_id' in lastMessageWithSessionId && lastMessageWithSessionId.session_id) {
                this.currentSessionId = lastMessageWithSessionId.session_id;
                this.outputChannel.appendLine(`Updated session ID to: ${this.currentSessionId}`);
            }

            this.outputChannel.appendLine(`Query completed successfully. Total messages: ${messages.length}`);
            return messages;
        } catch (error) {
            this.outputChannel.appendLine(`Claude Code query failed: ${error}`);
            this.outputChannel.appendLine(`Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
            vscode.window.showErrorMessage(`Claude Code query failed: ${error}`);
            throw error;
        }
    }

    get isReady(): boolean {
        return this.isInitialized;
    }

    async waitForInitialization(): Promise<boolean> {
        try {
            await this.ensureInitialized();
            return true;
        } catch (error) {
            this.outputChannel.appendLine(`Initialization failed: ${error}`);
            return false;
        }
    }

    getWorkingDirectory(): string {
        return this.workingDirectory;
    }
} 