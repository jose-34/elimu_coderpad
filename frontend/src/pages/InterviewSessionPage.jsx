import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import { useAuthStore } from '../store/authStore';
import NavBar from '../components/NavBar';
import CodeEditor from '../components/interview/CodeEditor';
import CodeExecution from '../components/interview/CodeExecution';
import VideoConference from '../components/interview/VideoConference';
import AssessmentPanel from '../components/interview/AssessmentPanel';

export default function InterviewSessionPage() {
  const { id } = useParams();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  const [interview, setInterview] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [socket, setSocket] = useState(null);
  const [presence, setPresence] = useState([]);

  useEffect(() => {
    let active = true;
    Promise.all([api.get(`/interviews/${id}`), api.get('/questions')]).then(
      ([{ data: ivData }, { data: qData }]) => {
        if (!active) return;
        setInterview(ivData.interview);
        setCode(ivData.interview.codeContent || '');
        setLanguage(ivData.interview.language || 'python');
        setQuestions(qData.questions);
      },
    );
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!token) return undefined;
    const s = connectSocket({ token });
    s.on('connect', () => s.emit('interview:join', { interviewId: id }));
    // Presence is keyed by socket (one person may have several tabs open), and
    // the server's list includes this socket, which isn't an "other".
    s.on('presence:list', (list) => setPresence(list.filter((u) => u.socketId !== s.id)));
    s.on('user:joined', (u) => setPresence((p) => [...p.filter((x) => x.socketId !== u.socketId), u]));
    s.on('user:left', (u) => setPresence((p) => p.filter((x) => x.socketId !== u.socketId)));
    setSocket(s);
    return () => disconnectSocket();
  }, [id, token]);

  async function startInterview() {
    await api.post(`/interviews/${id}/start`);
    setInterview((iv) => ({ ...iv, status: 'active' }));
  }

  async function endInterview() {
    await api.post(`/interviews/${id}/end`);
    setInterview((iv) => ({ ...iv, status: 'completed' }));
  }

  if (!interview) return <div className="p-6 text-slate-500">Loading interview…</div>;

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <NavBar />
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <div>
          <span className="font-medium text-slate-800">{interview.candidateName}</span>
          <span className="ml-2 font-mono text-xs text-slate-400">{interview.sessionCode}</span>
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">
            {interview.status}
          </span>
          {presence.length > 0 && (
            <span className="ml-2 text-xs text-slate-400">{presence.length} other online</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
          </select>
          {interview.status !== 'active' && interview.status !== 'completed' && (
            <button
              onClick={startInterview}
              className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
            >
              Start interview
            </button>
          )}
          {interview.status === 'active' && (
            <button
              onClick={endInterview}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            >
              End interview
            </button>
          )}
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-3">
        <div className="flex flex-col overflow-hidden lg:col-span-2">
          <div className="flex-1 overflow-hidden">
            <CodeEditor
              interviewId={id}
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
            <VideoConference roomName={interview.sessionCode} displayName={user?.firstName || 'Interviewer'} />
          </div>
          <div className="flex-1 overflow-hidden">
            <AssessmentPanel interviewId={id} questions={questions} />
          </div>
        </div>
      </div>
    </div>
  );
}
