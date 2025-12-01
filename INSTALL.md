# 🚀 SuperDesign Freedom Edition - Installation Guide

Welcome! This guide will walk you through installing and configuring your new, unlimited AI design tool for VS Code. It’s written for beginners, so don’t worry if you’ve never done this before. We’ll go step-by-step.

## 1. What You Need

- **Visual Studio Code (VS Code)**: A free code editor. If you don’t have it, [download it here](https://code.visualstudio.com/).
- The `superdesign-freedom-1.0.0.vsix` file I created for you.

## 2. How to Install the Extension

You can’t install this from the official marketplace. You have to install the `.vsix` file directly. Here’s how:

1.  **Open VS Code**.
2.  Go to the **Extensions** view by clicking the icon on the left sidebar (it looks like four squares).
3.  Click the **three dots (...)** at the top-right of the Extensions view.
4.  Select **"Install from VSIX..."** from the dropdown menu.

    ![Install from VSIX](https://code.visualstudio.com/assets/docs/editor/extension-marketplace/install-from-vsix.png)

5.  A file explorer window will open. **Find and select the `superdesign-freedom-1.0.0.vsix` file** you downloaded.
6.  Click **Install**.
7.  After a moment, you’ll see a notification in the bottom-right corner saying the installation was successful. You may be prompted to reload VS Code - please do so.

That’s it! The extension is now installed.

## 3. Choose Your AI Provider

This version of SuperDesign lets you choose your AI. You have three main options:

- **Google Gemini**: Free and powerful, with a generous daily limit.
- **Ollama**: 100% free and unlimited, runs locally on your computer.
- **Claude**: The original provider (requires a paid API key).

Here’s how to set your provider:

1.  In VS Code, open **Settings** (File > Preferences > Settings, or `Ctrl + ,`).
2.  In the search bar, type `superdesign.llmProvider`.
3.  You’ll see a dropdown menu. **Select the provider you want to use** (e.g., `gemini` or `ollama`).

Now, let’s configure the provider you chose.

## 4. Option A: Configure Google Gemini (Recommended)

This is a great option because it’s free, fast, and gives you 1,500 requests per day.

### Step 1: Get Your Free Gemini API Key

1.  Go to the Google AI Studio website: **[https://ai.google.dev](https://ai.google.dev)**
2.  Click on **"Get API key in Google AI Studio"**.
3.  You may need to sign in with your Google account.
4.  Once in the studio, click the **"Get API key"** button on the left menu.
5.  Click **"Create API key in new project"**.
6.  A new key will be generated for you. **Copy this key immediately** and save it somewhere safe, like a password manager. You won’t be able to see it again.

### Step 2: Add the API Key to VS Code

1.  In VS Code, press `Ctrl + Shift + P` to open the Command Palette.
2.  Type `Superdesign: Configure Gemini API Key` and press Enter.
3.  A box will appear at the top. **Paste your Gemini API key** into the box and press Enter.
4.  You’ll see a confirmation message: "✅ Gemini API key configured successfully!"

### Step 3: Choose Your Gemini Model (Optional)

1.  Go back to VS Code Settings (`Ctrl + ,`).
2.  Search for `superdesign.geminiModel`.
3.  You can choose between `gemini-1.5-pro` (more powerful) or `gemini-1.5-flash` (faster). The default is great to start with.

**You’re all set!** You can now start using SuperDesign with Gemini.

## 5. Option B: Configure Ollama (For Unlimited Local Use)

Ollama runs AI models directly on your computer. It’s completely free, private, and unlimited. This is for users who want maximum control.

### Step 1: Install Ollama

1.  Go to the Ollama website: **[https://ollama.ai](https://ollama.ai)**
2.  Click the **Download** button and choose your operating system (macOS, Windows, or Linux).
3.  Run the installer you downloaded. It’s a standard installation process.

### Step 2: Start the Ollama Server

Ollama needs to be running in the background for the extension to work.

1.  Open your computer’s terminal (On Windows, search for "Terminal" or "Command Prompt"; on macOS, search for "Terminal").
2.  Type the following command and press Enter:

    ```bash
    ollama serve
    ```

3.  Leave this terminal window open. It’s now running the server.

### Step 3: Pull an AI Model

You need to download a model for Ollama to use. `llama3.2` is a great choice.

1.  Open a **new** terminal window.
2.  Type the following command and press Enter:

    ```bash
    ollama pull llama3.2
    ```

3.  This will download the model. It might take a few minutes.

### Step 4: Configure Ollama in VS Code

1.  In VS Code, press `Ctrl + Shift + P` to open the Command Palette.
2.  Type `Superdesign: Configure Ollama Settings` and press Enter.
3.  A box will ask for the **endpoint**. The default `http://localhost:11434` is correct, so just press Enter.
4.  Another box will ask for the **model**. Type `llama3.2` and press Enter.
5.  You’ll see a confirmation message.

**You’re all set!** You can now use SuperDesign with your own local AI.

## 6. How to Use SuperDesign

Now for the fun part!

1.  Open the **SuperDesign sidebar** in VS Code (click the icon on the left).
2.  In the chat box, type a prompt describing the UI you want to create. For example:

    > "Design a modern login screen for a coffee shop app. It should have a dark theme with brown and gold accents."

3.  Press Enter and watch the AI generate designs for you!
4.  Click the **"Open Canvas View"** icon (looks like a window) at the top of the sidebar to see your designs visually.

Enjoy your new, unlimited AI design powers!
