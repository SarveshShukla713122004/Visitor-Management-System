// ─── Centralized Secure Error Response Helper ─────────────────────────────
// In production, never leak internal error messages to clients.

export const serverError = (res, err) => {
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    console.error('[ServerError]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
  // In production, only log internally — never expose stack traces or DB errors
  console.error('[ServerError]', err.message);
  return res.status(500).json({ success: false, message: 'An internal error occurred. Please try again.' });
};
