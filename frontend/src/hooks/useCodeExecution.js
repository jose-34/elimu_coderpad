import { useCallback, useRef, useState } from 'react';

const TIMEOUT_MS = 15000;

export function useCodeExecution() {
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [errors, setErrors] = useState(null);
  const [status, setStatus] = useState('');
  const workerRef = useRef(null);
  const requestIdRef = useRef(0);

  const runPython = useCallback((code) => {
    setRunning(true);
    setOutput('');
    setErrors(null);
    setStatus('Loading Python runtime…');

    if (!workerRef.current) {
      workerRef.current = new Worker('/pyodideWorker.js');
    }
    const worker = workerRef.current;
    const requestId = ++requestIdRef.current;
    let timeout = null;

    function finish() {
      if (timeout) clearTimeout(timeout);
      setRunning(false);
      setStatus('');
    }

    worker.onerror = (e) => {
      finish();
      workerRef.current = null;
      setErrors(`Could not start the Python runtime: ${e.message || 'worker failed to load'}`);
    };

    worker.onmessage = (event) => {
      const data = event.data;
      if (data.requestId !== requestId) return;

      if (data.type === 'ready') {
        // Only now does the 15s execution budget start — the Pyodide download
        // that precedes it can legitimately take longer than that.
        setStatus('Running…');
        timeout = setTimeout(() => {
          worker.terminate();
          workerRef.current = null;
          setRunning(false);
          setStatus('');
          setErrors(`Execution timed out after ${TIMEOUT_MS / 1000}s`);
        }, TIMEOUT_MS);
        return;
      }

      finish();
      setOutput(data.output || '');
      setErrors(data.success ? null : data.error);
    };

    worker.postMessage({ code, requestId });
  }, []);

  const runJavaScript = useCallback((code) => {
    setRunning(true);
    setOutput('');
    setErrors(null);

    const iframe = document.createElement('iframe');
    iframe.sandbox = 'allow-scripts';
    iframe.style.display = 'none';

    let settled = false;

    function cleanup() {
      window.removeEventListener('message', onMessage);
      iframe.remove();
    }

    function onMessage(event) {
      if (event.source !== iframe.contentWindow) return;
      settled = true;
      clearTimeout(timeout);
      setRunning(false);
      setOutput((event.data.logs || []).join('\n'));
      setErrors(event.data.error || null);
      cleanup();
    }

    const timeout = setTimeout(() => {
      if (settled) return;
      setRunning(false);
      setErrors(`Execution timed out after ${TIMEOUT_MS / 1000}s`);
      cleanup();
    }, TIMEOUT_MS);

    window.addEventListener('message', onMessage);

    const srcdoc = `<script>
      const logs = [];
      const push = (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
      console.log = push; console.info = push; console.warn = push; console.error = push;
      let error = null;
      try {
        ${code}
      } catch (e) {
        error = e.message;
      }
      parent.postMessage({ logs, error }, '*');
    </script>`;

    iframe.srcdoc = srcdoc;
    document.body.appendChild(iframe);
  }, []);

  return { running, output, errors, status, runPython, runJavaScript };
}
