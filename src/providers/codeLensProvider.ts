import * as vscode from 'vscode';

const FUNC_PATTERN = /^(\s*)(async\s+)?def\s+(\w+)/;

export class CallChainCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

    provideCodeLenses(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.CodeLens[] {
        if (document.languageId !== 'python') {
            return [];
        }

        const lenses: vscode.CodeLens[] = [];

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const match = FUNC_PATTERN.exec(line.text);
            if (match) {
                const funcName = match[3];
                const range = new vscode.Range(i, 0, i, line.text.length);
                lenses.push(
                    new vscode.CodeLens(range, {
                        title: `$(symbol-method) Show Call Chain`,
                        command: 'exposure_func.showCallChain',
                        arguments: [
                            document.uri,
                            i + 1,
                            (match[1]?.length || 0) + (match[2]?.length || 0) + 4,
                        ],
                    })
                );
            }
        }

        return lenses;
    }
}
