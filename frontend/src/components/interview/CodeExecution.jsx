import { useCodeExecution } from '../../hooks/useCodeExecution';

export default function CodeExecution({ language, code }) {
  const { running, output, errors, status, runPython, runJavaScript } = useCodeExecution();

  function run() {
    if (language === 'python') runPython(code);
    else if (language === 'javascript') runJavaScript(code);
  }

  const runnable = language === 'python' || language === 'javascript';

  return (
    <div className="flex h-48 flex-col border-t border-slate-700 bg-slate-900 text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-700 px-3 py-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Output {status && <span className="ml-1 normal-case text-slate-500">· {status}</span>}
        </span>
        <button
          onClick={run}
          disabled={!runnable || running}
          className="rounded bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {running ? 'Running…' : 'Run ▶'}
        </button>
      </div>
      <pre className="flex-1 overflow-auto whitespace-pre-wrap px-3 py-2 font-mono text-xs">
        {errors ? <span className="text-red-400">{errors}</span> : output || (
          <span className="text-slate-500">Output will appear here.</span>
        )}
      </pre>
    </div>
  );
}
