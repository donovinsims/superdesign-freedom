import * as vscode from 'vscode';
import { WebviewContext } from '../types/context';

export function generateWebviewHtml(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    context: WebviewContext
): string {
    const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js')
    );

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource};">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Superdesign Chat</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                font-weight: var(--vscode-font-weight);
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
                margin: 0;
                padding: ${context.layout === 'sidebar' ? '8px' : '16px'};
                height: 100vh;
                overflow: hidden;
            }
        </style>
    </head>
    <body>
        <div id="root"></div>
        <script>
            // Initialize context for React app
            window.__WEBVIEW_CONTEXT__ = ${JSON.stringify(context)};
        </script>
        <script src="${scriptUri}"></script>
    </body>
    </html>`;
}

 