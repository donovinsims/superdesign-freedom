# Claude Code Integration for Superdesign

This document explains how to set up and use the Claude Code SDK integration in the Superdesign VSCode extension.

## Setup

### 1. Prerequisites

- **Node.js** (for Claude Code CLI)
- **Anthropic API Key** - Get one from [Anthropic Console](https://console.anthropic.com/)

### 2. Install Claude Code CLI

```bash
npm install -g @anthropic-ai/claude-code
```

### 3. Configure API Key

1. Open VSCode Settings (`Cmd/Ctrl + ,`)
2. Search for "superdesign"
3. Find "Superdesign › Anthropic Api Key"
4. Enter your Anthropic API key

Alternatively, you can:
- Open Command Palette (`Cmd/Ctrl + Shift + P`)
- Run "Preferences: Open Settings (JSON)"
- Add: `"superdesign.anthropicApiKey": "your-api-key-here"`

## Features

### 🤖 AI Design Assistant

The integration provides an AI-powered design assistant accessible through the "AI Assistant" tab in the Superdesign panel.

#### Generate Components
- Describe the component you want to create
- Claude will generate React component code with:
  - TypeScript interfaces
  - Styling approaches
  - Accessibility considerations
  - Usage examples

#### Analyze Design System
- Claude analyzes your current codebase
- Provides recommendations for:
  - Component reusability patterns
  - Styling consistency
  - Accessibility improvements
  - Performance optimizations

## How It Works

### Dynamic Import Architecture

The integration uses dynamic imports to handle the CommonJS/ES module compatibility:

```typescript
// Dynamic import to handle ES module in CommonJS context
this.claudeCode = await import('@anthropic-ai/claude-code');
```

This approach:
- ✅ Works in VSCode extension CommonJS environment
- ✅ Maintains type safety with TypeScript
- ✅ Handles initialization gracefully
- ✅ Provides proper error handling

### Service Architecture

```
Extension (CommonJS) → ClaudeCodeService → Dynamic Import → @anthropic-ai/claude-code (ES Module)
                    ↓
                 Webview (React) → Message Passing → Extension
```

### Message Flow

1. **User Action**: User types prompt in webview
2. **Message**: Webview sends message to extension
3. **Service Call**: Extension calls ClaudeCodeService
4. **Claude Query**: Service uses dynamic import to call Claude Code SDK
5. **Response**: Result flows back through the chain
6. **UI Update**: Webview displays the generated code/analysis

## Usage Examples

### Generate a Button Component

```
Input: "Create a primary button component with loading state"

Output: Complete React component with:
- TypeScript props interface
- Loading spinner animation
- Accessibility attributes
- CSS modules styling
- Usage documentation
```

### Analyze Design Consistency

```
Action: Click "Analyze Design System"

Output: Report including:
- Color usage patterns
- Typography inconsistencies
- Component reusability opportunities
- Accessibility compliance issues
- Performance recommendations
```

## Troubleshooting

### API Key Issues

If you see "Missing API key" errors:
1. Verify your API key is set in VSCode settings
2. Check the API key is valid in [Anthropic Console](https://console.anthropic.com/)
3. Restart VSCode to refresh the configuration

### Claude Code CLI Not Found

If you get "claude command not found":
```bash
# Install globally
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version
```

### Module Import Errors

If you see ES module import errors:
- The dynamic import approach should handle this automatically
- Check that `@anthropic-ai/claude-code` is installed: `npm ls @anthropic-ai/claude-code`
- Try reinstalling: `npm uninstall @anthropic-ai/claude-code && npm install @anthropic-ai/claude-code`

### Rate Limiting

Claude Code SDK respects Anthropic's rate limits:
- Monitor usage in the Anthropic Console
- Implement delays between requests if needed
- Use the `maxTurns` option to limit complexity

## Development

### Adding New Claude Features

1. **Service Method**: Add method to `ClaudeCodeService`
```typescript
async generateNewFeature(prompt: string): Promise<string> {
    return await this.simpleQuery(prompt, {
        systemPrompt: "Your specialized system prompt",
        maxTurns: 3,
        allowedTools: ['Read', 'Write']
    });
}
```

2. **Extension Handler**: Add message handler in `SuperdesignPanel`
```typescript
case 'newFeature':
    await this.handleNewFeature(message);
    break;
```

3. **Webview UI**: Add UI controls and message sending
```typescript
const handleNewFeature = () => {
    vscode.postMessage({
        command: 'newFeature',
        prompt: userInput
    });
};
```

### Error Handling Best Practices

- Always wrap Claude calls in try-catch blocks
- Provide user-friendly error messages
- Log detailed errors for debugging
- Handle network timeouts gracefully
- Validate inputs before sending to Claude

## Security Considerations

- API keys are stored in VSCode settings (encrypted)
- Never log or expose API keys in console/UI
- Claude Code SDK handles secure communication with Anthropic
- All file operations respect VSCode workspace permissions

## Performance Tips

- Use `maxTurns` to limit response complexity
- Implement loading states for better UX
- Cache frequently used prompts/responses
- Consider request debouncing for real-time features
- Monitor token usage to optimize costs

## Next Steps

Potential enhancements:
- Session management for multi-turn conversations
- Custom system prompts per project
- Integration with existing design tokens
- Automated component documentation generation
- Design pattern library suggestions 