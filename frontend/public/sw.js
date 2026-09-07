self.addEventListener('push', (event) => {
  let data = { title: 'THE_PlacementGRID Update', body: 'You have dynamic items due for revision!' };
  try {
    data = event.data ? event.data.json() : data;
  } catch (e) {
    data = { title: 'THE_PlacementGRID Update', body: event.data ? event.data.text() : data.body };
  }

  const options = {
    body: data.body,
    icon: data.icon || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎓</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎓</text></svg>',
    vibrate: [100, 50, 100],
    data: { url: '/dashboard' }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/dashboard');
    })
  );
});
