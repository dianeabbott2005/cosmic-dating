self.addEventListener('push', event => {
  try {
    const data = event.data.json();
    const title = data.title || 'Cosmic Dating';
    const options = {
      body: data.body,
      icon: '/icon.png',
      badge: '/icon.png'
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    console.error('Error handling push event:', e);
    const options = {
      body: 'You have a new notification.',
      icon: '/icon.png',
      badge: '/icon.png'
    };
    event.waitUntil(self.registration.showNotification('Cosmic Dating', options));
  }
});