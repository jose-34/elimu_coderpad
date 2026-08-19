const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const generateSessionCode = require('../utils/sessionCode');
const { createInterviewSchema } = require('../utils/validators');

async function uniqueSessionCode() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateSessionCode();
    const existing = await prisma.interview.findUnique({ where: { sessionCode: code } });
    if (!existing) return code;
  }
  throw new ApiError(500, 'Could not generate a unique session code, please retry');
}

const create = asyncHandler(async (req, res) => {
  const data = createInterviewSchema.parse(req.body);
  const sessionCode = await uniqueSessionCode();

  const interview = await prisma.interview.create({
    data: {
      interviewerId: req.user.id,
      candidateName: data.candidateName,
      candidateEmail: data.candidateEmail,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      language: data.language || 'python',
      sessionCode,
    },
  });

  res.status(201).json({
    interviewId: interview.id,
    sessionCode: interview.sessionCode,
    joinPath: `/join/${interview.sessionCode}`,
    interview,
  });
});

const list = asyncHandler(async (req, res) => {
  const { status, limit = '20', offset = '0' } = req.query;
  const where = {
    interviewerId: req.user.id,
    ...(status ? { status } : {}),
  };

  const [interviews, total] = await Promise.all([
    prisma.interview.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit, 10) || 20, 100),
      skip: parseInt(offset, 10) || 0,
      include: { summary: true },
    }),
    prisma.interview.count({ where }),
  ]);

  res.json({ interviews, total });
});

async function loadOwnedInterview(id, userId) {
  const interview = await prisma.interview.findUnique({
    where: { id },
    include: { summary: true, responses: true },
  });
  if (!interview) throw new ApiError(404, 'Interview not found');
  if (interview.interviewerId !== userId) throw new ApiError(403, 'Not your interview');
  return interview;
}

const getById = asyncHandler(async (req, res) => {
  const interview = await loadOwnedInterview(req.params.id, req.user.id);
  res.json({ interview });
});

const start = asyncHandler(async (req, res) => {
  await loadOwnedInterview(req.params.id, req.user.id);
  const interview = await prisma.interview.update({
    where: { id: req.params.id },
    data: { status: 'active', startedAt: new Date() },
  });
  res.json({ status: interview.status, startedAt: interview.startedAt });
});

const end = asyncHandler(async (req, res) => {
  const existing = await loadOwnedInterview(req.params.id, req.user.id);
  const endedAt = new Date();
  const durationMinutes = existing.startedAt
    ? Math.round((endedAt.getTime() - new Date(existing.startedAt).getTime()) / 60000)
    : null;

  const interview = await prisma.interview.update({
    where: { id: req.params.id },
    data: { status: 'completed', endedAt },
  });

  res.json({ status: interview.status, duration: durationMinutes });
});

const joinBySessionCode = asyncHandler(async (req, res) => {
  const interview = await prisma.interview.findUnique({
    where: { sessionCode: req.params.sessionCode },
    include: {
      responses: { include: { question: true } },
    },
  });
  if (!interview) throw new ApiError(404, 'Interview session not found');

  const questions = await prisma.question.findMany({ orderBy: { sortOrder: 'asc' } });

  res.json({
    interviewId: interview.id,
    sessionCode: interview.sessionCode,
    candidateName: interview.candidateName,
    status: interview.status,
    language: interview.language,
    codeContent: interview.codeContent,
    questions,
  });
});

module.exports = { create, list, getById, start, end, joinBySessionCode };
