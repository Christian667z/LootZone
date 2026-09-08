-- ╔══════════════════════════════════════════════════════════════╗
-- ║  ASTA-SHOPS — SEED PRODUITS (exécuter dans Supabase SQL)    ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Vider les produits existants (optionnel)
-- TRUNCATE TABLE products RESTART IDENTITY CASCADE;

INSERT INTO products (name, category, description, image_url, denominations, rating, sales_count, is_recommended, badge_text, player_id_label)
VALUES

-- ── JEUX DE CRÉDIT ─────────────────────────────────────────────
('Free Fire', 'jeux',
 'Rechargez vos diamants Free Fire instantanément. Disponible 24h/24, 7j/7.',
 'img/free_fire.jpg',
 '[{"label":"100 Diamants","eur":0.99,"htg":134},{"label":"310 Diamants","eur":2.49,"htg":336},{"label":"520 Diamants","eur":3.99,"htg":539},{"label":"1080 Diamants","eur":7.99,"htg":1079},{"label":"2200 Diamants","eur":14.99,"htg":2024},{"label":"5600 Diamants","eur":34.99,"htg":4724}]',
 4.8, 1240, true, 'POPULAIRE', 'Player ID Free Fire'),

('PUBG Mobile', 'jeux',
 'Achetez des UC PUBG Mobile pour débloquer skins, caisses et passe de combat.',
 'img/pubg.png',
 '[{"label":"60 UC","eur":0.99,"htg":134},{"label":"325 UC","eur":4.99,"htg":674},{"label":"660 UC","eur":9.99,"htg":1349},{"label":"1800 UC","eur":24.99,"htg":3374},{"label":"3850 UC","eur":49.99,"htg":6749},{"label":"8100 UC","eur":99.99,"htg":13499}]',
 4.7, 870, true, null, 'Player ID PUBG'),

('Call of Duty Mobile', 'jeux',
 'Rechargez vos CP Call of Duty Mobile pour débloquer armes et opérateurs.',
 'img/cod_mobile.jpg',
 '[{"label":"80 CP","eur":0.99,"htg":134},{"label":"400 CP","eur":4.99,"htg":674},{"label":"800 CP","eur":9.99,"htg":1349},{"label":"2000 CP","eur":24.99,"htg":3374},{"label":"4000 CP","eur":44.99,"htg":6074},{"label":"9600 CP","eur":99.99,"htg":13499}]',
 4.6, 650, false, null, 'Player ID COD Mobile'),

('Roblox (Robux)', 'jeux',
 'Achetez des Robux pour personnaliser votre avatar et débloquer du contenu exclusif sur Roblox.',
 'img/roblox.jpeg',
 '[{"label":"400 Robux","eur":4.99,"htg":674},{"label":"800 Robux","eur":9.99,"htg":1349},{"label":"1700 Robux","eur":19.99,"htg":2699},{"label":"4500 Robux","eur":49.99,"htg":6749},{"label":"10000 Robux","eur":99.99,"htg":13499}]',
 4.9, 1580, true, 'TOP', 'Nom d''utilisateur Roblox'),

('EA Sports FC (FIFA)', 'jeux',
 'Achetez des FC Points pour Ultimate Team — packs, joueurs et contenus exclusifs.',
 'img/ea_fc.jpg',
 '[{"label":"500 FC Points","eur":4.99,"htg":674},{"label":"1050 FC Points","eur":9.99,"htg":1349},{"label":"2800 FC Points","eur":24.99,"htg":3374},{"label":"5900 FC Points","eur":49.99,"htg":6749},{"label":"12000 FC Points","eur":99.99,"htg":13499}]',
 4.5, 420, false, null, 'Player ID EA'),

('Mobile Legends', 'jeux',
 'Rechargez vos Diamonds Mobile Legends Bang Bang pour skins et héros.',
 'img/mobile_legends.jpg',
 '[{"label":"86 Diamonds","eur":0.99,"htg":134},{"label":"172 Diamonds","eur":1.99,"htg":269},{"label":"257 Diamonds","eur":2.99,"htg":404},{"label":"706 Diamonds","eur":7.99,"htg":1079},{"label":"2195 Diamonds","eur":24.99,"htg":3374}]',
 4.4, 380, false, null, 'Player ID ML'),

('Clash of Clans', 'jeux',
 'Achetez des gemmes Clash of Clans pour accélérer vos constructions et acheter des ressources.',
 'img/clash_of_clans.jpg',
 '[{"label":"80 Gemmes","eur":0.99,"htg":134},{"label":"500 Gemmes","eur":4.99,"htg":674},{"label":"1200 Gemmes","eur":9.99,"htg":1349},{"label":"2500 Gemmes","eur":19.99,"htg":2699},{"label":"6500 Gemmes","eur":49.99,"htg":6749},{"label":"14000 Gemmes","eur":99.99,"htg":13499}]',
 4.3, 290, false, null, 'Player ID Clash'),

('Fortnite (V-Bucks)', 'jeux',
 'Achetez des V-Bucks Fortnite pour skins, emotes, passe de combat et plus encore.',
 'img/fortnite.png',
 '[{"label":"1000 V-Bucks","eur":7.99,"htg":1079},{"label":"2800 V-Bucks","eur":19.99,"htg":2699},{"label":"5000 V-Bucks","eur":31.99,"htg":4319},{"label":"13500 V-Bucks","eur":79.99,"htg":10799}]',
 4.7, 760, true, 'NOUVEAU', 'Nom d''utilisateur Epic'),

('eFootball (myClub)', 'jeux',
 'Achetez des eFootball Coins pour renforcer votre équipe myClub.',
 'img/efootball.jpg',
 '[{"label":"500 Coins","eur":4.99,"htg":674},{"label":"1090 Coins","eur":9.99,"htg":1349},{"label":"2230 Coins","eur":19.99,"htg":2699},{"label":"5000 Coins","eur":44.99,"htg":6074}]',
 4.1, 140, false, null, 'Konami ID'),

-- ── CARTES CADEAUX ─────────────────────────────────────────────
('Apple App Store', 'gift-cards',
 'Carte cadeau Apple pour acheter applications, jeux, musique et abonnements sur l''App Store.',
 'img/apple_card.jpg',
 '[{"label":"$5","eur":4.79,"htg":647},{"label":"$10","eur":9.49,"htg":1281},{"label":"$15","eur":13.99,"htg":1889},{"label":"$25","eur":23.49,"htg":3172},{"label":"$50","eur":46.99,"htg":6344},{"label":"$100","eur":93.99,"htg":12689}]',
 4.6, 510, true, null, null),

('Google Play Store', 'gift-cards',
 'Carte cadeau Google Play pour applications, jeux, films et abonnements Android.',
 'img/google_play.jpg',
 '[{"label":"$5","eur":4.79,"htg":647},{"label":"$10","eur":9.49,"htg":1281},{"label":"$15","eur":13.99,"htg":1889},{"label":"$25","eur":23.49,"htg":3172},{"label":"$50","eur":46.99,"htg":6344},{"label":"$100","eur":93.99,"htg":12689}]',
 4.7, 680, true, null, null),

('PlayStation Network', 'game-console',
 'Carte PSN pour acheter jeux, DLC et abonnements PlayStation Plus sur votre PS4/PS5.',
 'img/Play Station Network.jpeg',
 '[{"label":"$10","eur":9.49,"htg":1281},{"label":"$20","eur":18.99,"htg":2564},{"label":"$50","eur":46.99,"htg":6344},{"label":"$100","eur":93.99,"htg":12689}]',
 4.8, 920, true, 'PROMO', null),

('Xbox & Game Pass', 'game-console',
 'Carte Xbox pour acheter jeux et contenu. Aussi disponible en Xbox Game Pass Ultimate.',
 'img/xbox_card.png',
 '[{"label":"Xbox $10","eur":9.49,"htg":1281},{"label":"Xbox $25","eur":23.49,"htg":3172},{"label":"Xbox $50","eur":46.99,"htg":6344},{"label":"Game Pass 1 mois","eur":13.99,"htg":1889},{"label":"Game Pass 3 mois","eur":39.99,"htg":5399}]',
 4.7, 740, true, null, null),

('Carte Steam', 'game-cd-key',
 'Carte cadeau Steam pour acheter jeux PC et DLC sur la plateforme Steam.',
 'img/steam_card.png',
 '[{"label":"$5","eur":4.79,"htg":647},{"label":"$10","eur":9.49,"htg":1281},{"label":"$20","eur":18.99,"htg":2564},{"label":"$50","eur":46.99,"htg":6344},{"label":"$100","eur":93.99,"htg":12689}]',
 4.8, 1050, true, null, null),

('Razer Gold', 'payment-cards',
 'Carte Razer Gold pour recharger votre portefeuille et acheter dans vos jeux préférés.',
 'img/razer_gold.jpg',
 '[{"label":"$5","eur":4.79,"htg":647},{"label":"$10","eur":9.49,"htg":1281},{"label":"$25","eur":23.49,"htg":3172},{"label":"$50","eur":46.99,"htg":6344}]',
 4.3, 210, false, null, null),

('Carte Prépayée Visa', 'payment-cards',
 'Carte prépayée Visa virtuelle pour achats en ligne sécurisés partout dans le monde.',
 'img/visa_card.jpg',
 '[{"label":"$10","eur":9.99,"htg":1349},{"label":"$25","eur":24.99,"htg":3374},{"label":"$50","eur":49.99,"htg":6749},{"label":"$100","eur":99.99,"htg":13499}]',
 4.5, 330, false, null, null),

-- ── STREAMING ──────────────────────────────────────────────────
('Netflix', 'video-streaming',
 'Abonnement Netflix Premium pour accéder à des milliers de films et séries en HD/4K.',
 'img/netflix.jpg',
 '[{"label":"1 mois Standard","eur":13.99,"htg":1889},{"label":"1 mois Premium","eur":17.99,"htg":2429},{"label":"3 mois Premium","eur":49.99,"htg":6749}]',
 4.9, 1320, true, 'HOT', null),

('Spotify', 'music',
 'Abonnement Spotify Premium pour écouter de la musique sans publicité en qualité HD.',
 'img/spotify.png',
 '[{"label":"1 mois","eur":9.99,"htg":1349},{"label":"3 mois","eur":26.99,"htg":3644},{"label":"6 mois","eur":49.99,"htg":6749},{"label":"12 mois","eur":89.99,"htg":12149}]',
 4.8, 890, true, null, null),

('Disney+', 'video-streaming',
 'Abonnement Disney+ pour accéder à Disney, Marvel, Star Wars, Pixar et National Geographic.',
 'img/disney_plus.jpg',
 '[{"label":"1 mois","eur":8.99,"htg":1214},{"label":"3 mois","eur":24.99,"htg":3374},{"label":"12 mois","eur":89.99,"htg":12149}]',
 4.6, 460, false, null, null),

('Amazon Prime Video', 'video-streaming',
 'Abonnement Amazon Prime Video pour films, séries et contenus Amazon Originals.',
 'img/prime_video.jpg',
 '[{"label":"1 mois","eur":8.99,"htg":1214},{"label":"3 mois","eur":24.99,"htg":3374},{"label":"12 mois","eur":89.99,"htg":12149}]',
 4.5, 290, false, null, null)

ON CONFLICT DO NOTHING;

-- Vérification
SELECT id, name, category FROM products ORDER BY id;
