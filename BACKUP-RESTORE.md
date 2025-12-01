# 💾 SuperDesign Freedom Edition - Backup & Restore Guide

This guide will show you how to back up your valuable designs and settings, and how to restore them if you move to a new computer or something goes wrong.

## 1. What Should You Back Up?

There are two main things you need to back up:

1.  **Your Designs**: All the UI mockups, components, and wireframes you generate.
2.  **Your Settings**: Your API keys and provider choices.

## 2. How to Back Up Your Designs

All your designs are stored locally on your computer in a special folder named `.superdesign`.

### Step 1: Find the `.superdesign` Folder

This folder is located inside your main project or workspace folder. A "workspace" is the main folder you have opened in VS Code.

1.  Open VS Code.
2.  Open the project folder where you’ve been generating your designs.
3.  In the Explorer view on the left, you should see a folder named **`.superdesign`**. (If you don’t see it, it might be hidden. In the Explorer, click the three dots `...` and make sure you don’t have any filters hiding folders that start with a dot).

### Step 2: Copy the Folder

1.  Right-click on the `.superdesign` folder in the VS Code Explorer.
2.  Select **"Reveal in File Explorer"** (on Windows) or **"Reveal in Finder"** (on macOS).
3.  This will open your computer’s file manager directly to that folder.
4.  **Copy the entire `.superdesign` folder** to a safe location, such as:
    -   A USB drive
    -   A cloud storage service like Google Drive, Dropbox, or OneDrive
    -   An external hard drive

**That’s it! Your designs are now backed up.** You should do this regularly, especially after generating designs you want to keep.

## 3. How to Back Up Your Settings

Your API keys and other extension settings are stored in a VS Code settings file.

### Step 1: Find Your `settings.json` File

1.  In VS Code, open the Command Palette (`Ctrl + Shift + P`).
2.  Type `Preferences: Open User Settings (JSON)` and press Enter.
3.  This will open a file named `settings.json`.

### Step 2: Copy Your SuperDesign Settings

Inside this file, look for all the lines that start with `"superdesign.` They will look something like this:

```json
{
    "workbench.colorTheme": "Default Dark+",
    "superdesign.llmProvider": "gemini",
    "superdesign.geminiApiKey": "AIzaSy...",
    "superdesign.ollamaModel": "llama3.2"
}
```

1.  **Copy all the lines that start with `"superdesign.`**
2.  Paste them into a new text file and save it in a secure location (like a password manager or an encrypted note), since it contains your secret API keys.

## 4. How to Restore Your Designs and Settings

Moving to a new computer? Had to reinstall VS Code? Here’s how to get everything back.

### Restoring Your Designs

1.  Open the project folder where you want to restore your designs in VS Code.
2.  Find your backed-up `.superdesign` folder.
3.  **Copy the `.superdesign` folder** from your backup location and **paste it inside your main project folder**.
4.  Restart VS Code. Open the SuperDesign canvas, and your designs should be there.

### Restoring Your Settings

1.  On your new computer or new VS Code installation, open the `settings.json` file again (`Ctrl + Shift + P` -> `Preferences: Open User Settings (JSON)`).
2.  Open the text file where you saved your SuperDesign settings.
3.  **Copy your backed-up settings** (all the lines starting with `"superdesign.`).
4.  **Paste them** into the `settings.json` file.
5.  Save the `settings.json` file.
6.  Restart VS Code.

The extension will now be configured with your API keys and provider choices, just like before.
