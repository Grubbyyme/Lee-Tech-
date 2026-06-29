const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, 'data', 'internship.sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS students (
  student_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name       TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  phone           TEXT,
  department      TEXT,
  year_of_study   TEXT,
  date_of_birth   TEXT,
  password_hash   TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS internships (
  internship_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL,
  company_name    TEXT NOT NULL,
  role_title      TEXT NOT NULL,
  start_date      TEXT NOT NULL,
  end_date        TEXT,
  mentor_name     TEXT,
  status          TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing','completed','terminated')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attendance (
  attendance_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  internship_id   INTEGER NOT NULL,
  attendance_date TEXT NOT NULL,
  check_in_time   TEXT,
  check_out_time  TEXT,
  status          TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','late','excused')),
  FOREIGN KEY (internship_id) REFERENCES internships(internship_id) ON DELETE CASCADE,
  UNIQUE (internship_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS tasks (
  task_id         INTEGER PRIMARY KEY AUTOINCREMENT,
  internship_id   INTEGER NOT NULL,
  task_title      TEXT NOT NULL,
  description     TEXT,
  due_date        TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','approved','rejected')),
  submitted_file  TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (internship_id) REFERENCES internships(internship_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS certificates (
  certificate_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  internship_id      INTEGER NOT NULL UNIQUE,
  issue_date         TEXT NOT NULL,
  certificate_number TEXT NOT NULL UNIQUE,
  final_grade        REAL,
  file_url           TEXT,
  FOREIGN KEY (internship_id) REFERENCES internships(internship_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_internships_student ON internships(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_internship ON attendance(internship_id);
CREATE INDEX IF NOT EXISTS idx_tasks_internship ON tasks(internship_id);
CREATE INDEX IF NOT EXISTS idx_certificates_internship ON certificates(internship_id);
`;

let SQL = null;
let db = null;

function persist() {
  const data = db.export();
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

async function init() {
  if (db) return db;
  SQL = await initSqlJs({});
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  db.run('PRAGMA foreign_keys = ON;');
  db.run(SCHEMA);
  persist();
  return db;
}

function run(sql, params = []) {
  db.run(sql, params);
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let row = null;
  if (stmt.step()) row = stmt.getAsObject();
  stmt.free();
  return row;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function lastInsertId() {
  const res = db.exec('SELECT last_insert_rowid() AS id');
  return res[0].values[0][0];
}

// Staff schema addition
const STAFF_SCHEMA = `
CREATE TABLE IF NOT EXISTS staff (
  staff_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  role          TEXT NOT NULL DEFAULT 'staff',
  department    TEXT,
  join_date     TEXT,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','on_leave')),
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS staff_attendance (
  sa_id             INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id          INTEGER NOT NULL,
  attendance_date   TEXT NOT NULL,
  check_in_time     TEXT,
  check_out_time    TEXT,
  status            TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','late','excused')),
  FOREIGN KEY (staff_id) REFERENCES staff(staff_id) ON DELETE CASCADE,
  UNIQUE (staff_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS staff_tasks (
  stask_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id      INTEGER NOT NULL,
  task_title    TEXT NOT NULL,
  description   TEXT,
  due_date      TEXT,
  priority      TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (staff_id) REFERENCES staff(staff_id) ON DELETE CASCADE
);
`;

async function initStaff() {
  if (db) db.run(STAFF_SCHEMA);
}

module.exports = { init, initStaff, run, get, all, lastInsertId, persist };
