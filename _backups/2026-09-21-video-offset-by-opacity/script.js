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
const videoOpacityLevels = [.1, .2, .3];
let videoOpacityIndex = 0;
let videoOpacityTimer;
let openingIsVisible = true;
let continuationActive = false;

function stopVideoOpacityCycle() {
  window.clearTimeout(videoOpacityTimer);
}

function scheduleVideoOpacityCycle() {
  stopVideoOpacityCycle();
  if (!continuationActive || !openingIsVisible || document.hidden || reducedMotion.matches) return;

  const holdDuration = 2500 + Math.random() * 4000;
  videoOpacityTimer = window.setTimeout(() => {
    const transitionDuration = 2500 + Math.random() * 3000;
    opening.style.setProperty('--video-opacity-duration', `${(transitionDuration / 1000).toFixed(2)}s`);
    opening.style.setProperty('--video-opacity', String(videoOpacityLevels[videoOpacityIndex]));
    videoOpacityIndex = (videoOpacityIndex + 1) % videoOpacityLevels.length;
    videoOpacityTimer = window.setTimeout(scheduleVideoOpacityCycle, transitionDuration);
  }, holdDuration);
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
      document.querySelector('#siteHeader').classList.add('is-visible');
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
    opening.style.setProperty('--video-opacity', '.3');
    requestAnimationFrame(() => {
      opening.classList.add('has-video-continuation');
      scheduleVideoOpacityCycle();
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
window.addEventListener('resize', syncHeaderTone);
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

const registrationDialog = document.querySelector('#registrationDialog');
document.querySelectorAll('[data-open-registration]').forEach((button) => {
  button.addEventListener('click', () => registrationDialog.showModal());
});
document.querySelector('[data-close-dialog]').addEventListener('click', () => registrationDialog.close());
registrationDialog.addEventListener('click', (event) => {
  if (event.target === registrationDialog) registrationDialog.close();
});

document.querySelector('#registrationForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const name = String(data.get('name')).trim();
  const people = String(data.get('people')).trim();
  const city = String(data.get('city')).trim();
  const updates = data.get('updates') === 'sim' ? 'Sim' : 'Não';
  const message = `Olá! Quero solicitar inscrição para assistir ao 7º Campeonato Brasileiro de Kettlebell Sport.\n\nNome: ${name}\nQuantidade de pessoas: ${people}\nCidade: ${city}\nDeseja receber a programação: ${updates}`;
  window.open(`https://wa.me/5581996484250?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
});

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
