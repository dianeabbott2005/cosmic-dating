export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notification');
    return;
  }

  if (Notification.permission === 'default') {
    console.log('Requesting notification permission...');
    await Notification.requestPermission();
  }
};

export const showNotification = (title: string, options: NotificationOptions) => {
  if (!('Notification' in window)) {
    console.error('This browser does not support desktop notification');
    return;
  }

  if (Notification.permission === 'granted') {
    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
    };
  } else {
    console.log('Notification permission not granted.');
  }
};