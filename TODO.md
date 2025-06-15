# TODO - Organizer Application

*Dernière mise à jour : 15 juin 2025*

## ✅ Bugs Corrigés (Completed)

### [BUG-001] Configuration Window Opening Issue - RÉSOLU ✅
- **Problème** : Le clic pour ouvrir la fenêtre de configuration réinitialise la configuration au lieu de maintenir les paramètres persistants
- **Solution implémentée** :
  - Ajout d'un système de suivi de l'état des paramètres (`settingsLoaded`, `isSettingsLoaded`)
  - Envoi des paramètres actuels au renderer lors de l'ouverture de la fenêtre
  - Notification du renderer lors des mises à jour de paramètres via `settings-updated`
  - Correction du chargement des paramètres dock uniquement après leur chargement complet
- **Status** : ✅ CORRIGÉ
- **Commit** : `Fix BUG-001 (Settings persistence) and BUG-002 (Initiative sorting) in main.js`

### [BUG-002] Initiative Sorting Bug - RÉSOLU ✅
- **Problème** : Le système de tri par initiative ne fonctionne pas correctement lors du refresh
- **Solution implémentée** :
  - Ajout d'une méthode dédiée `sortWindowsByInitiative()` dans le main.js et config.js
  - Application systématique du tri après chaque mise à jour des fenêtres
  - Tri correct : initiative décroissante (plus haut → plus bas), puis nom de personnage
  - Tri appliqué dans `refreshAndSort()`, `loadData()`, et `updateInitiative()`
- **Status** : ✅ CORRIGÉ
- **Commit** : `Fix BUG-001 and BUG-002, implement FEAT-001: Auto Key Configuration System`

### [BUG-003] Problème de réinitialisation des touches après enregistrement - EN COURS 🟠

* **Problème** : Certaines touches (ex: `A`) se réinitialisent ou échouent à l’enregistrement après avoir été correctement configurées
* **Comportement observé** :

  * La touche est d’abord acceptée, puis échoue lors d’une tentative ultérieure (`Failed to register shortcut: A`)
  * Possible conflit ou absence de validation cohérente lors du redémarrage / rechargement
* **Hypothèse** :

  * Le système ne priorise pas correctement les raccourcis Auto Key vs Global / Manuels
  * Absence de persistance ou de hiérarchisation au rechargement

### [BUG-004] Auto Key non configurable manuellement - EN COURS 🟠

* **Problème** : Les raccourcis générés automatiquement ne peuvent pas être ajustés ou modifiés dans l’interface
* **Conséquence** : L’utilisateur est limité aux presets et ne peut pas adapter les touches auto-générées
* **Amélioration proposée** :

  * Ajouter une option de personnalisation pour les touches attribuées automatiquement
  * Permettre la désactivation partielle d’un Auto Key




## ✅ Nouvelles Fonctionnalités Implémentées (Completed)

### [FEAT-001] Auto Key Configuration System - IMPLÉMENTÉ ✅
- **Description** : Système de configuration automatique des touches basé sur l'ordre d'initiative
- **Fonctionnalités ajoutées** :
  - **Interface utilisateur** : Nouveau bouton "⚡ Auto Keys" dans l'interface de configuration
  - **Modal de configuration** : Interface complète avec presets et configuration personnalisée
  - **Presets prédéfinis** :
    - Numbers (1, 2, 3, 4...)
    - Function Keys (F1, F2, F3, F4...)
    - Numpad (Num1, Num2, Num3...)
  - **Pattern personnalisé** : Support des patterns avec `{n}` (ex: `Ctrl+Alt+{n}`)
  - **Aperçu en temps réel** : Affichage de l'ordre d'initiative et des raccourcis assignés
  - **Application automatique** : Attribution automatique basée sur l'ordre d'initiative
  - **Feedback utilisateur** : Notification du succès de la configuration
- **Attribution automatique** : Les touches sont assignées selon l'ordre d'initiative (plus haut = premier)
- **Status** : ✅ IMPLÉMENTÉ
- **Commits** : 
  - `Fix BUG-001 and BUG-002, implement FEAT-001: Auto Key Configuration System`
  - `Add Auto Key Configuration button and modal styles to config.html`

### [FEAT-002] Système de hiérarchisation et priorité des raccourcis - À FAIRE 🔵

* **Objectif** : Lors du chargement du fichier JSON de configuration, définir une priorité :

  1. **Auto Key actif** → les raccourcis Auto Key sont prioritaires
  2. **Touches globales utilisateur**
  3. **Touches spécifiques à une fenêtre**
* **Fonctionnalités attendues** :

  * Validation et surcharge des raccourcis en fonction de leur type
  * Sauvegarde dans le JSON selon leur catégorie
  * Mise à jour dynamique à l’activation/désactivation des Auto Keys
  
## 🔧 Améliorations Techniques Apportées

### Persistance des Paramètres
- **Système de suivi d'état** : Tracking de `settingsLoaded` pour éviter les réinitialisations
- **Communication IPC améliorée** : Event `settings-updated` pour notifier le renderer
- **Chargement conditionnel** : UI mise à jour seulement après chargement complet des paramètres

### Tri par Initiative
- **Méthode centralisée** : `sortWindowsByInitiative()` utilisée partout
- **Logique de tri correcte** : Initiative descendante, puis nom alphabétique
- **Application systématique** : Tri après chaque opération modifiant la liste

### Interface Utilisateur
- **Indicateurs visuels** : Badge d'ordre d'initiative sur chaque fenêtre
- **Bouton Auto Keys** : Facilement accessible depuis l'interface principale
- **Modal moderne** : Interface intuitive avec presets et aperçu

### Architecture du Code
- **Séparation des responsabilités** : Logique de tri séparée dans des méthodes dédiées
- **Gestion d'erreurs** : Try-catch et validation des données améliorés
- **Logging détaillé** : Suivi complet des opérations pour le debugging

## 📋 Statuts de Développement

- 🔴 **CRITIQUE** : Bugs bloquants (0 restant)
- 🟡 **MOYEN** : Améliorations planifiées (0 restant)
- 🟢 **FINI** : Fonctionnalités complétées (3 éléments)

## 📊 Résumé des Corrections

| Élément | Type | Priorité | Status | Temps Estimé | Temps Réel |
|---------|------|----------|--------|--------------|------------|
| BUG-001 | Bug | 🔴 Haute | ✅ Corrigé | 2-3h | ~2h |
| BUG-002 | Bug | 🟡 Moyenne | ✅ Corrigé | 1-2h | ~1h |
| FEAT-001 | Feature | 🟡 Moyenne | ✅ Implémenté | 4-6h | ~4h |

## 🚀 Prochaines Étapes (Optionnelles)

### Améliorations Futures Possibles
1. **Sauvegarde de configurations** : Export/import de configurations de touches
2. **Profiles utilisateur** : Gestion de multiples profils de configuration
3. **Raccourcis contextuels** : Raccourcis différents selon le contexte (combat, exploration, etc.)
4. **Interface drag & drop** : Réorganisation visuelle de l'ordre d'initiative
5. **Notifications système** : Alertes lors des changements de configuration

### Notes Techniques
- **Tests unitaires** : Ajouter des tests pour les nouvelles fonctionnalités
- **Documentation** : Mettre à jour la documentation utilisateur
- **Performance** : Optimisation du tri pour de nombreuses fenêtres (>10)

## 📝 Notes de Version 0.4.1

### Nouvelles Fonctionnalités
- ✅ Configuration automatique des touches basée sur l'initiative
- ✅ Interface de sélection de presets (Numbers, Function Keys, Numpad)
- ✅ Support des patterns personnalisés avec variables
- ✅ Aperçu en temps réel des assignations

### Corrections de Bugs
- ✅ Persistance correcte des paramètres lors de l'ouverture de la configuration
- ✅ Tri par initiative fonctionnel et cohérent
- ✅ Ordre d'affichage respectant l'initiative (plus haute en premier)

### Améliorations Techniques
- ✅ Architecture de persistence des paramètres renforcée
- ✅ Méthodes de tri centralisées et réutilisables
- ✅ Interface utilisateur plus intuitive avec indicateurs visuels
- ✅ Gestion d'erreurs et logging améliorés

---

**Projet** : Dorganize v0.4.1  
**Développeur** : VaL  
**Date de finalisation** : 15 juin 2025  
**Status global** : ✅ COMPLET - Tous les bugs critiques résolus et nouvelles fonctionnalités implémentées
