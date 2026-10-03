require('./setup');
const { app, prisma, request, registerUser, createInterview } = require('./helpers');

async function completeWithScore(user, total) {
  const { interviewId } = await createInterview(user, { candidateName: `Candidate ${total}` });
  const questions = await prisma.question.findMany({ orderBy: { sortOrder: 'asc' } });
  let remaining = total;
  for (const q of questions) {
    if (remaining <= 0) break;
    const points = Math.min(4, remaining);
    remaining -= points;
    await request(app)
      .post(`/api/v1/interviews/${interviewId}/assessment/${q.id}`)
      .set('Authorization', user.auth)
      .send({ score: points })
      .expect(200);
  }
  await request(app).post(`/api/v1/interviews/${interviewId}/start`).set('Authorization', user.auth).expect(200);
  await request(app).post(`/api/v1/interviews/${interviewId}/end`).set('Authorization', user.auth).expect(200);
  return interviewId;
}

describe('dashboard API', () => {
  it('ranks completed candidates by score and reports stats for the current interviewer only', async () => {
    const alice = await registerUser();
    const bob = await registerUser();
    await completeWithScore(alice, 30);
    await completeWithScore(alice, 55);
    await createInterview(alice); // still scheduled: counted, but not ranked
    await completeWithScore(bob, 64);

    const candidates = await request(app)
      .get('/api/v1/dashboard/candidates')
      .set('Authorization', alice.auth)
      .expect(200);
    expect(candidates.body.candidates.map((c) => [c.score, c.rating])).toEqual([
      [55, 'HIRE'],
      [30, 'RISKY'],
    ]);

    const stats = await request(app).get('/api/v1/dashboard/stats').set('Authorization', alice.auth).expect(200);
    expect(stats.body).toEqual({
      totalInterviews: 3,
      completedInterviews: 2,
      thisWeekInterviews: 3,
      averageScore: 42.5,
      hireRate: 0.5,
    });
  });

  it('requires auth', async () => {
    await request(app).get('/api/v1/dashboard/stats').expect(401);
  });
});

describe('questions API', () => {
  it('lists the 16 seeded questions in order', async () => {
    const res = await request(app).get('/api/v1/questions').expect(200);
    expect(res.body.questions).toHaveLength(16);
    expect(res.body.questions[0].questionNumber).toBe('1.1');
    expect(res.body.questions[15].questionNumber).toBe('5.4');
  });
});
