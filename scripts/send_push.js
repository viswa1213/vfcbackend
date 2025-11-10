#!/usr/bin/env node
/*
Simple FCM push sender
Usage:
  node scripts/send_push.js --type order_update --token <FCM_DEVICE_TOKEN> [--json data/push_notifications.json]

Requires:
  - GOOGLE_APPLICATION_CREDENTIALS env var pointing to a Firebase service account JSON
*/

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      out[key] = val;
    }
  }
  return out;
}

function buildFcmMessage(sample, token) {
  const notification = {
    title: sample.title,
    body: sample.body,
    image: sample.image || undefined,
  };
  const data = Object.assign(
    {
      type: sample.type || '',
      click_action: sample.click_action || '',
    },
    sample.data || {}
  );

  const android = sample.android || {};
  const apnsPayload = sample.ios ? { aps: {} } : undefined;
  if (sample.ios?.sound) apnsPayload.aps.sound = sample.ios.sound;
  if (typeof sample.ios?.badge === 'number') apnsPayload.aps.badge = sample.ios.badge;
  if (sample.ios?.category) apnsPayload.aps.category = sample.ios.category;

  return {
    message: {
      token,
      notification,
      data,
      android: Object.keys(android).length ? { priority: (android.priority || 'HIGH').toUpperCase(), notification: { channel_id: android.channelId || undefined, color: android.color || undefined, sound: android.sound || undefined, }, ttl: android.ttl || undefined } : undefined,
      apns: apnsPayload ? { payload: apnsPayload } : undefined,
    },
  };
}

async function getAccessToken() {
  const SCOPES = ['https://www.googleapis.com/auth/firebase.messaging'];
  const auth = new google.auth.GoogleAuth({ scopes: SCOPES });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const projectId = await auth.getProjectId();
  return { token: token.token || token, projectId };
}

async function sendFcm(message) {
  const { token, projectId } = await getAccessToken();
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FCM error ${res.status}: ${text}`);
  }
  return res.json();
}

(async function main() {
  try {
    const args = parseArgs();
    const type = args.type;
    const token = args.token;
    const jsonPath = args.json || path.join(__dirname, '..', 'data', 'push_notifications.json');

    if (!type || !token) {
      console.error('Usage: node scripts/send_push.js --type <sample_key> --token <FCM_DEVICE_TOKEN> [--json <path>]');
      process.exit(1);
    }

    const content = fs.readFileSync(jsonPath, 'utf8');
    const payload = JSON.parse(content);
    const sample = payload.samples?.[type];
    if (!sample) {
      console.error(`Sample type "${type}" not found in ${jsonPath}`);
      process.exit(1);
    }

    const message = buildFcmMessage(sample, token);
    const response = await sendFcm(message);
    console.log('Push sent:', JSON.stringify(response));
  } catch (e) {
    console.error('Failed to send push:', e.message || e);
    process.exit(1);
  }
})();
