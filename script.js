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
const videoOpacityStates = [
  { opacity: .45, holdDuration: 0 }
];
const videoOpacityTransitionDuration = 1500;
let videoOpacityIndex = 0;
let videoOpacityTimer;
let openingIsVisible = true;
let continuationActive = false;

function stopVideoOpacityCycle() {
  window.clearTimeout(videoOpacityTimer);
}

function scheduleVideoOpacityCycle() {
  stopVideoOpacityCycle();
  if (videoOpacityStates.length < 2 || !continuationActive || !openingIsVisible || document.hidden || reducedMotion.matches) return;

  const currentState = videoOpacityStates[videoOpacityIndex];
  videoOpacityTimer = window.setTimeout(() => {
    videoOpacityIndex = (videoOpacityIndex + 1) % videoOpacityStates.length;
    const nextState = videoOpacityStates[videoOpacityIndex];
    opening.style.setProperty('--video-opacity-duration', `${videoOpacityTransitionDuration / 1000}s`);
    opening.style.setProperty('--video-opacity', String(nextState.opacity));
    videoOpacityTimer = window.setTimeout(scheduleVideoOpacityCycle, videoOpacityTransitionDuration);
  }, currentState.holdDuration);
}

const openingVisibilityObserver = new IntersectionObserver(([entry]) => {
  openingIsVisible = entry.isIntersecting;
  if (openingIsVisible) scheduleVideoOpacityCycle();
  else stopVideoOpacityCycle();
}, { threshold: .05 });

openingVisibilityObserver.observe(opening);

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
    openingVideo.play().catch(() => {});
    continuationActive = true;
    videoOpacityIndex = 0;
    opening.style.setProperty('--video-opacity-duration', `${videoOpacityTransitionDuration / 1000}s`);
    opening.style.setProperty('--video-opacity', String(videoOpacityStates[0].opacity));
    requestAnimationFrame(() => {
      opening.classList.add('has-video-continuation');
      videoOpacityTimer = window.setTimeout(scheduleVideoOpacityCycle, videoOpacityTransitionDuration);
    });
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

videoIntroMedia.play().catch(() => {});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearTimeout(shimmerTimer);
    stopVideoOpacityCycle();
  } else {
    scheduleShimmer();
    scheduleVideoOpacityCycle();
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
  const FORM_ACTION = 'https://docs.google.com/forms/d/e/1FAIpQLSd6-iEpmzYzax9vq_uNYFHXV3ZPPMA8jFhDw2IMvPw2T9z0vw/formResponse';
  const ENTRY = {
    nome: 'entry.1754534373',
    idade: 'entry.986654450',
    telefone: 'entry.373158959',
    sexo: 'entry.791056516',
    cidade: 'entry.1478208802',
    bairro: 'entry.504945486',
    atividade: 'entry.580061454',
    qual: 'entry.2047383611',
    conhecia: 'entry.1268736641',
    contato: 'entry.518672639',
  };
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
    const params = new URLSearchParams();
    params.append(ENTRY.nome, field('nome').value.trim());
    params.append(ENTRY.idade, String(+field('idade').value));
    params.append(ENTRY.telefone, formatPhone(field('telefone').value));
    OPTIONAL.forEach((name) => {
      const input = form.querySelector(`[name="${name}"]:checked`) || form.querySelector(`input[type="text"][name="${name}"]`);
      const value = input ? input.value.trim() : '';
      if (value) params.append(ENTRY[name], value);
    });
    sending = true;
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Enviando…';
    showWarn('');
    try {
      await fetch(FORM_ACTION, { method: 'POST', mode: 'no-cors', body: params });
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
