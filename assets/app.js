const API_BASE = window.location.origin.includes('4000') ? '' : 'http://localhost:4000';

const Api = {
  async request(method, path, body) {
    const res = await fetch(API_BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      const message = (data && data.error) || 'Something went wrong. Please try again.';
      throw new Error(message);
    }
    return data;
  },
  register(payload) { return this.request('POST', '/api/auth/register', payload); },
  login(payload) { return this.request('POST', '/api/auth/login', payload); },
  getDashboard(studentId) { return this.request('GET', `/api/students/${studentId}/dashboard`); },
  createInternship(payload) { return this.request('POST', '/api/internships', payload); },
  createTask(payload) { return this.request('POST', '/api/tasks', payload); },
  logAttendance(payload) { return this.request('POST', '/api/attendance', payload); },
};

const Auth = {
  KEY: 'ltl_student_session',
  save(student) { localStorage.setItem(this.KEY, JSON.stringify(student)); },
  get() {
    const raw = localStorage.getItem(this.KEY);
    return raw ? JSON.parse(raw) : null;
  },
  clear() { localStorage.removeItem(this.KEY); },
};
