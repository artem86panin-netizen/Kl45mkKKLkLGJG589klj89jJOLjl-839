(() => {
  'use strict';

  const tg = window.Telegram?.WebApp;
  tg?.ready();
  tg?.expand();
  try { tg?.requestFullscreen?.(); } catch {}

  const app = document.querySelector('#app');
  const sync = document.querySelector('#sync');
  const toastBox = document.querySelector('#toast');
  const dialog = document.querySelector('#exerciseDialog');
  const exerciseForm = document.querySelector('#exerciseForm');
  const recentExercisesBox = document.querySelector('#recentExercises');
  const customExerciseInput = document.querySelector('#customExercise');
  const cancelExerciseButton = document.querySelector('#cancelExercise');

  const state = {
    session: null,
    exercise: null,
    exercises: [],
    sets: [],
    recentExercises: [],
    weight: 0,
    reps: 8,
    requestInProgress: false,
  };

  const initData = tg?.initData || '';

  function toast(message) {
    toastBox.textContent = String(message || 'Невідома помилка');
    toastBox.style.display = 'block';
    window.clearTimeout(toastBox._timer);
    toastBox._timer = window.setTimeout(() => {
      toastBox.style.display = 'none';
    }, 3500);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
  }

  function createActionId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    if (window.crypto?.getRandomValues) {
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 15) | 64;
      bytes[8] = (bytes[8] & 63) | 128;
      const hex = [...bytes].map((x) => x.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    return `wa_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  async function api(action, payload = {}) {
    sync.textContent = 'Синхронізація…';
    const response = await fetch(window.WORKOUT_BETA_CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `tma ${initData}`,
      },
      body: JSON.stringify({ action, ...payload }),
    });

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error(`Сервер повернув не JSON, HTTP ${response.status}`);
    }

    if (!response.ok || !result?.ok) {
      throw new Error(result?.error?.message || `Помилка HTTP ${response.status}`);
    }

    sync.textContent = 'Збережено';
    return result.data;
  }

  function renderStart(data) {
    const today = data?.today;
    app.innerHTML = `
      <div class="card">
        <h2>${escapeHtml(today?.title || 'Тренування')}</h2>
        <p class="muted">${today?.exercises?.length || 0} вправ за планом</p>
        <button type="button" class="big" data-action="start-plan">▶️ Почати за планом</button>
        <button type="button" class="big secondary" data-action="start-free">Вільне тренування</button>
      </div>`;
  }

  function currentExerciseIndex() {
    return state.exercises.findIndex((item) => Number(item.id) === Number(state.exercise?.id));
  }

  function renderWorkout() {
    if (!state.session) {
      boot();
      return;
    }

    if (!state.exercise) {
      app.innerHTML = `
        <div class="card">
          <h2>Вільне тренування</h2>
          <p class="muted">Додай першу вправу з історії або введи власну назву.</p>
          <button type="button" class="big" data-action="open-exercise-dialog">＋ Додати вправу</button>
        </div>
        <button type="button" class="big danger" data-action="finish">Завершити тренування</button>`;
      return;
    }

    const index = currentExerciseIndex();
    const hasPrevious = index > 0;
    const hasNext = index >= 0 && index < state.exercises.length - 1;

    app.innerHTML = `
      <div class="card">
        <div class="exercise-nav">
          <button type="button" class="arrow" data-action="previous-exercise" ${hasPrevious ? '' : 'disabled'}>‹</button>
          <div class="exercise-title">
            <div class="progress">Вправа ${index + 1} із ${state.exercises.length}</div>
            <h2>${escapeHtml(state.exercise.name)}</h2>
            <div class="muted">Ціль: ${state.exercise.target_sets || 3}×${state.exercise.reps_min || ''}${state.exercise.reps_max ? `–${state.exercise.reps_max}` : ''}</div>
          </div>
          <button type="button" class="arrow" data-action="next-exercise" ${hasNext ? '' : 'disabled'}>›</button>
        </div>
      </div>

      <div class="chips">
        ${state.exercises.map((item, itemIndex) => `
          <button type="button" class="chip ${itemIndex === index ? 'active' : ''}" data-action="select-exercise" data-exercise-id="${item.id}">
            ${itemIndex + 1}. ${escapeHtml(item.name)}
          </button>`).join('')}
      </div>

      <div class="grid">
        <div class="card">
          <div class="muted">Вага, кг</div>
          <div class="value" id="weightValue">${state.weight}</div>
          <div class="grid">
            <button type="button" class="step" data-action="change-weight" data-delta="-2.5">−2.5</button>
            <button type="button" class="step" data-action="change-weight" data-delta="2.5">+2.5</button>
          </div>
        </div>
        <div class="card">
          <div class="muted">Повтори</div>
          <div class="value" id="repsValue">${state.reps}</div>
          <div class="grid">
            <button type="button" class="step" data-action="change-reps" data-delta="-1">−1</button>
            <button type="button" class="step" data-action="change-reps" data-delta="1">+1</button>
          </div>
        </div>
      </div>

      <button type="button" class="big" data-action="add-set">✅ Зарахувати підхід</button>

      <div class="card">
        <h3>Підходи цієї вправи</h3>
        ${state.sets.length ? state.sets.map((set) => `
          <div class="set">
            <span>${set.is_warmup ? 'Розминка' : `Підхід ${set.set_no}`}</span>
            <b>${set.weight_kg ?? 0} × ${set.reps ?? 0}</b>
          </div>`).join('') : '<p class="muted">Ще немає підходів</p>'}
      </div>

      <button type="button" class="big secondary" data-action="open-exercise-dialog">＋ Додати вправу</button>
      <button type="button" class="big danger" data-action="finish">Завершити тренування</button>`;
  }

  async function boot() {
    try {
      const data = await api('bootstrap');
      state.recentExercises = data?.recentExercises || [];
      if (data?.session) {
        await loadState();
      } else {
        renderStart(data);
      }
    } catch (error) {
      app.innerHTML = `<div class="card"><h2>Не вдалося відкрити</h2><p>${escapeHtml(error.message)}</p></div>`;
      sync.textContent = 'Помилка';
    }
  }

  async function startWorkout(mode) {
    await api('start', { mode });
    await loadState();
    if (mode === 'free' && !state.exercise) openExerciseDialog();
  }

  async function loadState() {
    const data = await api('state');
    state.session = data?.session || null;
    state.exercise = data?.exercise || null;
    state.exercises = data?.exercises || [];
    state.sets = data?.sets || [];
    state.recentExercises = data?.recentExercises || state.recentExercises;
    state.weight = Number(data?.defaults?.weight ?? state.exercise?.target_weight ?? 0);
    state.reps = Number(data?.defaults?.reps ?? state.exercise?.reps_min ?? 8);
    renderWorkout();
  }

  async function selectExercise(exerciseId) {
    if (Number(exerciseId) === Number(state.exercise?.id)) return;
    const result = await api('select_exercise', {
      sessionId: Number(state.session.id),
      exerciseId: Number(exerciseId),
    });
    if (!result?.selected) throw new Error('Не вдалося вибрати вправу');
    await loadState();
  }

  async function addSet(button) {
    if (!state.session?.id || !state.exercise?.id) throw new Error('Активну вправу не знайдено');
    button.disabled = true;
    const oldText = button.textContent;
    button.textContent = 'Зберігаю…';
    try {
      const result = await api('add_set', {
        sessionId: Number(state.session.id),
        exerciseId: Number(state.exercise.id),
        weight: Number(state.weight),
        reps: Number(state.reps),
        isWarmup: false,
        clientActionId: createActionId(),
      });
      if (!result?.saved) throw new Error(result?.error || 'Підхід не вдалося зберегти');
      tg?.HapticFeedback?.notificationOccurred?.('success');
      await loadState();
    } finally {
      if (document.body.contains(button)) {
        button.disabled = false;
        button.textContent = oldText;
      }
    }
  }

  function openExerciseDialog() {
    recentExercisesBox.innerHTML = state.recentExercises.length
      ? state.recentExercises.map((item) => `<button type="button" class="recent-item" data-recent-name="${escapeHtml(item.name)}">${escapeHtml(item.name)}</button>`).join('')
      : '<p class="muted">Історія вправ поки порожня</p>';
    customExerciseInput.value = '';
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function closeExerciseDialog() {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  async function addExercise(name) {
    const cleanName = String(name || '').trim();
    if (!cleanName) throw new Error('Введи назву вправи');
    const result = await api('add_exercise', {
      sessionId: Number(state.session.id),
      name: cleanName,
      targetSets: 3,
      repsMin: 8,
      repsMax: 12,
      restSec: 90,
    });
    if (!result?.added) throw new Error('Вправу не вдалося додати');
    closeExerciseDialog();
    await loadState();
  }

  async function finishWorkout() {
    const result = await api('finish', { sessionId: Number(state.session.id) });
    state.session = null;
    app.innerHTML = `
      <div class="card">
        <h2>Тренування завершено ✅</h2>
        <p>${result?.exerciseCount || 0} вправ · ${result?.setCount || 0} підходів</p>
        <button type="button" class="big" data-action="close-app">Готово</button>
      </div>`;
  }

  app.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button || button.disabled || state.requestInProgress) return;
    const action = button.dataset.action;

    try {
      state.requestInProgress = true;
      if (action === 'start-plan') await startWorkout('plan');
      else if (action === 'start-free') await startWorkout('free');
      else if (action === 'open-exercise-dialog') openExerciseDialog();
      else if (action === 'add-set') await addSet(button);
      else if (action === 'finish') await finishWorkout();
      else if (action === 'close-app') tg?.close?.();
      else if (action === 'select-exercise') await selectExercise(button.dataset.exerciseId);
      else if (action === 'previous-exercise') {
        const i = currentExerciseIndex();
        if (i > 0) await selectExercise(state.exercises[i - 1].id);
      } else if (action === 'next-exercise') {
        const i = currentExerciseIndex();
        if (i >= 0 && i < state.exercises.length - 1) await selectExercise(state.exercises[i + 1].id);
      } else if (action === 'change-weight') {
        state.weight = Math.max(0, state.weight + Number(button.dataset.delta));
        document.querySelector('#weightValue').textContent = state.weight;
      } else if (action === 'change-reps') {
        state.reps = Math.max(1, state.reps + Number(button.dataset.delta));
        document.querySelector('#repsValue').textContent = state.reps;
      }
    } catch (error) {
      toast(error.message || error);
      sync.textContent = 'Помилка';
    } finally {
      state.requestInProgress = false;
    }
  });

  recentExercisesBox.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-recent-name]');
    if (!button || state.requestInProgress) return;
    try {
      state.requestInProgress = true;
      await addExercise(button.dataset.recentName);
    } catch (error) {
      toast(error.message || error);
    } finally {
      state.requestInProgress = false;
    }
  });

  exerciseForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (state.requestInProgress) return;
    try {
      state.requestInProgress = true;
      await addExercise(customExerciseInput.value);
    } catch (error) {
      toast(error.message || error);
    } finally {
      state.requestInProgress = false;
    }
  });

  cancelExerciseButton.addEventListener('click', closeExerciseDialog);
  boot();
})();
