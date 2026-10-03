const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');

const env = require('./config/env');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
const registerInterviewSocket = require('./sockets/interviewSocket');

const authRoutes = require('./routes/authRoutes');
const interviewRoutes = require('./routes/interviewRoutes');
const questionRoutes = require('./routes/questionRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', apiLimiter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/interviews', interviewRoutes);
app.use('/api/v1/questions', questionRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: env.corsOrigin, credentials: true },
});
registerInterviewSocket(io);

if (require.main === module) {
  httpServer.listen(env.port, () => {
    console.log(`KEMSAP CodeLive backend listening on port ${env.port} (${env.nodeEnv})`);
  });

  const shutdown = async () => {
    io.close();
    await registerInterviewSocket.flushPendingSaves();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = { app, httpServer, io };
