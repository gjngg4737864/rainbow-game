require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connect
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');
    await createSuperAdminIfNotExists();
  })
  .catch(err => console.error('❌ MongoDB error:', err.message));

// ===== Auto-create Super Admin =====
async function createSuperAdminIfNotExists() {
  try {
    const Admin = require('./models/Admin');
    const existing = await Admin.findOne({ username: process.env.ADMIN_USERNAME });
    if (existing) {
      console.log('✅ Super admin already exists');
      return;
    }
    const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    await Admin.create({
      username: process.env.ADMIN_USERNAME,
      password: hashed,
      secretKey: process.env.ADMIN_SECRET_KEY,
      isSuperAdmin: true
    });
    console.log('✅ Super admin created:', process.env.ADMIN_USERNAME);
  } catch (e) {
    console.error('❌ Super admin creation error:', e.message);
  }
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/game', require('./routes/game'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/superadmin', require('./routes/superadmin'));

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Rainbow Game Backend is running' });
});

// Start
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
