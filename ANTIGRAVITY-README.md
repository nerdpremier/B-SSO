# Anti-Gravity Background Implementation

An interactive physics-based background effect for B-SSO, inspired by the Google Anti-Gravity experiment.

## Features

- **Realistic Physics Simulation**
  - Gravity force (configurable)
  - Friction and bounce damping
  - Elastic collision between particles
  - Edge collision detection

- **Interactive Controls**
  - **Drag & Throw**: Click and drag any particle, then throw it with momentum
  - **Mouse Influence**: Move mouse near particles to push them away
  - **Touch Support**: Full touch event support for mobile devices

- **Visual Effects**
  - Cyber security themed color palette (blues, purples, cyans)
  - Pulsing glow animations
  - Dynamic connections between nearby particles
  - Animated grid background
  - Glass morphism effects on UI cards

- **Performance Optimized**
  - `requestAnimationFrame` for smooth 60fps animation
  - Limited particle count (25 particles by default)
  - Automatic pause when tab is hidden
  - Device pixel ratio aware for crisp rendering

## Files

| File | Description |
|------|-------------|
| `antigravity-bg.js` | Main physics engine and canvas rendering |
| `antigravity-bg.css` | Styling for canvas positioning and UI glass effects |

## Quick Integration

The anti-gravity background has been automatically integrated into all B-SSO pages:

- `login.html`
- `register.html`
- `mfa-verify.html`
- `forgot-password.html`
- `reset-password.html`
- `welcome.html`
- `authorize.html`
- `developer-portal.html`
- `front-logout.html`

## How to Add to New Pages

### 1. Add CSS (in `<head>`)

```html
<link rel="stylesheet" href="/antigravity-bg.css">
```

### 2. Add JavaScript (before closing `</body>`)

```html
<script src="/antigravity-bg.js"></script>
```

### 3. Ensure Body Position

The CSS expects `body` to have relative positioning. The canvas is automatically inserted as the first child of `<body>` with `z-index: -1`.

## Configuration

Edit `antigravity-bg.js` to customize the physics:

```javascript
const CONFIG = {
    particleCount: 25,           // Number of particles (reduce for better performance)
    gravity: 0.4,              // Gravity strength
    friction: 0.99,            // Air resistance (0.99 = 1% slowdown per frame)
    bounce: 0.7,               // Bounciness (0-1, higher = more bounce)
    mouseInfluenceRadius: 150, // Mouse push radius in pixels
    mouseForce: 0.5,           // Mouse push strength
    minSize: 8,                // Minimum particle size
    maxSize: 20,               // Maximum particle size
    connectionDistance: 120,   // Distance to draw connections
    maxConnections: 3          // Max connections per particle
};
```

## Physics Details

### Gravity Simulation
- Constant downward force applied each frame
- Particles accelerate until reaching terminal velocity (limited by friction)

### Collision Detection
- **Wall Collisions**: Particles bounce off screen edges with damping
- **Particle Collisions**: Elastic collisions with momentum transfer based on mass

### Drag & Throw Mechanics
1. Click a particle to grab it
2. Move mouse while holding - particle follows with offset
3. Release - velocity is calculated from mouse movement and applied to particle
4. Particle continues with throw momentum

### Mouse Influence
- Hover near particles to gently push them away
- Force is inversely proportional to distance
- Creates organic, fluid interaction

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

Requires ES6+ features (classes, arrow functions, const/let).

## Performance Tips

1. **Reduce particle count** on low-end devices:
   ```javascript
   particleCount: window.matchMedia('(pointer: coarse)').matches ? 15 : 25
   ```

2. **Disable on reduced motion preference** (already implemented):
   ```css
   @media (prefers-reduced-motion: reduce) {
       #antigravity-canvas { display: none; }
   }
   ```

3. **Pause on tab hide** (already implemented) - animation pauses automatically when the page is not visible

## Troubleshooting

### Canvas Not Showing
- Check browser console for CSP (Content Security Policy) errors
- Ensure `antigravity-bg.js` is loaded from same origin
- Verify CSS `z-index: -1` isn't being overridden

### Laggy Performance
- Reduce `particleCount` in configuration
- Lower `connectionDistance` to reduce connection calculations
- Check for other heavy animations running simultaneously

### Touch Not Working
- Ensure viewport meta tag is set correctly
- Check for CSS `touch-action` conflicts

## Credits

Inspired by the Google Anti-Gravity experiment and coded specifically for the B-SSO authentication system with a cyber security aesthetic.

## License

Part of B-SSO system - internal use only.
