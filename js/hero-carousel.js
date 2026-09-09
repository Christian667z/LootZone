/**
 * LootZone - Hero Carousel Controller
 * Style LootBar.com avec coverflow 3D, barre de progression animée & gestes tactiles
 */

(function () {
    'use strict';

    class HeroCarousel {
        constructor(containerEl) {
            this.container = containerEl;
            if (!this.container) return;

            this.track = this.container.querySelector('.carousel-stage');
            this.slides = Array.from(this.container.querySelectorAll('.carousel-slide'));
            this.dotsContainer = this.container.querySelector('.carousel-dots');
            this.prevBtn = this.container.querySelector('.carousel-arrow-prev');
            this.nextBtn = this.container.querySelector('.carousel-arrow-next');

            if (!this.slides.length) return;

            this.currentIndex = 0;
            this.total = this.slides.length;
            this.autoplayDuration = 5000; // 5 secondes par slide
            this.isPaused = false;
            this.touchStartX = 0;
            this.touchEndX = 0;
            this.currentAnimationEndHandler = null;
            this.currentActiveFill = null;

            this.init();
        }

        init() {
            this.buildDots();
            this.bindEvents();
            this.update();
        }

        buildDots() {
            if (!this.dotsContainer) return;
            this.dotsContainer.innerHTML = '';
            this.dots = [];

            for (let i = 0; i < this.total; i++) {
                const dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'carousel-dot' + (i === this.currentIndex ? ' active' : '');
                dot.setAttribute('aria-label', `Aller au slide ${i + 1}`);
                dot.setAttribute('data-index', i);

                // Élément interne de progression animé
                const fill = document.createElement('span');
                fill.className = 'carousel-dot-fill';
                dot.appendChild(fill);

                dot.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.isPaused = false;
                    this.goTo(i);
                });

                this.dotsContainer.appendChild(dot);
                this.dots.push(dot);
            }
        }

        bindEvents() {
            if (this.prevBtn) {
                this.prevBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.isPaused = false;
                    this.prev();
                });
            }

            if (this.nextBtn) {
                this.nextBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.isPaused = false;
                    this.next();
                });
            }

            // Clic sur les slides latéraux visibles pour naviguer
            this.slides.forEach((slide, index) => {
                slide.addEventListener('click', (e) => {
                    // Si on clique sur le CTA ou un lien interne du slide actif, laisser passer
                    if (index === this.currentIndex) return;
                    e.preventDefault();
                    this.isPaused = false;
                    this.goTo(index);
                });
            });

            // Pause au survol du stage des slides (pour lire ou cliquer sur le CTA)
            if (this.track) {
                this.track.addEventListener('mouseenter', () => {
                    this.isPaused = true;
                    if (this.currentActiveFill) {
                        this.currentActiveFill.style.animationPlayState = 'paused';
                    }
                });

                this.track.addEventListener('mouseleave', () => {
                    this.isPaused = false;
                    if (this.currentActiveFill) {
                        this.currentActiveFill.style.animationPlayState = 'running';
                    }
                });
            }

            // Support tactile (swipe)
            this.container.addEventListener('touchstart', (e) => {
                this.touchStartX = e.changedTouches[0].screenX;
            }, { passive: true });

            this.container.addEventListener('touchend', (e) => {
                this.touchEndX = e.changedTouches[0].screenX;
                this.handleSwipe();
            }, { passive: true });

            // Navigation au clavier
            this.container.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowLeft') {
                    this.isPaused = false;
                    this.prev();
                } else if (e.key === 'ArrowRight') {
                    this.isPaused = false;
                    this.next();
                }
            });
        }

        handleSwipe() {
            const diff = this.touchStartX - this.touchEndX;
            const threshold = 45;
            if (Math.abs(diff) > threshold) {
                this.isPaused = false;
                if (diff > 0) {
                    this.next();
                } else {
                    this.prev();
                }
            }
        }

        update() {
            const current = this.currentIndex;
            const total = this.total;

            this.slides.forEach((slide, index) => {
                slide.classList.remove(
                    'is-active',
                    'is-prev',
                    'is-next',
                    'is-far-prev',
                    'is-far-next',
                    'is-hidden'
                );

                const diff = (index - current + total) % total;

                if (diff === 0) {
                    slide.classList.add('is-active');
                    slide.setAttribute('aria-hidden', 'false');
                    slide.tabIndex = 0;
                } else if (diff === 1) {
                    slide.classList.add('is-next');
                    slide.setAttribute('aria-hidden', 'true');
                    slide.tabIndex = -1;
                } else if (diff === total - 1) {
                    slide.classList.add('is-prev');
                    slide.setAttribute('aria-hidden', 'true');
                    slide.tabIndex = -1;
                } else if (diff === 2) {
                    slide.classList.add('is-far-next');
                    slide.setAttribute('aria-hidden', 'true');
                    slide.tabIndex = -1;
                } else if (diff === total - 2) {
                    slide.classList.add('is-far-prev');
                    slide.setAttribute('aria-hidden', 'true');
                    slide.tabIndex = -1;
                } else {
                    slide.classList.add('is-hidden');
                    slide.setAttribute('aria-hidden', 'true');
                    slide.tabIndex = -1;
                }
            });

            // Démarrage ou réinitialisation de la barre de progression animée
            this.startProgressBar();
        }

        startProgressBar() {
            // Nettoyer l'écouteur d'animationend du slide précédent
            if (this.currentActiveFill && this.currentAnimationEndHandler) {
                this.currentActiveFill.removeEventListener('animationend', this.currentAnimationEndHandler);
                this.currentAnimationEndHandler = null;
            }

            if (!this.dots || !this.dots.length) return;

            const current = this.currentIndex;

            this.dots.forEach((dot, idx) => {
                const fill = dot.querySelector('.carousel-dot-fill');
                if (idx === current) {
                    dot.classList.add('active');
                    if (fill) {
                        // Réinitialiser et déclencher l'animation CSS fluide (0% -> 100%)
                        fill.style.animation = 'none';
                        void fill.offsetWidth; // Forcer le reflow du DOM
                        fill.style.animation = `progressFillAnim ${this.autoplayDuration}ms linear forwards`;
                        fill.style.animationPlayState = this.isPaused ? 'paused' : 'running';

                        this.currentActiveFill = fill;

                        // Dès que la barre atteint 100% (5 secondes), passer automatiquement au slide suivant
                        this.currentAnimationEndHandler = () => {
                            this.next();
                        };
                        fill.addEventListener('animationend', this.currentAnimationEndHandler, { once: true });
                    }
                } else {
                    dot.classList.remove('active');
                    if (fill) {
                        fill.style.animation = 'none';
                        fill.style.width = '0%';
                    }
                }
            });
        }

        goTo(index) {
            this.currentIndex = (index + this.total) % this.total;
            this.update();
        }

        next() {
            this.goTo(this.currentIndex + 1);
        }

        prev() {
            this.goTo(this.currentIndex - 1);
        }
    }

    // Initialisation au chargement du DOM
    document.addEventListener('DOMContentLoaded', () => {
        const carouselEl = document.querySelector('.hero-coverflow-carousel');
        if (carouselEl) {
            window.lootZoneHeroCarousel = new HeroCarousel(carouselEl);
        }

        // Smooth scroll pour les boutons d'ancres de la barre d'accès rapide
        const quickNavLinks = document.querySelectorAll('.quick-nav-bar a[href^="#"]');
        quickNavLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const targetId = link.getAttribute('href');
                if (targetId && targetId !== '#') {
                    const targetEl = document.querySelector(targetId);
                    if (targetEl) {
                        e.preventDefault();
                        const headerOffset = 80;
                        const elementPosition = targetEl.getBoundingClientRect().top;
                        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                        window.scrollTo({
                            top: offsetPosition,
                            behavior: 'smooth'
                        });
                    }
                }
            });
        });
    });
})();
