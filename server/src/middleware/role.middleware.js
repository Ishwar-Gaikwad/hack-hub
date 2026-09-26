/**
 * Reusable role-based access control middleware factory
 * @param {...string|string[]} roles Allowed roles (e.g. 'admin', 'organizer' or ['admin', 'judge'])
 */
export function requireRole(...roles) {
  const allowedRoles = roles.flat();

  return (req, res, next) => {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required prior to role verification.'
      });
    }

    // Check if user's role is in the allowed list
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Forbidden. Role '${req.user.role}' is not authorized to access this resource. Required: [${allowedRoles.join(', ')}].`
      });
    }

    next();
  };
}

export default {
  requireRole
};
