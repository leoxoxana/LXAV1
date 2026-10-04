/**
 * Service Worker - network-first for the app shell, offline fallback from cache.
 * Network-first so a new deploy is always picked up (cache-first kept serving
 * old CSS/JS until the cache name was bumped). API calls are never cached.
 */

const CACHE_NAME = 'lxa-v3-cache';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/layout-fix.css',
  '/responsive-compact.css',
  '/game-engine.js',
  '/renderer.js',
  '/spin-button.js',
  '/header-fit.js',
  '/radio.js',
  '/admin-radio.js',
  '/boot-wild-preload.js',
  '/assets/wild-wide.webp',
  '/assets/wild-stack.webp',
  '/manifest.webmanifest',
  '/assets/icons/lxa-icon-192.png',
  '/assets/icons/lxa-icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }).catch(() => caches.match(request))
  );
});
