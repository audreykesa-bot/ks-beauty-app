# 📱 K's Beauty Studio — Instructions de déploiement
## App partagée entre tous les appareils de l'équipe

---

## Ce dont tu as besoin
- Un compte Google (tu en as sûrement déjà un)
- Un compte GitHub gratuit → https://github.com
- 30 minutes

---

## ÉTAPE 1 — Créer la base de données Firebase (gratuit)

1. Va sur **https://console.firebase.google.com**
2. Connecte-toi avec ton compte Google
3. Clique **"Créer un projet"**
4. Nom du projet : `ks-beauty-studio` → Continuer → Continuer → Créer
5. Une fois le projet créé, clique sur **"Firestore Database"** dans le menu gauche
6. Clique **"Créer une base de données"**
7. Choisis **"Démarrer en mode test"** → Suivant → Sélectionne `eur3 (europe-west)` → Activer

### Récupérer les clés de configuration :
8. Clique sur l'icône ⚙️ en haut à gauche → **Paramètres du projet**
9. Fais défiler vers le bas jusqu'à **"Vos applications"**
10. Clique sur l'icône `</>` (web)
11. Surnom de l'app : `ks-beauty-web` → **Enregistrer l'application**
12. Tu vois un bloc de code avec `firebaseConfig = { ... }` → **copie tout ce bloc**

---

## ÉTAPE 2 — Mettre tes clés dans le code

1. Ouvre le fichier **`src/firebase.js`**
2. Remplace les valeurs `"COLLE_TON_..."` par tes vraies valeurs copiées depuis Firebase
3. Sauvegarde

Exemple de ce que ça doit ressembler :
```js
const firebaseConfig = {
  apiKey: "AIzaSyAbc123...",
  authDomain: "ks-beauty-studio.firebaseapp.com",
  projectId: "ks-beauty-studio",
  storageBucket: "ks-beauty-studio.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123",
};
```

---

## ÉTAPE 3 — Mettre le code sur GitHub

1. Va sur **https://github.com** → crée un compte si besoin
2. Clique **"New repository"** (bouton vert)
3. Nom : `ks-beauty-app` → **Create repository**
4. Sur la page du repo, clique **"uploading an existing file"**
5. Glisse-dépose **tous les fichiers du dossier** `ks-beauty-app`
   (les dossiers `src/`, `public/`, et `package.json`)
6. Clique **"Commit changes"**

---

## ÉTAPE 4 — Déployer sur Vercel (lien web permanent)

1. Va sur **https://vercel.com** → "Sign up" avec ton compte GitHub
2. Clique **"Add New Project"**
3. Sélectionne ton repo `ks-beauty-app`
4. Vercel détecte automatiquement React → clique **"Deploy"**
5. Attends 2 minutes...
6. 🎉 Ton app est en ligne ! Vercel te donne une URL comme :
   `https://ks-beauty-app.vercel.app`

---

## ÉTAPE 5 — Partager avec l'équipe

1. Copie l'URL Vercel
2. Envoie-la à toutes les membres de l'équipe via WhatsApp
3. Sur iPhone : ouvrir le lien dans Safari → **Partager → "Sur l'écran d'accueil"**
   → L'app s'installe comme une vraie app avec l'icône !

---

## ✅ Résultat

- **Toutes les données sont partagées** en temps réel entre tous les appareils
- **Fonctionne sur** iPhone, Android, iPad, Mac, PC
- **Modifications visibles immédiatement** sur tous les écrans
- **Gratuit** pour votre usage (Firebase Spark plan : 50 000 lectures/jour)

---

## 🆘 En cas de problème

Reviens voir Claude avec une capture d'écran de l'erreur,
je t'aide à résoudre ça étape par étape.
