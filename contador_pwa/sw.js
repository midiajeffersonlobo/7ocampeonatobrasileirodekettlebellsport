// Service worker do Contador KB: guarda tudo no aparelho para funcionar 100% offline.
// Ao publicar uma versão nova do index.html, aumente o número abaixo.
const CACHE = 'contador-kb-v23';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './placar.html',
  './placar/anton.woff2',
  './placar/oswald.woff2',
  './placar/logo-1.webp',
  './placar/logo-2.webp',
  './placar/logo-3.webp',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Rede primeiro: com internet, sempre entrega a versão mais nova (ignora o cache do navegador);
// sem internet (ou rede lenta, mais de 3,5 s), entrega a cópia guardada e o contador segue funcionando offline.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const key = req.mode === 'navigate' && !/placar\.html$/.test(new URL(req.url).pathname) ? './index.html' : req;
      const cached = await cache.match(key, { ignoreSearch: true });
      const network = fetch(req, { cache: 'no-cache' })
        .then((res) => { if (res && res.ok) cache.put(key, res.clone()); return res; })
        .catch(() => null);
      if (!cached) return (await network) || Response.error();
      event.waitUntil(network);
      const limite = new Promise((r) => setTimeout(() => r(null), 3500));
      return (await Promise.race([network, limite])) || cached;
    })
  );
});
