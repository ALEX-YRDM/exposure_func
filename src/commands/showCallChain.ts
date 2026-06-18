import * as vscode from 'vscode';
import { PythonBridge } from '../analyzer/pythonBridge';
import { CallChainPanel } from '../providers/callChainPanel';

export function registerShowCallChainCommand(
    context: vscode.ExtensionContext,
    getBridge: () => Promise<PythonBridge>
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'exposure_func.showCallChain',
        async (fileUri?: vscode.Uri, line?: number, col?: number) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor && !fileUri) {
                vscode.window.showWarningMessage('No active Python file.');
                return;
            }

            const file = fileUri?.fsPath || editor!.document.uri.fsPath;
            const position = editor?.selection.active;
            const targetLine = line ?? (position ? position.line + 1 : 1);
            const targetCol = col ?? (position ? position.character : 0);

            if (!file.endsWith('.py')) {
                vscode.window.showWarningMessage('This command only works with Python files.');
                return;
            }

            const document = editor?.document || await vscode.workspace.openTextDocument(file);
            if (document.isDirty) {
                await document.save();
            }

            try {
                const bridge = await getBridge();
                await bridge.ensureRunning();

                const panel = CallChainPanel.createOrShow(context.extensionUri);
                panel.postLoading();

                const result = await bridge.analyze(file, targetLine, targetCol);
                panel.postUpdate(result);
            } catch (err: any) {
                vscode.window.showErrorMessage(
                    `Exposure Func: ${err.message || 'Analysis failed'}`
                );
            }
        }
    );
}
