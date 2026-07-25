// ─── Centralized Input Validation & Sanitization Middleware ──────────────────

// Sanitize string: trim, strip dangerous HTML/script tags, javascript URIs, NoSQL operators
const sanitize = (str) => {
  if (typeof str !== 'string') return str;
  // Preserve base64 image strings intact
  if (str.startsWith('data:image/')) return str;
  return str
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/\$/g, '')          // prevent MongoDB $where / $gt NoSQL operators
    .replace(/\{/g, '&#123;')    // escape braces
    .replace(/\}/g, '&#125;');
};

// Deep-sanitize req.body
export const sanitizeBody = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    const clean = (obj) => {
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'string') obj[key] = sanitize(obj[key]);
        else if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) clean(obj[key]);
        else if (Array.isArray(obj[key])) obj[key].forEach((item, i) => {
          if (typeof item === 'string') obj[key][i] = sanitize(item);
          else if (typeof item === 'object' && item !== null) clean(item);
        });
      }
    };
    clean(req.body);
  }
  next();
};
