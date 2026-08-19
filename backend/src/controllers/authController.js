const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { registerSchema, loginSchema, refreshSchema } = require('../utils/validators');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/tokens');

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
  };
}

const register = asyncHandler(async (req, res) => {
  const data = registerSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role || 'interviewer',
    },
  });

  const token = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  res.status(201).json({ token, refreshToken, user: toPublicUser(user) });
});

const login = asyncHandler(async (req, res) => {
  const data = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user || !user.passwordHash) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const token = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  res.json({ token, refreshToken, user: toPublicUser(user) });
});

const refresh = asyncHandler(async (req, res) => {
  const data = refreshSchema.parse(req.body);

  let payload;
  try {
    payload = verifyRefreshToken(data.refreshToken);
  } catch (err) {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    throw new ApiError(401, 'User no longer exists');
  }

  const token = signAccessToken(user);
  res.json({ token });
});

const logout = asyncHandler(async (req, res) => {
  // Stateless JWTs: client discards tokens. A production build would
  // maintain a Redis denylist keyed by token jti for immediate revocation.
  res.status(204).send();
});

const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  res.json({ user: toPublicUser(user) });
});

module.exports = { register, login, refresh, logout, me };
