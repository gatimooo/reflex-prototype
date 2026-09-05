require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');

const { initSockets } = require('./sockets');
const userRoutes = require('./routes/userRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');

const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());
app.use('/uploads', express.static(path.resolve(__dirname, '../', process.env.UPLOADS_DIR || './uploads')));

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'reflex-backend' }));
app.use('/api/users', userRoutes);
app.use('/api/deliveries', deliveryRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const server = http.createServer(app);
initSockets(server, CORS_ORIGIN);

server.listen(PORT, () => {
  console.log(`Reflex backend listening on http://localhost:${PORT}`);
  console.log(`Run "npm run seed" first if you haven't, then open the frontend pages.`);
});
