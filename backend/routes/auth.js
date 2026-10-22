const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Login (Players)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username aur password chahiye' });
    }

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    if (user.isBlocked) {
      return res.status(403).json({ error: 'Account blocked. Contact admin.' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, adminId: user.adminId, isAdmin: false },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      username: user.username,
      balance: user.balance
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Register route band kar diya gaya hai (Admin hi players banayega)

module.exports = router;
