/**
 * FocusFlow — Main Application Logic
 * 100% Pure Vanilla JavaScript (Client-side, Offline-capable)
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // 1. DATA & STATE MANAGEMENT
  // ==========================================
  const STORAGE_KEYS = {
    TASKS: 'focusflow_tasks_v1',
    STATS: 'focusflow_stats_v1',
    NOTES: 'focusflow_notes_v1',
    THEME: 'focusflow_theme_v1'
  };

  const timerConfig = {
    pomodoro: 25 * 60,
    shortBreak: 5 * 60,
    longBreak: 15 * 60
  };

  let currentMode = 'pomodoro';
  let totalDuration = timerConfig.pomodoro;
  let remainingTime = timerConfig.pomodoro;
  let timerInterval = null;
  let isRunning = false;
  let currentActiveTask = null;

  let stats = JSON.parse(localStorage.getItem(STORAGE_KEYS.STATS)) || {
    totalFocusMinutes: 0,
    completedSessions: 0,
    lastDate: new Date().toDateString()
  };

  let tasks = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS)) || [
    {
      id: 'demo-1',
      text: 'Thiết kế giao diện người dùng FocusFlow',
      priority: 'high',
      category: 'Công việc',
      completed: true,
      createdAt: Date.now() - 3600000
    },
    {
      id: 'demo-2',
      text: 'Hoàn thành phiên làm việc sâu 25 phút',
      priority: 'medium',
      category: 'Học tập',
      completed: false,
      createdAt: Date.now() - 1800000
    },
    {
      id: 'demo-3',
      text: 'Uống 1 cốc nước ấm và vươn vai thư giãn',
      priority: 'low',
      category: 'Cá nhân',
      completed: false,
      createdAt: Date.now()
    }
  ];

  let currentFilter = 'all';

  // ==========================================
  // 2. DOM ELEMENTS
  // ==========================================
  const liveClockEl = document.getElementById('live-clock');
  const liveDateEl = document.getElementById('live-date');
  const themeToggleBtn = document.getElementById('theme-toggle');
  const fullscreenBtn = document.getElementById('fullscreen-btn');

  // Timer Elements
  const timerDisplayEl = document.getElementById('timer-display');
  const timerStateEl = document.getElementById('timer-state-text');
  const sessionCounterEl = document.getElementById('session-counter');
  const currentTaskDisplayEl = document.getElementById('current-task-display');
  const timerProgressCircle = document.getElementById('timer-progress');
  const btnStart = document.getElementById('btn-start');
  const btnStartLabel = document.getElementById('btn-start-label');
  const btnReset = document.getElementById('btn-reset');
  const btnSkip = document.getElementById('btn-skip');
  const modeButtons = document.querySelectorAll('.mode-btn');
  const customMinutesInput = document.getElementById('custom-minutes');
  const applyCustomTimeBtn = document.getElementById('apply-custom-time');

  // Task Elements
  const addTaskForm = document.getElementById('add-task-form');
  const taskTitleInput = document.getElementById('task-title-input');
  const taskCategorySelect = document.getElementById('task-category');
  const tasksListEl = document.getElementById('tasks-list');
  const taskCompletionStatEl = document.getElementById('task-completion-stat');
  const taskProgressBar = document.getElementById('task-progress-fill');
  const clearCompletedBtn = document.getElementById('clear-completed-btn');
  const filterButtons = document.querySelectorAll('.filter-btn');

  // Scratchpad & Stats
  const scratchpad = document.getElementById('scratchpad-textarea');
  const notesStatus = document.getElementById('notes-status');
  const totalFocusTimeEl = document.getElementById('total-focus-time');
  const completedSessionsEl = document.getElementById('completed-sessions-count');
  const quoteTextEl = document.getElementById('quote-text');
  const quoteAuthorEl = document.getElementById('quote-author');
  const newQuoteBtn = document.getElementById('new-quote-btn');

  // Ambient Audio
  const ambientMasterToggle = document.getElementById('ambient-master-toggle');
  const soundSliders = document.querySelectorAll('.sound-slider');

  // Circle circumference
  const CIRCLE_RADIUS = 140;
  const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS; // ~879.64
  timerProgressCircle.style.strokeDasharray = `${CIRCLE_CIRCUMFERENCE} ${CIRCLE_CIRCUMFERENCE}`;

  // ==========================================
  // 3. CLOCK & DATE
  // ==========================================
  function updateLiveClock() {
    const now = new Date();
    liveClockEl.textContent = now.toLocaleTimeString('vi-VN', { hour12: false });

    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = days[now.getDay()];
    const dateStr = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    liveDateEl.textContent = `${dayName}, ${dateStr}`;
  }
  setInterval(updateLiveClock, 1000);
  updateLiveClock();

  // ==========================================
  // 4. THEME & FULLSCREEN
  // ==========================================
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  themeToggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE_KEYS.THEME, next);
  });

  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.log(err));
    } else {
      document.exitFullscreen().catch(err => console.log(err));
    }
  });

  // ==========================================
  // 5. WEB AUDIO API SYNTHESIZER (No external mp3)
  // ==========================================
  let audioCtx = null;

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Play peaceful meditation chime on completion
  function playBellChime() {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // Fundamental tone + harmonic overtone
      const freqs = [528, 1056, 1584];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        const volume = (0.2 / (idx + 1));
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 3.6);
      });
    } catch (e) {
      console.warn('Audio chime error:', e);
    }
  }

  // Procedural Sound Engines
  const ambientEngines = {
    rain: { node: null, gain: null, isRunning: false },
    brown: { node: null, gain: null, isRunning: false },
    campfire: { node: null, gain: null, isRunning: false },
    binaural: { node: null, gain: null, isRunning: false }
  };

  function createNoiseBuffer(ctx, type = 'white') {
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let lastOut = 0.0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (type === 'brown') {
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5;
      } else {
        output[i] = white;
      }
    }
    return buffer;
  }

  function startAmbientSound(soundKey) {
    const ctx = getAudioContext();
    const engine = ambientEngines[soundKey];
    if (engine.isRunning) return;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.connect(ctx.destination);
    engine.gain = gainNode;

    if (soundKey === 'rain') {
      const noiseBuffer = createNoiseBuffer(ctx, 'white');
      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, ctx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(gainNode);
      whiteNoise.start();
      engine.node = whiteNoise;

    } else if (soundKey === 'brown') {
      const brownBuffer = createNoiseBuffer(ctx, 'brown');
      const brownNoise = ctx.createBufferSource();
      brownNoise.buffer = brownBuffer;
      brownNoise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, ctx.currentTime);

      brownNoise.connect(filter);
      filter.connect(gainNode);
      brownNoise.start();
      engine.node = brownNoise;

    } else if (soundKey === 'campfire') {
      const noiseBuffer = createNoiseBuffer(ctx, 'white');
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      source.loop = true;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(1200, ctx.currentTime);
      bandpass.Q.setValueAtTime(3, ctx.currentTime);

      source.connect(bandpass);
      bandpass.connect(gainNode);
      source.start();
      engine.node = source;

    } else if (soundKey === 'binaural') {
      // 200Hz base + 14Hz beta wave detune
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(200, ctx.currentTime);
      osc2.frequency.setValueAtTime(214, ctx.currentTime);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      osc1.start();
      osc2.start();
      engine.node = [osc1, osc2];
    }

    engine.isRunning = true;
  }

  function setAmbientVolume(soundKey, volume) {
    const engine = ambientEngines[soundKey];
    if (volume > 0) {
      if (!engine.isRunning) {
        startAmbientSound(soundKey);
      }
      if (engine.gain) {
        const ctx = getAudioContext();
        // Scale down to prevent overly loud outputs
        const scaledVol = (volume / 100) * 0.25;
        engine.gain.gain.setTargetAtTime(scaledVol, ctx.currentTime, 0.05);
      }
    } else {
      if (engine.gain) {
        const ctx = getAudioContext();
        engine.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      }
    }
  }

  soundSliders.forEach(slider => {
    slider.addEventListener('input', (e) => {
      const soundKey = e.target.closest('.sound-item').dataset.sound;
      const vol = parseFloat(e.target.value);
      setAmbientVolume(soundKey, vol);
    });
  });

  let masterMuted = false;
  ambientMasterToggle.addEventListener('click', () => {
    masterMuted = !masterMuted;
    if (masterMuted) {
      ambientMasterToggle.textContent = 'Tắt tất cả';
      soundSliders.forEach(slider => {
        if (slider.value == 0) slider.value = 35;
        const soundKey = slider.closest('.sound-item').dataset.sound;
        setAmbientVolume(soundKey, slider.value);
      });
    } else {
      ambientMasterToggle.textContent = 'Bật tất cả';
      soundSliders.forEach(slider => {
        slider.value = 0;
        const soundKey = slider.closest('.sound-item').dataset.sound;
        setAmbientVolume(soundKey, 0);
      });
    }
  });

  // ==========================================
  // 6. POMODORO TIMER
  // ==========================================
  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function updateTimerUI() {
    timerDisplayEl.textContent = formatTime(remainingTime);
    
    // Update SVG Circular Ring
    const progressFraction = (totalDuration - remainingTime) / totalDuration;
    const offset = CIRCLE_CIRCUMFERENCE - (progressFraction * CIRCLE_CIRCUMFERENCE);
    timerProgressCircle.style.strokeDashoffset = offset;

    // Update Browser Document Title
    const modeLabel = currentMode === 'pomodoro' ? '🎯' : '☕';
    document.title = `${modeLabel} (${formatTime(remainingTime)}) FocusFlow`;

    // Update active task chip
    if (currentActiveTask) {
      currentTaskDisplayEl.textContent = `🎯 ${currentActiveTask.text}`;
      currentTaskDisplayEl.title = currentActiveTask.text;
    } else {
      currentTaskDisplayEl.textContent = 'Chưa chọn việc cần làm';
    }
  }

  function switchMode(newMode, customDuration = null) {
    currentMode = newMode;
    isRunning = false;
    clearInterval(timerInterval);

    modeButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === newMode);
    });

    btnStart.classList.remove('running');
    btnStartLabel.textContent = 'Bắt đầu';
    timerStateEl.textContent = 'Sẵn sàng';

    if (customDuration) {
      totalDuration = customDuration;
    } else {
      totalDuration = timerConfig[newMode] || 25 * 60;
    }
    remainingTime = totalDuration;
    updateTimerUI();
  }

  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchMode(btn.dataset.mode);
    });
  });

  applyCustomTimeBtn.addEventListener('click', () => {
    const mins = parseInt(customMinutesInput.value, 10);
    if (mins && mins > 0 && mins <= 180) {
      switchMode(currentMode, mins * 60);
    }
  });

  function startTimer() {
    if (isRunning) return;
    isRunning = true;
    btnStart.classList.add('running');
    btnStartLabel.textContent = 'Tạm dừng';
    timerStateEl.textContent = currentMode === 'pomodoro' ? 'Đang tập trung' : 'Đang nghỉ ngơi';

    timerInterval = setInterval(() => {
      if (remainingTime > 0) {
        remainingTime--;
        updateTimerUI();
      } else {
        finishSession();
      }
    }, 1000);
  }

  function pauseTimer() {
    if (!isRunning) return;
    isRunning = false;
    clearInterval(timerInterval);
    btnStart.classList.remove('running');
    btnStartLabel.textContent = 'Tiếp tục';
    timerStateEl.textContent = 'Tạm dừng';
  }

  function resetTimer() {
    pauseTimer();
    btnStartLabel.textContent = 'Bắt đầu';
    timerStateEl.textContent = 'Sẵn sàng';
    remainingTime = totalDuration;
    updateTimerUI();
  }

  function skipTimer() {
    pauseTimer();
    if (currentMode === 'pomodoro') {
      switchMode('shortBreak');
    } else {
      switchMode('pomodoro');
    }
  }

  function finishSession() {
    pauseTimer();
    playBellChime();
    triggerConfetti();

    if (currentMode === 'pomodoro') {
      const minutesSpent = Math.round(totalDuration / 60);
      stats.totalFocusMinutes += minutesSpent;
      stats.completedSessions += 1;
      saveStats();
      updateStatsUI();

      // Send browser notification if supported
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🎉 Hoàn thành phiên Pomodoro!', {
          body: `Bạn đã tập trung trọn vẹn ${minutesSpent} phút. Hãy nghỉ ngơi một chút nhé!`,
          icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%236366f1"><circle cx="12" cy="12" r="10"/></svg>'
        });
      }

      alert('🎉 Chúc mừng! Bạn đã hoàn thành một phiên tập trung sâu. Hãy thư giãn một chút!');
      switchMode('shortBreak');
    } else {
      alert('☕ Hết giờ nghỉ ngơi rồi! Sẵn sàng cho phiên tập trung tiếp theo chưa?');
      switchMode('pomodoro');
    }
  }

  btnStart.addEventListener('click', () => {
    // Request notification permission smoothly
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    if (isRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  });

  btnReset.addEventListener('click', resetTimer);
  btnSkip.addEventListener('click', skipTimer);

  // ==========================================
  // 7. TASK MANAGEMENT (CRUD & Filters)
  // ==========================================
  function saveTasks() {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  }

  function renderTasks() {
    tasksListEl.innerHTML = '';

    const filtered = tasks.filter(task => {
      if (currentFilter === 'active') return !task.completed;
      if (currentFilter === 'completed') return task.completed;
      return true;
    });

    if (filtered.length === 0) {
      tasksListEl.innerHTML = `
        <div class="empty-state">
          <span>✨ Không có nhiệm vụ nào trong danh sách.</span>
        </div>
      `;
    } else {
      filtered.forEach(task => {
        const item = document.createElement('div');
        item.className = `task-item ${task.completed ? 'completed' : ''} ${currentActiveTask?.id === task.id ? 'active-focus' : ''}`;
        item.dataset.id = task.id;

        const priorityLabel = task.priority === 'high' ? 'Gấp 🔥' : task.priority === 'medium' ? 'Trung' : 'Thấp';
        const priorityClass = task.priority === 'high' ? 'tag-high' : task.priority === 'medium' ? 'tag-med' : 'tag-low';

        item.innerHTML = `
          <div class="task-left">
            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
            <div class="task-content">
              <span class="task-text">${escapeHtml(task.text)}</span>
              <div class="task-meta">
                <span class="tag ${priorityClass}">${priorityLabel}</span>
                <span class="task-category-tag">${escapeHtml(task.category)}</span>
              </div>
            </div>
          </div>
          <div class="task-right">
            <button class="btn-icon-task focus-btn" title="Đặt làm mục tiêu tập trung">
              🎯
            </button>
            <button class="btn-icon-task delete" title="Xóa nhiệm vụ">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        `;

        // Checkbox event
        const checkbox = item.querySelector('.task-checkbox');
        checkbox.addEventListener('change', () => {
          task.completed = checkbox.checked;
          if (task.completed) {
            triggerConfetti();
          }
          saveTasks();
          renderTasks();
          updateTaskStats();
        });

        // Focus select event
        const focusBtn = item.querySelector('.focus-btn');
        focusBtn.addEventListener('click', () => {
          currentActiveTask = (currentActiveTask?.id === task.id) ? null : task;
          renderTasks();
          updateTimerUI();
        });

        // Delete event
        const deleteBtn = item.querySelector('.btn-icon-task.delete');
        deleteBtn.addEventListener('click', () => {
          if (currentActiveTask?.id === task.id) {
            currentActiveTask = null;
            updateTimerUI();
          }
          tasks = tasks.filter(t => t.id !== task.id);
          saveTasks();
          renderTasks();
          updateTaskStats();
        });

        tasksListEl.appendChild(item);
      });
    }

    updateTaskStats();
  }

  function updateTaskStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

    taskCompletionStatEl.textContent = `${completed}/${total}`;
    taskProgressBar.style.width = `${pct}%`;
  }

  addTaskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = taskTitleInput.value.trim();
    if (!text) return;

    const priority = document.querySelector('input[name="priority"]:checked')?.value || 'medium';
    const category = taskCategorySelect.value;

    const newTask = {
      id: 'task_' + Date.now(),
      text,
      priority,
      category,
      completed: false,
      createdAt: Date.now()
    };

    tasks.unshift(newTask);
    saveTasks();
    renderTasks();
    taskTitleInput.value = '';

    // Auto set as current focus if none selected
    if (!currentActiveTask) {
      currentActiveTask = newTask;
      updateTimerUI();
    }
  });

  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderTasks();
    });
  });

  clearCompletedBtn.addEventListener('click', () => {
    if (confirm('Bạn có chắc muốn xóa tất cả nhiệm vụ đã hoàn thành không?')) {
      tasks = tasks.filter(t => !t.completed);
      if (currentActiveTask?.completed) currentActiveTask = null;
      saveTasks();
      renderTasks();
      updateTimerUI();
    }
  });

  // ==========================================
  // 8. SCRATCHPAD (Auto-saving notes)
  // ==========================================
  scratchpad.value = localStorage.getItem(STORAGE_KEYS.NOTES) || '';

  let noteSaveTimeout = null;
  scratchpad.addEventListener('input', () => {
    notesStatus.textContent = 'Đang lưu...';
    clearTimeout(noteSaveTimeout);
    noteSaveTimeout = setTimeout(() => {
      localStorage.setItem(STORAGE_KEYS.NOTES, scratchpad.value);
      notesStatus.textContent = 'Đã lưu tự động';
    }, 600);
  });

  // ==========================================
  // 9. DAILY STATS & MOTIVATION QUOTES
  // ==========================================
  function saveStats() {
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
  }

  function updateStatsUI() {
    totalFocusTimeEl.textContent = `${stats.totalFocusMinutes} phút`;
    completedSessionsEl.textContent = `${stats.completedSessions} phiên`;
    sessionCounterEl.textContent = `Phiên: #${stats.completedSessions + 1}`;
  }

  const quotes = [
    { text: "Kỷ luật là cầu nối giữa mục tiêu và thành tựu.", author: "Jim Rohn" },
    { text: "Tập trung là biết nói KHÔNG với cả trăm điều tốt khác.", author: "Steve Jobs" },
    { text: "Bạn không cần phải vĩ đại để bắt đầu, nhưng bạn phải bắt đầu để trở nên vĩ đại.", author: "Zig Ziglar" },
    { text: "Hành trình vạn dặm bắt đầu từ một bước chân nhỏ bé.", author: "Lão Tử" },
    { text: "Thời gian của bạn là có hạn, đừng lãng phí nó để sống cuộc đời của người khác.", author: "Steve Jobs" },
    { text: "Làm việc chăm chỉ trong im lặng, hãy để thành công tạo nên tiếng vang.", author: "Frank Ocean" },
    { text: "Chất lượng không phải là một hành động đơn lẻ, đó là một thói quen.", author: "Aristotle" }
  ];

  function showRandomQuote() {
    const randomIndex = Math.floor(Math.random() * quotes.length);
    const q = quotes[randomIndex];
    quoteTextEl.textContent = `"${q.text}"`;
    quoteAuthorEl.textContent = `— ${q.author}`;
  }

  newQuoteBtn.addEventListener('click', showRandomQuote);

  // ==========================================
  // 10. HIGH PERFORMANCE CANVAS CONFETTI
  // ==========================================
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  let confettiParticles = [];
  let isConfettiActive = false;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function triggerConfetti() {
    const colors = ['#6366f1', '#a855f7', '#ec4899', '#3b82f6', '#10b981', '#f59e0b'];
    confettiParticles = [];

    for (let i = 0; i < 90; i++) {
      confettiParticles.push({
        x: canvas.width / 2,
        y: canvas.height * 0.45,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 1.2) * 14,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        alpha: 1,
        decay: Math.random() * 0.015 + 0.01
      });
    }

    if (!isConfettiActive) {
      isConfettiActive = true;
      requestAnimationFrame(renderConfetti);
    }
  }

  function renderConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = confettiParticles.length - 1; i >= 0; i--) {
      const p = confettiParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravity
      p.rotation += p.rotationSpeed;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        confettiParticles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
      ctx.restore();
    }

    if (confettiParticles.length > 0) {
      requestAnimationFrame(renderConfetti);
    } else {
      isConfettiActive = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // ==========================================
  // 11. HELPERS & INITIALIZATION
  // ==========================================
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Initial Boot
  updateTimerUI();
  renderTasks();
  updateStatsUI();
  showRandomQuote();
});
