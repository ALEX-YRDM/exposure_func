import { useEffect, useCallback, useRef } from 'react';
import { ExtensionMessage, WebviewMessage } from '../types/callChain';

declare function acquireVsCodeApi(): {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
};

let vscodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;

function getVsCodeApi() {
  if (!vscodeApi) {
    vscodeApi = acquireVsCodeApi();
  }
  return vscodeApi;
}

export function useVSCode(onMessage: (msg: ExtensionMessage) => void) {
  const callbackRef = useRef(onMessage);
  callbackRef.current = onMessage;

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      callbackRef.current(event.data as ExtensionMessage);
    };
    window.addEventListener('message', handler);

    getVsCodeApi().postMessage({ type: 'ready' });

    return () => window.removeEventListener('message', handler);
  }, []);

  const postMessage = useCallback((msg: WebviewMessage) => {
    getVsCodeApi().postMessage(msg);
  }, []);

  return { postMessage };
}
