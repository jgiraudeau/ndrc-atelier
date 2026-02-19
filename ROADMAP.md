# 🗺️ Feuille de Route : Application Compétences Digitales NDRC

**Objectif :** Créer un "Compagnon de Révision E5" pour les étudiants BTS NDRC, permettant de suivre l'acquisition des compétences sur WordPress et PrestaShop.

---

## 🏗️ État des Lieux (Ce qui est fait)
- [x] **Initialisation du Projet :** Next.js 15 + Tailwind CSS + TypeScript installé.
- [x] **UI Kit :** `shadcn/ui` installé et configuré.
- [x] **Outils IA :** Projet Stitch créé (`Référentiel Compétences NDRC`) et Skills (`react-components`, `shadcn-ui`) installés localement.
- [x] **Contenu Métier :** Liste complète des compétences WordPress (Astra/Spectra) et PrestaShop récupérée.

---

## 🚀 Phase 1 : Le MVP (Demain Matin)
L'objectif est d'avoir une application fonctionnelle où l'on peut voir la liste et cocher des cases.

### 1. Structure des Données 💾
- [ ] Créer le fichier `src/data/competencies.ts`.
- [ ] Convertir la liste textuelle (Wordpress/PrestaShop) en objets JSON structurés :
  ```typescript
  { id: "wp-seo-1", platform: "WORDPRESS", category: "SEO", label: "Renseigner les méta descriptions (Yoast)", acquired: false }
  ```

### 2. Intégration du Design (Stitch) 🎨
- [ ] Vérifier si Stitch a généré le Dashboard (si ça a bloqué, on relance ou on fait un design simple nous-mêmes).
- [ ] Utiliser le skill `react:components` pour transformer le design Stitch en code React (`<Dashboard />`, `<CompetencyList />`).
- [ ] Intégrer les barres de progression (Jauge circulaire ou linéaire).

### 3. Logique de Suivi (State) 🧠
- [ ] Créer un **Store** (Zustand ou React Context) pour gérer l'état "Acquis / Non Acquis".
- [ ] Connecter les checkboxes aux barres de progression (Quand je coche, la barre monte).

---

## 🌟 Phase 2 : Persistance & UX (Après-demain)
- [ ] **Sauvegarde Locale :** Utiliser `localStorage` pour que l'étudiant ne perde pas sa progression en fermant la page.
- [ ] **Filtres :** Pouvoir afficher "Seulement le SEO" ou "Seulement PrestaShop".
- [ ] **Mode "Focus" :** L'app propose une compétence au hasard à travailler ("Entraîne-toi à créer un code promo !").

---

## 🔮 Phase 3 : Fonctionnalités Avancées (Optionnel)
- [ ] **Export PDF :** Générer une "Fiche Bilan E5" propre pour le dossier d'examen.
- [ ] **Preuves :** Permettre d'uploader un screenshot pour prouver une compétence.
- [ ] **Auth Professeur :** Permettre au prof de voir la progression de sa classe.

---

**👉 Prochaine action (Demain) :** Valider le fichier JSON des compétences et intégrer le premier écran.
