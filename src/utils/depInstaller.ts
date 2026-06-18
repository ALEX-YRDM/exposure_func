import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function ensureDependencies(
    pythonPath: string,
    extensionPath: string
): Promise<void> {
    const vendorDir = path.join(extensionPath, 'python', 'vendor');
    const marker = path.join(vendorDir, '.installed');

    // jedi is pre-bundled into the published extension — nothing to install.
    if (fs.existsSync(path.join(vendorDir, 'jedi'))) {
        return;
    }

    if (fs.existsSync(marker)) {
        return;
    }

    if (!fs.existsSync(vendorDir)) {
        fs.mkdirSync(vendorDir, { recursive: true });
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Exposure Func: Installing Python dependencies...',
            cancellable: false,
        },
        async () => {
            const requirementsFile = path.join(extensionPath, 'python', 'requirements.txt');
            const candidates = [pythonPath, 'python3', 'python'];

            for (const py of candidates) {
                try {
                    await execAsync(`"${py}" -m pip --version`);
                    await execAsync(
                        `"${py}" -m pip install -r "${requirementsFile}" --target "${vendorDir}" -q`
                    );
                    fs.writeFileSync(marker, new Date().toISOString());
                    return;
                } catch {
                    continue;
                }
            }

            vscode.window.showErrorMessage(
                `Exposure Func: Failed to install dependencies. None of [${candidates.join(', ')}] have pip available. ` +
                `Run manually: python3 -m pip install jedi --target "${vendorDir}"`
            );
            throw new Error('No Python with pip found');
        }
    );
}
