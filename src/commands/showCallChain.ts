import * as vscode from 'vscode';
import { PythonBridge } from '../analyzer/pythonBridge';
import { CallChainCache } from '../analyzer/callChainCache';
import { CallChainPanel } from '../providers/callChainPanel';

export function registerShowCallChainCommand(
    context: vscode.ExtensionContext,
    getBridge: () => Promise<PythonBridge>,
    cache: CallChainCache
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
            if (!file.endsWith('.py')) {
                vscode.window.showWarningMessage('This command only works with Python files.');
                return;
            }

            const position = editor?.selection.active;
            const targetLine = line ?? (position ? position.line + 1 : 1);
            const targetCol = col ?? (position ? position.character : 0);

            // Persist unsaved edits to the analyzed file and drop its stale cache.
            const activeDoc = editor?.document;
            if (activeDoc && activeDoc.uri.fsPath === file && activeDoc.isDirty) {
                await activeDoc.save();
                cache.invalidateFile(file);
            }

            const panel = CallChainPanel.createOrShow(context.extensionUri);

            // Cache hit — render instantly, no Python round-trip.
            const cached = cache.get(file, targetLine);
            if (cached) {
                panel.postUpdate(cached);
                panel.postHistory(cache.getHistory());
                return;
            }

            try {
                const bridge = await getBridge();
                await bridge.ensureRunning();
                panel.postLoading();

                const result = await bridge.analyze(file, targetLine, targetCol);
                cache.set(file, targetLine, targetCol, result);
                panel.postUpdate(result);
                panel.postHistory(cache.getHistory());
            } catch (err: any) {
                vscode.window.showErrorMessage(
                    `Exposure Func: ${err.message || 'Analysis failed'}`
                );
            }
        }
    );
}
