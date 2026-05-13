import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Using the configuration provided by the user
const firebaseConfig = {
  databaseURL: "https://rs-art-timbre-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
