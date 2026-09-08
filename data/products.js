/*
╔════════════════════════════════════════════════════════════════════════════╗
║              ASTA-SHOPS — FICHIER DES PRODUITS                             ║
║                                                                            ║
║  C'est ICI que je gères TOUS mes produits, prix et images.                 ║
║  je n'ai pas besoin de toucher à catalog.html ou main.css.                 ║
╚════════════════════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CATÉGORIES DISPONIBLES (valeur du champ "category")
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  "jeux"           → Jeux de crédit mobile  (Free Fire, PUBG, etc.)
  "payment-cards"  → Cartes de paiement     (Razer Gold, etc.)
  "gift-cards"     → Cartes cadeaux         (Apple, Google Play, PSN, etc.)
  "game-console"   → Consoles de jeux       (Nintendo, etc.)
  "game-cd-key"    → Clés de jeux           (Forza, Steam, etc.)
  "video-streaming"→ Streaming Vidéo        (Netflix, Disney+, etc.)
  "music"          → Musique                (Spotify, Deezer, etc.)
  "shopping"       → Shopping               (Amazon, etc.)
  "telco-prepaid"  → Recharges Mobiles      (Digicel, Natcom, etc.)
  "tools"          → Tools                  (VPN, antivirus, etc.)
  "software"       → Software               (Windows, Office, etc.)
  "social-app"     → Applications sociales  (TikTok coins, etc.)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  OÙ METTRE LES IMAGES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  → Mets tes images dans le dossier  img/
  → Taille recommandée : 300×300 pixels, format .png ou .jpg
  → Dans le champ "img", écris :  "img/mon-image.png"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CONVERSION EUR → HTG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1 EUR ≈ 135 HTG   (mets à jour si le taux change)
  Exemple : 9.99 EUR × 135 = 1 349 HTG → arrondi à 1350

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  MODÈLE — COPIE CE BLOC POUR AJOUTER UN NOUVEAU PRODUIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  {
    id: 99,                          // ← Numéro unique (incrémente depuis le dernier)
    name: "Nom du produit",          // ← Nom affiché sur la carte
    category: "jeux",               // ← Voir liste des catégories ci-dessus
    img: "img/mon-image.png",        // ← Image dans le dossier img/

    desc: "Description courte...",   // ← Texte affiché sur la carte produit

    discount: "-10%",                // ← Badge de réduction (ou "" pour rien)
    rating: 5.0,                     // ← Note sur 5  (ex: 4.8)
    sales: "10k+",                   // ← Ventes affichées (ex: "50k+")
    recommended: true,               // ← true = apparaît en premier
    date: "2026-01-01",              // ← Date d'ajout (pour le tri Nouveautés)
    price: 1.99,                     // ← Prix minimum (prix de la 1ère dénomination)

    needsServer: false,              // ← false pour la plupart des jeux
                                     //   true = affiche un sélecteur de serveur (ex: Mobile Legends)
    serverOptions: [],               // ← Laisse vide si needsServer = false
                                     //   Sinon: ["Serveur 1", "Serveur 2", ...]

    idLabel: "ID du joueur",         // ← Étiquette du champ ID dans le modal
    idPlaceholder: "Ex: 123456789",  // ← Texte d'exemple dans le champ

    denoms: [
      // ↓ Chaque ligne = une dénomination (montant achetable)
      // ↓ label = ce qui s'affiche, eur = prix en euros, htg = prix en gourdes
      { label: "Pack Starter",   eur: 1.99,  htg: 269  },
      { label: "Pack Standard",  eur: 4.99,  htg: 674  },
      { label: "Pack Premium",   eur: 9.99,  htg: 1349 },
    ]
  },

*/

// ============================================================================
//  NE PAS MODIFIER CETTE LIGNE — début du tableau de produits
// ============================================================================
const products = [

    // ════════════════════════════════════════════════════════════════════════
    //  JEUX DE CRÉDIT MOBILE
    //  Pour ajouter un jeu mobile, copie un bloc ci-dessous et modifie-le.
    //  N'oublie pas de mettre l'image dans  img/
    // ════════════════════════════════════════════════════════════════════════

    {
        id: 1,
        name: "Free Fire",
        category: "jeux",
        img: "img/free fire.png",
        desc: "Rechargez vos Diamants Free Fire et Pass de combat instantanément. Achetez des skins, personnages et packs spéciaux directement sur votre compte.",
        discount: "-12%", rating: 5.0, sales: "100k+", recommended: true, date: "2026-05-01", price: 1.99,
        needsServer: false, serverOptions: [],
        idLabel: "ID Free Fire", idPlaceholder: "Ex: 123456789",
        denoms: [
            { label: "100 Diamants", eur: 1.99, htg: 270 },
            { label: "210 Diamants", eur: 3.99, htg: 540 },
            { label: "530 Diamants", eur: 9.49, htg: 1282 },
            { label: "1060 Diamants", eur: 17.99, htg: 2430 },
            { label: "2180 Diamants", eur: 34.99, htg: 4724 },
            { label: "Pass Combat (1 mois)", eur: 3.49, htg: 471 },
            { label: "Pass Elite (1 mois)", eur: 7.99, htg: 1080 },
        ]
    },

    {
        id: 2,
        name: "PUBG Mobile",
        category: "jeux",
        img: "img/PUBG Mobile.png",
        desc: "Rechargez vos UC (Unknown Cash) pour débloquer des Royale Pass, skins d'armes exclusifs et tenues sur PUBG Mobile. Livraison instantanée.",
        discount: "-19%", rating: 5.0, sales: "100k+", recommended: true, date: "2026-06-01", price: 0.99,
        needsServer: false, serverOptions: [],
        idLabel: "ID PUBG Mobile", idPlaceholder: "Ex: 5123456789",
        denoms: [
            { label: "60 UC", eur: 0.99, htg: 135 },
            { label: "300 UC + 25 bonus", eur: 4.99, htg: 675 },
            { label: "660 UC + 70 bonus", eur: 9.99, htg: 1350 },
            { label: "1800 UC + 300 bonus", eur: 24.99, htg: 3374 },
            { label: "3850 UC + 750 bonus", eur: 49.99, htg: 6750 },
            { label: "8100 UC + 2010 bonus", eur: 99.99, htg: 13500 },
        ]
    },

    {
        id: 3,
        name: "COD Mobile",
        category: "jeux",
        img: "img/Call of Duty mobile.png",
        desc: "Rechargez vos CP (COD Points) pour accéder au Battle Pass, skins d'armes légendaires et opérateurs exclusifs sur Call of Duty Mobile.",
        discount: "-10%", rating: 4.9, sales: "50k+", recommended: false, date: "2026-06-10", price: 1.09,
        needsServer: false, serverOptions: [],
        idLabel: "ID COD Mobile", idPlaceholder: "Ex: 1234567890",
        denoms: [
            { label: "80 CP", eur: 1.09, htg: 147 },
            { label: "400 CP", eur: 4.99, htg: 674 },
            { label: "880 CP", eur: 9.99, htg: 1350 },
            { label: "2000 CP", eur: 21.99, htg: 2969 },
            { label: "4000 CP + 800 bonus", eur: 41.99, htg: 5669 },
        ]
    },

    {
        id: 4,
        name: "Roblox",
        category: "jeux",
        img: "img/roblox.jpeg",
        desc: "Achetez des Robux pour personnaliser votre avatar, accéder aux jeux premium et débloquer des items exclusifs sur la plateforme Roblox.",
        discount: "-5%", rating: 5.0, sales: "100k+", recommended: true, date: "2026-04-15", price: 4.99,
        needsServer: false, serverOptions: [],
        idLabel: "Nom d'utilisateur Roblox", idPlaceholder: "Ex: MonPseudoRoblox",
        denoms: [
            { label: "400 Robux", eur: 4.99, htg: 674 },
            { label: "800 Robux", eur: 9.99, htg: 1350 },
            { label: "1700 Robux", eur: 19.99, htg: 2700 },
            { label: "4500 Robux", eur: 49.99, htg: 6750 },
            { label: "10000 Robux", eur: 99.99, htg: 13500 },
        ]
    },

    {
        id: 5,
        name: "EA Sports FC",
        category: "jeux",
        img: "img/FC Mobile.png",
        desc: "Rechargez vos FC Points pour EA Sports FC Mobile. Ouvrez des packs, renforcez votre Ultimate Team et accédez aux événements exclusifs.",
        discount: "-25%", rating: 4.8, sales: "30k+", recommended: false, date: "2026-06-12", price: 9.99,
        needsServer: false, serverOptions: [],
        idLabel: "ID EA Sports FC", idPlaceholder: "Ex: 1234567890",
        denoms: [
            { label: "1050 FC Points", eur: 9.99, htg: 1350 },
            { label: "2200 FC Points", eur: 19.99, htg: 2700 },
            { label: "4600 FC Points", eur: 39.99, htg: 5400 },
            { label: "12000 FC Points", eur: 99.99, htg: 13500 },
        ]
    },

    {
        id: 6,
        name: "Mobile Legends",
        category: "jeux",
        img: "img/mobile legends.jpeg",
        desc: "Rechargez vos Diamonds Mobile Legends pour acheter des skins de héros, effets de skill et passer votre Battle Pass. Service instantané garanti.",
        discount: "-20%", rating: 5.0, sales: "80k+", recommended: true, date: "2026-05-20", price: 1.49,
        needsServer: true,   // ← Ce jeu a besoin du serveur — NE PAS CHANGER
        serverOptions: ["(101) Celestial 01", "(102) Celestial 02", "(103) Celestial 03", "(201) Galactic 01", "(202) Galactic 02"],
        idLabel: "ID Mobile Legends", idPlaceholder: "Ex: 123456789",
        denoms: [
            { label: "86 Diamonds", eur: 1.49, htg: 200 },
            { label: "172 Diamonds", eur: 2.99, htg: 404 },
            { label: "450 Diamonds", eur: 7.49, htg: 1012 },
            { label: "1012 Diamonds", eur: 15.99, htg: 2160 },
            { label: "2195 Diamonds", eur: 31.99, htg: 4320 },
            { label: "Weekly Diamond Pass", eur: 2.99, htg: 404 },
        ]
    },

    {
        id: 7,
        name: "Clash of Clans",
        category: "jeux",
        img: "img/Clash of clans.jpeg",
        desc: "Rechargez vos Gemmes Clash of Clans pour accélérer vos constructions, acheter des ressources et le Pass Or. Livraison directe sur votre village.",
        discount: "-8%", rating: 4.9, sales: "60k+", recommended: false, date: "2026-03-01", price: 1.09,
        needsServer: false, serverOptions: [],
        idLabel: "Tag Clash of Clans", idPlaceholder: "Ex: #ABC123DEF",
        denoms: [
            { label: "80 Gemmes", eur: 1.09, htg: 147 },
            { label: "500 Gemmes", eur: 4.99, htg: 674 },
            { label: "1200 Gemmes", eur: 9.99, htg: 1350 },
            { label: "2500 Gemmes", eur: 19.99, htg: 2700 },
            { label: "6500 Gemmes", eur: 49.99, htg: 6750 },
            { label: "14000 Gemmes", eur: 99.99, htg: 13500 },
        ]
    },

    {
        id: 8,
        name: "eFootball (PES)",
        category: "jeux",
        img: "img/e-football.png",
        desc: "Rechargez vos eFootball Coins pour recruter des joueurs légendaires, obtenir des contrats et progresser dans vos tournois PES / eFootball.",
        discount: "-15%", rating: 4.7, sales: "25k+", recommended: false, date: "2026-06-05", price: 0.99,
        needsServer: false, serverOptions: [],
        idLabel: "ID eFootball", idPlaceholder: "Ex: 1234567890",
        denoms: [
            { label: "100 Coins", eur: 0.99, htg: 134 },
            { label: "500 Coins", eur: 4.99, htg: 674 },
            { label: "1000 Coins", eur: 9.49, htg: 1282 },
            { label: "3000 Coins", eur: 24.99, htg: 3374 },
            { label: "6000 Coins", eur: 47.99, htg: 6480 },
        ]
    },

    {
        id: 9,
        name: "Fortnite",
        category: "jeux",
        img: "img/fortnite.png",
        desc: "Rechargez vos V-Bucks Fortnite pour acheter des skins, émotes, le Battle Pass de la saison et des packs exclusifs sur PC, PS4/5 ou Xbox.",
        discount: "-10%", rating: 5.0, sales: "100k+", recommended: true, date: "2026-05-15", price: 7.99,
        needsServer: false, serverOptions: [],
        idLabel: "Nom d'utilisateur Epic Games", idPlaceholder: "Ex: MonPseudoFortnite",
        denoms: [
            { label: "1000 V-Bucks", eur: 7.99, htg: 1080 },
            { label: "2800 V-Bucks + 300", eur: 19.99, htg: 2700 },
            { label: "5000 V-Bucks + 1000", eur: 31.99, htg: 4320 },
            { label: "13500 V-Bucks + 3500", eur: 79.99, htg: 10800 },
        ]
    },

    // ════════════════════════════════════════════════════════════════════════
    //  ➕ AJOUTE TES NOUVEAUX JEUX ICI (avant la ligne des cartes de paiement)
    //  Copie le modèle en haut de ce fichier et colle-le ici.
    //  Prochain id disponible : 21
    // ════════════════════════════════════════════════════════════════════════


    // ════════════════════════════════════════════════════════════════════════
    //  CARTES DE PAIEMENT
    // ════════════════════════════════════════════════════════════════════════

    {
        id: 15,
        name: "Razer Gold",
        category: "payment-cards",
        img: "img/razer_gold_card.png",
        desc: "Les crédits Razer Gold sont la monnaie virtuelle universelle pour les jeux. Utilisable sur +3000 jeux et partenaires dans le monde entier.",
        discount: "-10%", rating: 4.7, sales: "50k+", recommended: false, date: "2026-04-20", price: 5.49,
        needsServer: false, serverOptions: [],
        idLabel: "Email du compte Razer", idPlaceholder: "Ex: votre@email.com",
        denoms: [
            { label: "5 USD Razer Gold", eur: 5.49, htg: 742 },
            { label: "10 USD Razer Gold", eur: 10.49, htg: 1417 },
            { label: "20 USD Razer Gold", eur: 19.99, htg: 2700 },
            { label: "50 USD Razer Gold", eur: 48.99, htg: 6615 },
            { label: "100 USD Razer Gold", eur: 97.99, htg: 13230 },
        ]
    },

    // ════════════════════════════════════════════════════════════════════════
    //  ➕ AJOUTE TES CARTES DE PAIEMENT ICI
    // ════════════════════════════════════════════════════════════════════════


    // ════════════════════════════════════════════════════════════════════════
    //  CARTES CADEAUX (Gift Cards)
    // ════════════════════════════════════════════════════════════════════════

    {
        id: 10,
        name: "Carte Apple / iTunes",
        category: "gift-cards",
        img: "img/Apple Card.jpeg",
        desc: "Créditez votre compte Apple App Store & iTunes pour apps, jeux, musique, films et abonnements Apple One, Apple TV+, Apple Music.",
        discount: "-5%", rating: 5.0, sales: "90k+", recommended: true, date: "2026-01-10", price: 15.99,
        needsServer: false, serverOptions: [],
        idLabel: "Email Apple ID", idPlaceholder: "Ex: votre@email.com",
        denoms: [
            { label: "15€ App Store", eur: 15.99, htg: 2161 },
            { label: "25€ App Store", eur: 24.99, htg: 3374 },
            { label: "50€ App Store", eur: 49.99, htg: 6750 },
            { label: "100€ App Store", eur: 97.99, htg: 13230 },
        ]
    },

    {
        id: 11,
        name: "Carte Google Play",
        category: "gift-cards",
        img: "img/google_play_card.png",
        desc: "Rechargez votre compte Google Play pour acheter des applications Android, jeux, films, livres numériques et abonnements YouTube Premium.",
        discount: "-5%", rating: 4.9, sales: "80k+", recommended: true, date: "2026-02-15", price: 5.49,
        needsServer: false, serverOptions: [],
        idLabel: "Email Google / Gmail", idPlaceholder: "Ex: votre@gmail.com",
        denoms: [
            { label: "5€ Google Play", eur: 5.49, htg: 742 },
            { label: "15€ Google Play", eur: 14.99, htg: 2025 },
            { label: "25€ Google Play", eur: 24.99, htg: 3374 },
            { label: "50€ Google Play", eur: 48.99, htg: 6615 },
        ]
    },

    {
        id: 12,
        name: "PlayStation Network",
        category: "gift-cards",
        img: "img/Play Station Network.jpeg",
        desc: "Rechargez votre compte PSN pour acheter des jeux PS4/PS5, DLC et abonnements PlayStation Plus Essential, Extra ou Premium.",
        discount: "-12%", rating: 4.8, sales: "70k+", recommended: true, date: "2026-06-02", price: 10.99,
        needsServer: false, serverOptions: [],
        idLabel: "Email du compte PSN", idPlaceholder: "Ex: votre@email.com",
        denoms: [
            { label: "PSN 10€", eur: 10.99, htg: 1485 },
            { label: "PSN 20€", eur: 20.99, htg: 2835 },
            { label: "PSN 50€", eur: 49.99, htg: 6750 },
            { label: "PSN 100€", eur: 97.99, htg: 13230 },
        ]
    },

    {
        id: 13,
        name: "Xbox & Game Pass",
        category: "gift-cards",
        img: "img/xbox_card.png",
        desc: "Accédez à des centaines de jeux Xbox et PC avec le Game Pass Ultimate. Inclut Xbox Live Gold, EA Play et le cloud gaming xCloud.",
        discount: "-15%", rating: 4.8, sales: "40k+", recommended: false, date: "2026-06-08", price: 14.99,
        needsServer: false, serverOptions: [],
        idLabel: "Email du compte Xbox", idPlaceholder: "Ex: votre@email.com",
        denoms: [
            { label: "Game Pass Ultimate 1 mois", eur: 14.99, htg: 2025 },
            { label: "Game Pass Ultimate 3 mois", eur: 39.99, htg: 5400 },
            { label: "Xbox 15€", eur: 14.99, htg: 2025 },
            { label: "Xbox 50€", eur: 48.99, htg: 6615 },
        ]
    },

    {
        id: 14,
        name: "Carte Steam",
        category: "gift-cards",
        img: "img/steam_card.png",
        desc: "Rechargez votre Wallet Steam pour acheter des jeux PC, DLC, logiciels et accessoires. Utilisable sur toute la bibliothèque Steam mondiale.",
        discount: "-8%", rating: 4.9, sales: "85k+", recommended: true, date: "2026-05-10", price: 5.49,
        needsServer: false, serverOptions: [],
        idLabel: "Email du compte Steam", idPlaceholder: "Ex: votre@email.com",
        denoms: [
            { label: "Steam 5€", eur: 5.49, htg: 742 },
            { label: "Steam 10€", eur: 10.49, htg: 1417 },
            { label: "Steam 20€", eur: 19.99, htg: 2700 },
            { label: "Steam 50€", eur: 48.99, htg: 6615 },
            { label: "Steam 100€", eur: 97.99, htg: 13230 },
        ]
    },

    // ════════════════════════════════════════════════════════════════════════
    //  ➕ AJOUTE TES CARTES CADEAUX ICI
    //  (Netflix, Disney+, Spotify, Amazon, etc.)
    // ════════════════════════════════════════════════════════════════════════


    // ════════════════════════════════════════════════════════════════════════
    //  CLÉS DE JEUX (CD-Keys)
    // ════════════════════════════════════════════════════════════════════════

    {
        id: 16,
        name: "Forza Horizon 6",
        category: "game-cd-key",
        img: "img/Forza Horizon 6.png",
        desc: "Clé d'activation officielle pour Forza Horizon 6. Le jeu de course open-world ultime sur Xbox Series X/S et PC Windows. Livrée par email.",
        discount: "-15%", rating: 4.9, sales: "12k+", recommended: true, date: "2026-06-15", price: 58.29,
        needsServer: false, serverOptions: [],
        idLabel: "Email de livraison", idPlaceholder: "Ex: votre@email.com",
        denoms: [
            { label: "Édition Standard (Xbox/PC)", eur: 58.29, htg: 7870 },
            { label: "Édition Premium (Xbox/PC)", eur: 79.99, htg: 10800 },
        ]
    },

    {
        id: 17,
        name: "Gothic 1 Remake",
        category: "game-cd-key",
        img: "img/Gothic 1 remake.jpeg",
        desc: "La clé Steam officielle de Gothic 1 Remake — la renaissance du RPG culte en 3D moderne. Revivez la Colonie avec des graphismes époustouflants.",
        discount: "-25%", rating: 4.8, sales: "8k+", recommended: false, date: "2026-06-10", price: 29.99,
        needsServer: false, serverOptions: [],
        idLabel: "Email de livraison", idPlaceholder: "Ex: votre@email.com",
        denoms: [
            { label: "Édition Standard (Steam PC)", eur: 29.99, htg: 4050 },
            { label: "Édition Deluxe (Steam PC)", eur: 39.99, htg: 5400 },
        ]
    },

    {
        id: 18,
        name: "007 First Light",
        category: "game-cd-key",
        img: "img/007_first_light.png",
        desc: "Clé officielle de 007 First Light — Devenez James Bond dans ce jeu d'action-espionnage nouvelle génération développé par IO Interactive.",
        discount: "-9%", rating: 4.7, sales: "15k+", recommended: false, date: "2026-06-12", price: 19.99,
        needsServer: false, serverOptions: [],
        idLabel: "Email de livraison", idPlaceholder: "Ex: votre@email.com",
        denoms: [
            { label: "Édition Standard (Xbox/PC)", eur: 19.99, htg: 2700 },
            { label: "Édition Deluxe (Xbox/PC)", eur: 29.99, htg: 4050 },
        ]
    },

    {
        id: 19,
        name: "Pragmata",
        category: "game-cd-key",
        img: "img/Pragmata.jpeg",
        desc: "Clé d'activation officielle de Pragmata — le jeu d'action science-fiction de Capcom. Un voyage visionnaire sur la Lune avec un robot IA.",
        discount: "-15%", rating: 4.9, sales: "20k+", recommended: true, date: "2026-06-14", price: 39.99,
        needsServer: false, serverOptions: [],
        idLabel: "Email de livraison", idPlaceholder: "Ex: votre@email.com",
        denoms: [
            { label: "Édition Standard (Steam PC)", eur: 39.99, htg: 5400 },
            { label: "Édition Deluxe (Steam PC)", eur: 59.99, htg: 8099 },
        ]
    },

    {
        id: 20,
        name: "Crimson Desert",
        category: "game-cd-key",
        img: "img/Crimson Desert.jpeg",
        desc: "Clé officielle de Crimson Desert — le RPG d'action en monde ouvert de Pearl Abyss. Combats épiques, monde vaste et histoire profonde.",
        discount: "-17%", rating: 5.0, sales: "30k+", recommended: true, date: "2026-06-15", price: 58.29,
        needsServer: false, serverOptions: [],
        idLabel: "Email de livraison", idPlaceholder: "Ex: votre@email.com",
        denoms: [
            { label: "Édition Standard (Steam PC)", eur: 58.29, htg: 7870 },
            { label: "Édition Premium (Steam PC)", eur: 79.99, htg: 10800 },
        ]
    },

    // ════════════════════════════════════════════════════════════════════════
    //  ➕ AJOUTE TES CLÉS DE JEUX ICI
    // ════════════════════════════════════════════════════════════════════════


    // ════════════════════════════════════════════════════════════════════════
    //  ➕ STREAMING VIDÉO  (Netflix, Disney+, Crunchyroll, etc.)
    //  category: "video-streaming"
    // ════════════════════════════════════════════════════════════════════════


    // ════════════════════════════════════════════════════════════════════════
    //  ➕ MUSIQUE  (Spotify, Deezer, Apple Music, etc.)
    //  category: "music"
    // ════════════════════════════════════════════════════════════════════════


    // ════════════════════════════════════════════════════════════════════════
    //  ➕ RECHARGES MOBILES  (Digicel, Natcom, etc.)
    //  category: "telco-prepaid"
    // ════════════════════════════════════════════════════════════════════════


    // ════════════════════════════════════════════════════════════════════════
    //  ➕ CONSOLES  (Nintendo eShop, etc.)
    //  category: "game-console"
    // ════════════════════════════════════════════════════════════════════════

]; // ← FIN DU TABLEAU — ne rien écrire après cette ligne
