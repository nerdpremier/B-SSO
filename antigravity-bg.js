// ============================================================
// Anti-Gravity Background Physics Simulation
// Interactive physics-based background for B-SSO
// Features: gravity, collision, bounce, mouse drag/throw
// ============================================================

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        particleCount: 25,
        gravity: 0.4,
        friction: 0.99,
        bounce: 0.7,
        mouseInfluenceRadius: 150,
        mouseForce: 0.5,
        colors: [
            'rgba(59, 130, 246, 0.6)',   // Blue
            'rgba(99, 102, 241, 0.6)',   // Indigo
            'rgba(139, 92, 246, 0.5)',   // Purple
            'rgba(236, 72, 153, 0.5)',   // Pink
            'rgba(6, 182, 212, 0.6)',    // Cyan
        ],
        glowColor: 'rgba(59, 130, 246, 0.15)',
        minSize: 8,
        maxSize: 20,
        connectionDistance: 120,
        maxConnections: 3
    };

    // Physics Body Class
    class PhysicsBody {
        constructor(x, y, radius, color) {
            this.x = x;
            this.y = y;
            this.vx = (Math.random() - 0.5) * 4;
            this.vy = (Math.random() - 0.5) * 4;
            this.radius = radius;
            this.color = color;
            this.mass = radius / 10;
            this.isDragging = false;
            this.dragOffsetX = 0;
            this.dragOffsetY = 0;
            this.glowPhase = Math.random() * Math.PI * 2;
            this.glowSpeed = 0.02 + Math.random() * 0.02;
        }

        update(canvasWidth, canvasHeight) {
            // Update glow animation
            this.glowPhase += this.glowSpeed;

            if (this.isDragging) {
                // When dragging, velocity is calculated from mouse movement
                return;
            }

            // Apply gravity
            this.vy += CONFIG.gravity;

            // Apply friction
            this.vx *= CONFIG.friction;
            this.vy *= CONFIG.friction;

            // Update position
            this.x += this.vx;
            this.y += this.vy;

            // Floor collision
            if (this.y + this.radius > canvasHeight) {
                this.y = canvasHeight - this.radius;
                this.vy *= -CONFIG.bounce;

                // Apply ground friction
                this.vx *= 0.95;
            }

            // Ceiling collision
            if (this.y - this.radius < 0) {
                this.y = this.radius;
                this.vy *= -CONFIG.bounce;
            }

            // Wall collisions
            if (this.x + this.radius > canvasWidth) {
                this.x = canvasWidth - this.radius;
                this.vx *= -CONFIG.bounce;
            }
            if (this.x - this.radius < 0) {
                this.x = this.radius;
                this.vx *= -CONFIG.bounce;
            }
        }

        draw(ctx) {
            // Draw glow
            const glowIntensity = 0.3 + Math.sin(this.glowPhase) * 0.2;
            const gradient = ctx.createRadialGradient(
                this.x, this.y, 0,
                this.x, this.y, this.radius * 2
            );
            gradient.addColorStop(0, this.color.replace(/[\d\.]+\)$/, `${glowIntensity})`));
            gradient.addColorStop(1, 'transparent');

            ctx.beginPath();
            ctx.fillStyle = gradient;
            ctx.arc(this.x, this.y, this.radius * 2, 0, Math.PI * 2);
            ctx.fill();

            // Draw body
            ctx.beginPath();
            ctx.fillStyle = this.color;
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();

            // Draw highlight
            ctx.beginPath();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.arc(
                this.x - this.radius * 0.3,
                this.y - this.radius * 0.3,
                this.radius * 0.3,
                0, Math.PI * 2
            );
            ctx.fill();

            // Draw border when dragging
            if (this.isDragging) {
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.lineWidth = 2;
                ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
    }

    // Physics World
    class PhysicsWorld {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.bodies = [];
            this.mouseX = 0;
            this.mouseY = 0;
            this.isMouseDown = false;
            this.draggedBody = null;
            this.lastMouseX = 0;
            this.lastMouseY = 0;
            this.mouseVelX = 0;
            this.mouseVelY = 0;

            this.resize();
            this.initBodies();
            this.bindEvents();
        }

        resize() {
            const dpr = window.devicePixelRatio || 1;
            this.canvas.width = window.innerWidth * dpr;
            this.canvas.height = window.innerHeight * dpr;
            this.canvas.style.width = window.innerWidth + 'px';
            this.canvas.style.height = window.innerHeight + 'px';
            this.ctx.scale(dpr, dpr);
            this.width = window.innerWidth;
            this.height = window.innerHeight;
        }

        initBodies() {
            this.bodies = [];
            for (let i = 0; i < CONFIG.particleCount; i++) {
                const radius = CONFIG.minSize + Math.random() * (CONFIG.maxSize - CONFIG.minSize);
                const x = Math.random() * (this.width - radius * 2) + radius;
                const y = Math.random() * (this.height / 2) + radius;
                const color = CONFIG.colors[Math.floor(Math.random() * CONFIG.colors.length)];
                this.bodies.push(new PhysicsBody(x, y, radius, color));
            }
        }

        bindEvents() {
            // Mouse events
            this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
            this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
            window.addEventListener('mouseup', this.handleMouseUp.bind(this));

            // Touch events
            this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
            this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
            window.addEventListener('touchend', this.handleTouchEnd.bind(this));

            // Resize
            window.addEventListener('resize', () => {
                this.resize();
            });

            // Visibility change - pause when tab hidden
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.isPaused = true;
                } else {
                    this.isPaused = false;
                    this.lastTime = performance.now();
                }
            });
        }

        getMousePos(e) {
            const rect = this.canvas.getBoundingClientRect();
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        }

        findBodyAt(x, y) {
            // Find body under mouse (check from top/largest to bottom/smallest)
            for (let i = this.bodies.length - 1; i >= 0; i--) {
                const body = this.bodies[i];
                const dx = x - body.x;
                const dy = y - body.y;
                if (dx * dx + dy * dy <= body.radius * body.radius * 2) {
                    return body;
                }
            }
            return null;
        }

        handleMouseDown(e) {
            const pos = this.getMousePos(e);
            this.mouseX = pos.x;
            this.mouseY = pos.y;
            this.lastMouseX = pos.x;
            this.lastMouseY = pos.y;
            this.isMouseDown = true;

            const body = this.findBodyAt(pos.x, pos.y);
            if (body) {
                this.draggedBody = body;
                body.isDragging = true;
                body.dragOffsetX = body.x - pos.x;
                body.dragOffsetY = body.y - pos.y;
                body.vx = 0;
                body.vy = 0;
            }
        }

        handleMouseMove(e) {
            const pos = this.getMousePos(e);

            // Calculate mouse velocity for throwing
            this.mouseVelX = pos.x - this.lastMouseX;
            this.mouseVelY = pos.y - this.lastMouseY;
            this.lastMouseX = pos.x;
            this.lastMouseY = pos.y;

            this.mouseX = pos.x;
            this.mouseY = pos.y;

            if (this.draggedBody) {
                this.draggedBody.x = pos.x + this.draggedBody.dragOffsetX;
                this.draggedBody.y = pos.y + this.draggedBody.dragOffsetY;
                this.draggedBody.vx = this.mouseVelX;
                this.draggedBody.vy = this.mouseVelY;
            }
        }

        handleMouseUp() {
            if (this.draggedBody) {
                // Apply throw velocity
                this.draggedBody.vx = this.mouseVelX * 1.5;
                this.draggedBody.vy = this.mouseVelY * 1.5;
                this.draggedBody.isDragging = false;
                this.draggedBody = null;
            }
            this.isMouseDown = false;
        }

        handleTouchStart(e) {
            if (e.touches.length === 1) {
                e.preventDefault();
                const touch = e.touches[0];
                this.handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
            }
        }

        handleTouchMove(e) {
            if (e.touches.length === 1) {
                e.preventDefault();
                const touch = e.touches[0];
                this.handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
            }
        }

        handleTouchEnd() {
            this.handleMouseUp();
        }

        // Simple collision response between bodies
        resolveCollisions() {
            for (let i = 0; i < this.bodies.length; i++) {
                for (let j = i + 1; j < this.bodies.length; j++) {
                    const b1 = this.bodies[i];
                    const b2 = this.bodies[j];

                    const dx = b2.x - b1.x;
                    const dy = b2.y - b1.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const minDistance = b1.radius + b2.radius;

                    if (distance < minDistance && distance > 0) {
                        // Collision detected - resolve overlap
                        const overlap = minDistance - distance;
                        const nx = dx / distance;
                        const ny = dy / distance;

                        // Separate bodies
                        const moveX = nx * overlap * 0.5;
                        const moveY = ny * overlap * 0.5;

                        if (!b1.isDragging) {
                            b1.x -= moveX;
                            b1.y -= moveY;
                        }
                        if (!b2.isDragging) {
                            b2.x += moveX;
                            b2.y += moveY;
                        }

                        // Exchange momentum (elastic collision)
                        if (!b1.isDragging && !b2.isDragging) {
                            const dvx = b2.vx - b1.vx;
                            const dvy = b2.vy - b1.vy;
                            const dv = dvx * nx + dvy * ny;

                            if (dv < 0) {
                                const impulse = 2 * dv / (b1.mass + b2.mass);
                                b1.vx += impulse * b2.mass * nx * CONFIG.bounce;
                                b1.vy += impulse * b2.mass * ny * CONFIG.bounce;
                                b2.vx -= impulse * b1.mass * nx * CONFIG.bounce;
                                b2.vy -= impulse * b1.mass * ny * CONFIG.bounce;
                            }
                        }
                    }
                }
            }
        }

        // Draw connections between nearby bodies
        drawConnections() {
            this.ctx.strokeStyle = CONFIG.glowColor;
            this.ctx.lineWidth = 1;

            for (let i = 0; i < this.bodies.length; i++) {
                let connections = 0;
                for (let j = i + 1; j < this.bodies.length && connections < CONFIG.maxConnections; j++) {
                    const b1 = this.bodies[i];
                    const b2 = this.bodies[j];
                    const dx = b2.x - b1.x;
                    const dy = b2.y - b1.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < CONFIG.connectionDistance) {
                        const opacity = (1 - distance / CONFIG.connectionDistance) * 0.3;
                        this.ctx.strokeStyle = `rgba(59, 130, 246, ${opacity})`;
                        this.ctx.beginPath();
                        this.ctx.moveTo(b1.x, b1.y);
                        this.ctx.lineTo(b2.x, b2.y);
                        this.ctx.stroke();
                        connections++;
                    }
                }
            }
        }

        // Apply subtle mouse repulsion/attraction
        applyMouseForce() {
            if (this.isMouseDown && !this.draggedBody) {
                for (const body of this.bodies) {
                    const dx = body.x - this.mouseX;
                    const dy = body.y - this.mouseY;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < CONFIG.mouseInfluenceRadius && distance > 0) {
                        const force = (1 - distance / CONFIG.mouseInfluenceRadius) * CONFIG.mouseForce;
                        body.vx += (dx / distance) * force;
                        body.vy += (dy / distance) * force;
                    }
                }
            }
        }

        update() {
            if (this.isPaused) return;

            this.applyMouseForce();

            for (const body of this.bodies) {
                body.update(this.width, this.height);
            }

            this.resolveCollisions();
        }

        draw() {
            // Clear with trail effect
            this.ctx.fillStyle = 'rgba(10, 12, 18, 0.3)';
            this.ctx.fillRect(0, 0, this.width, this.height);

            // Draw grid pattern
            this.drawGrid();

            // Draw connections
            this.drawConnections();

            // Draw bodies
            for (const body of this.bodies) {
                body.draw(this.ctx);
            }

            // Draw mouse interaction indicator
            if (this.isMouseDown && this.draggedBody) {
                this.ctx.beginPath();
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                this.ctx.setLineDash([5, 5]);
                this.ctx.moveTo(this.mouseX, this.mouseY);
                this.ctx.lineTo(
                    this.draggedBody.x,
                    this.draggedBody.y
                );
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            }
        }

        drawGrid() {
            const gridSize = 50;
            const offset = (Date.now() / 50) % gridSize;

            this.ctx.strokeStyle = 'rgba(59, 130, 246, 0.03)';
            this.ctx.lineWidth = 1;

            // Vertical lines
            for (let x = 0; x <= this.width; x += gridSize) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, 0);
                this.ctx.lineTo(x, this.height);
                this.ctx.stroke();
            }

            // Horizontal lines
            for (let y = offset; y <= this.height; y += gridSize) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(this.width, y);
                this.ctx.stroke();
            }
        }

        start() {
            this.lastTime = performance.now();
            const loop = (currentTime) => {
                const deltaTime = currentTime - this.lastTime;
                this.lastTime = currentTime;

                this.update();
                this.draw();

                requestAnimationFrame(loop);
            };
            requestAnimationFrame(loop);
        }
    }

    // Initialize
    function init() {
        // Check if canvas already exists
        let canvas = document.getElementById('antigravity-canvas');
        if (canvas) return;

        // Create canvas
        canvas = document.createElement('canvas');
        canvas.id = 'antigravity-canvas';

        // Apply styles
        canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            pointer-events: all;
            background: linear-gradient(135deg, #0a0c12 0%, #0f1729 50%, #0a0c12 100%);
        `;

        document.body.insertBefore(canvas, document.body.firstChild);

        // Initialize physics world
        const world = new PhysicsWorld(canvas);
        world.start();

        console.log('[AntiGravity] Physics simulation initialized');
    }

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
