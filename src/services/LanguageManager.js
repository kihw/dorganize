const fs = require('fs');
const path = require('path');

class LanguageManager {
  constructor() {
    this.currentLanguage = 'FR';
    this.languages = {};
    this.languageConfig = null;
    this.availableLanguages = [
      { code: 'FR', name: 'Français' },
      { code: 'EN', name: 'English' },
      { code: 'DE', name: 'Deutsch' },
      { code: 'ES', name: 'Español' },
      { code: 'IT', name: 'Italiano' }
    ];
    this.loadLanguages();
  }

  loadLanguages() {
    try {
      // Charger d'abord le fichier de configuration global
      const globalConfigPath = path.join(__dirname, '../../locales/global.json');
      if (fs.existsSync(globalConfigPath)) {
        const globalConfigData = fs.readFileSync(globalConfigPath, 'utf8');
        this.languageConfig = JSON.parse(globalConfigData);
        console.log('LanguageManager: Loaded global language configuration');
        
        // Charger chaque fichier de langue selon la configuration
        this.loadLanguageFiles();
      } else {
        console.warn('LanguageManager: global.json not found, using embedded languages');
        this.languages = this.getEmbeddedLanguages();
      }
    } catch (error) {
      console.error('LanguageManager: Error loading languages:', error);
      this.languages = this.getEmbeddedLanguages();
    }
  }

  loadLanguageFiles() {
    this.languages = {};
    
    if (!this.languageConfig || !this.languageConfig.languages) {
      console.warn('LanguageManager: No language configuration found');
      this.languages = this.getEmbeddedLanguages();
      return;
    }

    // Charger chaque fichier de langue
    Object.entries(this.languageConfig.languages).forEach(([langCode, langPath]) => {
      try {
        const fullPath = path.join(__dirname, '../../locales', langPath);
        if (fs.existsSync(fullPath)) {
          const langData = fs.readFileSync(fullPath, 'utf8');
          this.languages[langCode] = JSON.parse(langData);
          console.log(`LanguageManager: Loaded language ${langCode} from ${langPath}`);
        } else {
          console.warn(`LanguageManager: Language file not found: ${fullPath}`);
          // Utiliser la langue intégrée comme fallback
          const embeddedLanguages = this.getEmbeddedLanguages();
          if (embeddedLanguages[langCode]) {
            this.languages[langCode] = embeddedLanguages[langCode];
            console.log(`LanguageManager: Using embedded language for ${langCode}`);
          }
        }
      } catch (error) {
        console.error(`LanguageManager: Error loading language ${langCode}:`, error);
        // Utiliser la langue intégrée comme fallback
        const embeddedLanguages = this.getEmbeddedLanguages();
        if (embeddedLanguages[langCode]) {
          this.languages[langCode] = embeddedLanguages[langCode];
        }
      }
    });

    // Vérifier qu'au moins la langue par défaut est chargée
    if (!this.languages.FR) {
      console.warn('LanguageManager: Default language FR not loaded, using embedded');
      const embeddedLanguages = this.getEmbeddedLanguages();
      this.languages.FR = embeddedLanguages.FR;
    }
  }

  getEmbeddedLanguages() {
    return {
      FR: {
        main_about: 'À propos...',
        main_refreshsort: 'Rafraîchir/trier',
        main_sorting: 'Tri',
        main_configure: 'Configurer',
        main_quit: 'Quitter',
        main_remove: 'Retirer',
        main_none: 'Aucun',
        main_unknown: 'Inconnu',
        main_language: 'Langue',
        main_profil: 'Profil',
        main_noprofil: 'Pas de profil',
        main_profil_X: 'Profil n°{0}',
        
        message_languages: 'Langue choisie : {0}\n\nVoulez-vous redémarrer le programme\net appliquer la nouvelle langue ?',
        message_profils: 'Profil sélectionné : {0}\n\nVoulez-vous redémarrer le programme\net appliquer le nouveau profil ?',
        
        shortcut_none: 'Aucun raccourci',
        shortcut_unknown: 'Raccourci inconnu',
        
        tray_refresh_warning: '{0} :\nLa liste des fenêtres a été modifiée',
        
        displayTray_sorting: 'Veuillez patienter pendant le tri ({0} sur {1}) ...',
        displayTray_info: 'Cliquez sur l\'icône pour le menu',
        displayTray_element_0: 'Aucun élément détecté (ni fenêtre, ni raccourci)',
        displayTray_element_1: 'Un élément détecté',
        displayTray_element_N: '{0} éléments détectés',
        displayTray_window_0: 'aucune fenêtre',
        displayTray_window_1: 'une fenêtre',
        displayTray_window_N: '{0} fenêtres',
        displayTray_shortcut_0: 'aucun raccourci',
        displayTray_shortcut_1: 'un raccourci',
        displayTray_shortcut_N: '{0} raccourcis',
        displayTray_dock: 'Navigation',
        displayTray_dockKO: 'Ne pas afficher',
        
        displayGUI_nowindow: 'Aucune fenêtre Dofus visible, cliquez sur [Rafraîchir]',
        displayGUI_avatar: 'Avatar',
        displayGUI_personnage: 'Personnage',
        displayGUI_initiative: 'Initiative',
        displayGUI_raccourci: 'Raccourci',
        displayGUI_inprogress: 'En cours de traitement',
        displayGUI_infos: 'Les raccourcis ne sont pas utilisables pendant la configuration.\nPour les activer, cliquez sur la croix en haut à droite.',
        displayGUI_refreshsort: 'Rafraîchir la liste et trier les fenêtres',
        displayGUI_dock: 'Barre de navigation',
        displayGUI_dockOK: 'Activée, {0}',
        displayGUI_dockKO: 'Désactivée',
        displayGUI_dock_NW: 'En haut à gauche',
        displayGUI_dock_W: 'Centrée à gauche',
        displayGUI_dock_SW: 'En bas à gauche',
        displayGUI_dock_NE: 'En haut à droite',
        displayGUI_dock_E: 'Centrée à droite',
        displayGUI_dock_SE: 'En bas à droite',
        displayGUI_dock_N: 'En haut (horizontal)',
        displayGUI_dock_S: 'En bas (horizontal)',
        displayGUI_dock_thumbnails_OK: 'Miniatures',
        displayGUI_dock_thumbnails_KO: 'Icônes des fenêtres',
        displayGUI_menu_activate: 'Activer',
        displayGUI_menu_quit: 'Quitter',
        displayGUI_shortcut_remove: 'Retirer le raccourci',
        
        dock_REFRESH_tooltip: 'Cliquez pour mettre à jour la\nliste des fenêtres et les trier\nen fonction de l\'initiative',
        dock_REFRESH_tooltip_warning: 'La liste des fenêtres a été modifiée,\ncliquez pour la mettre à jour, et les\ntrier en fonction de l\'initiative',
        dock_CONFIG_tooltip: 'Cliquez pour quitter l\'Organizer\nou pour ouvrir le panneau de\nconfiguration',
        dock_FENETRE_tooltip: 'Raccourci direct : {0}'
      },
      
      EN: {
        main_about: 'About...',
        main_refreshsort: 'Refresh/Order',
        main_sorting: 'Order',
        main_configure: 'Configure',
        main_quit: 'Quit',
        main_remove: 'Remove',
        main_none: 'None',
        main_unknown: 'Unknown',
        main_language: 'Language',
        main_profil: 'Profile',
        main_noprofil: 'No profile',
        main_profil_X: 'Profile #{0}',
        
        message_languages: 'Selected language: {0}\n\nDo you want to restart the software\nwith the new language parameter?',
        message_profils: 'Selected profile: {0}\n\nDo you want to restart the software\nwith the new profile parameter?',
        
        shortcut_none: 'No shortcut',
        shortcut_unknown: 'Unknown shortcut',
        
        tray_refresh_warning: '{0}:\nThe list of windows has changed',
        
        displayTray_sorting: 'Please wait during the windows ordering ({0} on {1}) ...',
        displayTray_info: 'Click on the icon to display the menu',
        displayTray_element_0: 'No element detected (no window, no shortcut)',
        displayTray_element_1: 'One element detected',
        displayTray_element_N: '{0} elements detected',
        displayTray_window_0: 'no window',
        displayTray_window_1: 'one window',
        displayTray_window_N: '{0} windows',
        displayTray_shortcut_0: 'no shortcut',
        displayTray_shortcut_1: 'one shortcut',
        displayTray_shortcut_N: '{0} shortcuts',
        displayTray_dock: 'Navigation',
        displayTray_dockKO: 'Do not display',
        
        displayGUI_nowindow: 'No Dofus window available, click on [Refresh]',
        displayGUI_avatar: 'Avatar Icon',
        displayGUI_personnage: 'Character',
        displayGUI_initiative: 'Initiative',
        displayGUI_raccourci: 'Shortcut',
        displayGUI_inprogress: 'In process',
        displayGUI_infos: 'Shortcuts aren\'t available during the configuration.\nTo activate, click on the top right button [cross].',
        displayGUI_refreshsort: 'Refresh the list and order the windows',
        displayGUI_dock: 'Dockbar',
        displayGUI_dockOK: 'Enabled, {0}',
        displayGUI_dockKO: 'Disabled',
        displayGUI_dock_NW: 'At top-left corner',
        displayGUI_dock_W: 'On left side',
        displayGUI_dock_SW: 'At bottom-left corner',
        displayGUI_dock_NE: 'At top-right corner',
        displayGUI_dock_E: 'On right side',
        displayGUI_dock_SE: 'At bottom-right corner',
        displayGUI_dock_N: 'On top (horizontal)',
        displayGUI_dock_S: 'On bottom (horizontal)',
        displayGUI_dock_thumbnails_OK: 'Thumbnails',
        displayGUI_dock_thumbnails_KO: 'Windows icons',
        displayGUI_menu_activate: 'Activate',
        displayGUI_menu_quit: 'Quit',
        displayGUI_shortcut_remove: 'Delete this shortcut',
        
        dock_REFRESH_tooltip: 'Click to update the list\nof windows and sort it\nout by initiative',
        dock_REFRESH_tooltip_warning: 'The list of windows has changed,\nclick to update it and sort it out\nby initiative',
        dock_CONFIG_tooltip: 'Click to quit the Organizer or to\nopen the configuration panel',
        dock_FENETRE_tooltip: 'Direct shortcut: {0}'
      },

      DE: {
        main_about: 'Über...',
        main_refreshsort: 'Aktualisieren/Sortieren',
        main_sorting: 'Sortieren',
        main_configure: 'Konfigurieren',
        main_quit: 'Beenden',
        main_remove: 'Entfernen',
        main_none: 'Keine',
        main_unknown: 'Unbekannt',
        main_language: 'Sprache',
        main_profil: 'Profil',
        main_noprofil: 'Kein Profil',
        main_profil_X: 'Profil #{0}',
        
        shortcut_none: 'Keine Verknüpfung',
        shortcut_unknown: 'Unbekannte Verknüpfung',
        
        displayTray_element_0: 'Kein Element erkannt (kein Fenster, keine Verknüpfung)',
        displayTray_element_1: 'Ein Element erkannt',
        displayTray_element_N: '{0} Elemente erkannt',
        displayTray_dock: 'Navigation',
        displayTray_dockKO: 'Nicht anzeigen',
        
        displayGUI_nowindow: 'Kein Dofus-Fenster verfügbar, klicken Sie auf [Aktualisieren]',
        displayGUI_avatar: 'Avatar-Symbol',
        displayGUI_personnage: 'Charakter',
        displayGUI_initiative: 'Initiative',
        displayGUI_raccourci: 'Verknüpfung',
        displayGUI_refreshsort: 'Liste aktualisieren und Fenster sortieren',
        displayGUI_dock: 'Dockleiste',
        displayGUI_menu_activate: 'Aktivieren',
        displayGUI_menu_quit: 'Beenden',
        
        dock_REFRESH_tooltip: 'Klicken Sie, um die Liste\nder Fenster zu aktualisieren und\nnach Initiative zu sortieren',
        dock_CONFIG_tooltip: 'Klicken Sie, um den Organizer zu beenden\noder das Konfigurationspanel zu öffnen',
        dock_FENETRE_tooltip: 'Direkte Verknüpfung: {0}'
      },

      ES: {
        main_about: 'Acerca de...',
        main_refreshsort: 'Actualizar/Ordenar',
        main_sorting: 'Ordenar',
        main_configure: 'Configurar',
        main_quit: 'Salir',
        main_remove: 'Eliminar',
        main_none: 'Ninguno',
        main_unknown: 'Desconocido',
        main_language: 'Idioma',
        main_profil: 'Perfil',
        main_noprofil: 'Sin perfil',
        main_profil_X: 'Perfil #{0}',
        
        shortcut_none: 'Sin atajo',
        shortcut_unknown: 'Atajo desconocido',
        
        displayTray_element_0: 'Ningún elemento detectado (ni ventana, ni atajo)',
        displayTray_element_1: 'Un elemento detectado',
        displayTray_element_N: '{0} elementos detectados',
        displayTray_dock: 'Navegación',
        displayTray_dockKO: 'No mostrar',
        
        displayGUI_nowindow: 'Ninguna ventana de Dofus disponible, haga clic en [Actualizar]',
        displayGUI_avatar: 'Icono de Avatar',
        displayGUI_personnage: 'Personaje',
        displayGUI_initiative: 'Iniciativa',
        displayGUI_raccourci: 'Atajo',
        displayGUI_refreshsort: 'Actualizar la lista y ordenar las ventanas',
        displayGUI_dock: 'Barra de navegación',
        displayGUI_menu_activate: 'Activar',
        displayGUI_menu_quit: 'Salir',
        
        dock_REFRESH_tooltip: 'Haga clic para actualizar la lista\nde ventanas y ordenarlas\npor iniciativa',
        dock_CONFIG_tooltip: 'Haga clic para salir del Organizer\no abrir el panel de configuración',
        dock_FENETRE_tooltip: 'Atajo directo: {0}'
      },

      IT: {
        main_about: 'Informazioni...',
        main_refreshsort: 'Aggiorna/Ordina',
        main_sorting: 'Ordina',
        main_configure: 'Configura',
        main_quit: 'Esci',
        main_remove: 'Rimuovi',
        main_none: 'Nessuno',
        main_unknown: 'Sconosciuto',
        main_language: 'Lingua',
        main_profil: 'Profilo',
        main_noprofil: 'Nessun profilo',
        main_profil_X: 'Profilo #{0}',
        
        shortcut_none: 'Nessuna scorciatoia',
        shortcut_unknown: 'Scorciatoia sconosciuta',
        
        displayTray_element_0: 'Nessun elemento rilevato (né finestra, né scorciatoia)',
        displayTray_element_1: 'Un elemento rilevato',
        displayTray_element_N: '{0} elementi rilevati',
        displayTray_dock: 'Navigazione',
        displayTray_dockKO: 'Non visualizzare',
        
        displayGUI_nowindow: 'Nessuna finestra Dofus disponibile, fare clic su [Aggiorna]',
        displayGUI_avatar: 'Icona Avatar',
        displayGUI_personnage: 'Personaggio',
        displayGUI_initiative: 'Iniziativa',
        displayGUI_raccourci: 'Scorciatoia',
        displayGUI_refreshsort: 'Aggiorna l\'elenco e ordina le finestre',
        displayGUI_dock: 'Barra di navigazione',
        displayGUI_menu_activate: 'Attiva',
        displayGUI_menu_quit: 'Esci',
        
        dock_REFRESH_tooltip: 'Fare clic per aggiornare l\'elenco\ndelle finestre e ordinarle\nper iniziativa',
        dock_CONFIG_tooltip: 'Fare clic per uscire dall\'Organizer\no aprire il pannello di configurazione',
        dock_FENETRE_tooltip: 'Scorciatoia diretta: {0}'
      }
    };
  }

  setLanguage(langCode) {
    if (this.languages[langCode]) {
      this.currentLanguage = langCode;
    } else {
      console.warn(`Language ${langCode} not found, using default`);
      this.currentLanguage = 'FR';
    }
  }

  getCurrentLanguage() {
    return this.languages[this.currentLanguage] || this.languages['FR'];
  }

  getCurrentLanguageCode() {
    return this.currentLanguage;
  }

  getLanguageMenu(callback) {
    return this.availableLanguages
      .filter(lang => this.languages[lang.code])
      .map(lang => ({
        label: lang.name,
        type: 'radio',
        checked: this.currentLanguage === lang.code,
        click: () => callback(lang.code)
      }));
  }

  translate(key, ...args) {
    const lang = this.getCurrentLanguage();
    let text = lang[key] || key;
    
    // Replace placeholders {0}, {1}, etc.
    args.forEach((arg, index) => {
      text = text.replace(new RegExp(`\\{${index}\\}`, 'g'), arg);
    });
    
    return text;
  }

  getAvailableLanguages() {
    return this.availableLanguages.filter(lang => this.languages[lang.code]);
  }

  reloadLanguages() {
    console.log('LanguageManager: Reloading languages...');
    this.loadLanguages();
  }
}

module.exports = LanguageManager;