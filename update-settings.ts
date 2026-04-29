import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

async function updateSettings() {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) {
      console.error('No firebase-applet-config.json found. Please run set_up_firebase first.');
      return;
    }

    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

    const settingsRef = doc(db, 'settings', 'global');
    const settingsSnap = await getDoc(settingsRef);
    
    const newSettings = {
      appName: 'Vida Mixe',
      heroTitle: 'Vida Mixe',
      heroSubtitle: '"La región de los jamás conquistados" — Conectando al pueblo Mixe a través de la tecnología.',
      footerText: 'La región de los jamás conquistados.',
      themeColor: '#ff4e00',
      enableMixe: true,
      updatedAt: new Date().toISOString()
    };

    if (settingsSnap.exists()) {
      console.log('Updating existing settings...');
      await setDoc(settingsRef, { ...settingsSnap.data(), ...newSettings }, { merge: true });
    } else {
      console.log('Creating new settings...');
      await setDoc(settingsRef, newSettings);
    }

    console.log('Successfully updated Firestore settings to "Vida Mixe"');
    process.exit(0);
  } catch (error) {
    console.error('Error updating settings:', error);
    process.exit(1);
  }
}

updateSettings();
