import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function getPythonPath(): Promise<string> {
    const config = vscode.workspace.getConfiguration('exposureFunc');
    const configuredPath = config.get<string>('pythonPath');
    if (configuredPath) {
        return configuredPath;
    }

    const pythonExt = vscode.extensions.getExtension('ms-python.python');
    if (pythonExt) {
        if (!pythonExt.isActive) {
            await pythonExt.activate();
        }
        const api = pythonExt.exports;
        if (api && api.settings) {
            const interpreterPath = api.settings.getExecutionDetails?.(
                vscode.workspace.workspaceFolders?.[0]?.uri
            )?.execCommand?.[0];
            if (interpreterPath) {
                return interpreterPath;
            }
        }
    }

    const pythonConfig = vscode.workspace.getConfiguration('python');
    const defaultPath = pythonConfig.get<string>('defaultInterpreterPath');
    if (defaultPath && defaultPath !== 'python') {
        return defaultPath;
    }

    const legacyPath = pythonConfig.get<string>('pythonPath');
    if (legacyPath && legacyPath !== 'python') {
        return legacyPath;
    }

    return 'python3';
}

export async function validatePython(pythonPath: string): Promise<boolean> {
    try {
        await execAsync(`"${pythonPath}" --version`);
        return true;
    } catch {
        return false;
    }
}
