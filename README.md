# Neon Dodge

A touch-first arcade game for mobile web browsers. Plain HTML/CSS/JS, no build step.

## Play

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://<your-computer-ip>:8000 on your phone
```

## How to play

- **Drag anywhere** to steer the ship (relative drag, so your finger never covers it). Arrow keys / WASD work on desktop.
- Dodge the pink blocks. They speed up and multiply over ~90 seconds.
- **Gold orb**: +10 points. **Green (S)**: shield that absorbs one hit. **Purple (T)**: slow-motion.
- Best score is saved on the device.

## Mobile details

- Full-screen canvas, sharp on high-DPI screens, respects notch/home-bar safe areas
- No scroll, zoom or long-press menus while playing
- Haptic feedback where supported; pauses automatically when the tab is hidden
- Web app manifest, so it can be added to the home screen
