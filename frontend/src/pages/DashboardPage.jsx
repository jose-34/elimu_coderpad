import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import NavBar from '../components/NavBar';

const RATING_STYLES = {
  HIRE: 'bg-green-100 text-green-800',
  CONSIDER: 'bg-amber-100 text-amber-800',
  RISKY: 'bg-orange-100 text-orange-800',
  PASS: 'bg-slate-100 text-slate-700',
};

function CreateInterviewForm({ onCreated }) {
  const [form, setForm] = useState({ candidateName: '', candidateEmail: '', language: 'python' });
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const { data } = await api.post('/interviews', form);
      setResult(data);
      setForm({ candidateName: '', candidateEmail: '', language: 'python' });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create interview');
    } finally {
      setCreating(false);
    }
  }

  const joinUrl = result ? `${window.location.origin}${result.joinPath}` : null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">New interview</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">Candidate name</label>
          <input
            required
            value={form.candidateName}
            onChange={update('candidateName')}
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">Candidate email</label>
          <input
            type="email"
            required
            value={form.candidateEmail}
            onChange={update('candidateEmail')}
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Language</label>
          <select
            value={form.language}
            onChange={update('language')}
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {creating ? 'Creating…' : 'Create session'}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {result && (
        <div className="mt-4 rounded-md bg-brand-50 p-3 text-sm text-brand-700">
          Session code <span className="font-mono font-semibold">{result.sessionCode}</span> — share:{' '}
          <span className="break-all font-mono">{joinUrl}</span>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [interviews, setInterviews] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();

  async function refresh() {
    const [i, c, s] = await Promise.all([
      api.get('/interviews'),
      api.get('/dashboard/candidates'),
      api.get('/dashboard/stats'),
    ]);
    setInterviews(i.data.interviews);
    setCandidates(c.data.candidates);
    setStats(s.data);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {stats && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Total interviews" value={stats.totalInterviews} />
            <StatCard label="This week" value={stats.thisWeekInterviews} />
            <StatCard label="Avg. score" value={`${stats.averageScore} / 64`} />
            <StatCard label="Hire rate" value={`${Math.round(stats.hireRate * 100)}%`} />
          </div>
        )}

        <CreateInterviewForm onCreated={refresh} />

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Interview sessions</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4">Candidate</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Code</th>
                  <th className="py-2 pr-4">Score</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {interviews.map((iv) => (
                  <tr key={iv.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4">
                      <div className="font-medium text-slate-800">{iv.candidateName}</div>
                      <div className="text-slate-500">{iv.candidateEmail}</div>
                    </td>
                    <td className="py-2 pr-4 capitalize">{iv.status}</td>
                    <td className="py-2 pr-4 font-mono">{iv.sessionCode}</td>
                    <td className="py-2 pr-4">
                      {iv.summary ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${RATING_STYLES[iv.summary.rating] || 'bg-slate-100 text-slate-700'}`}
                        >
                          {iv.summary.totalScore}/64 {iv.summary.rating || ''}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <button
                        onClick={() => navigate(`/interview/${iv.id}`)}
                        className="rounded-md border border-brand-500 px-3 py-1 text-brand-600 hover:bg-brand-50"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
                {interviews.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      No interviews yet. Create one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Candidate rankings</h2>
          <ol className="space-y-2">
            {candidates.map((c, idx) => (
              <li key={c.interviewId} className="flex items-center justify-between text-sm">
                <span>
                  <span className="mr-2 text-slate-400">#{idx + 1}</span>
                  <span className="font-medium text-slate-800">{c.name}</span>
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${RATING_STYLES[c.rating] || 'bg-slate-100 text-slate-700'}`}
                >
                  {c.score}/64 {c.rating || ''}
                </span>
              </li>
            ))}
            {candidates.length === 0 && <p className="text-slate-400">No completed interviews yet.</p>}
          </ol>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
