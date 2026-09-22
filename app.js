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

/* ── SUPABASE CLOUD CONFIG ─────────────────── */
const SUPABASE_URL = 'https://ioyynmbdvffltuwkoefi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlveXlubWJkdmZmbHR1d2tvZWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNDg2NDAsImV4cCI6MjEwNTYyNDY0MH0.5NQAngNXthqXLNRu3I4ptJrKc3zUYfiFfcyf1V7Z2EE';

let sb = null;
function initSupabase() {
  if (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
    try {
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
      console.warn('Supabase client init error:', e);
    }
  }
}

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

  cloudUser: null,
  cloudProfile: null,
  isSyncing: false,
  authTab: 'login',

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

function save()         { LS.set(LS_KEY, state.activities); }
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
  const now = new Date();
  const hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  if (dateEl) {
    dateEl.innerHTML = fmtDateSub(todayStr()) + " &nbsp;�&nbsp; <i class='ph ph-clock'></i> " + hm;
  }
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
  if (typeof renderHomeHabits === 'function') renderHomeHabits();
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



function renderQuickTasks() {

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
        <div class="ptask-info" data-qtask-toggle="${t.id}">
          <div class="ptask-title ${t.isDone ? 'done' : ''}">${esc(t.title)}</div>
          ${t.dailyTarget ? `<div class="ptask-target"><i class="ph-bold ph-target"></i> ${esc(t.dailyTarget)}</div>` : ''}
        </div>
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

  if (state.cloudUser && sb && task.cloud_id) {
    sb.from('tasks').update({
      status: task.isDone ? 'done' : 'todo',
      completed_at: task.isDone ? new Date().toISOString() : null
    }).eq('id', task.cloud_id).then();
  }
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

function isActivityActiveNow(a) {
  if (state.viewDate !== todayStr()) return false;
  if (!a.timeStart || !a.timeEnd) return false;
  const now = new Date();
  const hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  if (a.timeStart <= a.timeEnd) {
    return hm >= a.timeStart && hm <= a.timeEnd;
  } else {
    return hm >= a.timeStart || hm <= a.timeEnd;
  }
}

function renderTimeline() {
  const list = getDayActivities(state.viewDate);
  const wrap = document.getElementById('timeline');
  let html = '';

  const v = state.viewDate;
  const isToday = v === todayStr();
  const projTasks = state.tasks.filter(t => {
    if (!t.projectId || !t.scheduleStart) return false;
    if (t.scheduleStart <= v && v <= t.scheduleEnd) return true;
    return isToday && isTaskOverdue(t);
  });

  if (projTasks.length) {
    html += projTasks.map(t => {
      const proj = state.projects.find(p => p.id === t.projectId);
      return `<div class="ptask surface-el-sm" style="margin-bottom:12px; margin-left:-4px; border:1px solid var(--accent-soft);">
        <div class="subtask-check ${t.isDone ? 'done' : ''}" data-ptask-toggle="${t.id}"><i class="ph-bold ph-check"></i></div>
        <div class="ptask-info" data-ptask-toggle="${t.id}">
          <div class="ptask-title ${t.isDone ? 'done' : ''}">${esc(t.title)}</div>
          ${t.dailyTarget ? `<div class="ptask-target"><i class="ph-bold ph-target"></i> ${esc(t.dailyTarget)}</div>` : ''}
        </div>
        <div class="ptask-badges">
          ${proj ? `<span class="tag-chip project"><i class="ph ph-rocket-launch"></i> ${esc(proj.title)}</span>` : ''}
          ${taskScheduleBadge(t)}
          ${t.durationLabel ? `<span class="badge">${esc(t.durationLabel)}</span>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  if (list.length) {
    html += list.map(a => {
      const cat = CATEGORIES[a.category] || CATEGORIES['Lainnya'];
      const total = a.subTasks?.length || 0;
      const done = a.subTasks?.filter(s => s.isDone).length || 0;
      const allDone = total > 0 && done === total;
      const isOpen = state.openBlockId === a.id;
      const metaBits = [];
      if (a.caloriesBurned) metaBits.push(`<i class="ph ph-fire"></i> ${a.caloriesBurned} kcal`);
      if (a.caloriesConsumed) metaBits.push(`<i class="ph ph-bowl-food"></i> ${a.caloriesConsumed} kcal`);
      if (total) metaBits.push(`<i class="ph ph-list-checks"></i> ${done}/${total}`);
      const isActiveNow = typeof isActivityActiveNow === 'function' ? isActivityActiveNow(a) : false;

      return `
    <div class="tblock surface-el ${isOpen ? 'open' : ''} ${isActiveNow ? 'active-now' : ''}" data-id="${a.id}">
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
  }

  if (!html) {
    wrap.innerHTML = `<div class="empty-state"><i class="ph ph-coffee"></i><p>Belum ada jadwal. Ketuk tombol + untuk menambahkan.</p></div>`;
  } else {
    wrap.innerHTML = html;
  }

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

/* ── CHOICE MODAL (Manual vs Prompt AI) ────── */
let currentChoiceConfig = null;

function openChoiceModal(config) {
  currentChoiceConfig = config;
  const titleEl = document.getElementById('choice-modal-title');
  if (titleEl) titleEl.innerHTML = `<i class="ph ${config.titleIcon || 'ph-plus-circle'}"></i> ${config.title}`;
  const subEl = document.getElementById('choice-modal-sub');
  if (subEl) subEl.textContent = config.subtitle || 'Pilih metode yang ingin digunakan:';
  const mTitle = document.getElementById('choice-manual-title');
  if (mTitle) mTitle.textContent = config.manualTitle || 'Versi Manual';
  const mDesc = document.getElementById('choice-manual-desc');
  if (mDesc) mDesc.textContent = config.manualDesc || 'Isi formulir secara mandiri langkah demi langkah.';
  const aTitle = document.getElementById('choice-ai-title');
  if (aTitle) aTitle.textContent = config.aiTitle || 'Versi Prompt AI';
  const aDesc = document.getElementById('choice-ai-desc');
  if (aDesc) aDesc.textContent = config.aiDesc || 'Ketik ide singkat, AI Gemini menyusun format lengkapnya.';
  openModal('choice-modal');
}

/* ── AI ACTIVITY / SCHEDULE GENERATOR ──────── */
function buildAiActivityPrompt(text, dateStr) {
  const catList = Object.keys(CATEGORIES).join(', ');
  return `Kamu adalah asisten penjadwalan harian. Susun rencana kegiatan berikut untuk tanggal ${dateStr} menjadi daftar kegiatan linimasa yang rapi:
"${text}"

DAFTAR KATEGORI VALID (PILIH SALAH SATU PERSIS): [${catList}]

Kembalikan HANYA format JSON valid berikut (array of objects), tanpa penjelasan tambahan:
[
  {
    "title": "judul kegiatan singkat",
    "category": "salah satu kategori di atas",
    "timeStart": "HH:MM (format 24 jam)",
    "timeEnd": "HH:MM (format 24 jam)",
    "burnedCalories": 0,
    "consumedCalories": 0,
    "subTasks": ["sub-tugas 1", "sub-tugas 2"]
  }
]`;
}

function openAiActivityModal() {
  document.getElementById('ai-activity-input').value = '';
  document.getElementById('ai-activity-paste-input').value = '';
  openModal('ai-activity-modal');
}

function generateAiActivityPrompt() {
  const text = document.getElementById('ai-activity-input').value.trim();
  if (!text) { showToast('Ketik rencana kegiatan dulu', 'error'); return; }
  copyToClipboard(buildAiActivityPrompt(text, state.viewDate));
  openGemini();
  showToast('Prompt disalin & Gemini dibuka — tempel hasilnya di bawah');
}

function processAiActivityPaste() {
  const raw = document.getElementById('ai-activity-paste-input').value;
  if (!raw.trim()) { showToast('Tempel hasil AI dulu', 'error'); return; }
  
  let items = [];
  try {
    const parsed = extractJSON(raw);
    items = Array.isArray(parsed) ? parsed : (parsed.activities || [parsed]);
  } catch (e) {
    const lines = raw.split('\n');
    let curDate = state.viewDate;
    let count = 0;
    lines.forEach(l => {
      const dateMatch = l.match(/===\s*(\d{4}-\d{2}-\d{2})\s*===/);
      if (dateMatch) { curDate = dateMatch[1]; return; }
      const actMatch = l.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s+(.*?)(?:\s*\[(.*?)\])?$/);
      if (actMatch) {
        const cat = CATEGORIES[actMatch[4]] ? actMatch[4] : 'Lainnya';
        state.activities.push({
          id: genId('act'),
          date: curDate,
          timeStart: actMatch[1].padStart(5, '0'),
          timeEnd: actMatch[2].padStart(5, '0'),
          category: cat,
          title: actMatch[3].trim(),
          caloriesBurned: 0,
          caloriesConsumed: 0,
          subTasks: []
        });
        count++;
      }
    });
    if (count > 0) {
      save();
      closeModal('ai-activity-modal');
      renderTimeline();
      showToast(`${count} kegiatan ditambahkan ke linimasa`);
      return;
    }
    showToast('Gagal memproses format JSON / Jadwal', 'error');
    return;
  }

  let count = 0;
  items.forEach(it => {
    if (!it || !it.title) return;
    const cat = CATEGORIES[it.category] ? it.category : (it.category ? resolveAnyTag(it.category) : 'Lainnya');
    const cleanCat = CATEGORIES[cat] ? cat : 'Lainnya';
    const subTasks = Array.isArray(it.subTasks) 
      ? it.subTasks.map(s => typeof s === 'string' ? { id: genId('sub'), title: s.trim(), isDone: false } : { id: genId('sub'), title: (s.title||'').trim(), isDone: !!s.isDone }).filter(s => s.title)
      : [];

    state.activities.push({
      id: genId('act'),
      date: it.date || state.viewDate,
      timeStart: (it.timeStart || '08:00').padStart(5, '0'),
      timeEnd: (it.timeEnd || '09:00').padStart(5, '0'),
      category: cleanCat,
      title: String(it.title).trim(),
      caloriesBurned: Number(it.burnedCalories) || Number(it.caloriesBurned) || 0,
      caloriesConsumed: Number(it.consumedCalories) || Number(it.caloriesConsumed) || 0,
      subTasks,
    });
    count++;
  });

  if (!count) { showToast('Tidak ada kegiatan terdeteksi', 'error'); return; }
  save();
  closeModal('ai-activity-modal');
  renderTimeline();
  showToast(`${count} kegiatan ditambahkan ke linimasa`);
}

/* ── MANUAL PROJECT CREATION ───────────────── */
function openManualProjectModal() {
  document.getElementById('manual-project-title').value = '';
  document.getElementById('manual-project-tag').value = '';
  document.getElementById('manual-project-days').value = '14';
  document.getElementById('manual-project-tasks').value = '';
  document.getElementById('manual-project-habits').value = '';
  openModal('manual-project-modal');
}

function saveManualProject() {
  const title = document.getElementById('manual-project-title').value.trim();
  if (!title) { showToast('Judul proyek wajib diisi', 'error'); return; }

  let tag = document.getElementById('manual-project-tag').value.trim();
  if (!tag) tag = '#' + title.replace(/\s+/g, '');
  if (!tag.startsWith('#')) tag = '#' + tag;

  const days = Math.max(1, parseInt(document.getElementById('manual-project-days').value, 10) || 14);
  const projectId = genId('proj');
  const startDate = todayStr();
  const targetCompletionDate = addDays(startDate, days - 1);

  state.projects.push({
    id: projectId,
    title,
    tag,
    startDate,
    targetCompletionDate,
    createdAt: new Date().toISOString()
  });

  const taskLines = document.getElementById('manual-project-tasks').value.split('\n').map(l => l.replace(/^[-*•\d.]+\s*/, '').trim()).filter(Boolean);
  const habitLines = document.getElementById('manual-project-habits').value.split('\n').map(l => l.replace(/^[-*•\d.]+\s*/, '').trim()).filter(Boolean);

  let count = 0;
  const numTasks = taskLines.length;
  taskLines.forEach((tTitle, idx) => {
    const dayStart = Math.min(days, Math.floor((idx / Math.max(1, numTasks)) * days) + 1);
    const dayEnd = Math.min(days, Math.floor(((idx + 1) / Math.max(1, numTasks)) * days) + 1);
    const sDate = addDays(startDate, dayStart - 1);
    const eDate = addDays(startDate, dayEnd - 1);

    state.tasks.push({
      id: genId('task'),
      date: eDate,
      title: tTitle,
      tag,
      projectId,
      phaseLabel: 'Tugas Proyek',
      durationLabel: null,
      scheduleStart: sDate,
      scheduleEnd: eDate,
      isHabit: false,
      isDone: false,
      estimatedMinutes: null,
      timeHint: null,
      createdAt: new Date().toISOString()
    });
    count++;
  });

  habitLines.forEach(hTitle => {
    state.habits.push({
      id: genId('habit'),
      title: hTitle,
      tag,
      projectId,
      frequency: 'daily',
      weeklyTarget: null,
      days: [],
      completions: {},
      createdAt: new Date().toISOString()
    });
    count++;
  });

  saveProjects();
  saveTasks();
  saveHabits();
  closeModal('manual-project-modal');
  state.openProjectId = projectId;
  renderProjects();
  showToast('Proyek berhasil dibuat');
}

/* ── PROJECTS (Goal Super-Planner + Accordion UI) ── */
function buildProjectPrompt(data) {
  let additionalRules = '';
  const tagsStr = data.tags.join(', ');
  
  if (tagsStr.includes('Language')) {
    additionalRules += `\n- Aturan Khusus Language: Wajib memecah tugas menjadi metrik penguasaan kosakata, tata bahasa, dan latihan membaca/mendengar.`;
  }
  if (tagsStr.includes('Coding') || tagsStr.includes('Tech')) {
    additionalRules += `\n- Aturan Khusus Tech/Coding: Wajib menyertakan fase setup environment, milestone prototyping, dan fase testing/debugging.`;
  }

  return `Kamu adalah asisten perencana proyek. Pecah inisiatif berikut menjadi struktur proyek yang matang dan terukur.

DATA PROYEK:
- Judul: ${data.title}
- Tujuan/Konteks: ${data.description}
- Batas Waktu: ${data.durationDays} hari
- Kategori/Tags: ${tagsStr}
- Kapasitas Harian: ${data.dailyHours} jam/hari

ATURAN PENJADWALAN & OUTPUT (WAJIB DIIKUTI 100%):
1. Kembalikan HANYA format JSON valid sesuai skema di bawah, TANPA blok markdown, TANPA penjelasan teks apa pun.
2. Buat 2-4 fase ("phases") berurutan, masing-masing berisi 2-5 tugas ("tasks").
3. "day_range" tiap tugas adalah rentang hari eksekusi (format "Mulai-Selesai", hari ke-1 = mulai proyek). Harus logis, berurutan, dan muat dalam batas ${data.durationDays} hari.
4. "daily_target": Jika tugas memakan waktu lebih dari 1 hari, WAJIB lakukan kalkulasi matematis membagi total materi dengan durasi hari pada day_range, dan tetapkan beban kerja harian. Jangan beri deskripsi umum! WAJIB kembalikan format pasti seperti '15 Kanji & 40 Kotoba' atau '2 wacana Dokkai'. Jika hanya 1 hari, isi null.
5. "habits": Buat 1-4 kebiasaan pendukung. "frequency" HARUS "Daily" ATAU "Weekly:N" (N=angka).${additionalRules}

SKEMA JSON WAJIB:
{
  "project_title": "string",
  "project_tag": "string (PascalCase, satu tag utama)",
  "duration_days": number,
  "phases": [
    {
      "phase_label": "string",
      "tasks": [
        {
          "title": "string",
          "daily_target": "string atau null",
          "duration_label": "string (contoh: '2 jam/hari')",
          "day_range": "string (contoh: '1-7')"
        }
      ]
    }
  ],
  "habits": [
    {
      "title": "string",
      "frequency": "string"
    }
  ]
}`;
}

function openProjectModal() {
  document.getElementById('project-title-input').value = '';
  document.getElementById('project-details-input').value = '';
  document.getElementById('project-duration-input').value = '';
  document.getElementById('project-hours-input').value = '';
  
  const select = document.getElementById('project-tags-input');
  if (select) {
    Array.from(select.options).forEach(opt => opt.selected = false);
  }

  document.getElementById('project-paste-input').value = '';
  openModal('project-modal');
}

function generateProjectPrompt() {
  const title = document.getElementById('project-title-input').value.trim();
  const description = document.getElementById('project-details-input').value.trim();
  const durationDays = document.getElementById('project-duration-input').value.trim();
  const dailyHours = document.getElementById('project-hours-input').value.trim();
  
  const select = document.getElementById('project-tags-input');
  let tags = [];
  if (select) {
    tags = Array.from(select.selectedOptions).map(opt => opt.value);
  }

  if (!title || !durationDays) { 
    showToast('Judul dan batas waktu wajib diisi', 'error'); 
    return; 
  }

  const promptData = {
    title,
    description: description || '-',
    durationDays: parseInt(durationDays, 10) || 14,
    dailyHours: parseFloat(dailyHours) || 2,
    tags: tags.length ? tags : ['Other']
  };

  copyToClipboard(buildProjectPrompt(promptData));
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
        phaseLabel: phase.phase_label || 'Tugas', durationLabel: t.duration_label || null, dailyTarget: t.daily_target || null,
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
        <div class="ptask-info" data-ptask-toggle="${t.id}">
          <div class="ptask-title ${t.isDone ? 'done' : ''}">${esc(t.title)}</div>
          ${t.dailyTarget ? `<div class="ptask-target"><i class="ph-bold ph-target"></i> ${esc(t.dailyTarget)}</div>` : ''}
        </div>
        <div class="ptask-badges">${taskScheduleBadge(t)}${t.durationLabel ? `<span class="badge">${esc(t.durationLabel)}</span>` : ''}</div>
      </div>`;

    const renderHabit = h => {
      const doneToday = !!h.completions[todayStr()];
      return `
      <div class="ptask surface-in-sm">
        <div class="subtask-check ${doneToday ? 'done' : ''}" data-phabit-toggle="${h.id}"><i class="ph-bold ph-check"></i></div>
        <div class="ptask-info" data-phabit-toggle="${h.id}">
          <div class="ptask-title ${doneToday ? 'done' : ''}">${esc(h.title)}</div>
        </div>
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
  const wasDone = !!h.completions[dateStr];
  if (wasDone) delete h.completions[dateStr];
  else {
    h.completions[dateStr] = true;
    if (dateStr === todayStr()) autoSyncHabitToTimelog(h);
  }
  saveHabits();

  if (state.cloudUser && sb && h.cloud_id) {
    if (!wasDone) {
      sb.from('habit_logs').upsert({
        habit_id: h.cloud_id,
        user_id: state.cloudUser.id,
        logged_date: dateStr
      }, { onConflict: 'habit_id,logged_date' }).then();
    } else {
      sb.from('habit_logs').delete()
        .eq('habit_id', h.cloud_id)
        .eq('user_id', state.cloudUser.id)
        .eq('logged_date', dateStr).then();
    }
  }
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
  if (typeof renderHomeHabits === 'function') renderHomeHabits();
  showToast(state.editingHabitId ? 'Kebiasaan diperbarui' : 'Kebiasaan disimpan');
}

function deleteHabit(id) {
  confirmDialog('Hapus kebiasaan ini?', 'Seluruh riwayat streak kebiasaan ini akan dihapus.', () => {
    state.habits = state.habits.filter(h => h.id !== id);
    saveHabits();
    closeModal('habit-modal');
    renderHabits();
    if (typeof renderHomeHabits === 'function') renderHomeHabits();
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

function renderHomeHabits() {
  const wrap = document.getElementById('home-habits-list');
  if (!wrap) return;
  const [y, m, d] = state.viewDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const wday = dt.getDay(); // 0-6 (Sun-Sat)
  
  const activeHabits = state.habits.filter(h => {
    if (h.frequency === 'days') return (h.daysOfWeek || []).includes(wday);
    return true;
  });

  if (!activeHabits.length) {
    wrap.innerHTML = `<div class="empty-state" style="padding: 10px;"><p style="color: var(--text3); margin: 0;">Belum ada kebiasaan terjadwal untuk hari ini.</p></div>`;
    return;
  }
  
  wrap.innerHTML = activeHabits.map(h => {
    const tagInfo = getTagInfo(h.tag);
    const doneToday = !!h.completions[state.viewDate];
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
  if (typeof renderHomeHabits === 'function') renderHomeHabits();
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
  renderConsistency();
  renderDistributionChart();
  showToast('Aktivitas dicatat');
}

/* ── AI TIMELOG GENERATOR ──────────────────── */
function buildAiTimelogPrompt(text) {
  const tagList = Object.keys(BASE_TAGS).map(k => BASE_TAGS[k].label).join(', ');
  return `Kamu adalah asisten pencatat jejak waktu (time-log). Ekstrak aktivitas dan durasinya dari teks berikut:
"${text}"

KATEGORI TAG TERSEDIA (PILIH SALAH SATU PERSIS): [${tagList}]

Kembalikan HANYA format JSON valid berikut (array of objects), tanpa penjelasan tambahan:
[
  {
    "title": "nama aktivitas",
    "tag": "salah satu kategori tag di atas",
    "durationMinutes": angka_durasi_dalam_menit
  }
]`;
}

function openAiTimelogModal() {
  document.getElementById('ai-timelog-input').value = '';
  document.getElementById('ai-timelog-paste-input').value = '';
  openModal('ai-timelog-modal');
}

function generateAiTimelogPrompt() {
  const text = document.getElementById('ai-timelog-input').value.trim();
  if (!text) { showToast('Ketik aktivitas harian dulu', 'error'); return; }
  copyToClipboard(buildAiTimelogPrompt(text));
  openGemini();
  showToast('Prompt disalin & Gemini dibuka — tempel hasilnya di bawah');
}

function processAiTimelogPaste() {
  const raw = document.getElementById('ai-timelog-paste-input').value;
  if (!raw.trim()) { showToast('Tempel hasil AI dulu', 'error'); return; }
  let data;
  try { data = extractJSON(raw); } catch { showToast('Gagal memproses JSON', 'error'); return; }
  const items = Array.isArray(data) ? data : [data];
  let count = 0;
  items.forEach(it => {
    if (!it || !it.title) return;
    const tag = resolveAnyTag(it.tag);
    const dur = Math.max(5, parseInt(it.durationMinutes || it.duration, 10) || 30);
    state.timelog.push({
      id: genId('log'),
      date: todayStr(),
      title: String(it.title).trim(),
      tag,
      durationMinutes: dur,
      source: 'ai',
      taskId: null,
      createdAt: new Date().toISOString(),
    });
    count++;
  });
  if (!count) { showToast('Tidak ada jejak waktu terdeteksi di JSON', 'error'); return; }
  saveTimelog();
  closeModal('ai-timelog-modal');
  renderTimelog();
  renderConsistency();
  renderDistributionChart();
  showToast(`${count} jejak waktu ditambahkan`);
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

/* ── AI SUPER BATCH PLANNER ────────────────── */
function generateSuperBatchPrompt() {
  const text = document.getElementById('batch-plan-input').value.trim();
  if (!text) { showToast('Ketik ide rencana / tujuan besarmu dulu', 'error'); return; }
  
  const prompt = `Saya ingin membuat rencana jangka panjang. Tolong jadikan tujuan berikut menjadi rencana super komprehensif dalam satu JSON:
"${text}"

Tanggal hari ini: ${todayStr()}

Kamu wajib menganalisa strategi yang paling optimal, lalu membaginya ke dalam proyek (projects), kebiasaan (habits), dan aktivitas harian (activities).

Format JSON wajib seperti ini:
\`\`\`json
{
  "analysis": "Penjelasan komprehensif mengapa rencana ini disusun sedemikian rupa...",
  "projects": [
    {
      "title": "Nama Proyek",
      "tag": "Productivity",
      "tasks": [
        {
          "title": "Nama Tugas Spesifik",
          "estimatedMinutes": 45,
          "scheduleStartDate": "YYYY-MM-DD",
          "scheduleEndDate": "YYYY-MM-DD"
        }
      ]
    }
  ],
  "habits": [
    {
      "title": "Nama Kebiasaan",
      "tag": "Kesehatan",
      "frequency": "daily"
    }
  ],
  "activities": [
    {
      "date": "YYYY-MM-DD",
      "timeStart": "08:00",
      "timeEnd": "09:30",
      "title": "Fokus Sesi 1",
      "category": "Belajar/Kerja",
      "subTasks": ["sub 1", "sub 2"]
    }
  ]
}
\`\`\`

Daftar kategori untuk activities: [${Object.keys(CATEGORIES).join(', ')}].
Daftar tag untuk projects/habits: [${Object.keys(BASE_TAGS).join(', ')}].
Gunakan YYYY-MM-DD asli berdasarkan tanggal hari ini. Kembalikan HANYA format JSON tanpa penjelasan lain.`;

  copyToClipboard(prompt);
  openGemini();
  showToast('Prompt disalin & Gemini dibuka — tempel hasilnya di bawah');
}

function processBatchPlanJSON() {
  const raw = document.getElementById('batch-plan-paste-input').value;
  if (!raw.trim()) { showToast('Tempel master JSON dari AI terlebih dahulu', 'error'); return; }
  
  try {
    const data = extractJSON(raw);
    
    if (data.projects && Array.isArray(data.projects)) {
      data.projects.forEach(p => {
        const pId = genId('proj');
        state.projects.push({
          id: pId, title: String(p.title).trim(), tag: resolveAnyTag(p.tag)
        });
        if (p.tasks && Array.isArray(p.tasks)) {
          p.tasks.forEach(t => {
            state.tasks.push({
              id: genId('task'), projectId: pId, title: String(t.title).trim(),
              estimatedMinutes: Number(t.estimatedMinutes) || 0,
              scheduleStart: t.scheduleStartDate || todayStr(),
              scheduleEnd: t.scheduleEndDate || todayStr(),
              isDone: false,
              date: t.scheduleStartDate || todayStr()
            });
          });
        }
      });
      saveProjects();
      saveTasks();
    }
    
    if (data.habits && Array.isArray(data.habits)) {
      data.habits.forEach(h => {
        state.habits.push({
          id: genId('hab'), title: String(h.title).trim(),
          tag: resolveAnyTag(h.tag), frequency: h.frequency || 'daily',
          createdAt: todayStr(), completions: {}
        });
      });
      saveHabits();
    }
    
    if (data.activities && Array.isArray(data.activities)) {
      data.activities.forEach(a => {
        const subTasks = Array.isArray(a.subTasks) 
          ? a.subTasks.map(s => typeof s === 'string' ? { id: genId('sub'), title: s.trim(), isDone: false } : { id: genId('sub'), title: (s.title||'').trim(), isDone: !!s.isDone }).filter(s => s.title)
          : [];
        state.activities.push({
          id: genId('act'),
          date: a.date || todayStr(),
          timeStart: (a.timeStart || '08:00').padStart(5, '0'),
          timeEnd: (a.timeEnd || '09:00').padStart(5, '0'),
          category: CATEGORIES[a.category] ? a.category : 'Lainnya',
          title: String(a.title).trim(),
          caloriesBurned: 0, caloriesConsumed: 0,
          subTasks
        });
      });
      save();
    }
    
    closeModal('batch-plan-modal');
    if (typeof renderProjects === 'function') renderProjects();
    if (typeof renderHabits === 'function') renderHabits();
    renderTimeline();
    
    if (data.analysis) {
      alert("Eksekusi Berhasil!\n\nAnalisa AI:\n" + data.analysis);
    } else {
      showToast('Master Plan dieksekusi dengan sukses!');
    }
    
  } catch (err) {
    console.error(err);
    showToast('Gagal memproses JSON. Pastikan format valid.', 'error');
  }
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
  showToast('Data berhasil diekstrak');
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
          state.tasks = Array.isArray(data.tasks) ? data.tasks : [];
          state.projects = Array.isArray(data.projects) ? data.projects : [];
          state.habits = Array.isArray(data.habits) ? data.habits : [];
          state.timelog = Array.isArray(data.timelog) ? data.timelog : [];
          state.journal = Array.isArray(data.journal) ? data.journal : [];
          if (data.settings && typeof data.settings === 'object') state.settings = { ...state.settings, ...data.settings };
          save(); saveTasks(); saveProjects(); saveHabits(); saveTimelog(); saveJournal(); saveSettings();
          applyTheme();
          renderTimeline(); renderQuickTasks(); renderProjects(); renderHabits();
          if (typeof renderHomeHabits === 'function') renderHomeHabits(); renderReminderUI();
          if (document.getElementById('page-journal')?.classList.contains('active')) { renderTimelog(); renderConsistency(); renderDistributionChart(); renderJournalList(); }
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
    if (typeof renderHomeHabits === 'function') renderHomeHabits();
    if (document.getElementById('page-journal')?.classList.contains('active')) { renderTimelog(); renderConsistency(); renderDistributionChart(); renderJournalList(); }
    showToast('Semua data telah dihapus');
  });
}

/* ── TELEGRAM PAIRING ──────────────────────── */
function generatePairingCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function openTelegramPairingModal() {
  let code = state.settings.tgPairingCode;
  const now = Date.now();
  if (!code || !state.settings.tgPairingExpires || now > state.settings.tgPairingExpires) {
    code = generatePairingCode();
    state.settings.tgPairingCode = code;
    state.settings.tgPairingExpires = now + (15 * 60 * 1000);
    saveSettings();
  }

  // Jika akun cloud login, simpan kode pairing langsung ke Supabase
  if (state.cloudUser && sb) {
    sb.from('profiles').update({
      pairing_code: code,
      pairing_expires_at: new Date(now + 15 * 60 * 1000).toISOString()
    }).eq('id', state.cloudUser.id).then();
  }

  const codeDisplay = document.getElementById('tg-pairing-code-display');
  if (codeDisplay) codeDisplay.textContent = code;

  const directLink = document.getElementById('btn-tg-direct-link');
  if (directLink) directLink.href = `https://t.me/SevnLifeBot?start=${code}`;

  openModal('tg-modal');
}

/* ── SUPABASE CLOUD AUTH & 2-WAY SYNC ───────── */
async function initCloudAuth() {
  if (!sb) initSupabase();
  if (!sb) return;

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) {
      state.cloudUser = session.user;
      await fetchCloudProfile();
      renderCloudUI();
      syncWithCloud(true);
    }
  } catch (err) {
    console.warn('Cloud session error:', err);
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      state.cloudUser = session.user;
      await fetchCloudProfile();
      renderCloudUI();
      syncWithCloud(true);
    } else {
      state.cloudUser = null;
      state.cloudProfile = null;
      renderCloudUI();
    }
  });
}

async function fetchCloudProfile() {
  if (!sb || !state.cloudUser) return;
  try {
    const { data } = await sb
      .from('profiles')
      .select('*')
      .eq('id', state.cloudUser.id)
      .single();
    if (data) state.cloudProfile = data;
  } catch (e) {
    console.warn('Fetch profile error:', e);
  }
}

function renderCloudUI() {
  const titleEl = document.getElementById('cloud-account-title');
  const subEl = document.getElementById('cloud-account-sub');
  const btnLabel = document.getElementById('cloud-btn-label');
  const syncBtn = document.getElementById('btn-cloud-sync');
  const logoutBtn = document.getElementById('btn-cloud-logout');
  const tgSub = document.getElementById('tg-pairing-sub');

  if (state.cloudUser) {
    const name = state.cloudProfile?.full_name || state.cloudUser.user_metadata?.full_name || state.cloudUser.email.split('@')[0];
    if (titleEl) titleEl.textContent = `🟢 ${name}`;
    if (subEl) subEl.textContent = `${state.cloudUser.email} · Cloud Aktif`;
    if (btnLabel) btnLabel.textContent = 'Akun';
    if (syncBtn) syncBtn.style.display = 'inline-flex';
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';

    if (state.cloudProfile?.telegram_chat_id && tgSub) {
      tgSub.textContent = `✅ Terhubung ke Telegram (@SevnLifeBot)`;
    }
  } else {
    if (titleEl) titleEl.textContent = 'Mode Offline';
    if (subEl) subEl.textContent = 'Data hanya tersimpan lokal di browser ini';
    if (btnLabel) btnLabel.textContent = 'Masuk / Daftar';
    if (syncBtn) syncBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
  }
}

function openCloudModal() {
  const errEl = document.getElementById('cloud-auth-error');
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }

  // Jika sudah login, tampilkan info
  if (state.cloudUser) {
    const emailInput = document.getElementById('cloud-email-input');
    if (emailInput) emailInput.value = state.cloudUser.email;
    showToast(`Anda saat ini masuk sebagai ${state.cloudUser.email}`);
  }

  setCloudAuthTab('login');
  openModal('cloud-modal');
}

function setCloudAuthTab(tab) {
  state.authTab = tab;
  const loginTab = document.getElementById('tab-cloud-login');
  const regTab = document.getElementById('tab-cloud-register');
  const nameField = document.getElementById('cloud-name-field');
  const submitLabel = document.getElementById('cloud-submit-label');

  if (tab === 'login') {
    if (loginTab) { loginTab.style.background = 'var(--base)'; loginTab.style.boxShadow = 'var(--el-xs)'; loginTab.style.color = 'var(--accent-dark)'; }
    if (regTab) { regTab.style.background = 'transparent'; regTab.style.boxShadow = 'none'; regTab.style.color = 'var(--text2)'; }
    if (nameField) nameField.style.display = 'none';
    if (submitLabel) submitLabel.textContent = 'Masuk ke Akun Cloud';
  } else {
    if (regTab) { regTab.style.background = 'var(--base)'; regTab.style.boxShadow = 'var(--el-xs)'; regTab.style.color = 'var(--accent-dark)'; }
    if (loginTab) { loginTab.style.background = 'transparent'; loginTab.style.boxShadow = 'none'; loginTab.style.color = 'var(--text2)'; }
    if (nameField) nameField.style.display = 'block';
    if (submitLabel) submitLabel.textContent = 'Daftar Akun Cloud';
  }
}

async function handleCloudAuthSubmit() {
  if (!sb) return showToast('Modul Supabase belum dimuat', 'error');
  const email = (document.getElementById('cloud-email-input')?.value || '').trim();
  const password = (document.getElementById('cloud-password-input')?.value || '').trim();
  const fullName = (document.getElementById('cloud-name-input')?.value || '').trim();
  const errEl = document.getElementById('cloud-auth-error');

  if (!email || !password) {
    if (errEl) { errEl.textContent = 'Email dan kata sandi wajib diisi.'; errEl.style.display = 'block'; }
    return;
  }
  if (password.length < 6) {
    if (errEl) { errEl.textContent = 'Kata sandi minimal 6 karakter.'; errEl.style.display = 'block'; }
    return;
  }

  const submitBtn = document.getElementById('btn-submit-cloud-auth');
  if (submitBtn) submitBtn.disabled = true;

  try {
    if (state.authTab === 'login') {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      state.cloudUser = data.user;
      await fetchCloudProfile();
      renderCloudUI();
      closeModal('cloud-modal');
      showToast(`Selamat datang, ${state.cloudProfile?.full_name || email}!`, 'success');
      syncWithCloud();
    } else {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName || email.split('@')[0] } }
      });
      if (error) throw error;
      state.cloudUser = data.user;
      closeModal('cloud-modal');
      showToast('Pendaftaran berhasil! Akun cloud aktif.', 'success');
      renderCloudUI();
      syncWithCloud();
    }
  } catch (err) {
    if (errEl) { errEl.textContent = err.message || 'Terjadi kesalahan autentikasi.'; errEl.style.display = 'block'; }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function logoutCloud() {
  if (!sb) return;
  confirmDialog('Keluar dari Akun Cloud?', 'Data lokal di browser ini akan tetap aman. Anda bisa masuk kembali kapan saja.', async () => {
    await sb.auth.signOut();
    state.cloudUser = null;
    state.cloudProfile = null;
    renderCloudUI();
    showToast('Berhasil keluar dari akun cloud');
  });
}

/* ── 2-WAY DATA SYNC ENGINE ─────────────────── */
async function syncWithCloud(silent = false) {
  if (!sb || !state.cloudUser || state.isSyncing) return;
  state.isSyncing = true;
  const syncBtn = document.getElementById('btn-cloud-sync');
  if (syncBtn) syncBtn.style.transform = 'rotate(180deg)';

  try {
    // 1. Profil & Telegram chat ID
    await fetchCloudProfile();

    // 2. Sinkronisasi Tugas (Tasks)
    const { data: cloudTasks, error: tErr } = await sb
      .from('tasks')
      .select('*')
      .eq('user_id', state.cloudUser.id);

    if (!tErr && Array.isArray(cloudTasks)) {
      const cloudMap = new Map();
      cloudTasks.forEach(ct => cloudMap.set(ct.id, ct));

      // Update status lokal jika di cloud sudah done
      state.tasks.forEach(lt => {
        if (lt.cloud_id && cloudMap.has(lt.cloud_id)) {
          const ct = cloudMap.get(lt.cloud_id);
          if (ct.status === 'done' && !lt.isDone) {
            lt.isDone = true;
            autoSyncTaskToTimelog(lt);
          }
        }
      });

      // Tambahkan tugas baru dari Telegram/Cloud ke lokal
      const localCloudIds = new Set(state.tasks.map(t => t.cloud_id).filter(Boolean));
      cloudTasks.forEach(ct => {
        if (!localCloudIds.has(ct.id)) {
          state.tasks.unshift({
            id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            cloud_id: ct.id,
            title: ct.title,
            tag: 'Productivity',
            date: todayStr(),
            isDone: ct.status === 'done',
            priority: ct.priority || 'medium'
          });
        }
      });

      // Push tugas lokal yang belum tersimpan di Cloud
      for (const lt of state.tasks) {
        if (!lt.cloud_id) {
          const { data: ins } = await sb.from('tasks').insert({
            user_id: state.cloudUser.id,
            title: lt.title,
            status: lt.isDone ? 'done' : 'todo',
            priority: lt.priority || 'medium'
          }).select().single();
          if (ins) lt.cloud_id = ins.id;
        }
      }

      saveTasks();
      renderQuickTasks();
    }

    // 3. Sinkronisasi Kebiasaan (Habits & Logs)
    const { data: cloudHabits } = await sb.from('habits').select('*').eq('user_id', state.cloudUser.id);
    if (Array.isArray(cloudHabits)) {
      const cloudHMap = new Map(cloudHabits.map(h => [(h.name || '').toLowerCase().trim(), h]));
      for (const lh of state.habits) {
        const norm = (lh.title || lh.name || '').toLowerCase().trim();
        if (cloudHMap.has(norm)) {
          lh.cloud_id = cloudHMap.get(norm).id;
        } else if (!lh.cloud_id) {
          const { data: insH } = await sb.from('habits').insert({
            user_id: state.cloudUser.id,
            name: lh.title || lh.name,
            icon: lh.icon || '🔥',
            target_days: lh.days || ['mon','tue','wed','thu','fri','sat','sun']
          }).select().single();
          if (insH) lh.cloud_id = insH.id;
        }
      }

      // Tarik log hari ini
      const today = todayStr();
      const { data: cloudLogs } = await sb.from('habit_logs')
        .select('habit_id')
        .eq('user_id', state.cloudUser.id)
        .eq('logged_date', today);

      if (Array.isArray(cloudLogs) && cloudLogs.length > 0) {
        const doneCloudIds = new Set(cloudLogs.map(l => l.habit_id));
        state.habits.forEach(lh => {
          if (lh.cloud_id && doneCloudIds.has(lh.cloud_id)) {
            lh.completions = lh.completions || {};
            if (!lh.completions[today]) {
              lh.completions[today] = true;
              autoSyncHabitToTimelog(lh);
            }
          }
        });
      }

      saveHabits();
      renderHabits();
    }

    renderCloudUI();
    if (!silent) showToast('✅ Data tersinkronisasi 2-arah dengan Telegram!', 'success');
  } catch (err) {
    console.warn('Sync error:', err);
    if (!silent) showToast('Gagal sinkronisasi cloud', 'error');
  } finally {
    state.isSyncing = false;
    if (syncBtn) syncBtn.style.transform = 'none';
  }
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

  /* ── FAB (Choice: Manual vs AI) ── */
  document.getElementById('fab').addEventListener('click', () => {
    openChoiceModal({
      title: 'Tambah Kegiatan',
      titleIcon: 'ph-note-pencil',
      subtitle: 'Pilih cara menambahkan kegiatan ke linimasa:',
      manualTitle: 'Versi Manual',
      manualDesc: 'Isi formulir kegiatan (judul, jam, kategori, sub-tugas, kalori).',
      aiTitle: 'Versi Prompt AI',
      aiDesc: 'Tulis rencana aktivitas bebas, AI Gemini merapikan jadwalnya.',
      onManual: () => openActivityModal(null),
      onAi: () => openAiActivityModal()
    });
  });
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

  /* ── AI Activity Modal ── */
  document.getElementById('btn-cancel-ai-activity').addEventListener('click', () => closeModal('ai-activity-modal'));
  document.getElementById('btn-generate-ai-activity').addEventListener('click', generateAiActivityPrompt);
  document.getElementById('btn-process-ai-activity').addEventListener('click', processAiActivityPaste);
  document.getElementById('ai-activity-modal').addEventListener('click', e => { if (e.target.id === 'ai-activity-modal') closeModal('ai-activity-modal'); });

  /* ── Choice Modal ── */
  document.getElementById('choice-btn-manual').addEventListener('click', () => {
    closeModal('choice-modal');
    if (currentChoiceConfig && currentChoiceConfig.onManual) currentChoiceConfig.onManual();
  });
  document.getElementById('choice-btn-ai').addEventListener('click', () => {
    closeModal('choice-modal');
    if (currentChoiceConfig && currentChoiceConfig.onAi) currentChoiceConfig.onAi();
  });
  document.getElementById('btn-cancel-choice').addEventListener('click', () => closeModal('choice-modal'));
  document.getElementById('choice-modal').addEventListener('click', e => { if (e.target.id === 'choice-modal') closeModal('choice-modal'); });

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

  /* ── Cloud Auth & Sync Events ── */
  document.getElementById('btn-open-cloud-modal')?.addEventListener('click', openCloudModal);
  document.getElementById('btn-close-cloud-modal')?.addEventListener('click', () => closeModal('cloud-modal'));
  document.getElementById('cloud-modal')?.addEventListener('click', e => { if (e.target.id === 'cloud-modal') closeModal('cloud-modal'); });
  document.getElementById('tab-cloud-login')?.addEventListener('click', () => setCloudAuthTab('login'));
  document.getElementById('tab-cloud-register')?.addEventListener('click', () => setCloudAuthTab('register'));
  document.getElementById('btn-submit-cloud-auth')?.addEventListener('click', handleCloudAuthSubmit);
  document.getElementById('btn-cloud-sync')?.addEventListener('click', () => syncWithCloud(false));
  document.getElementById('btn-cloud-logout')?.addEventListener('click', logoutCloud);

  /* ── Telegram Pairing Events ── */
  document.getElementById('btn-open-tg-modal')?.addEventListener('click', openTelegramPairingModal);
  document.getElementById('btn-close-tg-modal')?.addEventListener('click', () => closeModal('tg-modal'));
  document.getElementById('tg-modal')?.addEventListener('click', e => { if (e.target.id === 'tg-modal') closeModal('tg-modal'); });
  document.getElementById('btn-copy-pairing-cmd')?.addEventListener('click', () => {
    const code = state.settings.tgPairingCode || '';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`/pair ${code}`).then(() => {
        showToast('Perintah pairing disalin ke clipboard!', 'success');
      }).catch(() => {
        showToast(`Ketik di Telegram: /pair ${code}`, 'info');
      });
    } else {
      showToast(`Ketik di Telegram: /pair ${code}`, 'info');
    }
  });

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

  /* ── Projects (Choice: Manual vs AI) ── */
  document.getElementById('btn-new-project').addEventListener('click', () => {
    openChoiceModal({
      title: 'Buat Proyek Baru',
      titleIcon: 'ph-rocket-launch',
      subtitle: 'Pilih cara membuat proyek / goal baru:',
      manualTitle: 'Versi Manual',
      manualDesc: 'Tentukan judul, target waktu, dan rincian tugas secara manual.',
      aiTitle: 'Versi Prompt AI',
      aiDesc: 'Isi detail racikan proyek, AI menyusun fase, tugas & kebiasaan.',
      onManual: () => openManualProjectModal(),
      onAi: () => openProjectModal()
    });
  });
  document.getElementById('btn-cancel-project').addEventListener('click', () => closeModal('project-modal'));
  document.getElementById('btn-generate-project').addEventListener('click', generateProjectPrompt);
  document.getElementById('btn-process-project').addEventListener('click', processProjectPaste);
  document.getElementById('project-modal').addEventListener('click', e => { if (e.target.id === 'project-modal') closeModal('project-modal'); });

  /* ── Manual Project Modal ── */
  document.getElementById('btn-cancel-manual-project').addEventListener('click', () => closeModal('manual-project-modal'));
  document.getElementById('btn-save-manual-project').addEventListener('click', saveManualProject);
  document.getElementById('manual-project-modal').addEventListener('click', e => { if (e.target.id === 'manual-project-modal') closeModal('manual-project-modal'); });

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

  /* ── Habits (Choice: Manual vs AI) ── */
  document.getElementById('btn-new-habit').addEventListener('click', () => {
    openChoiceModal({
      title: 'Tambah Kebiasaan',
      titleIcon: 'ph-repeat',
      subtitle: 'Pilih cara membuat kebiasaan baru:',
      manualTitle: 'Versi Manual',
      manualDesc: 'Isi judul kebiasaan, frekuensi, target mingguan & tag.',
      aiTitle: 'Versi Prompt AI',
      aiDesc: 'Ceritakan gaya hidup/pekerjaan, AI menyarankan kebiasaan relevan.',
      onManual: () => openHabitModal(null),
      onAi: () => openContextModal()
    });
  });
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
  document.getElementById('home-habits-list')?.addEventListener('click', e => {
    const check = e.target.closest('[data-habit-toggle]');
    const edit = e.target.closest('[data-habit-edit]');
    if (check) { toggleHabitDone(check.dataset.habitToggle, state.viewDate); renderHomeHabits(); renderHabits(); return; }
    if (edit) { const h = state.habits.find(x => x.id === edit.dataset.habitEdit); if (h) openHabitModal(h); }
  });

  /* ── Contextual AI ── */
  document.getElementById('btn-context-ai').addEventListener('click', openContextModal);
  document.getElementById('btn-cancel-context').addEventListener('click', () => closeModal('context-modal'));
  document.getElementById('btn-generate-context').addEventListener('click', generateContextPrompt);
  document.getElementById('btn-process-context').addEventListener('click', processContextPaste);
  document.getElementById('context-modal').addEventListener('click', e => { if (e.target.id === 'context-modal') closeModal('context-modal'); });

  /* ── Time-Log (Choice: Manual vs AI) & Story Maker ── */
  document.getElementById('btn-add-timelog').addEventListener('click', () => {
    openChoiceModal({
      title: 'Catat Jejak Waktu',
      titleIcon: 'ph-clock-clockwise',
      subtitle: 'Pilih cara mencatat jejak waktu kegiatan:',
      manualTitle: 'Versi Manual',
      manualDesc: 'Input judul aktivitas, kategori & durasi menit secara langsung.',
      aiTitle: 'Versi Prompt AI',
      aiDesc: 'Ceritakan aktivitas hari ini, AI menghitung & merapikan durasinya.',
      onManual: () => openTimelogModal(),
      onAi: () => openAiTimelogModal()
    });
  });
  document.getElementById('btn-cancel-timelog').addEventListener('click', () => closeModal('timelog-modal'));
  document.getElementById('btn-save-timelog').addEventListener('click', saveTimelogManual);
  document.getElementById('timelog-modal').addEventListener('click', e => { if (e.target.id === 'timelog-modal') closeModal('timelog-modal'); });

  /* ── AI Timelog Modal ── */
  document.getElementById('btn-cancel-ai-timelog').addEventListener('click', () => closeModal('ai-timelog-modal'));
  document.getElementById('btn-generate-ai-timelog').addEventListener('click', generateAiTimelogPrompt);
  document.getElementById('btn-process-ai-timelog').addEventListener('click', processAiTimelogPaste);
  document.getElementById('ai-timelog-modal').addEventListener('click', e => { if (e.target.id === 'ai-timelog-modal') closeModal('ai-timelog-modal'); });

  document.getElementById('btn-generate-story').addEventListener('click', generateStoryPrompt);
  document.getElementById('btn-save-story').addEventListener('click', saveStoryEntry);

  /* ── AI Super Batch Planner ── */
  document.getElementById('btn-open-batch-planner').addEventListener('click', () => {
    document.getElementById('batch-plan-input').value = '';
    document.getElementById('batch-plan-paste-input').value = '';
    openModal('batch-plan-modal');
  });
  document.getElementById('btn-cancel-batch-plan').addEventListener('click', () => closeModal('batch-plan-modal'));
  document.getElementById('btn-generate-batch-plan').addEventListener('click', generateSuperBatchPrompt);
  document.getElementById('btn-process-batch-plan').addEventListener('click', processBatchPlanJSON);
  document.getElementById('batch-plan-modal').addEventListener('click', e => { if (e.target.id === 'batch-plan-modal') closeModal('batch-plan-modal'); });
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
  initCloudAuth();

  // Auto-sync berkala dengan Supabase & Telegram tiap 30 detik
  setInterval(() => {
    if (state.cloudUser) syncWithCloud(true);
  }, 30000);

  setInterval(() => {
    checkReminderTick();
    if (document.getElementById('page-home').classList.contains('active')) {
      renderGreeting();
      if (state.viewDate === todayStr()) renderTimeline();
    }
  }, 60000);
});
