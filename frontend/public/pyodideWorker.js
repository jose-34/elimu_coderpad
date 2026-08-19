// Runs candidate Python in a dedicated worker (Pyodide, loaded from the CDN)
// so a hung/looping submission can be killed with worker.terminate()
// from the main thread instead of freezing the whole tab.
const PYODIDE_VERSION = 'v0.26.2';

let pyodideReadyPromise = null;

function loadRuntime() {
  if (!pyodideReadyPromise) {
    pyodideReadyPromise = (async () => {
      importScripts(`https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/pyodide.js`);
      return loadPyodide();
    })();
  }
  return pyodideReadyPromise;
}

self.onmessage = async (event) => {
  const { code, requestId } = event.data;

  let pyodide;
  try {
    pyodide = await loadRuntime();
  } catch (err) {
    // Reset so a later attempt can retry once connectivity is back.
    pyodideReadyPromise = null;
    self.postMessage({
      requestId,
      type: 'result',
      success: false,
      output: '',
      error: `Could not load the Python runtime (${String(err)}). Check your network connection.`,
    });
    return;
  }

  // Runtime is up; the main thread starts its execution timeout from here so
  // the one-off multi-megabyte Pyodide download is not counted against it.
  self.postMessage({ requestId, type: 'ready' });

  let output = '';
  pyodide.setStdout({ batched: (s) => (output += s + '\n') });
  pyodide.setStderr({ batched: (s) => (output += s + '\n') });

  try {
    const result = await pyodide.runPythonAsync(code);
    if (result !== undefined && result !== null) {
      output += String(result) + '\n';
    }
    self.postMessage({ requestId, type: 'result', success: true, output });
  } catch (err) {
    self.postMessage({ requestId, type: 'result', success: false, output, error: String(err) });
  }
};
