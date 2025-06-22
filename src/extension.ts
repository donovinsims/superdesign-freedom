// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('Superdesign extension is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const helloWorldDisposable = vscode.commands.registerCommand('superdesign.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from superdesign!');
	});

	// Register new design panel command
    const openPanelDisposable = vscode.commands.registerCommand('superdesign.openDesignPanel', () => {
        SuperdesignPanel.createOrShow(context.extensionUri);
    });

    // Register new canvas command
    const openCanvasDisposable = vscode.commands.registerCommand('superdesign.openCanvas', () => {
        SuperdesignCanvasPanel.createOrShow(context.extensionUri);
    });

	context.subscriptions.push(helloWorldDisposable, openPanelDisposable, openCanvasDisposable);
}

class SuperdesignPanel {
    public static currentPanel: SuperdesignPanel | undefined;
    public static readonly viewType = 'superdesignPanel';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor?.viewColumn;

        if (SuperdesignPanel.currentPanel) {
            SuperdesignPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            SuperdesignPanel.viewType,
            'Superdesign',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')]
            }
        );

        SuperdesignPanel.currentPanel = new SuperdesignPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'exportDesign':
                        vscode.window.showInformationMessage('Design system exported!');
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public dispose() {
        SuperdesignPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js')
        );

        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Superdesign</title>
            </head>
            <body>
                <div id="root"></div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}

class SuperdesignCanvasPanel {
    public static currentPanel: SuperdesignCanvasPanel | undefined;
    public static readonly viewType = 'superdesignCanvasPanel';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _fileWatcher: vscode.FileSystemWatcher | undefined;

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor?.viewColumn;

        if (SuperdesignCanvasPanel.currentPanel) {
            SuperdesignCanvasPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            SuperdesignCanvasPanel.viewType,
            'Superdesign Canvas',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')]
            }
        );

        SuperdesignCanvasPanel.currentPanel = new SuperdesignCanvasPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._setupFileWatcher();

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'loadDesignFiles':
                        this._loadDesignFiles();
                        break;
                    case 'selectFrame':
                        console.log('Frame selected:', message.data?.fileName);
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public dispose() {
        SuperdesignCanvasPanel.currentPanel = undefined;
        
        // Dispose of file watcher
        if (this._fileWatcher) {
            this._fileWatcher.dispose();
            this._fileWatcher = undefined;
        }
        
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _setupFileWatcher() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        // Watch for changes in .superdesign/design_files/*.html
        const pattern = new vscode.RelativePattern(
            workspaceFolder, 
            '.superdesign/ui_iterations/**/*.html'
        );

        this._fileWatcher = vscode.workspace.createFileSystemWatcher(
            pattern,
            false, // Don't ignore create events
            false, // Don't ignore change events  
            false  // Don't ignore delete events
        );

        // Handle file creation
        this._fileWatcher.onDidCreate((uri) => {
            console.log('Design file created:', uri.fsPath);
            this._panel.webview.postMessage({
                command: 'fileChanged',
                data: {
                    fileName: uri.fsPath.split('/').pop() || '',
                    changeType: 'created'
                }
            });
        });

        // Handle file modification
        this._fileWatcher.onDidChange((uri) => {
            console.log('Design file modified:', uri.fsPath);
            this._panel.webview.postMessage({
                command: 'fileChanged',
                data: {
                    fileName: uri.fsPath.split('/').pop() || '',
                    changeType: 'modified'
                }
            });
        });

        // Handle file deletion
        this._fileWatcher.onDidDelete((uri) => {
            console.log('Design file deleted:', uri.fsPath);
            this._panel.webview.postMessage({
                command: 'fileChanged',
                data: {
                    fileName: uri.fsPath.split('/').pop() || '',
                    changeType: 'deleted'
                }
            });
        });
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js')
        );

        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; frame-src ${webview.cspSource};">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Superdesign Canvas</title>
            </head>
            <body>
                <div id="root" data-view="canvas" data-nonce="${nonce}"></div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    private async _loadDesignFiles() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            this._panel.webview.postMessage({
                command: 'error',
                data: { error: 'No workspace folder found. Please open a workspace first.' }
            });
            return;
        }

        try {
            const designFolder = vscode.Uri.joinPath(workspaceFolder.uri, '.superdesign', 'ui_iterations');
            
            // Check if the design_files folder exists
            try {
                await vscode.workspace.fs.stat(designFolder);
            } catch (error) {
                // Folder doesn't exist, create it
                try {
                    await vscode.workspace.fs.createDirectory(designFolder);
                    console.log('Created .superdesign/ui_iterations directory');
                } catch (createError) {
                    this._panel.webview.postMessage({
                        command: 'error',
                        data: { error: `Failed to create design_files directory: ${createError}` }
                    });
                    return;
                }
            }

            // Read all files in the directory
            const files = await vscode.workspace.fs.readDirectory(designFolder);
            const htmlFiles = files.filter(([name, type]) => 
                type === vscode.FileType.File && name.toLowerCase().endsWith('.html')
            );

            const designFiles = await Promise.all(
                htmlFiles.map(async ([fileName, _]) => {
                    const filePath = vscode.Uri.joinPath(designFolder, fileName);
                    
                    try {
                        // Read file stats and content
                        const [stat, content] = await Promise.all([
                            vscode.workspace.fs.stat(filePath),
                            vscode.workspace.fs.readFile(filePath)
                        ]);

                        return {
                            name: fileName,
                            path: filePath.fsPath,
                            content: Buffer.from(content).toString('utf8'),
                            size: stat.size,
                            modified: new Date(stat.mtime)
                        };
                    } catch (fileError) {
                        console.error(`Failed to read file ${fileName}:`, fileError);
                        return null;
                    }
                })
            );

            // Filter out any failed file reads
            const validFiles = designFiles.filter(file => file !== null);

            console.log(`Loaded ${validFiles.length} HTML design files`);
            
            this._panel.webview.postMessage({
                command: 'designFilesLoaded',
                data: { files: validFiles }
            });

        } catch (error) {
            console.error('Error loading design files:', error);
            this._panel.webview.postMessage({
                command: 'error',
                data: { error: `Failed to load design files: ${error}` }
            });
        }
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}


// This method is called when your extension is deactivated
export function deactivate() {}
