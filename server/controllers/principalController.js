import pool from '../config/db.js';
import { uploadToS3, deleteFromS3, generateUniqueCode, sendStudentCredentials, sendTeacherCredentials } from '../utils/aws.js';
import { formatIndianDate, getTodayIST } from '../utils/date.js';

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
    const studentCount = await pool.query('SELECT COUNT(*) FROM students WHERE institute_id = $1 AND session_id = $2 AND is_active = true', [instituteId, sessionId]);

    // --- Flashcard Logic ---

    // 1. Student Attendance Logic
    // Get total distinct sections
    const totalSectionsRes = await pool.query(
        `SELECT DISTINCT class, section FROM students WHERE institute_id = $1 AND session_id = $2 AND is_active = true`,
        [instituteId, sessionId]
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

    // 3. Revenue Logic
    // Current Month Name
    const dateObj = new Date();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const currentMonthYear = `${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`;

    // Monthly Fees (Month & Today)
    const monthlyFeesRes = await pool.query(
        `SELECT 
            COALESCE(SUM(CASE WHEN month_year = $3 THEN total_amount ELSE 0 END), 0) as month_collected,
            COALESCE(SUM(CASE WHEN paid_at::date = $4 THEN total_amount ELSE 0 END), 0) as day_collected
         FROM student_monthly_fees 
         WHERE institute_id = $1 AND session_id = $2 AND status = 'paid'`,
        [instituteId, sessionId, currentMonthYear, today]
    );

    // Occasional Fees (Month & Today) - Note: Occasional fees might not have 'month_year' strictly structured, usually rely on paid_at or config
    // Assuming occasional fees are tracked by payment date mostly, but we look for created month context if needed. 
    // Simplified: Collection in this month vs Collection today
    const startOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1).toISOString().split('T')[0];
    
    const occasionalFeesRes = await pool.query(
        `SELECT 
            COALESCE(SUM(CASE WHEN paid_at >= $3 THEN amount ELSE 0 END), 0) as month_collected,
            COALESCE(SUM(CASE WHEN paid_at::date = $4 THEN amount ELSE 0 END), 0) as day_collected
         FROM student_occasional_fees 
         WHERE institute_id = $1 AND session_id = $2 AND status = 'paid'`,
        [instituteId, sessionId, startOfMonth, today]
    );

    const revenueData = {
        month_name: monthNames[dateObj.getMonth()],
        monthly_month: parseFloat(monthlyFeesRes.rows[0].month_collected),
        occasional_month: parseFloat(occasionalFeesRes.rows[0].month_collected),
        monthly_day: parseFloat(monthlyFeesRes.rows[0].day_collected),
        occasional_day: parseFloat(occasionalFeesRes.rows[0].day_collected)
    };

    // 4. Today's Events from Academic Calendar
    const todayEventsRes = await pool.query(
        "SELECT title, description FROM academic_calendar WHERE institute_id = $1 AND session_id = $2 AND event_date = $3",
        [instituteId, sessionId, today]
    );

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
        revenue: revenueData,
        my_attendance: myAttendanceStats,
        my_homework: myHomeworkStats
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
    } = req.body;

    // Validation
    if (!name || !studentClass || !section || !roll_no || !dob || !gender ||
      !father_name || !mother_name || !mobile || !email || !address) {
      return res.status(400).json({ message: 'Please fill all required fields' });
    }

    // Check if roll number already exists in same class/section and session
    const existing = await pool.query(
      'SELECT * FROM students WHERE institute_id = $1 AND roll_no = $2 AND class = $3 AND section = $4 AND session_id = $5',
      [instituteId, roll_no, studentClass, section, req.user.current_session_id]
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
       father_name, mother_name, mobile, email, address, transport_facility, photo_url, session_id) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) 
      RETURNING *`,
      [instituteId, uniqueCode, name, studentClass, section, roll_no, dob, gender,
        father_name, mother_name, mobile, email, address, transport_facility === 'true', photoUrl, req.user.current_session_id]
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
    const { month } = req.query;

    let sessionId = req.user.current_session_id;

    // Fallback if sessionId is missing from req.user (happens for some teacher/principal tokens)
    if (!sessionId || sessionId === 'undefined') {
        const sessionResult = await pool.query(
            'SELECT current_session_id FROM institutes WHERE id = $1',
            [instituteId]
        );
        sessionId = sessionResult.rows[0]?.current_session_id;
    }

    if (!sessionId) {
        return res.status(400).json({ message: 'No active academic session found for this institute' });
    }

    let query = 'SELECT * FROM students WHERE institute_id = $1 AND session_id = $2 AND is_active = true';
    const params = [instituteId, sessionId];

    if (month) {
        const feeMonthStart = parseMonthYear(month);
        if (feeMonthStart) {
            query += " AND (DATE_TRUNC('month', created_at) <= $3)";
            params.push(feeMonthStart);
        }
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
           transport_facility = $12, photo_url = $13
       WHERE id = $14 RETURNING *`,
      [name, studentClass, section, roll_no, dob, gender, father_name, mother_name,
        mobile, email, address, transport_facility === 'true', photoUrl, id]
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
      'SELECT id, institute_name, principal_name, email, mobile, state, district, landmark, pincode, address, affiliation, logo_url, principal_photo_url, current_session_id FROM institutes WHERE id = $1',
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
    } = req.body;

    // Get current profile
    const current = await pool.query('SELECT logo_url, principal_photo_url, email FROM institutes WHERE id = $1', [instituteId]);
    if (current.rows.length === 0) return res.status(404).json({ message: 'Institute not found' });

    let logoUrl = current.rows[0].logo_url;
    let principalPhotoUrl = current.rows[0].principal_photo_url;
    const currentEmail = current.rows[0].email;

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

    // Update DB
    const result = await pool.query(
      `UPDATE institutes 
       SET institute_name = $1, principal_name = $2, email = $3, mobile = $4, address = $5, 
           state = $6, district = $7, landmark = $8, pincode = $9, affiliation = $10, logo_url = $11, principal_photo_url = $12
       WHERE id = $13 RETURNING *`,
      [institute_name, principal_name, email, mobile, address, state, district, landmark, pincode, affiliation, logoUrl, principalPhotoUrl, instituteId]
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

// Get Comprehensive Stats for Principal Dashboard
const getStats = async (req, res) => {
    try {
        console.log('[Stats] Fetching stats for Principal...');
        const instituteId = req.user.institute_id || req.user.id;
        const sessionId = req.user.current_session_id;
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

        const attendanceStats = {
            today: {
                students: studentAttendanceToday.rows,
                teachers: teacherAttendanceToday.rows,
                byClassSection: granularAttendance.rows,
                teacherList: teacherAttendanceList.rows
            },
            date: statsDate
        };

        // 3. REVENUE STATS
        console.log('[Stats] Fetching revenue stats...');
        
        // 3.1 Overall (Session Totals - Expected vs Collected)
        const overallMonthlyStats = await pool.query(
            `SELECT 
                SUM(total_amount) as expected,
                SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as collected,
                SUM(CASE WHEN status = 'unpaid' THEN total_amount ELSE 0 END) as pending
             FROM student_monthly_fees 
             WHERE institute_id = $1 AND session_id = $2`, 
            [instituteId, sessionId]
        );

        const overallOccasionalStats = await pool.query(
            `SELECT 
                SUM(amount) as expected,
                SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as collected,
                SUM(CASE WHEN status = 'unpaid' THEN amount ELSE 0 END) as pending
             FROM student_occasional_fees 
             WHERE institute_id = $1 AND session_id = $2`, 
            [instituteId, sessionId]
        );

        const currentMonthNum = month ? parseInt(month) : new Date().getMonth() + 1;
        const currentYearNum = year ? parseInt(year) : new Date().getFullYear();
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const targetMonthYear = `${monthNames[currentMonthNum - 1]} ${currentYearNum}`;

        console.log(`[Stats] Target Month-Year for revenue: ${targetMonthYear}`);

        // 3.2 Month-wise stats (Expected, Collected, Pending)
        const monthlyFeesResult = await pool.query(
            `SELECT 
                SUM(total_amount) as expected,
                SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as collected,
                SUM(CASE WHEN status = 'unpaid' THEN total_amount ELSE 0 END) as pending
             FROM student_monthly_fees 
             WHERE institute_id = $1 AND session_id = $2 AND month_year = $3`,
            [instituteId, sessionId, targetMonthYear]
        );

        const occasionalFeesResult = await pool.query(
            `SELECT 
                SUM(amount) as expected,
                SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as collected,
                SUM(CASE WHEN status = 'unpaid' THEN amount ELSE 0 END) as pending
             FROM student_occasional_fees 
             WHERE institute_id = $1 AND session_id = $2 AND month_year = $3`,
            [instituteId, sessionId, targetMonthYear]
        );

        const dailyMonthly = await pool.query(
            "SELECT SUM(total_amount) as collected FROM student_monthly_fees WHERE institute_id = $1 AND session_id = $2 AND status = 'paid' AND paid_at::date = $3",
            [instituteId, sessionId, statsDate]
        );
        const dailyOccasional = await pool.query(
            "SELECT SUM(amount) as collected FROM student_occasional_fees WHERE institute_id = $1 AND session_id = $2 AND status = 'paid' AND paid_at::date = $3",
            [instituteId, sessionId, statsDate]
        );

        // Detailed Fee Payments for the selected date
        const feePaymentsToday = await pool.query(
            `(SELECT 
                s.id, s.name, s.class, s.section, s.roll_no, s.photo_url,
                mf.total_amount as amount, mf.paid_at, 'monthly' as fee_type
             FROM student_monthly_fees mf
             JOIN students s ON mf.student_id = s.id
             WHERE mf.institute_id = $1 AND mf.session_id = $2 AND mf.paid_at::date = $3 AND mf.status = 'paid')
             UNION ALL
             (SELECT 
                s.id, s.name, s.class, s.section, s.roll_no, s.photo_url,
                of.amount as amount, of.paid_at, 'occasional' as fee_type
             FROM student_occasional_fees of
             JOIN students s ON of.student_id = s.id
             WHERE of.institute_id = $1 AND of.session_id = $2 AND of.paid_at::date = $3 AND of.status = 'paid')
             ORDER BY paid_at DESC`,
            [instituteId, sessionId, statsDate]
        );

        const revenueStats = {
            overall: {
                monthlyExpected: parseFloat(overallMonthlyStats.rows[0].expected || 0),
                occasionalExpected: parseFloat(overallOccasionalStats.rows[0].expected || 0),
                monthlyCollected: parseFloat(overallMonthlyStats.rows[0].collected || 0),
                occasionalCollected: parseFloat(overallOccasionalStats.rows[0].collected || 0),
                totalExpected: parseFloat(overallMonthlyStats.rows[0].expected || 0) + parseFloat(overallOccasionalStats.rows[0].expected || 0),
                totalCollected: parseFloat(overallMonthlyStats.rows[0].collected || 0) + parseFloat(overallOccasionalStats.rows[0].collected || 0),
                totalPending: parseFloat(overallMonthlyStats.rows[0].pending || 0) + parseFloat(overallOccasionalStats.rows[0].pending || 0)
            },
            monthly: {
                monthlyCollected: parseFloat(monthlyFeesResult.rows[0].collected || 0),
                monthlyExpected: parseFloat(monthlyFeesResult.rows[0].expected || 0),
                monthlyPending: parseFloat(monthlyFeesResult.rows[0].pending || 0),
                occasionalCollected: parseFloat(occasionalFeesResult.rows[0].collected || 0),
                occasionalExpected: parseFloat(occasionalFeesResult.rows[0].expected || 0),
                occasionalPending: parseFloat(occasionalFeesResult.rows[0].pending || 0),
                totalCollected: parseFloat(monthlyFeesResult.rows[0].collected || 0) + parseFloat(occasionalFeesResult.rows[0].collected || 0),
                totalExpected: parseFloat(monthlyFeesResult.rows[0].expected || 0) + parseFloat(occasionalFeesResult.rows[0].expected || 0),
                totalPending: parseFloat(monthlyFeesResult.rows[0].pending || 0) + parseFloat(occasionalFeesResult.rows[0].pending || 0)
            },
            daily: {
                monthly: parseFloat(dailyMonthly.rows[0].collected || 0),
                occasional: parseFloat(dailyOccasional.rows[0].collected || 0),
                total: parseFloat(dailyMonthly.rows[0].collected || 0) + parseFloat(dailyOccasional.rows[0].collected || 0),
                payments: feePaymentsToday.rows
            }
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
            attendance: attendanceStats,
            revenue: revenueStats
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
             WHERE s.institute_id = $1 AND s.session_id = $3 AND s.class = $2 AND s.section = $5 AND s.is_active = true
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

export { getDashboard, addStudent, updateStudent, getStudents, deleteStudent, addTeacher, updateTeacher, getTeachers, deleteTeacher, searchEntities, getProfile, updateProfile, getStats, getAttendanceListBySection, getStudentsBySession };

// ================================