import rateLimit from 'express-rate-limit';

export const attendanceRateLimiter = rateLimit({
    windowMs: 5 * 1000, // 5 seconds window
    max: 1, // Limit each user to 1 request per windowMs
    keyGenerator: (req) => {
        // This is a protected route, req.user.id will always exist.
        // We use string conversion to be safe.
        return String(req.user?.id || 'anonymous');
    },
    message: {
        message: 'Too many attendance requests. Please wait a few seconds.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false }, // Disable trust proxy validation if not needed
});
