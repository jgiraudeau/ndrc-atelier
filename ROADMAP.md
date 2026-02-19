# 🗺️ Feuille de Route : Application Compétences Digitales NDRC

**Objectif :** Créer un "Compagnon de Révision E5" pour les étudiants BTS NDRC, permettant de suivre l'acquisition des compétences sur WordPress et PrestaShop.
**URL Production :** [https://ndrc-skills.vercel.app](https://ndrc-skills.vercel.app)

---

## 🏗️ État des Lieux (Fait) ✅
- [x] **Tech Stack :** Next.js 15, Tailwind, Prisma (PostgreSQL), Vercel, Railway.
- [x] **Base de données :** Schéma relationnel (Prof, Élève, Classe, Progression, Commentaires).
- [x] **API Backend :** Routes sécurisées (JWT) pour Auth, Students, Dashboard, Progress.
- [x] **UI/UX Moderne :**
    - Landing Page "Stitch Style" (Dark mode, Glassmorphism).
    - Dashboard Étudiant complet (Stats, Activité récente, Messages prof).
    - Dashboard Formateur (Vue classe, Import CSV, Validation).
- [x] **Déploiement :** En ligne et fonctionnel.

---

## 🚀 Prochaine Étape : Validation Pratique & Liens Back-Office
L'objectif est de dépasser le simple "cochage de case" pour aller vers une validation par la preuve.

### 1. Connexion Back-Office (Idée) 🔌
- [ ] **Scénarios de validation :** L'app pose une question ("Comment change-t-on le permalien ?") ou demande une action.
- [ ] **Lien vers sites écoles :** Boutons d'accès direct aux WP/PrestaShop de la classe.
- [ ] **Upload de Preuves :** L'élève upload une capture d'écran ou un lien direct vers sa réalisation.

### 2. Fonctionnalités Pédagogiques 🧠
- [ ] **Quiz de vérification :** Avant de valider "SEO", l'élève doit répondre à 3 questions aléatoires sur Yoast/RankMath.
- [ ] **Export Bilan E5 :** Générer un PDF récapitulatif ("Fiche d'activités") pour l'examen.

### 3. Améliorations UX 🎨
- [ ] **Mode Sombre/Clair :** Toggle pour le dashboard étudiant.
- [ ] **Notifications :** Email ou push quand le prof laisse un commentaire.

---

**Statut Actuel :** 🟢 **EN PRODUCTION (Phase 1 & 2 terminées)**
