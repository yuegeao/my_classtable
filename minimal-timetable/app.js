/* ════════════════════════════════════════════════════════
   极简课表 Minimal Timetable · app.js
   数据层 / 渲染 / 倒计时 / 提醒 / 备份
   ════════════════════════════════════════════════════════ */
'use strict';

/* ─────────────── 常量 ─────────────── */
const LS_KEY = 'minimal-timetable-v1';
const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];



const PALETTE = ['#6d8fd6', '#63b59d', '#d9a35e', '#db8a8a', '#9a86cc', '#db93b0', '#56a8a2', '#a3b96b', '#db8f62', '#8591a6'];

const DEFAULT_SLOTS = [
  '08:00-08:45', '08:55-09:40', '10:00-10:45', '10:55-11:40',
  '14:00-14:45', '14:55-15:40', '16:00-16:45', '16:55-17:40',
  '19:00-19:45', '19:55-20:40', '20:50-21:35', '21:45-22:30',
];

const THEMES = {
  blue:   { name: '靛蓝',   primary: '#3b82f6' },
  mint:   { name: '薄荷',   primary: '#10b981' },
  violet: { name: '紫罗兰', primary: '#8b5cf6' },
  orange: { name: '日落',   primary: '#f97316' },
  rose:   { name: '蔷薇',   primary: '#f43f5e' },
  gray:   { name: '墨灰',   primary: '#475569' },
};
const LIGHT = { bg: '#f5f6fa', surface: '#ffffff', text: '#1d2333', muted: '#8b94a7', border: '#e9ecf4' };
const DARK  = { bg: '#0e1013', surface: '#171a20', text: '#e7eaf0', muted: '#8b93a6', border: '#262b34' };

/* ─────────────── 基础工具 ─────────────── */
const byId = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function uid() {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function hexToRgba(hex, a) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return 'rgba(59,130,246,' + a + ')';
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
}

/* 时间 / 日期 */
function toMin(hhmm) { const [h, m] = String(hhmm).split(':').map(Number); return (h || 0) * 60 + (m || 0); }
function fmtMin(min) { return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`; }
function parseSlotTime(t) {
  const [a, b] = String(t || '00:00-00:00').split('-');
  return [toMin(a), toMin(b)];
}
function strFromDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function dateFromStr(s) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s || ''));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(NaN);
}
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

/* 星期 / 中文数字解析 */
const CN = { '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
/* 时间段分组：按开始时间划分 上午(<12:00) / 下午(12:00–18:00) / 晚上(≥18:00) */
function slotPeriod(min) { return min < 720 ? '上午' : (min < 1080 ? '下午' : '晚上'); }
function cn2num(s) {
  s = String(s).trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (CN[s] != null) return CN[s];
  const i = s.indexOf('十');
  if (i >= 0) {
    const a = s.slice(0, i), b = s.slice(i + 1);
    return (a ? CN[a] : 1) * 10 + (b ? CN[b] : 0);
  }
  return null;
}
const WD_EN = { 'MON': 0, 'TUE': 1, 'WED': 2, 'THU': 3, 'FRI': 4, 'SAT': 5, 'SUN': 6 };
function resolveWeekdayToken(t) {
  if (!t) return null;
  const raw = String(t).trim().toUpperCase();
  const cn = raw.replace(/^(星期|礼拜|周)/, '');
  if (/^[一二三四五六日天]$/.test(cn)) return { '一': 0, '二': 1, '三': 2, '四': 3, '五': 4, '六': 5, '日': 6, '天': 6 }[cn];
  if (/^[1-7]$/.test(cn)) return +cn - 1;
  const s = raw.replace(/[^A-Z]/g, '');
  if (/^[A-Z]{3,9}$/.test(s)) {
    for (const k in WD_EN) if (s.startsWith(k)) return WD_EN[k];
  }
  return null;
}



/* ─────────────── 状态 ─────────────── */
let state = null;
let currentTab = 'today';
let copiedCourse = null;
let scheduleContextMenu = null;

function defaultState() {
  const now = new Date();
  const monday = addDays(startOfDay(now), -((now.getDay() + 6) % 7));
  return {
    version: 1,
    meta: {
      semesterStart: strFromDate(monday),
      totalWeeks: 20,
      weekMode: 'auto',
      currentWeek: 1,
      slotTimes: DEFAULT_SLOTS.slice(),
      theme: 'blue',
      accent: '',
      dark: 'light',
      remind: true,
      remindMinutes: 10,
      notified: [],
      timeMode: 'pair',        /* pair=大学（双节时间合并） | single=中学（每节单独） */
      countdownWarn: 3,        /* 倒数预警天数：剩余天数低于此值标红 */
      countdownWarnOn: true,   /* 倒数预警开关 */
      countdownManual: false,  /* 倒数日是否已手动排序（长按换位后为 true） */
      scheduleOverrides: [],   /* 调休：[{ date:'YYYY-MM-DD', sourceDate:'YYYY-MM-DD' }] */
    },
    courses: [],
    countdowns: [],
  };
}
function normalizeState(raw) {
  const d = defaultState();
  const s = raw && typeof raw === 'object' ? raw : {};
  const meta = Object.assign({}, d.meta, s.meta || {});
  meta.slotTimes = Array.isArray(meta.slotTimes) && meta.slotTimes.length
    ? meta.slotTimes.map(x => String(x)) : d.meta.slotTimes;
  meta.notified = Array.isArray(meta.notified) ? meta.notified : [];
  meta.scheduleOverrides = Array.isArray(meta.scheduleOverrides)
    ? meta.scheduleOverrides.filter(x => x && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && (
      /^\d{4}-\d{2}-\d{2}$/.test(x.sourceDate || '') || (Number.isInteger(+x.weekday) && +x.weekday >= 0 && +x.weekday <= 6)
    )).map(x => /^\d{4}-\d{2}-\d{2}$/.test(x.sourceDate || '')
      ? { date: x.date, sourceDate: x.sourceDate }
      : { date: x.date, weekday: +x.weekday })
    : [];
  return { version: d.version, meta, courses: Array.isArray(s.courses) ? s.courses : [], countdowns: Array.isArray(s.countdowns) ? s.countdowns : [] };
}
function loadState() {
  try { state = normalizeState(JSON.parse(localStorage.getItem(LS_KEY))); }
  catch (e) { state = defaultState(); }
}
function saveState() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
}

/* 周数 */
function weekOfDate(d) {
  const start = dateFromStr(state.meta.semesterStart);
  if (isNaN(start.getTime())) return 1;
  return Math.floor((startOfDay(d) - startOfDay(start)) / 86400000 / 7) + 1;
}
function effectiveWeek() {
  let w = state.meta.weekMode === 'manual' ? state.meta.currentWeek : weekOfDate(new Date());
  if (!(w >= 1)) w = 1;
  if (w > state.meta.totalWeeks) w = state.meta.totalWeeks;
  return w;
}
function courseInWeek(c, w) {
  const m = c.weeks;
  if (!m || m.mode === 'all') return true;
  if (m.mode === 'odd') return w % 2 === 1;
  if (m.mode === 'even') return w % 2 === 0;
  return Array.isArray(m.list) && m.list.indexOf(w) >= 0;
}

function adjustedWeekday(date, overrides) {
  const actual = (date.getDay() + 6) % 7;
  const key = strFromDate(date);
  const item = (overrides || []).find(x => x.date === key);
  if (!item) return actual;
  const source = dateFromStr(item.sourceDate);
  return !isNaN(source.getTime()) ? (source.getDay() + 6) % 7 : +item.weekday;
}
function scheduleOverrideForDate(date) {
  const key = strFromDate(date);
  return (state.meta.scheduleOverrides || []).find(x => x.date === key) || null;
}
function scheduleWeekdayForDate(date) {
  return adjustedWeekday(date, state.meta.scheduleOverrides);
}
function scheduleWeekForDate(date, fallbackWeek) {
  const item = scheduleOverrideForDate(date);
  const source = item && dateFromStr(item.sourceDate);
  return source && !isNaN(source.getTime()) ? weekOfDate(source) : fallbackWeek;
}
function scheduleOverrideText(item) {
  if (!item) return '';
  const source = dateFromStr(item.sourceDate);
  if (!isNaN(source.getTime())) return `${item.sourceDate}（${WEEKDAYS[(source.getDay() + 6) % 7]}）`;
  return `${WEEKDAYS[+item.weekday]}课表`;
}

/* ─────────────── 主题 ─────────────── */
function applyTheme() {
  const t = THEMES[state.meta.theme] || THEMES.blue;
  const primary = state.meta.accent || t.primary;
  const dark = state.meta.dark === 'dark';   /* v1.15 起不再跟随系统，仅 浅色/深色 */
  const v = dark ? DARK : LIGHT;
  const s = document.documentElement.style;
  s.setProperty('--p', primary);
  s.setProperty('--p-soft', hexToRgba(primary, .12));
  s.setProperty('--p-strong', hexToRgba(primary, .22));
  s.setProperty('--bg', v.bg);
  s.setProperty('--surface', v.surface);
  s.setProperty('--text', v.text);
  s.setProperty('--muted', v.muted);
  s.setProperty('--border', v.border);
  document.documentElement.dataset.dark = dark ? '1' : '0';
  const mc = document.querySelector('meta[name="theme-color"]');
  if (mc) mc.setAttribute('content', primary);
}

/* ─────────────── 弹层 / 轻提示 ─────────────── */
function openModal(html, opts) {
  const o = opts || {};
  const root = byId('modal-root');
  root.innerHTML = `<div class="modal-card">${html}</div>`;
  root.classList.add('open');
  root.dataset.closable = o.closable === false ? '0' : '1';
  const c1 = byId('m-close'), c2 = byId('m-cancel');
  if (c1) c1.onclick = closeModal;
  if (c2) c2.onclick = closeModal;
  root.onclick = o.closable === false ? null : (e => { if (e.target === root) closeModal(); });
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  const root = byId('modal-root');
  root.classList.remove('open');
  root.innerHTML = '';
  document.body.style.overflow = '';
}
function toast(msg) {
  const root = byId('toast-root');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, 2200);
}

function closeScheduleContextMenu() {
  if (scheduleContextMenu) scheduleContextMenu.remove();
  scheduleContextMenu = null;
}

function openScheduleContextMenu(ev, items) {
  ev.preventDefault();
  ev.stopPropagation();
  closeScheduleContextMenu();
  const menu = document.createElement('div');
  menu.className = 'schedule-context-menu';
  menu.setAttribute('role', 'menu');
  for (const item of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = item.label;
    button.disabled = !!item.disabled;
    button.setAttribute('role', 'menuitem');
    button.addEventListener('click', () => {
      closeScheduleContextMenu();
      if (!item.disabled) item.action();
    });
    menu.appendChild(button);
  }
  document.body.appendChild(menu);
  scheduleContextMenu = menu;
  const rect = menu.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(ev.clientX, window.innerWidth - rect.width - 8)) + 'px';
  menu.style.top = Math.max(8, Math.min(ev.clientY, window.innerHeight - rect.height - 8)) + 'px';
  const firstEnabled = menu.querySelector('button:not(:disabled)');
  if (firstEnabled) firstEnabled.focus({ preventScroll: true });
}

function copyCourse(course) {
  copiedCourse = { ...course, weeks: { ...(course.weeks || {}), list: [...((course.weeks && course.weeks.list) || [])] } };
  toast(`已复制「${course.name}」，请右键空白格粘贴`);
}

function cloneCourseAt(source, weekday, slotIndex, slotCount) {
  const duration = Math.max(1, (+source.endSlot || 1) - (+source.startSlot || 1) + 1);
  const startSlot = Math.max(1, Math.min(slotIndex + 1, slotCount));
  return {
    ...source,
    id: uid(),
    weekday,
    startSlot,
    endSlot: Math.min(startSlot + duration - 1, slotCount),
    weeks: { ...(source.weeks || {}), list: [...((source.weeks && source.weeks.list) || [])] },
  };
}

function pasteCourse(weekday, slotIndex) {
  if (!copiedCourse) { toast('请先右键复制一门课程'); return; }
  const course = cloneCourseAt(copiedCourse, weekday, slotIndex, state.meta.slotTimes.length);
  state.courses.push(course);
  saveState();
  renderAll();
  toast(`已粘贴「${course.name}」到${WEEKDAYS[weekday]}第${course.startSlot}节`);
}

function openConfirm(title, msg, actions, onPick) {
  const btns = actions.map(a => `<button class="btn ${a.danger ? 'danger' : 'ghost'}" data-v="${a.val}">${esc(a.label)}</button>`).join('');
  openModal(`<div class="modal-head"><h3>${esc(title)}</h3><button class="modal-close" id="m-close">✕</button></div>
    <div class="modal-body"><p style="font-size:14px;color:var(--muted);line-height:1.7">${esc(msg)}</p></div>
    <div class="modal-foot"><button class="btn ghost" id="m-cancel">取消</button>${btns}</div>`);
  document.querySelectorAll('.modal-foot [data-v]').forEach(b => {
    b.onclick = () => { closeModal(); onPick(b.dataset.v); };
  });
}


/* ─────────────── 下一节课（倒计时引擎） ─────────────── */
function nextClassView(now) {
  now = now || new Date();
  const todayWd = (now.getDay() + 6) % 7;
  const w0 = effectiveWeek();
  for (let off = 0; off < 14; off++) {
    const date = addDays(startOfDay(now), off);
    const day = scheduleWeekdayForDate(date);
    const override = scheduleOverrideForDate(date);
    const week = scheduleWeekForDate(date, w0 + Math.floor((todayWd + off) / 7));
    const list = state.courses
      .filter(c => c.weekday === day && courseInWeek(c, week))
      .sort((a, b) => a.startSlot - b.startSlot);
    for (const c of list) {
      const t = state.meta.slotTimes[c.startSlot - 1];
      if (!t) continue;
      const [s, e] = parseSlotTime(t);
      const start = new Date(date); start.setMinutes(s);
      const end = new Date(date); end.setMinutes(e);
      if (off === 0 && now.getTime() >= end.getTime()) continue;
      const ongoing = off === 0 && now >= start && now < end;
      const target = ongoing ? end : start;
      const diff = Math.max(0, target.getTime() - now.getTime());
      const h = Math.floor(diff / 3600000), m = Math.floor(diff % 3600000 / 60000), sec = Math.floor(diff % 60000 / 1000);
      const timeStr = h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
      return {
        state: 'next', course: c, ongoing, timeStr,
        meta: `${override ? `${strFromDate(date)}调休 · 按${scheduleOverrideText(override)}上课 · ` : ''}第${week}周 · 第${c.startSlot}节 ${state.meta.slotTimes[c.startSlot - 1]}`,
        stateText: ongoing ? '本节课进行中' : '点击卡片查看本周课表',
      };
    }
  }
  return { state: 'none' };
}
function updateNextBanners() {
  if (currentTab === 'today') {
    const v = nextClassView();
    const el = byId('today-next');
    if (!el) return;
    if (v.state === 'none') {
      el.className = 'next-card nc-none';
      el.innerHTML = '<div class="nc-label">课程安排</div><div class="nc-time">本周课程已结束 🎉</div><div class="nc-meta">去「课表」页添加课程，或切换周数查看</div>';
    } else {
      el.className = 'next-card';
      el.innerHTML = `<div class="nc-label">${v.ongoing ? '上课中 · 距下课' : '下一节课 · 距上课'}</div>
        <div class="nc-time">${v.timeStr}</div>
        <div class="nc-name">${esc(v.course.name)}</div>
        <div class="nc-meta">${esc([v.course.room, v.course.teacher].filter(Boolean).join(' · '))}${v.meta ? ' · ' + esc(v.meta) : ''}</div>
        <div class="nc-state">${v.stateText}</div>`;
      el.onclick = () => switchTab('schedule');
    }
  } else if (currentTab === 'countdown') {
    renderNextCountdownCard();
  }
}

/* ─────────────── 渲染：课表页 ─────────────── */
function renderWeekLabel() {
  const w = effectiveWeek();
  byId('week-label').textContent = `第 ${w} 周`;
}
function renderSchedule() {
  renderScheduleHead();
  renderScheduleBody();
}


/* 课程名按色块可用宽度自然换行 */
function cbNameLines(name) {
  return esc(name);
}

/* 顶部星期表头：独立于滚动区渲染，天然固定，杜绝 sticky 错位 */
function renderScheduleHead() {
  const h = byId('schedule-head');
  const w = effectiveWeek();
  const start = addDays(dateFromStr(state.meta.semesterStart), (w - 1) * 7);
  const now = new Date();
  const todayWd = (now.getDay() + 6) % 7;
  const todayInView = weekOfDate(now) === w;
  let html = '<div class="cell header corner">节次</div>';
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const isToday = todayInView && i === todayWd;
    const isWeekend = i >= 5;
    const override = scheduleOverrideForDate(d);
    html += `<div class="cell header${isToday ? ' today-col' : ''}${isWeekend && !isToday ? ' weekend-col' : ''}${override ? ' adjusted-col' : ''}"${override ? ` title="按 ${esc(scheduleOverrideText(override))} 的课程上课"` : ''}>
      <b>${WEEKDAYS[i]}</b><span>${d.getMonth() + 1}/${d.getDate()}${override ? ' · 调休' : ''}</span></div>`;
  }
  h.innerHTML = html;
}

/* 课表正文：左侧节次列（上午/下午/晚上分组）+ 7 列内容格 + 课程色块 */
function renderScheduleBody() {
  const g = byId('schedule-grid');
  const slotCount = state.meta.slotTimes.length;
  g.style.setProperty('--slots', slotCount);
  const w = effectiveWeek();
  const start = addDays(dateFromStr(state.meta.semesterStart), (w - 1) * 7);
  const now = new Date();
  const todayWd = (now.getDay() + 6) % 7;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todayInView = weekOfDate(now) === w;

  let html = '';
  const pairMode = state.meta.timeMode === 'pair';   // 大学模式：相邻两节时间合并为一条（无课也合并）
  for (let i = 0; i < slotCount; i++) {
    const [a, b] = parseSlotTime(state.meta.slotTimes[i]);
    const period = slotPeriod(a);
    const prev = i > 0 ? slotPeriod(parseSlotTime(state.meta.slotTimes[i - 1])[0]) : '';
    const periodStart = period !== prev;
    const periodLine = periodStart && i > 0;   // 非首个分组的边界 → 加柔线
    if (pairMode && i % 2 === 0 && i + 1 < slotCount) {
      const [, b2] = parseSlotTime(state.meta.slotTimes[i + 1]);
      html += `<div class="cell time-axis${periodStart ? ' period-start' : ''}${periodLine ? ' period-line' : ''}" style="grid-column:1;grid-row:${i + 1} / ${i + 3}">
        ${periodStart ? `<i class="ta-period">${period}</i>` : ''}
        <div class="ta-line"><span>${fmtMin(a)}-${fmtMin(b2)}</span></div></div>`;
      i++;
      continue;
    }
    html += `<div class="cell time-axis${periodStart ? ' period-start' : ''}${periodLine ? ' period-line' : ''}" style="grid-column:1;grid-row:${i + 1}">
      ${periodStart ? `<i class="ta-period">${period}</i>` : ''}
      <div class="ta-line"><span>${fmtMin(a)}-${fmtMin(b)}</span></div></div>`;
  }
  for (let r = 0; r < slotCount; r++) {
    const [ra] = parseSlotTime(state.meta.slotTimes[r]);
    const rp = slotPeriod(ra);
    const rPrev = r > 0 ? slotPeriod(parseSlotTime(state.meta.slotTimes[r - 1])[0]) : '';
    const rLine = rp !== rPrev && r > 0;
    const mergedPair = pairMode && r % 2 === 0 && r + 1 < slotCount;   /* 大学模式：空格也按双节合并成一大格 */
    if (mergedPair) {
      const [, b2] = parseSlotTime(state.meta.slotTimes[r + 1]);
      for (let c = 0; c < 7; c++) {
        let cls = 'cell empty' + (rLine ? ' period-line' : '');
        if (c >= 5) cls += ' weekend-col';
        if (scheduleOverrideForDate(addDays(start, c))) cls += ' adjusted-col';
        if (todayInView && c === todayWd) {
          cls += ' today-col';
          if (nowMin >= ra && nowMin < b2) cls += ' now-slot';
        }
        html += `<div class="${cls}" style="grid-column:${c + 2};grid-row:${r + 1} / ${r + 3}" data-wd="${c}" data-slot="${r}"></div>`;
      }
      r++;   /* 跳过配对行 */
      continue;
    }
    for (let c = 0; c < 7; c++) {
      let cls = 'cell empty' + (rLine ? ' period-line' : '');
      if (c >= 5) cls += ' weekend-col';
      if (scheduleOverrideForDate(addDays(start, c))) cls += ' adjusted-col';
      if (todayInView && c === todayWd) {
        cls += ' today-col';
        const [a, b] = parseSlotTime(state.meta.slotTimes[r]);
        if (nowMin >= a && nowMin < b) cls += ' now-slot';
      }
      html += `<div class="${cls}" style="grid-column:${c + 2};grid-row:${r + 1}" data-wd="${c}" data-slot="${r}"></div>`;
    }
  }
  g.innerHTML = html;
  g.querySelectorAll('.cell.empty').forEach(el => {
    el.addEventListener('click', () => openCourseModal(null, +el.dataset.wd, +el.dataset.slot));
    el.addEventListener('contextmenu', ev => openScheduleContextMenu(ev, [
      { label: copiedCourse ? `粘贴「${copiedCourse.name}」` : '暂无已复制课程', disabled: !copiedCourse, action: () => pasteCourse(+el.dataset.wd, +el.dataset.slot) },
      { label: '新增课程', action: () => openCourseModal(null, +el.dataset.wd, +el.dataset.slot) },
    ]));
  });

  const displayCourses = [];
  for (let column = 0; column < 7; column++) {
    const targetDate = addDays(start, column);
    const sourceWeekday = scheduleWeekdayForDate(targetDate);
    const sourceWeek = scheduleWeekForDate(targetDate, w);
    const override = scheduleOverrideForDate(targetDate);
    state.courses
      .filter(course => course.weekday === sourceWeekday && courseInWeek(course, sourceWeek))
      .forEach(course => displayCourses.push({ course, column, targetDate, override }));
  }
  for (const entry of displayCourses) {
    const c = entry.course;
    let s = c.startSlot - 1, e = c.endSlot - 1;
    if (s < 0) s = 0;
    if (e >= slotCount) e = slotCount - 1;
    if (s > e) continue;
    const inTodayCol = todayInView && entry.column === todayWd;
    const el = document.createElement('div');
    el.className = 'course-block' + (inTodayCol ? ' today' : '') + (entry.override ? ' adjusted' : '');
    el.style.gridColumn = String(entry.column + 2);
    el.style.gridRow = `${s + 1} / ${e + 2}`;   // grid 无表头行：起始行 = 起始节次
    el.style.setProperty('--cb', c.color || 'var(--p)');
    const loc = c.room || '';   // 色块内只展示课程名 + 教室
    el.innerHTML = `<div class="cb-name">${cbNameLines(c.name)}</div>
      ${loc ? `<div class="cb-sub">${esc(loc)}</div>` : ''}`;
    el.title = `${c.name}${c.room ? ' · ' + c.room : ''}${c.teacher ? ' · ' + c.teacher : ''}${entry.override ? ` · 调休至${strFromDate(entry.targetDate)}` : ''}`;
    el.addEventListener('click', ev => { ev.stopPropagation(); openCourseDetailModal(c); });
    el.addEventListener('contextmenu', ev => openScheduleContextMenu(ev, [
      { label: '复制课程', action: () => copyCourse(c) },
      { label: '编辑课程', action: () => openCourseModal(c) },
    ]));
    g.appendChild(el);
  }
  byId('schedule-hint').textContent = displayCourses.length
    ? '点击课程查看详情 · 右键课程复制，右键空白格粘贴'
    : '本周暂无课程 · 点击空白格添加，右键可粘贴';
}

/* ─────────────── 渲染：今日页 / 倒数日 ─────────────── */
function renderTodayList() {
  const list = byId('today-list');
  const today = new Date();
  const w = scheduleWeekForDate(today, effectiveWeek());
  const todayWd = scheduleWeekdayForDate(today);
  const items = state.courses
    .filter(c => c.weekday === todayWd && courseInWeek(c, w))
    .sort((a, b) => a.startSlot - b.startSlot);
  if (!items.length) {
    list.innerHTML = '<div class="empty-state">今天没有课 🎉<br>去「课表」页看看其他安排</div>';
    return;
  }
  list.innerHTML = items.map(c => {
    const t = state.meta.slotTimes[c.startSlot - 1] || '00:00-00:00';
    const [s, e] = parseSlotTime(t);
    const badge = c.weeks && c.weeks.mode === 'odd' ? '单周'
      : c.weeks && c.weeks.mode === 'even' ? '双周'
      : c.weeks && c.weeks.mode === 'custom' ? `第${c.weeks.list.join('/')}周` : '';
    return `<div class="tcard" data-id="${c.id}">
      <div class="tc-bar" style="background:${esc(c.color || 'var(--p)')}"></div>
      <div class="tc-time"><b>第${c.startSlot}节</b><span>${fmtMin(s)}–${fmtMin(e)}</span></div>
      <div class="tc-main">
        <div class="tc-name">${esc(c.name)}${badge ? `<span class="tc-badge">${esc(badge)}</span>` : ''}</div>
        <div class="tc-sub">${esc([c.room, c.teacher].filter(Boolean).join(' · ') || '未填写教室 / 教师')}</div>
      </div>
    </div>`;
  }).join('');
  list.querySelectorAll('.tcard').forEach(el => {
    el.addEventListener('click', () => {
      const c = state.courses.find(x => x.id === el.dataset.id);
      if (c) openCourseModal(c);
    });
  });
}
function renderAdjustmentBanner() {
  const el = byId('today-adjustment');
  if (!el) return;
  const item = scheduleOverrideForDate(new Date());
  if (!item) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.textContent = `今日调休 · 按 ${scheduleOverrideText(item)} 的课程上课`;
}
/* 倒数日：支持精确到分钟 */
function countdownDateTime(cd) {
  const d = dateFromStr(cd.date);
  if (!isNaN(d.getTime()) && cd.time) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(cd.time));
    if (m) d.setHours(+m[1], +m[2], 0, 0);
  }
  return d;
}
function countdownRemainMs(cd) { return countdownDateTime(cd).getTime() - Date.now(); }
function fmtRemain(ms) {
  if (!(ms >= 0)) return null;
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return days + ' 天 ' + hours + ' 小时';
  if (hours > 0) return hours + ' 小时 ' + mins + ' 分';
  return mins + ' 分';
}
/* 倒计时页顶部：下一个倒数任务卡（不再重复课程的下一节课） */
function renderNextCountdownCard() {
  const el = byId('cd-next-card');
  if (!el) return;
  if (!state.countdowns.length) {
    el.className = 'next-card nc-none';
    el.innerHTML = '<div class="nc-label">倒数日</div><div class="nc-time">暂无倒数任务</div><div class="nc-meta">点击右下角 ＋ 添加考试、任务或纪念日</div>';
    return;
  }
  const future = state.countdowns.filter(cd => countdownRemainMs(cd) >= 0).sort((a, b) => countdownRemainMs(a) - countdownRemainMs(b));
  const pick = future[0] || [...state.countdowns].sort((a, b) => countdownRemainMs(b) - countdownRemainMs(a))[0];
  const ms = countdownRemainMs(pick);
  const d = countdownDateTime(pick);
  const remain = fmtRemain(ms) || '已到达';
  const when = (d.getMonth() + 1) + '/' + d.getDate() + ' ' + WEEKDAYS[(d.getDay() + 6) % 7] + (pick.time ? ' ' + pick.time : '');
  el.className = 'next-card';
  el.innerHTML = '<div class="nc-label">' + (ms >= 0 ? '下一个倒数日 · 距离任务' : '最近的倒数日 · 已过') + '</div>' +
    '<div class="nc-time">' + remain + '</div>' +
    '<div class="nc-name">' + esc(pick.title) + '</div>' +
    '<div class="nc-meta">' + esc(when) + (pick.note ? ' · ' + esc(pick.note) : '') + '</div>' +
    '<div class="nc-state">' + esc(d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() + (pick.time ? ' ' + pick.time : '')) + '</div>';
}
let cdDragLock = 0;
function renderCdList() {
  const list = byId('cd-list');
  const warn = Math.max(0, parseInt(state.meta.countdownWarn, 10) || 3);
  const warnOn = state.meta.countdownWarnOn !== false;
  const manual = !!state.meta.countdownManual;
  const items = manual ? [...state.countdowns] : [...state.countdowns].sort((a, b) => countdownDateTime(a) - countdownDateTime(b));
  if (!items.length) {
    list.innerHTML = '<div class="empty-state">暂无倒数日<br>点击右下角 ＋ 添加考试、任务或纪念日</div>';
    return;
  }
  list.innerHTML = items.map(cd => {
    const d = countdownDateTime(cd);
    const ms = countdownRemainMs(cd);
    const days = Math.floor(ms / 86400000);
    const warnHit = warnOn && ms >= 0 && days < warn;
    const hours = Math.floor((ms % 86400000) / 3600000);
    let badge, cls;
    if (ms < 0) { badge = '已过 ' + Math.max(1, Math.round(-ms / 86400000)) + ' 天'; cls = 'done'; }
    else if (days === 0) { badge = '今天'; cls = 'today'; }
    else { badge = (cd.time && warnHit) ? ('还有 ' + days + ' 天 ' + hours + ' 小时') : ('还有 ' + days + ' 天'); cls = ''; }
    const wd = WEEKDAYS[(d.getDay() + 6) % 7];
    const color = cd.color || PALETTE[items.indexOf(cd) % PALETTE.length];
    return '<div class="cd-card' + (warnHit ? ' warn' : '') + '" style="--cd:' + color + '" data-id="' + cd.id + '">' +
      '<div class="cd-date"><b>' + (d.getMonth() + 1) + '/' + d.getDate() + '</b><span>' + wd + (cd.time ? ' ' + esc(cd.time) : '') + '</span></div>' +
      '<div class="cd-main"><div class="cd-title">' + esc(cd.title) + '</div>' + (cd.note ? '<div class="cd-note">' + esc(cd.note) + '</div>' : '') + '</div>' +
      '<div class="cd-days ' + cls + '">' + badge + '</div>' +
      '</div>';
  }).join('');
  list.querySelectorAll('.cd-card').forEach(el => {
    el.addEventListener('click', () => {
      if (Date.now() - cdDragLock < 400) return;
      const cd = state.countdowns.find(x => x.id === el.dataset.id);
      if (cd) openCountdownModal(cd);
    });
  });
  renderNextCountdownCard();
}
/* 长按（约 0.45s）拖动换位；手动排序后保存，不再自动按时间排 */
function bindCountdownReorder(list) {
  let drag = null, timer = null, startX = 0, startY = 0;
  function cleanup() {
    clearTimeout(timer);
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onCancel);
  }
  function onCancel() { if (drag) { drag.card.classList.remove('dragging'); drag.card.style.transform = ''; } drag = null; cleanup(); }
  function onMove(ev) {
    if (!drag) {
      if (Math.abs(ev.clientX - startX) > 8 || Math.abs(ev.clientY - startY) > 8) clearTimeout(timer);
      return;
    }
    ev.preventDefault();
    drag.card.style.transform = 'translateY(' + (ev.clientY - drag.startY) + 'px)';
  }
  function onUp(ev) {
    if (!drag) { cleanup(); return; }
    const dy = ev.clientY - drag.startY;
    const card = drag.card;
    const siblings = [...list.children].filter(c => c !== card);
    const midY = card.getBoundingClientRect().top + card.offsetHeight / 2 + dy;
    let insertBefore = null;
    for (const c of siblings) {
      const r = c.getBoundingClientRect();
      if (midY < r.top + r.height / 2) { insertBefore = c; break; }
    }
    card.classList.remove('dragging');
    card.style.transform = '';
    const ids = siblings.map(c => c.dataset.id);
    const toIndex = insertBefore ? ids.indexOf(insertBefore.dataset.id) : ids.length;
    ids.splice(toIndex, 0, card.dataset.id);
    const byIdMap = {};
    state.countdowns.forEach(cd => { byIdMap[cd.id] = cd; });
    state.countdowns = ids.map(id => byIdMap[id]).filter(Boolean);
    state.meta.countdownManual = true;
    saveState(); renderCdList(); toast('已调整顺序');
    cdDragLock = Date.now();
    drag = null;
    cleanup();
  }
  list.addEventListener('pointerdown', ev => {
    const card = ev.target.closest('.cd-card');
    if (!card || card.classList.contains('dragging')) return;
    startX = ev.clientX; startY = ev.clientY;
    timer = setTimeout(() => {
      drag = { card, startY };
      card.classList.add('dragging');
      try { if (navigator.vibrate) navigator.vibrate(15); } catch (e) {}
    }, 450);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
  });
}

/* ─────────────── 弹层：课程编辑 ─────────────── */
function openCourseModal(course, prefWd, prefSlot) {
  const isEdit = !!course;
  const c = course ? { ...course } : {
    id: uid(), name: '', room: '', teacher: '', note: '',
    weekday: prefWd != null ? prefWd : 0,
    startSlot: prefSlot != null ? prefSlot + 1 : 1,
    endSlot: prefSlot != null ? Math.min(prefSlot + 2, state.meta.slotTimes.length) : Math.min(2, state.meta.slotTimes.length),
    weeks: { mode: 'all', list: [] },
    color: PALETTE[state.courses.length % PALETTE.length],
  };
  let wm = (c.weeks && c.weeks.mode) || 'all';
  const wl = new Set((c.weeks && c.weeks.list) || []);
  let curColor = c.color || PALETTE[0];
  const slotCount = state.meta.slotTimes.length;
  const slotOpts = state.meta.slotTimes.map((t, i) => `<option value="${i + 1}">第${i + 1}节 ${t}</option>`).join('');
  const weekBtns = WEEKDAYS.map((d, i) => `<button type="button" class="${i === c.weekday ? 'active' : ''}" data-wd="${i}">${d}</button>`).join('');
  const colorDots = PALETTE.map(cl => `<button type="button" class="color-dot${cl === curColor ? ' active' : ''}" data-color="${cl}" style="background:${cl}"></button>`).join('');

  openModal(`<div class="modal-head"><h3>${isEdit ? '编辑课程' : '新增课程'}</h3><button class="modal-close" id="m-close">✕</button></div>
    <div class="modal-body">
      <div class="field"><label>课程名称 *</label><input type="text" id="c-name" placeholder="如：高等数学" value="${esc(c.name)}"></div>
      <div class="field-row">
        <div class="field"><label>教室</label><input type="text" id="c-room" placeholder="如：A-101" value="${esc(c.room)}"></div>
        <div class="field"><label>教师</label><input type="text" id="c-teacher" placeholder="如：张老师" value="${esc(c.teacher)}"></div>
      </div>
      <div class="field"><label>备注</label><input type="text" id="c-note" placeholder="选填，如：单双周、实验课" value="${esc(c.note)}"></div>
      <div class="field"><label>星期</label><div class="week-seg" id="c-week-seg">${weekBtns}</div></div>
      <div class="field"><label>时间段</label><div class="slot-selects"><select id="c-start">${slotOpts}</select><span>至</span><select id="c-end">${slotOpts}</select></div></div>
      <div class="field"><label>重复周次</label>
        <div class="week-seg" id="c-weeks-seg">
          <button type="button" data-m="all" class="active">每周</button>
          <button type="button" data-m="odd">单周</button>
          <button type="button" data-m="even">双周</button>
          <button type="button" data-m="custom">自定义</button>
        </div>
        <div class="week-grid" id="c-weeks-grid" style="display:none"></div>
      </div>
      <div class="field"><label>颜色标签</label><div class="color-row" id="c-colors">${colorDots}<input type="color" id="c-color-custom" value="${esc(curColor)}"></div></div>
    </div>
    <div class="modal-foot">${isEdit ? '<button class="btn danger" id="c-del">删除</button>' : ''}<button class="btn ghost" id="m-cancel">取消</button><button class="btn primary" id="c-save">保存</button></div>`);

  byId('c-start').value = c.startSlot;
  byId('c-end').value = c.endSlot;
  /* 大学模式：节次自动对齐双节（开始落到奇数节对首，结束跟随下一节，可手动微调） */
  if (state.meta.timeMode === 'pair') {
    let sv = +byId('c-start').value;
    if (sv % 2 === 0 && sv < slotCount) { sv = sv - 1; byId('c-start').value = sv; }
    byId('c-end').value = Math.min(sv + 1, slotCount);
    byId('c-start').onchange = () => {
      let v2 = +byId('c-start').value;
      if (v2 % 2 === 0 && v2 < slotCount) { v2 = v2 - 1; byId('c-start').value = v2; }
      byId('c-end').value = Math.min(v2 + 1, slotCount);
    };
  }

  document.querySelectorAll('#c-week-seg button').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('#c-week-seg button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    };
  });

  const seg = byId('c-weeks-seg');
  const grid = byId('c-weeks-grid');
  function refreshWeeksUI() {
    seg.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.m === wm));
    grid.style.display = wm === 'custom' ? 'grid' : 'none';
    if (wm === 'custom') {
      let h = '';
      for (let i = 1; i <= state.meta.totalWeeks; i++) h += `<button type="button" class="${wl.has(i) ? 'on' : ''}" data-wk="${i}">${i}</button>`;
      grid.innerHTML = h;
      grid.querySelectorAll('button').forEach(b => {
        b.onclick = () => {
          const wk = +b.dataset.wk;
          wl.has(wk) ? wl.delete(wk) : wl.add(wk);
          b.classList.toggle('on');
        };
      });
    }
  }
  seg.querySelectorAll('button').forEach(b => { b.onclick = () => { wm = b.dataset.m; refreshWeeksUI(); }; });
  refreshWeeksUI();

  const colorRow = byId('c-colors');
  function refreshColors() {
    colorRow.querySelectorAll('.color-dot').forEach(d => d.classList.toggle('active', d.dataset.color === curColor));
  }
  colorRow.querySelectorAll('.color-dot').forEach(d => { d.onclick = () => { curColor = d.dataset.color; refreshColors(); }; });
  byId('c-color-custom').oninput = e => { curColor = e.target.value; refreshColors(); };

  byId('c-save').onclick = () => {
    const name = byId('c-name').value.trim();
    if (!name) { toast('请填写课程名称'); return; }
    const s = +byId('c-start').value, e = +byId('c-end').value;
    if (e < s) { toast('结束节次不能早于开始节次'); return; }
    const course = {
      id: c.id, name,
      room: byId('c-room').value.trim(),
      teacher: byId('c-teacher').value.trim(),
      note: byId('c-note').value.trim(),
      weekday: +document.querySelector('#c-week-seg button.active').dataset.wd,
      startSlot: s, endSlot: e,
      weeks: { mode: wm, list: [...wl].sort((a, b) => a - b) },
      color: curColor,
    };
    const idx = state.courses.findIndex(x => x.id === course.id);
    if (idx >= 0) state.courses[idx] = course; else state.courses.push(course);
    saveState(); closeModal(); renderAll(); toast('已保存');
  };
  if (isEdit) {
    byId('c-del').onclick = () => {
      openConfirm('删除课程', `确定删除「${c.name}」？`, [{ label: '删除', danger: true, val: 'del' }], () => {
        state.courses = state.courses.filter(x => x.id !== c.id);
        saveState(); renderAll(); toast('已删除');
      });
    };
  }
}

/* 周次描述 */
function describeWeeks(weeks) {
  if (!weeks || !weeks.mode || weeks.mode === 'all') return '每周';
  if (weeks.mode === 'odd') return '单周';
  if (weeks.mode === 'even') return '双周';
  if (Array.isArray(weeks.list) && weeks.list.length) return '第' + weeks.list.join('、') + '周';
  return '每周';
}

/* ─────────────── 弹层：课程详情（只读，点击课程卡弹出，含老师/周次/备注） ─────────────── */
function openCourseDetailModal(course) {
  const w = effectiveWeek();
  const t1 = state.meta.slotTimes[course.startSlot - 1] || '';
  const t2 = state.meta.slotTimes[course.endSlot - 1] || '';
  const slotDesc = course.startSlot === course.endSlot
    ? '第' + course.startSlot + '节 ' + t1
    : '第' + course.startSlot + '-' + course.endSlot + '节 ' + t1 + ' ~ ' + t2;
  const rows = [
    ['星期', WEEKDAYS[course.weekday] || ''],
    ['节次', slotDesc],
    ['周次', describeWeeks(course.weeks)],
    ['教室', course.room || '未填写'],
    ['教师', course.teacher || '未填写'],
  ];
  if (course.note) rows.push(['备注', course.note]);
  const weekIn = courseInWeek(course, w);
  const rowHtml = rows.map(r => '<div class="detail-row"><span class="dr-label">' + r[0] + '</span><span class="dr-value">' + esc(r[1]) + '</span></div>').join('');
  openModal(
    '<div class="modal-head"><h3>课程详情</h3><button class="modal-close" id="m-close">✕</button></div>' +
    '<div class="modal-body">' +
      '<div class="detail-name" style="color:' + esc(course.color || 'var(--p)') + '">' + esc(course.name) + '</div>' +
      '<div class="detail-badge' + (weekIn ? ' in' : '') + '">' + (weekIn ? '本' + w + '周有课' : '本' + w + '周无课') + '</div>' +
      '<div class="detail-rows">' + rowHtml + '</div>' +
    '</div>' +
    '<div class="modal-foot">' +
      '<button class="btn danger" id="d-del">删除</button>' +
      '<button class="btn ghost" id="m-cancel">关闭</button>' +
      '<button class="btn primary" id="d-edit">编辑</button>' +
    '</div>'
  );
  byId('d-edit').onclick = () => openCourseModal(course);
  byId('d-del').onclick = () => {
    openConfirm('删除课程', '确定删除「' + course.name + '」？', [{ label: '删除', danger: true, val: 'del' }], () => {
      state.courses = state.courses.filter(x => x.id !== course.id);
      saveState(); closeModal(); renderAll(); toast('已删除');
    });
  };
}

/* ─────────────── 弹层：倒数日编辑 ─────────────── */
function openCountdownModal(cd) {
  const isEdit = !!cd;
  const title = cd ? cd.title : '';
  const date = cd ? cd.date : strFromDate(addDays(new Date(), 7));
  const time = cd ? (cd.time || '') : '';
  const note = cd ? (cd.note || '') : '';
  const curColor = cd ? (cd.color || PALETTE[state.countdowns.indexOf(cd) % PALETTE.length]) : PALETTE[state.countdowns.length % PALETTE.length];
  const colorDots = PALETTE.map(cl => `<button type="button" class="color-dot${cl === curColor ? ' active' : ''}" data-color="${cl}" style="background:${cl}"></button>`).join('');
  openModal(`<div class="modal-head"><h3>${isEdit ? '编辑倒数日' : '新增倒数日'}</h3><button class="modal-close" id="m-close">✕</button></div>
    <div class="modal-body">
      <div class="field"><label>标题 *</label><input type="text" id="cd-title" placeholder="如：期中考试" value="${esc(title)}"></div>
      <div class="field"><label>目标日期 *</label><input type="date" id="cd-date" value="${esc(date)}"></div>
      <div class="field"><label>目标时间（选填）</label><input type="time" id="cd-time" value="${esc(time)}"><span class="field-hint">精确到分钟，留空则按整天计算</span></div>
      <div class="field"><label>备注</label><input type="text" id="cd-note" placeholder="选填，如：高等数学" value="${esc(note)}"></div>
      <div class="field"><label>颜色标签</label><div class="color-row" id="cd-colors">${colorDots}<input type="color" id="cd-color-custom" value="${esc(curColor)}"></div></div>
    </div>
    <div class="modal-foot">${isEdit ? '<button class="btn danger" id="cd-del">删除</button>' : ''}<button class="btn ghost" id="m-cancel">取消</button><button class="btn primary" id="cd-save">保存</button></div>`);
  const colorRow = byId('cd-colors');
  function refreshColors() {
    colorRow.querySelectorAll('.color-dot').forEach(d => d.classList.toggle('active', d.dataset.color === curColor));
  }
  colorRow.querySelectorAll('.color-dot').forEach(d => { d.onclick = () => { curColor = d.dataset.color; refreshColors(); }; });
  byId('cd-color-custom').oninput = e => { curColor = e.target.value; refreshColors(); };

  byId('cd-save').onclick = () => {
    const t = byId('cd-title').value.trim();
    const dt = byId('cd-date').value;
    if (!t) { toast('请填写标题'); return; }
    if (!dt) { toast('请选择目标日期'); return; }
    if (isEdit) {
      const c = state.countdowns.find(x => x.id === cd.id);
      if (c) { c.title = t; c.date = dt; c.time = byId('cd-time').value || ''; c.note = byId('cd-note').value.trim(); c.color = curColor; }
    } else {
      state.countdowns.push({ id: uid(), title: t, date: dt, time: byId('cd-time').value || '', note: byId('cd-note').value.trim(), color: curColor });
    }
    saveState(); closeModal(); renderAll(); toast('已保存');
  };
  if (isEdit) {
    byId('cd-del').onclick = () => {
      openConfirm('删除倒数日', `确定删除「${cd.title}」？`, [{ label: '删除', danger: true, val: 'del' }], () => {
        state.countdowns = state.countdowns.filter(x => x.id !== cd.id);
        saveState(); renderAll(); toast('已删除');
      });
    };
  }
}

/* ─────────────── 弹层：周数选择 ─────────────── */
function openWeekPicker() {
  const w = effectiveWeek();
  const N = state.meta.totalWeeks;
  let h = '';
  for (let i = 1; i <= N; i++) h += `<button type="button" class="${i === w ? 'on' : ''}" data-w="${i}">第${i}周</button>`;
  openModal(`<div class="modal-head"><h3>选择周数</h3><button class="modal-close" id="m-close">✕</button></div>
    <div class="modal-body"><div class="week-grid" style="grid-template-columns:repeat(4,1fr)">${h}</div></div>
    <div class="modal-foot"><button class="btn ghost" id="m-cancel">取消</button><button class="btn primary" id="wk-auto">跟随本周</button></div>`);
  document.querySelectorAll('.modal-body .week-grid button').forEach(b => {
    b.onclick = () => {
      state.meta.currentWeek = +b.dataset.w;
      state.meta.weekMode = 'manual';
      saveState(); closeModal(); renderAll();
    };
  });
  byId('wk-auto').onclick = () => {
    state.meta.weekMode = 'auto';
    saveState(); closeModal(); renderAll(); toast('已跟随本周');
  };
}






/* ─────────────── 上课提醒 ─────────────── */
function checkReminders() {
  if (!state.meta.remind) return;
  const now = new Date();
  const todayKey = strFromDate(now);
  state.meta.notified = state.meta.notified.filter(k => k.startsWith(todayKey));
  const w = scheduleWeekForDate(now, effectiveWeek());
  const min = state.meta.remindMinutes;
  const todayWd = scheduleWeekdayForDate(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let changed = false;
  for (const c of state.courses) {
    if (c.weekday !== todayWd || !courseInWeek(c, w)) continue;
    const t = state.meta.slotTimes[c.startSlot - 1];
    if (!t) continue;
    const [s] = parseSlotTime(t);
    const key = todayKey + ':' + c.id;
    if (nowMin >= s - min && nowMin < s && state.meta.notified.indexOf(key) < 0) {
      state.meta.notified.push(key);
      changed = true;
      const msg = `${c.name}${c.room ? ' · ' + c.room : ''}${c.teacher ? ' · ' + c.teacher : ''} ${fmtMin(s)} 上课`;
      toast('⏰ ' + msg);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try { new Notification('极简课表 · 即将上课', { body: msg }); } catch (e) {}
      }
    }
  }
  if (changed) saveState();
}

/* ─────────────── 设置页渲染 ─────────────── */
function renderSlotEditor() {
  const list = byId('slot-editor-list');
  list.innerHTML = state.meta.slotTimes.map((t, i) => {
    const [a, b] = t.split('-');
    return `<div class="slot-row"><span class="sl-label">第${i + 1}节</span><input type="time" value="${esc(a)}"><span>–</span><input type="time" value="${esc(b)}"><button class="sl-del" data-i="${i}">✕</button></div>`;
  }).join('');
  list.querySelectorAll('.sl-del').forEach(b => {
    b.addEventListener('click', () => {
      if (state.meta.slotTimes.length <= 1) { toast('至少保留一节'); return; }
      state.meta.slotTimes.splice(+b.dataset.i, 1);
      saveState(); renderSlotEditor(); renderSchedule();
    });
  });
}
function renderScheduleOverrides() {
  const list = byId('set-adjust-list');
  if (!list) return;
  const items = [...(state.meta.scheduleOverrides || [])].sort((a, b) => a.date.localeCompare(b.date));
  list.innerHTML = items.length ? items.map(x => `<div class="adjust-item">
    <span><b>${esc(x.date)}</b><small>按 ${esc(scheduleOverrideText(x))} 的课程上课${x.sourceDate ? '' : '（旧配置）'}</small></span>
    <button type="button" class="sl-del" data-date="${esc(x.date)}" aria-label="删除${esc(x.date)}调休">✕</button>
  </div>`).join('') : '<div class="adjust-empty">暂无调休安排</div>';
}
function refreshSettings() {
  byId('set-semester-start').value = state.meta.semesterStart;
  byId('set-total-weeks').value = state.meta.totalWeeks;
  byId('set-current-week').value = state.meta.currentWeek;
  byId('set-remind').checked = state.meta.remind;
  byId('set-remind-minutes').value = state.meta.remindMinutes;
  byId('set-remind-minutes').disabled = !state.meta.remind;
  byId('set-accent').value = state.meta.accent || (THEMES[state.meta.theme] || THEMES.blue).primary;
  document.querySelectorAll('#set-week-mode button').forEach(b => b.classList.toggle('active', b.dataset.v === state.meta.weekMode));
  byId('set-week-row').style.display = state.meta.weekMode === 'manual' ? 'flex' : 'none';
  document.querySelectorAll('#set-dark button').forEach(b => b.classList.toggle('active', b.dataset.v === state.meta.dark));
  document.querySelectorAll('#set-time-mode button').forEach(b => b.classList.toggle('active', b.dataset.v === (state.meta.timeMode || 'pair')));
  const cw = byId('set-countdown-warn');
  if (cw) cw.value = state.meta.countdownWarn != null ? state.meta.countdownWarn : 3;
  const cwo = byId('set-countdown-warn-on');
  if (cwo) { cwo.checked = state.meta.countdownWarnOn !== false; cw.disabled = !cwo.checked; }
  const ste = byId('slot-editor-toggle-label');
  if (ste) ste.textContent = state.meta.slotTimes.length + ' 节 · 展开编辑';
  const adjustDate = byId('set-adjust-date');
  if (adjustDate && !adjustDate.value) adjustDate.value = strFromDate(new Date());
  const adjustSourceDate = byId('set-adjust-source-date');
  if (adjustSourceDate && !adjustSourceDate.value) adjustSourceDate.value = strFromDate(new Date());
  byId('set-theme-swatches').innerHTML = Object.keys(THEMES).map(k =>
    `<button class="swatch${k === state.meta.theme ? ' active' : ''}" data-theme="${k}" style="background:${THEMES[k].primary}"><span class="sw-name">${THEMES[k].name}</span></button>`).join('');
  const nb = byId('set-btn-notify');
  if (typeof Notification !== 'undefined') {
    const p = Notification.permission;
    if (p === 'granted') { nb.textContent = '通知已开启 ✓'; nb.disabled = true; nb.style.opacity = .5; }
    else if (p === 'denied') { nb.textContent = '通知被拒绝，请在浏览器设置中开启'; nb.disabled = true; nb.style.opacity = .5; }
    else { nb.textContent = '开启通知权限'; nb.disabled = false; nb.style.opacity = 1; }
  } else {
    nb.textContent = '当前环境不支持通知';
    nb.disabled = true; nb.style.opacity = .5;
  }
  renderSlotEditor();
  renderScheduleOverrides();
}

/* ─────────────── 视图切换 ─────────────── */
function switchTab(name) {
  currentTab = name;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  renderAll();
}

/* ─────────────── 渲染总入口 ─────────────── */
function renderAll() {
  renderWeekLabel();
  renderSchedule();
  renderTodayList();
  renderAdjustmentBanner();
  renderCdList();
  updateNextBanners();
  refreshSettings();
}

/* ─────────────── 事件绑定 ─────────────── */
function bindEvents() {
  /* 视图切换 */
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.view)));

  /* 周数 */
  byId('week-prev').onclick = () => { state.meta.weekMode = 'manual'; state.meta.currentWeek = Math.max(1, effectiveWeek() - 1); saveState(); renderAll(); };
  byId('week-next').onclick = () => { state.meta.weekMode = 'manual'; state.meta.currentWeek = Math.min(state.meta.totalWeeks, effectiveWeek() + 1); saveState(); renderAll(); };
  byId('week-label').onclick = openWeekPicker;
  byId('btn-today').onclick = () => { state.meta.weekMode = 'auto'; saveState(); renderAll(); toast('已回到本周'); };

  /* 设置：外观 */
  byId('set-theme-swatches').addEventListener('click', e => {
    const b = e.target.closest('[data-theme]');
    if (!b) return;
    state.meta.theme = b.dataset.theme;
    saveState(); applyTheme(); refreshSettings();
  });
  byId('set-accent').oninput = e => { state.meta.accent = e.target.value; saveState(); applyTheme(); };
  byId('set-accent-reset').onclick = () => { state.meta.accent = ''; saveState(); applyTheme(); refreshSettings(); };
  document.querySelectorAll('#set-dark button').forEach(b => {
    b.onclick = () => { state.meta.dark = b.dataset.v; saveState(); applyTheme(); refreshSettings(); };
  });
  /* 时间显示模式：大学（双节合并）/ 中学（每节单独） */
  document.querySelectorAll('#set-time-mode button').forEach(b => {
    b.onclick = () => { state.meta.timeMode = b.dataset.v; saveState(); refreshSettings(); renderSchedule(); };
  });
  /* 倒数预警：开关 + 天数 */
  byId('set-countdown-warn-on').onchange = e => {
    state.meta.countdownWarnOn = e.target.checked;
    saveState(); renderAll();
  };
  byId('set-countdown-warn').onchange = e => {
    let v = parseInt(e.target.value, 10);
    if (!(v >= 0)) v = 0;
    if (v > 365) v = 365;
    state.meta.countdownWarn = v;
    saveState(); renderAll();
  };
  /* 节次时间：折叠 / 展开 */
  byId('slot-editor-toggle').onclick = () => {
    const panel = byId('slot-editor-panel');
    const open = panel.style.display !== 'none';
    panel.style.display = open ? 'none' : 'block';
    byId('slot-editor-toggle').classList.toggle('open', !open);
    if (open) byId('slot-editor-toggle').scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  /* 倒数日：长按拖动换位 */
  bindCountdownReorder(byId('cd-list'));

  /* 设置：学期与周数 */
  byId('set-semester-start').onchange = e => {
    const v = e.target.value;
    if (!v || isNaN(dateFromStr(v).getTime())) { toast('日期无效'); refreshSettings(); return; }
    state.meta.semesterStart = v;
    saveState(); renderAll();
  };
  byId('set-total-weeks').onchange = e => {
    let v = parseInt(e.target.value, 10);
    if (!(v >= 4)) v = 4;
    if (v > 30) v = 30;
    state.meta.totalWeeks = v;
    saveState(); renderAll();
  };
  document.querySelectorAll('#set-week-mode button').forEach(b => {
    b.onclick = () => {
      state.meta.weekMode = b.dataset.v;
      if (b.dataset.v === 'manual') state.meta.currentWeek = effectiveWeek();
      saveState(); refreshSettings(); renderAll();
    };
  });
  byId('set-current-week').onchange = e => {
    let v = parseInt(e.target.value, 10);
    if (!(v >= 1)) v = 1;
    if (v > state.meta.totalWeeks) v = state.meta.totalWeeks;
    state.meta.currentWeek = v;
    saveState(); renderAll();
  };
  byId('set-btn-week-now').onclick = () => {
    state.meta.currentWeek = weekOfDate(new Date());
    state.meta.weekMode = 'manual';
    saveState(); refreshSettings(); renderAll(); toast('已设为本周');
  };
  byId('set-btn-week-reset').onclick = () => { state.meta.weekMode = 'auto'; saveState(); refreshSettings(); renderAll(); };

  /* 设置：调休安排 */
  byId('set-adjust-add').onclick = () => {
    const date = byId('set-adjust-date').value;
    const sourceDate = byId('set-adjust-source-date').value;
    if (!date || isNaN(dateFromStr(date).getTime())) { toast('请选择有效的调休日期'); return; }
    if (!sourceDate || isNaN(dateFromStr(sourceDate).getTime())) { toast('请选择有效的参照日期'); return; }
    const items = state.meta.scheduleOverrides || (state.meta.scheduleOverrides = []);
    const existing = items.find(x => x.date === date);
    if (existing) { existing.sourceDate = sourceDate; delete existing.weekday; }
    else items.push({ date, sourceDate });
    saveState(); renderAll(); toast(`已设置${date}按${sourceDate}的课程上课`);
  };
  byId('set-adjust-list').addEventListener('click', e => {
    const button = e.target.closest('[data-date]');
    if (!button) return;
    state.meta.scheduleOverrides = (state.meta.scheduleOverrides || []).filter(x => x.date !== button.dataset.date);
    saveState(); renderAll(); toast('已删除调休安排');
  });

  /* 设置：节次时间 */
  byId('slot-editor-add').onclick = () => {
    state.meta.slotTimes.push('08:00-08:45');
    saveState(); renderSlotEditor(); renderSchedule();
  };
  byId('slot-editor-reset').onclick = () => {
    state.meta.slotTimes = DEFAULT_SLOTS.slice();
    saveState(); renderSlotEditor(); renderSchedule();
  };
  byId('slot-editor-save').onclick = () => {
    const rows = document.querySelectorAll('#slot-editor-list .slot-row');
    const next = [];
    for (const r of rows) {
      const ins = r.querySelectorAll('input[type="time"]');
      const a = ins[0].value, b = ins[1].value;
      if (!a || !b) { toast('请补全节次时间'); return; }
      next.push(`${a}-${b}`);
    }
    state.meta.slotTimes = next;
    saveState(); renderAll(); toast('节次时间已保存');
  };

  /* 设置：提醒 */
  byId('set-remind').onchange = e => { state.meta.remind = e.target.checked; saveState(); };
  byId('set-remind-minutes').onchange = e => {
    let v = parseInt(e.target.value, 10);
    if (!(v >= 1)) v = 1;
    if (v > 1440) {
      toast('提醒时间不能超过一天（1440 分钟）');
      v = 1440;
      byId('set-remind-minutes').value = 1440;
    }
    state.meta.remindMinutes = v;
    saveState();
  };
  byId('set-btn-notify').onclick = async () => {
    if (typeof Notification === 'undefined') { toast('当前环境不支持系统通知'); return; }
    try {
      const p = await Notification.requestPermission();
      refreshSettings();
      toast(p === 'granted' ? '通知权限已开启' : '通知权限未开启');
    } catch (e) { toast('无法申请通知权限'); }
  };

  /* 设置：数据 */
  byId('btn-clear').onclick = () => {
    openConfirm('清空全部数据', '将删除所有课程与倒数日，且不可恢复。',
      [{ label: '清空', danger: true, val: 'clear' }], () => {
        state = defaultState();
        saveState(); renderAll(); toast('已清空');
      });
  };

  /* 倒数日新增 */
  byId('cd-add').onclick = () => openCountdownModal(null);

  /* ESC 关闭弹层（进度类弹层不可关闭除外） */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeScheduleContextMenu();
      if (byId('modal-root').dataset.closable !== '0') closeModal();
    }
  });
  document.addEventListener('pointerdown', e => {
    if (scheduleContextMenu && !scheduleContextMenu.contains(e.target)) closeScheduleContextMenu();
  });
  byId('schedule-scroll').addEventListener('scroll', closeScheduleContextMenu, { passive: true });
  window.addEventListener('blur', closeScheduleContextMenu);
}

/* ─────────────── 初始化 ─────────────── */
function init() {
  loadState();
  applyTheme();
  bindEvents();
  switchTab('today');
  renderAll();
  setInterval(updateNextBanners, 1000);
  setInterval(checkReminders, 30000);
  checkReminders();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}

/* 供 Node 环境单测导出的纯函数 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseSlotTime, toMin, fmtMin, strFromDate, dateFromStr, startOfDay, addDays,
    resolveWeekdayToken, cn2num, courseInWeek, describeWeeks, cloneCourseAt, adjustedWeekday,
  };
}
