
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import fs from 'fs';

async function check() {
  console.log("Checking project environment...");
  console.log("NODE_ENV:", process.env.NODE_ENV);
  
  const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
  console.log("Config Project ID:", config.projectId);
  console.log("Config Database ID:", config.firestoreDatabaseId);

  const app = initializeApp(config);
  const db = getFirestore(app, config.firestoreDatabaseId);

  console.log("Testing reachability with 'settings' collection...");
  try {
    const start = Date.now();
    // Try to get a doc from 'settings'
    const snap = await getDocFromServer(doc(db, 'settings', 'global'));
    console.log("Firestore reached. Doc exists:", snap.exists(), "Time:", Date.now() - start, "ms");
    if (snap.exists()) {
      console.log("Data:", snap.data());
    }
  } catch (err: any) {
    console.error("Firestore reach error:", err.code, err.message);
  }
}

check().catch(console.error);
