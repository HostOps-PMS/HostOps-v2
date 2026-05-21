const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/your-db';

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error', err));

const authRouter = express.Router();

authRouter.post('/register', async (req, res) => {
  // TODO: create user, hash password, save to DB
  res.status(501).json({ error: 'Register not implemented' });
});

authRouter.post('/login', async (req, res) => {
  // TODO: verify user, compare password, return token
  res.status(501).json({ error: 'Login not implemented' });
});

authRouter.post('/forgot-password', async (req, res) => {
  // TODO: send reset email or reset token
  res.status(501).json({ error: 'Forgot password not implemented' });
});

authRouter.get('/me', async (req, res) => {
  // TODO: verify auth token, return current user
  res.status(501).json({ error: 'Get current user not implemented' });
});

app.use('/auth', authRouter);

app.get('/', (req, res) => {
  res.send('API is running successfully!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});