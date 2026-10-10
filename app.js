const tg=window.Telegram?.WebApp;tg?.ready();tg?.expand();tg?.requestFullscreen?.();
const A=document.querySelector('#app'),S=document.querySelector('#sync'),T=document.querySelector('#toast');
const D=document.querySelector('#exerciseDialog'),R=document.querySelector('#recentExercises'),C=document.querySelector('#customExercise');
let state={session:null,exercise:null,exercises:[],sets:[],recentExercises:[],weight:0,reps:8,busy:false};
const initData=tg?.initData||'';
async function api(action,payload={}){if(state.busy&&['add_set','select_exercise','add_exercise'].includes(action))throw Error('Зачекай завершення попередньої дії');state.busy=true;S.textContent='Синхронізація…';try{const r=await fetch(WORKOUT_BETA_CONFIG.apiUrl,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'tma '+initData},body:JSON.stringify({action,...payload})});const j=await r.json();if(!r.ok||!j.ok)throw Error(j?.error?.message||'Помилка запиту');S.textContent='Збережено';return j.data}finally{state.busy=false}}
function toast(x){T.textContent=x;T.style.display='block';setTimeout(()=>T.style.display='none',2600)}
async function boot(){try{const d=await api('bootstrap');state.recentExercises=d.recentExercises||[];if(d.session)return loadState();renderStart(d)}catch(e){A.innerHTML=`<div class=card><h2>Не вдалося відкрити</h2><p>${escapeHtml(e.message)}</p></div>`}}
function renderStart(d){A.innerHTML=`<div class=card><h2>${escapeHtml(d.today?.title||'Тренування')}</h2><p class=muted>${d.today?.exercises?.length||0} вправ за планом</p><button class=big id=startPlan>▶️ Почати за планом</button><button class="big secondary" id=startFree>Вільне тренування</button></div>`;startPlan.onclick=()=>start('plan');startFree.onclick=()=>start('free')}
async function start(mode){try{await api('start',{mode});await loadState();if(mode==='free'&&!state.exercise)openExerciseDialog()}catch(e){toast(e.message)}}
async function loadState(){try{const d=await api('state');state.session=d.session||null;state.exercise=d.exercise||null;state.exercises=d.exercises||[];state.sets=d.sets||[];state.recentExercises=d.recentExercises||state.recentExercises;state.weight=Number(d.defaults?.weight??state.exercise?.target_weight??0);state.reps=Number(d.defaults?.reps??state.exercise?.reps_min??8);render()}catch(e){toast(e.message)}}
function currentIndex(){return state.exercises.findIndex(x=>Number(x.id)===Number(state.exercise?.id))}
function render(){if(!state.session)return boot();if(!state.exercise){A.innerHTML=`<div class=card><h2>Вільне тренування</h2><p class=muted>Додай першу вправу з історії або введи власну назву.</p><button class=big id=addExercise>＋ Додати вправу</button></div><button class="big danger" id=finish>Завершити тренування</button>`;addExercise.onclick=openExerciseDialog;finish.onclick=finishWorkout;return}
const i=currentIndex(),hasPrev=i>0,hasNext=i>=0&&i<state.exercises.length-1;
A.innerHTML=`<div class=card><div class=exercise-nav><button class=arrow id=prev ${hasPrev?'':'disabled'} aria-label="Попередня вправа">‹</button><div class=exercise-title><div class=progress>Вправа ${i+1} із ${state.exercises.length}</div><h2>${escapeHtml(state.exercise.name)}</h2><div class=muted>Ціль: ${state.exercise.target_sets||3}×${state.exercise.reps_min||''}${state.exercise.reps_max?'–'+state.exercise.reps_max:''}</div></div><button class=arrow id=next ${hasNext?'':'disabled'} aria-label="Наступна вправа">›</button></div></div><div class=chips>${state.exercises.map((x,n)=>`<button class="chip ${n===i?'active':''}" data-exercise-id="${x.id}">${n+1}. ${escapeHtml(x.name)}</button>`).join('')}</div><div class=grid><div class=card><div class=muted>Вага, кг</div><div class=value id=w>${state.weight}</div><div class=grid><button class=step data-w=-2.5>−2.5</button><button class=step data-w=2.5>+2.5</button></div></div><div class=card><div class=muted>Повтори</div><div class=value id=r>${state.reps}</div><div class=grid><button class=step data-r=-1>−1</button><button class=step data-r=1>+1</button></div></div></div><button class=big id=addSet>✅ Зарахувати підхід</button><div class=card><h3>Підходи цієї вправи</h3>${state.sets.map(x=>`<div class=set><span>${x.is_warmup?'Розминка':'Підхід '+x.set_no}</span><b>${x.weight_kg??0} × ${x.reps??0}</b></div>`).join('')||'<p class=muted>Ще немає підходів</p>'}</div><button class="big secondary" id=addExercise>＋ Додати вправу</button><button class="big danger" id=finish>Завершити тренування</button>`;
prev.onclick=()=>hasPrev&&selectExercise(state.exercises[i-1].id);next.onclick=()=>hasNext&&selectExercise(state.exercises[i+1].id);document.querySelectorAll('[data-exercise-id]').forEach(b=>b.onclick=()=>selectExercise(Number(b.dataset.exerciseId)));document.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>{state.weight=Math.max(0,state.weight+Number(b.dataset.w));w.textContent=state.weight});document.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{state.reps=Math.max(1,state.reps+Number(b.dataset.r));r.textContent=state.reps});addSet.onclick=addSet;addExercise.onclick=openExerciseDialog;finish.onclick=finishWorkout}
async function selectExercise(exerciseId){if(Number(exerciseId)===Number(state.exercise?.id))return;try{await api('select_exercise',{sessionId:state.session.id,exerciseId});await loadState()}catch(e){toast(e.message)}}
function createActionId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);

    globalThis.crypto.getRandomValues(bytes);

    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;

    const hex = [...bytes]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join('-');
  }

  return `workout_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
}

async function addSet() {
  if (!state.session?.id) {
    toast('Не визначено активне тренування');
    return;
  }

  if (!state.exercise?.id) {
    toast('Не визначено активну вправу');
    return;
  }

  const button = document.querySelector('#addSet');

  if (button) {
    button.disabled = true;
    button.textContent = 'Зберігаю…';
  }

  try {
    const result = await api('add_set', {
      sessionId: Number(state.session.id),
      exerciseId: Number(state.exercise.id),
      weight: Number(state.weight),
      reps: Number(state.reps),
      isWarmup: false,
      clientActionId: createActionId(),
    });

    if (!result?.saved) {
      if (result?.error === 'INVALID_SESSION_OR_EXERCISE') {
        throw new Error(
          'Сесію або вправу не знайдено. Закрий і відкрий тренування знову.'
        );
      }

      throw new Error('Підхід не вдалося зберегти');
    }

    tg?.HapticFeedback?.notificationOccurred('success');

    await loadState();
  } catch (error) {
    toast(error?.message || 'Не вдалося записати підхід');
  } finally {
    if (button && document.body.contains(button)) {
      button.disabled = false;
      button.textContent = '✅ Зарахувати підхід';
    }
  }
}
function openExerciseDialog(){R.innerHTML=state.recentExercises.length?state.recentExercises.map(x=>`<button type="button" class=recent-item data-name="${escapeAttr(x.name)}">${escapeHtml(x.name)}</button>`).join(''):'<p class=muted>Історія вправ поки порожня</p>';R.querySelectorAll('[data-name]').forEach(b=>b.onclick=()=>addExercise(b.dataset.name));C.value='';D.showModal()}
async function addExercise(name){name=String(name||'').trim();if(!name)return toast('Введи назву вправи');try{await api('add_exercise',{sessionId:state.session.id,name,targetSets:3,repsMin:8,repsMax:12,restSec:90});D.close();await loadState()}catch(e){toast(e.message)}}
document.querySelector('#addCustom').onclick=(e)=>{e.preventDefault();addExercise(C.value)};
async function finishWorkout() {
  if (!state.session?.id) {
    toast('Активне тренування не знайдено');
    return;
  }

  try {
    const result = await api('finish', {
      sessionId: Number(state.session.id),
    });

    A.innerHTML = `
      <div class="card">
        <h2>Тренування завершено ✅</h2>

        <p>
          ${result?.exerciseCount || 0} вправ ·
          ${result?.setCount || 0} підходів
        </p>

        <button class="big" id="closeWorkoutApp">
          Готово
        </button>
      </div>
    `;

    const closeButton =
      document.querySelector('#closeWorkoutApp');

    closeButton?.addEventListener('click', () => {
      if (tg?.close) {
        tg.close();
        return;
      }

      if (window.history.length > 1) {
        window.history.back();
        return;
      }

      window.close();
    });
  } catch (error) {
    toast(
      error?.message ||
      'Не вдалося завершити тренування'
    );
  }
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}function escapeAttr(v){return escapeHtml(v)}
boot();
