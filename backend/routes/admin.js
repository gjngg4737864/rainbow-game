const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const Admin = require('../models/Admin');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Bet = require('../models/Bet');

// ===== ADMIN LOGIN =====
router.post('/login', async (req, res) => {
  try {
    const { username, password, secretKey } = req.body;
    
    const admin = await Admin.findOne({ username });
    if (!admin) return res.status(403).json({ error: 'Invalid admin credentials' });
    if (admin.isBlocked) return res.status(403).json({ error: 'Admin blocked' });
    if (admin.secretKey !== secretKey) return res.status(403).json({ error: 'Invalid secret key' });

    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) return res.status(403).json({ error: 'Invalid password' });

    const token = jwt.sign(
      { id: admin._id, username: admin.username, isAdmin: true, isSuperAdmin: admin.isSuperAdmin },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({ token, role: admin.isSuperAdmin ? 'super' : 'sub', username: admin.username });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== STATS (Sirf apne players ka) =====
router.get('/stats', auth, auth.adminOnly, async (req, res) => {
  try {
    const adminId = req.user.id;
    const totalPlayers = await User.countDocuments({ adminId });
    const totalBets = await Bet.countDocuments({ adminId });

    const betAgg = await Bet.aggregate([
      { $match: { adminId: new (require('mongoose').Types.ObjectId)(adminId) } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const payoutAgg = await Bet.aggregate([
      { $match: { adminId: new (require('mongoose').Types.ObjectId)(adminId) } },
      { $group: { _id: null, total: { $sum: '$payout' } } }
    ]);

    const totalBetAmount = betAgg[0]?.total || 0;
    const totalPayout = payoutAgg[0]?.total || 0;
    const pendingTx = await Transaction.countDocuments({ adminId, status: 'pending' });

    res.json({
      totalPlayers, totalBets, totalBetAmount, totalPayout,
      profit: totalBetAmount - totalPayout, pendingTx
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== GET PLAYERS =====
router.get('/players', auth, auth.adminOnly, async (req, res) => {
  const users = await User.find({ adminId: req.user.id }).select('-password').sort({ createdAt: -1 });
  res.json(users);
});

// ===== CREATE PLAYER =====
router.post('/player', auth, auth.adminOnly, async (req, res) => {
  try {
    const { username, password, balance } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username aur password chahiye' });

    const exists = await User.findOne({ username: username.toLowerCase() });
    if (exists) return res.status(400).json({ error: 'Username already exists' });

    const hashed = await bcrypt.hash(password, 10);
    await User.create({
      username: username.toLowerCase(),
      password: hashed,
      balance: parseFloat(balance) || 100,
      adminId: req.user.id
    });

    res.json({ message: 'Player created' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== CREDIT / DEBIT =====
router.post('/player/:id/balance', auth, auth.adminOnly, async (req, res) => {
  try {
    const { amount } = req.body;
    const amt = parseFloat(amount);
    if (!amt || isNaN(amt)) return res.status(400).json({ error: 'Invalid amount' });

    const user = await User.findOne({ _id: req.params.id, adminId: req.user.id });
    if (!user) return res.status(404).json({ error: 'Player not found or not yours' });

    user.balance += amt;
    if (user.balance < 0) user.balance = 0;
    await user.save();

    await Transaction.create({
      userId: user._id, adminId: req.user.id,
      type: 'admin_credit', amount: Math.abs(amt),
      status: 'completed', note: amt > 0 ? 'Admin credit' : 'Admin debit'
    });

    res.json({ balance: user.balance });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== BLOCK PLAYER =====
router.post('/player/:id/block', auth, auth.adminOnly, async (req, res) => {
  try {
    const { block } = req.body;
    await User.findOneAndUpdate({ _id: req.params.id, adminId: req.user.id }, { isBlocked: !!block });
    res.json({ message: 'Updated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== RESET PLAYER PASSWORD =====
router.post('/player/:id/password', auth, auth.adminOnly, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 4) return res.status(400).json({ error: 'Min 4 chars' });
    
    const hashed = await bcrypt.hash(password, 10);
    await User.findOneAndUpdate({ _id: req.params.id, adminId: req.user.id }, { password: hashed });
    res.json({ message: 'Password updated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== PENDING TRANSACTIONS =====
router.get('/pending', auth, auth.adminOnly, async (req, res) => {
  const txs = await Transaction.find({ adminId: req.user.id, status: 'pending' })
    .populate('userId', 'username')
    .sort({ createdAt: -1 });
  res.json(txs);
});

// ===== APPROVE/REJECT TX =====
router.post('/transaction/:id', auth, auth.adminOnly, async (req, res) => {
  try {
    const { action } = req.body;
    const tx = await Transaction.findOne({ _id: req.params.id, adminId: req.user.id });
    if (!tx) return res.status(404).json({ error: 'Not found' });
    if (tx.status !== 'pending') return res.status(400).json({ error: 'Already processed' });

    if (action === 'approve') {
      tx.status = 'approved';
      if (tx.type === 'deposit') {
        await User.findByIdAndUpdate(tx.userId, { $inc: { balance: tx.amount } });
      }
    } else if (action === 'reject') {
      tx.status = 'rejected';
      if (tx.type === 'withdraw') {
        await User.findByIdAndUpdate(tx.userId, { $inc: { balance: tx.amount } });
      }
    }
    await tx.save();
    res.json({ message: 'Done' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
