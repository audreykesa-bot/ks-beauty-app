// ──────────────────────────────────────────────────────────────────
// 👉 REMPLACE CES VALEURS par tes clés Firebase
//    (voir INSTRUCTIONS.md étape 2 pour savoir où les trouver)
// ──────────────────────────────────────────────────────────────────
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            "AIzaSyCxQ5mPx6f07glVJnVDYm8SYJeT...",
  authDomain:        "ks-beauty-studio.firebaseapp.com",
  projectId:         "ks-beauty-studio",
  storageBucket:     "ks-beauty-studio.firebasestorage.app",
  messagingSenderId: "249107523615",
  appId:             "1:249107523615:web:3dc0b1312cca96..",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
