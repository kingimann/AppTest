// Node Editor: full-screen, touch-first visual scripting for the "Visual Script" (graph) behavior.
// Tap a dot, then another dot, to wire them (or drag from dot to dot). Drag nodes to move them,
// drag empty space to pan, pinch to zoom. Edits are written straight back through onChange().
import { NODE_TYPES } from '../engine/pocket.js';
import { icon } from './icons.js';

const NODE_W = 260;
export const CAT_COLOR = { Events: '#3d8b40', Flow: '#7e57c2', Actions: '#2c6cb0', Move: '#1f7f99', Looks: '#9c3f86', Animation: '#c2185b', Tween: '#00897b', Objects: '#5a7a2a', Game: '#b0453a', Values: '#a86b16', Math: '#8a6d1a', Physics: '#c0572b', Sensing: '#3f6fd0', Online: '#0e8a8a', Variables: '#b8860b', Lists: '#8d6e63', Functions: '#6a5acd', Text: '#43a047', Time: '#0277bd', Input: '#ad1457', Camera: '#455a64', Audio: '#8e24aa', AI: '#d84315', Device: '#546e7a', UI: '#c2185b' };
const KIND_COLOR = { exec: '#e8e8e8', number: '#4fc3f7', bool: '#f7a02c', text: '#8bd347' };
const CATS = ['Events', 'Flow', 'Actions', 'Variables', 'Lists', 'Text', 'Functions', 'Time', 'Input', 'Physics', 'Sensing', 'AI', 'Online', 'Move', 'Looks', 'Animation', 'Tween', 'UI', 'Camera', 'Audio', 'Objects', 'Game', 'Device', 'Values', 'Math'];
const CAT_ICON = { Events: 'bolt', Flow: 'nodes', Actions: 'step', Move: 'move', Looks: 'brush', Animation: 'clock', Tween: 'rotate', Objects: 'cube', Game: 'trophy', Values: 'list', Math: 'plus', Physics: 'magnet', Sensing: 'crosshair', Online: 'globe', Variables: 'key', Lists: 'list', Functions: 'script', Text: 'text', Time: 'clock', Input: 'hand', Camera: 'camera', Audio: 'bulb', AI: 'enemy', Device: 'phone', UI: 'hud' };
/** "What usually comes next" for the Add Node picker. */
const NEXT = {
  _events: ['start', 'tap', 'touch', 'triggerEnter', 'collisionEnter', 'update', 'every', 'button', 'swipe', 'onMessage'],
  _exec: ['addVar', 'sound', 'tweenMove', 'punch', 'branch', 'wait', 'popText', 'goToPage', 'destroy'],
  _bool: ['compare', 'touching', 'grounded', 'rayHits', 'inTrigger', 'isMoving', 'coinFlip', 'and', 'not'],
  _number: ['number', 'getVar', 'random', 'math', 'distance', 'position'],
  tap: ['addVar', 'punch', 'popText', 'sound', 'pulse', 'playAnim', 'particles', 'destroy'],
  touch: ['destroy', 'damage', 'addVar', 'sound', 'particles', 'playAnim', 'blink'],
  update: ['branch', 'moveToward', 'lookAt', 'rotateBy', 'cooldown'],
  every: ['spawn', 'spawnAt', 'chance', 'randomBranch', 'addVar'],
  start: ['setVar', 'playAnim', 'message', 'loadGame', 'loop'],
  whileLoop: ['addVar', 'breakLoop', 'branch'], forEachList: ['branch', 'breakLoop', 'addVar'], mapForEach: ['textJoin', 'branch'], waitEvent: ['toast', 'addVar'], setDelegate: ['callDelegate'], switchText: ['goToPage', 'toast', 'sound'],
  onAppHidden: ['phoneNotify', 'saveGame', 'pauseGame'], onAppShown: ['phoneCancel', 'toast', 'addVar'], onNotifyOpened: ['toast', 'addVar', 'goToPage', 'giveItem'], onMenu: ['pauseGame', 'sound'], firstTimeEver: ['toast', 'goToPage', 'sayLine'], everyNth: ['toast', 'alert', 'goToPage'],
  damaged: ['blink', 'playAnim', 'impulse', 'sound'], death: ['playAnim', 'fadeTo', 'particles', 'destroy', 'gameOver'],
  animEnd: ['playAnim', 'destroy', 'sendMessage'], playAnim: ['wait', 'sound', 'particles'],
  tweenMove: ['punch', 'sound', 'particles'], tweenVar: ['popText', 'sound'], delayedCall: ['destroy', 'tweenMove', 'message'],
  triggerEnter: ['addVar', 'destroy', 'sound', 'particles', 'damage', 'setText'], triggerExit: ['message', 'sound', 'showHide'],
  collisionEnter: ['branch', 'damage', 'sound', 'impulse', 'particles', 'punch'], landed: ['particles', 'sound', 'punch', 'impulse'],
  raycast: ['destroy', 'damage', 'push', 'particles', 'setColor'], overlap: ['damage', 'push', 'setColor', 'destroy'], forEachTag: ['setColor', 'push', 'destroy', 'damage'],
  pickNearest: ['moveToward', 'lookAt', 'damage', 'tweenToObj'], objectNear: ['message', 'playAnim', 'sound', 'lookAt'], explosion: ['particles', 'sound', 'destroy'],
  branch: ['playAnim', 'addVar', 'sound', 'message'], wait: ['playAnim', 'destroy', 'spawn', 'showHide'],
  onKey: ['jump', 'addVar', 'setVelocity', 'sound'], onShake: ['particles', 'shake', 'addVar', 'randomWord'], onTimerDone: ['gameOver', 'message', 'sound', 'timerStart'],
  dailyCheck: ['addVar', 'message', 'sound'], timerStart: ['message', 'sound'], chase: ['damage', 'sound', 'message'], patrol: ['sound', 'particles'],
  _text: ['textJoin', 'numText', 'textFill', 'getText', 'randomWord'],
  onUiTap: ['uiShow', 'openPopup', 'confirm', 'toast', 'goToPage', 'sound'], confirm: ['restart', 'toast', 'uiShow'], askText: ['toast', 'setText', 'uiShow'], alert: ['nextLevel', 'restart', 'uiShow'],
};
const RECENT_KEY = 'pocket.recentNodes';
const recentNodes = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter((t) => NODE_TYPES[t]); } catch { return []; } };
const rememberNode = (t) => { try { localStorage.setItem(RECENT_KEY, JSON.stringify([t, ...recentNodes().filter((q) => q !== t)].slice(0, 8))); } catch {} };
const CAT_HELP = {
  Events: 'Start here: when something happens…',
  Actions: '…do something.',
  Move: 'Position, rotation and size.',
  Looks: 'Text, colour and effects.',
  Animation: 'Play clips, sprite frames, fades and flips.',
  Tween: 'Smooth moves like DOTween: move, jump, shake, spin, pulse, count up, type text; pause, reverse or speed them up.',
  Objects: 'Create, remove and tag objects.',
  Game: 'Score, lives, best score, time, items, checkpoints, combos, achievements, dialogue.',
  Flow: 'Decide, wait, repeat, count.',
  Values: 'Numbers and true/false to plug into inputs.',
  Math: 'Work numbers out: formulas, random, noise, angles, easing, rounding…',
  Physics: 'Triggers, collisions, landing, forces and bodies.',
  Variables: 'Game and per-object variables: change, clamp, text, saved on the device, “when it reaches…”.',
  Lists: 'Lists of numbers: add, remove, shuffle, sort, pick at random, sum, for each (decks, waypoints, high scores).',
  Functions: 'Functions with inputs and a result, your own events (now or later) and Comments.',
  Online: 'Multiplayer rooms (Photon) and accounts, leaderboards and cloud saves (PlayFab). Set them up in Game Settings › Online.',
  Sensing: 'Raycasts, what\'s nearby, line of sight, the screen. Found objects become “other”.',
  Text: 'Words: join, fill in {braces}, numbers as text (1.2K, 1st, XII), case, replace, part, checks, random words. Green dots carry text.',
  Time: 'Named timers (count down or stopwatch), the real clock, daily rewards with streaks, and time away from the game.',
  Input: 'Keyboard keys and arrow keys / WASD, phone tilt and shake, screen touches by area, finger drag and pinch.',
  Camera: 'Glide the camera to a point or an object, zoom smoothly, and read where it is.',
  Audio: 'Background music from your imported sounds, volume, mute, and musical notes.',
  AI: 'Simple behaviours to run every frame: chase, run away, wander, orbit, keep a distance, patrol.',
  Device: 'Share, copy to the clipboard, open a website, and check portrait, touch screen, online, dark mode…',
  UI: 'Menus and screens: show / hide with animations, popups, toasts, alerts, yes / no questions, typing a name, badges, enabling buttons, images, bars, themes, scrolling.',
};
export const NODE_HELP = {
  setObjLayer: 'Put this object, other, or a named object on a Layer (by name or number); its collider follows', layerIs: 'Is this object (or other) on a Layer', countInLayer: 'How many objects are on a Layer', forEachInLayer: 'Run “each” for every object on a Layer (it becomes other)',
  onUiTap: 'When a named UI element (or anything with that tag) is tapped, from any script. It becomes “other”', uiShow: 'Show or hide a panel with an animation (fade, pop, zoom, slide); “done” when it finishes',
  openPopup: 'Open or close a Popup or Side Bar component', closeTop: 'Close whatever popup or side bar is open (like the back gesture)',
  toast: 'A short message that slides in and disappears', alert: 'A message box with one button; “closed” when it is tapped', confirm: 'A question with two buttons: “yes” or “no”',
  askText: 'A text box with the keyboard (player names, codes); stores what was typed in a variable', uiEnable: 'Grey out a button so it can\'t be tapped, or turn it back on',
  setImage: 'Change a picture (built-in art:name or a link)', setBadge: 'A red bubble with a number on a button (0 hides it)', setBar: 'Change a progress bar\'s variable, maximum or colour',
  uiTheme: 'Switch the whole game\'s UI theme (fonts, colours, built-in screens)', uiOrder: 'Draw a UI element above or below the others', uiSize: 'Resize a UI element, smoothly if seconds > 0',
  scrollTo: 'Scroll a Scroll View to the top, bottom or part of the way', popupOpen: 'Is a popup or side bar open', uiVisible: 'Is an element showing', uiEnabled: 'Is an element tappable',
  safeArea: 'How much room the notch / home bar takes on each side',
  textJoin: 'Put up to three pieces of text (or numbers) together, with something between them', textFill: 'Text with {variables} filled in, plus {a} and {b} from the inputs',
  numText: 'A number as words: 1,234 · 1.2K · 1:05 · 42% · 1st · XII · +5', textLen: 'How many letters', textCase: 'UPPER, lower, Title Case, reversed or tidied spaces',
  textReplace: 'Swap every “find” for “with”', textPart: 'Some letters from a position (1 = first)', textCheck: 'Equals, contains, starts / ends with or is empty (ignores case except “equals”)',
  textNum: 'Read a number out of text (“1,500” → 1500)', getText: 'A variable as text (names, choices)', setTextTo: 'Store the wired text in a variable (show it with {name})',
  showText: 'Change an object\'s text to the wired text', randomWord: 'One of the words, picked at random', wordAt: 'The word at a position (wraps around: 8 → the 1st of 7)',
  timerStart: 'Start a named timer. Its name is also a variable, so text can show {timer}', timerControl: 'Pause, resume, stop or add seconds to a timer',
  timerValue: 'Seconds left (or counted), whole seconds, how far along, or running', onTimerDone: 'When a countdown reaches 0',
  clock: 'The phone\'s real time and date', dailyCheck: 'Once a day: “new day” (daily reward) or “same day”. Keeps a streak of days in a row',
  stampTime: 'Remember the time now on this device (e.g. when lives ran out)', timeSince: 'Seconds since Remember Time Now (0 if never): refill energy while away',
  onKey: 'A keyboard key (Space, Up, Down, Left, Right, Enter, A–Z, 0–9) pressed, released or held', keyHeld: 'Is a key down right now',
  keyAxis: '−1, 0 or 1 from the arrow keys or WASD', tiltValue: 'How far the phone is tilted, −1 to 1 (on iPhone a "Tap to turn on tilt" button asks for motion access)', calibrateTilt: 'Makes the way the phone is held right now count as level (no tilt)', setMoveSpeed: 'Changes the Move component\'s speed (1 = normal, 2 = double). Good for power-ups and slow zones', lockMove: 'Stops (or gives back) the player\'s control over Move, e.g. while talking or stunned', dashNow: 'A quick burst from the Move component. "not ready" while it cools down', onDash: 'Runs when this object dashes (Move component)', isRunning: 'True while the Move component is running', askPermission: 'Asks the player for location, camera, microphone, motion sensors, notifications or lasting storage. A card explains why first (your text), then the phone asks. allowed / not allowed / not supported (this browser can\'t)', permStatus: 'granted, denied, prompt (not asked yet) or unsupported', hasPermission: 'True once the player has allowed it', onPermission: 'Runs when the player answers a permission question', micLevel: 'How loud the microphone hears it, 0–100 (after Ask Permission: microphone). Blow, shout or clap to play', location: 'Where the phone is: latitude, longitude, accuracy, speed, heading, altitude (after Ask Permission: location; it keeps updating)', distanceTo: 'Metres from the phone to a place (latitude, longitude): treasure hunts, check-ins', onLocation: 'Runs each time the phone\'s location updates', camLive: 'Makes a camera the live one, blending from the current view (its own blend time, or yours)', camAuto: 'Lets camera priorities (and Camera Zones / Switchers) decide again', camPriority: 'Changes a camera\'s priority; the highest one is live (unless one was picked)', camTarget: 'Makes a camera follow something else (a tag or name), e.g. the boss during a cutscene', camImpulse: 'A camera shake from this object (weaker further from the camera) or everywhere the same', camNoise: 'Changes a camera\'s handheld noise (0 = steady)', camRecenter: 'Swings a Free Look (orbit) camera back to its starting angle and distance', onCamLive: 'Runs when a camera becomes the live one', camIsLive: 'True while this camera is the live one', haptic: 'A haptic tap: light, medium or heavy, or a success / warning / error pattern (real haptics in iOS / Android apps; a buzz on Android browsers; a tick on iPhone Safari)', logValue: 'Writes a label and a value (number, text, list) to the Console, as a log, warning or error', whileLoop: 'Runs "each" again and again while the condition is true (checked before every round), then "done". Stops after "at most" rounds so a mistake can\'t freeze the game', repeatUntil: 'Runs "each" until "stop when" turns true (checked before every round), then "done"', breakLoop: 'Inside any loop (Repeat, For Range, For Each, While…): stops the loop now; it goes on from "done"', continueLoop: 'Inside any loop: skips the rest of this round and goes on with the next one', switchText: 'Picks a way by text: the first case that matches (not case-sensitive), or "other". Great with the page variable', arrAdd: 'Adds an item to an array (a list that can hold words or numbers: "12" is stored as a number)', arrInsert: 'Puts an item at a position (1 = first); the rest move along', arrGetText: 'The item at a position, as text (−1 = the last one)', arrJoin: 'The whole array as one text, with your separator between items', arrSplit: 'Cuts a text into an array, e.g. "a, b, c" → three items', arrCount: 'How many times an item appears in the array', arrSlice: 'Copies positions from…to into another array', arrConcat: 'Puts two arrays one after the other into a third', arrUnique: 'Removes repeated items, keeping the first of each', arrFilter: 'Keeps only items that pass a test (bigger than, contains…), in the same or another array', arrMap: 'Changes every item: add, multiply, round, UPPER / lower case, add text before / after', arrSwap: 'Swaps two positions (shuffles, sorting by hand, inventory slots)', arrIndexOfMax: 'Where the biggest (or smallest) number is: 1 = first', loopItemText: 'The current item of a For Each, as text (words in arrays)', mapSet: 'Stores a value under a key in a dictionary (stats: hp = 100, xp = 5). Text shows it as hp: 100, xp: 5', mapGet: 'The value stored under a key, as text (blank if missing)', mapGetNum: 'The value stored under a key, as a number (0 if missing)', mapAdd: 'Adds to the number under a key (counts per item, scores per player)', mapHas: 'True if the dictionary has this key', mapRemove: 'Removes a key and its value', mapClear: 'Empties the dictionary', mapSize: 'How many keys the dictionary has', mapKeys: 'Puts all the keys into an array (to sort, show or loop over)', mapForEach: 'Runs "each" for every key; Loop Key and Loop Item give the key and its value', loopKey: 'The current key of a Dictionary: For Each', sendValue: 'Sends a message carrying a value (number or text); On Message reads it with Event Value / Event Value (text)', eventText: 'The value that came with a message or custom event, as text', waitEvent: 'Pauses this script until a message arrives (its value is in Event Value), or gives up after a timeout', setDelegate: 'Stores which Function to run in a variable, so you can swap behaviour (on hit: explode, freeze, bounce…) without rewiring', callDelegate: 'Runs the Function whose name is in the delegate variable ("empty" if none), with inputs a–c', callDelegateV: 'Runs the delegate\'s Function and gives back its Return Value', bindMessage: 'From now on, whenever this message arrives, run a Function (its value goes in as a). "Stop listening" removes it', hasFunction: 'True if this script has a Function with that name', onAppHidden: 'Runs when the player switches to another app or locks the phone. Good for saving or scheduling a "come back" notification', onAppShown: 'Runs when the player comes back to the game', onNotifyOpened: 'Runs when the player opens the game by tapping one of its phone notifications (blank id = any)', onMenu: 'Runs when a Side Menu opens or closes', onOrientation: 'Runs when the phone is turned sideways or upright', onOnline: 'Runs when the internet connection drops or comes back', menuOpen: 'Opens, closes or toggles a Side Menu (by its message, usually menu)', menuIsOpen: 'True while a Side Menu is open', navBars: 'Slides the Bottom Nav and App Bar away (e.g. during a level) or brings them back', vibratePattern: 'Buzzes in a rhythm: buzz, pause, buzz… in milliseconds (Android phones; iPhones don\'t vibrate from the web)', appBadge: 'The number on the game\'s Home Screen icon (0 clears it). Installed web apps', fullScreen: 'Turns full screen on or off (needs a tap first in a browser)', keepScreenOn: 'Stops the screen dimming and locking while the game runs, or lets it again', batteryLevel: 'The phone\'s battery, 0–100 (100 where the browser doesn\'t tell)', deviceLanguage: 'The phone\'s language, like en or fr, to pick texts', notifyAllowed: 'True once the player has allowed phone notifications', everyNth: 'Lets every Nth run through (e.g. show an ad or a tip every 3rd game); the others go to skip', firstTimeEver: 'Takes the "first time" way only once ever on this device (tutorials, welcome messages), then always "seen before"', phoneNotify: 'A real notification in the phone\'s notification area: now, in a while, daily at a time, or repeating. The same id replaces an earlier one. Asks the player first if needed ("not allowed" if they say no). Scheduled ones arrive while the game is closed only in iOS / Android apps', phoneCancel: 'Cancels a scheduled phone notification by its id (blank = all of them)', phoneAsk: 'Asks the player to allow phone notifications. Best after a win or from a "Remind me" button', notify: 'Shows a pop-up through a Notifications component (Project › UI › HUD › Achievement Popups / Toast Messages)', celebrate: 'Confetti through a Screen Effects component', openSettings: 'Opens the player Settings panel (left-handed, sensitivity, sound…). Pauses the game while open', playerSetting: 'One of the player\'s own settings (left-handed and vibration are 1 or 0)',
  onShake: 'When the phone is shaken', onScreenTouch: 'A finger lands anywhere, or in one half of the screen', dragAmount: 'How far a finger moved this frame',
  pinchAmount: 'Two fingers: 1 = no pinch, bigger = spread apart, smaller = pinched in', camMoveTo: 'Glide the camera to a point (without a Camera component following something)',
  camToObject: 'Glide the camera to an object', camZoomTo: 'Smoothly zoom (3D: narrows the view)', camValue: 'Where the camera is, or its zoom',
  playMusic: 'Loop an imported sound as music (one at a time)', stopMusic: 'Fade the music out', setVolume: '0 = silent, 1 = full', muteSound: 'Mute or unmute everything',
  playNote: 'A note by number (60 = middle C, 62 = D, 64 = E…)', isMuted: 'Is the sound off',
  chase: 'Move toward an object each frame; “caught” when close', flee: 'Move away each frame; “safe” once far enough', wander: 'Stroll to random spots around where it started',
  orbit: 'Circle around an object', keepDistance: 'Move closer or back off to stay at a distance', patrol: 'Back and forth from where it started; “turned” at each end',
  share: 'Open the share sheet with text ({score} works)', copyText: 'Copy text to the clipboard', openLink: 'Open a website in a new tab (in the played game)',
  deviceIs: 'Portrait, landscape, touch screen, online, installed as an app, dark mode, reduced motion',
  changeVar: 'Change a variable any way: set, add, subtract, multiply, divide, min, max, power or mod; the game\'s, this object\'s or other\'s', clampVar: 'Keep a variable between a min and max',
  copyVar: 'Copy one variable into another', toggleMyVar: 'Flip this object\'s variable between 0 and 1', resetVars: 'Put variables back to how they started (blank = all)',
  setTextVar: 'Put words in a variable ({braces} work): names, messages, choices', textIs: 'Check a text variable: equals, contains, starts with, or empty',
  saveVar: 'Keep a variable on this device between plays (coins, settings, unlocked levels)', loadVar: 'Get a saved variable back; “not saved yet” the first time', deleteSavedVar: 'Forget a saved variable',
  onMyVarChanged: 'When this object\'s own variable changes (update a health bar, flash red…)', whenMyVarReaches: 'Runs once when this object\'s variable crosses a value: hp ≤ 0 → die',
  listAdd: 'Add a number to a list (lists show in text as 1, 2, 3)', listRemove: 'Remove the last, first, a position, or a value from a list', listSet: 'Change the number at a position (1 = first)',
  listClear: 'Empty a list', listOrder: 'Shuffle, sort or reverse a list', listFill: 'Make a list of numbers from … to (e.g. 1–10, then shuffle for a deck)',
  forEachList: 'Run “each” for every item (Loop Item is the number, Loop Index its position)', listGet: 'The number at a position (1 = first)', listLen: 'How many items a list has',
  listHas: 'Is the number in the list?', listFind: 'Where the number is in the list (0 = not there)', listRandom: 'A random item from the list', listStat: 'Sum, smallest, biggest or average of a list',
  loopItem: 'The current item in List: For Each',
  funcDef: 'A named piece of script you can run from anywhere with Call / Run Function', funcArg: 'Read the a, b or c given to this Function', funcReturn: 'Give back a value from a Function (ends it)',
  callFunc: 'Run a Function now and use its result as a number', runFunc: 'Run a Function now (optionally keep the result in a variable)', callLater: 'Run a Custom Event after a delay',
  callerIs: 'In a Custom Event: does the object that called it have a tag?',
  formula: 'Type any math: a * 2 + b, sqrt(a^2 + b^2), score / 10, max(a, lives)… a–d are the inputs; other names are game variables',
  randomRange: 'A random number between min and max (inputs, so they can be wired)', randomPick: 'Picks one of the inputs at random', noise: 'Smooth random that drifts over time (−1…1): wobbles, flickers, wandering',
  invLerp: 'Where a value sits between a and b, as 0…1 (50 between 0 and 100 → 0.5)', moveTowards: 'Steps a value toward a target, never past it', angleDiff: 'The shortest turn from angle a to angle b (−180…180)',
  wrap: 'Keeps a value in a range by wrapping around (370° → 10°)', roundTo: 'Round to some decimal places (3.14159 → 3.14)', percent: 'Part of a total as a percent',
  easeVal: 'Bend a 0…1 value with an easing curve', vecLength: 'Length of an arrow (x, y, z)', distPoints: 'Distance between two points', anglePoints: 'Angle from one point to another (degrees)',
  minMax3: 'Smallest, largest, average or total of up to four numbers', between: 'Is a value between min and max?', isEven: 'Is the number even?',
  addScore: 'Add points, with a “+10” popping up here', loseLife: 'Take a life away; “no lives left” runs at 0 (game over if you like)', gainLife: 'Give lives back, up to a maximum',
  checkBest: 'Is this score a new best? Saves it if so', addTime: 'Add seconds to the time limit (or set it)', restartLevel: 'Start this level again',
  setCheckpoint: 'Players come back here when they respawn', respawn: 'Put the player back at their checkpoint', useItem: 'Spend items from the inventory (if there are enough)', hasItem: 'Does the player have enough of an item?',
  combo: 'Count hits in a row; {combo} drops to 0 after a pause', unlock: 'Unlock an achievement once (kept on this device) with a 🏆 message', isUnlocked: 'Has an achievement been unlocked?',
  hitStop: 'Freeze the game for a split second on a big hit: makes impacts feel strong', gameSpeed: 'Make the whole game faster or slower (1 = normal)', sayLine: 'Show a dialogue box; “closed” runs when the player taps it away',
  gameValue: 'Score, lives, best, time left, combo, level number or number of levels', gameStateIs: 'Is the game playing, on the title, over, won or paused?',
  setMyVar: 'A variable only this object has (each enemy its own hp). Text on it can show {hp}', addMyVar: 'Add to this object\'s own variable', getMyVar: 'Read this object\'s own variable',
  setOtherVar: 'Set a variable on “other” (what you touched, hit or found)', getOtherVar: 'Read a variable from “other”', varAt: 'Read a named object\'s own variable',
  onVarReaches: 'Runs once when a variable crosses a value (score ≥ 100), not every frame',
  customEvent: 'Your own event: runs when a Call Custom Event with the same name happens', callEvent: 'Run a Custom Event here, on “other”, on everything with a tag, or everywhere (with a number)',
  eventValue: 'The number sent with Call Custom Event', comment: 'A sticky note: explain what a part of the script does',
  forRange: 'Count from one number to another (Loop Index is the current number)', repeatEvery: 'Run “each” every few seconds, a number of times (0 = forever)', stopRepeat: 'Stop a Repeat Every',
  cycle: 'Each time it runs, take the next output: 1, 2, 3, 1, 2…', weighted: 'Pick A, B or C at random; bigger numbers are picked more often',
  gate: 'Lets the script through only while the gate is open', setGate: 'Open, close or flip a named Gate', waitFrames: 'Wait a number of frames (1 = next frame)',
  onLongPress: 'When the player holds a finger on this object', onDoubleTap: 'When the player taps this object twice quickly',
  attachTo: 'Stick to another object and move with it (pick up, ride, carry)', detach: 'Let go: stop moving with the parent', spawnLaunch: 'Create a template here and throw it (bullets, balls, sparks)',
  moveToFinger: 'Move to where the finger is (speed 0 = jump there)', lookAtFinger: 'Turn to face the finger', pauseGame: 'Pause or resume the game',
  directionTo: 'Which way a tagged object is (−1…1 on each axis)', distBetween: 'How far apart two objects are', snapTo: 'Round to a grid step (32 → 0, 32, 64…)',
  pingPong: 'Goes 0 → length → 0 as the value grows', sign: 'Is the number negative (−1), zero (0) or positive (1)?', smooth: 'Glides toward the target instead of jumping (for cameras, bars, counters)',
  chanceOf: 'True some of the time (25 = a quarter of the time)', fingers: 'How many fingers are touching the screen', isPaused: 'Is the game paused?', childCount: 'How many objects are inside this one',
  netSpawn: 'Create a template for everyone in the room (bullets, pickups); destroying it anywhere removes it for everyone',
  netConnect: 'Connect to Photon (Join Room does this for you)', netJoin: 'Join a room by name, or any open room; “joined” runs once you are in', netLeave: 'Leave the multiplayer room',
  netSend: 'Tell everyone else in the room something (they get it as a message)', netShared: 'A variable everyone in the room shares (late joiners get it too)',
  onNetJoined: 'When you join a room', onPlayerJoined: 'When someone else joins your room', onPlayerLeft: 'When someone leaves your room', onNetMessage: 'When another player sends a network message',
  netPlayers: 'How many players are in the room', netIsMaster: 'Are you the room host (the first player)?', netInRoom: 'Are you in a multiplayer room?', netValue: 'The number sent with the last network message',
  pfLogin: 'Sign in to PlayFab (automatic on this device, no password)', pfSubmit: 'Post a score to a PlayFab leaderboard', pfName: 'Set the name shown on leaderboards',
  pfSave: 'Save variables to the player\'s PlayFab account', pfLoad: 'Load the saved variables back (any device, same player)', pfTitle: 'Load Title Data from PlayFab as variables (tune your live game)',
  pfEventN: 'Record an event for PlayFab analytics', onPfLogin: 'When the player is signed in to PlayFab', onOnlineError: 'When something online goes wrong ({onlineError} says what)',
  goToPage: 'Show a UI page (sets the page variable). “open” lets Back return here; “start over” clears the history', goBack: 'Go back a page (closes a popup or side bar first); “nowhere to go” runs when there is no history',
  onPage: 'When a page opens (the page variable changes to it)', onBack: 'When the player goes back (Back button, phone back gesture, Esc, edge swipe)',
  pageIs: 'Is this page showing?', canGoBack: 'Is there a page (or popup) to go back from?',
  triggerEnter: 'When something enters this trigger (or this enters one); it becomes “other”', triggerExit: 'When something leaves the trigger', triggerStay: 'Every frame while something is inside the trigger',
  collisionEnter: 'When something solid bumps into this; set a speed to ignore soft touches', collisionExit: 'When a solid contact ends', collisionStay: 'Every frame while two solid things touch',
  landed: 'When this lands on the ground', leftGround: 'When this jumps or falls off the ground',
  addForce: 'Push with physics: a steady force (use with Every Frame), a one-off impulse, or a straight speed change; heavier things move less',
  explosion: 'Blast nearby physics objects away, stronger close up', setBodyType: 'Dynamic falls and gets pushed, kinematic only moves by script, static never moves',
  setTrigger: 'Trigger: things pass through but it still detects them. Solid: they bump.', setLayer: 'Which collision layer this is on (see the layer matrix)', physMaterial: 'Bounciness, slipperiness and weight',
  impactSpeed: 'How hard the last collision was', inTrigger: 'Is something inside this trigger right now?', isColliding: 'Is this touching something solid right now?',
  raycast: 'Shoot an invisible line; “hit” runs with what it hit as “other” (blocks too). Turn on “show the ray” to see it', rayHits: 'Does a line hit something? “ahead & down” checks for a ledge in front',
  hitInfo: 'Where the last ray or collision hit: distance, point, and the surface direction (normal)', overlap: 'Find things within a radius: runs “each” for every one (as “other”), then “found” with the nearest',
  countRadius: 'How many things with a tag are within a radius', forEachTag: 'Run something for every object with a tag (each one is “other”)',
  pickNearest: 'Make the nearest object with a tag “other”, then use any “other” node', pickObject: 'Make a named object “other”', lineOfSight: 'Is the nearest tagged object visible, with nothing solid in between?',
  objectNear: 'When a tagged object comes within range (“near”) and when it goes away (“left”)', screenEnter: 'When this comes onto the screen', screenExit: 'When this goes off the screen',
  onScreen: 'Is this on the screen?', otherInfo: 'Facts about “other”: position, speed, distance, angle or health', otherHasTag: 'Does “other” have a tag?', hasOther: 'Is there an “other” object here?',
  start: 'When the game starts', update: 'Runs every frame', every: 'Repeats on a timer', touch: 'When something with a tag touches this',
  tap: 'When the player taps this object', button: 'When an on-screen button is pressed', swipe: 'When the player swipes', destroyed: 'When this object is removed',
  branch: 'Go one way if true, another if false', wait: 'Pause, then continue', chance: 'Pick a random path', once: 'Only the first time', sequence: 'Run up to three things in order',
  setVar: 'Set a variable like score or hp', addVar: 'Add (or subtract) from a variable', message: 'Pop up text on screen', sound: 'Play a sound effect',
  spawn: 'Create a copy of a template', destroy: 'Remove this or the other object', moveBy: 'Nudge the position', setVelocity: 'Set speed and direction',
  jump: 'Jump upward', showHide: 'Show or hide an object', vibrate: 'Buzz the phone', shake: 'Shake the camera', win: 'Player wins', gameOver: 'Game over',
  nextLevel: 'Go to the next level', restart: 'Start again',
  number: 'A fixed number', getVar: 'Read a variable', random: 'A random number (whole if min and max are whole)', math: 'Add, subtract, multiply…', compare: 'Is A bigger than B?',
  touchEnd: 'When something with a tag stops touching this', saveGame: 'Save variables, level and collected items', loadGame: 'Continue from a save (or go to “no save”)',
  deleteSave: 'Erase a save slot', push: 'Add speed: knockback, dash, boost', setGravity: 'Change gravity (flip it, zero-g…)', switchCamera: 'Make another Camera object active',
  zoomCamera: 'Smoothly zoom in or out', setLight: 'Turn a light on/off or dim it', setDarkness: 'How dark the 2D scene is (0–1)',
  hasSave: 'Is there a saved game?', grounded: 'Standing on something?', velocity: 'How fast this moves', touching: 'Touching something with a tag right now?', canSee: 'Nothing solid in between?',
  onMessage: 'When a message is sent (Send Message, buttons, tweens)', tweenTo: 'Smoothly animate a property with easing', punch: 'Pop, bump or wobble for juicy feedback',
  killTweens: 'Stop tweens on this object (or by tween ID)', playAnim: 'Play a clip (Animator or Sprite Sheet)', stopAnim: 'Stop the animation', sendMessage: 'Tell other objects something happened',
  impulse: 'Shake the camera from this spot (weaker far away)',
  varChanged: 'When a variable (score, hp…) changes', damaged: 'When this object loses health', death: 'When this object\'s health reaches 0', holding: 'Every frame while a finger is on the screen',
  loop: 'Run “each” several times, then “done” (use Loop Index)', flipFlop: 'Alternate: A, then B, then A…', cooldown: 'Let it through at most once every N seconds',
  countTo: 'Count runs; go to “reached” on the Nth', randomBranch: 'Pick one wired path at random', switchNum: 'Go down the path matching the number', compareBranch: 'Compare two numbers and branch',
  setPosition: 'Put an object at an exact spot', moveToward: 'Step toward the nearest tagged object (use with Every Frame)', lookAt: 'Turn to face the nearest tagged object',
  rotateBy: 'Turn by some degrees', setScale: 'Make bigger or smaller', teleport: 'Jump to another object', setText: 'Change a text (use {score} etc.)',
  setColor: 'Change the colour', particles: 'A burst of particles here', spawnAt: 'Create a copy of a template at another object', destroyTag: 'Remove every object with a tag',
  tagOp: 'Add or remove a tag on this object', slowMo: 'Slow the whole game down for a moment', damage: 'Hurt something with Health', heal: 'Give health back', giveItem: 'Add to the inventory',
  math1: 'abs, round, square root, sin…', clamp: 'Keep a number between min and max', lerp: 'Blend from A to B (t from 0 to 1)', loopIndex: 'Which repeat this is (0, 1, 2…)',
  angleTo: 'Direction to the nearest tagged object, in degrees', countTag: 'How many objects have a tag', exists: 'Is that object (or tag) still around?', health: 'This object\'s health',
  itemCount: 'How many of an item you have', joystick: 'Joystick direction (−1 to 1)', screen: 'Screen width or height',
  released: 'When a finger is lifted off the screen', onWin: 'When the player wins', onGameOver: 'When the game is lost', stateEntered: 'When a State Machine enters a state',
  animEnd: 'When a “once” clip finishes playing', animSpeed: 'Play animations faster or slower (1 = normal)', setFrame: 'Show one frame of the sprite sheet',
  flipX: 'Face left or right (mirror the sprite)', fadeTo: 'Fade in or out (0 = invisible, 1 = solid)', blink: 'Flash on and off (like after getting hit)',
  toggleVar: 'Switch a variable between 0 and 1', setBackground: 'Change the background colour', setAlpha: 'See-through amount (0–1)', stopMoving: 'Set speed to zero',
  gravityScale: 'How much gravity pulls this (0 = floats)', isMoving: 'Moving right now?', isHolding: 'Is a finger on the screen?', touchPos: 'Where the finger is (in the world, 2D)',
  coinFlip: 'Randomly true or false', level: 'Which level this is (1, 2, 3…)', animPlaying: 'Is a clip playing right now?', spriteFrame: 'Which sprite sheet frame is showing',
  tweenMove: 'Glide to (or by, or from) a point with easing', tweenToObj: 'Glide to where another object is', jumpTo: 'Hop in an arc', shakeTw: 'Jitter position, rotation or size',
  spin: 'Turn round once or forever', pulse: 'Grow and shrink like a heartbeat', tweenColor: 'Fade to another colour', tweenVar: 'Count a variable up or down smoothly (score counters)',
  typeText: 'Type a text letter by letter', spiralTw: 'Spiral outward', lookAtTw: 'Turn smoothly to face something', pauseTw: 'Pause or resume tweens (by ID or on this object)',
  reverseTw: 'Play tweens backwards, forwards, flipped or from the start', tweenSpeed: 'Make tweens faster or slower (1 = normal)', playTween: 'Play this object\'s Tween / Tween Sequence',
  delayedCall: '“later” runs after a delay; cancel it with Stop Tweens and its ID', isTweening: 'Is something still animating?',
  popText: 'Floating text like “+10”', flashScreen: 'Flash the whole screen a colour', randomVar: 'Roll a random whole number into a variable', goToLevel: 'Jump to a level by number',
  toggleComp: 'Turn a component (patrol, spawner…) on or off', waitUntil: 'Wait until something is true', randomWait: 'Wait a random time',
  choose: 'Pick “yes” if the condition is true, else “no”', wave: 'A value that swings back and forth over time', remap: 'Convert a number from one range to another',
  objPos: 'Where another object is', deltaTime: 'Seconds since the last frame',
  and: 'Both are true', or: 'Either is true', not: 'Flip true/false', position: 'Where this object is', distance: 'How far to the nearest tagged object', time: 'Seconds since start',
};

/** Ready-made node graphs you can drop in and change. */
const GRAPH_TEMPLATES = [
  { label: 'UI: ask the player\'s name', nodes: [{ id: 's', type: 'start', x: 0, y: 0 }, { id: 'c', type: 'textCheck', x: 0, y: 200, params: { op: 'is empty' } }, { id: 'g', type: 'getText', x: -300, y: 200, params: { name: 'playerName' } }, { id: 'b', type: 'branch', x: 300, y: 0 },
    { id: 'a', type: 'askText', x: 620, y: 0, params: { question: 'What\'s your name?', name: 'playerName', placeholder: 'Hero', max: 16 } }, { id: 't', type: 'toast', x: 960, y: 0, params: { text: 'Welcome, {playerName}!', where: 'top' } }, { id: 'v', type: 'saveVar', x: 1280, y: 0, params: { name: 'playerName' } }, { id: 'l', type: 'loadVar', x: -300, y: -40, params: { name: 'playerName' } }],
    links: [['s', 'then', 'l'], ['l', 'loaded', 'b'], ['l', 'not saved yet', 'b'], ['g', 'value', 'c', 'text'], ['c', 'value', 'b', 'condition'], ['b', 'true', 'a'], ['a', 'entered', 't'], ['t', 'then', 'v']] },
  { label: 'UI: Restart button asks first', nodes: [{ id: 'u', type: 'onUiTap', x: 0, y: 0, params: { object: 'Restart Button' } }, { id: 'c', type: 'confirm', x: 300, y: 0, params: { title: 'Restart?', text: 'Your progress on this level will be lost.', yes: 'Restart', no: 'Keep playing' } }, { id: 'r', type: 'restart', x: 640, y: -40 }],
    links: [['u', 'then', 'c'], ['c', 'yes', 'r']] },
  { label: 'UI: menu button opens a panel', nodes: [{ id: 'u', type: 'onUiTap', x: 0, y: 0, params: { object: 'Menu Button' } }, { id: 'h', type: 'uiShow', x: 300, y: 0, params: { object: 'Menu Panel', mode: 'toggle', anim: 'slide from left', seconds: 0.25 } }, { id: 'p', type: 'sound', x: 640, y: 0, params: { sound: 'click' } }],
    links: [['u', 'then', 'h'], ['h', 'then', 'p']] },
  { label: 'UI: shop badge counts new items', nodes: [{ id: 'v', type: 'varChanged', x: 0, y: 0, params: { name: 'newItems' } }, { id: 'b', type: 'setBadge', x: 300, y: 0, params: { object: 'Shop Button' } }, { id: 'g', type: 'getVar', x: 0, y: 200, params: { name: 'newItems' } },
    { id: 'u', type: 'onUiTap', x: 0, y: 360, params: { object: 'Shop Button' } }, { id: 'z', type: 'setVar', x: 300, y: 360, params: { name: 'newItems', value: 0 } }],
    links: [['v', 'then', 'b'], ['g', 'value', 'b', 'number'], ['u', 'then', 'z']] },
  { label: 'Daily reward with streak', nodes: [{ id: 's', type: 'start', x: 0, y: 0 }, { id: 'd', type: 'dailyCheck', x: 300, y: 0, params: { key: 'daily', streak: 'streak' } }, { id: 'a', type: 'addVar', x: 640, y: -60, params: { name: 'coins' } },
    { id: 'f', type: 'formula', x: 300, y: 220, params: { expr: 'min(streak, 7) * 10' } }, { id: 'm', type: 'message', x: 960, y: -60, params: { text: 'Day {streak} in a row! +coins', seconds: 2.5 } }],
    links: [['s', 'then', 'd'], ['d', 'new day', 'a'], ['f', 'value', 'a', 'amount'], ['a', 'then', 'm']] },
  { label: 'Countdown: 30 seconds to win', nodes: [{ id: 's', type: 'start', x: 0, y: 0 }, { id: 't', type: 'timerStart', x: 300, y: 0, params: { name: 'clock', mode: 'count down', seconds: 30 } },
    { id: 'o', type: 'onTimerDone', x: 0, y: 220, params: { name: 'clock' } }, { id: 'g', type: 'gameOver', x: 300, y: 220 }, { id: 'n', type: 'comment', x: 640, y: 0, params: { text: 'Show the time left in any text with {clock}. Add time with Pause / Resume / Stop Timer → add seconds.' } }],
    links: [['s', 'then', 't'], ['o', 'then', 'g']] },
  { label: 'Enemy AI: wander, chase when near', nodes: [{ id: 'u', type: 'update', x: 0, y: 0 }, { id: 'c', type: 'compareBranch', x: 300, y: 0, params: { op: '<' } }, { id: 'd', type: 'distance', x: 0, y: 200, params: { tag: 'player' } },
    { id: 'n', type: 'number', x: 0, y: 360, params: { value: 180 } }, { id: 'h', type: 'chase', x: 640, y: -80, params: { tag: 'player' } }, { id: 'w', type: 'wander', x: 640, y: 160 }, { id: 'k', type: 'cooldown', x: 960, y: -80, params: { seconds: 1 } }, { id: 'x', type: 'damage', x: 1260, y: -80 }],
    links: [['u', 'then', 'c'], ['d', 'value', 'c', 'a'], ['n', 'value', 'c', 'b'], ['c', 'yes', 'h'], ['c', 'no', 'w'], ['h', 'caught', 'k'], ['k', 'then', 'x']] },
  { label: 'Keyboard: arrows move, Space jumps', nodes: [{ id: 'u', type: 'update', x: 0, y: 0 }, { id: 'v', type: 'setVelocity', x: 300, y: 0 }, { id: 'f', type: 'formula', x: 0, y: 180, params: { expr: 'a * 220' } }, { id: 'a', type: 'keyAxis', x: -300, y: 180 },
    { id: 'y', type: 'velocity', x: 0, y: 380, params: { axis: 'y' } }, { id: 'k', type: 'onKey', x: 0, y: 560, params: { key: 'Space', when: 'pressed' } }, { id: 'j', type: 'jump', x: 300, y: 560 }],
    links: [['u', 'then', 'v'], ['a', 'value', 'f', 'a'], ['f', 'value', 'v', 'x'], ['y', 'value', 'v', 'y'], ['k', 'then', 'j']] },
  { label: 'Name tag: “Hero the 3rd”', nodes: [{ id: 's', type: 'start', x: 0, y: 0 }, { id: 't', type: 'showText', x: 640, y: 0 }, { id: 'j', type: 'textJoin', x: 300, y: 120, params: { a: 'Hero the ', sep: '' } }, { id: 'o', type: 'numText', x: 0, y: 200, params: { format: 'ordinal (1st)' } }, { id: 'l', type: 'level', x: -300, y: 200 }],
    links: [['s', 'then', 't'], ['j', 'value', 't', 'text'], ['o', 'value', 'j', 'b'], ['l', 'value', 'o', 'value']] },
  { label: 'Function: damage with armour', nodes: [{ id: 'f', type: 'funcDef', x: 0, y: 0, params: { name: 'hurt' } }, { id: 'r', type: 'funcReturn', x: 620, y: 0 }, { id: 'm', type: 'formula', x: 300, y: 120, params: { expr: 'max(1, a - armour)' } }, { id: 'a', type: 'funcArg', x: 0, y: 200, params: { which: 'a' } },
    { id: 't', type: 'triggerEnter', x: 0, y: 380, params: { tag: 'bullet' } }, { id: 'c', type: 'changeVar', x: 620, y: 380, params: { name: 'hp', op: 'subtract', scope: 'this object' } }, { id: 'k', type: 'callFunc', x: 300, y: 480, params: { name: 'hurt', a: 5 } },
    { id: 'w', type: 'whenMyVarReaches', x: 0, y: 700, params: { name: 'hp', op: '≤', value: 0 } }, { id: 'd', type: 'destroy', x: 300, y: 700 }, { id: 'n', type: 'comment', x: -320, y: 0, params: { text: 'A Function returns the damage after armour; hits subtract it from this object\'s own hp, and at 0 it is destroyed. Set a game variable "armour".' } }],
    links: [['f', 'then', 'r'], ['m', 'value', 'r', 'value'], ['a', 'value', 'm', 'a'], ['t', 'then', 'c'], ['k', 'value', 'c', 'value'], ['w', 'then', 'd']] },
  { label: 'Shuffled deck: draw a card', nodes: [{ id: 's', type: 'start', x: 0, y: 0 }, { id: 'f', type: 'listFill', x: 300, y: 0, params: { name: 'deck', from: 1, to: 10 } }, { id: 'o', type: 'listOrder', x: 620, y: 0, params: { name: 'deck', mode: 'shuffle' } },
    { id: 't', type: 'tap', x: 0, y: 260 }, { id: 'v', type: 'setVar', x: 620, y: 260, params: { name: 'card' } }, { id: 'g', type: 'listGet', x: 300, y: 380, params: { name: 'deck', position: 1 } }, { id: 'r', type: 'listRemove', x: 940, y: 260, params: { name: 'deck', mode: 'first' } }, { id: 'e', type: 'message', x: 1260, y: 330, params: { text: 'The deck is empty!' } }],
    links: [['s', 'then', 'f'], ['f', 'then', 'o'], ['t', 'then', 'v'], ['g', 'value', 'v', 'value'], ['v', 'then', 'r'], ['r', 'nothing removed', 'e']] },
  { label: 'Enemy with its own HP (3 hits)', nodes: [{ id: 'a', type: 'start', x: 0, y: 0 }, { id: 'b', type: 'setMyVar', x: 300, y: 0, params: { name: 'hp', value: 3 } }, { id: 'c', type: 'triggerEnter', x: 0, y: 200, params: { tag: 'bullet' } }, { id: 'd', type: 'addMyVar', x: 300, y: 200, params: { name: 'hp', amount: -1 } }, { id: 'e', type: 'punch', x: 600, y: 200, params: { what: 'scale', amount: 0.25 } }, { id: 'f', type: 'compareBranch', x: 900, y: 200, params: { op: '≤', b: 0 } }, { id: 'g', type: 'getMyVar', x: 600, y: 560, params: { name: 'hp' } }, { id: 'h', type: 'particles', x: 1200, y: 160 }, { id: 'i', type: 'destroy', x: 1500, y: 160 }, { id: 'n', type: 'comment', x: -320, y: 0, params: { text: 'Each copy of this enemy keeps its own hp. Bullets need the tag "bullet".' } }], links: [['a', 'then', 'b'], ['c', 'then', 'd'], ['d', 'then', 'e'], ['e', 'then', 'f'], ['g', 'value', 'f', 'a'], ['f', 'yes', 'h'], ['h', 'then', 'i']] },
  { label: 'Custom event: explode on call', nodes: [{ id: 'a', type: 'customEvent', x: 0, y: 0, params: { name: 'explode' } }, { id: 'b', type: 'particles', x: 300, y: 0, params: { color: '#ff7043' } }, { id: 'c', type: 'impulse', x: 600, y: 0, params: { strength: 14 } }, { id: 'd', type: 'destroy', x: 900, y: 0 }, { id: 'e', type: 'onLongPress', x: 0, y: 220, params: { seconds: 0.6 } }, { id: 'f', type: 'callEvent', x: 300, y: 220, params: { name: 'explode', on: 'all with tag', tag: 'bomb' } }], links: [['a', 'then', 'b'], ['b', 'then', 'c'], ['c', 'then', 'd'], ['e', 'then', 'f']] },
  { label: 'Wave: 5 enemies, one every 0.8 s', nodes: [{ id: 'a', type: 'start', x: 0, y: 0 }, { id: 'b', type: 'repeatEvery', x: 300, y: 0, params: { seconds: 0.8, times: 5 } }, { id: 'c', type: 'weighted', x: 620, y: -40, params: { A: 70, B: 30, C: 0 } }, { id: 'd', type: 'spawn', x: 940, y: -80, params: { template: '' } }, { id: 'e', type: 'spawn', x: 940, y: 120, params: { template: '' } }, { id: 'f', type: 'message', x: 620, y: 240, params: { text: 'That was the last one!', seconds: 1.5 } }], links: [['a', 'then', 'b'], ['b', 'each', 'c'], ['c', 'A', 'd'], ['c', 'B', 'e'], ['b', 'done', 'f']] },
  { label: 'Tap → score + pop', nodes: [{ id: 'a', type: 'tap', x: 0, y: 0 }, { id: 'b', type: 'addVar', x: 300, y: 0, params: { name: 'score', amount: 1 } }, { id: 'c', type: 'punch', x: 600, y: 0, params: { what: 'scale', amount: 0.3, seconds: 0.4 } }], links: [['a', 'then', 'b'], ['b', 'then', 'c']] },
  { label: 'Touch player → hurt + shake', nodes: [{ id: 'a', type: 'touch', x: 0, y: 0, params: { tag: 'player' } }, { id: 'b', type: 'addVar', x: 300, y: 0, params: { name: 'lives', amount: -1 } }, { id: 'c', type: 'impulse', x: 600, y: 0, params: { strength: 14 } }], links: [['a', 'then', 'b'], ['b', 'then', 'c']] },
  { label: 'Every 2s → spawn', nodes: [{ id: 'a', type: 'every', x: 0, y: 0, params: { seconds: 2 } }, { id: 'b', type: 'spawn', x: 300, y: 0, params: { template: '' } }], links: [['a', 'then', 'b']] },
  { label: 'Score ≥ 10 → win', nodes: [{ id: 'a', type: 'update', x: 0, y: 0 }, { id: 'b', type: 'branch', x: 300, y: 0 }, { id: 'c', type: 'compare', x: 0, y: 150, params: { op: '≥', b: 10 } }, { id: 'd', type: 'getVar', x: -300, y: 150, params: { name: 'score' } }, { id: 'e', type: 'win', x: 600, y: 0 }], links: [['a', 'then', 'b'], ['b', 'true', 'e'], ['c', 'value', 'b', 'condition'], ['d', 'value', 'c', 'a']] },
  { label: 'Swipe up → jump', nodes: [{ id: 'a', type: 'swipe', x: 0, y: 0, params: { dir: 'up' } }, { id: 'b', type: 'jump', x: 300, y: 0, params: { power: 650 } }], links: [['a', 'then', 'b']] },
  { label: 'Chase the player', nodes: [{ id: 'a', type: 'update', x: 0, y: 0 }, { id: 'b', type: 'moveToward', x: 300, y: 0, params: { tag: 'player', speed: 90 } }, { id: 'c', type: 'lookAt', x: 600, y: 0, params: { tag: 'player' } }], links: [['a', 'then', 'b'], ['b', 'then', 'c']] },
  { label: 'Tap 5 times → win', nodes: [{ id: 'a', type: 'tap', x: 0, y: 0 }, { id: 'b', type: 'countTo', x: 300, y: 0, params: { times: 5 } }, { id: 'c', type: 'particles', x: 620, y: -40 }, { id: 'd', type: 'win', x: 620, y: 140 }], links: [['a', 'then', 'b'], ['b', 'not yet', 'c'], ['b', 'reached', 'd']] },
  { label: 'Hit → blink + hurt animation', nodes: [{ id: 'a', type: 'touch', x: 0, y: 0, params: { tag: 'enemy' } }, { id: 'b', type: 'playAnim', x: 300, y: 0, params: { clip: 'hurt', loop: 'once' } }, { id: 'c', type: 'blink', x: 600, y: 0, params: { seconds: 1 } }, { id: 'd', type: 'animEnd', x: 0, y: 220, params: { clip: 'hurt' } }, { id: 'e', type: 'playAnim', x: 300, y: 220, params: { clip: 'idle', loop: 'loop' } }], links: [['a', 'then', 'b'], ['b', 'then', 'c'], ['d', 'then', 'e']] },
  { label: 'Run / idle by speed', nodes: [{ id: 'a', type: 'update', x: 0, y: 0 }, { id: 'b', type: 'branch', x: 300, y: 0 }, { id: 'c', type: 'isMoving', x: 0, y: 150 }, { id: 'd', type: 'playAnim', x: 620, y: -60, params: { clip: 'run', loop: 'loop' } }, { id: 'e', type: 'playAnim', x: 620, y: 160, params: { clip: 'idle', loop: 'loop' } }], links: [['a', 'then', 'b'], ['c', 'value', 'b', 'condition'], ['b', 'true', 'd'], ['b', 'false', 'e']] },
  { label: 'Collect: hop, fade, remove', nodes: [{ id: 'a', type: 'touch', x: 0, y: 0, params: { tag: 'player' } }, { id: 'b', type: 'popText', x: 300, y: 0, params: { text: '+10' } }, { id: 'c', type: 'jumpTo', x: 600, y: 0, params: { x: 0, y: 0, height: 60, seconds: 0.4 } }, { id: 'd', type: 'fadeTo', x: 900, y: 0, params: { alpha: 0, seconds: 0.4 } }, { id: 'e', type: 'destroy', x: 1200, y: 60 }], links: [['a', 'then', 'b'], ['b', 'then', 'c'], ['c', 'then', 'd'], ['d', 'finished', 'e']] },
  { label: 'Tap → score counts up', nodes: [{ id: 'a', type: 'tap', x: 0, y: 0 }, { id: 'b', type: 'math', x: 0, y: 180, params: { op: '+', b: 10 } }, { id: 'g', type: 'getVar', x: -300, y: 180, params: { name: 'score' } }, { id: 'c', type: 'tweenVar', x: 300, y: 0, params: { name: 'score', seconds: 0.6 } }, { id: 'd', type: 'pulse', x: 620, y: 0, params: { amount: 1.2, seconds: 0.15, repeat: 'once' } }], links: [['a', 'then', 'c'], ['g', 'value', 'b', 'a'], ['b', 'value', 'c', 'to'], ['c', 'then', 'd']] },
  { label: 'Spawn a ring of 8', nodes: [{ id: 'a', type: 'start', x: 0, y: 0 }, { id: 'b', type: 'loop', x: 300, y: 0, params: { count: 8 } }, { id: 'c', type: 'spawn', x: 620, y: 0, params: { template: '' } }], links: [['a', 'then', 'b'], ['b', 'each', 'c']] },
];
const def = (n) => NODE_TYPES[n.type] || { label: n.type, cat: 'Actions' };
const outKind = (d) => d.value || 'exec';

/**
 * opts: { graph, title, h, popMenu, toast, buzz, templates: [names], objects: [names], vars: [names], onChange(graph), onClose() }
 * Returns { close }.
 */
export function openNodeEditor(opts) {
  const { h, popMenu, toast, buzz = () => {} } = opts;
  const g = JSON.parse(JSON.stringify(opts.graph || { nodes: [], links: [] }));
  g.nodes ||= []; g.links ||= [];
  let k = 0.85, tx = 20, ty = 20;
  let pending = null; // { node, port, dir, kind }
  let selected = null;
  const undo = [], redo = [];
  let selMode = false, warn = null; // selMode: "Select several" (tap nodes or drag a box); warn: node ids with problems (Check)
  const multi = new Set();

  const emit = () => { warn = null; opts.onChange(JSON.parse(JSON.stringify(g))); };
  const syncUndo = () => { undoBtn.disabled = !undo.length; redoBtn.disabled = !redo.length; };
  const snap = () => { undo.push(JSON.stringify(g)); if (undo.length > 60) undo.shift(); redo.length = 0; syncUndo(); };
  const nid = () => { let i = g.nodes.length + 1; while (g.nodes.some((n) => n.id === 'n' + i)) i++; return 'n' + i; };

  // ---------- DOM ----------
  const world = h('div', { class: 'ne-world' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'ne-links');
  world.append(svg);
  const area = h('div', { class: 'ne-area' }, world);
  const empty = h('div', { class: 'ne-empty' }, h('b', {}, 'No nodes yet'), 'Tap “Add Node” and start with a green Event, like On Tap.');
  const hint = h('div', { class: 'ne-hint' });
  const restore = (from, to) => { if (!from.length) return; to.push(JSON.stringify(g)); const prev = JSON.parse(from.pop()); g.nodes = prev.nodes; g.links = prev.links; multi.clear(); syncUndo(); pending = null; render(); emit(); };
  const undoBtn = h('button', { class: 'ne-btn', title: 'Undo', disabled: true, onclick: () => restore(undo, redo) }, icon('undo'));
  const redoBtn = h('button', { class: 'ne-btn', title: 'Redo', disabled: true, onclick: () => restore(redo, undo) }, icon('redo'));
  const selCount = h('b', {}, '');
  const selBar = h('div', { class: 'ne-selbar', hidden: true },
    selCount,
    h('button', { onclick: () => { const L = g.nodes.filter((q) => multi.has(q.id)); if (L.length) copyNodes(L); } }, icon('copy'), 'Copy'),
    h('button', { onclick: () => duplicateSel() }, icon('plus'), 'Duplicate'),
    h('button', { onclick: () => { const L = g.nodes.filter((q) => multi.has(q.id) && !def(q).comment); if (!L.length) return; snap(); const off = !L.every((q) => q.off); for (const q of L) { if (off) q.off = true; else delete q.off; } emit(); render(); } }, icon('eyeoff'), 'On / Off'),
    h('button', { class: 'danger', onclick: () => { if (!multi.size) return; snap(); g.nodes = g.nodes.filter((q) => !multi.has(q.id)); g.links = g.links.filter((l) => !multi.has(l.from.node) && !multi.has(l.to.node)); multi.clear(); emit(); render(); } }, icon('trash'), 'Delete'),
    h('button', { class: 'done', onclick: () => setSelMode(false) }, 'Done'));
  const band = h('div', { class: 'ne-band', hidden: true });
  const fmtStat = (v) => (typeof v === 'boolean' ? (v ? 'true' : 'false') : typeof v === 'number' ? String(Math.round(v * 100) / 100) : v == null ? '—' : String(v).slice(0, 8));
  const hasStats = () => g.nodes.some((q) => opts.stats?.(q.id)?.runs);
  const root = h('div', { class: 'ne' },
    h('div', { class: 'ne-top' },
      h('button', { class: 'ne-btn done', onclick: () => close() }, icon('check'), 'Done'),
      h('div', { class: 'ne-title' }, h('b', {}, opts.title || 'Visual Script'), h('small', {}, opts.linked?.()?.name ? 'Saved script: ' + opts.linked().name : 'Visual Script')),
      undoBtn, redoBtn,
      h('button', { class: 'ne-btn', title: 'Find a node', onclick: () => openFind() }, icon('search')),
      h('button', { class: 'ne-btn', title: 'More', onclick: (e) => moreMenu(e.currentTarget) }, icon('more'))),
    area, empty, hint, selBar,
    h('button', { class: 'ne-add', onclick: () => openPicker() }, icon('plus'), 'Add Node'));
  document.body.append(root);
  area.append(band);

  // ---------- view ----------
  const applyView = () => { world.style.transform = `translate(${tx}px, ${ty}px) scale(${k})`; };
  function fit() {
    const a = area.getBoundingClientRect();
    if (!g.nodes.length) { k = 0.85; tx = 20; ty = 20; applyView(); return; }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of g.nodes) {
      const el = world.querySelector(`[data-id="${n.id}"]`), hgt = el ? el.offsetHeight : 120;
      x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + NODE_W); y1 = Math.max(y1, n.y + hgt);
    }
    const pad = 24;
    k = Math.max(0.35, Math.min(1.1, (a.width - pad * 2) / (x1 - x0), (a.height - pad * 2 - 90) / (y1 - y0)));
    tx = pad - x0 * k + Math.max(0, (a.width - pad * 2 - (x1 - x0) * k) / 2);
    ty = pad - y0 * k;
    applyView(); drawLinks();
  }
  const toWorld = (cx, cy) => { const a = area.getBoundingClientRect(); return { x: (cx - a.left - tx) / k, y: (cy - a.top - ty) / k }; };
  function portPos(nodeId, port, dir) {
    const el = world.querySelector(`.port[data-node="${nodeId}"][data-port="${port}"][data-dir="${dir}"] i`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return toWorld(r.left + r.width / 2, r.top + r.height / 2);
  }

  // ---------- links ----------
  const curve = (a, b) => { const dx = Math.max(50, Math.abs(b.x - a.x) * 0.5); return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`; };
  let temp = null;
  function drawLinks() {
    const ns = 'http://www.w3.org/2000/svg';
    svg.replaceChildren();
    g.links.forEach((l, i) => {
      const a = portPos(l.from.node, l.from.port, 'out'), b = portPos(l.to.node, l.to.port, 'in');
      if (!a || !b) return;
      const from = g.nodes.find((n) => n.id === l.from.node), kind = from ? outKind(def(from)) : 'exec';
      const d = curve(a, b);
      const hit = document.createElementNS(ns, 'path');
      hit.setAttribute('d', d); hit.setAttribute('class', 'ne-hit'); hit.dataset.link = i;
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', d); p.setAttribute('class', 'ne-wire' + (kind === 'exec' ? ' exec' : '')); p.style.stroke = KIND_COLOR[kind];
      svg.append(hit, p);
    });
    if (temp) {
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', temp.dir === 'out' ? curve(temp.a, temp.b) : curve(temp.b, temp.a));
      p.setAttribute('class', 'ne-wire temp'); p.style.stroke = KIND_COLOR[temp.kind];
      svg.append(p);
    }
  }
  const portInfo = (el) => el && { node: el.dataset.node, port: el.dataset.port, dir: el.dataset.dir, kind: el.dataset.kind };
  function connect(a, b) {
    if (!a || !b || a.dir === b.dir || a.node === b.node) return false;
    if ((a.kind === 'exec') !== (b.kind === 'exec')) { toast(a.kind === 'exec' || b.kind === 'exec' ? 'White dots connect to white dots (the order things happen)' : 'Can’t connect those'); return false; }
    const [from, to] = a.dir === 'out' ? [a, b] : [b, a];
    snap();
    // one wire per data input and per exec output
    g.links = g.links.filter((l) => !(l.to.node === to.node && l.to.port === to.port && to.kind !== 'exec') && !(from.kind === 'exec' && l.from.node === from.node && l.from.port === from.port));
    g.links.push({ from: { node: from.node, port: from.port }, to: { node: to.node, port: to.port } });
    buzz(10); emit(); render();
    return true;
  }
  function setPending(p) {
    pending = p;
    for (const el of world.querySelectorAll('.port')) {
      const q = portInfo(el);
      el.classList.toggle('src', !!p && q.node === p.node && q.port === p.port && q.dir === p.dir);
      el.classList.toggle('can', !!p && q.node !== p.node && q.dir !== p.dir && (q.kind === 'exec') === (p.kind === 'exec'));
    }
    root.classList.toggle('linking', !!p);
    updateHint();
  }
  function tapPort(el) {
    const q = portInfo(el);
    if (pending) {
      if (q.node === pending.node && q.port === pending.port && q.dir === pending.dir) return setPending(null);
      if (connect(pending, q)) return setPending(null);
      if (q.dir === pending.dir) return setPending(q);
      return;
    }
    const wired = g.links.filter((l) => q.dir === 'in' ? l.to.node === q.node && l.to.port === q.port : l.from.node === q.node && l.from.port === q.port);
    if (wired.length && q.dir === 'in' && q.kind !== 'exec') { // tapping a wired input unplugs it
      snap(); g.links = g.links.filter((l) => !wired.includes(l)); emit(); render(); toast('Wire removed'); return;
    }
    setPending(q); buzz(6);
  }
  function updateHint() {
    hint.replaceChildren(...(pending
      ? [h('span', {}, 'Now tap a glowing dot to connect'), h('button', { onclick: () => setPending(null) }, 'Cancel')]
      : hasStats() ? [h('span', {}, 'From your last Play: ×N = times a node ran, = its last value. Faded nodes never ran.')]
      : [h('span', {}, g.nodes.length ? 'Tap a dot, then another dot to wire them · tap a wire to delete it' : 'Events (green) start a script · Actions (blue) do things')]));
  }

  // ---------- nodes ----------
  function field(n, spec) {
    const val = n.params?.[spec.key] ?? spec.default;
    const set = (v) => { (n.params ||= {})[spec.key] = v; emit(); };
    const pick = (list, none) => h('select', { onchange: (e) => set(e.target.value) },
      h('option', { value: '' }, none), list.map((o) => h('option', { value: o, selected: o === val }, o)));
    if (n.type === 'spawn' && spec.key === 'template') return pick(opts.templates || [], opts.templates?.length ? '— choose —' : '(no templates yet)');
    if (n.type === 'showHide' && spec.key === 'object') return pick((opts.objects || []).filter(Boolean), 'this object');
    if (spec.type === 'select') return h('select', { onchange: (e) => set(e.target.value) }, spec.options.map((o) => h('option', { value: o, selected: o === val }, o)));
    if (spec.type === 'bool') return h('input', { type: 'checkbox', checked: !!val, onchange: (e) => set(e.target.checked) });
    if (spec.type === 'longtext') return h('textarea', { rows: 3, spellcheck: true, oninput: (e) => set(e.target.value) }, val ?? '');
    if (spec.type === 'color') return h('input', { type: 'color', value: val || '#ffffff', oninput: (e) => set(e.target.value) });
    if (spec.type === 'number') return h('input', { type: 'text', inputMode: 'decimal', value: val ?? 0, oninput: (e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) set(v); } });
    const inp = h('input', { type: 'text', value: val ?? '', autocapitalize: 'off', spellcheck: false, oninput: (e) => set(e.target.value) });
    if (spec.key === 'name' && opts.vars?.length) { inp.setAttribute('list', 'ne-vars'); }
    return inp;
  }
  const port = (n, name, dir, kind, label) => h('span', { class: `port ${dir} k-${kind}`, 'data-node': n.id, 'data-port': name, 'data-dir': dir, 'data-kind': kind, title: label || name },
    h('i', { style: `--c:${KIND_COLOR[kind]}` }));
  const statOf = (n) => opts.stats?.(n.id);
  function nodeEl(n) {
    const d = def(n), linkedIn = (key) => g.links.some((l) => l.to.node === n.id && l.to.port === key);
    if (d.comment) { // a sticky note: no wires, just text
      return h('div', { class: 'ne-node ne-comment' + (selected === n.id ? ' sel' : ''), 'data-id': n.id, style: `left:${n.x}px;top:${n.y}px;width:${NODE_W}px` },
        h('div', { class: 'ne-head' }, h('span', { class: 'ne-name' }, '📝 Note'), h('button', { class: 'ne-more', title: 'Node menu', onclick: (e) => nodeMenu(n, e.currentTarget) }, icon('more'))),
        h('div', { class: 'ne-body' }, field(n, d.params[0])));
    }
    const st = statOf(n);
    const head = h('div', { class: 'ne-head', style: `background:${CAT_COLOR[d.cat] || '#555'}` },
      d.exec ? port(n, 'in', 'in', 'exec', 'in') : h('span', { class: 'port-sp' }),
      h('span', { class: 'ne-name' }, d.label),
      st?.runs ? h('span', { class: 'ne-stat', title: 'Times this ran in your last Play' }, d.value ? '= ' + fmtStat(st.value) : '×' + (st.runs > 999 ? Math.round(st.runs / 1000) + 'k' : st.runs)) : null,
      h('button', { class: 'ne-more', title: 'Node menu', onclick: (e) => nodeMenu(n, e.currentTarget) }, icon('more')));
    const rows = [];
    for (const o of d.outs || []) {
      if (o === 'then' && (d.outs.length === 1)) { head.insertBefore(port(n, o, 'out', 'exec', 'then'), head.lastChild); continue; }
      rows.push(h('div', { class: 'ne-row out' }, h('span', { class: 'lbl' }, o), port(n, o, 'out', 'exec', o)));
    }
    if (d.value) rows.push(h('div', { class: 'ne-row out' }, h('span', { class: 'lbl' }, d.value === 'bool' ? 'true / false' : d.value === 'text' ? 'text' : 'value'), port(n, 'value', 'out', d.value)));
    for (const inp of d.inputs || []) {
      const wired = linkedIn(inp.key);
      if (n.min && !wired) continue; // collapsed: only wired inputs keep their dot
      rows.push(h('div', { class: 'ne-row in' + (wired ? ' wired' : '') }, port(n, inp.key, 'in', inp.type, inp.key),
        h('span', { class: 'lbl' }, inp.key), wired ? h('span', { class: 'wired-tag' }, 'wired') : field(n, inp)));
    }
    if (n.min) { const sum = (d.params || []).map((p) => n.params?.[p.key]).filter((v) => v !== '' && v != null && typeof v !== 'object').slice(0, 3).join(' · '); if (sum) rows.push(h('div', { class: 'ne-row note ne-sum' }, String(sum).slice(0, 60))); }
    else for (const p of d.params || []) rows.push(h('div', { class: 'ne-row param' }, h('span', { class: 'lbl' }, p.label || p.key), field(n, p)));
    if (!rows.length && !n.min) rows.push(h('div', { class: 'ne-row note' }, NODE_HELP[n.type] || ''));
    if (n.off) rows.unshift(h('div', { class: 'ne-row note off-note' }, 'Turned off: the script passes straight through'));
    if (warn?.has(n.id)) rows.unshift(h('div', { class: 'ne-row note warn-note' }, icon('warn'), warn.get(n.id)));
    return h('div', { class: 'ne-node' + (selected === n.id ? ' sel' : '') + (multi.has(n.id) ? ' msel' : '') + (n.off ? ' off' : '') + (n.min ? ' min' : '') + (warn?.has(n.id) ? ' warn' : '') + (opts.stats && !st?.runs && !d.comment && hasStats() ? ' idle' : ''), 'data-id': n.id, style: `left:${n.x}px;top:${n.y}px;width:${NODE_W}px` }, head, h('div', { class: 'ne-body' }, rows));
  }
  function render() {
    for (const el of world.querySelectorAll('.ne-node')) el.remove();
    world.append(...g.nodes.map(nodeEl));
    empty.hidden = g.nodes.length > 0;
    setPending(pending && g.nodes.some((n) => n.id === pending.node) ? pending : null);
    requestAnimationFrame(drawLinks);
  }
  function nodeMenu(n, anchor) {
    popMenu(anchor, [
      { cap: def(n).label },
      { icon: 'copy', label: 'Duplicate', fn: () => { snap(); const c = JSON.parse(JSON.stringify(n)); c.id = nid(); c.x += 30; c.y += 40; g.nodes.push(c); selected = c.id; emit(); render(); } },
      { icon: 'copy', label: 'Copy', fn: () => copyNodes([n]) },
      def(n).outs?.length && { icon: 'copy', label: 'Copy From Here (whole chain)', fn: () => copyNodes(chainFrom(n)) },
      !def(n).comment && { icon: n.off ? 'eye' : 'eyeoff', label: n.off ? 'Turn On' : 'Turn Off (skip it)', fn: () => { snap(); n.off = !n.off; if (!n.off) delete n.off; emit(); render(); } },
      !def(n).comment && { icon: 'collapse', label: n.min ? 'Expand' : 'Collapse (smaller)', fn: () => { if (n.min) delete n.min; else n.min = true; emit(); render(); } },
      { icon: 'select', label: 'Select Several…', fn: () => { setSelMode(true); multi.add(n.id); refreshSel(); } },
      { icon: 'close', label: 'Remove Wires', fn: () => { snap(); g.links = g.links.filter((l) => l.from.node !== n.id && l.to.node !== n.id); emit(); render(); } },
      '-',
      { icon: 'trash', label: 'Delete Node', fn: () => { snap(); g.nodes = g.nodes.filter((q) => q !== n); g.links = g.links.filter((l) => l.from.node !== n.id && l.to.node !== n.id); if (selected === n.id) selected = null; emit(); render(); } },
    ]);
  }

  // ---------- select several ----------
  function setSelMode(on) {
    selMode = on; if (!on) multi.clear();
    root.classList.toggle('selecting', on); refreshSel();
    if (on) toast('Tap nodes to pick them, or drag a box around them');
  }
  function refreshSel() {
    selBar.hidden = !selMode;
    selCount.textContent = multi.size ? `${multi.size} selected` : 'Tap nodes or drag a box';
    for (const el of world.querySelectorAll('.ne-node')) el.classList.toggle('msel', multi.has(el.dataset.id));
  }
  function duplicateSel() {
    const L = g.nodes.filter((q) => multi.has(q.id)); if (!L.length) return;
    snap();
    const map = {}, ids = new Set(L.map((q) => q.id)), dy = Math.max(...L.map((q) => q.y)) - Math.min(...L.map((q) => q.y)) + 200;
    for (const q of L) { const id = nid(); map[q.id] = id; g.nodes.push({ ...JSON.parse(JSON.stringify(q)), id, y: q.y + dy }); }
    for (const l of g.links.filter((l) => ids.has(l.from.node) && ids.has(l.to.node))) g.links.push({ from: { node: map[l.from.node], port: l.from.port }, to: { node: map[l.to.node], port: l.to.port } });
    multi.clear(); for (const id of Object.values(map)) multi.add(id);
    emit(); render(); refreshSel(); toast(`Duplicated ${L.length} node${L.length > 1 ? 's' : ''}`);
  }

  // ---------- find, tidy, check ----------
  function focusNode(id) {
    const n = g.nodes.find((q) => q.id === id); if (!n) return;
    const A = area.getBoundingClientRect();
    k = Math.max(k, 0.7); tx = A.width / 2 - (n.x + NODE_W / 2) * k; ty = A.height / 3 - n.y * k; applyView(); drawLinks();
    selected = id; for (const el of world.querySelectorAll('.ne-node')) el.classList.toggle('sel', el.dataset.id === id);
    const el = world.querySelector(`[data-id="${id}"]`); if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  }
  const summary = (n) => (def(n).params || []).map((p) => n.params?.[p.key]).filter((v) => v !== '' && v != null && typeof v !== 'object').slice(0, 3).join(' · ');
  function sheet(titleText, build) {
    closePicker();
    const list = h('div', { class: 'ne-plist' });
    picker = h('div', { class: 'ne-picker', onpointerdown: (e) => { if (e.target === picker) closePicker(); } },
      h('div', { class: 'ne-psheet' }, h('div', { class: 'ne-phead' }, h('b', {}, titleText), h('small', {}), h('button', { class: 'ne-btn', onclick: closePicker }, icon('close'))), ...build(list)));
    root.append(picker);
    return list;
  }
  function openFind() {
    if (!g.nodes.length) { toast('No nodes yet'); return; }
    const search = h('input', { type: 'search', placeholder: `Find among ${g.nodes.length} nodes`, autocapitalize: 'off', oninput: () => draw() });
    const list = sheet('Find a node', (L) => [search, L]);
    function draw() {
      const q = search.value.trim().toLowerCase();
      const hits = g.nodes.filter((n) => { const d = def(n); return !q || d.label.toLowerCase().includes(q) || n.type.toLowerCase().includes(q) || summary(n).toLowerCase().includes(q) || d.cat?.toLowerCase().includes(q) || (NODE_HELP[n.type] || '').toLowerCase().includes(q); })
        .sort((a, b) => a.y - b.y || a.x - b.x);
      list.replaceChildren(...(hits.length ? [h('div', { class: 'ne-pgrid' }, hits.map((n) => { const d = def(n); return h('button', { class: 'ne-pitem', style: `--c:${CAT_COLOR[d.cat] || '#666'}`, onclick: () => { closePicker(); focusNode(n.id); } },
        h('b', {}, d.comment ? '📝 ' + String(n.params?.text || 'Note').slice(0, 30) : d.label), h('em', { class: 'ne-pcatname', style: `color:${CAT_COLOR[d.cat] || '#999'}` }, d.cat || ''), h('small', {}, (n.off ? 'off · ' : '') + summary(n))); }))] : [h('div', { class: 'ne-pnone' }, 'Nothing matches')]));
    }
    draw(); setTimeout(() => search.focus(), 50);
  }
  /** Lays scripts out left to right in the order they run: one band per event, value nodes under the node they feed. */
  function tidy() {
    if (!g.nodes.length) return;
    snap();
    const byId = new Map(g.nodes.map((n) => [n.id, n])), isVal = (n) => !!def(n).value, H = (n) => world.querySelector(`[data-id="${n.id}"]`)?.offsetHeight || 140;
    const execOut = (id) => g.links.filter((l) => l.from.node === id && l.from.port !== 'value').map((l) => byId.get(l.to.node)).filter(Boolean);
    const hasExecIn = (n) => g.links.some((l) => l.to.node === n.id && l.from.port !== 'value' && byId.has(l.from.node) && !isVal(byId.get(l.from.node)));
    const feeders = (id) => g.links.filter((l) => l.to.node === id && l.from.port === 'value').map((l) => byId.get(l.from.node)).filter(Boolean);
    const roots = g.nodes.filter((n) => !isVal(n) && !def(n).comment && !hasExecIn(n)).sort((a, b) => a.y - b.y || a.x - b.x);
    const done = new Set(), GAPX = 80, GAPY = 30;
    let top = 40;
    const placeBand = (start) => {
      const cols = new Map(), queue = [[start, 0]];
      while (queue.length) {
        const [n, c] = queue.shift(); if (done.has(n.id)) continue; done.add(n.id);
        (cols.get(c) || cols.set(c, []).get(c)).push(n);
        const addFeeders = (m, depth) => { if (depth > 6) return; for (const f of feeders(m.id)) if (!done.has(f.id)) { done.add(f.id); cols.get(c).push(f); addFeeders(f, depth + 1); } };
        addFeeders(n, 0);
        for (const m of execOut(n.id)) if (!done.has(m.id)) queue.push([m, c + 1]);
      }
      let bandH = 0;
      for (const [c, list] of cols) { let y = top; for (const n of list) { n.x = 40 + c * (NODE_W + GAPX); n.y = y; y += H(n) + GAPY; } bandH = Math.max(bandH, y - top); }
      top += bandH + 50;
    };
    for (const r of roots) if (!done.has(r.id)) placeBand(r);
    for (const n of g.nodes) if (!done.has(n.id) && !def(n).comment) placeBand(n); // loops and loose value nodes
    let cy = 40; for (const n of g.nodes.filter((q) => def(q).comment)) { n.x = -NODE_W - GAPX; n.y = cy; cy += H(n) + GAPY; } // notes in a column on the left
    emit(); render(); requestAnimationFrame(fit); toast('Tidied up');
  }
  function checkProblems() {
    const byId = new Map(g.nodes.map((n) => [n.id, n])), W = new Map();
    for (const n of g.nodes) {
      const d = def(n);
      if (!NODE_TYPES[n.type]) { W.set(n.id, 'Unknown node (from a newer version?)'); continue; }
      if (d.comment) continue;
      if (n.off) W.set(n.id, 'Turned off: it is skipped');
      else if (d.value && !g.links.some((l) => l.from.node === n.id)) W.set(n.id, 'Its value isn’t wired to anything');
      else if (d.exec && !g.links.some((l) => l.to.node === n.id && l.to.port === 'in')) W.set(n.id, 'Never runs: nothing is wired into its white dot');
      else if (!d.exec && !d.value && (d.outs || []).length && !g.links.some((l) => l.from.node === n.id)) W.set(n.id, 'Does nothing yet: wire something to it');
      for (const l of g.links) if (l.to.node === n.id && !byId.has(l.from.node)) W.set(n.id, 'A wire comes from a node that was removed');
    }
    warn = W.size ? W : null; render();
    if (!W.size) { toast('No problems found ✓'); return; }
    const list = sheet(`${W.size} thing${W.size > 1 ? 's' : ''} to check`, (L) => [L]);
    list.replaceChildren(h('div', { class: 'ne-pgrid' }, [...W].map(([id, why]) => { const n = byId.get(id), d = def(n); return h('button', { class: 'ne-pitem', style: `--c:${CAT_COLOR[d.cat] || '#c77'}`, onclick: () => { closePicker(); focusNode(id); } }, h('b', {}, d.label || n.type), h('small', {}, why)); })));
  }
  function moreMenu(anchor) {
    const anyMin = g.nodes.some((n) => n.min);
    popMenu(anchor, [
      { icon: 'select', label: selMode ? 'Stop Selecting' : 'Select Several…', fn: () => setSelMode(!selMode) },
      { icon: 'tidy', label: 'Tidy Up (arrange in order)', fn: tidy },
      { icon: 'warn', label: 'Check for Problems', fn: checkProblems },
      { icon: 'collapse', label: anyMin ? 'Expand All' : 'Collapse All', fn: () => { for (const n of g.nodes) { if (anyMin) delete n.min; else if (!def(n).comment) n.min = true; } emit(); render(); } },
      { icon: 'frame', label: 'Fit All Nodes', fn: () => fit() },
      '-',
      { icon: 'star', label: 'Ready-made Scripts…', fn: () => templateMenu(anchor) },
      { icon: 'save', label: 'Save / Reuse Script…', fn: () => scriptMenu(anchor) },
    ]);
  }

  // ---------- copy / paste nodes (works between scripts and games on this device) ----------
  const CLIP = 'pocket.nodeClip';
  const clip = () => { try { const c = JSON.parse(localStorage.getItem(CLIP) || 'null'); return c?.nodes?.length ? c : null; } catch { return null; } };
  /** A node, everything its white wires lead to, and the value nodes feeding them. */
  function chainFrom(n) {
    const set = new Set([n.id]), queue = [n.id];
    while (queue.length) { const id = queue.shift(); for (const l of g.links) if (l.from.node === id && !set.has(l.to.node)) { set.add(l.to.node); queue.push(l.to.node); } }
    let grew = true; while (grew) { grew = false; for (const l of g.links) if (set.has(l.to.node) && !set.has(l.from.node) && def(g.nodes.find((q) => q.id === l.from.node) || {}).value) { set.add(l.from.node); grew = true; } }
    return g.nodes.filter((q) => set.has(q.id));
  }
  function copyNodes(list) {
    const ids = new Set(list.map((q) => q.id));
    try { localStorage.setItem(CLIP, JSON.stringify({ nodes: list, links: g.links.filter((l) => ids.has(l.from.node) && ids.has(l.to.node)) })); } catch { /* storage full */ }
    toast(list.length === 1 ? 'Node copied: paste it from Add Node' : `${list.length} nodes copied: paste them from Add Node`);
  }
  function paste() {
    const c = clip(); if (!c) return;
    snap();
    const A = area.getBoundingClientRect(), minX = Math.min(...c.nodes.map((q) => q.x)), minY = Math.min(...c.nodes.map((q) => q.y)), map = {};
    const cx = g.nodes.length ? Math.min(...g.nodes.map((q) => q.x)) : (A.width / 2 - tx) / k, cy = g.nodes.length ? Math.max(...g.nodes.map((q) => q.y)) + 260 : (A.height / 3 - ty) / k; // below everything, so nothing overlaps
    for (const q of c.nodes) { const id = nid(); map[q.id] = id; g.nodes.push({ ...JSON.parse(JSON.stringify(q)), id, x: Math.round(cx + q.x - minX), y: Math.round(cy + q.y - minY) }); }
    for (const l of c.links) g.links.push({ from: { node: map[l.from.node], port: l.from.port }, to: { node: map[l.to.node], port: l.to.port } });
    selected = map[c.nodes[0].id]; emit(); render(); toast(`Pasted ${c.nodes.length} node${c.nodes.length > 1 ? 's' : ''}`);
    const n0 = g.nodes.find((q) => q.id === selected); if (n0) { tx = A.width / 2 - (n0.x + NODE_W / 2) * k; ty = A.height / 3 - n0.y * k; applyView(); drawLinks(); } // show them
  }
  function templateMenu(anchor) {
    const mine = opts.scripts?.() || [];
    popMenu(anchor, [
      ...(mine.length ? [{ cap: 'My saved scripts' }, ...mine.map((q) => ({ icon: 'nodes', label: q.here ? q.name : `${q.name} (other game)`, fn: () => addTemplate({ label: q.name, ...q.graph }) }))] : []),
      { cap: 'Add a ready-made script' }, ...GRAPH_TEMPLATES.map((t) => ({ icon: 'star', label: t.label, fn: () => addTemplate(t) }))]);
  }
  function scriptMenu(anchor) {
    const L = opts.linked?.();
    popMenu(anchor, L ? [
      { cap: `Linked: “${L.name}” · ${L.uses} cop${L.uses === 1 ? 'y' : 'ies'}` },
      { icon: 'info', label: 'Edits here update every copy', fn: () => toast(`Every object using “${L.name}” gets these changes`) },
      { icon: 'unlink', label: 'Unlink (edit this one only)', fn: () => { opts.unlink?.(); toast('Unlinked'); } },
      { icon: 'save', label: 'Save as a New Script…', fn: () => saveAs() },
    ] : [
      { cap: 'Reuse this script' },
      { icon: 'save', label: 'Save as Reusable Script…', fn: () => saveAs() },
      { icon: 'nodes', label: 'Insert a Saved Script…', fn: () => templateMenu(anchor) },
    ]);
  }
  function saveAs() {
    if (!g.nodes.length) { toast('Add some nodes first'); return; }
    const name = prompt('Name this script so you can reuse it on other objects', opts.title ? `${opts.title} script` : 'My script');
    if (name?.trim()) opts.saveScript?.(name.trim(), JSON.parse(JSON.stringify(g)));
  }
  function addTemplate(t) {
    snap();
    const map = {}, oy = g.nodes.length ? Math.max(...g.nodes.map((n) => n.y)) + 220 : 40;
    for (const n of t.nodes) {
      const id = nid(); map[n.id] = id;
      const d = NODE_TYPES[n.type] || {}, params = {};
      for (const q of [...(d.params || []), ...(d.inputs || [])]) params[q.key] = q.default;
      g.nodes.push({ id, type: n.type, x: n.x + 40, y: n.y + oy, params: { ...params, ...(n.params || {}) } });
    }
    for (const l of t.links || []) {
      const [a, port, b, to = 'in'] = Array.isArray(l) ? l : [l.from.node, l.from.port, l.to.node, l.to.port];
      if (map[a] && map[b]) g.links.push({ from: { node: map[a], port }, to: { node: map[b], port: to } });
    }
    emit(); render(); requestAnimationFrame(fit); toast(`Added “${t.label}”`);
  }

  // ---------- add node ----------
  function addNode(type) {
    const d = NODE_TYPES[type], a = area.getBoundingClientRect();
    const sel = g.nodes.find((n) => n.id === selected);
    const c = toWorld(a.left + a.width / 2 - NODE_W * k / 2, a.top + a.height * 0.35);
    const n = { id: nid(), type, x: Math.round(c.x), y: Math.round(c.y), params: {} };
    for (const p of [...(d.params || []), ...(d.inputs || [])]) n.params[p.key] = p.default;
    snap();
    let link = null;
    if (sel) { // auto-wire to the selected node so scripts grow in a chain
      const sd = def(sel);
      if (d.exec && (sd.outs || []).length) {
        const free = sd.outs.find((o) => !g.links.some((l) => l.from.node === sel.id && l.from.port === o));
        if (free) { link = { from: { node: sel.id, port: free }, to: { node: n.id, port: 'in' } }; n.x = sel.x + NODE_W + 50; n.y = sel.y; }
      } else if (d.value) {
        const free = (sd.inputs || []).find((i) => !g.links.some((l) => l.to.node === sel.id && l.to.port === i.key));
        if (free) { link = { from: { node: n.id, port: 'value' }, to: { node: sel.id, port: free.key } }; n.x = sel.x - NODE_W - 50; n.y = sel.y + 60; }
      }
    }
    // slide down until it doesn't cover another node
    const estH = 56 + 46 * (((d.outs || []).length > 1 ? d.outs.length : 0) + (d.value ? 1 : 0) + (d.inputs || []).length + (d.params || []).length || 1);
    const rectOf = (q) => { const el = world.querySelector(`[data-id="${q.id}"]`); return { x: q.x, y: q.y, h: el ? el.offsetHeight : 150 }; };
    for (let tries = 0; tries < 50; tries++) {
      const r = g.nodes.map(rectOf).find((q) => n.x < q.x + NODE_W + 16 && n.x + NODE_W + 16 > q.x && n.y < q.y + q.h + 16 && n.y + estH + 16 > q.y);
      if (!r) break;
      n.y = r.y + r.h + 30;
    }
    g.nodes.push(n);
    if (link) g.links.push(link);
    selected = n.id;
    emit(); render();
    toast(link ? `Added ${d.label} and wired it up` : `Added ${d.label}`);
    // keep the new node on screen
    requestAnimationFrame(() => {
      const el = world.querySelector(`[data-id="${n.id}"]`); if (!el) return;
      const r = el.getBoundingClientRect(), A = area.getBoundingClientRect();
      if (r.right > A.right - 10) tx -= r.right - A.right + 20;
      if (r.left < A.left + 10) tx += A.left - r.left + 20;
      if (r.bottom > A.bottom - 90) ty -= r.bottom - A.bottom + 100;
      if (r.top < A.top + 10) ty += A.top - r.top + 20;
      applyView(); drawLinks();
    });
  }
  let picker = null;
  /** Add Node: search, "suggested next", recently used, then category folders (tap one to open it). */
  function openPicker() {
    closePicker();
    const sel = g.nodes.find((n) => n.id === selected), sd = sel && def(sel);
    let folder = null;
    const list = h('div', { class: 'ne-plist' });
    const search = h('input', { type: 'search', placeholder: `Search ${Object.keys(NODE_TYPES).length} nodes`, autocapitalize: 'off', oninput: () => draw() });
    const match = (t, d, q) => d.label.toLowerCase().includes(q) || t.toLowerCase().includes(q) || (NODE_HELP[t] || '').toLowerCase().includes(q) || d.cat.toLowerCase().includes(q);
    const item = (t, showCat) => { const d = NODE_TYPES[t]; return h('button', { class: 'ne-pitem', 'data-type': t, style: `--c:${CAT_COLOR[d.cat]}`, onclick: () => { closePicker(); rememberNode(t); addNode(t); } },
      h('b', {}, d.label), showCat ? h('em', { class: 'ne-pcatname', style: `color:${CAT_COLOR[d.cat]}` }, d.cat) : null, h('small', {}, NODE_HELP[t] || '')); };
    const section = (title, types, showCat, sub) => types.length ? [h('div', { class: 'ne-pcat' }, title, sub ? h('small', {}, sub) : null), h('div', { class: 'ne-pgrid' }, types.map((t) => item(t, showCat)))] : [];
    function suggestions() {
      if (!sd) return g.nodes.some((n) => !NODE_TYPES[n.type]?.exec && !NODE_TYPES[n.type]?.value) ? [] : NEXT._events;
      const freeIn = (sd.inputs || []).find((i) => !g.links.some((l) => l.to.node === sel.id && l.to.port === i.key));
      const out = [...(NEXT[sel.type] || []), ...((sd.outs || []).length ? NEXT._exec : []), ...(freeIn ? NEXT['_' + freeIn.type] || [] : [])];
      return [...new Set(out)].filter((t) => NODE_TYPES[t]).slice(0, 8);
    }
    function draw() {
      const q = search.value.trim().toLowerCase();
      back.hidden = !folder || !!q;
      title.textContent = q ? 'Search' : folder || 'Add Node';
      if (q) {
        const hits = Object.entries(NODE_TYPES).filter(([t, d]) => match(t, d, q)).map(([t]) => t);
        list.replaceChildren(...(hits.length ? section(`${hits.length} found`, hits, true) : [h('div', { class: 'ne-pnone' }, `No node matches “${search.value}”`)]));
        return;
      }
      if (folder) {
        list.replaceChildren(h('div', { class: 'ne-pcat' }, h('i', { style: `background:${CAT_COLOR[folder]}` }), CAT_HELP[folder] || ''),
          h('div', { class: 'ne-pgrid' }, Object.entries(NODE_TYPES).filter(([, d]) => d.cat === folder).map(([t]) => item(t))));
        list.scrollTop = 0;
        return;
      }
      const recent = recentNodes(), c = clip();
      list.replaceChildren(
        ...(c ? [h('button', { class: 'ne-paste', onclick: () => { closePicker(); paste(); } }, icon('paste'), h('b', {}, `Paste ${c.nodes.length} copied node${c.nodes.length > 1 ? 's' : ''}`), h('small', {}, c.nodes.slice(0, 3).map((q) => NODE_TYPES[q.type]?.label).filter(Boolean).join(' → ') + (c.nodes.length > 3 ? ' …' : '')))] : []),
        ...section(sd ? 'Suggested next' : 'Start with an event', suggestions(), true, sd ? `after “${sd.label}”` : 'green nodes start a script'),
        ...section('Recently used', recent, true),
        h('div', { class: 'ne-pcat' }, 'All nodes', h('small', {}, 'by category')),
        h('div', { class: 'ne-folders' }, CATS.map((cat) => {
          const n = Object.values(NODE_TYPES).filter((d) => d.cat === cat).length;
          return h('button', { class: 'ne-folder', 'data-cat': cat, style: `--c:${CAT_COLOR[cat]}`, onclick: () => { folder = cat; draw(); } },
            h('span', { class: 'ne-ficon' }, icon(CAT_ICON[cat] || 'folder')), h('b', {}, cat), h('small', {}, CAT_HELP[cat]), h('em', {}, String(n)));
        })));
    }
    const back = h('button', { class: 'ne-btn', title: 'Back', onclick: () => { folder = null; draw(); } }, icon('left'));
    const title = h('b', {}, 'Add Node');
    picker = h('div', { class: 'ne-picker', onpointerdown: (e) => { if (e.target === picker) closePicker(); } },
      h('div', { class: 'ne-psheet' },
        h('div', { class: 'ne-phead' }, back, title, sel ? h('small', {}, `wires to “${def(sel).label}”`) : h('small', {}), h('button', { class: 'ne-btn', onclick: closePicker }, icon('close'))),
        search, list));
    draw();
    root.append(picker);
  }
  function closePicker() { picker?.remove(); picker = null; }

  // ---------- gestures ----------
  const ptrs = new Map();
  let drag = null; // {type:'pan'|'node'|'port'|'wire', ...}
  let pinch = null;
  area.addEventListener('pointerdown', (e) => {
    if (e.target.closest('input, select, textarea, button')) return;
    area.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k, tx, ty, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      drag = null; temp = null; drawLinks();
      return;
    }
    const portEl = e.target.closest('.port'), nodeEl = e.target.closest('.ne-node'), hit = e.target.closest('.ne-hit');
    const base = { x: e.clientX, y: e.clientY, moved: false };
    if (portEl) drag = { ...base, type: 'port', el: portEl };
    else if (nodeEl) {
      const n = g.nodes.find((q) => q.id === nodeEl.dataset.id);
      const group = selMode && multi.has(n.id) ? g.nodes.filter((q) => multi.has(q.id)).map((q) => ({ n: q, x: q.x, y: q.y, el: world.querySelector(`[data-id="${q.id}"]`) })) : null; // dragging a picked node moves all of them
      drag = { ...base, type: 'node', n, el: nodeEl, nx: n.x, ny: n.y, group };
    }
    else if (hit) drag = { ...base, type: 'wire', i: +hit.dataset.link, tx, ty };
    else drag = { ...base, type: selMode ? 'box' : 'pan', tx, ty };
  });
  area.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      const nk = Math.max(0.3, Math.min(2, pinch.k * Math.hypot(a.x - b.x, a.y - b.y) / (pinch.d || 1)));
      const A = area.getBoundingClientRect(), cx = pinch.cx - A.left, cy = pinch.cy - A.top;
      const mx = (a.x + b.x) / 2 - pinch.cx, my = (a.y + b.y) / 2 - pinch.cy;
      tx = cx - (cx - pinch.tx) * nk / pinch.k + mx; ty = cy - (cy - pinch.ty) * nk / pinch.k + my; k = nk;
      applyView();
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 8) return;
    if (!drag.moved && drag.type === 'node') snap(); // moving nodes can be undone
    drag.moved = true;
    if (drag.type === 'pan' || drag.type === 'wire') { tx = drag.tx + dx; ty = drag.ty + dy; applyView(); }
    else if (drag.type === 'node' && drag.group) { for (const q of drag.group) { q.n.x = Math.round(q.x + dx / k); q.n.y = Math.round(q.y + dy / k); if (q.el) { q.el.style.left = q.n.x + 'px'; q.el.style.top = q.n.y + 'px'; } } drawLinks(); }
    else if (drag.type === 'node') { drag.n.x = Math.round(drag.nx + dx / k); drag.n.y = Math.round(drag.ny + dy / k); drag.el.style.left = drag.n.x + 'px'; drag.el.style.top = drag.n.y + 'px'; drawLinks(); }
    else if (drag.type === 'box') { const A = area.getBoundingClientRect(), x0 = Math.min(drag.x, e.clientX) - A.left, y0 = Math.min(drag.y, e.clientY) - A.top; band.hidden = false; Object.assign(band.style, { left: x0 + 'px', top: y0 + 'px', width: Math.abs(dx) + 'px', height: Math.abs(dy) + 'px' }); }
    else if (drag.type === 'port') {
      const q = portInfo(drag.el), a = portPos(q.node, q.port, q.dir);
      temp = { a, b: toWorld(e.clientX, e.clientY), dir: q.dir, kind: q.kind };
      if (!pending || pending.node !== q.node || pending.port !== q.port) setPending(q);
      drawLinks();
    }
  });
  const up = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (pinch) { if (ptrs.size < 2) pinch = null; drag = null; return; }
    const d = drag; drag = null;
    if (!d || e.type === 'pointercancel') { temp = null; drawLinks(); return; }
    if (d.type === 'port') {
      if (!d.moved) { tapPort(d.el); return; }
      temp = null;
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.port');
      if (!(target && connect(portInfo(d.el), portInfo(target)))) drawLinks();
      setPending(null);
    } else if (d.type === 'box') {
      band.hidden = true;
      if (d.moved) { const a = toWorld(Math.min(d.x, e.clientX), Math.min(d.y, e.clientY)), b = toWorld(Math.max(d.x, e.clientX), Math.max(d.y, e.clientY));
        for (const n of g.nodes) { const hgt = world.querySelector(`[data-id="${n.id}"]`)?.offsetHeight || 120; if (n.x < b.x && n.x + NODE_W > a.x && n.y < b.y && n.y + hgt > a.y) multi.add(n.id); }
        refreshSel(); }
    } else if (d.type === 'node') {
      if (d.moved) { emit(); return; }
      if (selMode) { if (multi.has(d.n.id)) multi.delete(d.n.id); else multi.add(d.n.id); refreshSel(); return; }
      selected = selected === d.n.id ? null : d.n.id;
      for (const el of world.querySelectorAll('.ne-node')) el.classList.toggle('sel', el.dataset.id === selected);
    } else if (d.type === 'wire' && !d.moved) {
      const l = g.links[d.i];
      if (l) popMenu({ left: e.clientX - 60, top: e.clientY - 10, bottom: e.clientY + 10 }, [{ icon: 'trash', label: 'Delete Wire', fn: () => { snap(); g.links = g.links.filter((q) => q !== l); emit(); render(); } }]);
    } else if (d.type === 'pan' && !d.moved) {
      if (pending) setPending(null);
      else if (selected) { selected = null; for (const el of world.querySelectorAll('.ne-node.sel')) el.classList.remove('sel'); }
    }
  };
  area.addEventListener('pointerup', up);
  area.addEventListener('pointercancel', up);

  // variable suggestions for "variable" fields
  if (opts.vars?.length) root.append(h('datalist', { id: 'ne-vars' }, opts.vars.map((v) => h('option', { value: v }))));

  // keyboard (tablets with keyboards, computers): undo / redo, delete, copy / paste, find
  const onKey = (e) => {
    if (e.target.closest?.('input, textarea, select')) return;
    const mod = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
    if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) restore(redo, undo); else restore(undo, redo); }
    else if (mod && key === 'y') { e.preventDefault(); restore(redo, undo); }
    else if (mod && key === 'f') { e.preventDefault(); openFind(); }
    else if (mod && key === 'c') { const L = g.nodes.filter((q) => multi.has(q.id) || q.id === selected); if (L.length) copyNodes(L); }
    else if (mod && key === 'v') paste();
    else if (mod && key === 'a') { e.preventDefault(); if (!selMode) setSelMode(true); for (const n of g.nodes) multi.add(n.id); refreshSel(); }
    else if (key === 'delete' || key === 'backspace') { const ids = new Set(multi.size ? multi : selected ? [selected] : []); if (!ids.size) return; snap(); g.nodes = g.nodes.filter((q) => !ids.has(q.id)); g.links = g.links.filter((l) => !ids.has(l.from.node) && !ids.has(l.to.node)); multi.clear(); selected = null; emit(); render(); refreshSel(); }
    else if (key === 'escape') { if (picker) closePicker(); else if (selMode) setSelMode(false); else if (pending) setPending(null); }
  };
  window.addEventListener('keydown', onKey);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKey);
    closePicker();
    root.remove();
    opts.onClose?.();
  }
  render();
  requestAnimationFrame(() => fit());
  return { close };
}
