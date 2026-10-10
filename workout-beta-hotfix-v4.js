/* Workout Beta Android button hotfix v4
   Load AFTER app.js. Uses event delegation because exercise controls are rendered dynamically. */
(() => {
  'use strict';

  function showHotfixError(error) {
    const message = error?.message || String(error || 'Невідома помилка');
    console.error('[Workout Beta hotfix]', error);

    if (typeof window.toast === 'function') {
      window.toast(message);
      return;
    }

    const target = document.querySelector('#toast');
    if (target) {
      target.textContent = message;
      target.style.display = 'block';
      window.setTimeout(() => {
        target.style.display = 'none';
      }, 3500);
      return;
    }

    window.alert(message);
  }

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    if (button.id === 'addSet') {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (button.dataset.running === '1') return;
      button.dataset.running = '1';
      button.disabled = true;

      const oldText = button.textContent;
      button.textContent = 'Зберігаю…';

      try {
        if (typeof window.addSet !== 'function') {
          throw new Error('Функція addSet не завантажена. Перевір app.js і кеш GitHub Pages.');
        }
        await window.addSet();
      } catch (error) {
        showHotfixError(error);
      } finally {
        button.dataset.running = '0';
        if (document.body.contains(button)) {
          button.disabled = false;
          button.textContent = oldText || '✅ Зарахувати підхід';
        }
      }
      return;
    }

    if (button.id === 'addExercise') {
      event.preventDefault();
      event.stopImmediatePropagation();

      try {
        if (typeof window.openExerciseDialog !== 'function') {
          throw new Error('Функція openExerciseDialog не завантажена. Перевір app.js і кеш GitHub Pages.');
        }
        window.openExerciseDialog();
      } catch (error) {
        showHotfixError(error);
      }
      return;
    }

    if (button.id === 'closeWorkoutApp' || button.id === 'close') {
      event.preventDefault();
      event.stopImmediatePropagation();

      const telegram = window.Telegram?.WebApp;
      if (typeof telegram?.close === 'function') {
        telegram.close();
      } else if (window.history.length > 1) {
        window.history.back();
      } else {
        window.close();
      }
    }
  }, true);
})();
