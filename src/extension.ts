import * as vscode from 'vscode';
import * as path from 'path';
import { PythonBridge } from './analyzer/pythonBridge';
import { getPythonPath, validatePython } from './utils/pythonEnv';
import { ensureDependencies } from './utils/depInstaller';
import { registerShowCallChainCommand } from './commands/showCallChain';
import { CallChainCodeLensProvider } from './providers/codeLensProvider';
import { CallChainPanel } from './providers/callChainPanel';

let bridge: PythonBridge | null = null;

export async function activate(context: vscode.ExtensionContext) {
    const getBridge = async (): Promise<PythonBridge> => {
        if (bridge) {
            return bridge;
        }

        const pythonPath = await getPythonPath();
        const isValid = await validatePython(pythonPath);
        if (!isValid) {
            throw new Error(
                `Python not found at "${pythonPath}". Configure exposureFunc.pythonPath or install Python.`
            );
        }

        await ensureDependencies(pythonPath, context.extensionPath);

        const workspaceRoot =
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

        bridge = new PythonBridge(pythonPath, context.extensionPath, workspaceRoot);
        await bridge.start();
        return bridge;
    };

    const commandDisposable = registerShowCallChainCommand(context, getBridge);
    context.subscriptions.push(commandDisposable);

    const codeLensProvider = new CallChainCodeLensProvider();
    const codeLensDisposable = vscode.languages.registerCodeLensProvider(
        { language: 'python', scheme: 'file' },
        codeLensProvider
    );
    context.subscriptions.push(codeLensDisposable);

    CallChainPanel.extensionUri = context.extensionUri;
}

export function deactivate() {
    if (bridge) {
        bridge.dispose();
        bridge = null;
    }
}
