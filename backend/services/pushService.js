import fs from 'fs';
import path from 'path';
import webpush from 'web-push';

let vapidKeys = null;

export const initWebPush = () => {
  let vapidPub = process.env.VAPID_PUBLIC_KEY;
  let vapidPriv = process.env.VAPID_PRIVATE_KEY;
  
  if (vapidPub && vapidPriv) {
    vapidKeys = { publicKey: vapidPub, privateKey: vapidPriv };
    console.log('PushService: VAPID keys loaded from environment variables.');
  } else {
    console.log('PushService: VAPID keys missing in env. Generating persistent credentials...');
    const keys = webpush.generateVAPIDKeys();
    vapidPub = keys.publicKey;
    vapidPriv = keys.privateKey;
    vapidKeys = { publicKey: vapidPub, privateKey: vapidPriv };

    // Search and locate active .env path
    const envPaths = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(process.cwd(), 'backend', '.env'),
      path.resolve(process.cwd(), '..', '.env')
    ];
    let envPath = envPaths[0];
    for (const p of envPaths) {
      if (fs.existsSync(p)) {
        envPath = p;
        break;
      }
    }

    try {
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }

      // Replace or append
      if (envContent.includes('VAPID_PUBLIC_KEY=')) {
        envContent = envContent.replace(/VAPID_PUBLIC_KEY=.*/, `VAPID_PUBLIC_KEY=${vapidPub}`);
      } else {
        envContent += `\nVAPID_PUBLIC_KEY=${vapidPub}`;
      }

      if (envContent.includes('VAPID_PRIVATE_KEY=')) {
        envContent = envContent.replace(/VAPID_PRIVATE_KEY=.*/, `VAPID_PRIVATE_KEY=${vapidPriv}`);
      } else {
        envContent += `\nVAPID_PRIVATE_KEY=${vapidPriv}`;
      }

      fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
      console.log(`PushService: Keys successfully persisted to: ${envPath}`);
    } catch (err) {
      console.error('PushService: Failed to save VAPID keys to .env:', err.message);
    }

    // Update current session env
    process.env.VAPID_PUBLIC_KEY = vapidPub;
    process.env.VAPID_PRIVATE_KEY = vapidPriv;
  }

  try {
    webpush.setVapidDetails(
      'mailto:developer@college.edu',
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
    console.log('PushService: Web Push VAPID configuration applied.');
  } catch (e) {
    console.error('PushService: Web Push initialization failed:', e.message);
  }
};

export const getVapidPublicKey = () => {
  return vapidKeys ? vapidKeys.publicKey : null;
};

export const sendPushNotification = async (subscription, payload) => {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.warn('PushService: Send notification failed:', error.message);
    return false;
  }
};
