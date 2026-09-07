const CACHE_NAME = "bg3quest-cache-v10";
const ASSETS = [
  // ... старые пути ...
  "./images/newspaper-template-towers.jpg",
  "./images/newspaper-template-market.jpg",
  "./images/newspaper-template-fine.jpg",
  "./images/newspaper-template-tavern.jpg",
  "./images/newspaper-template-gear.jpg",
  "./images/newspaper-template-final.jpg",
  "./images/piece1.png",
  "./images/piece2.png",
  "./images/piece3.png",
  "./images/piece4.png",
  "./images/maxill.png",
  "./images/maxill-joined.png",
  "./images/legend.png",
  "./images/legend-joined.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Стратегия "сеть в приоритете, кэш — запасной вариант":
// пока есть интернет (при разработке/тестах) — всегда подтягивается
// свежая версия файлов и кэш обновляется. Как только сети нет
// (день квеста, глушилки в центре) — приложение работает из кэша.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
