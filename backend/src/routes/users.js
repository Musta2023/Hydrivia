import express from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../database/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = express.Router();

// Apply auth & Admin-only guard to all user management routes
router.use(authenticateToken, requireRole('ADMIN'));

// GET /api/users - List all users
router.get('/', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        _count: {
          select: { systemLogs: true }
        }
      },
      orderBy: { id: 'asc' }
    });

    res.json({ users });
  } catch (error) {
    console.error('[USERS LIST ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs.' });
  }
});

// POST /api/users - Create new user (ADMIN or OPERATOR)
router.post('/', async (req, res) => {
  try {
    const { email, password, role = 'OPERATOR' } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || '');
    const cleanRole = String(role).toUpperCase();

    if (!cleanEmail || !cleanPassword) {
      return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }

    if (cleanPassword.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
    }

    if (!['ADMIN', 'OPERATOR'].includes(cleanRole)) {
      return res.status(400).json({ error: 'Rôle invalide. Valeurs acceptées : ADMIN, OPERATOR.' });
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (existing) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé par un autre compte.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(cleanPassword, salt);

    const newUser = await prisma.user.create({
      data: {
        email: cleanEmail,
        passwordHash,
        role: cleanRole
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    // Write audit log
    try {
      await prisma.systemLog.create({
        data: {
          eventType: 'USER_CREATE',
          description: `Création du compte ${cleanEmail} avec le rôle ${cleanRole}`,
          userEmail: req.user.email,
          userId: req.user.id
        }
      });
    } catch (e) {}

    res.status(201).json({
      message: `Compte ${cleanRole} créé avec succès.`,
      user: newUser
    });
  } catch (error) {
    console.error('[USER CREATE ERROR]', error);
    res.status(500).json({ error: error.message || 'Erreur lors de la création du compte.' });
  }
});

// PATCH /api/users/:id/role - Update user role
router.patch('/:id/role', async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const { role } = req.body || {};
    const newRole = String(role || '').toUpperCase();

    if (!['ADMIN', 'OPERATOR'].includes(newRole)) {
      return res.status(400).json({ error: 'Rôle invalide. Utilisez ADMIN ou OPERATOR.' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    // Safety guard: prevent demoting the last remaining ADMIN
    if (targetUser.role === 'ADMIN' && newRole === 'OPERATOR') {
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN' }
      });
      if (adminCount <= 1) {
        return res.status(400).json({
          error: 'Impossible de rétrograder le dernier administrateur du système.'
        });
      }
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    // Write audit log
    try {
      await prisma.systemLog.create({
        data: {
          eventType: 'USER_ROLE_CHANGE',
          description: `Modification du rôle de ${targetUser.email} : ${targetUser.role} -> ${newRole}`,
          userEmail: req.user.email,
          userId: req.user.id
        }
      });
    } catch (e) {}

    res.json({
      message: `Rôle de ${updated.email} mis à jour en ${newRole}.`,
      user: updated
    });
  } catch (error) {
    console.error('[USER ROLE UPDATE ERROR]', error);
    res.status(500).json({ error: error.message || 'Erreur lors de la modification du rôle.' });
  }
});

// DELETE /api/users/:id - Delete user account
router.delete('/:id', async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    // Safety guard: prevent deleting the last ADMIN
    if (targetUser.role === 'ADMIN') {
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN' }
      });
      if (adminCount <= 1) {
        return res.status(400).json({
          error: 'Impossible de supprimer le dernier compte administrateur.'
        });
      }
    }

    await prisma.user.delete({
      where: { id: targetUserId }
    });

    // Write audit log
    try {
      await prisma.systemLog.create({
        data: {
          eventType: 'USER_DELETE',
          description: `Suppression du compte utilisateur ${targetUser.email} (${targetUser.role})`,
          userEmail: req.user.email,
          userId: req.user.id
        }
      });
    } catch (e) {}

    res.json({
      message: `Compte ${targetUser.email} supprimé avec succès.`
    });
  } catch (error) {
    console.error('[USER DELETE ERROR]', error);
    res.status(500).json({ error: error.message || 'Erreur lors de la suppression du compte.' });
  }
});

export default router;
