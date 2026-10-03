const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { scoreQuestionSchema, finalAssessmentSchema } = require('../utils/validators');
const { calculateRating } = require('../utils/rating');

const SECTION_FIELD = {
  Scratch: 'scratchScore',
  Arduino: 'arduinoScore',
  Python: 'pythonScore',
  WebDev: 'webdevScore',
  Teaching: 'teachingScore',
};

async function assertOwnedInterview(interviewId, userId) {
  const interview = await prisma.interview.findUnique({ where: { id: interviewId } });
  if (!interview) throw new ApiError(404, 'Interview not found');
  if (interview.interviewerId !== userId) throw new ApiError(403, 'Not your interview');
  return interview;
}

async function recomputeSummary(interviewId) {
  const responses = await prisma.assessmentResponse.findMany({
    where: { interviewId },
    include: { question: true },
  });

  const sectionTotals = { Scratch: 0, Arduino: 0, Python: 0, WebDev: 0, Teaching: 0 };
  for (const r of responses) {
    const section = r.question.section;
    if (sectionTotals[section] !== undefined) sectionTotals[section] += r.score;
  }
  const totalScore = Object.values(sectionTotals).reduce((a, b) => a + b, 0);

  const existing = await prisma.assessmentSummary.findUnique({ where: { interviewId } });
  const redFlags = existing?.redFlags || false;
  const rating = calculateRating(totalScore, redFlags);

  return prisma.assessmentSummary.upsert({
    where: { interviewId },
    update: {
      scratchScore: sectionTotals.Scratch,
      arduinoScore: sectionTotals.Arduino,
      pythonScore: sectionTotals.Python,
      webdevScore: sectionTotals.WebDev,
      teachingScore: sectionTotals.Teaching,
      totalScore,
      rating,
    },
    create: {
      interviewId,
      scratchScore: sectionTotals.Scratch,
      arduinoScore: sectionTotals.Arduino,
      pythonScore: sectionTotals.Python,
      webdevScore: sectionTotals.WebDev,
      teachingScore: sectionTotals.Teaching,
      totalScore,
      rating,
    },
  });
}

const scoreQuestion = asyncHandler(async (req, res) => {
  const { id: interviewId, questionId } = req.params;
  await assertOwnedInterview(interviewId, req.user.id);
  const data = scoreQuestionSchema.parse(req.body);

  const id = Number(questionId);
  const question = Number.isInteger(id)
    ? await prisma.question.findUnique({ where: { id } })
    : null;
  if (!question) throw new ApiError(404, 'Question not found');

  await prisma.assessmentResponse.upsert({
    where: { interviewId_questionId: { interviewId, questionId: question.id } },
    update: { score: data.score, notes: data.notes },
    create: { interviewId, questionId: question.id, score: data.score, notes: data.notes },
  });

  const summary = await recomputeSummary(interviewId);
  res.json({ questionId: question.id, score: data.score, saved: true, summary });
});

const getSummary = asyncHandler(async (req, res) => {
  const interviewId = req.params.id;
  await assertOwnedInterview(interviewId, req.user.id);

  const [responses, summary] = await Promise.all([
    prisma.assessmentResponse.findMany({ where: { interviewId }, include: { question: true } }),
    prisma.assessmentSummary.findUnique({ where: { interviewId } }),
  ]);

  res.json({
    responses,
    summary: summary || {
      scratchScore: 0,
      arduinoScore: 0,
      pythonScore: 0,
      webdevScore: 0,
      teachingScore: 0,
      totalScore: 0,
      rating: null,
      redFlags: false,
    },
  });
});

const updateFinal = asyncHandler(async (req, res) => {
  const interviewId = req.params.id;
  await assertOwnedInterview(interviewId, req.user.id);
  const data = finalAssessmentSchema.parse(req.body);

  const current = await recomputeSummary(interviewId);
  const rating = calculateRating(current.totalScore, data.redFlags ?? current.redFlags);

  const summary = await prisma.assessmentSummary.update({
    where: { interviewId },
    data: {
      redFlags: data.redFlags ?? current.redFlags,
      strengths: data.strengths ?? current.strengths,
      concerns: data.concerns ?? current.concerns,
      rating,
    },
  });

  res.json({ saved: true, finalScore: summary.totalScore, rating: summary.rating, summary });
});

module.exports = { scoreQuestion, getSummary, updateFinal, SECTION_FIELD };
