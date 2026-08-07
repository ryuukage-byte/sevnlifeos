'use strict';
/* ═══════════════════════════════════════════════════════════
   SEVNLIFE OS — app.js
   Vanilla JS, localStorage model `sevn_activities`, no build step.
   ═══════════════════════════════════════════════════════════ */

/* ── CONSTANTS ─────────────────────────────── */
const CATEGORIES = {
  'Ibadah':          { icon: 'ph-sparkle',            label: 'Ibadah' },
  'Belajar/Kerja':   { icon: 'ph-code',                label: 'Belajar/Kerja' },
  'Olahraga':        { icon: 'ph-person-simple-run',   label: 'Olahraga' },
  'Makan/Camilan':   { icon: 'ph-fork-knife',          label: 'Makan/Camilan' },
  'Istirahat':       { icon: 'ph-bed',                 label: 'Istirahat' },
  'Lainnya':         { icon: 'ph-dots-three-outline',  label: 'Lainnya' },
};

// kcal per minute — Lari value taken directly from PRD spec; Gym/Yoga are
// reasonable estimates flagged in the UI.
const EXERCISE_TYPES = {
  'Lari': { kcalPerMin: 10 },
  'Gym':  { kcalPerMin: 8 },
  'Yoga': { kcalPerMin: 4 },
};

const MEAL_PRESETS = {
  'Sarapan':        400,
  'Makan Siang':    600,
  'Makan Malam':    600,
  'Camilan':        150,
  'Minuman Manis':  120,
  'Kustom':         0,
};

// System Tagging Architecture — base tags shared by Quick Daily Entry, Projects & Time-Log
const BASE_TAGS = {
  'Productivity':          { icon: 'ph-code',            label: 'Productivity' },
  'Kesehatan':             { icon: 'ph-heartbeat',        label: 'Kesehatan' },
  'Belanja/Konsumtif':     { icon: 'ph-shopping-cart',    label: 'Belanja / Konsumtif' },
  'Refreshing/Gaming':     { icon: 'ph-game-controller',  label: 'Refreshing / Gaming' },
  'Housework&Errands':     { icon: 'ph-broom',            label: 'Housework & Errands' },
};

const POV_OPTIONS = ['Aku', 'Gue', 'Saya'];
const TONE_OPTIONS = ['Santai/Gaul', 'Standar/Natural', 'Reflektif/Ilmiah'];

// Habit Engine — frequency types
const HABIT_FREQS = {
  daily: { label: 'Setiap Hari', icon: 'ph-repeat' },
  weekly: { label: 'X kali / Minggu', icon: 'ph-calendar-check' },
  days:  { label: 'Hari Spesifik', icon: 'ph-calendar-dots' },
};
const WEEKDAY_LABELS = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

const LS_KEY = 'sevn_activities';
const LS_TASKS = 'sevn_tasks';
const LS_PROJECTS = 'sevn_projects';
const LS_HABITS = 'sevn_habits';
const LS_TIMELOG = 'sevn_timelog';
const LS_JOURNAL = 'sevn_journal';
const LS_SETTINGS = 'sevn_settings';

const LS = {
  get: (k, fallback) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? fallback : v; } catch { return fallback; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

/* ── STATE ─────────────────────────────────── */
let state = {
  activities: LS.get(LS_KEY, []),
  tasks: LS.get(LS_TASKS, []),
  projects: LS.get(LS_PROJECTS, []),
  habits: LS.get(LS_HABITS, []),
  timelog: LS.get(LS_TIMELOG, []),
  journal: LS.get(LS_JOURNAL, []),
  settings: LS.get(LS_SETTINGS, { theme: 'light', userName: 'Sevn', reminderEnabled: false, reminderTime: '20:00', reminderFiredDate: null }),

  viewDate: todayStr(),
  openBlockId: null,
  editingId: null,
  tempSubtasks: [],
  activeCategory: 'Ibadah',
  confirmAction: null,
  ringChart: null,
  distChart: null,

  openProjectId: null,
  endTouched: false,
  selectedTimelogTag: 'Productivity',
  selectedPov: 'Aku',
  selectedTone: 'Standar/Natural',
  activeTagFilter: null,

  editingHabitId: null,
  selectedHabitFreq: 'daily',
  selectedHabitDays: [],
  selectedHabitTag: 'Productivity',
};

function saveTasks()    { LS.set(LS_TASKS, state.tasks); }
function saveProjects() { LS.set(LS_PROJECTS, state.projects); }
function saveHabits()   { LS.set(LS_HABITS, state.habits); }
function saveTimelog()  { LS.set(LS_TIMELOG, state.timelog); }
function saveJournal()  { LS.set(LS_JOURNAL, state.journal); }
function saveSettings() { LS.set(LS_SETTINGS, state.settings); }

/* ── HELPERS ───────────────────────────────── */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function addDays(dateStr, n) {
  const [y,m,d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}
function fmtDateLabel(dateStr) {
  const [y,m,d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  const t = todayStr();
  if (dateStr === t) return 'Hari Ini';
  if (dateStr === addDays(t, 1)) return 'Besok';
  if (dateStr === addDays(t, -1)) return 'Kemarin';
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis',"Jumat",'Sabtu'];
  return days[dt.getDay()];
}
function fmtDateSub(dateStr) {
  const [y,m,d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis',"Jumat",'Sabtu'];
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${days[dt.getDay()]}, ${d} ${months[m-1]} ${y}`;
}
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
function fmtDayMonth(dateStr) {
  const [y,m,d] = dateStr.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m-1]}`;
}
// Parses the Super-Planner's "day_range" field (e.g. "3-5", relative to
// project start = creation day) into real calendar dates. Clamps into
// [1, durationDays] and tolerates a lone number ("5" -> "5-5") or malformed input.
function parseDayRange(raw, durationDays) {
  if (!raw) return null;
  const m = String(raw).match(/(\d+)\s*-?\s*(\d+)?/);
  if (!m) return null;
  let start = parseInt(m[1], 10);
  let end = m[2] ? parseInt(m[2], 10) : start;
  if (!start || isNaN(start)) return null;
  if (isNaN(end) || end < start) end = start;
  start = Math.min(Math.max(start, 1), durationDays);
  end = Math.min(Math.max(end, start), durationDays);
  return { startDate: addDays(todayStr(), start - 1), endDate: addDays(todayStr(), end - 1) };
}
function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`;
}
function minutesBetween(start, end) {
  if (!start || !end) return 0;
  const [sh,sm] = start.split(':').map(Number);
  const [eh,em] = end.split(':').map(Number);
  let mins = (eh*60+em) - (sh*60+sm);
  if (mins < 0) mins += 24*60; // overnight block
  return mins;
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function save() { LS.set(LS_KEY, state.activities); }

function normTagKey(s) { return String(s || '').toLowerCase().replace(/[\s\/&#]+/g, ''); }
function matchTag(name) {
  const norm = normTagKey(name);
  return Object.keys(BASE_TAGS).find(k => normTagKey(k) === norm || normTagKey(BASE_TAGS[k].label) === norm) || null;
}

/* ── DYNAMIC TAG SYSTEM (Base Tags + Active Project Tags) ──
   Single Source of Truth: every place a "tag" is picked (Quick Entry,
   Time-Log, Habits) draws from the same merged list, so a task/habit/log
   can be tagged either with a lifestyle category or an active project. */
function getAllTagOptions() {
  const base = Object.keys(BASE_TAGS).map(k => ({ key: k, label: BASE_TAGS[k].label, icon: BASE_TAGS[k].icon, isProject: false }));
  const proj = state.projects.map(p => ({ key: p.tag, label: p.tag, icon: 'ph-rocket-launch', isProject: true, projectId: p.id }));
  return [...base, ...proj];
}
function getTagInfo(tagKey) {
  if (BASE_TAGS[tagKey]) return { ...BASE_TAGS[tagKey], isProject: false };
  const proj = state.projects.find(p => p.tag === tagKey);
  if (proj) return { icon: 'ph-rocket-launch', label: proj.tag, isProject: true, projectId: proj.id };
  return { icon: 'ph-dot-outline', label: tagKey, isProject: false };
}
// Resolves a tag string coming back from an AI response against BOTH base tags
// and active project tags (e.g. "#GameBuilding"), falling back to Productivity.
function resolveAnyTag(rawTag) {
  const norm = normTagKey(rawTag);
  if (!norm) return 'Productivity';
  const base = matchTag(rawTag);
  if (base) return base;
  const proj = state.projects.find(p => normTagKey(p.tag) === norm);
  if (proj) return proj.tag;
  return 'Productivity';
}

function extractJSON(raw) {
  let t = raw.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  const startObj = t.indexOf('{'), startArr = t.indexOf('[');
  let start = -1;
  if (startObj === -1) start = startArr;
  else if (startArr === -1) start = startObj;
  else start = Math.min(startObj, startArr);
  if (start === -1) throw new Error('no json found');
  const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (end === -1 || end < start) throw new Error('no json found');
  return JSON.parse(t.slice(start, end + 1));
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.focus(); ta.select();
  try { document.execCommand('copy'); } catch {}
  document.body.removeChild(ta);
}
function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  else fallbackCopy(text);
}
function openGemini() { window.open('https://gemini.google.com/app', '_blank'); }

function fmtDuration(mins) {
  mins = Number(mins) || 0;
  if (!mins) return '—';
  if (mins < 60) return `${mins} mnt`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h} j ${m} mnt` : `${h} j`;
}

function showToast(msg, type = 'success') {
  const wrap = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'success' ? 'ph-check-circle' : 'ph-x-circle';
  el.innerHTML = `<i class="ph-fill ${icon}"></i><span>${esc(msg)}</span>`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 2700);
}

/* ── THEME (Dark Mode) ─────────────────────── */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.settings.theme === 'dark' ? 'dark' : 'light');
  const toggle = document.getElementById('toggle-dark-mode');
  if (toggle) toggle.classList.toggle('on', state.settings.theme === 'dark');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', state.settings.theme === 'dark' ? '#2A2E37' : '#E0E5EC');
}
function toggleDarkMode() {
  state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
  saveSettings();
  applyTheme();
}

/* ── GREETING ───────────────────────────────── */
function renderGreeting() {
  const dateEl = document.getElementById('greeting-date');
  if (dateEl) dateEl.textContent = fmtDateSub(todayStr());
  const hiEl = document.getElementById('greeting-hi');
  const name = (state.settings.userName || '').trim();
  if (hiEl) hiEl.textContent = name ? `Apa yang kamu kerjakan hari ini, ${name}?` : 'Apa yang kamu kerjakan hari ini?';
}

/* ── LOCAL NATIVE REMINDERS ─────────────────── */
function renderReminderUI() {
  const toggle = document.getElementById('toggle-reminder');
  const row = document.getElementById('reminder-time-row');
  const timeInput = document.getElementById('reminder-time');
  if (!toggle) return;
  toggle.classList.toggle('on', !!state.settings.reminderEnabled);
  row.style.display = state.settings.reminderEnabled ? 'flex' : 'none';
  timeInput.value = state.settings.reminderTime || '20:00';
  const nameInput = document.getElementById('setting-username');
  if (nameInput) nameInput.value = state.settings.userName || '';
}
function toggleReminder() {
  state.settings.reminderEnabled = !state.settings.reminderEnabled;
  if (state.settings.reminderEnabled && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  saveSettings();
  renderReminderUI();
}
function fireReminder(count) {
  const body = `Ada ${count} tugas yang belum diselesaikan hari ini!`;
  if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker.ready
      .then(reg => reg.showNotification('SevnLife OS', { body, icon: './icons/icon-192.png', badge: './icons/icon-192.png' }))
      .catch(() => showToast(body));
  } else {
    showToast(body);
  }
}
function checkReminderTick() {
  if (!state.settings.reminderEnabled) return;
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  if (hhmm !== state.settings.reminderTime) return;
  const t = todayStr();
  if (state.settings.reminderFiredDate === t) return;
  const incomplete = state.tasks.filter(x => !x.projectId && x.date === t && !x.isDone).length;
  if (incomplete > 0) fireReminder(incomplete);
  state.settings.reminderFiredDate = t;
  saveSettings();
}

/* ── DATE NAV & PAGE SWITCH ────────────────── */
function renderDateNav() {
  document.getElementById('date-label').textContent = fmtDateLabel(state.viewDate);
  document.getElementById('date-sub').textContent = fmtDateSub(state.viewDate);
  document.getElementById('timeline-label').textContent =
    state.viewDate === todayStr() ? 'Linimasa Hari Ini' : `Linimasa · ${fmtDateSub(state.viewDate)}`;
  renderQuickTasks();
}

/* ── QUICK DAILY ENTRY ─────────────────────── */
function buildQuickPrompt(text) {
  const tagList = Object.keys(BASE_TAGS).map(k => BASE_TAGS[k].label).join(', ');
  const projectTags = state.projects.map(p => p.tag).join(', ') || '(tidak ada proyek aktif)';
  return `Analisa kalimat tugas berikut: "${text}"

DAFTAR PROYEK/GOAL AKTIF SAAT INI: [${projectTags}]

Tentukan:
1. Judul tugas yang ringkas.
2. Kategori tag — jika tugas ini berkaitan langsung dengan salah satu PROYEK AKTIF di atas, pilih tag proyek tersebut PERSIS. Jika tidak, PILIH SALAH SATU PERSIS dari kategori dasar ini: [${tagList}]
3. Jika ada estimasi durasi disebutkan, ekstrak dalam MENIT saja (angka). Jika tidak ada, null.
4. Jika ada jam spesifik disebutkan (mis. "jam 7 malam"), ekstrak sebagai "HH:MM" format 24 jam. Jika tidak ada, null.

Kembalikan HANYA format JSON valid berikut, tanpa penjelasan tambahan:
{"title": "...", "tag": "salah satu dari daftar kategori ATAU tag proyek aktif", "estimatedMinutes": angka_atau_null, "timeHint": "HH:MM_atau_null"}`;
}

function sendQuickEntry() {
  const input = document.getElementById('quick-entry-input');
  const text = input.value.trim();
  if (!text) { showToast('Ketik tugas dulu', 'error'); return; }
  copyToClipboard(buildQuickPrompt(text));
  openGemini();
  openModal('quick-entry-modal');
  showToast('Prompt disalin & Gemini dibuka — tempel balasannya di sini');
}

function processQuickEntryPaste() {
  const raw = document.getElementById('quick-paste-input').value;
  if (!raw.trim()) { showToast('Tempel hasil AI dulu', 'error'); return; }
  let data;
  try { data = extractJSON(raw); } catch { showToast('Gagal memproses JSON', 'error'); return; }
  const items = Array.isArray(data) ? data : [data];
  let count = 0;
  items.forEach(it => {
    if (!it || !it.title) return;
    const tag = resolveAnyTag(it.tag);
    state.tasks.push({
      id: genId('task'), date: state.viewDate, title: String(it.title).trim(), tag,
      estimatedMinutes: Number(it.estimatedMinutes) || null, timeHint: it.timeHint || null,
      projectId: null, phaseLabel: null, durationLabel: null, isHabit: false, isDone: false,
      createdAt: new Date().toISOString(),
    });
    count++;
  });
  if (!count) { showToast('Tidak ada tugas terdeteksi di JSON', 'error'); return; }
  saveTasks();
  closeModal('quick-entry-modal');
  document.getElementById('quick-entry-input').value = '';
  document.getElementById('quick-paste-input').value = '';
  renderQuickTasks();
  showToast(`${count} tugas ditambahkan`);
}

// Shared schedule badge for a project task — used on both the Beranda
// "Terjadwal dari Proyek" section and the Project accordion, so an overdue
// task looks the same (and stays visible) everywhere.
function isTaskOverdue(t) {
  return !!(t.scheduleEnd && !t.isDone && t.scheduleEnd < todayStr());
}
function taskScheduleBadge(t) {
  if (!t.scheduleStart) return '';
  if (isTaskOverdue(t)) {
    const days = daysBetween(t.scheduleEnd, todayStr());
    return `<span class="badge badge-overdue" data-reschedule="${t.id}" title="Ketuk untuk geser ke hari ini"><i class="ph-fill ph-warning-circle"></i> Telat ${days}h · Geser</span>`;
  }
  return t.scheduleStart === t.scheduleEnd
    ? `<span class="badge sched-badge"><i class="ph ph-calendar-dots"></i> ${fmtDayMonth(t.scheduleStart)}</span>`
    : `<span class="badge sched-badge"><i class="ph ph-calendar-dots"></i> ${fmtDayMonth(t.scheduleStart)}\u2013${fmtDayMonth(t.scheduleEnd)}</span>`;
}
function daysBetween(a, b) {
  const [ay,am,ad] = a.split('-').map(Number), [by,bm,bd] = b.split('-').map(Number);
  const diff = Date.UTC(by,bm-1,bd) - Date.UTC(ay,am-1,ad);
  return Math.round(diff / 86400000);
}
// Manual reschedule: bump the task's day-range to today. This is a per-task
// nudge, not a full cascading re-plan of the project — simplest thing that's
// still honest about what happened (you slipped, here's today as new date).
function rescheduleTaskToToday(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  t.scheduleStart = todayStr(); t.scheduleEnd = todayStr(); t.date = todayStr();
  saveTasks();
  renderProjects(); renderQuickTasks();
  showToast('Tugas digeser ke hari ini');
}

function renderScheduledToday() {
  const wrap = document.getElementById('scheduled-tasks-wrap');
  if (!wrap) return;
  const v = state.viewDate;
  const isToday = v === todayStr();
  const list = state.tasks.filter(t => {
    if (!t.projectId || !t.scheduleStart) return false;
    if (t.scheduleStart <= v && v <= t.scheduleEnd) return true;
    return isToday && isTaskOverdue(t); // slipped tasks bleed into "today" until handled
  });
  if (!list.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = `<div class="section-label"><span>Terjadwal dari Proyek</span><span class="line"></span></div>` +
    list.map(t => {
      const proj = state.projects.find(p => p.id === t.projectId);
      return `<div class="ptask surface-el-sm" style="margin-bottom:9px;">
        <div class="subtask-check ${t.isDone ? 'done' : ''}" data-ptask-toggle="${t.id}"><i class="ph-bold ph-check"></i></div>
        <div class="ptask-title ${t.isDone ? 'done' : ''}" data-ptask-toggle="${t.id}">${esc(t.title)}</div>
        <div class="ptask-badges">
          ${proj ? `<span class="tag-chip project"><i class="ph ph-rocket-launch"></i> ${esc(proj.title)}</span>` : ''}
          ${taskScheduleBadge(t)}
          ${t.durationLabel ? `<span class="badge">${esc(t.durationLabel)}</span>` : ''}
        </div>
      </div>`;
    }).join('');
}

function renderQuickTasks() {
  renderScheduledToday();
  const wrap = document.getElementById('quick-tasks-wrap');
  const filterWrap = document.getElementById('quick-tasks-filter');
  if (!wrap) return;
  const full = state.tasks.filter(t => !t.projectId && t.date === state.viewDate);

  if (filterWrap) {
    if (!full.length) { filterWrap.innerHTML = ''; }
    else {
      const usedTags = [...new Set(full.map(t => t.tag))];
      if (!usedTags.includes(state.activeTagFilter)) state.activeTagFilter = null;
      const chips = [`<button type="button" class="tag-opt ${!state.activeTagFilter ? 'active' : ''}" data-tag-filter="">Semua</button>`]
        .concat(usedTags.map(tk => {
          const info = getTagInfo(tk);
          return `<button type="button" class="tag-opt ${state.activeTagFilter === tk ? 'active' : ''}" data-tag-filter="${esc(tk)}"><i class="ph ${info.icon}"></i> ${esc(info.label)}</button>`;
        }));
      filterWrap.innerHTML = usedTags.length > 1 ? chips.join('') : '';
    }
  }

  const list = state.activeTagFilter ? full.filter(t => t.tag === state.activeTagFilter) : full;
  if (!full.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = `<div class="section-label"><span>Tugas Cepat</span><span class="line"></span></div>` +
    (list.length ? list.map(t => {
      const tagInfo = getTagInfo(t.tag);
      return `<div class="ptask surface-el-sm" style="margin-bottom:9px;">
        <div class="subtask-check ${t.isDone ? 'done' : ''}" data-qtask-toggle="${t.id}"><i class="ph-bold ph-check"></i></div>
        <div class="ptask-title ${t.isDone ? 'done' : ''}" data-qtask-toggle="${t.id}">${esc(t.title)}</div>
        <div class="ptask-badges">
          <span class="tag-chip ${tagInfo.isProject ? 'project' : ''}"><i class="ph ${tagInfo.icon}"></i> ${esc(tagInfo.label)}</span>
          ${t.estimatedMinutes ? `<span class="badge">${fmtDuration(t.estimatedMinutes)}</span>` : ''}
        </div>
      </div>`;
    }).join('') : `<p style="font-size:12px; color:var(--text3); font-weight:600; margin:0 0 12px;">Tidak ada tugas dengan tag ini.</p>`);
}

function toggleQuickTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.isDone = !task.isDone;
  if (task.isDone) autoSyncTaskToTimelog(task);
  saveTasks();
  renderQuickTasks();
}

function goToPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  document.getElementById('fab').style.display = page === 'home' ? 'flex' : 'none';
  if (page === 'projects') renderProjects();
  if (page === 'habits') renderHabits();
  if (page === 'journal') { renderTimelog(); renderConsistency(); renderDistributionChart(); renderPersonaRows(); renderJournalList(); }
}

/* ── TIMELINE RENDER ───────────────────────── */
function getDayActivities(dateStr) {
  return state.activities
    .filter(a => a.date === dateStr)
    .sort((a,b) => (a.timeStart || '').localeCompare(b.timeStart || ''));
}

function renderTimeline() {
  const list = getDayActivities(state.viewDate);
  const wrap = document.getElementById('timeline');

  if (!list.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="ph ph-coffee"></i><p>Belum ada kegiatan. Ketuk tombol + untuk menambahkan.</p></div>`;
    renderProgress(list);
    return;
  }

  wrap.innerHTML = list.map(a => {
    const cat = CATEGORIES[a.category] || CATEGORIES['Lainnya'];
    const total = a.subTasks?.length || 0;
    const done = a.subTasks?.filter(s => s.isDone).length || 0;
    const allDone = total > 0 && done === total;
    const isOpen = state.openBlockId === a.id;
    const metaBits = [];
    if (a.caloriesBurned) metaBits.push(`<i class="ph ph-fire"></i> ${a.caloriesBurned} kcal`);
    if (a.caloriesConsumed) metaBits.push(`<i class="ph ph-bowl-food"></i> ${a.caloriesConsumed} kcal`);
    if (total) metaBits.push(`<i class="ph ph-list-checks"></i> ${done}/${total}`);

    return `
    <div class="tblock surface-el ${isOpen ? 'open' : ''}" data-id="${a.id}">
      <div class="tblock-head" data-toggle="${a.id}">
        <div class="tblock-icon"><i class="ph ${cat.icon}"></i></div>
        <div class="tblock-info">
          <div class="tblock-time">${a.timeStart || '--:--'} – ${a.timeEnd || '--:--'}</div>
          <div class="tblock-title ${allDone ? 'done' : ''}">${esc(a.title)}</div>
          ${metaBits.length ? `<div class="tblock-meta">${metaBits.join(' &nbsp; ')}</div>` : ''}
        </div>
        <i class="ph ph-caret-down tblock-chevron"></i>
      </div>
      <div class="tblock-body">
        <div class="tblock-body-inner">
          ${total ? `<div class="subtask-list">${a.subTasks.map(s => `
            <div class="subtask surface-in-sm">
              <div class="subtask-check ${s.isDone ? 'done' : ''}" data-sub-toggle="${a.id}|${s.id}"><i class="ph-bold ph-check"></i></div>
              <div class="subtask-title ${s.isDone ? 'done' : ''}" data-sub-toggle="${a.id}|${s.id}">${esc(s.title)}</div>
            </div>`).join('')}</div>` : `<p style="font-size:12px; color:var(--text3); font-weight:600; margin:2px 0 12px;">Tidak ada sub-tugas.</p>`}
          <div class="tblock-actions">
            <button class="btn" data-edit="${a.id}"><i class="ph ph-pencil-simple"></i> Edit</button>
            <button class="btn btn-danger" data-del="${a.id}"><i class="ph ph-trash"></i> Hapus</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  renderProgress(list);
}

function renderProgress(list) {
  const totalSub = list.reduce((a,c) => a + (c.subTasks?.length || 0), 0);
  const doneSub  = list.reduce((a,c) => a + (c.subTasks?.filter(s=>s.isDone).length || 0), 0);
  const pct = totalSub ? Math.round((doneSub/totalSub)*100) : 0;
  const burned   = list.reduce((a,c) => a + (Number(c.caloriesBurned) || 0), 0);
  const consumed = list.reduce((a,c) => a + (Number(c.caloriesConsumed) || 0), 0);

  document.getElementById('ring-pct').textContent = `${pct}%`;
  document.getElementById('stat-burned').textContent = `${burned} kcal`;
  document.getElementById('stat-consumed').textContent = `${consumed} kcal`;
  const net = consumed - burned;
  const netEl = document.getElementById('stat-net');
  netEl.textContent = `${net >= 0 ? '+' : ''}${net} kcal`;

  const ctx = document.getElementById('progress-ring');
  const data = {
    datasets: [{
      data: [pct, 100-pct],
      backgroundColor: ['#87A96B', 'rgba(163,177,198,0.28)'],
      borderWidth: 0,
      cutout: '76%',
    }],
  };
  if (state.ringChart) {
    state.ringChart.data = data;
    state.ringChart.update();
  } else {
    state.ringChart = new Chart(ctx, {
      type: 'doughnut',
      data,
      options: { responsive:false, animation:{duration:400}, plugins:{tooltip:{enabled:false}, legend:{display:false}} },
    });
  }
}

/* ── SUBTASK TOGGLE (from timeline, persists immediately) ── */
function toggleSubtask(activityId, subId) {
  const act = state.activities.find(a => a.id === activityId);
  if (!act) return;
  const sub = act.subTasks.find(s => s.id === subId);
  if (!sub) return;
  sub.isDone = !sub.isDone;
  save();
  renderTimeline();
}

/* ── ACTIVITY MODAL ────────────────────────── */
function renderCatGrid() {
  const grid = document.getElementById('cat-grid');
  grid.innerHTML = Object.entries(CATEGORIES).map(([key, c]) => `
    <button type="button" class="cat-opt ${state.activeCategory === key ? 'active' : ''}" data-cat="${key}">
      <i class="ph ${c.icon}"></i><span>${c.label}</span>
    </button>`).join('');
  grid.querySelectorAll('[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeCategory = btn.dataset.cat;
      renderCatGrid();
      updateCategoryFields();
      autoCalc();
    });
  });
  updateCategoryFields();
}

function updateCategoryFields() {
  const isExercise = state.activeCategory === 'Olahraga';
  const isMeal = state.activeCategory === 'Makan/Camilan';
  document.getElementById('exercise-type-field').style.display = isExercise ? 'block' : 'none';
  document.getElementById('meal-preset-field').style.display = isMeal ? 'block' : 'none';
  document.getElementById('calorie-fields').style.display = (isExercise || isMeal) ? 'flex' : 'none';
  document.getElementById('burned-field').style.display = isExercise ? 'block' : 'none';
  document.getElementById('consumed-field').style.display = isMeal ? 'block' : 'none';
}

function populateSelects() {
  const exSel = document.getElementById('exercise-type');
  exSel.innerHTML = Object.entries(EXERCISE_TYPES).map(([k,v]) => `<option value="${k}">${k} · ${v.kcalPerMin} kcal/menit</option>`).join('');
  const mealSel = document.getElementById('meal-preset');
  mealSel.innerHTML = Object.entries(MEAL_PRESETS).map(([k,v]) => `<option value="${k}">${k}${v ? ` · ~${v} kcal` : ''}</option>`).join('');
}

function autoCalc() {
  if (state.activeCategory === 'Olahraga') {
    const type = document.getElementById('exercise-type').value;
    const mins = minutesBetween(document.getElementById('activity-start').value, document.getElementById('activity-end').value);
    const mult = EXERCISE_TYPES[type]?.kcalPerMin || 0;
    document.getElementById('activity-burned').value = mins > 0 ? Math.round(mins * mult) : '';
  } else if (state.activeCategory === 'Makan/Camilan') {
    const preset = document.getElementById('meal-preset').value;
    const val = MEAL_PRESETS[preset] || 0;
    if (val) document.getElementById('activity-consumed').value = val;
  }
}

function renderSubtaskInputs() {
  const wrap = document.getElementById('subtask-inputs');
  wrap.innerHTML = state.tempSubtasks.map((s, i) => `
    <div class="subtask-input-row">
      <input type="text" value="${esc(s.title)}" data-sub-idx="${i}" placeholder="Sub-tugas">
      <button type="button" class="btn btn-icon btn-danger" data-sub-remove="${i}" style="width:40px;height:40px;"><i class="ph ph-x"></i></button>
    </div>`).join('');
  wrap.querySelectorAll('[data-sub-idx]').forEach(inp => {
    inp.addEventListener('input', () => { state.tempSubtasks[+inp.dataset.subIdx].title = inp.value; });
  });
  wrap.querySelectorAll('[data-sub-remove]').forEach(btn => {
    btn.addEventListener('click', () => { state.tempSubtasks.splice(+btn.dataset.subRemove, 1); renderSubtaskInputs(); });
  });
}

function openActivityModal(existing) {
  state.editingId = existing ? existing.id : null;
  state.activeCategory = existing ? existing.category : 'Ibadah';
  state.tempSubtasks = existing ? existing.subTasks.map(s => ({...s})) : [];
  // For a fresh activity, keep Jam Selesai synced to Jam Mulai until the user
  // deliberately edits it — lets quick zero-duration entries be "klik klik beres".
  // Editing an existing activity preserves whatever end time was already set.
  state.endTouched = !!existing;

  document.getElementById('activity-modal-title').textContent = existing ? 'Edit Kegiatan' : 'Tambah Kegiatan';
  document.getElementById('activity-title').value = existing ? existing.title : '';
  document.getElementById('activity-start').value = existing ? existing.timeStart : '';
  document.getElementById('activity-end').value = existing ? existing.timeEnd : '';
  document.getElementById('activity-burned').value = existing ? (existing.caloriesBurned || '') : '';
  document.getElementById('activity-consumed').value = existing ? (existing.caloriesConsumed || '') : '';
  document.getElementById('btn-delete-activity').style.display = existing ? 'inline-flex' : 'none';

  renderCatGrid();
  populateSelects();
  renderSubtaskInputs();
  openModal('activity-modal');
}

function saveActivityFromModal() {
  const title = document.getElementById('activity-title').value.trim();
  const timeStart = document.getElementById('activity-start').value;
  const timeEnd = document.getElementById('activity-end').value;

  if (!title) { showToast('Judul kegiatan wajib diisi', 'error'); return; }
  if (!timeStart || !timeEnd) { showToast('Jam mulai & selesai wajib diisi', 'error'); return; }

  const cleanSubtasks = state.tempSubtasks
    .map(s => ({ id: s.id || genId('sub'), title: (s.title||'').trim(), isDone: !!s.isDone }))
    .filter(s => s.title);

  const payload = {
    date: state.viewDate,
    timeStart, timeEnd,
    category: state.activeCategory,
    title,
    caloriesBurned: state.activeCategory === 'Olahraga' ? (Number(document.getElementById('activity-burned').value) || 0) : 0,
    caloriesConsumed: state.activeCategory === 'Makan/Camilan' ? (Number(document.getElementById('activity-consumed').value) || 0) : 0,
    subTasks: cleanSubtasks,
  };

  if (state.editingId) {
    const idx = state.activities.findIndex(a => a.id === state.editingId);
    if (idx !== -1) state.activities[idx] = { ...state.activities[idx], ...payload };
  } else {
    state.activities.push({ id: genId('act'), ...payload });
  }
  save();
  closeModal('activity-modal');
  renderTimeline();
  showToast(state.editingId ? 'Kegiatan diperbarui' : 'Kegiatan disimpan');
}

function deleteActivity(id) {
  state.activities = state.activities.filter(a => a.id !== id);
  save();
  renderTimeline();
  showToast('Kegiatan dihapus');
}

/* ── MODAL HELPERS ─────────────────────────── */
function openModal(id) { document.getElementById(id).classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModal(id) { document.getElementById(id).classList.remove('open'); document.body.style.overflow = ''; }

function confirmDialog(title, body, onOk) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-body').textContent = body;
  state.confirmAction = onOk;
  openModal('confirm-modal');
}

/* ── PROJECTS (Goal Super-Planner + Accordion UI) ── */
function buildProjectPrompt(goalText) {
  return `Kamu adalah asisten perencana proyek. Pecah tujuan/inisiatif berikut menjadi struktur proyek yang matang, TERMASUK penjadwalan tiap tugas:
"${goalText}"

Kembalikan HANYA format JSON valid berikut, tanpa penjelasan tambahan:
{
  "project_title": "judul proyek singkat",
  "project_tag": "#TagProyek (PascalCase, tanpa spasi)",
  "duration_days": angka_total_hari_proyek,
  "phases": [
    { "phase_label": "Fase 1", "tasks": [
        {"title": "nama tugas", "duration_label": "2 jam", "day_range": "1-3"}
      ]
    }
  ],
  "habits": [
    {"title": "kebiasaan pendukung yang relevan", "frequency": "Daily"},
    {"title": "kebiasaan pendukung lain", "frequency": "Weekly:3"}
  ]
}
Buat 2-4 fase yang realistis dan berurutan, masing-masing berisi 2-5 tugas. Buat 1-4 kebiasaan pendukung yang relevan. Untuk field "frequency" tiap habit, gunakan PERSIS salah satu dari: "Daily" (setiap hari), atau "Weekly:N" dengan N = jumlah hari yang disarankan per minggu (contoh "Weekly:3").

ATURAN PENJADWALAN (WAJIB):
1. "duration_days" = total estimasi lama proyek dalam hari (kalau user sebutkan durasi eksplisit, pakai itu; kalau tidak, perkirakan yang realistis dari cakupan tugasnya).
2. "day_range" tiap tugas = rentang hari kerja RELATIF terhadap mulainya proyek, format string "hari_mulai-hari_selesai" (hari ke-1 = hari proyek dimulai). Contoh: tugas di 3 hari pertama = "1-3", tugas minggu kedua = "8-10".
3. Susun day_range tiap tugas berurutan mengikuti urutan fase (fase awal dapat rentang hari lebih kecil), TIDAK boleh tumpang tindih secara berlebihan dalam satu fase, dan totalnya harus muat dalam "duration_days".
4. Tugas dengan estimasi durasi kerja pendek (mis. "2 jam") boleh diberi day_range 1 hari saja (mis. "5-5").`;
}

function openProjectModal() {
  document.getElementById('project-goal-input').value = '';
  document.getElementById('project-paste-input').value = '';
  openModal('project-modal');
}

function generateProjectPrompt() {
  const goal = document.getElementById('project-goal-input').value.trim();
  if (!goal) { showToast('Ketik tujuan/inisiatif dulu', 'error'); return; }
  copyToClipboard(buildProjectPrompt(goal));
  openGemini();
  showToast('Prompt disalin & Gemini dibuka — tempel hasilnya di bawah');
}

function processProjectPaste() {
  const raw = document.getElementById('project-paste-input').value;
  if (!raw.trim()) { showToast('Tempel hasil AI dulu', 'error'); return; }
  let data;
  try { data = extractJSON(raw); } catch { showToast('Gagal memproses JSON', 'error'); return; }
  if (!data || !data.project_title) { showToast('Format JSON tidak sesuai', 'error'); return; }

  const projectId = genId('proj');
  let tag = String(data.project_tag || '').trim() || `#${String(data.project_title).replace(/\s+/g, '')}`;
  if (!tag.startsWith('#')) tag = '#' + tag;

  const startDate = todayStr();
  const durationDays = Math.max(1, parseInt(data.duration_days, 10) || 14);
  const targetCompletionDate = addDays(startDate, durationDays - 1);

  state.projects.push({ id: projectId, title: data.project_title, tag, startDate, targetCompletionDate, createdAt: new Date().toISOString() });

  let count = 0;
  (data.phases || []).forEach(phase => {
    (phase.tasks || []).forEach(t => {
      if (!t || !t.title) return;
      const range = parseDayRange(t.day_range, durationDays);
      state.tasks.push({
        id: genId('task'), date: range ? range.endDate : null, title: String(t.title).trim(), tag, projectId,
        phaseLabel: phase.phase_label || 'Tugas', durationLabel: t.duration_label || null,
        scheduleStart: range ? range.startDate : null, scheduleEnd: range ? range.endDate : null,
        isHabit: false, isDone: false, estimatedMinutes: null, timeHint: null,
        createdAt: new Date().toISOString(),
      });
      count++;
    });
  });
  (data.habits || []).forEach(h => {
    const title = typeof h === 'string' ? h : h?.title;
    if (!title) return;
    const freq = parseHabitFrequency(typeof h === 'object' ? h?.frequency : null);
    state.habits.push({
      id: genId('habit'), title: String(title).trim(), tag, projectId,
      ...freq,
      completions: {}, createdAt: new Date().toISOString(),
    });
    count++;
  });

  if (!count) { showToast('Proyek tidak memiliki tugas yang valid', 'error'); return; }

  saveTasks(); saveProjects(); saveHabits();
  closeModal('project-modal');
  state.openProjectId = projectId;
  renderProjects();
  showToast(`Proyek dibuat dengan ${count} tugas`);
}

function renderProjects() {
  const wrap = document.getElementById('projects-list');
  if (!wrap) return;
  if (!state.projects.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="ph ph-rocket-launch"></i><p>Belum ada proyek. Ketuk "Proyek Baru" untuk merombak tujuanmu jadi rencana terstruktur.</p></div>`;
    return;
  }
  wrap.innerHTML = state.projects.map(p => {
    const scheduled = state.tasks.filter(t => t.projectId === p.id);
    const habits = state.habits.filter(h => h.projectId === p.id);
    const totalUnits = scheduled.length + habits.length;
    const doneUnits = scheduled.filter(t => t.isDone).length + habits.filter(h => isHabitDueToday(h) ? !!h.completions[todayStr()] : false).length;
    const pct = totalUnits ? Math.round((doneUnits / totalUnits) * 100) : 0;
    const isOpen = state.openProjectId === p.id;

    const overdueCount = scheduled.filter(isTaskOverdue).length;
    const phaseGroups = [];
    scheduled.forEach(t => {
      let g = phaseGroups.find(g => g.label === (t.phaseLabel || 'Tugas'));
      if (!g) { g = { label: t.phaseLabel || 'Tugas', tasks: [] }; phaseGroups.push(g); }
      g.tasks.push(t);
    });

    const renderTask = t => `
      <div class="ptask surface-in-sm">
        <div class="subtask-check ${t.isDone ? 'done' : ''}" data-ptask-toggle="${t.id}"><i class="ph-bold ph-check"></i></div>
        <div class="ptask-title ${t.isDone ? 'done' : ''}" data-ptask-toggle="${t.id}">${esc(t.title)}</div>
        <div class="ptask-badges">${taskScheduleBadge(t)}${t.durationLabel ? `<span class="badge">${esc(t.durationLabel)}</span>` : ''}</div>
      </div>`;

    const renderHabit = h => {
      const doneToday = !!h.completions[todayStr()];
      return `
      <div class="ptask surface-in-sm">
        <div class="subtask-check ${doneToday ? 'done' : ''}" data-phabit-toggle="${h.id}"><i class="ph-bold ph-check"></i></div>
        <div class="ptask-title ${doneToday ? 'done' : ''}" data-phabit-toggle="${h.id}">${esc(h.title)}</div>
        <div class="ptask-badges">${habitFreqBadge(h)}</div>
      </div>`;
    };

    return `
    <div class="project-card surface-el ${isOpen ? 'open' : ''}" data-project="${p.id}">
      <div class="project-head" data-project-toggle="${p.id}">
        <div class="project-title-row">
          <div class="project-title">${esc(p.title)}</div>
          <i class="ph ph-caret-down project-chevron"></i>
        </div>
        <div class="project-meta-row"><span class="tag-chip project">${esc(p.tag)}</span><span class="badge">${doneUnits}/${totalUnits} item</span>${overdueCount ? `<span class="badge badge-overdue"><i class="ph-fill ph-warning-circle"></i> ${overdueCount} terlambat</span>` : ''}${p.targetCompletionDate ? `<span class="badge"><i class="ph ph-flag-checkered"></i> ${fmtDayMonth(p.targetCompletionDate)}</span>` : ''}</div>
        <div class="project-progress-row">
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="progress-pct">${pct}%</div>
        </div>
      </div>
      <div class="project-body">
        <div class="project-body-inner">
          ${phaseGroups.map(g => `<div class="ptask-section-label">${esc(g.label)}</div>${g.tasks.map(renderTask).join('')}`).join('')}
          ${habits.length ? `<div class="ptask-section-label">Kebiasaan Pendukung</div>${habits.map(renderHabit).join('')}` : ''}
          <div class="project-actions">
            <button class="btn btn-danger" data-project-del="${p.id}"><i class="ph ph-trash"></i> Hapus Proyek</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function togglePTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.isDone = !task.isDone;
  if (task.isDone) autoSyncTaskToTimelog(task);
  saveTasks();
  renderProjects();
}

function deleteProject(id) {
  confirmDialog('Hapus proyek ini?', 'Seluruh tugas terjadwal & kebiasaan pendukung di dalamnya akan dihapus.', () => {
    state.projects = state.projects.filter(p => p.id !== id);
    state.tasks = state.tasks.filter(t => t.projectId !== id);
    state.habits = state.habits.filter(h => h.projectId !== id);
    saveProjects(); saveTasks(); saveHabits();
    if (state.openProjectId === id) state.openProjectId = null;
    renderProjects();
    showToast('Proyek dihapus');
  });
}

// Shared parser for the "frequency" string AI responses use across both the
// Goal Super-Planner and Contextual AI features — one format, one place.
// Accepts: "Daily" | "Weekly:N" | "Days:D1,D2,..." (0=Minggu..6=Sabtu).
function parseHabitFrequency(raw) {
  const s = String(raw || 'Daily').trim();
  if (/^days:/i.test(s)) {
    const days = s.split(':')[1].split(',').map(n => parseInt(n.trim(), 10)).filter(n => n >= 0 && n <= 6);
    return { frequency: 'days', weeklyTarget: 3, daysOfWeek: days.length ? days : [1,2,3,4,5] };
  }
  if (/^weekly/i.test(s)) {
    const n = parseInt(s.split(':')[1], 10);
    return { frequency: 'weekly', weeklyTarget: n > 0 ? n : 3, daysOfWeek: [] };
  }
  return { frequency: 'daily', weeklyTarget: 3, daysOfWeek: [] };
}

/* ── HABIT ENGINE (Frequency, Streaks, Auto-Reset, Linked Projects) ── */
// "Auto-reset" happens implicitly: a habit's done-state for a given day
// is derived by looking up `completions[dateStr]`, so a new day always
// renders unchecked without any midnight housekeeping job needed.
function isHabitDueToday(h, dateStr) {
  dateStr = dateStr || todayStr();
  if (h.frequency === 'days') {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    return (h.daysOfWeek || []).includes(dow);
  }
  return true; // daily & weekly habits are always actionable "today"
}

function weekStartStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay(); // 0=Sun
  dt.setDate(dt.getDate() - dow);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

function calcWeeklyCount(h) {
  const start = weekStartStr(todayStr());
  return Object.keys(h.completions || {}).filter(d => d >= start && !!h.completions[d]).length;
}

// Consecutive-day streak, walking backward from today (or yesterday if
// today isn't logged yet so an unbroken streak doesn't look "broken" mid-day).
// Days the habit isn't scheduled on (for "Specific Days" habits) are skipped
// rather than breaking the chain.
function calcHabitStreak(h) {
  if (h.frequency === 'weekly') return null; // streaks don't apply cleanly to X/week habits
  let streak = 0;
  let d = todayStr();
  if (!h.completions[d]) d = addDays(d, -1);
  let guard = 0;
  while (guard++ < 1000) {
    if (h.frequency === 'days' && !isHabitDueToday(h, d)) { d = addDays(d, -1); continue; }
    if (h.completions[d]) { streak++; d = addDays(d, -1); }
    else break;
  }
  return streak;
}

function habitFreqBadge(h) {
  if (h.frequency === 'weekly') {
    return `<span class="badge">${calcWeeklyCount(h)}/${h.weeklyTarget || 3} mgg ini</span>`;
  }
  const streak = calcHabitStreak(h);
  if (streak > 0) return `<span class="badge streak-flame"><i class="ph-fill ph-fire"></i> ${streak}</span>`;
  const freqLabel = h.frequency === 'days'
    ? (h.daysOfWeek || []).map(n => WEEKDAY_LABELS[n]).join('/') || 'Hari Spesifik'
    : 'Harian';
  return `<span class="badge">${esc(freqLabel)}</span>`;
}

function autoSyncHabitToTimelog(h) {
  const t = todayStr();
  const already = state.timelog.find(e => e.habitId === h.id && e.date === t);
  if (already) return; // dedup, same pattern as task auto-sync
  state.timelog.push({
    id: genId('log'), date: t, title: h.title, tag: h.tag,
    durationMinutes: 0, source: 'habit', taskId: null, habitId: h.id,
    createdAt: new Date().toISOString(),
  });
  saveTimelog();
  if (document.getElementById('page-journal')?.classList.contains('active')) renderTimelog();
}

function toggleHabitDone(id, dateStr) {
  const h = state.habits.find(x => x.id === id);
  if (!h) return;
  dateStr = dateStr || todayStr();
  h.completions = h.completions || {};
  if (h.completions[dateStr]) delete h.completions[dateStr];
  else {
    h.completions[dateStr] = true;
    if (dateStr === todayStr()) autoSyncHabitToTimelog(h);
  }
  saveHabits();
}

function renderHabitFreqGrid() {
  const grid = document.getElementById('habit-freq-grid');
  if (!grid) return;
  grid.innerHTML = Object.entries(HABIT_FREQS).map(([k, f]) =>
    `<button type="button" class="tag-opt ${state.selectedHabitFreq === k ? 'active' : ''}" data-habit-freq="${k}"><i class="ph ${f.icon}"></i> ${f.label}</button>`
  ).join('');
  grid.querySelectorAll('[data-habit-freq]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedHabitFreq = btn.dataset.habitFreq;
      renderHabitFreqGrid();
      document.getElementById('habit-weekly-field').style.display = state.selectedHabitFreq === 'weekly' ? 'block' : 'none';
      document.getElementById('habit-days-field').style.display = state.selectedHabitFreq === 'days' ? 'block' : 'none';
    });
  });
}
function renderHabitDaysGrid() {
  const grid = document.getElementById('habit-days-grid');
  if (!grid) return;
  grid.innerHTML = WEEKDAY_LABELS.map((lbl, i) =>
    `<button type="button" class="tag-opt ${state.selectedHabitDays.includes(i) ? 'active' : ''}" data-habit-day="${i}">${lbl}</button>`
  ).join('');
  grid.querySelectorAll('[data-habit-day]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.habitDay);
      const idx = state.selectedHabitDays.indexOf(i);
      if (idx === -1) state.selectedHabitDays.push(i); else state.selectedHabitDays.splice(idx, 1);
      renderHabitDaysGrid();
    });
  });
}
function renderHabitTagGrid() {
  const grid = document.getElementById('habit-tag-grid');
  if (!grid) return;
  grid.innerHTML = getAllTagOptions().map(t =>
    `<button type="button" class="tag-opt ${state.selectedHabitTag === t.key ? 'active' : ''}" data-habit-tag="${esc(t.key)}"><i class="ph ${t.icon}"></i> ${esc(t.label)}</button>`
  ).join('');
  grid.querySelectorAll('[data-habit-tag]').forEach(btn => {
    btn.addEventListener('click', () => { state.selectedHabitTag = btn.dataset.habitTag; renderHabitTagGrid(); });
  });
}
function renderHabitProjectSelect() {
  const sel = document.getElementById('habit-project-select');
  if (!sel) return;
  sel.innerHTML = `<option value="">Tidak ada (standalone)</option>` +
    state.projects.map(p => `<option value="${p.id}">${esc(p.title)}</option>`).join('');
}

function openHabitModal(existing) {
  state.editingHabitId = existing ? existing.id : null;
  state.selectedHabitFreq = existing ? existing.frequency : 'daily';
  state.selectedHabitDays = existing ? [...(existing.daysOfWeek || [])] : [];
  state.selectedHabitTag = existing ? existing.tag : 'Productivity';

  document.getElementById('habit-modal-title').textContent = existing ? 'Edit Kebiasaan' : 'Kebiasaan Baru';
  document.getElementById('habit-title').value = existing ? existing.title : '';
  document.getElementById('habit-weekly-target').value = existing ? (existing.weeklyTarget || 3) : 3;
  document.getElementById('btn-delete-habit').style.display = existing ? 'inline-flex' : 'none';

  renderHabitFreqGrid();
  renderHabitDaysGrid();
  renderHabitTagGrid();
  renderHabitProjectSelect();
  document.getElementById('habit-weekly-field').style.display = state.selectedHabitFreq === 'weekly' ? 'block' : 'none';
  document.getElementById('habit-days-field').style.display = state.selectedHabitFreq === 'days' ? 'block' : 'none';
  document.getElementById('habit-project-select').value = existing?.projectId || '';
  openModal('habit-modal');
}

function saveHabitFromModal() {
  const title = document.getElementById('habit-title').value.trim();
  if (!title) { showToast('Nama kebiasaan wajib diisi', 'error'); return; }
  if (state.selectedHabitFreq === 'days' && !state.selectedHabitDays.length) {
    showToast('Pilih minimal satu hari', 'error'); return;
  }
  const projectId = document.getElementById('habit-project-select').value || null;
  const weeklyTarget = Number(document.getElementById('habit-weekly-target').value) || 3;

  if (state.editingHabitId) {
    const h = state.habits.find(x => x.id === state.editingHabitId);
    if (h) Object.assign(h, {
      title, tag: state.selectedHabitTag, frequency: state.selectedHabitFreq,
      weeklyTarget, daysOfWeek: [...state.selectedHabitDays], projectId,
    });
  } else {
    state.habits.push({
      id: genId('habit'), title, tag: state.selectedHabitTag, frequency: state.selectedHabitFreq,
      weeklyTarget, daysOfWeek: [...state.selectedHabitDays], projectId,
      completions: {}, createdAt: new Date().toISOString(),
    });
  }
  saveHabits();
  closeModal('habit-modal');
  renderHabits();
  showToast(state.editingHabitId ? 'Kebiasaan diperbarui' : 'Kebiasaan disimpan');
}

function deleteHabit(id) {
  confirmDialog('Hapus kebiasaan ini?', 'Seluruh riwayat streak kebiasaan ini akan dihapus.', () => {
    state.habits = state.habits.filter(h => h.id !== id);
    saveHabits();
    closeModal('habit-modal');
    renderHabits();
    showToast('Kebiasaan dihapus');
  });
}

function renderHabits() {
  const wrap = document.getElementById('habits-list');
  if (!wrap) return;
  if (!state.habits.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="ph ph-repeat"></i><p>Belum ada kebiasaan. Ketuk "Kebiasaan Baru" atau buat lewat Goal Super-Planner di tab Proyek.</p></div>`;
    return;
  }
  const t = todayStr();
  wrap.innerHTML = state.habits.map(h => {
    const tagInfo = getTagInfo(h.tag);
    const doneToday = !!h.completions[t];
    const linkedProject = h.projectId ? state.projects.find(p => p.id === h.projectId) : null;
    return `
    <div class="habit-card surface-el" data-habit="${h.id}">
      <div class="habit-check ${doneToday ? 'done' : ''}" data-habit-toggle="${h.id}"><i class="ph-bold ph-check"></i></div>
      <div class="habit-info" data-habit-edit="${h.id}">
        <div class="habit-title ${doneToday ? 'done' : ''}">${esc(h.title)}</div>
        <div class="habit-badges">
          <span class="tag-chip ${tagInfo.isProject ? 'project' : ''}"><i class="ph ${tagInfo.icon}"></i> ${esc(tagInfo.label)}</span>
          ${habitFreqBadge(h)}
          ${linkedProject ? `<span class="badge"><i class="ph ph-link"></i> ${esc(linkedProject.title)}</span>` : ''}
        </div>
      </div>
      <i class="ph ph-caret-right habit-chevron" data-habit-edit="${h.id}"></i>
    </div>`;
  }).join('');
}

/* ── CONTEXTUAL AI (identitas/lokasi/profesi → auto-suggest habits) ── */
function buildContextPrompt(text) {
  const tagList = Object.keys(BASE_TAGS).map(k => BASE_TAGS[k].label).join(', ');
  return `Analisa konteks personal berikut (identitas, lokasi, profesi, kepercayaan, gaya hidup, dll): "${text}"

Berdasarkan konteks ini, sarankan kebiasaan (habit) harian/mingguan yang RELEVAN, SPESIFIK, dan actionable untuk mendukung kehidupan orang tersebut. Jangan generic — sesuaikan betul dengan detail yang disebutkan (contoh: kalau disebut profesi tertentu, sarankan kebiasaan yang menunjang profesi itu; kalau disebut lokasi/musim, sesuaikan; kalau disebut kepercayaan/identitas dengan rutinitas yang melekat, sertakan juga).

Untuk setiap kebiasaan, tentukan:
1. Judul kebiasaan — singkat & actionable.
2. Kategori tag — PILIH SALAH SATU PERSIS dari: [${tagList}]
3. Frekuensi — gunakan PERSIS salah satu format:
   - "Daily" (tiap hari)
   - "Weekly:N" (N hari per minggu, contoh "Weekly:3")
   - "Days:D1,D2" (hari spesifik, angka 0=Minggu,1=Senin,2=Selasa,3=Rabu,4=Kamis,5=Jumat,6=Sabtu — contoh "Days:1,3,5" untuk Senin/Rabu/Jumat)

Sarankan 3-6 kebiasaan paling relevan (jangan lebih).

Kembalikan HANYA format JSON valid berikut, tanpa penjelasan tambahan:
{
  "context_summary": "ringkasan singkat konteks yang kamu pahami",
  "suggested_habits": [
    {"title": "...", "tag": "salah satu dari daftar kategori", "frequency": "Daily/Weekly:N/Days:D1,D2"}
  ]
}`;
}

function openContextModal() {
  document.getElementById('context-input').value = '';
  document.getElementById('context-paste-input').value = '';
  openModal('context-modal');
}

function generateContextPrompt() {
  const text = document.getElementById('context-input').value.trim();
  if (!text) { showToast('Ceritakan konteksmu dulu', 'error'); return; }
  copyToClipboard(buildContextPrompt(text));
  openGemini();
  showToast('Prompt disalin & Gemini dibuka — tempel hasilnya di bawah');
}

function processContextPaste() {
  const raw = document.getElementById('context-paste-input').value;
  if (!raw.trim()) { showToast('Tempel hasil AI dulu', 'error'); return; }
  let data;
  try { data = extractJSON(raw); } catch { showToast('Gagal memproses JSON', 'error'); return; }
  const list = Array.isArray(data?.suggested_habits) ? data.suggested_habits : [];
  if (!list.length) { showToast('Tidak ada kebiasaan terdeteksi di JSON', 'error'); return; }

  let count = 0;
  list.forEach(h => {
    if (!h || !h.title) return;
    const tag = resolveAnyTag(h.tag);
    const freq = parseHabitFrequency(h.frequency);
    state.habits.push({
      id: genId('habit'), title: String(h.title).trim(), tag, projectId: null,
      ...freq,
      completions: {}, createdAt: new Date().toISOString(),
    });
    count++;
  });
  if (!count) { showToast('Tidak ada kebiasaan valid di JSON', 'error'); return; }

  saveHabits();
  closeModal('context-modal');
  renderHabits();
  const summary = data.context_summary ? ` — ${data.context_summary}` : '';
  showToast(`${count} kebiasaan ditambahkan${summary}`.slice(0, 90));
}

/* ── CONSISTENCY & TIME DISTRIBUTION ENGINE (Jurnal) ── */
function calcConsistency(days) {
  const start = addDays(todayStr(), -(days - 1));
  let active = 0;
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    const hasLog = state.timelog.some(e => e.date === d);
    const hasHabit = state.habits.some(h => !!h.completions[d]);
    if (hasLog || hasHabit) active++;
  }
  return Math.round((active / days) * 100);
}

function renderConsistency() {
  const wrap = document.getElementById('consistency-row');
  if (!wrap) return;
  const ranges = [[7,'7 Hari'],[14,'14 Hari'],[30,'30 Hari']];
  wrap.innerHTML = ranges.map(([n, label]) => `
    <div class="consistency-stat">
      <div class="consistency-pct">${calcConsistency(n)}%</div>
      <div class="consistency-label">${label}</div>
    </div>`).join('');
}

function renderDistributionChart() {
  const canvas = document.getElementById('distribution-chart');
  if (!canvas) return;
  const start = addDays(todayStr(), -6);
  const totals = {};
  Object.keys(BASE_TAGS).forEach(k => totals[k] = 0);
  state.timelog.forEach(e => {
    if (e.date >= start && BASE_TAGS[e.tag] && e.durationMinutes) totals[e.tag] += e.durationMinutes;
  });
  const labels = Object.keys(BASE_TAGS).map(k => BASE_TAGS[k].label);
  const data = Object.keys(BASE_TAGS).map(k => totals[k]);
  const chartData = {
    labels,
    datasets: [{ data, backgroundColor: '#87A96B', borderRadius: 8, maxBarThickness: 28 }],
  };
  if (state.distChart) {
    state.distChart.data = chartData;
    state.distChart.update();
  } else {
    state.distChart = new Chart(canvas, {
      type: 'bar',
      data: chartData,
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmtDuration(c.raw) } } },
        scales: {
          y: { beginAtZero: true, ticks: { callback: v => fmtDuration(v), font: { size: 10 } } },
          x: { ticks: { font: { size: 9 } } },
        },
      },
    });
  }
}

/* ── TIME-LOG (Auto-Sync + Manual Entry + Dedup) ── */
function autoSyncTaskToTimelog(task) {
  const t = todayStr();
  const already = state.timelog.find(e => e.taskId === task.id && e.date === t);
  if (already) return; // dedup — prevents duplicate entries from repeated toggling
  state.timelog.push({
    id: genId('log'), date: t, title: task.title, tag: task.tag,
    durationMinutes: task.estimatedMinutes || 0, source: 'auto', taskId: task.id,
    createdAt: new Date().toISOString(),
  });
  saveTimelog();
  if (document.getElementById('page-journal')?.classList.contains('active')) renderTimelog();
}

function renderTimelogTagGrid() {
  const grid = document.getElementById('timelog-tag-grid');
  if (!grid) return;
  grid.innerHTML = getAllTagOptions().map(t =>
    `<button type="button" class="tag-opt ${state.selectedTimelogTag === t.key ? 'active' : ''}" data-timelog-tag="${esc(t.key)}"><i class="ph ${t.icon}"></i> ${esc(t.label)}</button>`
  ).join('');
  grid.querySelectorAll('[data-timelog-tag]').forEach(btn => {
    btn.addEventListener('click', () => { state.selectedTimelogTag = btn.dataset.timelogTag; renderTimelogTagGrid(); });
  });
}

function openTimelogModal() {
  document.getElementById('timelog-title').value = '';
  document.getElementById('timelog-duration').value = '';
  state.selectedTimelogTag = 'Productivity';
  renderTimelogTagGrid();
  openModal('timelog-modal');
}

function saveTimelogManual() {
  const title = document.getElementById('timelog-title').value.trim();
  const duration = Number(document.getElementById('timelog-duration').value) || 0;
  if (!title) { showToast('Nama aktivitas wajib diisi', 'error'); return; }
  state.timelog.push({
    id: genId('log'), date: todayStr(), title, tag: state.selectedTimelogTag,
    durationMinutes: duration, source: 'manual', taskId: null, createdAt: new Date().toISOString(),
  });
  saveTimelog();
  closeModal('timelog-modal');
  renderTimelog();
  showToast('Aktivitas dicatat');
}

function renderTimelog() {
  const wrap = document.getElementById('timelog-list');
  if (!wrap) return;
  const list = state.timelog.filter(e => e.date === todayStr()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (!list.length) { wrap.innerHTML = `<div class="empty-state"><i class="ph ph-clock-clockwise"></i><p>Belum ada jejak waktu hari ini.</p></div>`; return; }
  wrap.innerHTML = list.map(e => {
    const tagInfo = getTagInfo(e.tag);
    return `<div class="timelog-item surface-el-sm">
      <div class="timelog-icon"><i class="ph ${tagInfo.icon}"></i></div>
      <div class="timelog-info">
        <div class="timelog-title">${esc(e.title)}</div>
        <div class="timelog-meta"><span class="tag-chip ${tagInfo.isProject ? 'project' : ''}">${esc(tagInfo.label)}</span>${e.source === 'auto' ? `<span class="badge"><i class="ph ph-robot"></i> auto</span>` : e.source === 'habit' ? `<span class="badge"><i class="ph ph-repeat"></i> habit</span>` : ''}</div>
      </div>
      <div class="timelog-duration">${fmtDuration(e.durationMinutes)}</div>
    </div>`;
  }).join('');
}

/* ── STORY MAKER (AI Diary Generator) ──────── */
function renderPersonaRows() {
  const povRow = document.getElementById('pov-row');
  const toneRow = document.getElementById('tone-row');
  if (!povRow) return;
  povRow.innerHTML = POV_OPTIONS.map(p => `<button type="button" class="chip ${state.selectedPov === p ? 'active' : ''}" data-pov="${p}">${p}</button>`).join('');
  toneRow.innerHTML = TONE_OPTIONS.map(t => `<button type="button" class="chip ${state.selectedTone === t ? 'active' : ''}" data-tone="${t}">${t}</button>`).join('');
  povRow.querySelectorAll('[data-pov]').forEach(b => b.addEventListener('click', () => { state.selectedPov = b.dataset.pov; renderPersonaRows(); }));
  toneRow.querySelectorAll('[data-tone]').forEach(b => b.addEventListener('click', () => { state.selectedTone = b.dataset.tone; renderPersonaRows(); }));
}

function generateStoryPrompt() {
  const logs = state.timelog.filter(e => e.date === todayStr());
  if (!logs.length) { showToast('Belum ada aktivitas tercatat hari ini', 'error'); return; }
  const body = logs.map(e => `- ${e.title} (${e.durationMinutes || 0} menit) [${(BASE_TAGS[e.tag] || { label: e.tag }).label}]`).join('\n');
  const prompt = `Buatkan narasi jurnal harian berdasarkan data aktivitas berikut (tanggal ${fmtDateSub(todayStr())}):

${body}

Tulis dengan sudut pandang "${state.selectedPov}" dan gaya bahasa "${state.selectedTone}". Evaluasi secara singkat tingkat produktivitas hari ini, lalu tutup dengan satu kalimat kesimpulan mood hari ini. Tulis sebagai narasi mengalir (bukan daftar/bullet), sekitar 150-250 kata. Kembalikan HANYA teks narasinya saja, tanpa kalimat pembuka seperti "Berikut jurnalnya:".`;
  copyToClipboard(prompt);
  openGemini();
  showToast('Prompt disalin & Gemini dibuka — tempel narasinya di bawah');
}

function saveStoryEntry() {
  const text = document.getElementById('story-paste-input').value.trim();
  if (!text) { showToast('Tempel narasi dari AI dulu', 'error'); return; }
  state.journal.push({ id: genId('jrn'), date: todayStr(), text, pov: state.selectedPov, tone: state.selectedTone, createdAt: new Date().toISOString() });
  saveJournal();
  document.getElementById('story-paste-input').value = '';
  renderJournalList();
  showToast('Jurnal disimpan');
}

function renderJournalList() {
  const wrap = document.getElementById('journal-list');
  if (!wrap) return;
  const list = [...state.journal].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!list.length) { wrap.innerHTML = `<div class="empty-state"><i class="ph ph-book-open"></i><p>Belum ada jurnal tersimpan.</p></div>`; return; }
  wrap.innerHTML = list.map(j => `
    <div class="journal-entry surface-el-sm">
      <div class="journal-date">${esc(fmtDateSub(j.date))}</div>
      <div class="journal-text">${esc(j.text)}</div>
      <div class="journal-persona"><span class="badge">${esc(j.pov)}</span><span class="badge">${esc(j.tone)}</span></div>
    </div>`).join('');
}

/* ── AI SCHEDULE PARSER ────────────────────── */
// Format expected:
// === YYYY-MM-DD ===
// HH:MM-HH:MM Judul [Kategori]        (kategori opsional, default "Lainnya")
// - sub-tugas 1
// - sub-tugas 2
// Kategori "Olahraga: Lari" akan otomatis menghitung kalori terbakar.
function parseScheduleText(raw) {
  const lines = raw.split('\n');
  let currentDate = todayStr();
  let currentBlock = null;
  const results = [];

  const dayRe = /^===\s*(\d{4}-\d{2}-\d{2})\s*===$/;
  const blockRe = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s+(.+?)(?:\s*\[([^\]]+)\])?$/;
  const subRe = /^[-•]\s*(.+)$/;

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const dayMatch = line.match(dayRe);
    if (dayMatch) { currentDate = dayMatch[1]; currentBlock = null; continue; }

    const blockMatch = line.match(blockRe);
    if (blockMatch) {
      const [, ts, te, title, catRaw] = blockMatch;
      let category = 'Lainnya', exerciseType = null;
      if (catRaw) {
        if (catRaw.includes(':')) {
          const [catName, sub] = catRaw.split(':').map(s => s.trim());
          category = matchCategory(catName);
          if (category === 'Olahraga' && EXERCISE_TYPES[sub]) exerciseType = sub;
        } else {
          category = matchCategory(catRaw.trim());
        }
      }
      currentBlock = {
        id: genId('act'), date: currentDate,
        timeStart: normTime(ts), timeEnd: normTime(te),
        category, title: title.trim(),
        caloriesBurned: 0, caloriesConsumed: 0, subTasks: [],
      };
      if (exerciseType) {
        const mins = minutesBetween(currentBlock.timeStart, currentBlock.timeEnd);
        currentBlock.caloriesBurned = Math.round(mins * EXERCISE_TYPES[exerciseType].kcalPerMin);
      }
      results.push(currentBlock);
      continue;
    }

    const subMatch = line.match(subRe);
    if (subMatch && currentBlock) {
      currentBlock.subTasks.push({ id: genId('sub'), title: subMatch[1].trim(), isDone: false });
    }
  }
  return results;
}
function matchCategory(name) {
  const found = Object.keys(CATEGORIES).find(k => k.toLowerCase() === name.toLowerCase());
  return found || 'Lainnya';
}
function normTime(t) {
  const [h,m] = t.split(':');
  return `${h.padStart(2,'0')}:${m.padStart(2,'0')}`;
}

function runParser() {
  const raw = document.getElementById('ai-parser-input').value;
  const logEl = document.getElementById('parser-log');
  if (!raw.trim()) { showToast('Tempel teks jadwal dulu', 'error'); return; }

  let parsed;
  try { parsed = parseScheduleText(raw); }
  catch (e) { showToast('Gagal memproses teks', 'error'); return; }

  if (!parsed.length) {
    logEl.style.display = 'block';
    logEl.textContent = 'Tidak ada blok jadwal yang terdeteksi. Periksa kembali format (lihat contoh).';
    showToast('Tidak ada jadwal terdeteksi', 'error');
    return;
  }

  state.activities.push(...parsed);
  save();

  const dates = [...new Set(parsed.map(a => a.date))].sort();
  logEl.style.display = 'block';
  logEl.textContent = `✓ ${parsed.length} kegiatan berhasil diekstrak ke ${dates.length} hari (${dates.join(', ')}).`;
  document.getElementById('ai-parser-input').value = '';
  showToast('Jadwal berhasil diekstrak');

  state.viewDate = dates[0];
  renderDateNav();
  renderTimeline();
  goToPage('home');
}

function showFormatExample() {
  const example = `=== ${todayStr()} ===
08:00-10:00 Sesi Fokus Coding [Belajar/Kerja]
- Review PR
- Deploy staging

12:00-12:30 Makan Siang [Makan/Camilan]

19:00-19:45 Lari Sore [Olahraga: Lari]
- Rute taman kota`;
  const ta = document.getElementById('ai-parser-input');
  ta.value = example;
  showToast('Contoh format ditempel ke kotak teks');
}

/* ── EXPORT / IMPORT / RESET ───────────────── */
function exportData() {
  const payload = {
    _app: 'SevnLifeOS',
    _version: '2',
    _exportedAt: new Date().toISOString(),
    activities: state.activities,
    tasks: state.tasks,
    projects: state.projects,
    habits: state.habits,
    timelog: state.timelog,
    journal: state.journal,
    settings: state.settings,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  a.href = url;
  a.download = `sevnlife-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Data berhasil diekspor');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.activities)) throw new Error('invalid');
      const extra = [data.tasks, data.projects, data.habits, data.timelog, data.journal].filter(Array.isArray).flat().length;
      confirmDialog('Timpa data saat ini?', `File ini berisi ${data.activities.length} kegiatan${extra ? ` + ${extra} data proyek/tugas/kebiasaan/jurnal lainnya` : ''}. Data yang ada saat ini akan diganti.`, () => {
        state.activities = data.activities;
        if (Array.isArray(data.tasks)) state.tasks = data.tasks;
        if (Array.isArray(data.projects)) state.projects = data.projects;
        if (Array.isArray(data.habits)) state.habits = data.habits;
        if (Array.isArray(data.timelog)) state.timelog = data.timelog;
        if (Array.isArray(data.journal)) state.journal = data.journal;
        if (data.settings && typeof data.settings === 'object') state.settings = { ...state.settings, ...data.settings };
        save(); saveTasks(); saveProjects(); saveHabits(); saveTimelog(); saveJournal(); saveSettings();
        applyTheme();
        renderTimeline(); renderQuickTasks(); renderProjects(); renderHabits(); renderReminderUI();
        showToast('Data berhasil dipulihkan');
      });
    } catch {
      showToast('File tidak valid', 'error');
    }
  };
  reader.readAsText(file);
}

function resetAllData() {
  confirmDialog('Hapus semua data?', 'Seluruh kegiatan, tugas, proyek, kebiasaan, time-log, dan jurnal akan dihapus permanen dari perangkat ini.', () => {
    state.activities = []; state.tasks = []; state.projects = []; state.habits = []; state.timelog = []; state.journal = [];
    state.openProjectId = null; state.openBlockId = null;
    save(); saveTasks(); saveProjects(); saveHabits(); saveTimelog(); saveJournal();
    renderTimeline(); renderQuickTasks(); renderProjects(); renderHabits();
    if (document.getElementById('page-journal')?.classList.contains('active')) { renderTimelog(); renderConsistency(); renderDistributionChart(); renderJournalList(); }
    showToast('Semua data telah dihapus');
  });
}

/* ── EVENT WIRING ──────────────────────────── */
function setupEvents() {
  document.getElementById('btn-prev-day').addEventListener('click', () => { state.viewDate = addDays(state.viewDate, -1); state.openBlockId = null; renderDateNav(); renderTimeline(); });
  document.getElementById('btn-next-day').addEventListener('click', () => { state.viewDate = addDays(state.viewDate, 1); state.openBlockId = null; renderDateNav(); renderTimeline(); });
  document.getElementById('btn-today').addEventListener('click', () => { state.viewDate = todayStr(); state.openBlockId = null; renderDateNav(); renderTimeline(); });

  document.getElementById('btn-tomorrow').addEventListener('click', () => {
    state.viewDate = addDays(state.viewDate, 1);
    state.openBlockId = null;
    renderDateNav();
    renderTimeline();
    openActivityModal(null);
    showToast(`Menambah rencana untuk ${fmtDateSub(state.viewDate)}`);
  });

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => goToPage(item.dataset.page));
  });
  document.getElementById('btn-settings-shortcut').addEventListener('click', () => goToPage('settings'));

  document.getElementById('fab').addEventListener('click', () => openActivityModal(null));
  document.getElementById('btn-cancel-activity').addEventListener('click', () => closeModal('activity-modal'));
  document.getElementById('btn-save-activity').addEventListener('click', saveActivityFromModal);
  document.getElementById('btn-delete-activity').addEventListener('click', () => {
    const id = state.editingId;
    confirmDialog('Hapus kegiatan ini?', 'Kegiatan dan seluruh sub-tugasnya akan dihapus.', () => {
      closeModal('activity-modal');
      deleteActivity(id);
    });
  });
  document.getElementById('activity-modal').addEventListener('click', e => { if (e.target.id === 'activity-modal') closeModal('activity-modal'); });

  document.getElementById('activity-start').addEventListener('input', () => {
    if (!state.endTouched) document.getElementById('activity-end').value = document.getElementById('activity-start').value;
    autoCalc();
  });
  document.getElementById('activity-end').addEventListener('input', () => {
    state.endTouched = true;
    autoCalc();
  });
  document.getElementById('exercise-type').addEventListener('change', autoCalc);
  document.getElementById('meal-preset').addEventListener('change', autoCalc);

  document.getElementById('btn-add-subtask').addEventListener('click', () => {
    state.tempSubtasks.push({ id: genId('sub'), title: '', isDone: false });
    renderSubtaskInputs();
  });

  document.getElementById('timeline').addEventListener('click', e => {
    const toggle = e.target.closest('[data-toggle]');
    const subToggle = e.target.closest('[data-sub-toggle]');
    const editBtn = e.target.closest('[data-edit]');
    const delBtn = e.target.closest('[data-del]');

    if (subToggle) {
      const [actId, subId] = subToggle.dataset.subToggle.split('|');
      toggleSubtask(actId, subId);
      return;
    }
    if (editBtn) {
      const act = state.activities.find(a => a.id === editBtn.dataset.edit);
      if (act) openActivityModal(act);
      return;
    }
    if (delBtn) {
      const id = delBtn.dataset.del;
      confirmDialog('Hapus kegiatan ini?', 'Kegiatan dan seluruh sub-tugasnya akan dihapus.', () => deleteActivity(id));
      return;
    }
    if (toggle) {
      const id = toggle.dataset.toggle;
      state.openBlockId = state.openBlockId === id ? null : id;
      renderTimeline();
    }
  });

  document.getElementById('btn-parse').addEventListener('click', runParser);
  document.getElementById('btn-copy-format').addEventListener('click', showFormatExample);

  document.getElementById('btn-export').addEventListener('click', exportData);
  document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-file-input').click());
  document.getElementById('import-file-input').addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) importData(file);
    e.target.value = '';
  });
  document.getElementById('btn-reset').addEventListener('click', resetAllData);

  document.getElementById('confirm-cancel').addEventListener('click', () => closeModal('confirm-modal'));
  document.getElementById('confirm-ok').addEventListener('click', () => {
    closeModal('confirm-modal');
    if (state.confirmAction) state.confirmAction();
    state.confirmAction = null;
  });
  document.getElementById('confirm-modal').addEventListener('click', e => { if (e.target.id === 'confirm-modal') closeModal('confirm-modal'); });

  /* ── Dark mode & reminders ── */
  document.getElementById('toggle-dark-mode').addEventListener('click', toggleDarkMode);
  document.getElementById('toggle-reminder').addEventListener('click', toggleReminder);
  document.getElementById('reminder-time').addEventListener('change', e => { state.settings.reminderTime = e.target.value; saveSettings(); });
  document.getElementById('setting-username').addEventListener('input', e => {
    state.settings.userName = e.target.value;
    saveSettings();
    renderGreeting();
  });

  /* ── Quick Daily Entry ── */
  document.getElementById('btn-quick-entry-send').addEventListener('click', sendQuickEntry);
  document.getElementById('quick-entry-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendQuickEntry(); });
  document.getElementById('btn-cancel-quick-entry').addEventListener('click', () => closeModal('quick-entry-modal'));
  document.getElementById('btn-process-quick-entry').addEventListener('click', processQuickEntryPaste);
  document.getElementById('quick-entry-modal').addEventListener('click', e => { if (e.target.id === 'quick-entry-modal') closeModal('quick-entry-modal'); });
  document.getElementById('quick-tasks-wrap').addEventListener('click', e => {
    const el = e.target.closest('[data-qtask-toggle]');
    if (el) toggleQuickTask(el.dataset.qtaskToggle);
  });
  document.getElementById('scheduled-tasks-wrap').addEventListener('click', e => {
    const reschedule = e.target.closest('[data-reschedule]');
    if (reschedule) { rescheduleTaskToToday(reschedule.dataset.reschedule); return; }
    const el = e.target.closest('[data-ptask-toggle]');
    if (el) { togglePTask(el.dataset.ptaskToggle); renderQuickTasks(); }
  });
  document.getElementById('quick-tasks-filter').addEventListener('click', e => {
    const el = e.target.closest('[data-tag-filter]');
    if (!el) return;
    state.activeTagFilter = el.dataset.tagFilter || null;
    renderQuickTasks();
  });

  /* ── Projects ── */
  document.getElementById('btn-new-project').addEventListener('click', openProjectModal);
  document.getElementById('btn-cancel-project').addEventListener('click', () => closeModal('project-modal'));
  document.getElementById('btn-generate-project').addEventListener('click', generateProjectPrompt);
  document.getElementById('btn-process-project').addEventListener('click', processProjectPaste);
  document.getElementById('project-modal').addEventListener('click', e => { if (e.target.id === 'project-modal') closeModal('project-modal'); });
  document.getElementById('projects-list').addEventListener('click', e => {
    const toggle = e.target.closest('[data-project-toggle]');
    const ptaskToggle = e.target.closest('[data-ptask-toggle]');
    const phabitToggle = e.target.closest('[data-phabit-toggle]');
    const reschedule = e.target.closest('[data-reschedule]');
    const del = e.target.closest('[data-project-del]');
    if (reschedule) { rescheduleTaskToToday(reschedule.dataset.reschedule); return; }
    if (ptaskToggle) { togglePTask(ptaskToggle.dataset.ptaskToggle); return; }
    if (phabitToggle) { toggleHabitDone(phabitToggle.dataset.phabitToggle); renderProjects(); return; }
    if (del) { deleteProject(del.dataset.projectDel); return; }
    if (toggle) {
      const id = toggle.dataset.projectToggle;
      state.openProjectId = state.openProjectId === id ? null : id;
      renderProjects();
    }
  });

  /* ── Habits ── */
  document.getElementById('btn-new-habit').addEventListener('click', () => openHabitModal(null));
  document.getElementById('btn-cancel-habit').addEventListener('click', () => closeModal('habit-modal'));
  document.getElementById('btn-save-habit').addEventListener('click', saveHabitFromModal);
  document.getElementById('btn-delete-habit').addEventListener('click', () => deleteHabit(state.editingHabitId));
  document.getElementById('habit-modal').addEventListener('click', e => { if (e.target.id === 'habit-modal') closeModal('habit-modal'); });
  document.getElementById('habits-list').addEventListener('click', e => {
    const check = e.target.closest('[data-habit-toggle]');
    const edit = e.target.closest('[data-habit-edit]');
    if (check) { toggleHabitDone(check.dataset.habitToggle); renderHabits(); return; }
    if (edit) { const h = state.habits.find(x => x.id === edit.dataset.habitEdit); if (h) openHabitModal(h); }
  });

  /* ── Contextual AI ── */
  document.getElementById('btn-context-ai').addEventListener('click', openContextModal);
  document.getElementById('btn-cancel-context').addEventListener('click', () => closeModal('context-modal'));
  document.getElementById('btn-generate-context').addEventListener('click', generateContextPrompt);
  document.getElementById('btn-process-context').addEventListener('click', processContextPaste);
  document.getElementById('context-modal').addEventListener('click', e => { if (e.target.id === 'context-modal') closeModal('context-modal'); });

  /* ── Time-Log & Story Maker ── */
  document.getElementById('btn-add-timelog').addEventListener('click', openTimelogModal);
  document.getElementById('btn-cancel-timelog').addEventListener('click', () => closeModal('timelog-modal'));
  document.getElementById('btn-save-timelog').addEventListener('click', saveTimelogManual);
  document.getElementById('timelog-modal').addEventListener('click', e => { if (e.target.id === 'timelog-modal') closeModal('timelog-modal'); });
  document.getElementById('btn-generate-story').addEventListener('click', generateStoryPrompt);
  document.getElementById('btn-save-story').addEventListener('click', saveStoryEntry);
}

/* ── PWA ────────────────────────────────────── */
function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    });
  }
}

/* ── INIT ───────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  setupEvents();
  renderGreeting();
  renderDateNav();
  renderTimeline();
  renderReminderUI();
  registerSW();
  setInterval(checkReminderTick, 60000);
});
