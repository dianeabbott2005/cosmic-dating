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

export async function subscribeToPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push messaging is not supported on this browser.');
    return;
  }

  if (!VAPID_PUBLIC_KEY) {
    console.error('VITE_VAPID_PUBLIC_KEY is not set in environment variables. Cannot subscribe to push notifications.');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      console.log('User is already subscribed to push notifications.');
      return;
    }

    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    console.log('New push subscription created:', subscription);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase
        .from('profiles')
        .update({ push_subscription: subscription })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error saving push subscription to profile:', error);
      } else {
        console.log('Push subscription saved successfully.');
      }
    }
  } catch (error) {
    console.error('Failed to subscribe the user to push notifications:', error);
  }
}