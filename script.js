// First day at PlayAsia — change this if needed. Treated as Philippine time, 9am (time-in).
const START_DATE = new Date(Date.UTC(2026, 7, 19, 9, 0, 0)); // month is 0-indexed, so 7 = August

const PH_TIME_ZONE = 'Asia/Manila';

const PH_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: PH_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

// Everything in this file works with "pseudo-UTC" dates: a Date object whose
// UTC fields (getUTCHours, getUTCDate, etc.) hold the Philippine wall-clock
// values, regardless of what timezone the visitor's browser/device is in.
function nowInPH() {
  const map = {};
  PH_TIME_FORMATTER.formatToParts(new Date()).forEach((p) => { map[p.type] = p.value; });
  let hour = Number(map.hour);
  if (hour === 24) hour = 0; // some locales report midnight as "24"
  return new Date(Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second)
  ));
}

function startOfDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysBetween(a, b) {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round((startOfDay(b) - startOfDay(a)) / MS_PER_DAY);
}

function yearsMonthsDaysBetween(start, end) {
  let years = end.getUTCFullYear() - start.getUTCFullYear();
  let months = end.getUTCMonth() - start.getUTCMonth();
  let days = end.getUTCDate() - start.getUTCDate();

  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 0));
    days += prevMonth.getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

function isWeekday(date) {
  const dow = date.getUTCDay(); // 0 = Sunday, 6 = Saturday
  return dow !== 0 && dow !== 6;
}

// Work schedule (Philippine time): 9am–6pm, Mon–Fri, 1-hour lunch (1pm–2pm) = 8 paid hours/day.
const WORK_START_HOUR = 9;
const WORK_END_HOUR = 18;
const LUNCH_START_HOUR = 13;
const LUNCH_END_HOUR = 14;

// Hours actually worked on one calendar day (0 if weekend), live/partial if
// `now` falls on that same day: pauses before 9am, freezes through lunch,
// and caps out at 6pm. `dayCursor` must be a startOfDay() (midnight) value.
function hoursForDay(dayCursor, now) {
  if (!isWeekday(dayCursor)) return 0;

  const dayBase = startOfDay(dayCursor);
  const dayStart = new Date(dayBase); dayStart.setUTCHours(WORK_START_HOUR, 0, 0, 0);
  const dayEnd = new Date(dayBase); dayEnd.setUTCHours(WORK_END_HOUR, 0, 0, 0);
  const lunchStart = new Date(dayBase); lunchStart.setUTCHours(LUNCH_START_HOUR, 0, 0, 0);
  const lunchEnd = new Date(dayBase); lunchEnd.setUTCHours(LUNCH_END_HOUR, 0, 0, 0);

  const effectiveNow = now < dayStart ? dayStart : (now > dayEnd ? dayEnd : now);
  const grossMs = Math.max(0, effectiveNow - dayStart);

  const overlapStart = effectiveNow < lunchStart ? effectiveNow : lunchStart;
  const overlapEnd = effectiveNow < lunchEnd ? effectiveNow : lunchEnd;
  const lunchMs = Math.max(0, overlapEnd - overlapStart);

  return (grossMs - lunchMs) / (1000 * 60 * 60);
}

function isCurrentlyWorking(now) {
  if (!isWeekday(now)) return false;
  const hour = now.getUTCHours() + now.getUTCMinutes() / 60;
  const onLunch = hour >= LUNCH_START_HOUR && hour < LUNCH_END_HOUR;
  return hour >= WORK_START_HOUR && hour < WORK_END_HOUR && !onLunch;
}

// Splits a decimal hour total (today's worked hours, 0–8) into hrs/min/sec.
function formatHMS(totalHours) {
  let totalSeconds = Math.round(totalHours * 3600);
  const hours = Math.floor(totalSeconds / 3600);
  totalSeconds -= hours * 3600;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return { hours, minutes, seconds };
}

function render() {
  const today = nowInPH();
  const totalDays = daysBetween(START_DATE, today); // -1 vs. counting the start day itself
  const { years, months, days } = yearsMonthsDaysBetween(startOfDay(START_DATE), startOfDay(today));
  const totalHoursWorked = totalDays * 8;
  const working = isCurrentlyWorking(today);
  const live = formatHMS(hoursForDay(startOfDay(today), today));

  document.getElementById('dayNumber').textContent = totalDays.toLocaleString();
  document.getElementById('startDateText').textContent = START_DATE.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  document.getElementById('clock').textContent = today.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
  }) + ' PH time';

  document.getElementById('breakdown').innerHTML = `
    <div class="item"><span class="num">${years}</span><span class="unit">years</span></div>
    <div class="item"><span class="num">${months}</span><span class="unit">months</span></div>
    <div class="item"><span class="num">${days}</span><span class="unit">days</span></div>
  `;

  document.getElementById('hoursWorked').textContent = totalHoursWorked.toLocaleString('en-US', {
    maximumFractionDigits: 1,
  });
  document.getElementById('workStatus').textContent = working ? '🟢 Currently working' : '⚪ Off the clock';

  document.getElementById('liveCounter').innerHTML = `
    <div class="item"><span class="num">${totalDays.toLocaleString()}</span><span class="unit">days</span></div>
    <div class="item"><span class="num">${String(live.hours).padStart(2, '0')}</span><span class="unit">hrs</span></div>
    <div class="item"><span class="num">${String(live.minutes).padStart(2, '0')}</span><span class="unit">min</span></div>
    <div class="item"><span class="num">${String(live.seconds).padStart(2, '0')}</span><span class="unit">sec</span></div>
  `;
}

render();
// Keep it accurate as the clock ticks and past midnight.
setInterval(render, 1000);

// Light / dark mode toggle — the sun/moon rise animation is handled in CSS
// off the [data-theme] attribute; this just flips it and remembers the choice.
const themeToggleBtn = document.getElementById('themeToggle');

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

themeToggleBtn.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('pa-theme', next); } catch (e) {}
});
