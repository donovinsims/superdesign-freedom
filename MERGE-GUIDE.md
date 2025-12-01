# 🔄 SuperDesign Freedom Edition - Merge Guide

This guide explains how to get new features from the original SuperDesign project and add them to your Freedom Edition. This process is called "merging."

**Why would you do this?** The original developers might add cool new features, fix bugs, or improve performance. By merging their updates, you get the best of both worlds: their new features and your unlimited AI freedom.

**Disclaimer:** This is a more advanced task. It involves using `git`, a tool for managing code. I’ll explain the commands, but it’s important to follow them carefully. **Always make a backup of your code before you start!**

## 1. What You Need

- **Git**: A command-line tool. It’s usually pre-installed on macOS and Linux. For Windows, you can get it from [git-scm.com](https://git-scm.com/).
- **A Terminal**: Also called a Command Prompt (Windows) or Terminal (macOS).
- The source code for your SuperDesign Freedom Edition.

## 2. The One-Time Setup

You only need to do this once. We’re going to tell your local code repository where the original SuperDesign project lives.

1.  **Open a Terminal**.
2.  **Navigate to the Project Folder**: Use the `cd` (change directory) command to go into your `superdesign` source code folder. For example:

    ```bash
    cd path/to/your/superdesign
    ```

3.  **Add the Original Repo as a Remote**: This creates a bookmark to the original project, which we’ll call `upstream`. Copy and paste this exact command and press Enter:

    ```bash
    git remote add upstream https://github.com/donovinsims/superdesign.git
    ```

4.  **Verify It Worked**: Run this command:

    ```bash
    git remote -v
    ```

    You should see both `origin` (your fork) and `upstream` (the original) listed.

## 3. How to Merge Updates (The Main Process)

Do this whenever you want to check for and merge new updates from the original project.

### Step 1: Fetch the Latest Updates

This downloads all the new changes from the original project but doesn’t apply them yet.

1.  Make sure you are in your `superdesign` folder in the terminal.
2.  Run this command:

    ```bash
    git fetch upstream
    ```

### Step 2: Merge the Changes

This is where you’ll try to apply the updates to your code.

1.  Run this command:

    ```bash
    git merge upstream/main --allow-unrelated-histories
    ```

### Step 3: Handle Conflicts (The Tricky Part)

Sometimes, the original developers will have changed the *same lines of code* that I changed for you. This is called a **merge conflict**. Git will stop and ask you to resolve it.

**How to know if you have a conflict:**

The terminal will say something like `Automatic merge failed; fix conflicts and then commit the result.`

**How to fix conflicts:**

1.  **Open the Project in VS Code**: VS Code has a great tool for this.
2.  **Find the Conflicted Files**: In the Source Control view (the icon with three connected dots on the left), you will see a list of files under "Merge Changes."
3.  **Resolve the Conflicts**: Click on a conflicted file. VS Code will show you the changes side-by-side:
    -   `Incoming Change`: This is the new code from the original project.
    -   `Current Change`: This is the code in your Freedom Edition.

    VS Code will show you special markers in the code:

    ```
    <<<<<<< HEAD
    // Your current code is here
    =======
    // The incoming code from upstream is here
    >>>>>>> upstream/main
    ```

    You have to **decide which code to keep**. For this project, the rule is simple:

    > **If a conflict is in a file related to AI providers, API keys, or configuration, ALWAYS keep YOUR version.**

    VS Code gives you buttons to make this easy:
    -   **Accept Current Change**: Keeps your Freedom Edition code.
    -   **Accept Incoming Change**: Takes the new code from the original.
    -   **Accept Both Changes**: Tries to keep both (rarely needed).

    For this project, you will almost always want to **"Accept Current Change"** for files like:
    -   `src/providers/llmProviderFactory.ts`
    -   `src/providers/geminiProvider.ts`
    -   `src/providers/ollamaProvider.ts`
    -   `package.json` (be careful with this one, you may need to manually combine changes)
    -   `src/extension.ts`

4.  **Save the File**: Once you’ve resolved the conflicts in a file, save it.
5.  **Stage the Changes**: After fixing all conflicts, go back to the Source Control view. Hover over the file you fixed and click the `+` icon to "Stage Changes."

### Step 4: Complete the Merge

Once you have staged all the resolved conflicts:

1.  Go back to the terminal.
2.  Run this command to finalize the merge:

    ```bash
    git commit
    ```

3.  A text editor might open asking for a commit message. You can just type `Merge upstream changes` and then save and close the file.

### Step 5: Rebuild the Extension

After merging, you need to rebuild the extension to apply the changes.

1.  In the terminal, run:

    ```bash
    npm install
    ```

2.  Then run:

    ```bash
    vsce package --allow-star-activation
    ```

3.  This will create a new `.vsix` file with the merged updates. Install this new file in VS Code.

## What if it Fails?

If you get stuck, you can always abort the merge and go back to how things were before you started.

In your terminal, run this command:

```bash
git merge --abort
```

This will cancel the merge, and your files will be safe. You can then try again or ask for help.
