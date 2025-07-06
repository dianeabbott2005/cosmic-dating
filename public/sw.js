// public/sw.js

self.addEventListener('push', event => {
  const data = event.data.json();
  console.log('Push received:', data);

  const options = {
    body: data.body,
    icon: data.icon || '/icon.png',
    badge: '/icon.png'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', event => {
  console.log('Notification click received.');
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});