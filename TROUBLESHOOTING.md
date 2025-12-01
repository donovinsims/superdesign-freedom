# ❓ SuperDesign Freedom Edition - Troubleshooting Guide

Something not working right? Don’t worry. Here are solutions to some common issues, written in plain English.

## Issue 1: Generations are failing or nothing is happening.

This is the most common issue and it’s usually related to the AI provider configuration.

### **If you are using Gemini:**

1.  **Check Your API Key**: 
    -   Is the key correct? Sometimes a character gets missed when copying.
    -   Did you paste the *entire* key?
    -   **Solution**: Re-enter your API key. Press `Ctrl + Shift + P`, type `Superdesign: Configure Gemini API Key`, and paste your key again.

2.  **Check Your Internet Connection**: The extension needs to connect to Google’s servers.

3.  **Check the Google AI Status**: Very rarely, Google’s service might be down. You can check their status page if one is available.

4.  **Error Message: "API key invalid"**
    -   This means the key you provided is wrong. Go back to the [Google AI Studio](https://ai.google.dev) and generate a new key. Make sure to copy it carefully.

### **If you are using Ollama:**

1.  **Is Ollama Running?**: The Ollama server **must** be running in the background.
    -   **Solution**: Open your terminal and run the command `ollama serve`. You must leave this window open while you use the extension.

2.  **Is the Model Pulled?**: You need to have the model downloaded.
    -   **Solution**: Open a new terminal and run `ollama pull <model_name>` (e.g., `ollama pull llama3.2`).

3.  **Is the Endpoint Correct?**: By default, Ollama runs at `http://localhost:11434`.
    -   **Solution**: Check your settings. Press `Ctrl + Shift + P`, type `Superdesign: Configure Ollama Settings`, and make sure the endpoint is correct.

4.  **Error Message: "Cannot connect to Ollama" or "ECONNREFUSED"**
    -   This is a sure sign that the Ollama server is not running. Follow step 1 above.

## Issue 2: The SuperDesign sidebar is empty or not showing up.

1.  **Check if the Extension is Enabled**: 
    -   Go to the Extensions view in VS Code.
    -   Find "Superdesign Freedom Edition" in the list.
    -   Make sure it is enabled. If it says "Enable," click it.

2.  **Reload VS Code**: Sometimes a simple reload fixes everything.
    -   Press `Ctrl + Shift + P` and type `Developer: Reload Window`.

## Issue 3: I generated a design, but it’s not appearing in the Canvas.

1.  **Refresh the Canvas**: The canvas might not have updated automatically.
    -   Close the canvas tab and reopen it (`Ctrl + Shift + P` -> `Superdesign: Open Canvas View`).

2.  **Check the `.superdesign` Folder**: 
    -   Look in your project’s `.superdesign/design_iterations` folder. Do you see new HTML or SVG files there?
    -   If you see files, the generation worked, but the canvas is having trouble displaying them. A reload of VS Code should fix this.
    -   If you don’t see any new files, the generation itself failed. See Issue 1.

## Issue 4: I get an error about "Missing API Key" when I try to generate.

This means you haven’t configured the selected AI provider yet.

-   **If you selected Gemini**: You need to provide a Gemini API key. See the installation guide for how to get one and configure it.
-   **If you selected Claude**: You need to provide an Anthropic API key.
-   **If you selected Ollama**: This error shouldn’t happen, as Ollama doesn’t use an API key. Make sure you have `ollama` selected as your `llmProvider` in the settings.

## General Tips for a Smooth Experience

-   **Keep Ollama Updated**: If you use Ollama, occasionally run `ollama pull <model_name>` to get the latest version of your models.
-   **Restart VS Code**: When in doubt, a quick restart of VS Code can solve many strange issues.
-   **Check for Typos**: When entering API keys, model names, or endpoints, a small typo can cause things to fail. Double-check your spelling.

If you’ve tried all of the above and are still having trouble, please provide the error message you are seeing. You can find detailed error logs by opening the **Output** panel in VS Code (`View > Output`) and selecting "Superdesign" from the dropdown on the right.
