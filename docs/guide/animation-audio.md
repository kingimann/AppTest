# Animation and audio

## Tweens

A **tween** changes a value smoothly over time: move, rotate, scale, fade, colour, punch, shake. Pocket Engine's tweens work like DOTween.

### The Tween component

Add **Tween** to an object and pick an effect:

- **Move** by / to / from, **rotate** by / to, **spin**, **scale** to / by, **fade**, **colour**;
- **punch** scale / position / rotation, **shake** position / rotation / scale;
- **path** (optionally closed), **jump** (with a number of hops), **spiral**, **look at**, **blink**;
- **type text** (optionally scrambled) and **count up** (a variable or the object's text).

Settings include duration (or **speed-based**: units per second), 33 **eases** with a curve preview, **loops** (−1 = forever) with yoyo / restart / incremental, a delay, **vibrato** and **elasticity** for punches and shakes, **play as From**, and a **Tween ID**. It plays on start, tap, tap forward / back (like a switch), touch or a message, and can do an action each loop and when finished. **Preview** plays it in the Scene.

**Tween Sequence** chains steps: each is *Then* (after the last), *Together* (with the last) or a *Pause*.

### Tweens from logic

- Triggers: *Move / rotate / scale / fade* with an ease and *wait until done*, *Punch*.
- Nodes: Tween, Tween Move To, Tween To Object, Jump Tween, Punch, Shake, Spin, Pulse, Tween Colour, **Tween Variable** (smooth score counters), Type Text, Spiral, Turn To Face, Stop Tweens, Pause / Resume, Play Backwards / Flip / Restart, Tween Speed, Delayed Call, Is Tweening. Most have a *finished* output.

### Tweens from code

```js
scene.to(obj, { x: 100, 'shape.fill': '#f00' }, 0.5, { ease: 'outBack', loops: -1, loopType: 'yoyo' })
  .setDelay(0.2).onComplete(() => P.log('done'));
scene.from(obj, { alpha: 0 }, 0.3);
scene.tween(obj, { y: obj.y - 40 }, 0.25, 'outQuad');      // the short form
scene.punch(obj, { sx: 0.3, sy: 0.3 }, 0.4);
scene.shakeProps(obj, { x: 8 }, 0.3);
scene.path(obj, [{ x: 0, y: 0 }, { x: 100, y: 50 }], 2);
scene.jumpTo(obj, { x: 300, y: 500 }, 80, 1, 0.6);
scene.counter(textObj, 0, 1000, 1.5);
const seq = scene.sequence({ loops: 2 });
seq.append(scene.to(a, { x: 100 }, 0.3)).join(scene.to(b, { alpha: 0 }, 0.3)).appendInterval(0.5);
scene.killTweens(obj); scene.isTweening(obj);
```

A tween returns an object you can chain: `.setDelay()`, `.setFrom()`, `.setSpeedBased()`, `.setId()`, `.setTimeScale()`, `.onStart()`, `.onUpdate()`, `.onStepComplete()`, `.onComplete()`, and control with `.pause()`, `.play()`, `.playBackwards()`, `.restart()`, `.complete()`, `.kill()`, `.goto(seconds)`. `Ease.curve([[0.5, 0.9]])` makes your own curve and `'steps4'` gives stepped motion.

## The Animator and the timeline

The **Animator** holds **clips** of keyframes. Open the **Animation timeline** from *long-press → Animate…* or the Animator card.

- Scrub the time bar, pose the object in the Scene and tap **◆ Key**. With **Auto** on, every change is keyed.
- Tap a key to set its time, value and ease, or delete it. ▶ previews the clip.
- Clips can loop, ping-pong or play once. One clip can play on start.
- Keys are **offsets from the object's rest pose**, so clips work wherever the object is, even while physics moves it.
- **Auto states:** fill in *clip when standing still / moving / in the air* and the Animator picks the clip itself.

Play clips with the *Play animation* instruction, the **Play Animation** node, or a message with the clip's name. **On Animation End** fires when a clip played once finishes.

## Sprite animation

- **Sprite Animation** (flipbook): emoji, picture or sprite frames (`art:bird,art:bird2`) at any FPS; loop, ping-pong or once; always, only while moving, or on a message.
- **Sprite Sheet Animator:** one picture holding a grid of frames. Set columns and rows and name clips by frame range (`idle: 0-3, run: 4-9, jump: 10`). It can switch idle / run / jump by itself and face the way it moves.
- **2D Sprite Editor** (*Create → Characters & Sprites → Draw Your Own*): draw shapes, paths and pixel art in layers, with **frames** and onion skin. Done saves a sprite sheet with a Sprite Sheet Animator already set up.

Nodes: Play / Stop Animation, Set Animation Speed, Show Sprite Frame, Flip Sprite, Fade To, Blink, Is Animation Playing, Sprite Frame.

## Sound

### Built-in sounds

`coin`, `jump`, `hit`, `power`, `win`, `lose`, `click` are made by the engine, so they need no files. The Sound component, buttons, pick-ups and the *Play sound* instruction use them by name.

### Your own sounds

*Project › Sounds › Import Sound* brings in MP3, WAV, OGG or M4A files (short clips work best; they're saved inside the project). Imported sounds appear in every sound picker and play by name: `scene.engine.audio.sfx('door')`.

### Music

The *Play music* instruction and **Play Music** node loop an imported sound; **Stop Music** fades it out. **Set Volume**, **Mute / Unmute**, **Is Muted** and **Play Note** (60 = middle C) are nodes too.

Players control sound effects and music volumes in their ⚙ Settings, and a Slider bound to `volume` (0–100) changes the game's sound. The built-in mute button sits in the corner unless you turn it off.

```js
engine.audio.sfx('coin');
engine.audio.music('theme', { loop: true, vol: 0.6 });
engine.audio.tone({ freq: 440, to: 880, dur: 0.15, vol: 0.1, type: 'square' });  // a synthesized beep
```

## Haptics

Vibration goes through one place, so the player's **Vibration** setting covers everything:

- **App builds** (App Store / Google Play): real haptics (light, medium, heavy, success, warning, error).
- **Android browsers:** vibration patterns.
- **iPhone browsers:** a haptic tick on iOS 18 and later, best right after a touch.

Use the *Vibrate* instruction, **Haptic Feedback** / **Vibrate Pattern** nodes, or `engine.vibrate(60)`.
