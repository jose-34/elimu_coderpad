import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../services/api';

const NOTES_DEBOUNCE_MS = 600;

const SECTIONS = ['Scratch', 'Arduino', 'Python', 'WebDev', 'Teaching'];
const STARS = [0, 1, 2, 3, 4];

const RATING_STYLES = {
  HIRE: 'bg-green-100 text-green-800',
  CONSIDER: 'bg-amber-100 text-amber-800',
  RISKY: 'bg-orange-100 text-orange-800',
  PASS: 'bg-slate-100 text-slate-700',
};

function StarRating({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {STARS.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`h-6 w-6 rounded text-sm ${
            n <= value ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-400'
          }`}
          title={`${n} / 4`}
        >
          {n <= value ? '★' : '☆'}
        </button>
      ))}
    </div>
  );
}

export default function AssessmentPanel({ interviewId, questions }) {
  const [scores, setScores] = useState({}); // questionId -> {score, notes}
  const [summary, setSummary] = useState(null);
  const [final, setFinal] = useState({ redFlags: false, strengths: '', concerns: '' });
  const [savingFinal, setSavingFinal] = useState(false);
  const scoresRef = useRef(scores);
  const notesTimers = useRef({});

  scoresRef.current = scores;

  useEffect(() => {
    const timers = notesTimers.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  useEffect(() => {
    api.get(`/interviews/${interviewId}/assessment/summary`).then(({ data }) => {
      const byQuestion = {};
      for (const r of data.responses) byQuestion[r.questionId] = { score: r.score, notes: r.notes || '' };
      setScores(byQuestion);
      setSummary(data.summary);
      setFinal({
        redFlags: data.summary.redFlags || false,
        strengths: data.summary.strengths || '',
        concerns: data.summary.concerns || '',
      });
    });
  }, [interviewId]);

  const grouped = useMemo(() => {
    const map = {};
    for (const section of SECTIONS) map[section] = [];
    for (const q of questions) (map[q.section] || (map[q.section] = [])).push(q);
    return map;
  }, [questions]);

  async function persist(questionId) {
    const entry = scoresRef.current[questionId] || {};
    const { data } = await api.post(`/interviews/${interviewId}/assessment/${questionId}`, {
      score: entry.score || 0,
      notes: entry.notes || '',
    });
    setSummary(data.summary);
  }

  function saveScore(question, score) {
    setScores((s) => ({ ...s, [question.id]: { ...(s[question.id] || {}), score } }));
    scoresRef.current = {
      ...scoresRef.current,
      [question.id]: { ...(scoresRef.current[question.id] || {}), score },
    };
    persist(question.id);
  }

  // Debounced: without this every keystroke in a notes field is a round-trip,
  // which races the summary responses and burns through the API rate limit.
  function saveNotes(question, notes) {
    setScores((s) => ({ ...s, [question.id]: { ...(s[question.id] || {}), notes } }));
    scoresRef.current = {
      ...scoresRef.current,
      [question.id]: { ...(scoresRef.current[question.id] || {}), notes },
    };

    clearTimeout(notesTimers.current[question.id]);
    notesTimers.current[question.id] = setTimeout(() => persist(question.id), NOTES_DEBOUNCE_MS);
  }

  async function saveFinal() {
    setSavingFinal(true);
    try {
      const { data } = await api.put(`/interviews/${interviewId}/assessment/final`, final);
      setSummary(data.summary);
    } finally {
      setSavingFinal(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white p-4 text-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Assessment</h2>
        {summary && (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${RATING_STYLES[summary.rating] || 'bg-slate-100 text-slate-700'}`}
          >
            {summary.totalScore}/64 {summary.rating || ''}
          </span>
        )}
      </div>

      {SECTIONS.map((section) => (
        <div key={section} className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-medium text-slate-700">{section}</h3>
            {summary && (
              <span className="text-xs text-slate-400">
                {summary[`${section.toLowerCase()}Score`] ?? 0}/12
              </span>
            )}
          </div>
          <div className="space-y-3">
            {(grouped[section] || []).map((q) => (
              <div key={q.id} className="rounded-md border border-slate-200 p-2.5">
                <p className="mb-1.5 text-slate-700">
                  <span className="mr-1 font-mono text-xs text-slate-400">Q{q.questionNumber}</span>
                  {q.questionText}
                </p>
                <StarRating
                  value={scores[q.id]?.score || 0}
                  onChange={(score) => saveScore(q, score)}
                />
                <textarea
                  placeholder="Notes…"
                  value={scores[q.id]?.notes || ''}
                  onChange={(e) => saveNotes(q, e.target.value)}
                  className="mt-2 w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
                  rows={2}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-2 border-t border-slate-200 pt-4">
        <label className="mb-2 flex items-center gap-2 text-slate-700">
          <input
            type="checkbox"
            checked={final.redFlags}
            onChange={(e) => setFinal((f) => ({ ...f, redFlags: e.target.checked }))}
          />
          Red flags
        </label>
        <label className="mb-1 block text-xs font-medium text-slate-500">Strengths</label>
        <textarea
          value={final.strengths}
          onChange={(e) => setFinal((f) => ({ ...f, strengths: e.target.value }))}
          className="mb-2 w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
          rows={2}
        />
        <label className="mb-1 block text-xs font-medium text-slate-500">Concerns</label>
        <textarea
          value={final.concerns}
          onChange={(e) => setFinal((f) => ({ ...f, concerns: e.target.value }))}
          className="mb-3 w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
          rows={2}
        />
        <button
          onClick={saveFinal}
          disabled={savingFinal}
          className="w-full rounded-md bg-brand-600 px-3 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {savingFinal ? 'Saving…' : 'Save final assessment'}
        </button>
      </div>
    </div>
  );
}
