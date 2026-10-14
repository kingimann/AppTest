# Cameras, lighting and effects

## Cameras

Every new level starts with a **Main Camera** object that follows the player (or stays put if there isn't one). A camera is an object with the **Camera** component, a virtual camera in the style of Cinemachine.

### Camera modes

| Mode | For |
|---|---|
| `follow` | Keeps the target in view with smoothing (the default) |
| `fixed` | Doesn't move: single-screen games, menus |
| `side scroller` | Follows sideways; up and down move less |
| `top down` | 3D: looks down from above |
| `orbit` | 3D: drag to orbit, pinch to zoom (Free Look) |
| `group` | Frames every object with a tag (or a Target Group) and zooms out to fit |
| `dolly` | Rides a track of points, staying close to the target, or travels along it by itself |

### Framing

- **Target** (a tag, `player` by default) and a separate **look-at** target.
- **Offset** (`ox, oy, oz`), **screen X / Y** to put the target off-centre, and a **shoulder offset** for over-the-shoulder views.
- **Damping** (smoothing), separate **up / down damping**, **look-ahead**, a **dead zone** (and an up / down dead zone).
- **Zoom** (2D) or **field of view** (3D); **Follow Zoom** keeps the target the same size on screen; **zoom out with speed**.
- **Confiner:** a 2D box or 3D box the camera stays inside. **Pixel perfect** for crisp 2D pixel art.
- **Offset turns with:** the world, the way the target faces, or the way it moves (cars, runners).
- **Deoccluder** (3D): moves in front of walls that come between the camera and the target.
- **Snap on teleport:** cuts instead of gliding across the level when the target jumps far.
- **Dutch tilt** (degrees). **Orthographic** 3D for isometric games.

### Several cameras

With several cameras, the highest **priority** is live. Switching (*Make camera live*, the Make Camera Live node, `scene.setCamera('Boss Cam')`) **blends** over the new camera's blend time and ease.

- **Camera Brain:** a default blend and custom blends between particular cameras (`Menu Cam > * = 2 inOutSine`, `Boss Cam > * = 0` for a cut).
- **Camera Zone:** an invisible area whose camera takes over while the player is inside.
- **Camera Switcher:** a camera per value of a variable (state-driven), or the first camera that can see the target (clear shot).
- **Camera Mixer:** mixes two cameras by a number 0–1.
- **Camera Sequence:** a cutscene of shots (`Camera | hold | blend`) with cinematic bars, tap to skip, and "players can't move meanwhile".
- **Target Group:** things a group camera frames together, each with a weight and radius.

### Shake and impulse

- **Noise:** handheld, gentle sway, earthquake or engine rumble.
- **Impulse:** a shake that's weaker far away. Use the **Camera Impulse** component (on hits, landings, destruction, messages, timers), the node, or `scene.impulse(strength, atObject)`. *Feels shakes ×* sets how much each camera reacts.
- **Zoom Punch** node: a quick zoom in and out for hits and pickups. **Focus Camera On** zooms on an object for a few seconds, then goes back.

### Letting players move the camera

**Camera Controls** (on a camera): drag to pan, pinch or the mouse wheel to zoom, flick to glide, double-tap to go back. It has zoom and pan limits, and ignores fingers that start on tappable objects. Use it for maps, strategy, idle and building games.

### Camera from code

```js
scene.camera            // 2D: { x, y, zoom, shake, roll }   3D: { position, target, fov, shake }
scene.setCamera('Boss Cam');
scene.impulse(12, boss);
engine.takePhoto().then((png) => …);   // a PNG data URL of the game and its UI
```

## Lighting

### 2D

- **Global Light 2D** (one per level) sets how bright the whole level is, and the colour of the dark. With brightness below 1, the level is dark and **lights** cut through it.
- Any object can have a **Light**: a **point** light or a **spotlight** (a cone, aimed with *Aim* plus the object's rotation), with colour, intensity, range, **softness** and an effect.
- **Casts shadows:** solid objects block the light, so walls throw shadows.
- **Effects:** steady, pulse, blink, fire (a flickering torch) and rainbow, each with a speed.

### 3D

- **Directional Light** (the sun): its rotation aims the sunlight and shadows. It sets colour, intensity, ambient light and shadows.
- **Point lights and spotlights:** up to 8 at once, coloured. A 3D spotlight tilts down with *Aim down* and turns with the object.
- **Sky and ground tint**, **fog** (near, far), and the background colour.
- The **Lamp** object is a lamp post with its own light; **Torch** has a fire light.

### Lighting presets

*Game Settings › Lighting Presets*: one tap for **Day**, **Golden hour**, **Evening**, **Night**, **Overcast**, **Cave**, **Spooky**, **Underwater** or **Neon**. They set brightness, colours, ambient light, sky and background together. During play, the **Lighting Preset** node fades the whole level to a mood.

### Lighting while playing

| Node | Does |
|---|---|
| Fade Light | Fades a light to a brightness, range and colour |
| Set Light Effect | Pulse, blink, fire, rainbow, steady |
| Set Darkness / Ambient | Fades a 2D level's darkness and its colour |
| Set Sun (3D) | Fades the sun's colour, brightness and ambient |
| Lighting Preset | Fades to a preset (*done* when finished) |
| Light Brightness | Reads how bright a light is right now |

The **Day / Night Cycle** component moves the sun, changes light and sky colours, darkens 2D at night, and gives `{hour}`.

## Post-processing

Tap the level → **Post Processing**. Start from a look (Neon glow, Warm sunset, Cold, Night, Retro, Dreamy, Black & white), then tune:

- **Bloom** (glow around bright things), with size and "only bright parts";
- **Vignette**, **Brightness**, **Contrast**, **Saturation**, **Hue shift**, and a **Tint** colour and amount.

It works in 2D and 3D, in the editor and while playing. The HUD isn't affected.

```js
{ post: { bloom: 0.8, bloomRadius: 16, vignette: 0.35, saturation: 125, tint: '#ff9a3c', tintAmount: 0.2 } }
```

## Particles and screen effects

- **Particle System:** fire, smoke, rain, snow, sparkle, confetti, magic, bubbles (rain and snow fill the screen).
- **Particle Emitter:** keeps giving off particles. **Particle Burst** node / instruction, `scene.burst(x, y, z, color, count)`.
- **Screen Effects** UI: red flash when hp drops, a vignette when it's low, confetti on `celebrate`.
- **Flash Screen**, **Fade Screen**, **Cinematic Bars**, **Hit Stop** (a freeze-frame on big hits), **Slow Motion**.
