/**
 * Asta-Shops Wishlist (Favoris) Module
 */

(function () {
    let wishlist = [];
    try {
        wishlist = JSON.parse(localStorage.getItem('as_wishlist')) || [];
    } catch (e) {
        wishlist = [];
    }

    function save() {
        localStorage.setItem('as_wishlist', JSON.stringify(wishlist));
        updateBadge();
    }

    function updateBadge() {
        const badges = document.querySelectorAll('#wishlistBadgeCount');
        badges.forEach(b => {
            b.textContent = wishlist.length;
            b.style.display = wishlist.length > 0 ? 'inline-flex' : 'inline-flex';
        });
    }

    function toggleWishlist(productId) {
        const idx = wishlist.indexOf(productId);
        if (idx > -1) {
            wishlist.splice(idx, 1);
        } else {
            wishlist.push(productId);
        }
        save();
        return wishlist.includes(productId);
    }

    function isWishlisted(productId) {
        return wishlist.includes(productId);
    }

    document.addEventListener('DOMContentLoaded', () => {
        updateBadge();

        const btn = document.getElementById('wishlistBtn');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                alert(`Favoris (${wishlist.length}) : Vous avez ${wishlist.length} produit(s) enregistrés dans vos favoris.`);
            });
        }
    });

    window.AstaWishlist = {
        get items() { return wishlist; },
        toggleWishlist,
        isWishlisted,
        updateBadge
    };
    window.LootZoneWishlist = window.AstaWishlist;
})();
