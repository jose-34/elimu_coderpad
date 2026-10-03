jest.mock('../src/config/prisma', () => ({
  interview: { findUnique: jest.fn(), update: jest.fn() },
}));

const http = require('http');
const { Server } = require('socket.io');
const { io: ioClient } = require('socket.io-client');
const prisma = require('../src/config/prisma');
const registerInterviewSocket = require('../src/sockets/interviewSocket');
const { signAccessToken } = require('../src/utils/tokens');

const INTERVIEWS = {
  'iv-1': { id: 'iv-1', interviewerId: 'owner', sessionCode: 'ABC234', status: 'active' },
  'iv-2': { id: 'iv-2', interviewerId: 'other', sessionCode: 'XYZ789', status: 'active' },
  'iv-3': { id: 'iv-3', interviewerId: 'owner', sessionCode: 'DONE22', status: 'completed' },
};

let server;
let url;
const clients = [];

beforeAll((done) => {
  prisma.interview.findUnique.mockImplementation(async ({ where }) => {
    if (where.id) return INTERVIEWS[where.id] || null;
    return Object.values(INTERVIEWS).find((i) => i.sessionCode === where.sessionCode) || null;
  });
  prisma.interview.update.mockResolvedValue({});
  server = http.createServer();
  registerInterviewSocket(new Server(server));
  server.listen(0, () => {
    url = `http://localhost:${server.address().port}`;
    done();
  });
});

afterEach(() => {
  while (clients.length) clients.pop().disconnect();
});

afterAll(async () => {
  await registerInterviewSocket.flushPendingSaves();
  await new Promise((resolve) => server.close(resolve));
});

function connect(auth) {
  const client = ioClient(url, { auth, transports: ['websocket'], reconnection: false });
  clients.push(client);
  return client;
}

function connectOk(auth) {
  return new Promise((resolve, reject) => {
    const client = connect(auth);
    client.on('connect', () => resolve(client));
    client.on('connect_error', reject);
  });
}

function connectError(auth) {
  return new Promise((resolve, reject) => {
    const client = connect(auth);
    client.on('connect', () => reject(new Error('unexpectedly connected')));
    client.on('connect_error', (err) => resolve(err.message));
  });
}

function join(client, interviewId) {
  return new Promise((resolve) => {
    client.once('presence:list', (list) => resolve({ ok: true, list }));
    client.once('interview:error', () => resolve({ ok: false }));
    client.emit('interview:join', { interviewId });
  });
}

const ownerToken = () => signAccessToken({ id: 'owner', role: 'interviewer', email: 'o@x.io' });

describe('socket authentication', () => {
  it('rejects a guest without a session code', async () => {
    expect(await connectError({ guestName: 'Eve' })).toBe('Authentication required');
  });

  it('rejects a guest with an unknown session code', async () => {
    expect(await connectError({ guestName: 'Eve', sessionCode: 'NOPE00' })).toMatch(/Invalid/);
  });

  it('rejects a guest for a completed interview', async () => {
    expect(await connectError({ guestName: 'Eve', sessionCode: 'DONE22' })).toMatch(/closed/);
  });

  it('rejects an invalid token', async () => {
    expect(await connectError({ token: 'garbage' })).toMatch(/Invalid or expired/);
  });
});

describe('interview:join authorization', () => {
  it('lets a guest join only the interview their session code belongs to', async () => {
    const guest = await connectOk({ guestName: 'Cand', sessionCode: 'ABC234' });
    expect((await join(guest, 'iv-2')).ok).toBe(false);
    expect((await join(guest, 'iv-1')).ok).toBe(true);
  });

  it("does not let an interviewer join someone else's interview", async () => {
    const owner = await connectOk({ token: ownerToken() });
    expect((await join(owner, 'iv-2')).ok).toBe(false);
    expect((await join(owner, 'iv-1')).ok).toBe(true);
  });

  it('relays code between room members, but not candidate assessment spoofs', async () => {
    const owner = await connectOk({ token: ownerToken() });
    const guest = await connectOk({ guestName: 'Cand', sessionCode: 'ABC234' });
    await join(owner, 'iv-1');
    await join(guest, 'iv-1');

    const update = new Promise((resolve) => owner.once('code:update', resolve));
    guest.emit('code:change', { interviewId: 'iv-1', content: 'print(1)', language: 'python' });
    expect((await update).content).toBe('print(1)');

    const spoofed = jest.fn();
    owner.on('assessment:update', spoofed);
    guest.emit('assessment:score', { interviewId: 'iv-1', score: 4 });
    await new Promise((r) => setTimeout(r, 100));
    expect(spoofed).not.toHaveBeenCalled();
  });
});
