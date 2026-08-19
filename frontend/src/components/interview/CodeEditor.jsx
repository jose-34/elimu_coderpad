import { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import '../../services/monacoSetup';

const DEBOUNCE_MS = 100;

// Shared code editor: emits local edits over the socket (debounced) and
// applies remote edits without re-triggering onChange (echo guard via
// applyingRemote + isLocalChangeRef, since Monaco's onChange fires on any
// programmatic setValue too).
export default function CodeEditor({ interviewId, language, code, onLocalChange, socket }) {
  const editorRef = useRef(null);
  const debounceRef = useRef(null);
  const applyingRemoteRef = useRef(false);

  useEffect(() => {
    if (!socket) return undefined;

    function handleUpdate({ content }) {
      const editor = editorRef.current;
      if (!editor || content === undefined) return;
      if (editor.getValue() === content) return;

      applyingRemoteRef.current = true;
      const position = editor.getPosition();
      editor.setValue(content);
      if (position) editor.setPosition(position);
      applyingRemoteRef.current = false;
    }

    socket.on('code:update', handleUpdate);
    return () => socket.off('code:update', handleUpdate);
  }, [socket]);

  function handleChange(value) {
    if (applyingRemoteRef.current) return;
    onLocalChange(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      socket?.emit('code:change', { interviewId, content: value, language });
    }, DEBOUNCE_MS);
  }

  return (
    <Editor
      height="100%"
      language={language === 'html' ? 'html' : language}
      theme="vs-dark"
      value={code}
      onMount={(editor) => {
        editorRef.current = editor;
      }}
      onChange={handleChange}
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        automaticLayout: true,
        scrollBeyondLastLine: false,
      }}
    />
  );
}
