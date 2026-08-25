/**
 * Middleware to enforce Role-Based Access Control (RBAC).
 * Must be chained after `authenticateToken`.
 *
 * @param {...string} allowedRoles - List of permitted roles (e.g. 'ADMIN', 'OPERATOR')
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Accès interdit. Privilèges insuffisants pour exécuter cette action.',
        code: 403,
        role: userRole || null
      });
    }
    next();
  };
}

export default requireRole;
