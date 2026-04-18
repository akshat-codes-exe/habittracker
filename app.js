let habits = [
  { id: 'h1', name: 'Ignite the Journey', colorHex: '#10b981' }
];

let progress = {};
let dailyNotes = {};
let todos = [];

const STATE_EMPTY = 0;
const STATE_DONE = 1;
const STATE_MISSED = 2;

let showAddHabitInput = false;
let editingHabitId = null;

// Sound Synthesizer via Web Audio API
const playSound = (type) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'win') {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      oscillator.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.08); // A5

      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'lose') {
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.3);

      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    }
  } catch (e) {
    console.warn("Audio playback failed:", e);
  }
};

const getHabitTheme = (habit) => {
  let rgb = '59, 130, 246'; // fallback blue
  if (habit.colorHex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(habit.colorHex);
    if (result) {
      rgb = `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
    }
  } else {
    const palette = [
      "239, 68, 68", "249, 115, 22", "245, 158, 11", "132, 204, 22",
      "16, 185, 129", "20, 184, 166", "14, 165, 233", "59, 130, 246",
      "99, 102, 241", "168, 85, 247", "217, 70, 239", "236, 72, 153", "244, 63, 94"
    ];
    let hash = 0;
    for (let i = 0; i < habit.id.length; i++) {
      hash = habit.id.charCodeAt(i) + ((hash << 5) - hash);
    }
    rgb = palette[Math.abs(hash) % palette.length];
  }
  return { 
    bg: `rgba(${rgb}, 0.15)`, 
    border: `rgba(${rgb}, 0.6)`,
    solid: `rgb(${rgb})`
  };
};

let dates = [];
let currentDatesLength = 0;
let appStartDate = null;

const recalculateDates = () => {
  let maxDay = 0;
  for (const key in progress) {
    const parts = key.split('_day_');
    if (parts.length === 2) {
      const d = parseInt(parts[1], 10);
      if (d > maxDay) maxDay = d;
    }
  }
  for (const key in dailyNotes) {
    if (key.startsWith('day_')) {
      const d = parseInt(key.replace('day_', ''), 10);
      if (d > maxDay) maxDay = d;
    }
  }

  let needed = 30;
  while (maxDay >= needed - 5) {
    needed += 30;
  }

  if (needed !== currentDatesLength) {
    currentDatesLength = needed;
    dates = [];
    for (let i = 1; i <= needed; i++) {
      dates.push({ id: `day_${i}`, display: `Day ${i}` });
    }
    return true;
  }
  return false;
};

const getStorageKey = (key) => `ht_local_${key}`;

const loadData = () => {
  try {
    const h = localStorage.getItem(getStorageKey('habits'));
    if (h) {
      const parsedH = JSON.parse(h);
      if (Array.isArray(parsedH) && parsedH.length > 0) {
        habits = parsedH;
      }
    }
  } catch (e) { console.warn("Failed to load habits:", e); }

  try {
    const p = localStorage.getItem(getStorageKey('progress'));
    if (p) progress = JSON.parse(p);
  } catch (e) { progress = {}; }

  try {
    const n = localStorage.getItem(getStorageKey('notes'));
    if (n) dailyNotes = JSON.parse(n);
  } catch (e) { dailyNotes = {}; }

  try {
    const t = localStorage.getItem(getStorageKey('todos'));
    if (t) todos = JSON.parse(t);
  } catch (e) { todos = []; }

  try {
    const sd = localStorage.getItem(getStorageKey('startDate'));
    if (sd) {
       appStartDate = new Date(sd);
    } else {
       appStartDate = new Date();
       localStorage.setItem(getStorageKey('startDate'), appStartDate.toISOString());
    }
  } catch (e) { appStartDate = new Date(); }

  recalculateDates();
  renderAll();
};

const saveData = () => {
  try {
    localStorage.setItem(getStorageKey('habits'), JSON.stringify(habits));
    localStorage.setItem(getStorageKey('progress'), JSON.stringify(progress));
    localStorage.setItem(getStorageKey('notes'), JSON.stringify(dailyNotes));
    localStorage.setItem(getStorageKey('todos'), JSON.stringify(todos));
    if (appStartDate) localStorage.setItem(getStorageKey('startDate'), appStartDate.toISOString());
  } catch (e) {
    console.error("Failed to save data:", e);
  }
};

const toggleProgress = (habitId, dateId) => {
  const key = `${habitId}_${dateId}`;
  const current = progress[key] || STATE_EMPTY;
  let next = STATE_EMPTY;
  if (current === STATE_EMPTY) {
    next = STATE_DONE;
    playSound('win');
  } else if (current === STATE_DONE) {
    next = STATE_MISSED;
    playSound('lose');
  } else if (current === STATE_MISSED) {
    next = STATE_EMPTY;
  }

  if (next === STATE_EMPTY) delete progress[key];
  else progress[key] = next;

  saveData();
  recalculateDates();
  renderGrid();
  renderStats();
};

const handleNoteChange = (dateId, text) => {
  dailyNotes[dateId] = text;
  saveData();
  if (recalculateDates()) {
    renderGrid();
    setTimeout(() => {
      const inputs = document.querySelectorAll('.details-input');
      const idx = parseInt(dateId.replace('day_', '')) - 1;
      if (inputs[idx]) {
        inputs[idx].focus();
      }
    }, 50);
  }
};

const deleteHabit = (id) => {
  if (confirm("Delete this habit?")) {
    habits = habits.filter(h => h.id !== id);
    saveData();
    renderGrid();
  }
};

const addHabit = (name) => {
  if (!name.trim()) return;
  habits.push({ id: 'h_' + Date.now().toString(), name: name.trim() });
  showAddHabitInput = false;
  saveData();
  renderGrid();
};

const getLatestDayIndex = (hId = null) => {
  let calDay = 1;
  if (appStartDate) {
      calDay = Math.floor((new Date() - appStartDate) / (1000 * 60 * 60 * 24)) + 1;
  }
  let maxDay = calDay;
  for (const key in progress) {
      if (progress[key] !== STATE_EMPTY) {
          if (hId && !key.startsWith(`${hId}_day_`)) continue;
          const parts = key.split('_day_');
          if (parts.length === 2) {
              const d = parseInt(parts[1], 10);
              if (d > maxDay) maxDay = d;
          }
      }
  }
  return maxDay;
};

const getHabitStreak = (hId) => {
  let nowDay = getLatestDayIndex(hId);
  let s = 0;
  let checkDay = nowDay;
  if (progress[`${hId}_day_${nowDay}`] !== STATE_DONE) {
     checkDay = nowDay - 1;
     if (progress[`${hId}_day_${checkDay}`] !== STATE_DONE) return 0;
  }
  while(checkDay > 0) {
     if (progress[`${hId}_day_${checkDay}`] === STATE_DONE) { s++; checkDay--; }
     else break;
  }
  return s;
};

const renderGrid = () => {
  const gridContainer = document.getElementById('tracker-grid');
  if (!gridContainer) return;

  // Day col is ~80px. Habits tighter at 75px. Spacer ~120px. Details gets rigid minmax. Progress ~120px.
  gridContainer.style.gridTemplateColumns = `80px repeat(${habits.length}, 75px) 120px minmax(350px, 1fr) 120px`;

  let html = `<div class="grid-row grid-header-row">
    <div class="grid-cell day-column" style="text-transform:uppercase;">DAY</div>`;

  habits.forEach(habit => {
    const theme = getHabitTheme(habit);
    const streak = getHabitStreak(habit.id);
    const streakHtml = streak >= 2 ? `<span title="${streak} Day Streak!" style="color:#f97316; font-size:0.7rem; margin-left:4px; font-weight:bold; white-space:nowrap;">🔥${streak}</span>` : '';
    if (editingHabitId === habit.id) {
      html += `
        <div class="grid-cell habit-column-header" style="background-color: ${theme.bg}; border-bottom: 2px solid ${theme.border};">
          <input type="text" id="edit-habit-input" value="${habit.name.replace(/"/g, '&quot;')}"
                 class="dark-input" style="width:80px; padding:2px; font-size:0.8rem; border-color: ${theme.border};"
                 onkeydown="if(event.key==='Enter') window.saveHabitNameGlobal('${habit.id}', this.value)"
                 onblur="window.saveHabitNameGlobal('${habit.id}', this.value)">
        </div>`;
    } else {
      html += `
        <div class="grid-cell habit-column-header" style="background-color: ${theme.bg}; border-bottom: 2px solid ${theme.border}; cursor: grab;"
             draggable="true"
             ondragstart="window.dragHabitStart(event, '${habit.id}')"
             ondragover="window.dragHabitOver(event)"
             ondragenter="var el = event.target.closest('.habit-column-header'); if(el) el.style.opacity = '0.5';"
             ondragleave="var el = event.target.closest('.habit-column-header'); if(el) el.style.opacity = '1';"
             ondrop="window.dropHabit(event, '${habit.id}')">
          <span>${habit.name}${streakHtml}</span>
          <div class="habit-header-controls">
            <label class="habit-action-btn" title="Pick Color" style="position:relative; margin-bottom:0;">
              <i data-lucide="palette" style="width:12px;height:12px;"></i>
              <input type="color" style="opacity:0; position:absolute; left:0; top:0; width:100%; height:100%; cursor:pointer;"
                     value="${habit.colorHex || '#3b82f6'}"
                     onchange="window.saveHabitColorGlobal('${habit.id}', this.value)">
            </label>
            <button class="habit-action-btn" onclick="window.startEditHabitGlobal('${habit.id}')" title="Edit Habit">
              <i data-lucide="edit-2" style="width:12px;height:12px;"></i>
            </button>
            <button class="habit-action-btn delete" onclick="window.deleteHabitGlobal('${habit.id}')" title="Delete Habit">
              <i data-lucide="x" style="width:14px;height:14px;"></i>
            </button>
          </div>
        </div>`;
    }
  });

  html += `<div class="grid-cell" style="display:flex; align-items:center;">`;
  if (showAddHabitInput) {
    html += `
       <div class="add-habit-form-inline">
         <input type="text" id="inline-habit-input" placeholder="Name" onkeydown="if(event.key==='Enter') window.addHabitGlobal(this.value)" autofocus>
       </div>
     `;
  } else {
    html += `
      <button class="add-habit-btn" onclick="window.toggleAddHabitInputGlobal()">
        <i data-lucide="plus" style="width: 14px; height: 14px;"></i> Add Habit
      </button>`;
  }
  html += `</div>`;

  html += `<div class="grid-cell details-column" style="text-transform:uppercase;">DAILY DETAILS</div>
  <div class="grid-cell details-column" style="text-transform:uppercase; justify-content:center;">PROGRESS</div>
  </div>`; // End header row

  // Rows for each date
  dates.forEach((date, index) => {
    let dateStr = "";
    if (appStartDate) {
      const d = new Date(appStartDate.getTime());
      d.setDate(d.getDate() + index);
      const month = d.toLocaleString('default', { month: 'short' });
      const dayNum = d.getDate();
      dateStr = `<span style="display:block; font-size:0.65rem; color:var(--text-muted); font-weight:normal; margin-top:2px;">${month} ${dayNum}</span>`;
    }

    html += `<div class="grid-row">
      <div class="grid-cell day-column" style="display:flex; flex-direction:column; justify-content:center; align-items:center;">
        <span style="font-weight:bold; font-size:0.85rem;">${date.display}</span>
        ${dateStr}
      </div>`;

    habits.forEach(habit => {
      const state = progress[`${habit.id}_${date.id}`] || STATE_EMPTY;
      let toggleClass = '';
      let icon = '';
      if (state === STATE_DONE) {
        toggleClass = 'state-done';
        icon = `<i data-lucide="check" stroke-width="3"></i>`;
      } else if (state === STATE_MISSED) {
        toggleClass = 'state-missed';
        icon = `<i data-lucide="x" stroke-width="3"></i>`;
      }

      html += `
        <div class="grid-cell" style="justify-content:center;">
          <button class="toggle-btn ${toggleClass}" onclick="window.toggleProgressGlobal('${habit.id}', '${date.id}')">
            ${icon}
          </button>
        </div>`;
    });

    // Empty spacer underneath the "Add Habit" column header
    html += `<div class="grid-cell"></div>`;

    // Daily Details input for this day
    const noteText = dailyNotes[date.id] || '';
    html += `
      <div class="grid-cell details-column" style="padding-left:0; padding-right:0; align-items: flex-start;">
        <textarea class="details-input" placeholder="Add a note for this day..."
               oninput="this.style.height='auto'; this.style.height=this.scrollHeight+'px'; window.handleNoteChangeGlobal('${date.id}', this.value)"
               >${noteText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
      </div>`;

    // Calculate Progress Ring to be placed at the very end
    let doneC = 0, missedC = 0, emptyC = 0;
    habits.forEach(habit => {
      const state = progress[`${habit.id}_${date.id}`] || STATE_EMPTY;
      if (state === STATE_DONE) doneC++;
      else if (state === STATE_MISSED) missedC++;
      else emptyC++;
    });

    let ringHTML = '';
    const total = habits.length;
    if (total === 0) {
      ringHTML = `<div class="progress-ring" style="background: #3f3f46;"></div>`;
    } else {
      const dPct = (doneC / total) * 100;
      const mPct = (missedC / total) * 100;
      const gradient = `conic-gradient(var(--success-color) 0% ${dPct}%, #ef4444 ${dPct}% ${dPct + mPct}%, #3f3f46 ${dPct + mPct}% 100%)`;

      ringHTML = `
        <div style="display:flex; align-items:center; gap: 10px;">
          <div class="progress-ring" style="background: ${gradient};" title="Done: ${doneC}, Missed: ${missedC}, Empty: ${emptyC}"></div>
          <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600; min-width: 28px;">${Math.round(dPct)}%</span>
        </div>
      `;
    }

    html += `<div class="grid-cell" style="justify-content:center;">${ringHTML}</div>
    </div>`;
  });

  gridContainer.innerHTML = html;

  // Apply auto-height to already populated textareas
  const textareas = gridContainer.querySelectorAll('.details-input');
  textareas.forEach(t => {
    t.style.height = 'auto';
    t.style.height = t.scrollHeight + 'px';
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
};

const renderTodos = () => {
  const list = document.getElementById('todo-list');
  const badge = document.getElementById('todo-badge');
  const clearBtn = document.getElementById('clear-completed-todos-btn');
  if (!list) return;

  list.innerHTML = todos.length === 0 ? '<p style="color:var(--text-muted);font-size:0.9rem;">No immediate tasks.</p>' : '';

  todos.forEach(todo => {
    list.innerHTML += `
      <div class="todo-item ${todo.completed ? 'completed' : ''}">
        <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''} onchange="window.toggleTodoGlobal('${todo.id}')" />
        <span class="todo-text">${todo.text}</span>
        <button class="btn-icon" onclick="window.deleteTodoGlobal('${todo.id}')">
          <i data-lucide="trash-2" style="width: 14px; height: 14px; color:var(--text-muted);"></i>
        </button>
      </div>
    `;
  });

  const activeCount = todos.filter(t => !t.completed).length;
  if (activeCount > 0) {
    badge.style.display = 'flex';
    badge.innerText = activeCount;
  } else {
    badge.style.display = 'none';
  }

  const hasCompleted = todos.some(t => t.completed);
  clearBtn.style.display = hasCompleted ? 'block' : 'none';
  if (window.lucide) {
    window.lucide.createIcons();
  }
};

const renderStats = () => {
  const container = document.getElementById('stats-content');
  if (!container) return;

  let totalDone = 0;
  let totalMissed = 0;

  const habitStats = habits.map(h => {
    let cDone = 0; let cMissed = 0;
    for (const pKey in progress) {
      if (pKey.startsWith(`${h.id}_`)) {
        if (progress[pKey] === STATE_DONE) cDone++;
        if (progress[pKey] === STATE_MISSED) cMissed++;
      }
    }
    totalDone += cDone;
    totalMissed += cMissed;

    const totalH = cDone + cMissed;
    const rate = totalH > 0 ? (cDone / totalH) * 100 : 0;
    return { ...h, done: cDone, missed: cMissed, rate };
  });

  const totalTracked = totalDone + totalMissed;
  const globalRate = totalTracked > 0 ? (totalDone / totalTracked) * 100 : 0;

  // Heatmap generation
  let heatmapHtml = `<div class="stat-card" style="padding: 1.2rem; margin-bottom:1.5rem;">
    <div class="stat-card-title" style="margin-bottom:0.75rem; font-size:0.85rem; color:var(--text-muted);">Lifetime Activity Map</div>
    <div style="display:flex; flex-wrap:wrap; gap:4px; justify-content:flex-start;">`;
  
  let nowDay = getLatestDayIndex();
  const HEATMAP_DAYS = Math.max(nowDay, 30); // Show at least 30 empty days at start for UI aesthetics

  for(let i = HEATMAP_DAYS - 1; i >= 0; i--) {
     const checkDay = nowDay - i;
     if (checkDay < 1) {
        heatmapHtml += `<div title="Before Tracking Started" style="width:12px; height:12px; background:#1f1f1f; border-radius:3px; opacity:0.5;"></div>`;
     } else {
        let cD = 0; let cM = 0;
        habits.forEach(h => {
           const st = progress[`${h.id}_day_${checkDay}`];
           if (st === STATE_DONE) cD++;
           if (st === STATE_MISSED) cM++;
        });
        const activeCount = cD + cM;
        let color = '#27272a'; // no activity
        let tip = `Day ${checkDay}: No Activity`;
        if (activeCount > 0) {
           const p = cD / activeCount;
           if (p === 0) color = '#ef4444'; // RED (All Missed)
           else if (p < 0.4) color = '#064e3b'; // Dark Green
           else if (p < 0.8) color = '#059669'; // Mid Green
           else color = '#10b981'; // Bright Green
           tip = `Day ${checkDay}: ${Math.round(p*100)}% Success`;
        }
        heatmapHtml += `<div title="${tip}" style="width:12px; height:12px; background:${color}; border-radius:3px;"></div>`;
     }
  }
  heatmapHtml += `</div></div>`;

  const totalPossible = habits.length * nowDay;
  const totalEmpty = totalPossible - totalDone - totalMissed;

  const donePct = totalPossible > 0 ? (totalDone / totalPossible) * 100 : 0;
  const missedPct = totalPossible > 0 ? (totalMissed / totalPossible) * 100 : 0;
  const emptyPct = totalPossible > 0 ? (totalEmpty / totalPossible) * 100 : 0;

  let html = `
    <div class="stat-card" style="text-align:center; padding: 1.5rem; background: linear-gradient(145deg, #131313, #1c1c1c); border: 1px solid #2a2a2a; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.4);">
      <div class="stat-card-title" style="font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:1.5rem;">Action Distribution</div>
      
      <div style="display:flex; justify-content:space-around; align-items:center; margin-bottom: 1.5rem;">
        <div style="display:flex; flex-direction:column; align-items:center; gap: 4px;">
           <span style="font-size:2.5rem; font-weight:800; color:var(--success-color); line-height: 1; text-shadow: 0 0 15px rgba(16, 185, 129, 0.4);">${totalDone}</span>
           <span style="font-size:0.75rem; font-weight: 600; color:var(--text-muted); text-transform:uppercase; letter-spacing: 1px;">Done</span>
        </div>
        <div style="display:flex; flex-direction:column; align-items:center; gap: 4px;">
           <span style="font-size:2.5rem; font-weight:800; color:#ef4444; line-height: 1; text-shadow: 0 0 15px rgba(239, 68, 68, 0.4);">${totalMissed}</span>
           <span style="font-size:0.75rem; font-weight: 600; color:var(--text-muted); text-transform:uppercase; letter-spacing: 1px;">Failed</span>
        </div>
        <div style="display:flex; flex-direction:column; align-items:center; gap: 4px;">
           <span style="font-size:2.5rem; font-weight:800; color:#52525b; line-height: 1;">${totalEmpty}</span>
           <span style="font-size:0.75rem; font-weight: 600; color:var(--text-muted); text-transform:uppercase; letter-spacing: 1px;">Undone</span>
        </div>
      </div>

      <!-- Horizontal Distribution Bar -->
      <div style="width: 100%; height: 12px; border-radius: 8px; display:flex; overflow:hidden; background: #000; box-shadow: inset 0 2px 6px rgba(0,0,0,0.8);">
         <div title="Done: ${typeof donePct === 'number' ? Math.round(donePct) : 0}%" style="width: ${donePct}%; background: var(--success-color); box-shadow: inherit; transition: width 0.4s ease;"></div>
         <div title="Failed: ${typeof missedPct === 'number' ? Math.round(missedPct) : 0}%" style="width: ${missedPct}%; background: #ef4444; box-shadow: inherit; transition: width 0.4s ease;"></div>
         <div title="Undone: ${typeof emptyPct === 'number' ? Math.round(emptyPct) : 0}%" style="width: ${emptyPct}%; background: #3f3f46; transition: width 0.4s ease;"></div>
      </div>
    </div>
    
    ${heatmapHtml}
    
    <div class="stat-card" style="padding-top:0.5rem; background:transparent; border:none; padding-left:0; padding-right:0;">
      <div class="stat-card-title" style="margin-bottom:1rem; font-size: 0.9rem;">My Habit Breakdown</div>
  `;

  const sorted = [...habitStats].sort((a,b) => b.rate - a.rate);
  
  sorted.forEach(h => {
     const theme = getHabitTheme(h);
     const totalH = h.done + h.missed;
     const dPct = totalH > 0 ? (h.done / totalH) * 100 : 0;
     const mPct = totalH > 0 ? (h.missed / totalH) * 100 : 0;
     const gradient = totalH > 0 
        ? `conic-gradient(${theme.solid} 0% ${dPct}%, #ef4444 ${dPct}% 100%)`
        : `conic-gradient(#3f3f46 0% 100%)`;

     html += `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; background: #1a1a1a; padding: 0.8rem; border-radius: 8px; border: 1px solid var(--border-color);">
          <div style="display:flex; flex-direction:column; gap: 4px;">
             <span style="color:var(--text-primary); font-weight:500;">${h.name}</span>
             <span style="font-size:0.75rem; color:var(--text-muted);">
               <span style="color:${theme.border}; font-weight:bold;">${h.done} Done</span> · <span style="color:#ef4444">${h.missed} Failed</span>
             </span>
          </div>
          <div style="display:flex; align-items:center; gap: 12px;">
             <span style="font-size:0.85rem; font-weight:600; color:var(--text-primary);">${Math.round(h.rate)}%</span>
             <div class="progress-ring" style="width: 32px; height: 32px; background: ${gradient}; box-shadow: 0 0 10px ${theme.bg};"></div>
          </div>
        </div>
     `;
  });

  html += `</div>`;
  container.innerHTML = html;
};

const renderAll = () => {
  renderGrid();
  renderTodos();
  renderStats();
};

// Event Listeners (ensure DOM is loaded)
window.addEventListener('DOMContentLoaded', () => {

  const addTodoForm = document.getElementById('add-todo-form');
  if (addTodoForm) {
    addTodoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('new-todo-input');
      if (input.value.trim()) {
        todos.push({ id: Date.now().toString(), text: input.value.trim(), completed: false });
        input.value = '';
        saveData();
        renderTodos();
      }
    });
  }

  const clearTodosBtn = document.getElementById('clear-completed-todos-btn');
  if (clearTodosBtn) {
    clearTodosBtn.addEventListener('click', () => {
      todos = todos.filter(t => !t.completed);
      saveData();
      renderTodos();
    });
  }

  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) overlay.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-stats').classList.remove('open');
    overlay.classList.remove('open');
  });

  const todoBtn = document.getElementById('todo-toggle-btn');
  if (todoBtn) todoBtn.addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('open');
  });

  const statsBtn = document.getElementById('stats-toggle-btn');
  if (statsBtn) statsBtn.addEventListener('click', () => {
    document.getElementById('sidebar-stats').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('open');
  });

  const closeBtn = document.getElementById('sidebar-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');
  });

  const statsCloseBtn = document.getElementById('sidebar-stats-close-btn');
  if (statsCloseBtn) statsCloseBtn.addEventListener('click', () => {
    document.getElementById('sidebar-stats').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');
  });

  const restartBtn = document.getElementById('restart-progress-btn');
  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
       const confirmReset = confirm("WARNING: This will permanently wipe all your past checkmarks, daily notes, and analytics. Day 1 will be restarted to today.\n\nYour defined habits and customized colors will remain completely intact.\n\nAre you sure you want to start fresh?");
       if (confirmReset) {
         progress = {};
         dailyNotes = {};
         appStartDate = new Date();
         currentDatesLength = 0; // Force UI minimum 30 day generation
         saveData();
         loadData();
         document.getElementById('sidebar-stats').classList.remove('open');
         document.getElementById('sidebar-overlay').classList.remove('open');
       }
    });
  }

  const exportBtn = document.getElementById('export-backup-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
       const dataObj = { habits, progress, dailyNotes, todos, startDate: appStartDate };
       const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataObj, null, 2));
       const a = document.createElement('a');
       a.setAttribute("href", dataStr);
       a.setAttribute("download", "habittracker_backup_" + new Date().toISOString().split('T')[0] + ".json");
       document.body.appendChild(a);
       a.click();
       a.remove();
    });
  }

  const guideOpenBtn = document.getElementById('guide-open-btn');
  if (guideOpenBtn) {
    guideOpenBtn.addEventListener('click', () => {
      const modal = document.getElementById('info-overlay');
      if (modal) modal.classList.add('open');
    });
  }

  const guideCloseBtn = document.getElementById('guide-close-btn');
  if (guideCloseBtn) {
    guideCloseBtn.addEventListener('click', () => {
      const modal = document.getElementById('info-overlay');
      if (modal) modal.classList.remove('open');
    });
  }

  const infoOverlay = document.getElementById('info-overlay');
  if (infoOverlay) {
    infoOverlay.addEventListener('click', (e) => {
      if (e.target.id === 'info-overlay') {
        infoOverlay.classList.remove('open');
      }
    });
  }

  // Document click to close habit forms
  document.addEventListener('click', (e) => {
    if (showAddHabitInput && e.target.id !== 'inline-habit-input' && !e.target.closest('.add-habit-btn')) {
      showAddHabitInput = false;
      renderGrid();
    }
  });

  // Setup Globals for inline HTML function calls
  window.toggleProgressGlobal = toggleProgress;
  window.handleNoteChangeGlobal = handleNoteChange;
  window.deleteHabitGlobal = deleteHabit;
  window.startEditHabitGlobal = (id) => {
    editingHabitId = id;
    renderGrid();
    setTimeout(() => {
      const input = document.getElementById('edit-habit-input');
      if (input) { input.focus(); input.select(); }
    }, 50);
  };
  window.saveHabitNameGlobal = (id, newName) => {
    if (newName.trim()) {
      const h = habits.find(h => h.id === id);
      if (h) h.name = newName.trim();
      saveData();
    }
    editingHabitId = null;
    renderGrid();
  };
  
  let draggedHabitId = null;
  window.dragHabitStart = (e, id) => {
    draggedHabitId = id;
    e.dataTransfer.effectAllowed = "move";
  };
  window.dragHabitOver = (e) => {
    e.preventDefault();
  };
  window.dropHabit = (e, targetId) => {
    e.preventDefault();
    document.querySelectorAll('.habit-column-header').forEach(el => el.style.opacity = '1');
    if (draggedHabitId && draggedHabitId !== targetId) {
       const draggedIdx = habits.findIndex(h => h.id === draggedHabitId);
       const targetIdx = habits.findIndex(h => h.id === targetId);
       if (draggedIdx !== -1 && targetIdx !== -1) {
          const draggedHabit = habits[draggedIdx];
          habits.splice(draggedIdx, 1);
          habits.splice(targetIdx, 0, draggedHabit);
          saveData();
          renderGrid();
       }
    }
    draggedHabitId = null;
  };

  window.saveHabitColorGlobal = (id, hex) => {
    const h = habits.find(h => h.id === id);
    if (h) {
      h.colorHex = hex;
      saveData();
      renderGrid();
    }
  };
  window.toggleTodoGlobal = (id) => {
    todos = todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    saveData(); renderTodos();
  };
  window.deleteTodoGlobal = (id) => {
    todos = todos.filter(t => t.id !== id);
    saveData(); renderTodos();
  };
  window.toggleAddHabitInputGlobal = () => {
    showAddHabitInput = true; renderGrid();
    setTimeout(() => document.getElementById('inline-habit-input').focus(), 50);
  };
  window.addHabitGlobal = addHabit;

  // Initial load
  loadData();
});
