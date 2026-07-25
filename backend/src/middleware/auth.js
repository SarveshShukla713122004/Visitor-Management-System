import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;

  // Accept token only from Authorization header (not query params or cookies)
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authenticated. Please log in.' });
  }

  // Reject obviously malformed tokens (basic guard)
  if (token.length < 20 || token.split('.').length !== 3) {
    return res.status(401).json({ success: false, message: 'Malformed authentication token.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],       // Enforce expected algorithm — prevents alg:none attacks
    });

    // Re-fetch user on every request to detect deactivation/role changes mid-session
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }

    // Block deactivated users immediately even if they still hold a valid token
    if (!user.active) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Contact Admin.',
      });
    }

    // Block locked-out users from making API requests
    if (user.isLocked && user.isLocked()) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked. Please try again later.',
      });
    }

    // Attach user and request metadata to req for downstream use
    req.user = user;
    req.userAgent = req.headers['user-agent'] || 'Unknown';
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid authentication token.' });
  }
};

// Usage: authorize('Admin') or authorize('Admin', 'Security')
export const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Role '${req.user?.role || 'unknown'}' is not authorised for this action.`,
    });
  }
  next();
};
