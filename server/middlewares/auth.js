import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;

      // Get current session ID for the institute
      const institute_id = req.user.institute_id || req.user.id;
      
      // Check for session override header (View Only Switch)
      const sessionOverride = req.headers['x-academic-session-id'];

      if (req.user.role !== 'admin') {
          try {
              if (sessionOverride && sessionOverride !== 'undefined' && !isNaN(parseInt(sessionOverride))) {
                  req.user.current_session_id = parseInt(sessionOverride);
              } else {
                  const sessionResult = await pool.query(
                    'SELECT current_session_id FROM institutes WHERE id = $1',
                    [institute_id]
                  );
                  
                  if (sessionResult.rows.length > 0 && sessionResult.rows[0].current_session_id) {
                    req.user.current_session_id = sessionResult.rows[0].current_session_id;
                  }
              }

              // Fallback
              if (!req.user.current_session_id) {
                const fallbackResult = await pool.query(
                    'SELECT id FROM academic_sessions WHERE institute_id = $1 AND is_active = true LIMIT 1',
                    [institute_id]
                );
                if (fallbackResult.rows.length > 0) {
                    req.user.current_session_id = fallbackResult.rows[0].id;
                }
              }

              // Update identity for session
              if (req.user.type === 'student' || req.user.type === 'teacher') {
                  const table = req.user.type === 'student' ? 'students' : 'teachers';
                  
                  let query, params;
                  if (req.user.type === 'student') {
                      query = `SELECT id, class, section FROM students WHERE unique_code = $1 AND session_id = $2 AND is_active = true`;
                      params = [req.user.unique_code || req.user.id, req.user.current_session_id];
                  } else {
                      // Teachers are session-independent now
                      query = `SELECT id FROM teachers WHERE unique_code = $1 AND is_active = true`;
                      params = [req.user.unique_code || req.user.id];
                  }
                  
                  const userResult = await pool.query(query, params);
                  
                  if (userResult.rows.length > 0) {
                      req.user.id = userResult.rows[0].id;
                      if (req.user.type === 'student') {
                          req.user.class = userResult.rows[0].class;
                          req.user.section = userResult.rows[0].section;
                      }
                  }
              }
          } catch (dbError) {
              console.error('Middleware Session Fetch Error:', dbError.message);
          }
      }

      next();
    } catch (error) {
      console.error('Protect Middleware Error:', error.message);
      return res.status(401).json({ message: 'Not authorized, token failed', error: error.message });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const principalOnly = (req, res, next) => {
  if (req.user && req.user.role === 'principal') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Principal only.' });
  }
};

const teacherOnly = (req, res, next) => {
  if (req.user && req.user.type === 'teacher') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Teacher only.' });
  }
};

const studentOnly = (req, res, next) => {
  if (req.user && req.user.type === 'student') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Student only.' });
  }
};

const staffOnly = (req, res, next) => {
  if (req.user && (
    req.user.type === 'teacher' ||
    req.user.role === 'principal' ||
    req.user.role === 'teacher' ||
    req.user.type === 'principal'
  )) {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Staff only.' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Admin only.' });
  }
};

const principalOrSpecialTeacher = (req, res, next) => {
  if (req.user && (
    req.user.role === 'principal' ||
    req.user.type === 'principal' ||
    (req.user.type === 'teacher' && req.user.special_permission === true)
  )) {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Requires principal or special teacher permission.' });
  }
};

export { protect, principalOnly, teacherOnly, studentOnly, staffOnly, adminOnly, principalOrSpecialTeacher };