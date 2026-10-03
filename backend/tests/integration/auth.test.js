require('./setup');
const { app, request, registerUser } = require('./helpers');

describe('auth API', () => {
  it('registers an interviewer and returns tokens without the password hash', async () => {
    const user = await registerUser({ email: 'grace@example.com' });
    expect(user.token).toEqual(expect.any(String));
    expect(user.refreshToken).toEqual(expect.any(String));
    expect(user.user).toMatchObject({ email: 'grace@example.com', role: 'interviewer' });
    expect(user.user).not.toHaveProperty('passwordHash');
  });

  it('rejects a duplicate email with 409', async () => {
    await registerUser({ email: 'dup@example.com' });
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'dup@example.com',
      password: 'another-password',
      firstName: 'A',
      lastName: 'B',
    });
    expect(res.status).toBe(409);
  });

  it('does not let a registrant claim the candidate role or a short password', async () => {
    const base = { email: 'x@example.com', firstName: 'A', lastName: 'B' };
    await request(app)
      .post('/api/v1/auth/register')
      .send({ ...base, password: 'long-enough-pw', role: 'candidate' })
      .expect(400);
    await request(app).post('/api/v1/auth/register').send({ ...base, password: 'short' }).expect(400);
  });

  it('logs in with the right password only', async () => {
    const user = await registerUser();
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.user.email, password: 'wrong-password' })
      .expect(401);
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever' })
      .expect(401);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.user.email, password: user.password })
      .expect(200);
    expect(res.body.user.id).toBe(user.user.id);
  });

  it('issues a working access token from a refresh token, but not from an access token', async () => {
    const user = await registerUser();
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(200);
    await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${res.body.token}`).expect(200);

    await request(app).post('/api/v1/auth/refresh').send({ refreshToken: user.token }).expect(401);
  });

  it('protects /me', async () => {
    const user = await registerUser();
    await request(app).get('/api/v1/auth/me').expect(401);
    await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer not-a-jwt').expect(401);
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', user.auth).expect(200);
    expect(res.body.user.email).toBe(user.user.email);
  });
});
