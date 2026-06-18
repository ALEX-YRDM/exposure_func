import * as vscode from 'vscode';
import * as path from 'path';
import { ChildProcess, spawn } from 'child_process';
import { createInterface, Interface } from 'readline';

interface PendingRequest {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    timer: NodeJS.Timeout;
}

export class PythonBridge {
    private process: ChildProcess | null = null;
    private readline: Interface | null = null;
    private pendingRequests = new Map<number, PendingRequest>();
    private nextId = 1;
    private restartCount = 0;
    private readonly maxRestarts = 3;
    private readonly requestTimeout = 30000;

    constructor(
        private pythonPath: string,
        private extensionPath: string,
        private projectRoot: string
    ) {}

    async start(): Promise<void> {
        const scriptPath = path.join(this.extensionPath, 'python', 'analyzer', 'main.py');

        this.process = spawn(this.pythonPath, ['-u', scriptPath], {
            cwd: this.projectRoot,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, PYTHONUNBUFFERED: '1' },
        });

        this.readline = createInterface({ input: this.process.stdout! });
        this.readline.on('line', (line) => this.handleResponse(line));

        this.process.stderr?.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg) {
                console.error('[exposure_func python]', msg);
            }
        });

        this.process.on('exit', (code) => {
            this.rejectAllPending(`Python process exited with code ${code}`);
            this.process = null;
            this.readline = null;
        });

        await this.ping();
    }

    async analyze(file: string, line: number, col: number): Promise<any> {
        return this.sendRequest('analyze', {
            file,
            line,
            col,
            project_root: this.projectRoot,
            python_path: this.pythonPath,
        });
    }

    async expandNode(nodeId: string): Promise<any> {
        return this.sendRequest('expand', {
            node_id: nodeId,
            project_root: this.projectRoot,
            python_path: this.pythonPath,
        });
    }

    private async ping(): Promise<void> {
        const result = await this.sendRequest('ping', {});
        if (result.status !== 'ok') {
            throw new Error('Python bridge ping failed');
        }
    }

    private sendRequest(method: string, params: any): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.process || !this.process.stdin) {
                reject(new Error('Python process not running'));
                return;
            }

            const id = this.nextId++;
            const timer = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request ${method} timed out after ${this.requestTimeout}ms`));
            }, this.requestTimeout);

            this.pendingRequests.set(id, { resolve, reject, timer });

            const request = JSON.stringify({
                jsonrpc: '2.0',
                id,
                method,
                params,
            });

            this.process.stdin.write(request + '\n');
        });
    }

    private handleResponse(line: string): void {
        let response: any;
        try {
            response = JSON.parse(line);
        } catch {
            return;
        }

        const pending = this.pendingRequests.get(response.id);
        if (!pending) {
            return;
        }

        this.pendingRequests.delete(response.id);
        clearTimeout(pending.timer);

        if (response.error) {
            pending.reject(new Error(response.error.message || 'Unknown error'));
        } else {
            pending.resolve(response.result);
        }
    }

    private rejectAllPending(reason: string): void {
        for (const [id, pending] of this.pendingRequests) {
            clearTimeout(pending.timer);
            pending.reject(new Error(reason));
        }
        this.pendingRequests.clear();
    }

    async ensureRunning(): Promise<void> {
        if (this.process && !this.process.killed) {
            return;
        }
        if (this.restartCount >= this.maxRestarts) {
            throw new Error(
                'Python analyzer has crashed too many times. Please reload the window.'
            );
        }
        this.restartCount++;
        await this.start();
    }

    dispose(): void {
        this.rejectAllPending('Bridge disposed');
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
        if (this.readline) {
            this.readline.close();
            this.readline = null;
        }
    }
}
