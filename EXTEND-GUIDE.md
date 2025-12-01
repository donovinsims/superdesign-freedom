# 🧩 SuperDesign Freedom Edition - Extend Guide

This guide is for users who want to customize and extend the functionality of their SuperDesign Freedom Edition. These are more advanced topics, but this guide will provide the basic patterns you can follow.

## 1. How to Customize the AI Prompts

The "system prompt" is the master instruction that tells the AI how to behave. By changing it, you can change the style of the designs it generates. For example, you could tell it to always use a specific color palette or design in a "brutalist" style.

### Where to Find the Prompts

The main system prompts are located inside the provider files themselves, in a function called `getDefaultSystemPrompt()`.

-   `src/providers/geminiProvider.ts`
-   `src/providers/ollamaProvider.ts`
-   `src/providers/claudeApiProvider.ts`

### How to Edit a Prompt

1.  **Open the Provider File**: In VS Code, open one of the files listed above.
2.  **Find the `getDefaultSystemPrompt` Function**: Scroll until you find this function.
3.  **Edit the Text**: The prompt is a long string of text. You can change any part of it. For example, to change the design style, you could add a line like:

    > "All designs must follow a minimalist, Scandinavian design aesthetic. Use a light color palette with plenty of white space."

4.  **Save the File**.
5.  **Rebuild the Extension**: After changing the code, you must re-package the extension to see your changes.
    -   Open a terminal in the project folder.
    -   Run `vsce package --allow-star-activation`.
    -   Install the new `.vsix` file that is created.

**Template for Customization:**

Here is a snippet from the prompt. You could edit the `UI design & implementation guidelines` section:

```typescript
private getDefaultSystemPrompt(): string {
    return `# Role
You are a **senior front-end designer**.

# UI design & implementation guidelines:
- Use modern, clean design principles
- // ADD YOUR NEW RULE HERE, for example:
- // All designs must use a dark theme with neon green accents.
- Implement responsive layouts
- Use Tailwind CSS for styling when possible`;
}
```

## 2. How to Add New Export Formats (Advanced)

SuperDesign currently exports to HTML, React, and Vue. Adding a new format like Svelte or Angular requires significant coding.

This functionality is not handled by the AI providers but is part of the core extension and webview logic. The code that handles exporting is likely located in the `src/webview/` directory, which contains the React-based frontend for the canvas and sidebar.

To add a new export format, you would need to:

1.  **Find the Export Logic**: Search for "export" in the `src/webview/` folder to find the relevant components and functions.
2.  **Create a New Exporter**: Write a new TypeScript function that takes the generated design (likely in an HTML or JSON format) and transforms it into the desired output (e.g., a `.svelte` file).
3.  **Add the UI**: Add a new button or option to the export menu in the webview's React code.
4.  **Rebuild the Extension**: Package and install the updated extension.

**Note**: This is a complex task for a developer. The best starting point would be to examine how the existing React and Vue exporters work and replicate that pattern.

## 3. How to Add New Features (Advanced)

Adding a new feature, such as a tool to automatically check for color contrast accessibility, is a major coding task.

Here is a general workflow a developer would follow:

1.  **Define the Feature**: What should it do? How should it work?
2.  **Identify the Core Components**: 
    -   Does it need a new UI element? (Edit files in `src/webview/`)
    -   Does it need to interact with the AI? (Edit a provider in `src/providers/`)
    -   Does it need a new command in VS Code? (Edit `src/extension.ts` and `package.json`)
3.  **Write the Code**: Implement the feature using TypeScript.
4.  **Test Thoroughly**: Make sure the new feature works and doesn’t break anything else.
5.  **Rebuild and Reinstall**.

### Template for Adding a New Command

If you wanted to add a new command that shows an alert, here is a simple template.

1.  **`package.json`**: Add the command to the `contributes.commands` array.

    ```json
    {
      "command": "superdesign.myNewFeature",
      "title": "Show My New Feature",
      "category": "Superdesign"
    }
    ```

2.  **`src/extension.ts`**: Add the command handler in the `activate` function.

    ```typescript
    // Register the command
    const myNewFeatureDisposable = vscode.commands.registerCommand(
        'superdesign.myNewFeature', 
        () => {
            vscode.window.showInformationMessage('My new feature is running!');
        }
    );

    // Add it to the subscriptions
    context.subscriptions.push(myNewFeatureDisposable);
    ```

This is a very basic example, but it shows the fundamental pattern for adding new commands to the extension.
