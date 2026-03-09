import pool from '../config/db.js';
import { uploadToS3, deleteFromS3, generateUniqueCode, sendStudentCredentials, sendTeacherCredentials } from '../utils/aws.js';
import { formatIndianDate, getTodayIST } from '../utils/date.js';
import { emitToAllStudents } from '../utils/socket.js';

const getDashboard = async (req, res) => {
  try {
    const instituteId = req.user.institute_id || req.user.id;
    let sessionId = req.headers['x-academic-session-id'] || req.user.current_session_id;
    const { date: queryDate } = req.query;
    const today = queryDate || getTodayIST();

    // Get institute details (to get current session if not provided)
    const instResult = await pool.query(
      'SELECT id, institute_name, principal_name, email, mobile, state, district, landmark, pincode, address, affiliation, logo_url, created_at, current_session_id FROM institutes WHERE id = $1',
      [instituteId]
    );

    if (instResult.rows.length === 0) {
      return res.status(404).json({ message: 'Institute not found' });
    }

    const institute = instResult.rows[0];
    if (!sessionId || sessionId === 'null' || sessionId === 'undefined') {
        sessionId = institute.current_session_id;
    }

    // Get basic counts
    const teacherCount = await pool.query('SELECT COUNT(*) FROM teachers WHERE institute_id = $1 AND is_active = true', [instituteId]);
    const studentCount = await pool.query('SELECT COUNT(*) FROM students WHERE institute_id = $1 AND session_id = $2 AND is_active = true AND admission_date <= $3::date', [instituteId, sessionId, today]);

    // --- Flashcard Logic ---

    // 1. Student Attendance Logic
    // Get total distinct sections
    const totalSectionsRes = await pool.query(
        `SELECT DISTINCT class, section FROM students WHERE institute_id = $1 AND session_id = $2 AND is_active = true AND admission_date <= $3::date`,
        [instituteId, sessionId, today]
    );
    const totalSections = totalSectionsRes.rows.length;

    // Get sections that have attendance taken today
    const markedSectionsRes = await pool.query(
        `SELECT DISTINCT class, section FROM attendance WHERE institute_id = $1 AND session_id = $2 AND date = $3`,
        [instituteId, sessionId, today]
    );
    const markedSectionsCount = markedSectionsRes.rows.length;
    const pendingSections = totalSections - markedSectionsCount;

    // Calculate current present count (even if pending)
    const presentCountRes = await pool.query(
        `SELECT COUNT(*) FROM attendance WHERE institute_id = $1 AND session_id = $2 AND date = $3 AND status = 'present'`,
        [instituteId, sessionId, today]
    );

    let studentAttendanceData = {
        status: pendingSections <= 0 && totalSections > 0 ? 'complete' : 'pending',
        pending_count: pendingSections,
        total_present: parseInt(presentCountRes.rows[0].count),
        total_students: parseInt(studentCount.rows[0].count)
    };

    // 2. Teacher Attendance Logic
    const teacherPresentRes = await pool.query(
        `SELECT COUNT(*) FROM teacher_self_attendance WHERE institute_id = $1 AND session_id = $2 AND date = $3 AND status = 'present'`,
        [instituteId, sessionId, today]
    );
    
    const teacherAttendanceData = {
        present: parseInt(teacherPresentRes.rows[0].count),
        total: parseInt(teacherCount.rows[0].count)
    };

    // 2.1 Teacher's Own Attendance Logic (New)
    let myAttendanceStats = null;
    if (req.user.role === 'teacher') {
        const myPresentRes = await pool.query(
            `SELECT COUNT(*) FROM teacher_self_attendance WHERE teacher_id = $1 AND institute_id = $2 AND session_id = $3 AND status = 'present'`,
            [req.user.id, instituteId, sessionId]
        );
        const myAbsentRes = await pool.query(
            `SELECT COUNT(*) FROM teacher_self_attendance WHERE teacher_id = $1 AND institute_id = $2 AND session_id = $3 AND status = 'absent'`,
            [req.user.id, instituteId, sessionId]
        );
        const myTotalDays = await pool.query(
            `SELECT COUNT(*) FROM teacher_self_attendance WHERE teacher_id = $1 AND institute_id = $2 AND session_id = $3`,
            [req.user.id, instituteId, sessionId]
        );
        myAttendanceStats = {
            present: parseInt(myPresentRes.rows[0].count),
            absent: parseInt(myAbsentRes.rows[0].count),
            total: parseInt(myTotalDays.rows[0].count)
        };
    }

    // 2.2 Staff Homework Stats (Principal or Teacher)
    let myHomeworkStats = null;
    const isStaff = req.user.role === 'teacher' || req.user.role === 'principal' || req.user.type === 'teacher' || req.user.type === 'principal';
    
    if (isStaff) {
        console.log(`[DashboardHW] Fetching for ${req.user.type}/${req.user.role} ID: ${req.user.id}, Date: ${today}`);
        
        const homeworkRes = await pool.query(
            `SELECT COUNT(DISTINCT (class, section)) as today_class_count
             FROM homework
             WHERE teacher_id = $1 AND homework_date::date = $2::date`,
            [req.user.id, today]
        );
        
        const count = parseInt(homeworkRes.rows[0].today_class_count || 0);
        console.log(`[DashboardHW] Result for ID ${req.user.id}: ${count} classes`);
        
        if (count > 0) {
            myHomeworkStats = {
                todayClassCount: count,
                has_hw_today: true
            };
        } else {
            myHomeworkStats = { no_hw_today: true };
        }
    }

    // 4. Today's Events from Academic Calendar
    const todayEventsRes = await pool.query(
        "SELECT title, description FROM academic_calendar WHERE institute_id = $1 AND session_id = $2 AND event_date = $3",
        [instituteId, sessionId, today]
    );

    // 5. REVENUE STATS for Dashboard Card (Specific to TODAY)
    const dailyMonthlyRes = await pool.query(
        `SELECT COALESCE(SUM(s.monthly_fees + CASE WHEN s.transport_facility THEN s.transport_fees ELSE 0 END), 0) as collected
         FROM students s
         JOIN student_fees f ON s.id = f.student_id AND f.session_id = $2
         WHERE s.institute_id = $1 AND f.paid_at::date = $3::date AND f.status = 'paid'`,
        [instituteId, sessionId, today]
    );

    const dailyExtraRes = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) as collected
         FROM monthly_extra_charges
         WHERE institute_id = $1 AND session_id = $2 AND created_at::date = $3::date AND status = 'paid'`,
        [instituteId, sessionId, today]
    );

    const dailyOneTimeRes = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) as collected
         FROM one_time_fee_transactions t
         JOIN one_time_fee_payments p ON t.payment_id = p.id
         JOIN one_time_fee_groups g ON p.group_id = g.id
         WHERE g.institute_id = $1 AND g.session_id = $2 AND t.created_at::date = $3::date`,
        [instituteId, sessionId, today]
    );

    const dailyTotal = parseFloat(dailyMonthlyRes.rows[0].collected || 0) + 
                       parseFloat(dailyExtraRes.rows[0].collected || 0) + 
                       parseFloat(dailyOneTimeRes.rows[0].collected || 0);

    const dashboardData = {
      institute,
      today_events: todayEventsRes.rows,
      stats: {
        totalTeachers: parseInt(teacherCount.rows[0].count),
        totalStudents: parseInt(studentCount.rows[0].count),
        totalClasses: 0,
      },
      flashcards: {
        student_attendance: studentAttendanceData,
        teacher_attendance: teacherAttendanceData,
        my_attendance: myAttendanceStats,
        my_homework: myHomeworkStats,
        revenue: {
            daily_total: dailyTotal,
            date: today
        }
      }
    };

    res.status(200).json(dashboardData);
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Server error fetching dashboard data' });
  }
};

// Add Student
const addStudent = async (req, res) => {
  try {
    const instituteId = req.user.institute_id || req.user.id;
    let sessionId = req.headers['x-academic-session-id'] || req.user.current_session_id;

    // Fallback if sessionId is null/undefined
    if (!sessionId || sessionId === 'null' || sessionId === 'undefined') {
      const sessionRes = await pool.query(
        'SELECT current_session_id FROM institutes WHERE id = $1',
        [instituteId]
      );
      sessionId = sessionRes.rows[0]?.current_session_id;
    }

    const {
      name,
      class: studentClass,
      section,
      roll_no,
      dob,
      gender,
      father_name,
      mother_name,
      mobile,
      email,
      address,
      transport_facility,
      monthly_fees,
      transport_fees,
      admission_date,
    } = req.body;

    // Validation
    if (!name || !studentClass || !section || !roll_no || !dob || !gender ||
      !father_name || !mother_name || !mobile || !email || !address) {
      return res.status(400).json({ message: 'Please fill all required fields' });
    }

    // Check if roll number already exists in same class/section and session
    const existing = await pool.query(
      'SELECT * FROM students WHERE institute_id = $1 AND roll_no = $2 AND class = $3 AND section = $4 AND session_id = $5',
      [instituteId, roll_no, studentClass, section, sessionId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Roll number already exists in this class/section' });
    }

    // Generate unique code
    let uniqueCode;
    let isUnique = false;
    while (!isUnique) {
      uniqueCode = generateUniqueCode();
      const checkCode = await pool.query('SELECT * FROM students WHERE unique_code = $1', [uniqueCode]);
      if (checkCode.rows.length === 0) isUnique = true;
    }

    // Upload photo to S3 if exists (store in students folder)
    let photoUrl = null;
    if (req.file) {
      photoUrl = await uploadToS3(req.file.buffer, req.file.originalname, req.file.mimetype, 'students');
    }

    // Insert student
    const result = await pool.query(
      `INSERT INTO students 
      (institute_id, unique_code, name, class, section, roll_no, dob, gender, 
       father_name, mother_name, mobile, email, address, transport_facility, photo_url, session_id, monthly_fees, transport_fees, admission_date) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, COALESCE($19, CURRENT_DATE)) 
      RETURNING *`,
      [instituteId, uniqueCode, name, studentClass, section, roll_no, dob, gender,
        father_name, mother_name, mobile, email, address, transport_facility === 'true', photoUrl, sessionId,
        parseFloat(monthly_fees || 0), parseFloat(transport_fees || 0), admission_date || null]
    );

    const student = result.rows[0];

    // Get institute name for email
    const instituteResult = await pool.query('SELECT institute_name FROM institutes WHERE id = $1', [instituteId]);
    const instituteName = instituteResult.rows[0].institute_name;

    // Send email with credentials
    const studentDetails = {
      name,
      class: studentClass,
      section,
      roll_no,
      dob: formatIndianDate(dob),
      father_name,
      mother_name,
      mobile,
      transport_facility: transport_facility === 'true',
      monthly_fees: parseFloat(monthly_fees || 0),
      transport_fees: parseFloat(transport_fees || 0),
    };

    sendStudentCredentials(email, name, uniqueCode, instituteName, studentDetails).catch(err => {
      console.error('Failed to send student email:', err);
    });

    res.status(201).json({
      message: 'Student added successfully',
      student: {
        ...student,
        dob: formatIndianDate(student.dob),
      },
    });
  } catch (error) {
    console.error('Add student error:', error);
    res.status(500).json({ message: 'Server error while adding student' });
  }
};

// Helper to parse "Month YYYY" to a Date object (first day of month)
const parseMonthYear = (monthStr) => {
    if (!monthStr || typeof monthStr !== 'string') return null;
    const [monthName, year] = monthStr.split(' ');
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthIndex = months.indexOf(monthName);
    if (monthIndex === -1) return null;
    return new Date(parseInt(year), monthIndex, 1);
};

// Get all students for institute
const getStudents = async (req, res) => {
  try {
    const instituteId = req.user.institute_id || req.user.id;
    let sessionId = req.headers['x-academic-session-id'] || req.user.current_session_id;

    // Fallback if sessionId is null/undefined
    if (!sessionId || sessionId === 'null' || sessionId === 'undefined') {
        const sessionResult = await pool.query(
            'SELECT current_session_id FROM institutes WHERE id = $1',
            [instituteId]
        );
        sessionId = sessionResult.rows[0]?.current_session_id;
    }

    if (!sessionId) {
        return res.status(400).json({ message: 'No active academic session found for this institute' });
    }

    const { date, class: className, section } = req.query;
    let query = 'SELECT * FROM students WHERE institute_id = $1 AND session_id = $2 AND is_active = true';
    const params = [instituteId, sessionId];
    let paramCount = 2;

    if (date && date !== 'undefined' && date !== '') {
        paramCount++;
        query += ` AND admission_date <= $${paramCount}::date`;
        params.push(date);
    }

    if (className) {
        paramCount++;
        query += ` AND class = $${paramCount}`;
        params.push(className);
    }

    if (section) {
        paramCount++;
        query += ` AND section = $${paramCount}`;
        params.push(section);
    }

    query += ' ORDER BY class, section, roll_no';

    const result = await pool.query(query, params);

    const students = result.rows.map(student => ({
      ...student,
      dob: formatIndianDate(student.dob),
    }));

    res.status(200).json({ students });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ message: 'Server error while fetching students' });
  }
};

// Update Student
const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      class: studentClass,
      section,
      roll_no,
      dob,
      gender,
      father_name,
      mother_name,
      mobile,
      email,
      address,
      transport_facility,
      monthly_fees,
      transport_fees,
      delete_photo, // Flag to delete existing photo
    } = req.body;

    // Validation checks similarly as addStudent
    if (!name || !studentClass || !section || !roll_no || !dob || !gender ||
      !father_name || !mother_name || !mobile || !email || !address) {
      return res.status(400).json({ message: 'Please fill all required fields' });
    }

    // Get existing student to check for photo
    const existingStudent = await pool.query('SELECT * FROM students WHERE id = $1', [id]);
    if (existingStudent.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }
    const currentStudent = existingStudent.rows[0];

    // Check roll no uniqueness if changed
    if (currentStudent.roll_no !== roll_no || currentStudent.class !== studentClass || currentStudent.section !== section) {
      const checkRoll = await pool.query(
        'SELECT * FROM students WHERE institute_id = $1 AND roll_no = $2 AND class = $3 AND section = $4 AND id != $5',
        [req.user.institute_id, roll_no, studentClass, section, id]
      );
      if (checkRoll.rows.length > 0) {
        return res.status(400).json({ message: 'Roll number already exists in this class/section' });
      }
    }

    let photoUrl = currentStudent.photo_url;

    // Handle Photo Logic
    if (req.file) {
      // New photo provided
      // 1. Delete old photo if exists
      if (currentStudent.photo_url) {
        await deleteFromS3(currentStudent.photo_url);
      }
      // 2. Upload new photo
      photoUrl = await uploadToS3(req.file.buffer, req.file.originalname, req.file.mimetype, 'students');
    } else if (delete_photo === 'true') {
      // Requested to delete photo
      if (currentStudent.photo_url) {
        await deleteFromS3(currentStudent.photo_url);
      }
      photoUrl = null;
    }

    // Update DB
    const result = await pool.query(
      `UPDATE students 
       SET name = $1, class = $2, section = $3, roll_no = $4, dob = $5, gender = $6, 
           father_name = $7, mother_name = $8, mobile = $9, email = $10, address = $11, 
           transport_facility = $12, photo_url = $13, monthly_fees = $14, transport_fees = $15
       WHERE id = $16 RETURNING *`,
      [name, studentClass, section, roll_no, dob, gender, father_name, mother_name,
        mobile, email, address, transport_facility === 'true', photoUrl, 
        parseFloat(monthly_fees || 0), parseFloat(transport_fees || 0), id]
    );

    res.status(200).json({
      message: 'Student updated successfully',
      student: {
        ...result.rows[0],
        dob: formatIndianDate(result.rows[0].dob),
      },
    });

  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ message: 'Server error while updating student' });
  }
};

// Add Teacher
const addTeacher = async (req, res) => {
  try {
    const instituteId = req.user.institute_id || req.user.id;
    const {
      name,
      dob,
      mobile,
      email,
      subject,
      qualification,
      gender,
      address,
      special_permission,
    } = req.body;

    // Validation
    if (!name || !dob || !mobile || !email || !subject || !qualification || !gender || !address) {
      return res.status(400).json({ message: 'Please fill all required fields' });
    }

    // Generate unique code
    let uniqueCode;
    let isUnique = false;
    while (!isUnique) {
      uniqueCode = generateUniqueCode();
      const checkCode = await pool.query('SELECT * FROM teachers WHERE unique_code = $1', [uniqueCode]);
      if (checkCode.rows.length === 0) isUnique = true;
    }

    // Upload photo to S3 if exists (store in teachers folder)
    let photoUrl = null;
    if (req.file) {
      photoUrl = await uploadToS3(req.file.buffer, req.file.originalname, req.file.mimetype, 'teachers');
    }

    // Insert teacher
    const result = await pool.query(
      `INSERT INTO teachers 
      (institute_id, unique_code, name, dob, mobile, email, subject, qualification, 
       gender, address, photo_url, special_permission) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
      RETURNING *`,
      [instituteId, uniqueCode, name, dob, mobile, email, subject, qualification,
        gender, address, photoUrl, special_permission === 'true']
    );

    const teacher = result.rows[0];

    // Get institute name for email
    const instituteResult = await pool.query('SELECT institute_name FROM institutes WHERE id = $1', [instituteId]);
    const instituteName = instituteResult.rows[0].institute_name;

    // Send email with credentials
    const teacherDetails = {
      name,
      subject,
      qualification,
      dob: formatIndianDate(dob),
      mobile,
      email,
      special_permission: special_permission === 'true',
    };

    sendTeacherCredentials(email, name, uniqueCode, instituteName, teacherDetails).catch(err => {
      console.error('Failed to send teacher email:', err);
    });

    res.status(201).json({
      message: 'Teacher added successfully',
      teacher: {
        ...teacher,
        dob: formatIndianDate(teacher.dob),
      },
    });
  } catch (error) {
    console.error('Add teacher error:', error);
    res.status(500).json({ message: 'Server error while adding teacher' });
  }
};

// Update Teacher
const updateTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      dob,
      mobile,
      email,
      subject,
      qualification,
      gender,
      address,
      special_permission,
      delete_photo,
    } = req.body;

    // Validation
    if (!name || !dob || !mobile || !email || !subject || !qualification || !gender || !address) {
      return res.status(400).json({ message: 'Please fill all required fields' });
    }

    // Get existing teacher
    const existingTeacher = await pool.query('SELECT * FROM teachers WHERE id = $1', [id]);
    if (existingTeacher.rows.length === 0) {
      return res.status(404).json({ message: 'Teacher not found' });
    }
    const currentTeacher = existingTeacher.rows[0];

    let photoUrl = currentTeacher.photo_url;

    // Handle Photo Logic
    if (req.file) {
      if (currentTeacher.photo_url) {
        await deleteFromS3(currentTeacher.photo_url);
      }
      photoUrl = await uploadToS3(req.file.buffer, req.file.originalname, req.file.mimetype, 'teachers');
    } else if (delete_photo === 'true') {
      if (currentTeacher.photo_url) {
        await deleteFromS3(currentTeacher.photo_url);
      }
      photoUrl = null;
    }

    // Update DB
    const result = await pool.query(
      `UPDATE teachers 
       SET name = $1, dob = $2, mobile = $3, email = $4, subject = $5, qualification = $6, 
           gender = $7, address = $8, special_permission = $9, photo_url = $10
       WHERE id = $11 RETURNING *`,
      [name, dob, mobile, email, subject, qualification, gender, address,
        special_permission === 'true', photoUrl, id]
    );

    res.status(200).json({
      message: 'Teacher updated successfully',
      teacher: {
        ...result.rows[0],
        dob: formatIndianDate(result.rows[0].dob),
      },
    });

  } catch (error) {
    console.error('Update teacher error:', error);
    res.status(500).json({ message: 'Server error while updating teacher' });
  }
};

// Search Entities
const searchEntities = async (req, res) => {
  try {
    const { query } = req.query;
    const instituteId = req.user.institute_id || req.user.id;

    if (!query || query.length < 2) {
      return res.status(400).json({ message: 'Query must be at least 2 characters' });
    }

    const searchPattern = `%${query}%`;

    // Search students - only active ones and current session
    const students = await pool.query(
      `SELECT id, name, class, section, roll_no, unique_code, photo_url, 'student' as type 
       FROM students 
       WHERE institute_id = $1 AND session_id = $2 AND is_active = true AND (name ILIKE $3 OR roll_no ILIKE $3) 
       LIMIT 10`,
      [instituteId, req.user.current_session_id, searchPattern]
    );

    // Search teachers - only active ones
    const teachers = await pool.query(
      `SELECT id, name, subject, qualification, photo_url, 'teacher' as type 
       FROM teachers 
       WHERE institute_id = $1 AND is_active = true AND (name ILIKE $2 OR subject ILIKE $2) 
       LIMIT 10`,
      [instituteId, searchPattern]
    );

    const results = [...students.rows, ...teachers.rows];

    res.status(200).json({ results });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Server error while searching' });
  }
};

// Get Profile
const getProfile = async (req, res) => {
  try {
    const instituteId = req.user.institute_id || req.user.id;
    const result = await pool.query(
      'SELECT id, institute_name, principal_name, email, mobile, state, district, landmark, pincode, address, affiliation, logo_url, principal_photo_url, current_session_id, bank_name, account_number, ifsc_code, account_holder_name FROM institutes WHERE id = $1',
      [instituteId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Institute not found' });
    }

    res.status(200).json({ profile: result.rows[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
};

// Update Profile
const updateProfile = async (req, res) => {
  try {
    const instituteId = req.user.institute_id || req.user.id;
    const {
      institute_name,
      principal_name,
      email,
      mobile,
      address,
      state,
      district,
      landmark,
      pincode,
      affiliation,
      delete_logo,
      delete_principal_photo,
      bank_name,
      account_number,
      ifsc_code,
      account_holder_name,
    } = req.body;

    // Get current profile
    const current = await pool.query('SELECT * FROM institutes WHERE id = $1', [instituteId]);
    if (current.rows.length === 0) return res.status(404).json({ message: 'Institute not found' });

    const currentProfile = current.rows[0];
    let logoUrl = currentProfile.logo_url;
    let principalPhotoUrl = currentProfile.principal_photo_url;
    const currentEmail = currentProfile.email;

    // Check email uniqueness if changed
    if (email && email !== currentEmail) {
      const emailCheck = await pool.query('SELECT id FROM institutes WHERE email = $1', [email]);
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ message: 'Email already currently in use by another institute' });
      }
    }

    // Handle Logo
    if (req.files && req.files.logo) {
      if (logoUrl) await deleteFromS3(logoUrl);
      const file = req.files.logo[0];
      logoUrl = await uploadToS3(file.buffer, file.originalname, file.mimetype, 'logos');
    } else if (delete_logo === 'true') {
      if (logoUrl) await deleteFromS3(logoUrl);
      logoUrl = null;
    }

    // Handle Principal Photo
    if (req.files && req.files.principal_photo) {
      if (principalPhotoUrl) await deleteFromS3(principalPhotoUrl);
      const file = req.files.principal_photo[0];
      principalPhotoUrl = await uploadToS3(file.buffer, file.originalname, file.mimetype, 'principals');
    } else if (delete_principal_photo === 'true') {
      if (principalPhotoUrl) await deleteFromS3(principalPhotoUrl);
      principalPhotoUrl = null;
    }

    // Update DB - use provided value or fall back to current value
    const result = await pool.query(
      `UPDATE institutes 
       SET institute_name = $1, principal_name = $2, email = $3, mobile = $4, address = $5, 
           state = $6, district = $7, landmark = $8, pincode = $9, affiliation = $10, logo_url = $11, principal_photo_url = $12,
           bank_name = $13, account_number = $14, ifsc_code = $15, account_holder_name = $16
       WHERE id = $17 RETURNING *`,
      [
        institute_name !== undefined ? institute_name : currentProfile.institute_name,
        principal_name !== undefined ? principal_name : currentProfile.principal_name,
        email !== undefined ? email : currentProfile.email,
        mobile !== undefined ? mobile : currentProfile.mobile,
        address !== undefined ? address : currentProfile.address,
        state !== undefined ? state : currentProfile.state,
        district !== undefined ? district : currentProfile.district,
        landmark !== undefined ? landmark : currentProfile.landmark,
        pincode !== undefined ? pincode : currentProfile.pincode,
        affiliation !== undefined ? affiliation : currentProfile.affiliation,
        logoUrl,
        principalPhotoUrl,
        bank_name !== undefined ? bank_name : currentProfile.bank_name,
        account_number !== undefined ? account_number : currentProfile.account_number,
        ifsc_code !== undefined ? ifsc_code : currentProfile.ifsc_code,
        account_holder_name !== undefined ? account_holder_name : currentProfile.account_holder_name,
        instituteId
      ]
    );

    res.status(200).json({
      message: 'Profile updated successfully',
      profile: result.rows[0]
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
};

// Get all teachers for institute
const getTeachers = async (req, res) => {
  try {
    const instituteId = req.user.institute_id || req.user.id;

    const result = await pool.query(
      'SELECT * FROM teachers WHERE institute_id = $1 AND is_active = true ORDER BY name',
      [instituteId]
    );

    const teachers = result.rows.map(teacher => ({
      ...teacher,
      dob: formatIndianDate(teacher.dob),
    }));

    res.status(200).json({ teachers });
  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({ message: 'Server error while fetching teachers' });
  }
};

// Delete Student
const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = req.user.institute_id;

    // Get student to check ownership and photo
    const student = await pool.query(
      'SELECT * FROM students WHERE id = $1 AND institute_id = $2',
      [id, instituteId]
    );

    if (student.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Delete photo from S3 if exists
    if (student.rows[0].photo_url) {
      await deleteFromS3(student.rows[0].photo_url);
    }

    // Soft delete by setting is_active = false
    await pool.query(
      'UPDATE students SET is_active = false WHERE id = $1',
      [id]
    );

    res.status(200).json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ message: 'Server error while deleting student' });
  }
};

// Delete Teacher
const deleteTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const instituteId = req.user.institute_id;

    // Get teacher to check ownership and photo
    const teacher = await pool.query(
      'SELECT * FROM teachers WHERE id = $1 AND institute_id = $2',
      [id, instituteId]
    );

    if (teacher.rows.length === 0) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    // Delete photo from S3 if exists
    if (teacher.rows[0].photo_url) {
      await deleteFromS3(teacher.rows[0].photo_url);
    }

    // Soft delete by setting is_active = false
    await pool.query(
      'UPDATE teachers SET is_active = false WHERE id = $1',
      [id]
    );

    res.status(200).json({ message: 'Teacher deleted successfully' });
  } catch (error) {
    console.error('Delete teacher error:', error);
    res.status(500).json({ message: 'Server error while deleting teacher' });
  }
};

// Collect Fee
const collectFee = async (req, res) => {
  try {
    const { id } = req.params;
    const { month, year } = req.body;
    const instituteId = req.user.institute_id || req.user.id;
    const sessionId = req.user.current_session_id;
    const collectedByName = req.user.name || 'Principal'; // Name from JWT

    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year are required' });
    }

    // Check student existence and ownership
    const student = await pool.query(
      'SELECT id, name FROM students WHERE id = $1 AND institute_id = $2',
      [id, instituteId]
    );

    if (student.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Insert or update status in student_fees
    await pool.query(
      `INSERT INTO student_fees (student_id, institute_id, session_id, month, year, status, paid_at, collected_by, payment_method) 
       VALUES ($1, $2, $3, $4, $5, 'paid', NOW(), $6, 'Cash')
       ON CONFLICT (student_id, month, year, session_id) 
       DO UPDATE SET status = 'paid', paid_at = NOW(), collected_by = $6, payment_method = 'Cash'`,
      [id, instituteId, sessionId, parseInt(month), parseInt(year), collectedByName]
    );

    // Also mark all extra charges for this student, month, year as paid
    await pool.query(
        `UPDATE monthly_extra_charges SET status = 'paid' 
         WHERE student_id = $1 AND institute_id = $2 AND session_id = $3 AND month = $4 AND year = $5`,
        [id, instituteId, sessionId, parseInt(month), parseInt(year)]
    );

    // 3. Notify Principal & Special Teachers via Socket and Push
    const monthsNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const notifTitle = 'Manual Fee Collected';
    const notifBody = `Cash payment collected for ${student.rows[0].name} (${monthsNames[month - 1]} ${year}).`;

    // Socket Notification to Principal
    const { emitToPrincipal, emitToSpecificTeacher, emitToStudent } = await import('../utils/socket.js');
    emitToPrincipal(instituteId, 'fee_payment_received', {
        studentId: id,
        studentName: student.rows[0].name,
        month,
        year,
        type: 'MONTHLY',
        title: notifTitle,
        message: notifBody
    });

    // Notify Student
    const studentPushTokenRes = await pool.query('SELECT push_token FROM students WHERE id = $1', [id]);
    const studentPushToken = studentPushTokenRes.rows[0]?.push_token;
    const studentNotifTitle = 'Fee Payment Confirmed';
    const studentNotifBody = `Your fee for ${monthsNames[month - 1]} ${year} has been marked as PAID.`;

    emitToStudent(id, 'fee_payment_received', {
        title: studentNotifTitle,
        message: studentNotifBody,
        type: 'fees'
    });

    if (studentPushToken) {
        const { sendPushNotification } = await import('../utils/pushNotification.js');
        await sendPushNotification([studentPushToken], studentNotifTitle, studentNotifBody, { type: 'fee_payment' });
    }

    // Push Notification Logic for Staff
    const principalPushToken = await pool.query('SELECT push_token FROM institutes WHERE id = $1', [instituteId]);
    const specialTeachers = await pool.query('SELECT id, push_token FROM teachers WHERE institute_id = $1 AND special_permission = true', [instituteId]);
    
    const tokens = [];
    if (principalPushToken.rows[0]?.push_token) tokens.push(principalPushToken.rows[0].push_token);
    
    specialTeachers.rows.forEach(t => {
        if (t.push_token) {
            tokens.push(t.push_token);
            emitToSpecificTeacher(t.id, 'fee_payment_received', {
                title: notifTitle,
                message: notifBody,
                type: 'fees'
            });
        }
    });

    if (tokens.length > 0) {
        const { sendPushNotification } = await import('../utils/pushNotification.js');
        await sendPushNotification(tokens, notifTitle, notifBody, { type: 'fee_payment' });
    }

    res.status(200).json({ message: `Fee collected for ${student.rows[0].name} for month ${month}/${year}` });
  } catch (error) {
    console.error('Collect fee error:', error);
    res.status(500).json({ message: 'Server error while collecting fee' });
  }
};

// Get Fees Status for a month/year
const getFeesStatus = async (req, res) => {
    try {
        const instituteId = req.user.institute_id || req.user.id;
        let sessionId = req.user.current_session_id;
        const { month, year } = req.query;

        if (!month || !year) {
            return res.status(400).json({ message: 'Month and year are required' });
        }

        // Fallback: If sessionId is not in req.user, try to find the active session for this institute
        if (!sessionId) {
            const sessionRes = await pool.query(
                'SELECT id FROM academic_sessions WHERE institute_id = $1 AND is_active = true LIMIT 1',
                [instituteId]
            );
            sessionId = sessionRes.rows[0]?.id;
        }

        if (!sessionId) {
            return res.status(200).json({ students: [], message: 'No academic session found' });
        }

        // Get all active students admitted on or before the target month and their fee status
        const query = `
            SELECT s.*, 
            CASE WHEN f.status = 'paid' THEN 'paid' ELSE 'pending' END as month_fee_status,
            f.payment_method, f.transaction_id, f.collected_by, f.paid_at, f.month, f.year
            FROM students s
            LEFT JOIN student_fees f ON s.id = f.student_id 
                AND f.month = $3::integer AND f.year = $4::integer AND f.session_id = $2
            WHERE s.institute_id = $1 
              AND s.session_id = $2 
              AND s.is_active = true
              AND s.admission_date <= ($4::text || '-' || $3::text || '-01')::date + interval '1 month' - interval '1 day'
            ORDER BY s.class, s.section, s.roll_no
        `;
        const params = [instituteId, sessionId, parseInt(month), parseInt(year)];
        const result = await pool.query(query, params);

        // Fetch extra charges for all students in this month
        const extraChargesRes = await pool.query(
            `SELECT * FROM monthly_extra_charges 
             WHERE institute_id = $1 AND session_id = $2 AND month = $3::integer AND year = $4::integer`,
            [instituteId, sessionId, parseInt(month), parseInt(year)]
        );

        const extraChargesMap = extraChargesRes.rows.reduce((acc, charge) => {
            if (!acc[charge.student_id]) acc[charge.student_id] = [];
            acc[charge.student_id].push(charge);
            return acc;
        }, {});

        const students = result.rows.map(student => ({
            ...student,
            dob: formatIndianDate(student.dob),
            fee_status: student.month_fee_status, // Override current fee_status with the monthly one
            // Ensure receipt fields are explicit if not already caught by spread
            payment_method: student.payment_method,
            transaction_id: student.transaction_id,
            collected_by: student.collected_by,
            paid_at: student.paid_at,
            extra_charges: extraChargesMap[student.id] || []
        }));

        res.status(200).json({ students });
    } catch (error) {
        console.error('Get fees status error:', error);
        res.status(500).json({ message: 'Server error while fetching fees status' });
    }
};

// Publish One Time Fee
// Get Comprehensive Stats for Principal Dashboard
const getStats = async (req, res) => {
    try {
        console.log('[Stats] Fetching stats for Principal...');
        const instituteId = req.user.institute_id || req.user.id;
        let sessionId = req.headers['x-academic-session-id'] || req.user.current_session_id;

        // Fallback if sessionId is null/undefined
        if (!sessionId || sessionId === 'null' || sessionId === 'undefined') {
          const sessionRes = await pool.query(
            'SELECT current_session_id FROM institutes WHERE id = $1',
            [instituteId]
          );
          sessionId = sessionRes.rows[0]?.current_session_id;
        }

        const { month, year, date: queryDate } = req.query;

        if (!sessionId) {
            console.log('[Stats] No session ID found in request');
            return res.status(400).json({ message: 'No active academic session found' });
        }

        const statsDate = queryDate || getTodayIST();
        console.log(`[Stats] Params - Institute: ${instituteId}, Session: ${sessionId}, Date: ${statsDate}`);

        // 1. STUDENT & TEACHER STATS
        const studentsCountResult = await pool.query(
            'SELECT COUNT(*) FROM students WHERE institute_id = $1 AND session_id = $2 AND is_active = true',
            [instituteId, sessionId]
        );
        const teachersCountResult = await pool.query(
            'SELECT COUNT(*) FROM teachers WHERE institute_id = $1 AND is_active = true',
            [instituteId]
        );

        const studentsByGender = await pool.query(
            'SELECT gender, COUNT(*) FROM students WHERE institute_id = $1 AND session_id = $2 AND is_active = true GROUP BY gender',
            [instituteId, sessionId]
        );

        const studentsByClass = await pool.query(
            'SELECT class, COUNT(*) FROM students WHERE institute_id = $1 AND session_id = $2 AND is_active = true GROUP BY class ORDER BY class',
            [instituteId, sessionId]
        );

        // 2. ATTENDANCE STATS
        console.log('[Stats] Fetching attendance stats...');
        const studentAttendanceToday = await pool.query(
            `SELECT status, COUNT(*) FROM attendance WHERE institute_id = $1 AND session_id = $2 AND date = $3 GROUP BY status`,
            [instituteId, sessionId, statsDate]
        );

        const teacherAttendanceToday = await pool.query(
            `SELECT status, COUNT(*) FROM teacher_self_attendance WHERE institute_id = $1 AND session_id = $2 AND date = $3 GROUP BY status`,
            [instituteId, sessionId, statsDate]
        );

        const teacherAttendanceList = await pool.query(
            `SELECT t.id, t.name, t.photo_url, t.subject, COALESCE(tsa.status, 'unmarked') as status
             FROM teachers t
             LEFT JOIN teacher_self_attendance tsa ON t.id = tsa.teacher_id AND tsa.date = $3 AND tsa.session_id = $2
             WHERE t.institute_id = $1 AND t.is_active = true
             ORDER BY t.name`,
            [instituteId, sessionId, statsDate]
        );

        const granularAttendance = await pool.query(
            `SELECT s.class, s.section, COUNT(s.id)::int as total_students, COUNT(a.id) FILTER (WHERE a.status = 'present')::int as present_students
             FROM students s
             LEFT JOIN attendance a ON s.id = a.student_id AND a.date = $3 AND a.session_id = $2
             WHERE s.institute_id = $1 AND s.session_id = $2 AND s.is_active = true
             GROUP BY s.class, s.section
             ORDER BY s.class, s.section`,
            [instituteId, sessionId, statsDate]
        );

        // 3. REVENUE STATS (New)
        console.log('[Stats] Fetching revenue stats...');
        const statsMonth = month ? parseInt(month) : new Date(statsDate).getMonth() + 1;
        const statsYear = year ? parseInt(year) : new Date(statsDate).getFullYear();

        // Monthly Fees Stats ( Tuition + Transport + Extra Charges )
        const monthlyRevenueRes = await pool.query(
            `SELECT 
                (SELECT COALESCE(SUM(monthly_fees + CASE WHEN transport_facility THEN transport_fees ELSE 0 END), 0) 
                 FROM students WHERE institute_id = $1 AND session_id = $2 AND is_active = true
                 AND admission_date <= MAKE_DATE($4::int, $3::int, 1) + interval '1 month' - interval '1 day') +
                (SELECT COALESCE(SUM(amount), 0) FROM monthly_extra_charges 
                 WHERE institute_id = $1 AND session_id = $2 AND month = $3::integer AND year = $4::integer) as expected,
                
                (SELECT COALESCE(SUM(s.monthly_fees + CASE WHEN s.transport_facility THEN s.transport_fees ELSE 0 END), 0)
                 FROM students s
                 JOIN student_fees f ON s.id = f.student_id AND f.month = $3::integer AND f.year = $4::integer AND f.session_id = $2
                 WHERE s.institute_id = $1 AND s.session_id = $2 AND s.is_active = true AND f.status = 'paid') +
                (SELECT COALESCE(SUM(amount), 0) FROM monthly_extra_charges 
                 WHERE institute_id = $1 AND session_id = $2 AND month = $3::integer AND year = $4::integer AND status = 'paid') as collected`,
            [instituteId, sessionId, statsMonth, statsYear]
        );

        // One-Time Fees Stats - Expected is total for session, Collected is for THIS month
        const oneTimeExpectedRes = await pool.query(
            `SELECT COALESCE(SUM(due_amount), 0) as expected
             FROM one_time_fee_payments p
             JOIN one_time_fee_groups g ON p.group_id = g.id
             WHERE g.institute_id = $1 AND g.session_id = $2`,
            [instituteId, sessionId]
        );

        const oneTimeCollectedRes = await pool.query(
            `SELECT COALESCE(SUM(amount), 0) as collected
             FROM one_time_fee_transactions t
             JOIN one_time_fee_payments p ON t.payment_id = p.id
             JOIN one_time_fee_groups g ON p.group_id = g.id
             WHERE g.institute_id = $1 AND g.session_id = $2 
             AND EXTRACT(MONTH FROM t.created_at) = $3 
             AND EXTRACT(YEAR FROM t.created_at) = $4`,
            [instituteId, sessionId, statsMonth, statsYear]
        );

        const revenueStats = {
            monthly: {
                expected: parseFloat(monthlyRevenueRes.rows[0].expected || 0),
                collected: parseFloat(monthlyRevenueRes.rows[0].collected || 0)
            },
            oneTime: {
                expected: parseFloat(oneTimeExpectedRes.rows[0].expected || 0),
                collected: parseFloat(oneTimeCollectedRes.rows[0].collected || 0)
            },
            month: statsMonth,
            year: statsYear
        };

        const attendanceStats = {
            today: {
                students: studentAttendanceToday.rows,
                teachers: teacherAttendanceToday.rows,
                byClassSection: granularAttendance.rows,
                teacherList: teacherAttendanceList.rows
            },
            date: statsDate
        };

        res.status(200).json({
            students: {
                total: parseInt(studentsCountResult.rows[0].count),
                byGender: studentsByGender.rows,
                byClass: studentsByClass.rows
            },
            teachers: {
                total: parseInt(teachersCountResult.rows[0].count)
            },
            revenue: revenueStats,
            attendance: attendanceStats
        });

    } catch (error) {
        console.error('[Stats] Get stats error:', error);
        res.status(500).json({ message: 'Server error while fetching statistics', error: error.message });
    }
};

// Get detailed student list for a section and date (Present/Absent)
const getAttendanceListBySection = async (req, res) => {
    try {
        const instituteId = req.user.institute_id || req.user.id;
        const sessionId = req.user.current_session_id;
        const { className, section, date } = req.query;

        if (!className || !section || !date) {
            return res.status(400).json({ message: 'Class, section and date are required' });
        }

        const result = await pool.query(
            `SELECT s.id, s.name, s.roll_no, s.photo_url, COALESCE(a.status, 'unmarked') as status
             FROM students s
             LEFT JOIN attendance a ON s.id = a.student_id AND a.date = $4 AND a.session_id = $3
             WHERE s.institute_id = $1 AND s.session_id = $3 AND s.class = $2 AND s.section = $5 
               AND s.is_active = true AND s.admission_date <= $4::date
             ORDER BY s.roll_no`,
            [instituteId, className, sessionId, date, section]
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Get attendance list error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get students by specific session (for promotion tracking)
const getStudentsBySession = async (req, res) => {
    try {
        const instituteId = req.user.institute_id || req.user.id;
        const { sessionId } = req.params;

        const result = await pool.query(
            'SELECT unique_code FROM students WHERE institute_id = $1 AND session_id = $2 AND is_active = true',
            [instituteId, sessionId]
        );

        res.status(200).json({ codes: result.rows.map(r => r.unique_code) });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching session students' });
    }
};

// Get Monthly Fee Activation Status
const getMonthlyActivationStatus = async (req, res) => {
    try {
        const instituteId = req.user.institute_id || req.user.id;
        let sessionId = req.user.current_session_id;
        const { month, year } = req.query;

        if (!month || !year) {
            return res.status(400).json({ message: 'Month and year are required' });
        }

        if (!sessionId) {
            const sessionRes = await pool.query(
                'SELECT id FROM academic_sessions WHERE institute_id = $1 AND is_active = true LIMIT 1',
                [instituteId]
            );
            sessionId = sessionRes.rows[0]?.id;
        }

        if (!sessionId) {
            return res.status(200).json({ activated: false });
        }

        const result = await pool.query(
            `SELECT is_activated FROM monthly_fee_activations 
             WHERE institute_id = $1 AND session_id = $2 AND month = $3 AND year = $4`,
            [instituteId, sessionId, parseInt(month), parseInt(year)]
        );

        res.status(200).json({ activated: result.rows[0]?.is_activated || false });
    } catch (error) {
        console.error('Get monthly activation status error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Toggle Monthly Fee Activation
const toggleMonthlyActivation = async (req, res) => {
    try {
        const instituteId = req.user.institute_id || req.user.id;
        const sessionId = req.user.current_session_id;
        const { month, year, activate } = req.body;

        if (!month || !year || activate === undefined) {
            return res.status(400).json({ message: 'Month, year and activate flag are required' });
        }

        await pool.query(
            `INSERT INTO monthly_fee_activations (institute_id, session_id, month, year, is_activated)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (institute_id, session_id, month, year) 
             DO UPDATE SET is_activated = $5, activated_at = NOW()`,
            [instituteId, sessionId, parseInt(month), parseInt(year), activate]
        );

        if (activate) {
            // Fetch some stats for the flashcard
            const months = [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            ];
            
            const notifTitle = 'Monthly Fees Published';
            const notifBody = `Fees structure for ${months[parseInt(month) - 1]} ${year} has been published.`;

            // Emit socket event to all students
            emitToAllStudents(instituteId, 'monthly_fees_activated', {
                month: parseInt(month),
                year: parseInt(year),
                monthName: months[parseInt(month) - 1],
                timestamp: new Date().toISOString(),
                title: notifTitle,
                message: notifBody
            });

            // Send Push Notifications to all students
            try {
                const studentsRes = await pool.query(
                    'SELECT push_token FROM students WHERE institute_id = $1 AND push_token IS NOT NULL AND push_token != $2',
                    [instituteId, '']
                );
                const tokens = studentsRes.rows.map(r => r.push_token);
                if (tokens.length > 0) {
                    const { sendPushNotification } = await import('../utils/pushNotification.js');
                    await sendPushNotification(tokens, notifTitle, notifBody, { type: 'monthly_fee' });
                }
            } catch (pErr) {
                console.error('[MonthlyFeeNotif] Push failed:', pErr);
            }
        }

        res.status(200).json({ 
            message: activate ? 'Monthly fees activated successfully' : 'Monthly fees deactivated',
            activated: activate 
        });
    } catch (error) {
        console.error('Toggle monthly activation error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const addExtraCharge = async (req, res) => {
    try {
        const instituteId = req.user.institute_id || req.user.id;
        const sessionId = req.user.current_session_id;
        const { charges, month, year, studentIds } = req.body;

        if (!charges || !Array.isArray(charges) || charges.length === 0 || !month || !year || !studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            return res.status(400).json({ message: 'Charges, month, year and target students are required' });
        }

        // Insert multiple charges for each student
        const insertPromises = [];
        for (const sid of studentIds) {
            for (const charge of charges) {
                if (charge.reason && charge.amount) {
                    insertPromises.push(
                        pool.query(
                            `INSERT INTO monthly_extra_charges (student_id, institute_id, session_id, month, year, reason, amount)
                             VALUES ($1, $2, $3, $4, $5, $6, $7)
                             ON CONFLICT (student_id, month, year, reason, session_id) 
                             DO UPDATE SET amount = $7`,
                            [sid, instituteId, sessionId, parseInt(month), parseInt(year), charge.reason, parseFloat(charge.amount)]
                        )
                    );
                }
            }
        }

        await Promise.all(insertPromises);

        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        // Notify students via socket
        emitToAllStudents(instituteId, 'extra_charges_added', {
            month: parseInt(month),
            year: parseInt(year),
            monthName: months[parseInt(month) - 1],
            chargeCount: charges.length,
            message: `${charges.length} new charge(s) have been added for ${months[parseInt(month) - 1]} ${year}.`
        });

        res.status(200).json({ message: `Successfully added charges for ${studentIds.length} students` });
    } catch (error) {
        console.error('Add extra charge error:', error);
        res.status(500).json({ message: 'Server error while adding extra charges' });
    }
};

// Get Comprehensive Student Fees Data for Principal
const getStudentFeesFull = async (req, res) => {
  try {
    const { id: studentId } = req.params;
    const instituteId = req.user.institute_id || req.user.id;
    let sessionId = req.headers['x-academic-session-id'] || req.user.current_session_id;

    // Fallback if sessionId is null/undefined
    if (!sessionId || sessionId === 'null' || sessionId === 'undefined') {
      const sessionRes = await pool.query(
        'SELECT current_session_id FROM institutes WHERE id = $1',
        [instituteId]
      );
      sessionId = sessionRes.rows[0]?.current_session_id;
    }

    if (!sessionId) {
      return res.status(400).json({ message: 'No active academic session found' });
    }

    // 1. Get student fee structure
    const studentRes = await pool.query(
      'SELECT monthly_fees, transport_fees, transport_facility, class FROM students WHERE id = $1 AND institute_id = $2',
      [studentId, instituteId]
    );

    if (studentRes.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }
    const student = studentRes.rows[0];

    // 2. Get all activated monthly fees for this session
    const activatedMonthsRes = await pool.query(
      `SELECT month, year FROM monthly_fee_activations 
       WHERE institute_id = $1 AND session_id = $2 AND is_activated = true
       ORDER BY year DESC, month DESC`,
      [instituteId, sessionId]
    );

    // 3. Get all published one-time fees for this student
    const oneTimeFeesRes = await pool.query(
      `SELECT p.id as payment_id, p.status, p.paid_amount, p.due_amount, p.updated_at,
              g.id as group_id, g.reason, g.created_at,
              c.base_amount as original_amount,
              p.reasons as breakdown,
              (SELECT json_agg(t ORDER BY t.created_at ASC) 
               FROM one_time_fee_transactions t 
               WHERE t.payment_id = p.id) as transactions
       FROM one_time_fee_payments p
       JOIN one_time_fee_groups g ON p.group_id = g.id
       JOIN students s ON p.student_id = s.id
       JOIN one_time_fee_class_configs c ON c.group_id = g.id AND c.class_name = s.class
       WHERE p.student_id = $1 AND g.institute_id = $2 AND g.session_id = $3
       ORDER BY g.created_at DESC`,
      [studentId, instituteId, sessionId]
    );

    // 4. Get monthly payment records
    const paymentsRes = await pool.query(
      `SELECT month, year, status, paid_at, payment_method, transaction_id, collected_by
       FROM student_fees 
       WHERE student_id = $1 AND institute_id = $2 AND session_id = $3
       ORDER BY year DESC, month DESC`,
      [studentId, instituteId, sessionId]
    );

    // 5. Get all monthly extra charges
    const extraChargesRes = await pool.query(
      `SELECT month, year, reason, amount, status, created_at
       FROM monthly_extra_charges
       WHERE student_id = $1 AND institute_id = $2 AND session_id = $3
       ORDER BY year DESC, month DESC`,
      [studentId, instituteId, sessionId]
    );

    res.status(200).json({
      fee_structure: {
        monthly_fees: parseFloat(student.monthly_fees || 0),
        transport_fees: parseFloat(student.transport_fees || 0),
        transport_facility: student.transport_facility
      },
      activated_months: activatedMonthsRes.rows,
      one_time_fees: oneTimeFeesRes.rows,
      payments: paymentsRes.rows,
      extra_charges: extraChargesRes.rows
    });
  } catch (error) {
    console.error('Get student fees full error:', error);
    res.status(500).json({ message: 'Server error while fetching fee data' });
  }
};

const getDailyRevenueDetails = async (req, res) => {
    try {
        const instituteId = req.user.institute_id || req.user.id;
        let sessionId = req.headers['x-academic-session-id'] || req.user.current_session_id;

        // Fallback if sessionId is null/undefined
        if (!sessionId || sessionId === 'null' || sessionId === 'undefined') {
          const sessionRes = await pool.query(
            'SELECT current_session_id FROM institutes WHERE id = $1',
            [instituteId]
          );
          sessionId = sessionRes.rows[0]?.current_session_id;
        }

        const { date, type } = req.query;

        if (!date) return res.status(400).json({ message: 'Date is required' });

        let allPayments = [];

        if (!type || type === 'monthly') {
            // Get students who paid monthly fees on this date
            const monthlyPayments = await pool.query(
                `SELECT s.id, s.name, s.class, s.section, s.roll_no, s.photo_url,
                        (s.monthly_fees + CASE WHEN s.transport_facility THEN s.transport_fees ELSE 0 END) as amount,
                        'Monthly' as fee_type, f.paid_at
                 FROM students s
                 JOIN student_fees f ON s.id = f.student_id
                 WHERE s.institute_id = $1 AND f.session_id = $2 AND f.paid_at::date = $3::date AND f.status = 'paid'`,
                [instituteId, sessionId, date]
            );

            // Get students who paid extra charges on this date
            const extraCharges = await pool.query(
                `SELECT s.id, s.name, s.class, s.section, s.roll_no, s.photo_url,
                        ec.amount, ec.reason as fee_type, ec.created_at as paid_at
                 FROM students s
                 JOIN monthly_extra_charges ec ON s.id = ec.student_id
                 WHERE s.institute_id = $1 AND ec.session_id = $2 AND ec.created_at::date = $3::date AND ec.status = 'paid'`,
                [instituteId, sessionId, date]
            );
            allPayments = [...allPayments, ...monthlyPayments.rows, ...extraCharges.rows];
        }

        if (!type || type === 'onetime') {
            // Get students who paid one-time fees on this date
            const oneTimePayments = await pool.query(
                `SELECT s.id, s.name, s.class, s.section, s.roll_no, s.photo_url,
                        t.amount, g.reason as fee_type, t.created_at as paid_at
                 FROM students s
                 JOIN one_time_fee_payments p ON s.id = p.student_id
                 JOIN one_time_fee_transactions t ON p.id = t.payment_id
                 JOIN one_time_fee_groups g ON p.group_id = g.id
                 WHERE g.institute_id = $1 AND g.session_id = $2 AND t.created_at::date = $3::date`,
                [instituteId, sessionId, date]
            );
            allPayments = [...allPayments, ...oneTimePayments.rows];
        }

        allPayments.sort((a, b) => 
            new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()
        );

        res.status(200).json(allPayments);
    } catch (error) {
        console.error('Get daily revenue details error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Bank Account CRUD
const getBankAccounts = async (req, res) => {
    try {
        const instituteId = req.user.institute_id || req.user.id;
        const result = await pool.query('SELECT * FROM bank_accounts WHERE institute_id = $1 ORDER BY is_primary DESC, created_at ASC', [instituteId]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Get bank accounts error:', error);
        res.status(500).json({ message: 'Failed to fetch bank accounts' });
    }
};

const addBankAccount = async (req, res) => {
    try {
        const instituteId = req.user.institute_id || req.user.id;
        const { account_holder_name, bank_name, account_number, ifsc_code, is_primary } = req.body;

        if (!account_holder_name || !bank_name || !account_number || !ifsc_code) {
            return res.status(400).json({ message: 'All bank details are required' });
        }

        // If this is set to primary, unset others
        if (is_primary === true) {
            await pool.query('UPDATE bank_accounts SET is_primary = false WHERE institute_id = $1', [instituteId]);
        }

        const result = await pool.query(
            `INSERT INTO bank_accounts (institute_id, account_holder_name, bank_name, account_number, ifsc_code, is_primary)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [instituteId, account_holder_name, bank_name, account_number, ifsc_code, is_primary === true]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Add bank account error:', error);
        res.status(500).json({ message: 'Failed to add bank account' });
    }
};

const updateBankAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const instituteId = req.user.institute_id || req.user.id;
        const { account_holder_name, bank_name, account_number, ifsc_code, is_primary } = req.body;

        const check = await pool.query('SELECT id FROM bank_accounts WHERE id = $1 AND institute_id = $2', [id, instituteId]);
        if (check.rows.length === 0) return res.status(404).json({ message: 'Bank account not found' });

        if (is_primary === true) {
            await pool.query('UPDATE bank_accounts SET is_primary = false WHERE institute_id = $1', [instituteId]);
        }

        const result = await pool.query(
            `UPDATE bank_accounts 
             SET account_holder_name = $1, bank_name = $2, account_number = $3, ifsc_code = $4, is_primary = $5, updated_at = NOW()
             WHERE id = $6 AND institute_id = $7 RETURNING *`,
            [account_holder_name, bank_name, account_number, ifsc_code, is_primary === true, id, instituteId]
        );

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Update bank account error:', error);
        res.status(500).json({ message: 'Failed to update bank account' });
    }
};

const deleteBankAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const instituteId = req.user.institute_id || req.user.id;

        const check = await pool.query('SELECT is_primary FROM bank_accounts WHERE id = $1 AND institute_id = $2', [id, instituteId]);
        if (check.rows.length === 0) return res.status(404).json({ message: 'Bank account not found' });

        await pool.query('DELETE FROM bank_accounts WHERE id = $1 AND institute_id = $2', [id, instituteId]);

        // If we deleted primary, set another as primary if exists
        if (check.rows[0].is_primary) {
            const next = await pool.query('SELECT id FROM bank_accounts WHERE institute_id = $1 LIMIT 1', [instituteId]);
            if (next.rows.length > 0) {
                await pool.query('UPDATE bank_accounts SET is_primary = true WHERE id = $1', [next.rows[0].id]);
            }
        }

        res.status(200).json({ message: 'Bank account deleted' });
    } catch (error) {
        console.error('Delete bank account error:', error);
        res.status(500).json({ message: 'Failed to delete bank account' });
    }
};

export { 
    getDashboard, addStudent, updateStudent, getStudents, deleteStudent, 
    addTeacher, updateTeacher, getTeachers, deleteTeacher, searchEntities, 
    getProfile, updateProfile, getStats, getAttendanceListBySection, 
    getStudentsBySession, collectFee, getFeesStatus,
    getMonthlyActivationStatus, toggleMonthlyActivation,
    addExtraCharge, getStudentFeesFull, getDailyRevenueDetails,
    getBankAccounts, addBankAccount, updateBankAccount, deleteBankAccount
};

// ================================