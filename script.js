// Modais: saída animada (o fechamento real só acontece depois da animação de 1s)
(() => {
  const proto = HTMLDialogElement.prototype;
  const nativeClose = proto.close;
  const nativeShow = proto.showModal;
  const timers = new WeakMap();
  const duration = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1000);
  proto.close = function (returnValue) {
    if (!this.open || timers.has(this)) return;
    const ms = duration();
    if (!ms) { nativeClose.call(this, returnValue); return; }
    this.classList.add('is-closing');
    timers.set(this, window.setTimeout(() => {
      timers.delete(this);
      this.classList.remove('is-closing');
      nativeClose.call(this, returnValue);
    }, ms));
  };
  proto.showModal = function () {
    if (timers.has(this)) {
      window.clearTimeout(timers.get(this));
      timers.delete(this);
      this.classList.remove('is-closing');
      return;
    }
    nativeShow.call(this);
  };
  document.addEventListener('cancel', (event) => {
    if (event.target instanceof HTMLDialogElement) {
      event.preventDefault();
      event.target.close();
    }
  }, true);
})();

const opening = document.querySelector('.opening');
const shimmer = document.querySelector('.opening__shimmer img');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const mobileLayout = window.matchMedia('(max-width: 767px)');
const videoIntro = document.querySelector('#videoIntro');
const videoIntroMedia = document.querySelector('#videoIntroMedia');
const videoIntroSkip = document.querySelector('#videoIntroSkip');
const openingVideo = document.querySelector('#openingVideo');
const infoLayers = [
  document.querySelector('.opening__layer--city'),
  document.querySelector('.opening__layer--date'),
  document.querySelector('.opening__layer--place'),
  document.querySelector('.opening__layer--url')
];
const infoTriggers = [...document.querySelectorAll('.opening__info-trigger')];
let shimmerTimer;

function scheduleShimmer(delay = 3500 + Math.random() * 5000) {
  clearTimeout(shimmerTimer);
  if (document.hidden || reducedMotion.matches) return;
  shimmerTimer = setTimeout(() => shimmer.classList.add('is-reflecting'), delay);
}

shimmer.addEventListener('animationend', () => {
  shimmer.classList.remove('is-reflecting');
  scheduleShimmer();
});

function syncMobileTriggers() {
  infoTriggers.forEach((trigger) => {
    trigger.tabIndex = mobileLayout.matches ? 0 : -1;
    if (mobileLayout.matches) trigger.removeAttribute('aria-hidden');
    else trigger.setAttribute('aria-hidden', 'true');
  });
}

infoTriggers.forEach((trigger, index) => {
  trigger.addEventListener('click', () => {
    if (!mobileLayout.matches) return;
    const layer = infoLayers[index];
    layer.animate([
      { transform: 'translateX(-8px)', opacity: .45 },
      { transform: 'translateX(5px)', opacity: 1 },
      { transform: 'translateX(0)', opacity: 1 }
    ], { duration: 420, easing: 'ease-out' });
  });
});

syncMobileTriggers();
mobileLayout.addEventListener?.('change', syncMobileTriggers);

let openingStarted = false;

// Vídeo de fundo do hero: ciclos curtos para não ficar rodando o tempo todo.
// Cada ciclo (fade in + vídeo + fade out) dura 15 s e termina com o vídeo pausado.
// Um novo ciclo só começa depois que o usuário sai do hero, volta e fica 20 s seguidos nele.
const HERO_VIDEO_OPACITY = .45;
const HERO_VIDEO_FADE_MS = 1500;
const HERO_VIDEO_CYCLE_MS = 15000;
const HERO_VIDEO_REPLAY_DELAY_MS = 20000;
const HERO_VISIBLE_RATIO = .3;

let heroRatioVisible = true;
let heroVideoReady = false;
let heroVideoState = 'paused'; // 'playing' | 'fading-out' | 'paused'
let heroVideoPlayedOnce = false;
let heroVideoNeedsReentry = false;
let heroVideoCycleTimer;
let heroVideoPauseTimer;
let heroVideoReplayTimer;

const heroActive = () => heroRatioVisible && !document.hidden;

function setHeroVideoOpacity(value) {
  opening.style.setProperty('--video-opacity-duration', `${HERO_VIDEO_FADE_MS / 1000}s`);
  opening.style.setProperty('--video-opacity', String(value));
}

function scheduleHeroVideoReplay() {
  window.clearTimeout(heroVideoReplayTimer);
  if (!heroVideoReady || heroVideoState !== 'paused' || heroVideoNeedsReentry || !heroActive() || reducedMotion.matches) return;
  heroVideoReplayTimer = window.setTimeout(startHeroVideoCycle, heroVideoPlayedOnce ? HERO_VIDEO_REPLAY_DELAY_MS : 0);
}

function startHeroVideoCycle() {
  window.clearTimeout(heroVideoReplayTimer);
  window.clearTimeout(heroVideoPauseTimer);
  window.clearTimeout(heroVideoCycleTimer);
  if (reducedMotion.matches) return;
  heroVideoState = 'playing';
  heroVideoPlayedOnce = true;
  heroVideoNeedsReentry = false;
  heroVideoCycleTimer = window.setTimeout(endHeroVideoCycle, HERO_VIDEO_CYCLE_MS - HERO_VIDEO_FADE_MS);
  Promise.resolve(openingVideo.play()).then(() => {
    if (heroVideoState !== 'playing') return;
    opening.classList.add('has-video-continuation');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (heroVideoState === 'playing') setHeroVideoOpacity(HERO_VIDEO_OPACITY);
    }));
  }).catch(() => {
    window.clearTimeout(heroVideoCycleTimer);
    heroVideoState = 'paused';
  });
}

function endHeroVideoCycle() {
  if (heroVideoState !== 'playing') return;
  window.clearTimeout(heroVideoCycleTimer);
  heroVideoState = 'fading-out';
  // Fim natural com o usuário ainda no hero: exige sair e voltar. Saída no meio do ciclo: já saiu.
  heroVideoNeedsReentry = heroActive();
  setHeroVideoOpacity(0);
  heroVideoPauseTimer = window.setTimeout(() => {
    openingVideo.pause();
    heroVideoState = 'paused';
    scheduleHeroVideoReplay();
  }, HERO_VIDEO_FADE_MS + 60);
}

function syncHeroVideoPresence() {
  if (!heroVideoReady) return;
  if (heroActive()) {
    scheduleHeroVideoReplay();
    return;
  }
  window.clearTimeout(heroVideoReplayTimer);
  if (heroVideoState === 'playing') endHeroVideoCycle();
  else heroVideoNeedsReentry = false;
}

function beginHeroVideoContinuation() {
  heroVideoReady = true;
  setHeroVideoOpacity(0);
  if (heroActive()) startHeroVideoCycle();
  else scheduleHeroVideoReplay();
}

new IntersectionObserver(([entry]) => {
  heroRatioVisible = entry.intersectionRatio >= HERO_VISIBLE_RATIO;
  syncHeroVideoPresence();
}, { threshold: [0, HERO_VISIBLE_RATIO] }).observe(opening);

function startOpening() {
  if (openingStarted) return;
  openingStarted = true;
  Promise.allSettled([
    document.querySelector('.opening__visual').decode?.(),
    document.querySelector('.opening__layer--title img').decode?.()
  ]).then(() => requestAnimationFrame(() => {
    opening.classList.add('is-ready');
    scheduleShimmer(3000);
    setTimeout(() => {
      opening.classList.add('is-settled');
    }, 4500);
  }));
}

let introFinished = false;
const introTimer = window.setTimeout(finishIntro, 7000);

function continueVideoInOpening() {
  const introTime = Number.isFinite(videoIntroMedia.currentTime) ? videoIntroMedia.currentTime : 0;
  const startContinuation = () => {
    try {
      openingVideo.currentTime = introTime;
    } catch (_) {
      // O navegador ajustará o tempo assim que os metadados estiverem disponíveis.
    }
    beginHeroVideoContinuation();
  };

  if (openingVideo.readyState >= 1) startContinuation();
  else openingVideo.addEventListener('loadedmetadata', startContinuation, { once: true });
}

function finishIntro() {
  if (introFinished) return;
  introFinished = true;
  window.clearTimeout(introTimer);
  continueVideoInOpening();
  videoIntro.classList.add('is-leaving');
  document.body.classList.remove('intro-active');
  startOpening();
  window.setTimeout(() => {
    videoIntroMedia.pause();
    videoIntro.hidden = true;
  }, reducedMotion.matches ? 20 : 900);
}

try { sessionStorage.setItem('introSeen', '1'); } catch (_) {}

videoIntro.addEventListener('click', finishIntro);
videoIntroSkip.addEventListener('click', (event) => {
  event.stopPropagation();
  finishIntro();
});
videoIntroMedia.addEventListener('error', finishIntro);
document.addEventListener('keydown', (event) => {
  if (introFinished) return;
  if (event.code === 'Space' || event.key === 'Escape') {
    event.preventDefault();
    finishIntro();
  }
});

if (document.documentElement.classList.contains('intro-seen')) {
  // Intro já exibida nesta aba: vai direto para a abertura do site.
  finishIntro();
} else {
  videoIntroMedia.play().catch(() => {});
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearTimeout(shimmerTimer);
    syncHeroVideoPresence();
  } else {
    scheduleShimmer();
    syncHeroVideoPresence();
  }
});

const siteHeader = document.querySelector('#siteHeader');
const openingLetterbox = window.matchMedia('(max-aspect-ratio: 4/3) and (min-width: 768px)');
let headerToneFrame;

function syncOpeningVideoTop() {
  opening.style.setProperty('--video-top-offset', `${Math.round(siteHeader.offsetHeight)}px`);
}

const headerResizeObserver = new ResizeObserver(syncOpeningVideoTop);
headerResizeObserver.observe(siteHeader);
syncOpeningVideoTop();

function syncHeaderTone() {
  cancelAnimationFrame(headerToneFrame);
  headerToneFrame = requestAnimationFrame(() => {
    const sampleY = Math.min(window.innerHeight - 1, siteHeader.getBoundingClientRect().bottom + 2);
    const surface = document.elementsFromPoint(window.innerWidth / 2, sampleY)
      .map((element) => element.closest?.('[data-header-tone]'))
      .find(Boolean);
    const surfaceTone = surface?.dataset.headerTone || 'white';
    siteHeader.dataset.tone = surface === opening && openingLetterbox.matches ? 'yellow' : surfaceTone;
  });
}

syncHeaderTone();
window.addEventListener('scroll', syncHeaderTone, { passive: true });
window.addEventListener('resize', () => {
  syncHeaderTone();
  syncOpeningVideoTop();
});
openingLetterbox.addEventListener?.('change', syncHeaderTone);

const menuToggle = document.querySelector('.menu-toggle');
const siteNav = document.querySelector('.site-nav');
menuToggle.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!open));
  siteNav.classList.toggle('is-open', !open);
});
siteNav.addEventListener('click', (event) => {
  if (event.target.matches('a')) {
    siteNav.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
  }
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: .12, rootMargin: '0px 0px -40px' });
document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));

/* Inscrição do público: formulário do site enviando as respostas ao Google Forms.
   Em telas pequenas (ou baixas) o formulário vira duas etapas para caber sem rolagem. */
const registrationDialog = document.querySelector('#registrationDialog');
(() => {
  const FORM_ACTION = 'https://script.google.com/macros/s/AKfycbw04lQNjf_MEgleSLvtfx7r4A3kbBYWwCGZ49EgHRRgJYs4CtgBwPngUHhj0i1PZoE/exec';
  const OPTIONAL = ['sexo', 'cidade', 'bairro', 'atividade', 'qual', 'conhecia', 'contato'];

  const form = document.querySelector('#registrationForm');
  const body = form.querySelector('[data-pub-body]');
  const foot = form.querySelector('[data-pub-foot]');
  const success = form.querySelector('[data-pub-success]');
  const warn = form.querySelector('[data-pub-warn]');
  const stepLabel = form.querySelector('[data-pub-steplabel]');
  const qualField = form.querySelector('[data-pub-qual]');
  const btnNext = form.querySelector('[data-pub-next]');
  const btnBack = form.querySelector('[data-pub-back]');
  const btnSkip = form.querySelector('[data-pub-skip]');
  const btnSubmit = form.querySelector('[data-pub-submit]');
  const stepQuery = matchMedia('(max-width: 767px), (max-height: 720px)');
  let sending = false;

  const field = (name) => form.elements[name];
  const digits = (value) => value.replace(/\D/g, '');

  function formatPhone(value) {
    const d = digits(value).slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : '';
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 3)}.${d.slice(3, 7)}-${d.slice(7)}`;
  }

  function showWarn(message) {
    if (!message) { warn.hidden = true; warn.textContent = ''; return; }
    warn.textContent = message;
    warn.hidden = false;
    warn.classList.remove('is-shaking'); void warn.offsetWidth; warn.classList.add('is-shaking');
  }

  function setError(input, message) {
    const error = input.closest('label').querySelector('.public-error');
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (error) { error.textContent = message || ''; error.hidden = !message; }
  }

  function validateRequired() {
    const nome = field('nome');
    const idade = field('idade');
    const telefone = field('telefone');
    const checks = [
      [nome, nome.value.trim().length >= 3 ? '' : 'Informe seu nome completo.'],
      [idade, /^\d{1,3}$/.test(idade.value) && +idade.value >= 1 && +idade.value <= 120 ? '' : 'Informe uma idade entre 1 e 120.'],
      [telefone, [10, 11].includes(digits(telefone.value).length) ? '' : 'Informe o telefone com DDD.'],
    ];
    let firstInvalid = null;
    checks.forEach(([input, message]) => { setError(input, message); if (message && !firstInvalid) firstInvalid = input; });
    if (firstInvalid) {
      showWarn('');
      firstInvalid.focus();
      return false;
    }
    showWarn('');
    return true;
  }

  const TOTAL_STEPS = 3;
  function isStepped() { return form.classList.contains('is-stepped'); }
  function currentStep() { return Number(form.dataset.step || 1); }

  function setStep(step) {
    form.dataset.step = String(step);
    const stepped = isStepped();
    stepLabel.textContent = stepped ? ` · Etapa ${step} de ${TOTAL_STEPS}` : '';
    btnNext.hidden = !stepped || step >= TOTAL_STEPS;
    btnBack.hidden = !stepped || step === 1;
    btnSkip.hidden = !stepped || step !== 2;
    btnSubmit.hidden = stepped && step !== TOTAL_STEPS;
  }

  function applyLayout() {
    form.classList.toggle('is-stepped', stepQuery.matches);
    setStep(stepQuery.matches ? Number(form.dataset.step || 1) : 1);
  }

  function syncQual() {
    const yes = form.querySelector('input[name="atividade"]:checked')?.value === 'Sim';
    qualField.hidden = !yes;
    if (!yes) field('qual').value = '';
  }

  function resetForm() {
    form.reset();
    form.querySelectorAll('[aria-invalid]').forEach((input) => setError(input, ''));
    showWarn('');
    syncQual();
    sending = false;
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Enviar inscrição';
    success.hidden = true;
    body.hidden = false;
    foot.hidden = false;
    form.dataset.step = '1';
    applyLayout();
  }

  async function send() {
    if (sending) return;
    if (!validateRequired()) { if (isStepped()) setStep(1); return; }
    const payload = {
      kind: 'publico',
      protocolo: 'PUB-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
      origem: 'site',
      nome: field('nome').value.trim(),
      idade: String(+field('idade').value),
      telefone: formatPhone(field('telefone').value),
    };
    OPTIONAL.forEach((name) => {
      const input = form.querySelector(`[name="${name}"]:checked`) || form.querySelector(`input[type="text"][name="${name}"]`);
      const value = input ? input.value.trim() : '';
      if (value) payload[name] = value;
    });
    sending = true;
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Enviando…';
    showWarn('');
    try {
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch(FORM_ACTION, { method: 'POST', redirect: 'follow', body: JSON.stringify(payload), signal: ctrl.signal });
      window.clearTimeout(timer);
      const out = await res.json();
      if (!out || !out.ok) throw new Error('rejeitado');
      body.hidden = true;
      foot.hidden = true;
      success.hidden = false;
      stepLabel.textContent = '';
      success.querySelector('button').focus();
    } catch (error) {
      showWarn('Não foi possível enviar agora. Verifique sua conexão e tente de novo, ou fale com a organização em "Mais informações".');
      sending = false;
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Enviar inscrição';
    }
  }

  field('telefone').addEventListener('input', (event) => { event.target.value = formatPhone(event.target.value); });
  form.querySelectorAll('input[name="nome"], input[name="idade"], input[name="telefone"]').forEach((input) => {
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') setError(input, '');
      if (!warn.hidden && !form.querySelector('[aria-invalid="true"]')) showWarn('');
    });
  });

  // Opções opcionais: tocar de novo na opção marcada desmarca.
  form.querySelectorAll('.public-pills label').forEach((label) => {
    const radio = label.querySelector('input');
    label.addEventListener('pointerdown', () => { label.dataset.wasChecked = String(radio.checked); });
    label.addEventListener('click', (event) => {
      if (event.target !== radio && label.dataset.wasChecked === 'true') {
        event.preventDefault();
        radio.checked = false;
      }
      label.dataset.wasChecked = 'false';
      if (radio.name === 'atividade') requestAnimationFrame(syncQual);
    });
  });
  form.querySelectorAll('input[name="atividade"]').forEach((radio) => radio.addEventListener('change', syncQual));

  btnNext.addEventListener('click', () => {
    if (currentStep() === 1 && !validateRequired()) return;
    showWarn('');
    setStep(Math.min(TOTAL_STEPS, currentStep() + 1));
  });
  btnBack.addEventListener('click', () => { showWarn(''); setStep(Math.max(1, currentStep() - 1)); });
  btnSkip.addEventListener('click', () => send());
  form.addEventListener('submit', (event) => { event.preventDefault(); send(); });
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.matches('input') && isStepped() && currentStep() < TOTAL_STEPS) {
      event.preventDefault();
      btnNext.click();
    }
  });

  document.querySelectorAll('[data-open-registration]').forEach((button) => {
    button.addEventListener('click', () => {
      resetForm();
      document.documentElement.classList.add('athlete-modal-open');
      registrationDialog.showModal();
      field('nome').focus();
    });
  });
  form.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => registrationDialog.close()));
  registrationDialog.addEventListener('close', () => document.documentElement.classList.remove('athlete-modal-open'));
  stepQuery.addEventListener?.('change', () => { if (registrationDialog.open && success.hidden) applyLayout(); });
  applyLayout();
})();

const galleryDialog = document.querySelector('#galleryDialog');
const galleryImage = galleryDialog.querySelector('img');
document.querySelectorAll('[data-gallery-src]').forEach((button) => {
  button.addEventListener('click', () => {
    galleryImage.src = button.dataset.gallerySrc;
    galleryImage.alt = button.querySelector('img').alt;
    galleryDialog.showModal();
  });
});
document.querySelector('[data-close-gallery]').addEventListener('click', () => galleryDialog.close());
galleryDialog.addEventListener('click', (event) => {
  if (event.target === galleryDialog) galleryDialog.close();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (registrationDialog.open) registrationDialog.close();
    if (galleryDialog.open) galleryDialog.close();
  }
});

// Selo Kupim Digital: mede a largura para a abertura e exige dois toques no celular.
(() => {
  const wrap = document.getElementById('kupim-badge-wrap');
  const badge = document.getElementById('kupim-badge');
  if (!wrap || !badge) return;

  const updateShift = () => {
    const full = badge.scrollWidth;
    wrap.style.setProperty('--k-shift', `${Math.max(full - 44, 0)}px`);
  };

  updateShift();
  window.addEventListener('load', updateShift);
  window.addEventListener('resize', updateShift);
  document.fonts?.ready.then(updateShift);
  requestAnimationFrame(() => requestAnimationFrame(updateShift));

  if (!matchMedia('(hover: none)').matches) return;
  badge.addEventListener('click', (event) => {
    if (wrap.classList.contains('is-open')) return;
    event.preventDefault();
    wrap.classList.add('is-open');
    const closeOnce = (outsideEvent) => {
      if (wrap.contains(outsideEvent.target)) return;
      wrap.classList.remove('is-open');
      document.removeEventListener('click', closeOnce);
    };
    document.addEventListener('click', closeOnce);
  });
})();

/* Inscrição de atletas: lote vigente, encerramento e fluxo em duas etapas
   (leitura obrigatória do texto da federação → aviso do vídeo tutorial → CONBRAKS).
   O endereço da ficha só é usado no último botão, depois das duas confirmações. */
(function(){
  var REG_URL='https://www.conbraks.com.br/campeonato-brasileiro-2026';
  var CLOSE_AT=new Date('2026-10-10T23:59:59-03:00').getTime(); /* encerra em 11/10 às 00h, horário de Brasília */
  var now=Date.now(),found=false;

  document.querySelectorAll('[data-lot-until]').forEach(function(li){
    var end=new Date(li.dataset.lotUntil+'T23:59:59-03:00').getTime();
    if(end<now){li.classList.add('is-past')}else if(!found){found=true;li.classList.add('is-current');li.setAttribute('aria-current','true')}
  });

  var cta=document.querySelector('[data-athlete-cta]');
  var closedBox=document.querySelector('[data-athlete-closed]');
  var lotsClosed=document.querySelector('[data-lots-closed]');
  if(now>CLOSE_AT){
    if(lotsClosed)lotsClosed.hidden=false;
    if(cta)cta.remove();
    if(closedBox)closedBox.hidden=false;
    return;
  }
  if(!cta)return;

  var root=document.documentElement;
  var readDlg=document.querySelector('#athleteReadDialog');
  var videoDlg=document.querySelector('#athleteVideoDialog');
  var box=readDlg.querySelector('[data-read-scroll]');
  var bar=readDlg.querySelector('[data-read-bar]');
  var status=readDlg.querySelector('[data-read-status]');
  var check=readDlg.querySelector('[data-read-check]');
  var checkWrap=readDlg.querySelector('[data-read-check-wrap]');
  var cont=readDlg.querySelector('[data-read-continue]');
  var warn=readDlg.querySelector('[data-read-warn]');
  var vCheck=videoDlg.querySelector('[data-video-check]');
  var vGo=videoDlg.querySelector('[data-video-go]');
  var vBack=videoDlg.querySelector('[data-video-back]');
  var vWarn=videoDlg.querySelector('[data-video-warn]');
  var reachedEnd=false;
  var END_TOLERANCE=12; /* px: evita travar por arredondamento de pixels */

  function showWarn(el,msg){
    if(!msg){el.hidden=true;el.textContent='';return}
    el.textContent=msg;el.hidden=false;
    el.classList.remove('is-shaking');void el.offsetWidth;el.classList.add('is-shaking');
  }
  function setDisabled(btn,off){btn.setAttribute('aria-disabled',String(off));btn.classList.toggle('is-disabled',off)}

  function updateRead(){
    var max=box.scrollHeight-box.clientHeight;
    var pct=max<=0?1:Math.min(1,box.scrollTop/max);
    bar.style.transform='scaleX('+pct+')';
    if(reachedEnd)return;
    if(max<=END_TOLERANCE||box.scrollTop>=max-END_TOLERANCE){
      reachedEnd=true;
      checkWrap.classList.remove('is-locked');
      check.removeAttribute('aria-disabled');
      status.textContent='Texto lido até o fim. Agora marque a confirmação de leitura.';
      status.classList.add('is-done');
      showWarn(warn,'');
    }else{
      status.textContent='Role o texto até o fim para liberar a confirmação · '+Math.round(pct*100)+'% lido';
    }
  }
  function syncContinue(){setDisabled(cont,!(reachedEnd&&check.checked))}
  function syncGo(){setDisabled(vGo,!vCheck.checked)}

  function resetFlow(){
    reachedEnd=false;
    check.checked=false;check.setAttribute('aria-disabled','true');
    checkWrap.classList.add('is-locked');
    status.classList.remove('is-done');
    showWarn(warn,'');syncContinue();
    vCheck.checked=false;showWarn(vWarn,'');syncGo();
  }
  function lock(){root.classList.add('athlete-modal-open')}
  function unlockIfIdle(){if(!readDlg.open&&!videoDlg.open)root.classList.remove('athlete-modal-open')}

  cta.addEventListener('click',function(){
    resetFlow();lock();
    readDlg.showModal();
    box.scrollTop=0;box.focus({preventScroll:true});
    requestAnimationFrame(updateRead);
  });

  box.addEventListener('scroll',updateRead,{passive:true});
  window.addEventListener('resize',function(){if(readDlg.open)updateRead()});

  check.addEventListener('click',function(e){
    if(!reachedEnd){e.preventDefault();showWarn(warn,'Leia o texto todo antes: role a caixa até o fim para liberar a confirmação.')}
  });
  check.addEventListener('change',function(){syncContinue();if(check.checked)showWarn(warn,'')});

  cont.addEventListener('click',function(){
    if(!(reachedEnd&&check.checked)){
      showWarn(warn,'Para continuar, leia o texto até o fim e marque a confirmação de leitura.');
      return;
    }
    readDlg.close();
    vCheck.checked=false;showWarn(vWarn,'');syncGo();
    lock();videoDlg.showModal();
  });

  vCheck.addEventListener('change',function(){syncGo();if(vCheck.checked)showWarn(vWarn,'')});
  vGo.addEventListener('click',function(){
    if(!vCheck.checked){showWarn(vWarn,'Marque que entendeu o aviso para seguir para a inscrição.');return}
    window.open(REG_URL,'_blank','noopener');
    videoDlg.close();
  });
  vBack.addEventListener('click',function(){
    videoDlg.close();lock();readDlg.showModal();
  });

  document.querySelectorAll('[data-athlete-close]').forEach(function(btn){
    btn.addEventListener('click',function(){btn.closest('dialog').close()});
  });
  [readDlg,videoDlg].forEach(function(d){d.addEventListener('close',unlockIfIdle)});
  document.addEventListener('keydown',function(e){
    if(e.key!=='Escape')return;
    if(videoDlg.open){e.preventDefault();videoDlg.close()}
    else if(readDlg.open){e.preventDefault();readDlg.close()}
  });
})();


(() => {
  const dialog = document.querySelector('#sponsorDialog');
  if (!dialog) return;
  const root = document.documentElement;
  const tab = document.querySelector('.opening__sponsor-tab');
  const opening = document.querySelector('#inicio');
  document.querySelectorAll('[data-open-sponsor]').forEach((button) => {
    button.addEventListener('click', () => {
      root.classList.add('athlete-modal-open');
      if (button === tab) tab.classList.add('is-clicked');
      dialog.showModal();
    });
  });
  // A aba "espia" uma vez assim que a abertura fica pronta.
  if (tab && opening) {
    const peek = () => {
      window.setTimeout(() => tab.classList.add('is-peeking'), 1000);
      window.setTimeout(() => tab.classList.remove('is-peeking'), 4000);
    };
    if (opening.classList.contains('is-ready')) peek();
    else {
      const watcher = new MutationObserver(() => {
        if (opening.classList.contains('is-ready')) { watcher.disconnect(); peek(); }
      });
      watcher.observe(opening, { attributes: true, attributeFilter: ['class'] });
    }
  }
  dialog.querySelectorAll('[data-close-sponsor]').forEach((button) => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('close', () => { root.classList.remove('athlete-modal-open'); tab?.classList.remove('is-clicked'); });
})();


/* Atletas confirmados: envio da foto para as artes (Google Forms externo).
   O botão abre um modal de orientações e o formulário abre em nova aba.
   Depois de PHOTO_CLOSE_AT o botão some e os textos trocam para a versão "encerrado". */
(function(){
  var PHOTO_CLOSE_AT=new Date('2026-11-01T23:59:59-03:00').getTime(); /* encerra em 02/11 às 00h, horário de Brasília */
  var cta=document.querySelector('[data-photo-cta]');
  var dlg=document.querySelector('#photoDialog');
  if(Date.now()>PHOTO_CLOSE_AT){
    if(cta)cta.remove();
    var closed=document.querySelector('[data-photo-closed]');if(closed)closed.hidden=false;
    document.querySelectorAll('[data-photo-only]').forEach(function(el){el.hidden=true});
    document.querySelectorAll('[data-photo-after-text]').forEach(function(el){el.textContent=el.dataset.photoAfterText});
    return;
  }
  if(!cta||!dlg)return;
  var root=document.documentElement;
  cta.addEventListener('click',function(){root.classList.add('athlete-modal-open');dlg.showModal()});
  dlg.querySelectorAll('[data-photo-close]').forEach(function(b){b.addEventListener('click',function(){dlg.close()})});
  dlg.querySelector('[data-photo-go]').addEventListener('click',function(){setTimeout(function(){dlg.close()},0)});
  dlg.addEventListener('click',function(e){if(e.target===dlg)dlg.close()});
  dlg.addEventListener('close',function(){root.classList.remove('athlete-modal-open');cta.focus({preventScroll:true})});
})();

/* ===== Entenda a modalidade: vídeo do YouTube ===== */
(() => {
  const box = document.querySelector('#sportVideo');
  if (!box) return;
  const VIDEO_ID = box.dataset.videoId;
  const frame = box.querySelector('.sport-video__frame');
  const poster = box.querySelector('.sport-video__poster');
  const mount = box.querySelector('#sportVideoPlayer');
  const soundBtn = box.querySelector('.sport-video__sound');
  const soundTxt = soundBtn.querySelector('span');
  const fsBtn = box.querySelector('.sport-video__fs');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canFullscreen = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  let player = null;
  let ready = false;
  let visible = false;
  let finished = false;
  let userPaused = false;
  let autoPaused = false;
  let requested = false;

  function syncSound() {
    if (!ready) return;
    let muted = true;
    try { muted = player.isMuted(); } catch (_) {}
    if (!muted) { soundBtn.hidden = true; return; }
    soundTxt.textContent = player.getPlayerState() === 1
      ? '🔇 Clique no vídeo para assistir com som'
      : '▶ Clique para assistir com som';
    soundBtn.hidden = false;
  }

  function tryPlay() {
    if (!ready || !visible || finished || userPaused || reduced.matches) return;
    if (player.getPlayerState() !== 1) player.playVideo();
  }

  function withSound() {
    player.unMute();
    player.setVolume(100);
    if (player.getPlayerState() !== 1) player.playVideo();
    soundBtn.hidden = true;
  }

  function onReady() {
    ready = true;
    player.mute();
    poster.hidden = true;
    if (canFullscreen) fsBtn.hidden = false;
    syncSound();
    tryPlay();
  }

  function onState(event) {
    if (event.data === 1) { finished = false; userPaused = false; }
    if (event.data === 2) { userPaused = !autoPaused; autoPaused = false; }
    if (event.data === 0) {
      // Fim do vídeo: volta para a capa, já com som, e não reinicia sozinho.
      finished = true;
      player.unMute();
      player.cueVideoById(VIDEO_ID);
    }
    syncSound();
  }

  function onError() {
    // Se o YouTube não permitir o player, a capa vira link direto para o vídeo.
    ready = false;
    poster.hidden = false;
    soundBtn.hidden = true;
    fsBtn.hidden = true;
  }

  function createPlayer() {
    if (requested) return;
    requested = true;
    const make = () => {
      const vars = { rel: 0, playsinline: 1, modestbranding: 1, fs: 1, iv_load_policy: 3, hl: 'pt-BR' };
      if (/^https?:$/.test(location.protocol)) vars.origin = location.origin;
      player = new YT.Player(mount, {
        videoId: VIDEO_ID,
        width: '100%',
        height: '100%',
        playerVars: vars,
        events: { onReady, onStateChange: onState, onError }
      });
    };
    if (window.YT && window.YT.Player) { make(); return; }
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (previous) previous(); make(); };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.head.appendChild(script);
  }

  // O player só é carregado perto da seção, para não pesar o início do site.
  new IntersectionObserver((entries, observer) => {
    if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); createPlayer(); }
  }, { rootMargin: '700px 0px' }).observe(box);

  // Toca (mudo) ao entrar na tela e pausa ao sair.
  new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      visible = entry.intersectionRatio >= 0.5;
      if (!ready) return;
      if (visible) tryPlay();
      else if (player.getPlayerState() === 1) { autoPaused = true; player.pauseVideo(); }
    });
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] }).observe(frame);

  soundBtn.addEventListener('click', () => { if (ready) withSound(); });

  fsBtn.addEventListener('click', () => {
    if (!ready) return;
    withSound();
    const el = player.getIframe();
    const request = el.requestFullscreen || el.webkitRequestFullscreen;
    if (request) { const result = request.call(el); if (result && result.catch) result.catch(() => {}); }
  });
  document.addEventListener('fullscreenchange', syncSound);
})();

/* ===== Workshop de arbitragem: modal, aba do Hero e atalhos ===== */
(() => {
  const dialog = document.querySelector('#workshopDialog');
  if (!dialog) return;
  const root = document.documentElement;
  const tab = document.querySelector('.opening__workshop-tab');
  const opening = document.querySelector('#inicio');

  document.querySelectorAll('[data-open-workshop]').forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      if (trigger === tab) tab.classList.add('is-clicked');
      root.classList.add('athlete-modal-open');
      if (!dialog.open) dialog.showModal();
    });
  });

  // A aba "espia" uma vez, junto com a aba de patrocínio (mesmos tempos).
  if (tab && opening) {
    const peek = () => {
      window.setTimeout(() => tab.classList.add('is-peeking'), 1000);
      window.setTimeout(() => tab.classList.remove('is-peeking'), 4000);
    };
    if (opening.classList.contains('is-ready')) peek();
    else {
      const watcher = new MutationObserver(() => {
        if (opening.classList.contains('is-ready')) { watcher.disconnect(); peek(); }
      });
      watcher.observe(opening, { attributes: true, attributeFilter: ['class'] });
    }
  }

  dialog.querySelectorAll('[data-close-workshop]').forEach((button) => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('close', () => { root.classList.remove('athlete-modal-open'); tab?.classList.remove('is-clicked'); });

  // Copiar a chave PIX (somente números).
  const copyBtn = dialog.querySelector('[data-copy-pix]');
  const status = dialog.querySelector('[data-copy-status]');
  if (copyBtn) {
    const value = copyBtn.dataset.copyPix;
    const done = (ok) => {
      if (!status) return;
      status.textContent = ok ? 'CNPJ copiado!' : 'Não foi possível copiar. Selecione o número e copie.';
      window.setTimeout(() => { status.textContent = ''; }, 3500);
    };
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(value);
        done(true);
      } catch (_) {
        try {
          const field = document.createElement('textarea');
          field.value = value;
          field.setAttribute('readonly', '');
          field.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
          dialog.appendChild(field);
          field.select();
          const ok = document.execCommand('copy');
          field.remove();
          done(ok);
        } catch (__) { done(false); }
      }
    });
  }
})();

/* ===== Abas laterais do Hero no celular: mesmo comportamento do desktop =====
   No desktop a aba se expande ao passar o mouse e recolhe ao sair. No toque não existe "hover":
   o 1º toque expande a aba (recolhe sozinha após alguns segundos ou ao tocar fora) e o 2º toque, com a aba aberta, abre o modal. */
(() => {
  if (!window.matchMedia('(hover: none)').matches) return;
  const tabs = [...document.querySelectorAll('.opening__sponsor-tab, .opening__workshop-tab')];
  if (!tabs.length) return;
  const timers = new WeakMap();
  const collapse = (tab) => { window.clearTimeout(timers.get(tab)); tab.classList.remove('is-peeking'); };
  const expand = (tab) => {
    tabs.forEach((other) => { if (other !== tab) collapse(other); });
    tab.classList.add('is-peeking');
    window.clearTimeout(timers.get(tab));
    timers.set(tab, window.setTimeout(() => collapse(tab), 3500));
  };
  document.addEventListener('click', (event) => {
    const tab = event.target.closest('.opening__sponsor-tab, .opening__workshop-tab');
    if (!tab) { tabs.forEach(collapse); return; }
    if (!tab.classList.contains('is-peeking')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      expand(tab);
    } else {
      collapse(tab); // 2º toque: deixa o clique seguir e abrir o modal
    }
  }, true);
})();

/* ===== Workshop: inscrição dentro do site (1 formulário → 2 Pix → 3 comprovante) =====
   Tudo grava na planilha única (aba "Workshop") pelo mesmo endpoint dos outros formulários. */
(() => {
  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbw04lQNjf_MEgleSLvtfx7r4A3kbBYWwCGZ49EgHRRgJYs4CtgBwPngUHhj0i1PZoE/exec';
  const WA = 'https://wa.me/5555999765702';
  const CATS = {
    atleta: { valor: 80, label: 'Atleta participante do 7º Campeonato Brasileiro Recife 2026' },
    filiado: { valor: 120, label: 'Atleta filiado à CONBRAKS, federação ou associação de kettlebell' },
    geral: { valor: 150, label: 'Não filiado e não participante do campeonato' },
  };
  const $ = (id) => document.getElementById(id);
  const dlgForm = $('wsFormDialog'), dlgPix = $('wsPixDialog'), dlgProof = $('wsProofDialog');
  if (!dlgForm || !dlgPix || !dlgProof) return;
  const form = $('wsForm'), proofForm = $('wsProofForm');
  const state = { protocolo: '', email: '', valor: 0, categoria: '' };
  const wait = (ms) => new Promise((r) => window.setTimeout(r, ms));
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  function maskPhone(v) {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 3)}.${d.slice(3, 7)}-${d.slice(7)}`;
  }
  const phone = form.elements.telefone;
  phone.addEventListener('input', () => { phone.value = maskPhone(phone.value); });

  const err = (input, msg) => {
    const small = input.closest('label')?.querySelector('.public-error');
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (small) { small.textContent = msg || ''; small.hidden = !msg; }
  };
  const warn = (dlg, html) => {
    const p = dlg.querySelector('[data-ws-warn]');
    if (!p) return;
    p.innerHTML = html || '';
    p.hidden = !html;
  };
  const fillProto = () => {
    document.querySelectorAll('[data-ws-proto]').forEach((el) => { el.textContent = state.protocolo || '—'; });
  };
  const open = (dlg) => { if (!dlg.open) dlg.showModal(); };

  document.querySelectorAll('[data-ws-close]').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('dialog').close());
  });

  /* limpa os avisos de erro assim que a pessoa corrige o campo */
  form.addEventListener('input', (event) => {
    const t = event.target;
    if (t.getAttribute && t.getAttribute('aria-invalid') === 'true') err(t, '');
    if (t.name === 'categoria') { const c = form.querySelector('[data-ws-cat-error]'); c.hidden = true; }
    if (t.name === 'ciente' || t.name === 'lgpd') { const c = form.querySelector('[data-ws-check-error]'); if (form.elements.ciente.checked && form.elements.lgpd.checked) c.hidden = true; }
    if (!form.querySelector('[aria-invalid="true"]') && form.querySelector('[data-ws-cat-error]').hidden && form.querySelector('[data-ws-check-error]').hidden) warn(dlgForm, '');
  });
  form.addEventListener('change', (event) => { if (event.target.type === 'radio' || event.target.type === 'checkbox') form.dispatchEvent(new Event('input')); });

  /* Passo 1 · abrir o formulário */
  document.querySelectorAll('[data-ws-open-form]').forEach((btn) => btn.addEventListener('click', () => {
    form.dataset.t0 = String(Date.now());
    warn(dlgForm, '');
    open(dlgForm);
    form.elements.nome.focus({ preventScroll: true });
  }));

  async function post(payload) {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(ENDPOINT, { method: 'POST', redirect: 'follow', body: JSON.stringify(payload), signal: ctrl.signal });
      const out = await res.json();
      if (!out || !out.ok) throw new Error((out && out.erro) || 'rejeitado');
      return out;
    } finally { window.clearTimeout(timer); }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const f = form.elements;
    let first = null;
    const bad = (input, msg) => { err(input, msg); if (!first) first = input; };
    ['nome', 'email', 'cidade_estado'].forEach((n) => err(f[n], ''));
    if (f.nome.value.trim().length < 3) bad(f.nome, 'Informe seu nome.');
    if (!emailOk(f.email.value.trim())) bad(f.email, 'Informe um e-mail válido.');
    if (f.cidade_estado.value.trim().length < 2) bad(f.cidade_estado, 'Informe cidade e estado.');
    const cat = form.querySelector('input[name="categoria"]:checked');
    const catErr = form.querySelector('[data-ws-cat-error]');
    catErr.hidden = !!cat; catErr.textContent = cat ? '' : 'Escolha uma opção de investimento.';
    if (!cat && !first) first = form.querySelector('input[name="categoria"]');
    const chkErr = form.querySelector('[data-ws-check-error]');
    const checksOk = f.ciente.checked && f.lgpd.checked;
    chkErr.hidden = checksOk; chkErr.textContent = checksOk ? '' : 'Marque as duas confirmações para continuar.';
    if (!checksOk && !first) first = f.ciente;
    if (first || !cat) { first?.focus(); warn(dlgForm, 'Confira os campos destacados.'); return; }
    warn(dlgForm, '');

    const btn = form.querySelector('[data-ws-submit]');
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Enviando…';
    const spent = Date.now() - Number(form.dataset.t0 || 0);
    if (spent < 2500) await wait(2500 - spent); // atraso mínimo contra robôs
    const protocolo = 'WSH-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    try {
      await post({
        kind: 'workshop', protocolo, origem: 'site', website: f.website.value,
        nome: f.nome.value.trim(), email: f.email.value.trim(), cidade_estado: f.cidade_estado.value.trim(),
        telefone: f.telefone.value.trim(), filiacao: f.filiacao.value.trim(), categoria: cat.value,
        ciente: 'Sim, estou ciente', lgpd: 'Sim',
      });
      Object.assign(state, { protocolo, email: f.email.value.trim(), valor: CATS[cat.value].valor, categoria: CATS[cat.value].label });
      form.reset();
      dlgPix.querySelector('[data-ws-valor]').textContent = 'R$ ' + state.valor;
      dlgPix.querySelector('[data-ws-categoria]').textContent = state.categoria;
      dlgPix.querySelector('[data-ws-pay-head]').hidden = false;
      dlgPix.querySelector('[data-ws-pay]').hidden = false;
      dlgPix.querySelector('[data-ws-pay-foot]').hidden = false;
      dlgPix.querySelector('[data-ws-later]').hidden = true;
      fillProto();
      dlgForm.close();
      open(dlgPix);
    } catch (e) {
      const txt = encodeURIComponent(`Olá, Christian! Quero me inscrever no workshop de arbitragem CONBRAKS Level 1 (20/11). Nome: ${f.nome.value.trim()}.`);
      warn(dlgForm, `Não foi possível enviar agora. Tente de novo ou <a href="${WA}?text=${txt}" target="_blank" rel="noopener">fale com a organização pelo WhatsApp</a>.`);
    } finally { btn.disabled = false; btn.textContent = label; }
  });

  /* Passo 2 · Pix */
  const copyBtn = dlgPix.querySelector('[data-ws-copy]');
  const copyStatus = dlgPix.querySelector('[data-ws-copy-status]');
  copyBtn.addEventListener('click', async () => {
    const value = copyBtn.dataset.wsCopy;
    let ok = false;
    try { await navigator.clipboard.writeText(value); ok = true; } catch (e) {
      try {
        const ta = document.createElement('textarea');
        ta.value = value; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove();
      } catch (x) { ok = false; }
    }
    copyStatus.textContent = ok ? 'CNPJ copiado!' : 'Não foi possível copiar. Selecione o número e copie.';
    window.setTimeout(() => { copyStatus.textContent = ''; }, 3500);
  });
  dlgPix.querySelector('[data-ws-later-btn]').addEventListener('click', () => {
    dlgPix.querySelector('[data-ws-pay-head]').hidden = true;
    dlgPix.querySelector('[data-ws-pay]').hidden = true;
    dlgPix.querySelector('[data-ws-pay-foot]').hidden = true;
    dlgPix.querySelector('[data-ws-later]').hidden = false;
  });
  dlgPix.querySelector('[data-ws-to-proof]').addEventListener('click', () => { openProof(true); });

  /* Passo 3 · comprovante */
  function openProof(known) {
    const lookup = dlgProof.querySelector('[data-ws-lookup]');
    const knownEl = dlgProof.querySelector('[data-ws-known]');
    const hasState = known && state.protocolo;
    lookup.hidden = !!hasState;
    knownEl.hidden = !hasState;
    proofForm.elements.protocolo.value = hasState ? state.protocolo : '';
    proofForm.elements.email.value = hasState ? state.email : '';
    proofForm.elements.arquivo.value = '';
    proofForm.querySelectorAll('.public-error').forEach((s) => { s.hidden = true; });
    warn(dlgProof, '');
    dlgProof.querySelector('[data-ws-proof-head]').hidden = false;
    dlgProof.querySelector('[data-ws-proof-body]').hidden = false;
    dlgProof.querySelector('[data-ws-proof-foot]').hidden = false;
    dlgProof.querySelector('[data-ws-proof-done]').hidden = true;
    fillProto();
    if (dlgPix.open) dlgPix.close();
    open(dlgProof);
  }
  document.querySelectorAll('[data-ws-open-proof]').forEach((btn) => btn.addEventListener('click', () => openProof(false)));

  const readB64 = (blob) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  async function prepare(file) {
    if (file.type === 'application/pdf') {
      if (file.size > 4 * 1024 * 1024) throw new Error('O PDF passa de 4 MB. Envie uma foto do comprovante ou use o WhatsApp.');
      return { nome: file.name, tipo: file.type, b64: await readB64(file) };
    }
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const scale = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.82));
      return { nome: file.name.replace(/\.[^.]+$/, '') + '.jpg', tipo: 'image/jpeg', b64: await readB64(blob) };
    } finally { URL.revokeObjectURL(url); }
  }

  proofForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const f = proofForm.elements;
    const lookupVisible = !dlgProof.querySelector('[data-ws-lookup]').hidden;
    let first = null;
    const bad = (input, msg) => { err(input, msg); if (!first) first = input; };
    ['protocolo', 'email', 'arquivo'].forEach((n) => err(f[n], ''));
    const proto = f.protocolo.value.trim().toUpperCase();
    if (lookupVisible && !/^WSH-\d{8}-[A-Z0-9]{4}$/.test(proto)) bad(f.protocolo, 'Informe o protocolo no formato WSH-20261120-AB12.');
    if (lookupVisible && !emailOk(f.email.value.trim())) bad(f.email, 'Informe o e-mail usado na inscrição.');
    const file = f.arquivo.files[0];
    if (!file) bad(f.arquivo, 'Anexe o comprovante.');
    else if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(file.type)) bad(f.arquivo, 'Use JPG, PNG ou PDF.');
    else if (file.size > 12 * 1024 * 1024) bad(f.arquivo, 'Arquivo muito grande.');
    if (first) { first.focus(); warn(dlgProof, 'Confira os campos destacados.'); return; }
    warn(dlgProof, '');

    const btn = proofForm.querySelector('[data-ws-proof-submit]');
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Enviando…';
    try {
      const arq = await prepare(file);
      await post({
        kind: 'comprovante', protocolo: lookupVisible ? proto : state.protocolo,
        email: lookupVisible ? f.email.value.trim() : state.email,
        arquivo_nome: arq.nome, arquivo_tipo: arq.tipo, arquivo_base64: arq.b64,
      });
      if (lookupVisible) { state.protocolo = proto; fillProto(); }
      dlgProof.querySelector('[data-ws-proof-head]').hidden = true;
      dlgProof.querySelector('[data-ws-proof-body]').hidden = true;
      dlgProof.querySelector('[data-ws-proof-foot]').hidden = true;
      dlgProof.querySelector('[data-ws-proof-done]').hidden = false;
    } catch (e) {
      const msg = /PDF passa/.test(e.message) ? e.message : 'Não foi possível enviar agora. Confira o protocolo e o e-mail, tente de novo ou use o botão de WhatsApp.';
      warn(dlgProof, msg);
    } finally { btn.disabled = false; btn.textContent = label; }
  });

})();

// ---- Acesso oculto ao contador: 10 toques na logo do 7º Campeonato → campo de PIN ----
// (PIN guardado aqui no site de propósito: é só uma trava de tela e precisa funcionar offline)
// KB-PIN-INICIO
(() => {
  const logo = document.querySelector('.opening__layer--title');
  if (!logo) return;
  const PIN = '4250', TOQUES = 10, JANELA_MS = 3500, ERROS_MAX = 3, BLOQUEIO_MS = 10 * 60 * 1000;
  const RAPIDO_MS = 2000, PROTEGE_MS = 5000, BALANCOS = 5;
  const K_ERR = 'kb_site_pin_erros', K_BLQ = 'kb_site_pin_bloqueio';
  const DESTINO = 'contador_pwa/';
  const TITULO_C = 'assets/contador/titulo-contador.webp';
  const ASPECTO_C = 825 / 379;
  const WA = 'https://wa.me/5581996484250?text=' + encodeURIComponent('Olá Jefferson! Preciso do link direto do contador de repetições do 7º Campeonato Brasileiro de Kettlebell Sport.');
  const reduz = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const get = (k) => { try { return parseInt(localStorage.getItem(k) || '0', 10) || 0; } catch (e) { return 0; } };
  const set = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) {} };
  const del = (k) => { try { localStorage.removeItem(k); } catch (e) {} };
  const bloqueadoAte = () => { const t = get(K_BLQ); if (t && t > Date.now()) return t; if (t) del(K_BLQ); return 0; };
  const vib = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} };
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const anima = (el, kf, op) => { try { return el.animate(kf, op); } catch (e) { return { finished: Promise.resolve(), cancel() {} }; } };
  const fim = (a) => (a && a.finished ? a.finished.catch(() => {}) : Promise.resolve());
  const rectDe = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
  const setRect = (el, r) => { el.style.left = r.x + 'px'; el.style.top = r.y + 'px'; el.style.width = r.w + 'px'; el.style.height = r.h + 'px'; };
  // onde a logo do contador fica na tela do contador (as duas páginas usam esta mesma conta)
  function stdRect() {
    const W = window.innerWidth, H = window.innerHeight;
    let w = W <= H ? W * 0.86 : Math.min(W * 0.56, 825), h = w / ASPECTO_C;
    if (h > H * 0.4) { h = H * 0.4; w = h * ASPECTO_C; }
    return { x: (W - w) / 2, y: (H - 34) / 2 - h / 2, w, h };
  }

  // ---------- elementos que voam ----------
  const SEL = ['.site-header .menu-toggle', '.site-header .brand', '.site-header .participation-label', '.site-header .header-actions .button', '.site-header .site-nav a',
    '.opening__sponsor-tab', '.opening__workshop-tab', '.opening__cta .button', '.opening__enter', '.opening__info-trigger',
    '.opening__layer--city', '.opening__layer--date', '.opening__layer--place', '.opening__layer--url'].join(',');
  function alvos() {
    const W = window.innerWidth, H = window.innerHeight, out = [];
    document.querySelectorAll(SEL).forEach((el) => {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > H || r.right < 0 || r.left > W || cs.display === 'none') return;
      out.push(el);
    });
    return out;
  }
  function vetor(el, i) {
    const r = el.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
    const cx = r.x + r.width / 2 - W / 2, cy = r.y + r.height / 2 - H / 2;
    const rnd = (n) => { const x = Math.sin((i + 1) * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
    let dx, dy;
    if (Math.abs(cx) / W > Math.abs(cy) / H) { dx = Math.sign(cx || 1) * (W * 0.9 + r.width + rnd(1) * W * 0.3); dy = cy * 0.6 + (rnd(2) - 0.5) * H * 0.4; }
    else { dy = Math.sign(cy || 1) * (H * 0.9 + r.height + rnd(1) * H * 0.3); dx = cx * 0.6 + (rnd(2) - 0.5) * W * 0.4; }
    return { dx, dy, rot: (rnd(3) > 0.5 ? 1 : -1) * (360 + rnd(4) * 360), ax: -Math.sign(dx) * 10, ay: -Math.sign(dy) * 10 };
  }
  const voaSai = (el, v, i) => anima(el, [
    { transform: 'none', offset: 0 },
    { transform: `translate(${v.ax}px,${v.ay}px) scale(1.12,.88)`, offset: 0.22 },
    { transform: `translate(${v.dx}px,${v.dy}px) rotate(${v.rot}deg) scale(.5)`, offset: 1 }
  ], { duration: 750, delay: Math.min(i * 45, 450), easing: 'cubic-bezier(.55,-.25,.75,.4)', fill: 'both' });
  const voaEntra = (el, v, i) => anima(el, [
    { transform: `translate(${v.dx}px,${v.dy}px) rotate(${v.rot}deg) scale(.5)`, offset: 0 },
    { transform: 'translate(-6px,4px) scale(1.1,.9)', offset: 0.72 },
    { transform: 'none', offset: 1 }
  ], { duration: 420, delay: Math.min(i * 18, 250), easing: 'cubic-bezier(.2,.9,.3,1.05)', fill: 'both' });

  // ---------- logo clone e fundo do contador ----------
  const srcSite = () => (logo.querySelector('img') || {}).src || '';
  function criaLogo(rect, src) {
    const im = document.createElement('img');
    im.className = 'kbe-logo'; im.alt = ''; im.src = src; setRect(im, rect);
    document.body.appendChild(im); return im;
  }
  function criaFundo(cx, cy, raio) {
    const d = document.createElement('div'); d.className = 'kbe-bg';
    d.style.clipPath = `circle(${raio}px at ${cx}px ${cy}px)`;
    document.body.appendChild(d); return d;
  }
  const circulo = (cx, cy, r) => `circle(${r}px at ${cx}px ${cy}px)`;
  const P = 'perspective(800px) ';

  // ---------- PIN ----------
  const pinBox = document.createElement('div');
  pinBox.className = 'kbp'; pinBox.hidden = true;
  pinBox.innerHTML = '<input class="kbp__input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="PIN de 4 dígitos" placeholder="••••">' +
    '<div class="kbp__shake" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="3" width="8" height="18" rx="2"/><path d="M12 18h.01"/><path d="M4 8v8M2 10v4M20 8v8M22 10v4"/></svg><b>Balance o celular!</b><i><u></u></i><button type="button">ou toque aqui</button></div>';
  const input = pinBox.firstChild, shakeBox = pinBox.lastChild, shakeBar = shakeBox.querySelector('u'), shakeSkip = shakeBox.querySelector('button');
  const lockBox = document.createElement('div');
  lockBox.className = 'kbp kbp--lock'; lockBox.hidden = true;
  lockBox.innerHTML = '<div class="kbp__card" role="alertdialog" aria-modal="true" aria-labelledby="kbp-lt"><h2 id="kbp-lt">Acesso bloqueado</h2><p>Tente de novo em <b class="kbp__time">10:00</b>.</p><p>Para receber o link direto do contador, fale com o Jefferson.</p><a class="kbp__wa" target="_blank" rel="noopener">Falar com o Jefferson no WhatsApp</a><button class="kbp__close" type="button">Fechar</button></div>';
  lockBox.querySelector('.kbp__wa').href = WA;
  document.body.append(pinBox, lockBox);
  const timeEl = lockBox.querySelector('.kbp__time');

  let n = 0, ultimo = 0, tick = null, ocupado = false, qLast = 0, lastClick = 0, temSensor = false, offMotion = null, offShake = null;
  const precisaPermissao = () => typeof window.DeviceMotionEvent !== 'undefined' && typeof window.DeviceMotionEvent.requestPermission === 'function';
  const logoCentro = () => { const r = logo.getBoundingClientRect(); return { dx: r.x + r.width / 2 - window.innerWidth / 2, dy: r.y + r.height / 2 - window.innerHeight / 2 }; };

  function escutaSensor() {
    temSensor = false; if (offMotion) offMotion();
    if (precisaPermissao()) return;               // iPhone: pede permissão → não balança
    const h = (e) => { const a = e.accelerationIncludingGravity; if (a && a.x != null) { temSensor = true; window.removeEventListener('devicemotion', h); } };
    window.addEventListener('devicemotion', h);
    offMotion = () => { window.removeEventListener('devicemotion', h); offMotion = null; };
  }
  function limpaPin() {
    pinBox.style.display = ''; pinBox.hidden = true; input.value = ''; input.hidden = false; input.style.background = ''; input.blur();
    shakeBox.hidden = true; ocupado = false; n = 0;
    if (offMotion) offMotion(); if (offShake) { offShake(); offShake = null; }
    pinBox.getAnimations && pinBox.getAnimations().forEach((a) => a.cancel());
    input.getAnimations && input.getAnimations().forEach((a) => a.cancel());
  }
  // saída "curiosa": o campo é sugado de volta para a logo
  async function fechaPin(animado) {
    if (pinBox.hidden) return;
    if (!animado || reduz) { limpaPin(); return; }
    ocupado = true;
    const { dx, dy } = logoCentro();
    const a = anima(input, [
      { transform: 'none', opacity: 1, offset: 0 },
      { transform: 'translate(0,-22px) scale(1.15) rotate(-10deg)', opacity: 1, offset: 0.25 },
      { transform: `translate(${dx}px,${dy}px) scale(.05) rotate(320deg)`, opacity: 0, offset: 1 }
    ], { duration: 480, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' });
    anima(pinBox, [{ opacity: 1 }, { opacity: 0 }], { duration: 480, fill: 'forwards' });
    await fim(a);
    limpaPin();
    anima(logo, [{ filter: 'brightness(1)' }, { filter: 'brightness(1.9) drop-shadow(0 0 14px rgba(255,213,0,.95))' }, { filter: 'brightness(1)' }], { duration: 380 });
  }
  function fechaLock() { lockBox.hidden = true; clearInterval(tick); n = 0; }
  function mostraLock() {
    limpaPin();
    if (!bloqueadoAte()) return false;
    const atualiza = () => {
      const falta = Math.max(0, bloqueadoAte() - Date.now());
      if (!falta) { fechaLock(); return; }
      const s = Math.ceil(falta / 1000);
      timeEl.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    };
    atualiza(); lockBox.hidden = false;
    clearInterval(tick); tick = setInterval(atualiza, 1000);
    return true;
  }
  function abrePin() {
    limpaPin();
    pinBox.hidden = false; ocupado = false;
    qLast = lastClick = Date.now();
    new Image().src = TITULO_C;                  // já deixa a logo do contador pronta
    escutaSensor();
    const { dx, dy } = logoCentro();
    if (!reduz) anima(input, [
      { transform: `translate(${dx}px,${dy}px) scale(.05) rotate(-300deg)`, opacity: 0, offset: 0 },
      { transform: `translate(${dx * 0.1}px,${dy * 0.1 - 30}px) scale(1.2) rotate(12deg)`, opacity: 1, offset: 0.6 },
      { transform: 'translate(0,8px) scale(.94) rotate(-4deg)', offset: 0.78 },
      { transform: 'translate(0,-3px) scale(1.03) rotate(1deg)', offset: 0.9 },
      { transform: 'none', offset: 1 }
    ], { duration: 720, easing: 'cubic-bezier(.3,.7,.4,1)' });
    setTimeout(() => input.focus(), reduz ? 60 : 500);
  }
  async function erro() {
    ocupado = true;
    input.style.background = 'rgba(255,190,190,.85)';
    if (!reduz) await fim(anima(input, [{ transform: 'translateX(0)' }, { transform: 'translateX(-18px) rotate(-3deg)' }, { transform: 'translateX(16px) rotate(3deg)' }, { transform: 'translateX(-12px)' }, { transform: 'translateX(8px)' }, { transform: 'none' }], { duration: 420 }));
    await fechaPin(true);
    window.scrollTo({ top: 0, behavior: 'auto' });
    const e = get(K_ERR) + 1;
    if (e >= ERROS_MAX) { del(K_ERR); set(K_BLQ, Date.now() + BLOQUEIO_MS); mostraLock(); }
    else set(K_ERR, e);
  }

  // ---------- PIN certo: balançar (se der) e revelar o contador ----------
  async function acerto() {
    ocupado = true; del(K_ERR); del(K_BLQ);
    input.style.background = 'rgba(170,240,195,.9)';
    if (!reduz) await fim(anima(input, [{ transform: 'none', opacity: 1 }, { transform: 'scale(1.18)', offset: 0.4 }, { transform: 'scale(.1) rotate(200deg)', opacity: 0 }], { duration: 380, fill: 'forwards' }));
    input.hidden = true;
    if (!reduz && temSensor && !precisaPermissao()) { esperaBalanco(); return; }
    pinBox.style.display = 'none';
    revelar();
  }
  function esperaBalanco() {
    shakeBox.hidden = false; shakeSkip.hidden = true; shakeBar.style.width = '0%';
    anima(shakeBox, [{ transform: 'scale(.3) rotate(-15deg)', opacity: 0 }, { transform: 'scale(1.1) rotate(4deg)', opacity: 1, offset: 0.65 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.3,.8,.3,1)', fill: 'backwards' });
    let picos = 0, t0 = 0, last = null, tPico = 0, feito = false;
    const vai = () => { if (feito) return; feito = true; if (offShake) { offShake(); offShake = null; } clearTimeout(tSkip); pinBox.style.display = 'none'; revelar(); };
    const h = (e) => {
      const a = e.accelerationIncludingGravity; if (!a || a.x == null) return;
      const m = Math.abs(a.x) + Math.abs(a.y) + Math.abs(a.z);
      const now = Date.now();
      if (last != null && Math.abs(m - last) > 14 && now - tPico > 120) {
        if (now - t0 > 1500) picos = 0;
        t0 = tPico = now; picos++; vib(15);
        shakeBar.style.width = Math.min(100, picos / BALANCOS * 100) + '%';
        if (picos >= BALANCOS) vai();
      }
      last = m;
    };
    window.addEventListener('devicemotion', h);
    offShake = () => window.removeEventListener('devicemotion', h);
    const tSkip = setTimeout(() => { shakeSkip.hidden = false; }, 4000);
    shakeSkip.onclick = vai;
  }
  async function revelar() {
    try { document.documentElement.style.overflow = 'hidden'; document.body.style.overflow = 'hidden'; window.scrollTo(0, 0); } catch (e) {}
    const W = window.innerWidth, H = window.innerHeight, rect = rectDe(logo), std = stdRect();
    const ir = () => { try { sessionStorage.setItem('kb_egg_in', '1'); sessionStorage.setItem('kb_egg_rect', JSON.stringify(std)); } catch (e) {} (window.__kbIr || ((u) => { window.location.href = u; }))(DESTINO); };
    if (reduz) { ir(); return; }
    const lista = alvos(), vs = lista.map(vetor);
    const clone = criaLogo(rect, srcSite());
    logo.style.visibility = 'hidden';
    vib([40, 30, 40]);
    lista.forEach((el, i) => voaSai(el, vs[i], i));
    setTimeout(() => vib([25]), 320); setTimeout(() => vib([25, 30, 25]), 660);
    await espera(1250);
    await fim(anima(clone, [{ transform: 'rotate(0)' }, { transform: 'rotate(-5deg) scale(1.08)' }, { transform: 'rotate(4deg) scale(.96)' }, { transform: 'rotate(-3deg) scale(1.05,.93)' }, { transform: 'none' }], { duration: 600 }));
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2, R = Math.hypot(W, H);
    const bg = criaFundo(cx, cy, 0);
    const bgA = anima(bg, [{ clipPath: circulo(cx, cy, 0) }, { clipPath: circulo(cx, cy, R) }], { duration: 1000, easing: 'ease-in-out', fill: 'forwards' });
    vib([60, 40, 90]);
    await fim(anima(clone, [{ transform: P + 'rotateY(0)' }, { transform: P + 'rotateY(90deg) scale(1.1)' }], { duration: 220, easing: 'ease-in', fill: 'forwards' }));
    clone.src = new URL(TITULO_C, document.baseURI).href; setRect(clone, std);
    await fim(anima(clone, [{ transform: P + 'rotateY(-90deg) scale(.8)' }, { transform: P + 'rotateY(12deg) scale(1.12)', offset: 0.7 }, { transform: P + 'rotateY(0) scale(1)' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }));
    await fim(bgA);
    vib([50]);
    await espera(250);
    ir();
  }

  // ---------- volta do contador: a animação ao contrário, rápida ----------
  (function retorno() {
    let vindo = false, std = null;
    try { vindo = sessionStorage.getItem('kb_egg_out') === '1'; sessionStorage.removeItem('kb_egg_out'); std = JSON.parse(sessionStorage.getItem('kb_egg_rect') || 'null'); } catch (e) {}
    if (!vindo) return;
    const html = document.documentElement;
    const W = window.innerWidth, H = window.innerHeight; std = std || stdRect();
    const R = Math.hypot(W, H);
    const bg = criaFundo(W / 2, H / 2, R);
    const clone = criaLogo(std, new URL(TITULO_C, document.baseURI).href);
    logo.style.visibility = 'hidden';
    html.classList.add('kbe-ready');
    const limpa = () => { try { bg.remove(); clone.remove(); logo.style.visibility = ''; } catch (e) {} };
    const roda = async () => {
      try {
        const sr = rectDe(logo), lista = alvos(), vs = lista.map(vetor);
        const cx = sr.x + sr.w / 2, cy = sr.y + sr.h / 2;
        const todas = lista.map((el, i) => { const a = voaEntra(el, vs[i], i); a.id = 'kbe'; return a; });
        vib([30]);
        const bgA = anima(bg, [{ clipPath: circulo(cx, cy, R) }, { clipPath: circulo(cx, cy, 0) }], { duration: 500, easing: 'ease-in-out', fill: 'forwards' });
        await fim(anima(clone, [{ transform: P + 'rotateY(0)' }, { transform: P + 'rotateY(90deg)' }], { duration: 140, easing: 'ease-in', fill: 'forwards' }));
        clone.src = srcSite(); setRect(clone, sr);
        await fim(anima(clone, [{ transform: P + 'rotateY(-90deg) scale(.9)' }, { transform: P + 'rotateY(8deg) scale(1.06)', offset: 0.7 }, { transform: P + 'rotateY(0) scale(1)' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }));
        await fim(bgA);
        await Promise.all(todas.map(fim));
        todas.forEach((a) => { try { a.cancel(); } catch (e) {} });
      } finally { limpa(); }
    };
    const inicia = () => setTimeout(roda, 150);
    if (document.readyState === 'complete') inicia(); else { window.addEventListener('load', inicia, { once: true }); setTimeout(inicia, 4000); }
  })();

  input.addEventListener('input', () => { if (ocupado) return; input.value = input.value.replace(/\D/g, '').slice(0, 4); if (input.value.length === 4) setTimeout(confere, 140); });
  function confere() {
    if (ocupado || input.value.length < 4) return;
    if (input.value === PIN) acerto(); else erro();
  }
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); confere(); } });
  // toque no fundo: só fecha 5 s depois do último toque rápido (rápido = até 2 s de intervalo)
  pinBox.addEventListener('click', (e) => {
    if (e.target !== pinBox || ocupado) return;
    const t = Date.now(), rapido = t - lastClick <= RAPIDO_MS;
    lastClick = t;
    if (rapido) { qLast = t; return; }
    if (t - qLast >= PROTEGE_MS) fechaPin(true);
  });
  lockBox.addEventListener('click', (e) => { if (e.target === lockBox || e.target.classList.contains('kbp__close')) fechaLock(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!pinBox.hidden && !ocupado) fechaPin(true); if (!lockBox.hidden) fechaLock(); } });

  // 10 toques na logo: pulso simples (o brilho cresce até o 10º)
  logo.addEventListener('click', () => {
    const agora = Date.now();
    if (agora - ultimo > JANELA_MS) n = 0;
    ultimo = agora; n++;
    try {
      const f = 1 + n * 0.07;
      logo.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(' + f + ') drop-shadow(0 0 ' + (4 + n * 2) + 'px rgba(255,213,0,.9))' }, { filter: 'brightness(1)' }], { duration: 260, easing: 'ease-out' });
    } catch (e) {}
    if (n >= TOQUES) { n = 0; if (!mostraLock()) abrePin(); }
  });
})();
// KB-PIN-FIM
