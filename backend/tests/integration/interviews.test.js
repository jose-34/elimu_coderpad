require('./setup');
const { app, prisma, request, registerUser, createInterview } = require('./helpers');

describe('interviews API', () => {
  it('creates a session with a join code and lists only the owner\'s interviews', async () => {
    const alice = await registerUser();
    const bob = await registerUser();
    const created = await createInterview(alice, { language: 'javascript' });

    expect(created.sessionCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(created.joinPath).toBe(`/join/${created.sessionCode}`);
    expect(created.interview).toMatchObject({ status: 'scheduled', language: 'javascript' });

    const aliceList = await request(app).get('/api/v1/interviews').set('Authorization', alice.auth).expect(200);
    expect(aliceList.body.total).toBe(1);
    expect(aliceList.body.interviews[0].id).toBe(created.interviewId);

    const bobList = await request(app).get('/api/v1/interviews').set('Authorization', bob.auth).expect(200);
    expect(bobList.body).toEqual({ interviews: [], total: 0 });
  });

  it('validates the create payload', async () => {
    const alice = await registerUser();
    await request(app)
      .post('/api/v1/interviews')
      .set('Authorization', alice.auth)
      .send({ candidateName: 'Ada', candidateEmail: 'not-an-email' })
      .expect(400);
    await request(app)
      .post('/api/v1/interviews')
      .set('Authorization', alice.auth)
      .send({ candidateName: 'Ada', candidateEmail: 'ada@example.com', language: 'cobol' })
      .expect(400);
  });

  it('returns 404 for a missing interview and 403 for someone else\'s', async () => {
    const alice = await registerUser();
    const bob = await registerUser();
    const { interviewId } = await createInterview(alice);

    await request(app).get(`/api/v1/interviews/${interviewId}`).set('Authorization', bob.auth).expect(403);
    await request(app).post(`/api/v1/interviews/${interviewId}/start`).set('Authorization', bob.auth).expect(403);
    await request(app)
      .get('/api/v1/interviews/00000000-0000-0000-0000-000000000000')
      .set('Authorization', alice.auth)
      .expect(404);
  });

  it('moves through scheduled -> active -> completed and rejects invalid transitions', async () => {
    const alice = await registerUser();
    const { interviewId } = await createInterview(alice);
    const path = `/api/v1/interviews/${interviewId}`;

    const started = await request(app).post(`${path}/start`).set('Authorization', alice.auth).expect(200);
    expect(started.body.status).toBe('active');

    // Starting again is a no-op that keeps the original start time.
    const again = await request(app).post(`${path}/start`).set('Authorization', alice.auth).expect(200);
    expect(again.body.startedAt).toBe(started.body.startedAt);

    const ended = await request(app).post(`${path}/end`).set('Authorization', alice.auth).expect(200);
    expect(ended.body).toMatchObject({ status: 'completed', duration: 0 });

    await request(app).post(`${path}/end`).set('Authorization', alice.auth).expect(409);
    await request(app).post(`${path}/start`).set('Authorization', alice.auth).expect(409);

    const row = await prisma.interview.findUnique({ where: { id: interviewId } });
    expect(row.status).toBe('completed');
    expect(row.endedAt).not.toBeNull();
  });

  it('lets a candidate look up a session by code without auth, exposing no interviewer data', async () => {
    const alice = await registerUser();
    const { sessionCode, interviewId } = await createInterview(alice);
    await prisma.interview.update({ where: { id: interviewId }, data: { codeContent: 'print("hi")' } });

    const res = await request(app).get(`/api/v1/interviews/join/${sessionCode}`).expect(200);
    expect(res.body).toMatchObject({
      interviewId,
      sessionCode,
      candidateName: 'Ada Candidate',
      codeContent: 'print("hi")',
    });
    expect(res.body.questions).toHaveLength(16);
    expect(res.body).not.toHaveProperty('interviewerId');
    expect(res.body).not.toHaveProperty('candidateEmail');

    await request(app).get('/api/v1/interviews/join/ZZZZZZ').expect(404);
  });
});
