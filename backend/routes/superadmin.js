const router = require('express').Router();
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const Admin = require('../models/Admin');
const User = require('../models/User');

// Sirf Super Admin hi use kar sakta hai (middleware check lagega)
router.use(auth, auth.superAdminOnly);

// ===== GET ALL ADMINS =====
router.get('/admins', async (req, res) => {
  try {
    const admins = await Admin.find().select('-password');
    // Har admin ke kitne players hain count karo
    const adminsWithCount = await Promise.all(admins.map(async (a) => {
      const playerCount = await User.countDocuments({ adminId: a._id });
      return { ...a._doc, playerCount };
    }));
    res.json(adminsWithCount);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== CREATE NEW ADMIN =====
router.post('/admin', async (req, res) => {
  try {
    const { username, password, secretKey } = req.body;
    if (!username || !password || !secretKey) {
      return res.status(400).json({ error: 'Teen cheezein daalo' });
    }

    const exists = await Admin.findOne({ username: username.toLowerCase() });
    if (exists) return res.status(400).json({ error: 'Admin username exists' });

    const hashed = await bcrypt.hash(password, 10);
    await Admin.create({
      username: username.toLowerCase(),
      password: hashed,
      secretKey: secretKey,
      isSuperAdmin: false
    });

    res.json({ message: 'Admin created' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== RESET ADMIN PASSWORD =====
router.post('/admin/:id/password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 4) return res.status(400).json({ error: 'Min 4 chars' });
    
    const hashed = await bcrypt.hash(password, 10);
    await Admin.findOneAndUpdate({ _id: req.params.id, isSuperAdmin: false }, { password: hashed });
    res.json({ message: 'Password updated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== BLOCK ADMIN =====
router.post('/admin/:id/block', async (req, res) => {
  try {
    const { block } = req.body;
    await Admin.findOneAndUpdate({ _id: req.params.id, isSuperAdmin: false }, { isBlocked: !!block });
    res.json({ message: 'Updated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
