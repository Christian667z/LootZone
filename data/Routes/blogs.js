import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin, DEMO_MODE } from '../supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logActivite } from './logs.js';

const router = express.Router();

// ── CATÉGORIES INITIALES EN MODE DÉMO ──────────────────────────
export let demoBlogCategories = [
    { id: 'cat-1', name: 'Dernières Mises à Jour', slug: 'mises-a-jour', icon_url: '⚡' },
    { id: 'cat-genshin', name: 'Genshin Impact', slug: 'genshin-impact', icon_url: '✨' },
    { id: 'cat-2', name: 'Guides de Jeux', slug: 'guides', icon_url: '📖' },
    { id: 'cat-3', name: 'Codes Promo & Astuces', slug: 'astuces-promos', icon_url: '🎟️' },
    { id: 'cat-4', name: 'Free Fire', slug: 'free-fire', icon_url: '🔥' },
    { id: 'cat-5', name: 'FC 26', slug: 'fc-26', icon_url: '⚽' },
    { id: 'cat-6', name: 'Contenu Partenaire & Créateurs', slug: 'partenaires', icon_url: '🤝' },
    { id: 'cat-7', name: 'PUBG Mobile', slug: 'pubg-mobile', icon_url: '🎯' },
    { id: 'cat-8', name: 'Roblox & Devises', slug: 'roblox', icon_url: '💎' }
];

// ── ARTICLES INITIAUX EN MODE DÉMO ─────────────────────────────
export let demoBlogs = [
    {
        id: 'blog-yae-miko',
        title: 'Genshin Impact : Guide Ultime du Build Yae Miko, Artéfacts et Synergies Électro',
        slug: 'genshin-impact-guide-build-yae-miko',
        excerpt: 'Tout ce qu\'il faut savoir pour optimiser la Grande Prêtresse du Sanctuaire de Narukami : armes recommandées, sets d\'artéfacts et compositions d\'équipe Dendro/Électro dévastatrices.',
        content: `<h3>Maîtriser la puissance divine de Yae Miko</h3>
<p>Yae Miko s'impose comme l'un des sub-DPS Électro les plus constants et dévastateurs de Genshin Impact, en particulier dans les compositions basées sur les réactions de Suractivation (Aggravate).</p>
<h4>1. Meilleures Armes</h4>
<ul>
  <li><strong>Vérité de Kagura (5★) :</strong> L'arme signature incontournable, maximisant le boost de compétence élémentaire.</li>
  <li><strong>Mouvement vagabond (4★) :</strong> Option F2P excellente offrant d'énormes dégâts critiques et des buffs aléatoires puissants.</li>
</ul>
<h4>2. Choix des Artéfacts</h4>
<p>Le set 4 pièces Rêve doré ou le mix 2p Attaque% / 2p Dégâts Électro permettent d'atteindre un équilibre optimal entre Maîtrise Élémentaire et Attaque.</p>`,
        image_url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1000&auto=format&fit=crop&q=80',
        category_id: 'cat-genshin',
        game_name: 'Genshin Impact',
        is_featured: true,
        is_partner: false,
        author_name: 'LootZone Staff',
        read_time: '5 min',
        views_count: 3840,
        created_at: '2026-09-08T10:00:00.000Z',
        updated_at: new Date().toISOString()
    },
    {
        id: 'blog-kazuha',
        title: 'Genshin Impact Kazuha Prefarm Guide : Tous les Matériaux d\'amélioration & Équipements',
        slug: 'genshin-impact-kazuha-prefarm-guide',
        excerpt: 'Kazuha fait une nouvelle réapparition dans les bannières événements ! Retrouvez la liste complète des matériaux d\'élévation, livres d\'aptitudes et artéfacts Ombre de la Verte Chasseuse.',
        content: `<h3>Préparez l\'arrivée de Kaedehara Kazuha</h3>
<p>Considéré comme l\'un des meilleurs supports élémentaires du jeu, Kazuha augmente drastiquement le DPS de vos équipes grâce à sa dispersion Anémo.</p>
<h4>Matériaux requis pour le niveau 90 :</h4>
<ul>
  <li>168 Champignons de verre de Liyue</li>
  <li>46 Mécanismes de Marionnette Maguu Kenki</li>
  <li>18 Insignes d\'orbe marin, 30 insignes argentés, 36 insignes de base</li>
  <li>420 000 Moras d\'élévation + 1 672 000 Moras pour les aptitudes</li>
</ul>`,
        image_url: 'https://images.unsplash.com/photo-1534423861386-85a16f5d13fd?w=800&auto=format&fit=crop&q=80',
        category_id: 'cat-genshin',
        game_name: 'Genshin Impact',
        is_featured: true,
        is_partner: false,
        author_name: 'Kaedehara Team',
        read_time: '4 min',
        views_count: 2950,
        created_at: '2026-09-08T09:30:00.000Z',
        updated_at: new Date().toISOString()
    },
    {
        id: 'blog-1',
        title: 'EA Sports FC 26 : Guide Ultime du Marché des Transferts et Packs FC Points',
        slug: 'ea-sports-fc-26-guide-marche-transferts',
        excerpt: 'Découvrez comment maximiser la rentabilité de vos Points FC, anticiper les baisses du marché et bâtir une équipe compétitive pour FUT Champions.',
        content: `<h3>Construire une équipe de rêve sans gaspiller vos ressources</h3>
<p>La nouvelle saison d'EA Sports FC 26 introduit de nombreuses réformes sur le marché des transferts et la gestion des packs. Dans ce guide complet rédigé par l'équipe LootZone, découvrez nos méthodes pour faire fructifier vos crédits et points FC en un temps record.</p>

<h4>1. Anticiper les événements Team of the Week (TOTW)</h4>
<p>Chaque mercredi, le marché subit des fluctuations massives. Surveillez les cartes régulières des joueurs susceptibles de recevoir un boost pour les revendre au pic d'inflation le vendredi soir avant le lancement de FUT Champions.</p>

<h4>2. Optimiser l'ouverture des packs FC</h4>
<p>Les packs promo flash offrent un ratio points/joueurs rares supérieur aux packs standards. Profitez des offres de recharges LootZone instantanées pour créditer votre compte au meilleur taux du marché avec confirmation en direct.</p>

<h4>3. La méthode de revente des consommables et styles de jeu</h4>
<p>Ne sous-estimez jamais les styles Chasseur, Ombre et les changements de postes. Investir pendant les heures creuses permet de générer 15% à 25% de marge nette quotidienne.</p>`,
        image_url: 'img/fc_26.jpg',
        category_id: 'cat-5',
        game_name: 'FC 26',
        is_featured: true,
        is_partner: false,
        author_name: 'Alexandre Meyer',
        read_time: '6 min',
        views_count: 1420,
        created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 'blog-2',
        title: 'Free Fire OB45 : Nouveaux Personnages, Équilibrage et Guide des Diamants',
        slug: 'free-fire-ob45-nouveaux-personnages-diamants',
        excerpt: 'Analyse complète du patch OB45 de Garena Free Fire : compétences révisées, armes META et comment obtenir vos diamants au meilleur prix sur LootZone.',
        content: `<h3>Le nouveau visage du champ de bataille Free Fire</h3>
<p>La mise à jour OB45 apporte son lot de bouleversements tactiques avec l'arrivée de deux nouveaux héros et une refonte complète des dégâts à longue portée des fusils de précision.</p>

<h4>Tier-List des armes en Battle Royale</h4>
<p>Le M4A1 renforcé prend la tête des fusils d'assaut grâce à une dispersion réduite de 18%. Pour les combats rapprochés en Clash Squad, le MP40 demeure roi avec une cadence inégalée.</p>

<h4>Recharges sécurisées avec ID Joueur</h4>
<p>Sur LootZone, rechargez vos Diamants Free Fire en indiquant simplement votre ID de compte. Zéro mot de passe requis, livraison 100% instantanée avec reçus officiels pour vos passes de saison et tirages de roulette.</p>`,
        image_url: 'img/free fire.png',
        category_id: 'cat-4',
        game_name: 'Free Fire',
        is_featured: true,
        is_partner: false,
        author_name: 'Thomas Chen',
        read_time: '5 min',
        views_count: 980,
        created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 'blog-3',
        title: 'Roblox 2026 : Top Jeux Tendance et Sécurisation de Vos Cartes Cadeaux Robux',
        slug: 'roblox-2026-top-jeux-securisation-robux',
        excerpt: 'Sélection des expériences les plus immersives de l’année sur Roblox et conseils pour activer vos codes cartes cadeaux sans risquer de suspension de compte.',
        content: `<h3>Roblox : Une plateforme en pleine ébullition en 2026</h3>
<p>Avec plus de 80 millions de joueurs quotidiens, l'économie de Roblox s'est professionnalisée. Trouver les bonnes affaires en Robux est désormais crucial pour débloquer skins exclusifs et Game Passes.</p>

<h4>Nos 3 jeux coup de cœur ce mois-ci</h4>
<ul>
  <li><strong>Blade Warriors Rebirth :</strong> Un RPG d'action nerveux avec un système de guildes très poussé.</li>
  <li><strong>City Syndicate :</strong> Simulation de gestion urbaine multijoueur ultra réaliste.</li>
  <li><strong>DeepSea Odyssey :</strong> Exploration sous-marine et survie coopérative.</li>
</ul>

<h4>Activation instantanée sur LootZone</h4>
<p>Toutes nos cartes cadeaux Roblox proviennent de distributeurs officiels agréés et fournissent un code pin digital unique 100% garanti.</p>`,
        image_url: 'img/roblox.jpeg',
        category_id: 'cat-8',
        game_name: 'Roblox & Devises',
        is_featured: true,
        is_partner: false,
        author_name: 'Émilie Roy',
        read_time: '4 min',
        views_count: 750,
        created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 'blog-4',
        title: 'Codes Promo LootZone Mars 2026 : Profitez de Remises Jusqu\'à -30%',
        slug: 'codes-promo-lootzone-mars-2026',
        excerpt: 'Récapitulatif de tous les coupons actifs ce mois-ci pour économiser sur vos recharges mobiles, clés Steam, cartes PlayStation et Xbox.',
        content: `<h3>Économisez immédiatement sur l'ensemble du catalogue</h3>
<p>LootZone lance sa campagne printanière avec une série de coupons à durée limitée cumulables avec nos remises directes partenaires.</p>

<h4>Codes actifs ce mois-ci :</h4>
<ul>
  <li><code>LOOT30</code> : -30% sur votre première commande de crédits mobiles (dès 10$).</li>
  <li><code>SPRINGGAMES</code> : -10% immédiat sur les cartes PlayStation Network et Steam.</li>
  <li><code>CREATORBOOST</code> : Réduction spéciale en soutenant votre créateur certifié favori.</li>
</ul>
<p>Saisissez le code dans votre panier ou lors du paiement pour appliquer la déduction automatiquement.</p>`,
        image_url: 'img/banner_gift_cards.jpg',
        category_id: 'cat-3',
        game_name: 'Général',
        is_featured: true,
        is_partner: false,
        author_name: 'Staff LootZone',
        read_time: '3 min',
        views_count: 1850,
        created_at: new Date(Date.now() - 3600000 * 36).toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 'blog-5',
        title: 'Partenariat Officiel : Le Streamer Kaelis Teste la Recharge Instantanée LootZone',
        slug: 'partenariat-streamer-kaelis-recharge-instantanee',
        excerpt: 'En direct sur sa chaîne Twitch, le streamer Kaelis a mis à l\'épreuve la vitesse d\'injection des pass et diamants sur Free Fire. Retour d\'expérience complet.',
        content: `<h3>Une recharge en moins de 15 secondes chrono</h3>
<p>Dans sa dernière session live devant 12 000 spectateurs, Kaelis a testé l'achat d'un pack de 5 600 Diamants Free Fire via LootZone en direct.</p>
<blockquote>« C'est bluffant : pas besoin de donner ses identifiants personnels, juste l'ID Joueur et le temps que je repasse sur mon émulateur, les diamants étaient déjà là avec le reçu par email ! »</blockquote>
<p>Pour célébrer ce partenariat, utilisez le code créateur <code>KAELIS</code> pour recevoir 50 diamants bonus lors de votre prochaine recharge.</p>`,
        image_url: 'img/free fire.png',
        category_id: 'cat-6',
        game_name: 'Free Fire',
        is_featured: false,
        is_partner: true,
        author_name: 'Kaelis x LootZone',
        read_time: '4 min',
        views_count: 2310,
        created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 'blog-6',
        title: 'Créateur du Mois : NexTrophy Dévoile sa Tactique 4-3-2-1 Invaincue sur FC 26',
        slug: 'createur-nextrophy-tactique-fc-26',
        excerpt: 'Collaboration exclusive : le créateur eSport NexTrophy partage ses instructions personnalisées et comment il optimise son équipe grâce aux pass compétitifs LootZone.',
        content: `<h3>La méta tactique décortiquée par un pro</h3>
<p>NexTrophy, créateur certifié du programme partenaires LootZone, partage ses réglages tactiques confidentiels qui lui ont permis de signer un sans-faute 20-0 lors du dernier weekend FUT Champions.</p>
<h4>Instructions de joueur clés :</h4>
<ul>
  <li><strong>Ailier gauche :</strong> Repiquer au centre, dans le dos de la défense, soutien offensif complet.</li>
  <li><strong>Milieu défensif :</strong> Couper les lignes de passe, rester derrière en attaque, couvrir le centre.</li>
  <li><strong>Latéraux :</strong> Rester derrière en attaque, interceptions conservatrices pour préserver l'endurance.</li>
</ul>`,
        image_url: 'img/fc_26.jpg',
        category_id: 'cat-6',
        game_name: 'FC 26',
        is_featured: false,
        is_partner: true,
        author_name: 'NexTrophy (Partenaire Certifié)',
        read_time: '5 min',
        views_count: 3100,
        created_at: new Date(Date.now() - 3600000 * 30).toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 'blog-7',
        title: 'PUBG Mobile : Sensibilité Gyroscope & Optimisation des UC pour le Royale Pass A10',
        slug: 'pubg-mobile-sensibilite-gyroscope-uc-pass',
        excerpt: 'Le guide complet pour régler vos contrôles 4 doigts + gyroscope et rentabiliser votre achat d\'Unknown Cash (UC) sans frais cachés.',
        content: `<h3>Prenez l'avantage compétitif sur Erangel et Miramar</h3>
<p>La transition vers les contrôles gyroscopiques est la clé pour stabiliser les rafales du M416 x6 ou du Beryl M762. Dans ce dossier spécial PUBG Mobile, découvrez les codes de sensibilité recommandés par les joueurs professionnels.</p>
<h4>Astuces pour le Royale Pass A10</h4>
<p>Achetez le pack Elite Pass au lieu du pack standard pour débloquer automatiquement 25 rangs et récupérer l'intégralité de vos UC au palier 100.</p>`,
        image_url: 'img/PUBG Mobile.png',
        category_id: 'cat-7',
        game_name: 'PUBG Mobile',
        is_featured: false,
        is_partner: false,
        author_name: 'Karim Hadad',
        read_time: '5 min',
        views_count: 890,
        created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 'blog-8',
        title: 'Programme d\'Affiliation & Créateurs LootZone 2026 : Jusqu\'à 15% de Commission',
        slug: 'programme-affiliation-createurs-lootzone-2026',
        excerpt: 'Vous êtes streamer, vidéaste ou community manager gaming ? Rejoignez notre réseau officiel et monétisez votre communauté avec un tableau de bord en temps réel.',
        content: `<h3>Un partenariat gagnant-gagnant pour les créateurs de contenu</h3>
<p>LootZone renouvelle son programme créateurs pour 2026 avec un taux de redistribution record, des codes promotionnels personnalisés pour votre public et des paiements automatisés mensuels.</p>
<h4>Avantages certifiés :</h4>
<ul>
  <li>Jusqu'à 15% de commission sur chaque vente générée.</li>
  <li>Fourniture de crédits jeux offerts chaque mois pour vos concours et streams.</li>
  <li>Tableau de bord dédié avec tracking analytique en temps réel.</li>
</ul>
<p>Postulez directement depuis la rubrique "Programme Créateurs" du pied de page ou contactez notre équipe partenariats.</p>`,
        image_url: 'img/banner_nextgen_keys.jpg',
        category_id: 'cat-6',
        game_name: 'Partenariats',
        is_featured: false,
        is_partner: true,
        author_name: 'LootZone Partnership Team',
        read_time: '4 min',
        views_count: 1450,
        created_at: new Date(Date.now() - 3600000 * 60).toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 'blog-9',
        title: 'Free Fire : Les Meilleurs Combos de Compétences Actives & Passives en 2026',
        slug: 'free-fire-meilleurs-combos-competences',
        excerpt: 'Découvrez les combinaisons de personnages indispensables pour dominer le mode Clash Squad héroïque et le Battle Royale Classé.',
        content: `<h3>La synergie d'équipe fait la différence</h3>
<p>Associer la bonne compétence active (Alok, Chrono, Dimitri ou Tatsuya) avec les meilleurs passifs défensifs (Kelly éveillée, Hayato, Shirou) vous offre jusqu'à 35% de résistance et de mobilité supplémentaire dans les duels sous haute pression.</p>`,
        image_url: 'img/free fire.png',
        category_id: 'cat-4',
        game_name: 'Free Fire',
        is_featured: false,
        is_partner: false,
        author_name: 'Thomas Chen',
        read_time: '4 min',
        views_count: 620,
        created_at: new Date(Date.now() - 3600000 * 72).toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 'blog-10',
        title: 'Cartes PlayStation Network & Steam : Comment Éviter les Blocages Régionaux',
        slug: 'cartes-psn-steam-guide-regions',
        excerpt: 'Tout comprendre sur le zonage des codes prépayés (US, FR, EUR, Global) et configurer son compte sans risque de blocage de fonds.',
        content: `<h3>Comprendre les restrictions géographiques des stores numériques</h3>
<p>De nombreux joueurs profitent des tarifs avantageux des stores US ou EUR. Suivez nos recommandations pas à pas pour associer le bon code prépayé à la bonne zone de facturation en toute sérénité.</p>`,
        image_url: 'img/Play Station Network.jpeg',
        category_id: 'cat-2',
        game_name: 'PlayStation & Steam',
        is_featured: false,
        is_partner: false,
        author_name: 'Marc Lefèvre',
        read_time: '4 min',
        views_count: 940,
        created_at: new Date(Date.now() - 3600000 * 84).toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 'blog-genshin-3',
        title: 'Genshin Impact 5.4 : Bannière Mavuika, Analyse des Armes et Économie de Primo-gemmes',
        slug: 'genshin-impact-mavuika-banniere-analyse',
        excerpt: 'Tout ce qu\'il faut savoir sur l\'Archon Pyro Mavuika : gameplay, rotation d\'équipe et calcul des invocations nécessaires.',
        content: `<h3>L'avènement de l'Archon Pyro</h3><p>Mavuika transforme la dynamique de combat dans Genshin Impact grâce à ses attaques coordonnées Pyro et ses bonus de dégâts d'équipe massifs.</p>`,
        image_url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80',
        category_id: 'cat-genshin',
        game_name: 'Genshin Impact',
        is_featured: false,
        is_partner: false,
        author_name: 'LootZone Guides',
        read_time: '5 min',
        views_count: 1890,
        created_at: new Date(Date.now() - 3600000 * 90).toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 'blog-genshin-4',
        title: 'Genshin Impact : Tier-List des Meilleurs Supports & Soigneurs en Profondeurs Spiralées',
        slug: 'genshin-impact-tier-list-supports-abysses',
        excerpt: 'Classement actualisé des personnages utilitaires indispensables pour terminer les étages 11 et 12 des Profondeurs Spiralées avec 36 étoiles.',
        content: `<h3>Les piliers de vos compositions d'équipe</h3><p>Bennett, Furina, Zhongli et Kazuha continuent de régner sur les statistiques d'utilisation des Profondeurs Spiralées.</p>`,
        image_url: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80',
        category_id: 'cat-genshin',
        game_name: 'Genshin Impact',
        is_featured: false,
        is_partner: false,
        author_name: 'LootZone Staff',
        read_time: '6 min',
        views_count: 2420,
        created_at: new Date(Date.now() - 3600000 * 100).toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 'blog-freefire-4',
        title: 'Free Fire Clash Squad : Stratégies de Rotation et Gestion Économique des Armes',
        slug: 'free-fire-clash-squad-strategies-economie',
        excerpt: 'Maîtrisez la gestion des pièces en Clash Squad classé et surprenez l\'équipe adverse avec des prises de ligne chirurgicales.',
        content: `<h3>Gagner chaque round décisif</h3><p>La gestion de l'économie lors des deux premiers rounds dicte l'accès aux gilets de niveau 3 et aux grenades fumigènes indispensables pour sécuriser la zone.</p>`,
        image_url: 'img/free fire.png',
        category_id: 'cat-4',
        game_name: 'Free Fire',
        is_featured: false,
        is_partner: false,
        author_name: 'Thomas Chen',
        read_time: '4 min',
        views_count: 1150,
        created_at: new Date(Date.now() - 3600000 * 110).toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 'blog-fc26-3',
        title: 'FC 26 Ultimate Team : Top 10 des Pépites Meta Low-Budget pour Débuter la Saison',
        slug: 'fc-26-top-10-pepites-meta-low-budget',
        excerpt: 'Les meilleurs joueurs à moins de 5 000 crédits avec des statistiques cachées dévastatrices pour dominer Division Rivals.',
        content: `<h3>Bâtir un 11 compétitif sans se ruiner</h3><p>Grâce aux nouveaux PlayStyles et PlayStyles+, découvrez les pépites sous-cotées qui surpassent les cartes or rares les plus chères du marché.</p>`,
        image_url: 'img/fc_26.jpg',
        category_id: 'cat-5',
        game_name: 'FC 26',
        is_featured: false,
        is_partner: false,
        author_name: 'Alexandre Meyer',
        read_time: '5 min',
        views_count: 2130,
        created_at: new Date(Date.now() - 3600000 * 120).toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 'blog-fc26-4',
        title: 'FC 26 Événement TOTS : Calendrier de Sortie, Évolutions Gratuites et Gestion des Crédits',
        slug: 'fc-26-evenement-tots-calendrier-evolutions',
        excerpt: 'Toutes les informations sur la Team of the Season : dates des ligues majeures, objectifs gratuits et préparation de votre club.',
        content: `<h3>Le moment culminant de la saison Ultimate Team</h3><p>Préparez vos packs enregistrés et suivez le calendrier officiel de diffusion des TOTS Premier League, LaLiga et Serie A.</p>`,
        image_url: 'img/banner_ea_sports.jpg',
        category_id: 'cat-5',
        game_name: 'FC 26',
        is_featured: false,
        is_partner: false,
        author_name: 'Alexandre Meyer',
        read_time: '5 min',
        views_count: 3200,
        created_at: new Date(Date.now() - 3600000 * 130).toISOString(),
        updated_at: new Date().toISOString()
    }
];

// ─────────────────────────────────────────────────────────────
// 1. GET /api/blogs/categories — Récupérer toutes les catégories
// ─────────────────────────────────────────────────────────────
router.get('/categories', async (req, res) => {
    try {
        if (DEMO_MODE) {
            return res.json({ success: true, categories: demoBlogCategories });
        }

        const { data, error } = await supabaseAdmin
            .from('blog_categories')
            .select('*')
            .order('name', { ascending: true });

        if (error || !data || data.length === 0) {
            return res.json({ success: true, categories: demoBlogCategories });
        }

        return res.json({ success: true, categories: data });
    } catch (err) {
        console.error('[Blog] Erreur fetch categories :', err.message);
        return res.json({ success: true, categories: demoBlogCategories });
    }
});

// ─────────────────────────────────────────────────────────────
// 2. POST /api/blogs/categories — Créer une catégorie (Staff)
// ─────────────────────────────────────────────────────────────
router.post('/categories', requireAuth, requireRole('employe'), async (req, res) => {
    try {
        const { name, slug, icon_url } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Le nom de la catégorie est obligatoire.' });
        }

        const cleanSlug = (slug || name)
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');

        const newCat = {
            id: `cat-${Date.now()}`,
            name: name.trim(),
            slug: cleanSlug,
            icon_url: icon_url || '📁'
        };

        if (DEMO_MODE) {
            demoBlogCategories.push(newCat);
            return res.status(201).json(newCat);
        }

        const { data, error } = await supabaseAdmin
            .from('blog_categories')
            .insert([{
                name: newCat.name,
                slug: newCat.slug,
                icon_url: newCat.icon_url
            }])
            .select()
            .single();

        if (error) {
            console.error('[Blog] Erreur insert category Supabase:', error.message);
            demoBlogCategories.push(newCat);
            return res.status(201).json(newCat);
        }

        await logActivite(req.user?.id, 'CREATION_CATEGORIE_BLOG', { name: newCat.name });
        return res.status(201).json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// 3. GET /api/blogs — Liste des articles avec filtres & pagination
// ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const {
            category,
            search,
            game,
            featured,
            partner,
            page = 1,
            limit = 9
        } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 9));

        function getFilteredDemoArticles() {
            let filtered = [...demoBlogs];

            if (category && category !== 'all') {
                const foundCat = demoBlogCategories.find(c => c.slug === category || c.id === category);
                if (foundCat) {
                    filtered = filtered.filter(b => b.category_id === foundCat.id || b.game_name?.toLowerCase().includes(foundCat.name.toLowerCase()));
                }
            }

            if (game && game !== 'all') {
                filtered = filtered.filter(b => b.game_name?.toLowerCase() === game.toLowerCase());
            }

            if (featured !== undefined && featured !== '') {
                const isF = featured === 'true' || featured === true;
                filtered = filtered.filter(b => b.is_featured === isF);
            }

            if (partner !== undefined && partner !== '') {
                const isP = partner === 'true' || partner === true;
                filtered = filtered.filter(b => b.is_partner === isP);
            }

            if (search && search.trim()) {
                const q = search.trim().toLowerCase();
                filtered = filtered.filter(b =>
                    b.title.toLowerCase().includes(q) ||
                    b.excerpt?.toLowerCase().includes(q) ||
                    b.content.toLowerCase().includes(q) ||
                    b.game_name?.toLowerCase().includes(q) ||
                    b.author_name?.toLowerCase().includes(q)
                );
            }

            // Sort by created_at desc
            filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            const total = filtered.length;
            const totalPages = Math.ceil(total / limitNum) || 1;
            const start = (pageNum - 1) * limitNum;
            const items = filtered.slice(start, start + limitNum);

            // Attach category name
            const enriched = items.map(item => {
                const cat = demoBlogCategories.find(c => c.id === item.category_id);
                return { ...item, category_name: cat?.name || item.game_name || 'Général' };
            });

            return {
                success: true,
                articles: enriched,
                items: enriched,
                total,
                page: pageNum,
                totalPages,
                limit: limitNum,
                pagination: { total, page: pageNum, totalPages, limit: limitNum }
            };
        }

        if (DEMO_MODE) {
            return res.json(getFilteredDemoArticles());
        }

        // SUPABASE MODE
        let query = supabaseAdmin
            .from('blogs')
            .select(`
                *,
                category:blog_categories(id, name, slug)
            `, { count: 'exact' });

        if (category && category !== 'all') {
            const isUuid = /^[0-9a-fA-F-]{36}$/.test(category);
            if (isUuid) {
                query = query.eq('category_id', category);
            } else {
                const { data: catRow } = await supabaseAdmin
                    .from('blog_categories')
                    .select('id')
                    .eq('slug', category)
                    .maybeSingle();
                if (catRow) {
                    query = query.eq('category_id', catRow.id);
                }
            }
        }

        if (game && game !== 'all') {
            query = query.ilike('game_name', `%${game}%`);
        }

        if (featured !== undefined && featured !== '') {
            query = query.eq('is_featured', featured === 'true');
        }

        if (partner !== undefined && partner !== '') {
            query = query.eq('is_partner', partner === 'true');
        }

        if (search && search.trim()) {
            const q = search.trim();
            query = query.or(`title.ilike.%${q}%,excerpt.ilike.%${q}%,game_name.ilike.%${q}%,author_name.ilike.%${q}%`);
        }

        const from = (pageNum - 1) * limitNum;
        const to = from + limitNum - 1;

        query = query.order('created_at', { ascending: false }).range(from, to);

        const { data, count, error } = await query;

        if (error) {
            console.error('[Blog] Erreur query Supabase blogs, fallback demo filtré:', error.message);
            return res.json(getFilteredDemoArticles());
        }

        const items = (data || []).map(row => ({
            ...row,
            category_name: row.category?.name || row.game_name || 'Général'
        }));

        const total = count || items.length;
        const totalPages = Math.ceil(total / limitNum) || 1;

        return res.json({
            success: true,
            articles: items,
            items,
            total,
            page: pageNum,
            totalPages,
            limit: limitNum,
            pagination: { total, page: pageNum, totalPages, limit: limitNum }
        });
    } catch (err) {
        console.error('[Blog] Exception GET /api/blogs:', err.message);
        return res.json({
            success: true,
            articles: demoBlogs.slice(0, 9),
            items: demoBlogs.slice(0, 9),
            total: demoBlogs.length,
            page: 1,
            totalPages: Math.ceil(demoBlogs.length / 9),
            limit: 9,
            pagination: { total: demoBlogs.length, page: 1, totalPages: Math.ceil(demoBlogs.length / 9), limit: 9 }
        });
    }
});

// ─────────────────────────────────────────────────────────────
// 4. GET /api/blogs/hubs — Articles groupés par hubs de jeux
// ─────────────────────────────────────────────────────────────
router.get('/hubs', async (req, res) => {
    try {
        let allArticles = [];

        if (DEMO_MODE) {
            allArticles = [...demoBlogs];
        } else {
            const { data, error } = await supabaseAdmin
                .from('blogs')
                .select('*, category:blog_categories(id, name, slug)')
                .order('created_at', { ascending: false });

            if (error || !data || data.length === 0) {
                allArticles = [...demoBlogs];
            } else {
                allArticles = data.map(r => ({
                    ...r,
                    category_name: r.category?.name || r.game_name || 'Général'
                }));
            }
        }

        // Define top hubs with icons & titles (LootBar standard: Genshin Impact, Free Fire, FC 26)
        const hubConfigs = [
            {
                game: 'Genshin Impact',
                name: 'Genshin Impact',
                icon: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=120&auto=format&fit=crop&q=80',
                description: 'Builds de personnages, tier-lists, bannières et primo-gemmes'
            },
            {
                game: 'Free Fire',
                name: 'Free Fire',
                icon: 'img/free fire.png',
                description: 'Guides tactiques, événements Battle Royale et optimisations de Diamants'
            },
            {
                game: 'FC 26',
                name: 'EA Sports FC 26',
                icon: 'img/fc_26.jpg',
                description: 'Marché FUT, tactiques compétitives, Team of the Week et points FC'
            }
        ];

        const hubs = hubConfigs.map(cfg => {
            const articles = allArticles.filter(a =>
                a.game_name?.toLowerCase().includes(cfg.game.toLowerCase()) ||
                a.title.toLowerCase().includes(cfg.game.toLowerCase())
            ).slice(0, 4);

            return {
                game: cfg.game,
                title: cfg.name,
                icon: cfg.icon,
                description: cfg.description,
                count: articles.length,
                articles
            };
        }).filter(h => h.articles.length > 0);

        return res.json(hubs);
    } catch (err) {
        console.error('[Blog] Exception hubs:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// 5. GET /api/blogs/:idOrSlug — Récupérer un article unique
// ─────────────────────────────────────────────────────────────
router.get('/:idOrSlug', async (req, res) => {
    try {
        const { idOrSlug } = req.params;

        if (DEMO_MODE) {
            const found = demoBlogs.find(b => b.id === idOrSlug || b.slug === idOrSlug);
            if (!found) {
                return res.status(404).json({ error: 'Article introuvable.' });
            }
            const cat = demoBlogCategories.find(c => c.id === found.category_id);
            found.views_count = (found.views_count || 0) + 1;
            return res.json({ ...found, category_name: cat?.name || found.game_name || 'Général' });
        }

        const isUuid = /^[0-9a-fA-F-]{36}$/.test(idOrSlug);
        let query = supabaseAdmin
            .from('blogs')
            .select('*, category:blog_categories(id, name, slug)');

        if (isUuid) {
            query = query.eq('id', idOrSlug);
        } else {
            query = query.eq('slug', idOrSlug);
        }

        const { data, error } = await query.maybeSingle();

        if (error || !data) {
            // Check demo fallback
            const foundDemo = demoBlogs.find(b => b.id === idOrSlug || b.slug === idOrSlug);
            if (foundDemo) return res.json(foundDemo);
            return res.status(404).json({ error: 'Article introuvable.' });
        }

        // Increment views in background
        supabaseAdmin
            .from('blogs')
            .update({ views_count: (data.views_count || 0) + 1 })
            .eq('id', data.id)
            .then(() => {})
            .catch(() => {});

        return res.json({
            ...data,
            category_name: data.category?.name || data.game_name || 'Général'
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// 6. POST /api/blogs — Créer un nouvel article (Staff)
// ─────────────────────────────────────────────────────────────
router.post('/', requireAuth, requireRole('employe'), async (req, res) => {
    try {
        const {
            title,
            slug,
            excerpt,
            content,
            image_url,
            category_id,
            game_name,
            is_featured,
            is_partner,
            author_name,
            read_time
        } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Le titre de l\'article est obligatoire.' });
        }
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Le contenu de l\'article est obligatoire.' });
        }

        const autoSlug = (slug || title)
            .toLowerCase()
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');

        const finalSlug = `${autoSlug}-${Date.now().toString().slice(-4)}`;

        const newBlog = {
            id: DEMO_MODE ? `blog-${Date.now()}` : uuidv4(),
            title: title.trim(),
            slug: finalSlug,
            excerpt: excerpt ? excerpt.trim() : title.trim().slice(0, 160),
            content: content.trim(),
            image_url: image_url || 'img/banner_nextgen_keys.jpg',
            category_id: category_id || null,
            game_name: game_name ? game_name.trim() : 'Général',
            is_featured: Boolean(is_featured),
            is_partner: Boolean(is_partner),
            author_name: author_name ? author_name.trim() : (req.user?.prenom ? `${req.user.prenom} ${req.user.nom || ''}`.trim() : 'Équipe LootZone'),
            read_time: read_time ? read_time.trim() : '4 min',
            views_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (DEMO_MODE) {
            demoBlogs.unshift(newBlog);
            return res.status(201).json(newBlog);
        }

        const { data, error } = await supabaseAdmin
            .from('blogs')
            .insert([{
                title: newBlog.title,
                slug: newBlog.slug,
                excerpt: newBlog.excerpt,
                content: newBlog.content,
                image_url: newBlog.image_url,
                category_id: newBlog.category_id,
                game_name: newBlog.game_name,
                is_featured: newBlog.is_featured,
                is_partner: newBlog.is_partner,
                author_name: newBlog.author_name,
                read_time: newBlog.read_time
            }])
            .select()
            .single();

        if (error) {
            console.error('[Blog] Erreur insert Supabase:', error.message);
            demoBlogs.unshift(newBlog);
            return res.status(201).json(newBlog);
        }

        await logActivite(req.user?.id, 'CREATION_ARTICLE_BLOG', { title: newBlog.title, slug: newBlog.slug });
        return res.status(201).json(data);
    } catch (err) {
        console.error('[Blog] Exception création:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// 7. PUT /api/blogs/:id — Mettre à jour un article (Staff)
// ─────────────────────────────────────────────────────────────
router.put('/:id', requireAuth, requireRole('employe'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            excerpt,
            content,
            image_url,
            category_id,
            game_name,
            is_featured,
            is_partner,
            author_name,
            read_time
        } = req.body;

        const updates = {
            updated_at: new Date().toISOString()
        };
        if (title !== undefined) updates.title = title.trim();
        if (excerpt !== undefined) updates.excerpt = excerpt.trim();
        if (content !== undefined) updates.content = content.trim();
        if (image_url !== undefined) updates.image_url = image_url;
        if (category_id !== undefined) updates.category_id = category_id;
        if (game_name !== undefined) updates.game_name = game_name.trim();
        if (is_featured !== undefined) updates.is_featured = Boolean(is_featured);
        if (is_partner !== undefined) updates.is_partner = Boolean(is_partner);
        if (author_name !== undefined) updates.author_name = author_name.trim();
        if (read_time !== undefined) updates.read_time = read_time.trim();

        if (DEMO_MODE) {
            const idx = demoBlogs.findIndex(b => b.id === id);
            if (idx === -1) return res.status(404).json({ error: 'Article introuvable' });
            demoBlogs[idx] = { ...demoBlogs[idx], ...updates };
            return res.json(demoBlogs[idx]);
        }

        const { data, error } = await supabaseAdmin
            .from('blogs')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('[Blog] Erreur update Supabase:', error.message);
            const idx = demoBlogs.findIndex(b => b.id === id);
            if (idx !== -1) {
                demoBlogs[idx] = { ...demoBlogs[idx], ...updates };
                return res.json(demoBlogs[idx]);
            }
            return res.status(500).json({ error: error.message });
        }

        await logActivite(req.user?.id, 'MODIFICATION_ARTICLE_BLOG', { id, title: updates.title });
        return res.json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// 8. DELETE /api/blogs/:id — Supprimer un article (Staff)
// ─────────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, requireRole('employe'), async (req, res) => {
    try {
        const { id } = req.params;

        if (DEMO_MODE) {
            const idx = demoBlogs.findIndex(b => b.id === id);
            if (idx === -1) return res.status(404).json({ error: 'Article introuvable' });
            demoBlogs.splice(idx, 1);
            return res.json({ success: true, message: 'Article supprimé.' });
        }

        const { error } = await supabaseAdmin
            .from('blogs')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('[Blog] Erreur delete Supabase:', error.message);
            const idx = demoBlogs.findIndex(b => b.id === id);
            if (idx !== -1) demoBlogs.splice(idx, 1);
            return res.json({ success: true, message: 'Article supprimé en local.' });
        }

        await logActivite(req.user?.id, 'SUPPRESSION_ARTICLE_BLOG', { id });
        return res.json({ success: true, message: 'Article supprimé avec succès.' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// 9. POST /api/blogs/upload-image — Upload image vers Storage bucket "blog-images"
// ─────────────────────────────────────────────────────────────
router.post('/upload-image', requireAuth, requireRole('employe'), async (req, res) => {
    try {
        const { base64Data, fileName, mimeType } = req.body;

        if (!base64Data) {
            return res.status(400).json({ error: 'Données d\'image manquantes.' });
        }

        const cleanExt = (fileName && fileName.includes('.'))
            ? fileName.split('.').pop().toLowerCase()
            : 'png';

        const fileId = `blog_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${cleanExt}`;

        // Si nous sommes en mode Supabase avec Storage
        if (!DEMO_MODE && supabaseAdmin) {
            try {
                // Nettoyer le préfixe data:image/...;base64,
                const buffer = Buffer.from(
                    base64Data.replace(/^data:image\/\w+;base64,/, ''),
                    'base64'
                );

                const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
                    .from('blog-images')
                    .upload(fileId, buffer, {
                        contentType: mimeType || `image/${cleanExt}`,
                        upsert: true
                    });

                if (uploadErr) {
                    console.warn('[Blog Storage] Échec upload Supabase Storage, utilisation data URI:', uploadErr.message);
                    return res.json({
                        url: base64Data.startsWith('data:') ? base64Data : `data:image/${cleanExt};base64,${base64Data}`
                    });
                }

                const { data: publicUrlData } = supabaseAdmin.storage
                    .from('blog-images')
                    .getPublicUrl(fileId);

                return res.json({ url: publicUrlData.publicUrl });
            } catch (storageErr) {
                console.warn('[Blog Storage] Exception upload:', storageErr.message);
            }
        }

        // Mode démo ou fallback : renvoyer la data-url sécurisée
        const finalDataUrl = base64Data.startsWith('data:')
            ? base64Data
            : `data:image/${cleanExt};base64,${base64Data}`;

        return res.json({ url: finalDataUrl });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default router;
