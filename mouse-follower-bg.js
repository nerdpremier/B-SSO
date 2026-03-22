/**
 * Mouse Follower Background Effect
 * Subtle gradient orbs that follow mouse movement
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        orbCount: 3,
        orbSize: 300,
        lagFactor: 0.08,
        colors: [
            { r: 59, g: 130, b: 246 },   // Blue
            { r: 99, g: 102, b: 241 },   // Indigo
            { r: 139, g: 92, b: 246 },   // Purple
        ]
    };

    // Create container
    function init() {
        // Check if already exists
        if (document.getElementById('mouse-follower-bg')) return;

        const container = document.createElement('div');
        container.id = 'mouse-follower-bg';
        container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            overflow: hidden;
            pointer-events: none;
            background: linear-gradient(135deg, #0a0c12 0%, #0f1729 50%, #0a0c12 100%);
        `;

        // Create orbs
        const orbs = [];
        for (let i = 0; i < CONFIG.orbCount; i++) {
            const orb = document.createElement('div');
            const color = CONFIG.colors[i % CONFIG.colors.length];
            const size = CONFIG.orbSize + (i * 100);

            orb.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                border-radius: 50%;
                background: radial-gradient(circle,
                    rgba(${color.r}, ${color.g}, ${color.b}, ${0.15 - i * 0.03}) 0%,
                    rgba(${color.r}, ${color.g}, ${color.b}, 0) 70%
                );
                filter: blur(60px);
                transform: translate(-50%, -50%);
                transition: opacity 0.3s ease;
            `;

            container.appendChild(orb);
            orbs.push({
                element: orb,
                x: window.innerWidth / 2,
                y: window.innerHeight / 2,
                targetX: window.innerWidth / 2,
                targetY: window.innerHeight / 2,
                lag: CONFIG.lagFactor + (i * 0.02)
            });
        }

        document.body.insertBefore(container, document.body.firstChild);

        // Mouse tracking
        let mouseX = window.innerWidth / 2;
        let mouseY = window.innerHeight / 2;
        let isActive = true;
        let rafId = null;

        function onMouseMove(e) {
            mouseX = e.clientX;
            mouseY = e.clientY;
        }

        function onTouchMove(e) {
            if (e.touches.length > 0) {
                mouseX = e.touches[0].clientX;
                mouseY = e.touches[0].clientY;
            }
        }

        // Animation loop
        function animate() {
            if (!isActive) return;

            orbs.forEach(orb => {
                // Smooth interpolation with lag
                orb.x += (mouseX - orb.x) * orb.lag;
                orb.y += (mouseY - orb.y) * orb.lag;

                orb.element.style.left = orb.x + 'px';
                orb.element.style.top = orb.y + 'px';
            });

            rafId = requestAnimationFrame(animate);
        }

        // Event listeners
        document.addEventListener('mousemove', onMouseMove, { passive: true });
        document.addEventListener('touchmove', onTouchMove, { passive: true });

        // Visibility handling
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                isActive = false;
                if (rafId) cancelAnimationFrame(rafId);
            } else {
                isActive = true;
                animate();
            }
        });

        // Handle resize
        window.addEventListener('resize', () => {
            mouseX = window.innerWidth / 2;
            mouseY = window.innerHeight / 2;
        });

        // Start animation
        animate();

        console.log('[MouseFollower] Background initialized');
    }

    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
