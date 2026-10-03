import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import CodeEditor from '../components/interview/CodeEditor';
import CodeExecution from '../components/interview/CodeExecution';
import VideoConference from '../components/interview/VideoConference';

const INTERVIEW_MINUTES = 50;

function SystemCheck({ onReady }) {
  const [name, setName] = useState('');
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 text-center">
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">Welcome to your KEMSAP interview</h1>
      <p className="mb-6 text-slate-500">
        Your camera and microphone will start once you join. Make sure you're in a quiet, well-lit space.
      </p>
      <input
        placeholder="Your full name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
      />
      <button
        disabled={!name.trim()}
        onClick={() => onReady(name.trim())}
        className="w-full rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        Join interview
      </button>
    </div>
  );
}

export default function CandidateJoinPage() {
  const { sessionCode } = useParams();
  const [session, setSession] = useState(null);
  const [guestName, setGuestName] = useState(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [socket, setSocket] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(INTERVIEW_MINUTES * 60);

  useEffect(() => {
    api
      .get(`/interviews/join/${sessionCode}`)
      .then(({ data }) => {
        setSession(data);
        setCode(data.codeContent || '');
        setLanguage(data.language || 'python');
      })
      .catch((err) => {
        setLoadError(
          err.response?.status === 404
            ? 'This interview link is invalid. Please check the link you were sent.'
            : err.response?.data?.error || 'Could not load the interview. Please try again.',
        );
      });
  }, [sessionCode]);

  useEffect(() => {
    if (!guestName || !session) return undefined;
    const s = connectSocket({ guestName, sessionCode });
    s.on('connect', () => s.emit('interview:join', { interviewId: session.interviewId }));
    setSocket(s);
    return () => disconnectSocket();
  }, [guestName, session, sessionCode]);

  useEffect(() => {
    if (!guestName) return undefined;
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [guestName]);

  if (loadError) return <div className="p-6 text-red-600">{loadError}</div>;
  if (!session) return <div className="p-6 text-slate-500">Loading…</div>;
  if (!guestName) return <SystemCheck onReady={setGuestName} />;

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const seconds = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <span className="font-semibold text-brand-700">KEMSAP CodeLive</span>
        <span className="font-mono text-sm text-slate-600">
          Time remaining: {minutes}:{seconds}
        </span>
      </div>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-3">
        <div className="flex flex-col overflow-hidden lg:col-span-2">
          <div className="flex-1 overflow-hidden">
            <CodeEditor
              interviewId={session.interviewId}
              language={language}
              code={code}
              onLocalChange={setCode}
              socket={socket}
            />
          </div>
          <CodeExecution language={language} code={code} />
        </div>

        <div className="flex flex-col overflow-hidden border-l border-slate-200 lg:col-span-1">
          <div className="h-64 border-b border-slate-200">
            <VideoConference roomName={sessionCode} displayName={guestName} />
          </div>
          <div className="flex-1 overflow-y-auto p-4 text-sm">
            <h2 className="mb-2 font-semibold text-slate-900">Interview questions</h2>
            <ol className="space-y-3">
              {session.questions.map((q) => (
                <li key={q.id}>
                  <span className="mr-1 font-mono text-xs text-slate-400">Q{q.questionNumber}</span>
                  <span className="text-slate-700">{q.questionText}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
