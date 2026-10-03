require('./setup');
const { app, prisma, request, registerUser, createInterview } = require('./helpers');

async function questionIds() {
  const questions = await prisma.question.findMany({ orderBy: { sortOrder: 'asc' } });
  return questions;
}

function score(user, interviewId, questionId, body) {
  return request(app)
    .post(`/api/v1/interviews/${interviewId}/assessment/${questionId}`)
    .set('Authorization', user.auth)
    .send(body);
}

describe('assessment API', () => {
  it('scores questions into per-section and total scores, updating rather than duplicating', async () => {
    const alice = await registerUser();
    const { interviewId } = await createInterview(alice);
    const questions = await questionIds();
    const scratch = questions.find((q) => q.section === 'Scratch');
    const python = questions.find((q) => q.section === 'Python');

    await score(alice, interviewId, scratch.id, { score: 3, notes: 'solid' }).expect(200);
    await score(alice, interviewId, python.id, { score: 2 }).expect(200);
    const res = await score(alice, interviewId, python.id, { score: 4 }).expect(200);

    expect(res.body.summary).toMatchObject({ scratchScore: 3, pythonScore: 4, totalScore: 7, rating: 'PASS' });
    expect(await prisma.assessmentResponse.count({ where: { interviewId } })).toBe(2);

    const summary = await request(app)
      .get(`/api/v1/interviews/${interviewId}/assessment/summary`)
      .set('Authorization', alice.auth)
      .expect(200);
    expect(summary.body.summary.totalScore).toBe(7);
    expect(summary.body.responses.find((r) => r.questionId === scratch.id).notes).toBe('solid');
  });

  it('returns an empty summary before any scoring', async () => {
    const alice = await registerUser();
    const { interviewId } = await createInterview(alice);
    const res = await request(app)
      .get(`/api/v1/interviews/${interviewId}/assessment/summary`)
      .set('Authorization', alice.auth)
      .expect(200);
    expect(res.body).toMatchObject({ responses: [], summary: { totalScore: 0, rating: null } });
  });

  it('rejects out-of-range scores, unknown questions and other interviewers', async () => {
    const alice = await registerUser();
    const bob = await registerUser();
    const { interviewId } = await createInterview(alice);
    const [first] = await questionIds();

    await score(alice, interviewId, first.id, { score: 5 }).expect(400);
    await score(alice, interviewId, first.id, { score: 2.5 }).expect(400);
    await score(alice, interviewId, 9999, { score: 2 }).expect(404);
    await score(alice, interviewId, 'abc', { score: 2 }).expect(404);
    await score(bob, interviewId, first.id, { score: 4 }).expect(403);
    expect(await prisma.assessmentResponse.count()).toBe(0);
  });

  it('rates HIRE at 50+ and drops to RISKY when red flags are recorded', async () => {
    const alice = await registerUser();
    const { interviewId } = await createInterview(alice);
    const questions = await questionIds();

    // 13 questions x 4 points = 52
    for (const q of questions.slice(0, 13)) {
      await score(alice, interviewId, q.id, { score: 4 }).expect(200);
    }

    const final = (body) =>
      request(app)
        .put(`/api/v1/interviews/${interviewId}/assessment/final`)
        .set('Authorization', alice.auth)
        .send(body)
        .expect(200);

    const hire = await final({ strengths: 'Clear explanations' });
    expect(hire.body).toMatchObject({ finalScore: 52, rating: 'HIRE' });

    const risky = await final({ redFlags: true, concerns: 'Dismissive of students' });
    expect(risky.body.rating).toBe('RISKY');
    expect(risky.body.summary).toMatchObject({
      redFlags: true,
      strengths: 'Clear explanations',
      concerns: 'Dismissive of students',
    });

    // Red flags persist through later scoring.
    const rescored = await score(alice, interviewId, questions[13].id, { score: 4 }).expect(200);
    expect(rescored.body.summary).toMatchObject({ totalScore: 56, rating: 'RISKY' });
  });
});
