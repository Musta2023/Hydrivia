import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import prisma from '../database/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || '');

    if (!cleanEmail || !cleanPassword) {
      return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }

    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: cleanEmail,
          mode: 'insensitive'
        }
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Identifiants incorrects. Utilisateur non trouvé.' });
    }

    const validPassword = await bcrypt.compare(cleanPassword, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Mot de passe incorrect.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    // Log login event with userId FK
    try {
      const roleLabel = user.role === 'ADMIN' ? 'Administrateur' : 'Opérateur';
      await prisma.systemLog.create({
        data: {
          eventType: 'AUTH_LOGIN',
          description: `Connexion réussie (${roleLabel} : ${user.email})`,
          userEmail: user.email,
          userId: user.id
        }
      });
    } catch (e) {}

    res.json({
      message: 'Connexion réussie',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('[AUTH LOGIN ERROR]', error);
    res.status(500).json({ error: error.message || 'Erreur serveur lors de la connexion.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, role: true, createdAt: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération du profil.' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mots de passe actuel et nouveau requis.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(400).json({ error: 'Mot de passe actuel incorrect.' });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash: newHash }
    });

    // Log with FK userId
    try {
      await prisma.systemLog.create({
        data: {
          eventType: 'AUTH_PASSWORD_CHANGE',
          description: 'Changement du mot de passe administrateur',
          userEmail: user.email,
          userId: user.id
        }
      });
    } catch (e) {}

    res.json({ message: 'Mot de passe modifié avec succès.' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la modification du mot de passe.' });
  }
});

export default router;
