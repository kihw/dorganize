# TODO - Organizer Application

*Dernière mise à jour : 15 juin 2025*

## 🐛 Bugs Critiques (Priorité Haute)

### [BUG-001] Configuration Window Opening Issue
- **Problème** : Le clic pour ouvrir la fenêtre de configuration réinitialise la configuration au lieu de maintenir les paramètres persistants
- **Impact** : Perte des préférences utilisateur lors de l'ouverture des paramètres
- **Étapes à reproduire** :
  1. Configurer les paramètres dans l'application
  2. Fermer la fenêtre de configuration
  3. Cliquer pour rouvrir la fenêtre de configuration
  4. Observer que les paramètres sont revenus aux valeurs par défaut
- **Priorité** : 🔴 HAUTE
- **Assigné à** : À définir
- **Estimation** : 2-3 heures
- **Pistes de solution** : 
  - Vérifier le chargement des paramètres depuis le fichier de config
  - S'assurer que les valeurs ne sont pas écrasées à l'initialisation de la fenêtre

### [BUG-002] Initiative Sorting Bug
- **Problème** : Le système de tri par initiative ne fonctionne pas correctement lors du refresh
- **Comportement actuel** : Interface et fenêtres triées par initiative (plus haut → plus bas)
- **Comportement attendu** : Maintenir l'ordre logique approprié
- **Priorité** : 🟡 MOYENNE
- **Assigné à** : À définir
- **Estimation** : 1-2 heures

## ✨ Nouvelles Fonctionnalités (Priorité Moyenne)

### [FEAT-001] Auto Key Configuration System
- **Description** : Système de configuration automatique des touches
- **Spécifications** :
  - L'utilisateur préconfigure des touches dans les raccourcis globaux
  - Ces touches sont automatiquement assignées aux personnages 1/2/3/4/etc.
  - Attribution basée sur l'ordre d'initiative
- **Priorité** : 🟡 MOYENNE
- **Assigné à** : À définir
- **Estimation** : 4-6 heures
- **Dépendances** : Résoudre BUG-002 en premier

## 📋 Statuts

- 🔴 **HAUTE** : À traiter en priorité
- 🟡 **MOYENNE** : Planifier pour le prochain sprint
- 🟢 **BASSE** : Backlog

## 📝 Notes de Développement

- Tester la persistance des configurations après chaque modification
- Valider l'ordre d'initiative avec des cas de test spécifiques
- Documenter le système de raccourcis pour les futurs développeurs