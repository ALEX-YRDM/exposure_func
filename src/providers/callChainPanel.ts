import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class CallChainPanel {
    public static currentPanel: CallChainPanel | undefined;
    public static extensionUri: vscode.Uri;

    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this.panel = panel;

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.html = this.getHtmlContent(extensionUri);

        this.panel.webview.onDidReceiveMessage(
            (message) => this.handleMessage(message),
            null,
            this.disposables
        );
    }

    public static createOrShow(extensionUri: vscode.Uri): CallChainPanel {
        const column = vscode.ViewColumn.Beside;

        if (CallChainPanel.currentPanel) {
            CallChainPanel.currentPanel.panel.reveal(column);
            return CallChainPanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            'exposureFuncCallChain',
            'Call Chain',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'dist', 'webview'),
                ],
            }
        );

        CallChainPanel.currentPanel = new CallChainPanel(panel, extensionUri);
        return CallChainPanel.currentPanel;
    }

    public postUpdate(data: any): void {
        this.panel.webview.postMessage({ type: 'update', data });
    }

    public postLoading(): void {
        this.panel.webview.postMessage({ type: 'loading' });
    }

    public postError(message: string): void {
        this.panel.webview.postMessage({ type: 'error', message });
    }

    private async handleMessage(message: any): Promise<void> {
        switch (message.type) {
            case 'navigateTo': {
                const { file, line } = message;
                if (file && line) {
                    const doc = await vscode.workspace.openTextDocument(file);
                    const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
                    const pos = new vscode.Position(line - 1, 0);
                    editor.selection = new vscode.Selection(pos, pos);
                    editor.revealRange(
                        new vscode.Range(pos, pos),
                        vscode.TextEditorRevealType.InCenter
                    );
                }
                break;
            }
            case 'expandNode': {
                // Handled by the command — forward to the bridge
                vscode.commands.executeCommand('exposure_func.expandNode', message.nodeId);
                break;
            }
            case 'exportImage': {
                await this.saveImage(message.format, message.dataUrl);
                break;
            }
            case 'exportError': {
                vscode.window.showErrorMessage(`Exposure Func: Export failed — ${message.message}`);
                break;
            }
            case 'copyToClipboard': {
                if (typeof message.text === 'string') {
                    await vscode.env.clipboard.writeText(message.text);
                    vscode.window.setStatusBarMessage('Exposure Func: Call chain copied to clipboard', 2000);
                }
                break;
            }
            case 'ready': {
                break;
            }
        }
    }

    private async saveImage(format: 'png' | 'svg', dataUrl: string): Promise<void> {
        const buffer = decodeDataUrl(dataUrl, format);
        if (!buffer) {
            vscode.window.showErrorMessage('Exposure Func: Could not decode the exported image.');
            return;
        }

        const defaultName = `call-chain.${format}`;
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
        const defaultUri = workspaceFolder
            ? vscode.Uri.joinPath(workspaceFolder, defaultName)
            : vscode.Uri.file(defaultName);

        const target = await vscode.window.showSaveDialog({
            defaultUri,
            filters: format === 'png' ? { Images: ['png'] } : { Images: ['svg'] },
        });

        if (!target) {
            return; // user cancelled
        }

        try {
            await vscode.workspace.fs.writeFile(target, buffer);
            const openAction = 'Open';
            const choice = await vscode.window.showInformationMessage(
                `Exposure Func: Saved ${format.toUpperCase()} to ${target.fsPath}`,
                openAction
            );
            if (choice === openAction) {
                vscode.commands.executeCommand('vscode.open', target);
            }
        } catch (err: any) {
            vscode.window.showErrorMessage(
                `Exposure Func: Failed to write image — ${err.message || err}`
            );
        }
    }

    private getHtmlContent(extensionUri: vscode.Uri): string {
        const webviewUri = this.panel.webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'dist', 'webview')
        );

        const distPath = path.join(extensionUri.fsPath, 'dist', 'webview');
        const indexHtmlPath = path.join(distPath, 'index.html');

        if (fs.existsSync(indexHtmlPath)) {
            let html = fs.readFileSync(indexHtmlPath, 'utf-8');
            html = html.replace(/(href|src)="\.?\/?assets\//g, `$1="${webviewUri}/assets/`);
            html = html.replace(
                '<head>',
                `<head><base href="${webviewUri}/">`
            );
            return html;
        }

        const nonce = getNonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' ${this.panel.webview.cspSource}; style-src 'unsafe-inline' ${this.panel.webview.cspSource};">
    <title>Call Chain</title>
</head>
<body>
    <div id="root">
        <p style="padding: 20px; color: var(--vscode-foreground);">
            Webview assets not found. Please build the webview: <code>cd webview && npm run build</code>
        </p>
    </div>
    <script nonce="${nonce}" src="${webviewUri}/assets/index.js"></script>
</body>
</html>`;
    }

    private dispose(): void {
        CallChainPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const d = this.disposables.pop();
            if (d) {
                d.dispose();
            }
        }
    }
}

function getNonce(): string {
    let text = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
}

function decodeDataUrl(dataUrl: string, format: 'png' | 'svg'): Buffer | null {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) {
        return null;
    }
    const meta = dataUrl.slice(0, commaIdx);
    const payload = dataUrl.slice(commaIdx + 1);

    if (meta.includes(';base64')) {
        return Buffer.from(payload, 'base64');
    }
    // html-to-image's toSvg returns a URI-encoded data URL.
    const text = decodeURIComponent(payload);
    return Buffer.from(text, 'utf-8');
}
