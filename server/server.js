const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function genCertNumber() {
  return 'LTL-CERT-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1000);
}

function errorResponse(res, status, message) {
  return res.status(status).json({ error: message });
}

/* ---------------------------------------------------------- *
 * AUTH
 * ---------------------------------------------------------- */

app.post('/api/auth/register', (req, res) => {
  const { full_name, email, phone, department, year_of_study, date_of_birth, password } = req.body;
  if (!full_name || !email || !password) {
    return errorResponse(res, 400, 'full_name, email, and password are required');
  }
  const existing = db.get('SELECT student_id FROM students WHERE email = ?', [email]);
  if (existing) return errorResponse(res, 409, 'An account with this email already exists');

  db.run(
    `INSERT INTO students (full_name, email, phone, department, year_of_study, date_of_birth, password_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [full_name, email, phone || null, department || null, year_of_study || null, date_of_birth || null, hashPassword(password)]
  );
  const id = db.lastInsertId();
  const student = db.get('SELECT student_id, full_name, email, department, year_of_study FROM students WHERE student_id = ?', [id]);
  res.status(201).json(student);
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return errorResponse(res, 400, 'email and password are required');
  const student = db.get('SELECT * FROM students WHERE email = ?', [email]);
  if (!student || student.password_hash !== hashPassword(password)) {
    return errorResponse(res, 401, 'Invalid email or password');
  }
  delete student.password_hash;
  res.json(student);
});

/* ---------------------------------------------------------- *
 * STUDENTS
 * ---------------------------------------------------------- */

app.get('/api/students', (req, res) => {
  const rows = db.all('SELECT student_id, full_name, email, phone, department, year_of_study, date_of_birth, created_at FROM students ORDER BY created_at DESC');
  res.json(rows);
});

app.get('/api/students/:id', (req, res) => {
  const row = db.get('SELECT student_id, full_name, email, phone, department, year_of_study, date_of_birth, created_at FROM students WHERE student_id = ?', [req.params.id]);
  if (!row) return errorResponse(res, 404, 'Student not found');
  res.json(row);
});

app.put('/api/students/:id', (req, res) => {
  const { full_name, phone, department, year_of_study, date_of_birth } = req.body;
  const existing = db.get('SELECT student_id FROM students WHERE student_id = ?', [req.params.id]);
  if (!existing) return errorResponse(res, 404, 'Student not found');
  db.run(
    `UPDATE students SET full_name = COALESCE(?, full_name), phone = COALESCE(?, phone),
     department = COALESCE(?, department), year_of_study = COALESCE(?, year_of_study),
     date_of_birth = COALESCE(?, date_of_birth) WHERE student_id = ?`,
    [full_name, phone, department, year_of_study, date_of_birth, req.params.id]
  );
  res.json(db.get('SELECT student_id, full_name, email, phone, department, year_of_study, date_of_birth FROM students WHERE student_id = ?', [req.params.id]));
});

/* ---------------------------------------------------------- *
 * INTERNSHIPS
 * ---------------------------------------------------------- */

app.get('/api/internships', (req, res) => {
  const { student_id, status } = req.query;
  let sql = `SELECT i.*, s.full_name AS student_name FROM internships i
             JOIN students s ON s.student_id = i.student_id WHERE 1=1`;
  const params = [];
  if (student_id) { sql += ' AND i.student_id = ?'; params.push(student_id); }
  if (status) { sql += ' AND i.status = ?'; params.push(status); }
  sql += ' ORDER BY i.start_date DESC';
  res.json(db.all(sql, params));
});

app.get('/api/internships/:id', (req, res) => {
  const row = db.get(
    `SELECT i.*, s.full_name AS student_name FROM internships i
     JOIN students s ON s.student_id = i.student_id WHERE i.internship_id = ?`,
    [req.params.id]
  );
  if (!row) return errorResponse(res, 404, 'Internship not found');
  res.json(row);
});

app.post('/api/internships', (req, res) => {
  const { student_id, company_name, role_title, start_date, end_date, mentor_name, status } = req.body;
  if (!student_id || !company_name || !role_title || !start_date) {
    return errorResponse(res, 400, 'student_id, company_name, role_title, and start_date are required');
  }
  const student = db.get('SELECT student_id FROM students WHERE student_id = ?', [student_id]);
  if (!student) return errorResponse(res, 404, 'Student not found');

  db.run(
    `INSERT INTO internships (student_id, company_name, role_title, start_date, end_date, mentor_name, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [student_id, company_name, role_title, start_date, end_date || null, mentor_name || null, status || 'ongoing']
  );
  const id = db.lastInsertId();
  res.status(201).json(db.get('SELECT * FROM internships WHERE internship_id = ?', [id]));
});

app.put('/api/internships/:id', (req, res) => {
  const existing = db.get('SELECT internship_id FROM internships WHERE internship_id = ?', [req.params.id]);
  if (!existing) return errorResponse(res, 404, 'Internship not found');
  const { company_name, role_title, start_date, end_date, mentor_name, status } = req.body;
  db.run(
    `UPDATE internships SET company_name = COALESCE(?, company_name), role_title = COALESCE(?, role_title),
     start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date),
     mentor_name = COALESCE(?, mentor_name), status = COALESCE(?, status) WHERE internship_id = ?`,
    [company_name, role_title, start_date, end_date, mentor_name, status, req.params.id]
  );
  res.json(db.get('SELECT * FROM internships WHERE internship_id = ?', [req.params.id]));
});

/* ---------------------------------------------------------- *
 * ATTENDANCE
 * ---------------------------------------------------------- */

app.get('/api/attendance', (req, res) => {
  const { internship_id } = req.query;
  let sql = 'SELECT * FROM attendance WHERE 1=1';
  const params = [];
  if (internship_id) { sql += ' AND internship_id = ?'; params.push(internship_id); }
  sql += ' ORDER BY attendance_date DESC';
  res.json(db.all(sql, params));
});

app.post('/api/attendance', (req, res) => {
  const { internship_id, attendance_date, check_in_time, check_out_time, status } = req.body;
  if (!internship_id || !attendance_date) {
    return errorResponse(res, 400, 'internship_id and attendance_date are required');
  }
  const internship = db.get('SELECT internship_id FROM internships WHERE internship_id = ?', [internship_id]);
  if (!internship) return errorResponse(res, 404, 'Internship not found');

  const existing = db.get('SELECT attendance_id FROM attendance WHERE internship_id = ? AND attendance_date = ?', [internship_id, attendance_date]);
  if (existing) return errorResponse(res, 409, 'Attendance already recorded for this date');

  db.run(
    `INSERT INTO attendance (internship_id, attendance_date, check_in_time, check_out_time, status)
     VALUES (?, ?, ?, ?, ?)`,
    [internship_id, attendance_date, check_in_time || null, check_out_time || null, status || 'present']
  );
  const id = db.lastInsertId();
  res.status(201).json(db.get('SELECT * FROM attendance WHERE attendance_id = ?', [id]));
});

app.put('/api/attendance/:id', (req, res) => {
  const existing = db.get('SELECT attendance_id FROM attendance WHERE attendance_id = ?', [req.params.id]);
  if (!existing) return errorResponse(res, 404, 'Attendance record not found');
  const { check_in_time, check_out_time, status } = req.body;
  db.run(
    `UPDATE attendance SET check_in_time = COALESCE(?, check_in_time),
     check_out_time = COALESCE(?, check_out_time), status = COALESCE(?, status) WHERE attendance_id = ?`,
    [check_in_time, check_out_time, status, req.params.id]
  );
  res.json(db.get('SELECT * FROM attendance WHERE attendance_id = ?', [req.params.id]));
});

/* ---------------------------------------------------------- *
 * TASKS
 * ---------------------------------------------------------- */

app.get('/api/tasks', (req, res) => {
  const { internship_id, status } = req.query;
  let sql = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];
  if (internship_id) { sql += ' AND internship_id = ?'; params.push(internship_id); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY due_date ASC';
  res.json(db.all(sql, params));
});

app.post('/api/tasks', (req, res) => {
  const { internship_id, task_title, description, due_date, status } = req.body;
  if (!internship_id || !task_title) {
    return errorResponse(res, 400, 'internship_id and task_title are required');
  }
  const internship = db.get('SELECT internship_id FROM internships WHERE internship_id = ?', [internship_id]);
  if (!internship) return errorResponse(res, 404, 'Internship not found');

  db.run(
    `INSERT INTO tasks (internship_id, task_title, description, due_date, status) VALUES (?, ?, ?, ?, ?)`,
    [internship_id, task_title, description || null, due_date || null, status || 'pending']
  );
  const id = db.lastInsertId();
  res.status(201).json(db.get('SELECT * FROM tasks WHERE task_id = ?', [id]));
});

app.put('/api/tasks/:id', (req, res) => {
  const existing = db.get('SELECT task_id FROM tasks WHERE task_id = ?', [req.params.id]);
  if (!existing) return errorResponse(res, 404, 'Task not found');
  const { task_title, description, due_date, status, submitted_file } = req.body;
  db.run(
    `UPDATE tasks SET task_title = COALESCE(?, task_title), description = COALESCE(?, description),
     due_date = COALESCE(?, due_date), status = COALESCE(?, status),
     submitted_file = COALESCE(?, submitted_file) WHERE task_id = ?`,
    [task_title, description, due_date, status, submitted_file, req.params.id]
  );
  res.json(db.get('SELECT * FROM tasks WHERE task_id = ?', [req.params.id]));
});

app.delete('/api/tasks/:id', (req, res) => {
  const existing = db.get('SELECT task_id FROM tasks WHERE task_id = ?', [req.params.id]);
  if (!existing) return errorResponse(res, 404, 'Task not found');
  db.run('DELETE FROM tasks WHERE task_id = ?', [req.params.id]);
  res.status(204).end();
});

/* ---------------------------------------------------------- *
 * CERTIFICATES
 * ---------------------------------------------------------- */

app.get('/api/certificates', (req, res) => {
  const { internship_id, student_id } = req.query;
  let sql = `SELECT c.*, i.company_name, i.role_title, i.student_id FROM certificates c
             JOIN internships i ON i.internship_id = c.internship_id WHERE 1=1`;
  const params = [];
  if (internship_id) { sql += ' AND c.internship_id = ?'; params.push(internship_id); }
  if (student_id) { sql += ' AND i.student_id = ?'; params.push(student_id); }
  sql += ' ORDER BY c.issue_date DESC';
  res.json(db.all(sql, params));
});

app.post('/api/certificates', (req, res) => {
  const { internship_id, issue_date, final_grade, file_url } = req.body;
  if (!internship_id || !issue_date) {
    return errorResponse(res, 400, 'internship_id and issue_date are required');
  }
  const internship = db.get('SELECT internship_id FROM internships WHERE internship_id = ?', [internship_id]);
  if (!internship) return errorResponse(res, 404, 'Internship not found');

  const existing = db.get('SELECT certificate_id FROM certificates WHERE internship_id = ?', [internship_id]);
  if (existing) return errorResponse(res, 409, 'A certificate already exists for this internship');

  db.run(
    `INSERT INTO certificates (internship_id, issue_date, certificate_number, final_grade, file_url)
     VALUES (?, ?, ?, ?, ?)`,
    [internship_id, issue_date, genCertNumber(), final_grade || null, file_url || null]
  );
  const id = db.lastInsertId();
  res.status(201).json(db.get('SELECT * FROM certificates WHERE certificate_id = ?', [id]));
});

/* ---------------------------------------------------------- *
 * DASHBOARD SUMMARY (aggregates across all 5 tables)
 * ---------------------------------------------------------- */

app.get('/api/students/:id/dashboard', (req, res) => {
  const studentId = req.params.id;
  const student = db.get('SELECT student_id, full_name, email, department, year_of_study FROM students WHERE student_id = ?', [studentId]);
  if (!student) return errorResponse(res, 404, 'Student not found');

  const internships = db.all('SELECT * FROM internships WHERE student_id = ? ORDER BY start_date DESC', [studentId]);
  const internshipIds = internships.map((i) => i.internship_id);

  let tasks = [];
  let attendance = [];
  let certificates = [];

  if (internshipIds.length) {
    const placeholders = internshipIds.map(() => '?').join(',');
    tasks = db.all(`SELECT * FROM tasks WHERE internship_id IN (${placeholders}) ORDER BY due_date ASC`, internshipIds);
    attendance = db.all(`SELECT * FROM attendance WHERE internship_id IN (${placeholders}) ORDER BY attendance_date DESC`, internshipIds);
    certificates = db.all(`SELECT * FROM certificates WHERE internship_id IN (${placeholders})`, internshipIds);
  }

  const totalDays = attendance.length;
  const presentDays = attendance.filter((a) => a.status === 'present' || a.status === 'late').length;
  const attendanceRate = totalDays ? Math.round((presentDays / totalDays) * 100) : 0;
  const tasksCompleted = tasks.filter((t) => t.status === 'approved').length;
  const tasksPending = tasks.filter((t) => t.status === 'pending' || t.status === 'submitted').length;

  res.json({
    student,
    internships,
    tasks,
    attendance,
    certificates,
    stats: {
      activeInternships: internships.filter((i) => i.status === 'ongoing').length,
      totalInternships: internships.length,
      attendanceRate,
      tasksCompleted,
      tasksPending,
      certificatesEarned: certificates.length,
    },
  });
});

/* ---------------------------------------------------------- *
 * STAFF AUTH
 * ---------------------------------------------------------- */

app.post('/api/staff/register', (req, res) => {
  const { full_name, email, phone, role, department, join_date, password } = req.body;
  if (!full_name || !email || !password) return errorResponse(res, 400, 'full_name, email, and password are required');
  const existing = db.get('SELECT staff_id FROM staff WHERE email = ?', [email]);
  if (existing) return errorResponse(res, 409, 'An account with this email already exists');
  db.run(
    `INSERT INTO staff (full_name, email, phone, role, department, join_date, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [full_name, email, phone || null, role || 'staff', department || null, join_date || null, hashPassword(password)]
  );
  const id = db.lastInsertId();
  res.status(201).json(db.get('SELECT staff_id, full_name, email, role, department FROM staff WHERE staff_id = ?', [id]));
});

app.post('/api/staff/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return errorResponse(res, 400, 'email and password are required');
  const staff = db.get('SELECT * FROM staff WHERE email = ?', [email]);
  if (!staff || staff.password_hash !== hashPassword(password)) return errorResponse(res, 401, 'Invalid email or password');
  delete staff.password_hash;
  res.json(staff);
});

/* ---------------------------------------------------------- *
 * STAFF CRUD
 * ---------------------------------------------------------- */

app.get('/api/staff', (req, res) => {
  const { department, status } = req.query;
  let sql = 'SELECT staff_id, full_name, email, phone, role, department, join_date, status, created_at FROM staff WHERE 1=1';
  const params = [];
  if (department) { sql += ' AND department = ?'; params.push(department); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC';
  res.json(db.all(sql, params));
});

app.get('/api/staff/:id', (req, res) => {
  const row = db.get('SELECT staff_id, full_name, email, phone, role, department, join_date, status, created_at FROM staff WHERE staff_id = ?', [req.params.id]);
  if (!row) return errorResponse(res, 404, 'Staff member not found');
  res.json(row);
});

app.put('/api/staff/:id', (req, res) => {
  const existing = db.get('SELECT staff_id FROM staff WHERE staff_id = ?', [req.params.id]);
  if (!existing) return errorResponse(res, 404, 'Staff member not found');
  const { full_name, phone, role, department, join_date, status } = req.body;
  db.run(
    `UPDATE staff SET full_name = COALESCE(?, full_name), phone = COALESCE(?, phone),
     role = COALESCE(?, role), department = COALESCE(?, department),
     join_date = COALESCE(?, join_date), status = COALESCE(?, status) WHERE staff_id = ?`,
    [full_name, phone, role, department, join_date, status, req.params.id]
  );
  res.json(db.get('SELECT staff_id, full_name, email, phone, role, department, join_date, status FROM staff WHERE staff_id = ?', [req.params.id]));
});

app.delete('/api/staff/:id', (req, res) => {
  const existing = db.get('SELECT staff_id FROM staff WHERE staff_id = ?', [req.params.id]);
  if (!existing) return errorResponse(res, 404, 'Staff member not found');
  db.run('DELETE FROM staff WHERE staff_id = ?', [req.params.id]);
  res.status(204).end();
});

/* ---------------------------------------------------------- *
 * STAFF ATTENDANCE
 * ---------------------------------------------------------- */

app.get('/api/staff-attendance', (req, res) => {
  const { staff_id } = req.query;
  let sql = 'SELECT * FROM staff_attendance WHERE 1=1';
  const params = [];
  if (staff_id) { sql += ' AND staff_id = ?'; params.push(staff_id); }
  sql += ' ORDER BY attendance_date DESC';
  res.json(db.all(sql, params));
});

app.post('/api/staff-attendance', (req, res) => {
  const { staff_id, attendance_date, check_in_time, check_out_time, status } = req.body;
  if (!staff_id || !attendance_date) return errorResponse(res, 400, 'staff_id and attendance_date are required');
  const staff = db.get('SELECT staff_id FROM staff WHERE staff_id = ?', [staff_id]);
  if (!staff) return errorResponse(res, 404, 'Staff member not found');
  const existing = db.get('SELECT sa_id FROM staff_attendance WHERE staff_id = ? AND attendance_date = ?', [staff_id, attendance_date]);
  if (existing) return errorResponse(res, 409, 'Attendance already recorded for this date');
  db.run(
    `INSERT INTO staff_attendance (staff_id, attendance_date, check_in_time, check_out_time, status) VALUES (?, ?, ?, ?, ?)`,
    [staff_id, attendance_date, check_in_time || null, check_out_time || null, status || 'present']
  );
  const id = db.lastInsertId();
  res.status(201).json(db.get('SELECT * FROM staff_attendance WHERE sa_id = ?', [id]));
});

app.put('/api/staff-attendance/:id', (req, res) => {
  const existing = db.get('SELECT sa_id FROM staff_attendance WHERE sa_id = ?', [req.params.id]);
  if (!existing) return errorResponse(res, 404, 'Attendance record not found');
  const { check_in_time, check_out_time, status } = req.body;
  db.run(
    `UPDATE staff_attendance SET check_in_time = COALESCE(?, check_in_time),
     check_out_time = COALESCE(?, check_out_time), status = COALESCE(?, status) WHERE sa_id = ?`,
    [check_in_time, check_out_time, status, req.params.id]
  );
  res.json(db.get('SELECT * FROM staff_attendance WHERE sa_id = ?', [req.params.id]));
});

/* ---------------------------------------------------------- *
 * STAFF TASKS
 * ---------------------------------------------------------- */

app.get('/api/staff-tasks', (req, res) => {
  const { staff_id, status } = req.query;
  let sql = 'SELECT * FROM staff_tasks WHERE 1=1';
  const params = [];
  if (staff_id) { sql += ' AND staff_id = ?'; params.push(staff_id); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY due_date ASC';
  res.json(db.all(sql, params));
});

app.post('/api/staff-tasks', (req, res) => {
  const { staff_id, task_title, description, due_date, priority, status } = req.body;
  if (!staff_id || !task_title) return errorResponse(res, 400, 'staff_id and task_title are required');
  const staff = db.get('SELECT staff_id FROM staff WHERE staff_id = ?', [staff_id]);
  if (!staff) return errorResponse(res, 404, 'Staff member not found');
  db.run(
    `INSERT INTO staff_tasks (staff_id, task_title, description, due_date, priority, status) VALUES (?, ?, ?, ?, ?, ?)`,
    [staff_id, task_title, description || null, due_date || null, priority || 'medium', status || 'pending']
  );
  const id = db.lastInsertId();
  res.status(201).json(db.get('SELECT * FROM staff_tasks WHERE stask_id = ?', [id]));
});

app.put('/api/staff-tasks/:id', (req, res) => {
  const existing = db.get('SELECT stask_id FROM staff_tasks WHERE stask_id = ?', [req.params.id]);
  if (!existing) return errorResponse(res, 404, 'Task not found');
  const { task_title, description, due_date, priority, status } = req.body;
  db.run(
    `UPDATE staff_tasks SET task_title = COALESCE(?, task_title), description = COALESCE(?, description),
     due_date = COALESCE(?, due_date), priority = COALESCE(?, priority), status = COALESCE(?, status) WHERE stask_id = ?`,
    [task_title, description, due_date, priority, status, req.params.id]
  );
  res.json(db.get('SELECT * FROM staff_tasks WHERE stask_id = ?', [req.params.id]));
});

app.delete('/api/staff-tasks/:id', (req, res) => {
  const existing = db.get('SELECT stask_id FROM staff_tasks WHERE stask_id = ?', [req.params.id]);
  if (!existing) return errorResponse(res, 404, 'Task not found');
  db.run('DELETE FROM staff_tasks WHERE stask_id = ?', [req.params.id]);
  res.status(204).end();
});

/* ---------------------------------------------------------- */

async function start() {
  await db.init();
  if (db.initStaff) db.initStaff();
  setInterval(() => db.persist(), 5000);
  process.on('SIGINT', () => { db.persist(); process.exit(0); });
  process.on('SIGTERM', () => { db.persist(); process.exit(0); });
  app.listen(PORT, () => {
    console.log(`Lee Tech Leap Solutions internship system API running on http://localhost:${PORT}`);
  });
}

start();
