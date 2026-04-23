const admin = require('firebase-admin');

const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY;

const isConfigured = () => Boolean(firebaseProjectId && firebaseClientEmail && firebasePrivateKey);

const initFirebase = () => {
  if (!isConfigured()) {
    console.warn('[Firebase] Service account credentials missing. Firebase features will be disabled.');
    return null;
  }
  
  if (admin.apps.length) return admin.app();
  
  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: firebaseProjectId,
      clientEmail: firebaseClientEmail,
      privateKey: firebasePrivateKey.replace(/\\n/g, '\n')
    })
  });
};

module.exports = { initFirebase, admin, isConfigured };
