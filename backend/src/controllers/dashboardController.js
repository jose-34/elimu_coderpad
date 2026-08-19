const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');

const candidates = asyncHandler(async (req, res) => {
  const interviews = await prisma.interview.findMany({
    where: { interviewerId: req.user.id, status: 'completed' },
    include: { summary: true },
    orderBy: { endedAt: 'desc' },
  });

  const list = interviews.map((i) => ({
    interviewId: i.id,
    name: i.candidateName,
    email: i.candidateEmail,
    score: i.summary?.totalScore ?? null,
    rating: i.summary?.rating ?? null,
    date: i.endedAt,
  }));

  list.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  res.json({ candidates: list });
});

const stats = asyncHandler(async (req, res) => {
  const interviewerId = req.user.id;
  const [total, completed, thisWeek, summaries] = await Promise.all([
    prisma.interview.count({ where: { interviewerId } }),
    prisma.interview.count({ where: { interviewerId, status: 'completed' } }),
    prisma.interview.count({
      where: {
        interviewerId,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.assessmentSummary.findMany({
      where: { interview: { interviewerId } },
    }),
  ]);

  const averageScore = summaries.length
    ? summaries.reduce((sum, s) => sum + s.totalScore, 0) / summaries.length
    : 0;
  const hireCount = summaries.filter((s) => s.rating === 'HIRE').length;
  const hireRate = summaries.length ? hireCount / summaries.length : 0;

  res.json({
    totalInterviews: total,
    completedInterviews: completed,
    thisWeekInterviews: thisWeek,
    averageScore: Math.round(averageScore * 10) / 10,
    hireRate: Math.round(hireRate * 1000) / 1000,
  });
});

module.exports = { candidates, stats };
