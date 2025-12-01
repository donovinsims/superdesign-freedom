# 🔧 SuperDesign Freedom Edition - Update Guide

This guide is for non-technical users who want to keep their SuperDesign Freedom Edition up-to-date with the latest AI models. Don’t worry, it’s easier than it sounds!

## How to Update to a New AI Model

Let’s say Google releases "Gemini 3.0" and you want to use it. Here’s how you would add it.

### For Gemini Models

1.  **Open VS Code Settings**: Go to `File > Preferences > Settings` (or press `Ctrl + ,`).
2.  **Find the Gemini Model Setting**: In the search bar, type `superdesign.geminiModel`.
3.  **Edit the Settings File**: You will see the current model (e.g., `gemini-1.5-pro`). To add a new one, you need to edit the underlying settings file.
    - Click the link that says **"Edit in settings.json"**.
    - This will open a text file.
4.  **Add the New Model**: Find the line that looks like this:

    ```json
    "superdesign.geminiModel": "gemini-1.5-pro",
    ```

    You need to modify the `package.json` file in the extension's source code to add the new model to the dropdown. This is a more advanced step. For now, you can just type the new model name directly into the `settings.json` file:

    ```json
    "superdesign.geminiModel": "gemini-3.0-new-model-name",
    ```

5.  **Save the File**: Save `settings.json` (`Ctrl + S`). The extension will now use your new model.

### For Ollama Models

This is much easier!

1.  **Open a Terminal**: Open your computer’s terminal (Command Prompt on Windows, Terminal on Mac).
2.  **Pull the New Model**: Find the name of the new model you want to use (e.g., `llama4`). Run this command:

    ```bash
    ollama pull llama4
    ```

3.  **Configure in VS Code**: 
    - Press `Ctrl + Shift + P` to open the Command Palette.
    - Type `Superdesign: Configure Ollama Settings` and press Enter.
    - Keep the endpoint the same (press Enter).
    - When it asks for the model, type the name of the new model you just pulled (e.g., `llama4`) and press Enter.

That’s it! You’re now using the new local model.

## How to Add a New AI Provider (Advanced)

This is a more technical task that involves editing the extension’s code. This guide provides a high-level overview. If you’re not comfortable with this, it’s best to ask for help.

Let’s say you want to add a new provider called "MagicAI".

1.  **Create a Provider File**: 
    - In the extension’s source code, go to the `src/providers/` folder.
    - Create a new file named `magicApiProvider.ts`.
    - You would need to write TypeScript code in this file to connect to the MagicAI API. You can use `geminiProvider.ts` or `ollamaProvider.ts` as a template.

2.  **Update the Provider Factory**:
    - Open `src/providers/llmProviderFactory.ts`.
    - **Import your new provider**: Add `import { MagicApiProvider } from './magicApiProvider';` at the top.
    - **Add it to the `createProvider` function**: Add a new `case` for your provider.

3.  **Update the Provider List**:
    - In the same file (`llmProviderFactory.ts`), find the `getAvailableProviders` function.
    - Add an entry for "MagicAI" to the list so it shows up in the settings.

4.  **Add Configuration Settings**:
    - Open `package.json`.
    - Add new configuration settings for MagicAI, such as `superdesign.magicai.apiKey`.

5.  **Build the Extension**: You would need to re-compile and re-package the extension into a new `.vsix` file.

**Note**: This is a simplified overview. Adding a new provider requires knowledge of TypeScript and how to interact with APIs. The existing provider files are the best reference.
