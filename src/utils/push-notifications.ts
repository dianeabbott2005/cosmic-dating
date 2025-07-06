import { supabase } from '@/integrations/supabase/client';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.error('Service Worker not supported');
    return;
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered with scope:', registration.scope);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
  }
}

export async function subscribeUser(userId: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.error('Push messaging is not supported');
    return;
  }

  if (!VAPID_PUBLIC_KEY) {
    console.error('VITE_VAPID_PUBLIC_KEY is not set. Cannot subscribe for push notifications.');
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  const existingSubscription = await registration.pushManager.getSubscription();

  if (existingSubscription) {
    console.log('User is already subscribed.');
    // Optionally, you could re-sync with the server here
    return;
  }

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    console.log('User subscribed:', subscription);

    const { error } = await supabase
      .from('push_subscriptions')
      .insert({ user_id: userId, subscription: subscription.toJSON() });

    if (error) {
      console.error('Error saving push subscription:', error);
      // If saving fails, unsubscribe to avoid inconsistent state
      await subscription.unsubscribe();
    } else {
      console.log('Push subscription saved successfully.');
    }
  } catch (error) {
    console.error('Failed to subscribe the user: ', error);
  }
}

export async function displayNotification(title: string, options: NotificationOptions) {
  if (!('serviceWorker' in navigator)) {
    console.error('Service Worker not supported, cannot display notification.');
    return;
  }
  const registration = await navigator.serviceWorker.ready;
  registration.showNotification(title, { ...options, icon: '/icon.png' });
}