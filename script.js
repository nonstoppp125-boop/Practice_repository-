/* ==========================================================
   script.js  |  Futuristic Data Analyst Learning Portfolio
   ORANGE THEME, STRETCHY BOXES, RGB PAUSING, ROPE LIGHT, 3D DESK
   ----------------------------------------------------------
   WHAT THIS FILE DOES
   1. Mobile menu, active menu link, footer year, scroll reveal.
   2. Stretchy boxes: press and drag any card, button or heading and it
      stretches like rubber, then springs back.
   3. Pauses the RGB border animation on things that are off screen.
   4. The HTML rope light switch (drag down or tap).
   5. Loads Three.js and builds a 3D desk scene in code, with many
      objects you can tap, and a lamp with a pull rope.
   6. Moves the 3D camera a little as the page scrolls.

   BEGINNER NOTES
   - Settings you can safely change are in the CONFIG block.
   - Everything is wrapped in one function so it does not clash
     with anything else on the page.
   - If something is missing from the HTML, that feature is skipped.
   - Lines starting with two slashes are comments.
   ========================================================== */
(function () {
  'use strict';

  /* Protect against running twice. */
  if (document.documentElement.dataset.portfolioInit === '1') {
    return;
  }
  document.documentElement.dataset.portfolioInit = '1';


  /* ========================================================
     SECTION 1 - CONFIG (safe to edit)
     ======================================================== */
  var CONFIG = {
    threeUrlFallback: 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
    loadTimeoutMs: 15000,

    maxPixelRatio: 2,
    maxPixelRatioSmall: 1.5,

    particleCount: 110,
    particleCountSmall: 45,

    parallaxStrength: 0.6,         // camera follows the mouse
    scrollStrength: 1,             // camera moves while scrolling (0 = off)
    idleSway: 0.1,
    floatAmount: 0.06,

    lampIntensity: 16,
    tapMovePx: 10,
    tapMaxMs: 700,

    camera: { x: 0, y: 2.8, z: 9.2 },
    lookAt: { x: 0, y: 1.8, z: 0 },

    // Stretchy boxes
    stretchHoldMs: 160,            // touch: hold this long before stretching starts
    stretchStrength: 0.5,          // how stretchy (0 = off, 1 = very stretchy)
    stretchMaxScale: 1.18,
    stretchMaxMove: 24,            // pixels

    smallScreenQuery: '(max-width: 40em)',
    desktopNavQuery: '(min-width: 62em)',
    debugParam: 'debug'
  };

  /* Elements that can be pressed and stretched. Keep in step with style.css. */
  var STRETCH_SELECTOR = [
    '.card', '.button', '.scene-objects__button', '.skill-list__item',
    '.status-badge', '.link-placeholder', '.back-to-top', '.brand',
    '.nav-toggle', '.scene-description', '.hero__title', '.hero__lead',
    '.hero__eyebrow', '.section__title', '.section__intro', '.site-footer__identity'
  ].join(',');

  /* Elements that have the rainbow ring. Keep in step with style.css Section 3B. */
  var RGB_SELECTOR = [
    '.card', '.scene', '.scene-controls', '.scene-objects__button',
    '.scene-description', '.skill-list__item', '.status-badge',
    '.link-placeholder', '.nav-toggle', '.brand__mark', '.back-to-top',
    '.button', '.light-rope'
  ].join(',');


  /* ========================================================
     SECTION 2 - SMALL HELPERS
     ======================================================== */
  function $(selector, root) {
    return (root || document).querySelector(selector);
  }
  function $all(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function media(query) {
    return window.matchMedia ? window.matchMedia(query) : { matches: false, addEventListener: function () {} };
  }
  function onMediaChange(mql, handler) {
    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
    } else if (mql.addListener) {
      mql.addListener(handler);
    }
  }

  var reducedMotionQuery = media('(prefers-reduced-motion: reduce)');
  var reducedMotion = reducedMotionQuery.matches;
  onMediaChange(reducedMotionQuery, function () {
    reducedMotion = reducedMotionQuery.matches;
    if (sceneApi) { sceneApi.setReducedMotion(reducedMotion); }
  });

  var sceneApi = null; // filled in when the 3D scene is running


  /* ========================================================
     SECTION 3 - PAGE STATE
     ======================================================== */
  function markJsReady() {
    document.body.classList.remove('no-js');
    document.body.classList.add('js-ready');
  }


  /* ========================================================
     SECTION 4 - MOBILE NAVIGATION
     ======================================================== */
  function initMobileNav() {
    var toggle = $('#nav-toggle');
    var nav = $('#site-nav');
    if (!toggle || !nav) { return; }

    var desktopQuery = media(CONFIG.desktopNavQuery);

    function isOpen() {
      return toggle.getAttribute('aria-expanded') === 'true';
    }
    function setOpen(open) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      nav.classList.toggle('is-open', open);
    }

    toggle.addEventListener('click', function () { setOpen(!isOpen()); });

    nav.addEventListener('click', function (event) {
      var link = event.target.closest ? event.target.closest('a') : null;
      if (link) { setOpen(false); }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen()) {
        setOpen(false);
        toggle.focus();
      }
    });

    document.addEventListener('click', function (event) {
      if (!isOpen()) { return; }
      if (nav.contains(event.target) || toggle.contains(event.target)) { return; }
      setOpen(false);
    });

    onMediaChange(desktopQuery, function () {
      if (desktopQuery.matches) { setOpen(false); }
    });

    setOpen(false);
  }


  /* ========================================================
     SECTION 5 - HEADER SHADOW AND ACTIVE NAV LINK
     ======================================================== */
  function initScrollState() {
    var header = $('#site-header');
    var links = $all('[data-nav-link]');
    var items = [];

    links.forEach(function (link) {
      var hash = link.getAttribute('href');
      if (!hash || hash.charAt(0) !== '#' || hash.length < 2) { return; }
      var section = document.getElementById(hash.slice(1));
      if (section) { items.push({ link: link, section: section }); }
    });

    var ticking = false;

    function update() {
      ticking = false;
      if (header) {
        header.classList.toggle('is-scrolled', window.scrollY > 8);
      }
      if (!items.length) { return; }

      var line = (header ? header.offsetHeight : 0) + window.innerHeight * 0.35;
      var current = items[0];
      items.forEach(function (item) {
        if (item.section.getBoundingClientRect().top <= line) { current = item; }
      });

      var atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) { current = items[items.length - 1]; }

      items.forEach(function (item) {
        var active = item === current;
        item.link.classList.toggle('is-active', active);
        if (active) {
          item.link.setAttribute('aria-current', 'page');
        } else {
          item.link.removeAttribute('aria-current');
        }
      });
    }

    function request() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }

    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    update();
  }


  /* ========================================================
     SECTION 6 - FOOTER YEAR, EXTERNAL LINKS, BACK TO TOP
     ======================================================== */
  function initFooterYear() {
    var el = $('#footer-year');
    if (el) { el.textContent = String(new Date().getFullYear()); }
  }

  function secureExternalLinks() {
    $all('a[target="_blank"]').forEach(function (a) {
      var rel = (a.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
      ['noopener', 'noreferrer'].forEach(function (value) {
        if (rel.indexOf(value) === -1) { rel.push(value); }
      });
      a.setAttribute('rel', rel.join(' '));
    });
  }

  function initBackToTop() {
    var link = $('#back-to-top');
    var home = $('#home');
    if (!link || !home) { return; }
    link.addEventListener('click', function () {
      home.setAttribute('tabindex', '-1');
      home.focus({ preventScroll: true });
    });
  }


  /* ========================================================
     SECTION 7 - SCROLL REVEAL
     ======================================================== */
  function initReveal() {
    var items = $all('[data-reveal]');
    if (!items.length) { return; }

    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    items.forEach(function (el) { observer.observe(el); });
  }


  /* ========================================================
     SECTION 8 - RGB RING PAUSING
     The rainbow border only animates while it is on screen.
     Each element also gets a different starting angle so they do
     not all look the same.
     ======================================================== */
  function initRgbPause() {
    var items = $all(RGB_SELECTOR);
    if (!items.length) { return; }

    items.forEach(function (el) {
      el.style.animationDelay = (-Math.random() * 7).toFixed(2) + 's';
    });

    if (!('IntersectionObserver' in window)) { return; }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        entry.target.classList.toggle('is-rgb-paused', !entry.isIntersecting);
      });
    }, { rootMargin: '80px' });

    items.forEach(function (el) { observer.observe(el); });
  }


  /* ========================================================
     SECTION 9 - STRETCHY BOXES
     Press any element in STRETCH_SELECTOR and drag: it stretches
     like rubber. Let go and it springs back (the spring is in
     style.css as .is-stretch-release).

     Mouse: starts at once.
     Touch: starts after a short hold (stretchHoldMs). If the finger
     moves before that, it is a normal page scroll and nothing stretches.
     Only the CSS properties "translate" and "scale" are used, so they
     never fight with the hover lift or the reveal animation.
     ======================================================== */
  var suppressClickUntil = 0;

  function initStretch() {
    if (!('PointerEvent' in window) || CONFIG.stretchStrength <= 0) { return; }

    var active = null;

    function release(state) {
      if (!state) { return; }
      window.clearTimeout(state.timer);
      var el = state.el;
      el.classList.remove('is-stretching');
      el.classList.add('is-stretch-release');
      el.style.translate = '';
      el.style.scale = '';
      window.setTimeout(function () { el.classList.remove('is-stretch-release'); }, 750);
      if (state.dragged) { suppressClickUntil = performance.now() + 350; }
    }

    function apply(state, dx, dy) {
      var rect = state.rect;
      var ax = Math.min(Math.abs(dx) / Math.max(rect.width, 60), 0.5);
      var ay = Math.min(Math.abs(dy) / Math.max(rect.height, 40), 0.5);
      var k = CONFIG.stretchStrength;
      var sx = clamp(1 + ax * k - ay * k * 0.15, 0.9, CONFIG.stretchMaxScale);
      var sy = clamp(1 + ay * k - ax * k * 0.15, 0.9, CONFIG.stretchMaxScale);
      var mx = clamp(dx * 0.3, -CONFIG.stretchMaxMove, CONFIG.stretchMaxMove);
      var my = clamp(dy * 0.3, -CONFIG.stretchMaxMove, CONFIG.stretchMaxMove);
      state.el.style.translate = mx.toFixed(1) + 'px ' + my.toFixed(1) + 'px';
      state.el.style.scale = sx.toFixed(3) + ' ' + sy.toFixed(3);
    }

    document.addEventListener('pointerdown', function (event) {
      if (reducedMotion || active) { return; }
      if (event.pointerType === 'mouse' && event.button !== 0) { return; }
      var el = event.target.closest ? event.target.closest(STRETCH_SELECTOR) : null;
      if (!el || el.disabled) { return; }

      var state = {
        el: el,
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        rect: el.getBoundingClientRect(),
        touch: event.pointerType === 'touch',
        on: event.pointerType !== 'touch',
        dragged: false,
        timer: null
      };
      active = state;

      el.classList.remove('is-stretch-release');
      el.classList.add('is-stretching');
      el.style.scale = '0.97';                       // small press squish

      if (state.touch) {
        state.timer = window.setTimeout(function () { state.on = true; }, CONFIG.stretchHoldMs);
      }
    });

    document.addEventListener('pointermove', function (event) {
      if (!active || active.id !== event.pointerId) { return; }
      var dx = event.clientX - active.x;
      var dy = event.clientY - active.y;
      var dist = Math.hypot(dx, dy);

      if (!active.on) {
        // Touch moved before the hold finished: this is a scroll, cancel
        if (dist > 8) { release(active); active = null; }
        return;
      }
      if (dist > 8) { active.dragged = true; }
      apply(active, dx, dy);
    });

    function end(event) {
      if (!active || active.id !== event.pointerId) { return; }
      release(active);
      active = null;
    }
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);

    // While a touch stretch is active, stop the page from scrolling.
    // This listener only blocks scrolling during an active stretch.
    document.addEventListener('touchmove', function (event) {
      if (active && active.touch && active.on && event.cancelable) {
        event.preventDefault();
      }
    }, { passive: false });

    // After dragging, ignore the click that the browser sends on release
    document.addEventListener('click', function (event) {
      if (performance.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
  }


  /* ========================================================
     SECTION 10 - OPTIONAL DEBUG MODE
     ======================================================== */
  function runDebugReport() {
    var params;
    try { params = new URLSearchParams(window.location.search); } catch (e) { return; }
    if (!params.get(CONFIG.debugParam)) { return; }

    var text = document.body.innerText || '';
    var matches = text.match(/YOUR_[A-Z_]+/g) || [];
    var unique = matches.filter(function (m, i) { return matches.indexOf(m) === i; });
    console.info('[portfolio debug] Unfilled placeholders:', unique.length ? unique.join(', ') : 'none');
    console.info('[portfolio debug] Placeholder link boxes:', $all('.link-placeholder').length);
  }


  /* ========================================================
     SECTION 11 - OBJECT REGISTRY (3D objects and their meaning)
     ----------------------------------------------------------
     HOW TO ADD A NEW INTERACTIVE OBJECT
     1. Add an entry below with a unique id. Give it a target like
        '#projects' to link to a section, or leave target out for
        a decoration that only shows a description.
     2. In createScene (Section 14) build the 3D shape and call
        register('your-id', group).
     3. In index.html add a button with data-scene-object="your-id"
        (and data-target if it has one).
     ======================================================== */
  var OBJECTS = {
    'cord': {
      action: 'toggle-light',
      description: 'Pull rope: switches the desk lamp on and off. It does the same as the rope control in the panel.'
    },
    'monitor': {
      target: '#projects', linkText: 'Go to Projects',
      description: 'Monitor: stands for the Projects section. The chart on the screen is a decorative sample, not a real result.'
    },
    'data-cards': {
      target: '#skills', linkText: 'Go to Skills',
      description: 'Floating data cards: stand for the Skills section. The graphics are abstract and show no measurements.'
    },
    'notebook': {
      target: '#case-studies', linkText: 'Go to Case Studies',
      description: 'Notebook: stands for the Case Studies section, where written analyses will appear once they exist.'
    },
    'chart-cube': {
      target: '#about', linkText: 'Go to About',
      description: 'Chart cube: stands for the About section and the purpose of this portfolio.'
    },
    'books': {
      target: '#journey', linkText: 'Go to Learning Journey',
      description: 'Stack of books: stands for the Learning Journey section, where self-directed learning milestones are recorded.'
    },
    'grad-cap': {
      target: '#education', linkText: 'Go to Education',
      description: 'Graduation cap: stands for the Education section.'
    },
    'certificate': {
      target: '#certifications', linkText: 'Go to Certifications',
      description: 'Framed certificate: stands for the Certifications section. The frame is an empty placeholder and no certificate is claimed.'
    },
    'trophy': {
      target: '#achievements', linkText: 'Go to Achievements',
      description: 'Trophy: stands for the Achievements section. No achievements are listed yet, so it is only a symbol.'
    },
    'mail': {
      target: '#contact', linkText: 'Go to Contact',
      description: 'Envelope: stands for the Contact section.'
    },
    'database': {
      description: 'Database stack: a decorative symbol for SQL and data storage. It does not link to a section.'
    },
    'mug': {
      description: 'Coffee mug: decoration that makes the workspace feel lived in.'
    },
    'plant': {
      description: 'Plant: decoration for the desk.'
    }
  };

  var selectedId = null;
  var lightOn = false;
  var sceneReady = false;
  var defaultDescription = '';
  var suppressRopeClick = false;


  /* ========================================================
     SECTION 12 - SCENE UI (HTML side of the scene)
     Works with or without the 3D canvas.
     ======================================================== */
  function sceneContainer() { return $('#scene-container'); }

  function setSceneState(state, message) {
    var container = sceneContainer();
    if (container) { container.setAttribute('data-scene-state', state); }
    if (typeof message === 'string') { setStatus(message); }
  }

  function setStatus(text) {
    var status = $('#scene-status');
    if (status) { status.textContent = text; }
  }

  function showDescription(text, target, linkText) {
    var box = $('.scene-description__text');
    var link = $('#scene-description-link');
    if (box) { box.textContent = text; }
    if (link) {
      if (target && document.querySelector(target)) {
        link.setAttribute('href', target);
        link.textContent = linkText || 'Go to section';
        link.hidden = false;
      } else {
        link.hidden = true;
      }
    }
  }

  function updateObjectButtons() {
    $all('[data-scene-object]').forEach(function (button) {
      var on = button.getAttribute('data-scene-object') === selectedId;
      button.classList.toggle('is-selected', on);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function updateLightUi() {
    var rope = $('#light-toggle');
    var container = sceneContainer();
    if (container) { container.classList.toggle('is-lit', lightOn); }
    if (rope) {
      rope.setAttribute('aria-pressed', lightOn ? 'true' : 'false');
      var label = $('.button__label', rope);
      if (label) {
        label.textContent = lightOn ? 'Pull the cord: light is on' : 'Pull the cord: light is off';
      }
    }
  }

  function disableControl(selector, text) {
    var control = $(selector);
    if (!control) { return; }
    control.disabled = true;
    control.setAttribute('aria-disabled', 'true');
    var label = $('.button__label', control);
    if (label && text) { label.textContent = text; }
  }
  function enableControl(selector) {
    var control = $(selector);
    if (!control) { return; }
    control.disabled = false;
    control.removeAttribute('aria-disabled');
  }

  function goToSection(selector) {
    var target = selector && document.querySelector(selector);
    if (!target) { return; }
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    try { window.history.replaceState(null, '', selector); } catch (e) { /* not important */ }
  }

  // Small spring on the HTML rope when the light is switched by any means
  function nudgeRope() {
    var rope = $('#light-toggle');
    if (!rope || reducedMotion) { return; }
    rope.style.setProperty('--pull', '22px');
    window.setTimeout(function () { rope.style.setProperty('--pull', '0px'); }, 140);
  }

  function setLight(on) {
    lightOn = !!on;
    updateLightUi();
    if (sceneApi) { sceneApi.setLight(lightOn); }
    setStatus('3D scene ready. Light is ' + (lightOn ? 'on' : 'off') + '.');
  }

  function selectObject(id) {
    var def = OBJECTS[id];
    if (!def) { return; }
    selectedId = id;
    updateObjectButtons();
    showDescription(def.description, def.target, def.linkText);
    if (sceneApi) { sceneApi.setSelected(id); }
  }

  function resetView() {
    selectedId = null;
    updateObjectButtons();
    showDescription(defaultDescription, null);
    if (sceneApi) { sceneApi.resetView(); }
  }

  /* One entry point for every activation, from the 3D canvas
     or from an HTML control. This keeps both in step. */
  function activateObject(id) {
    var def = OBJECTS[id];
    if (!def) { return; }

    if (def.action === 'toggle-light') {
      if (!sceneReady) { return; }
      setLight(!lightOn);
      showDescription(def.description, null);
      nudgeRope();
      if (sceneApi) { sceneApi.pullCord(); }
      return;
    }

    // Activating the already selected object a second time opens its section
    if (selectedId === id && def.target) {
      goToSection(def.target);
      return;
    }
    selectObject(id);
  }

  function initSceneControls() {
    var description = $('.scene-description__text');
    defaultDescription = description ? description.textContent : '';

    $all('[data-scene-object]').forEach(function (button) {
      button.setAttribute('aria-pressed', 'false');
    });

    document.addEventListener('click', function (event) {
      if (!event.target.closest) { return; }

      var actionEl = event.target.closest('[data-scene-action]');
      if (actionEl && !actionEl.disabled) {
        var action = actionEl.getAttribute('data-scene-action');
        if (action === 'toggle-light') {
          if (suppressRopeClick) { return; }    // a drag already switched it
          activateObject('cord');
        } else if (action === 'reset-view') {
          resetView();
        }
        return;
      }

      var objectEl = event.target.closest('[data-scene-object]');
      if (objectEl) {
        activateObject(objectEl.getAttribute('data-scene-object'));
      }
    });

    disableControl('#light-toggle', 'Light control loading...');
    disableControl('#scene-reset');
  }

  /* The HTML rope: drag it down (16px or more) to switch the light.
     A plain tap or key press is handled by the click listener above. */
  function initRopeDrag() {
    var rope = $('#light-toggle');
    if (!rope || !('PointerEvent' in window)) { return; }
    var drag = null;

    rope.addEventListener('pointerdown', function (event) {
      if (rope.disabled) { return; }
      drag = { id: event.pointerId, y: event.clientY, pull: 0 };
      rope.classList.add('is-pulling');
      try { rope.setPointerCapture(event.pointerId); } catch (e) { /* not important */ }
    });

    rope.addEventListener('pointermove', function (event) {
      if (!drag || drag.id !== event.pointerId) { return; }
      drag.pull = clamp(event.clientY - drag.y, 0, 48);
      rope.style.setProperty('--pull', drag.pull + 'px');
    });

    function finish(event, allowSwitch) {
      if (!drag || drag.id !== event.pointerId) { return; }
      var pulled = drag.pull;
      drag = null;
      rope.classList.remove('is-pulling');
      rope.style.setProperty('--pull', '0px');
      if (allowSwitch && pulled >= 16) {
        suppressRopeClick = true;
        activateObject('cord');
        window.setTimeout(function () { suppressRopeClick = false; }, 400);
      }
    }
    rope.addEventListener('pointerup', function (event) { finish(event, true); });
    rope.addEventListener('pointercancel', function (event) { finish(event, false); });
  }


  /* ========================================================
     SECTION 13 - THREE.JS LOADING AND WEBGL CHECK
     Only ONE attempt is made. No retry loop.
     ======================================================== */
  function webglAvailable() {
    try {
      var canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl')));
    } catch (e) {
      return false;
    }
  }

  function loadThree(url) {
    return new Promise(function (resolve, reject) {
      var timer = window.setTimeout(function () {
        reject(new Error('the 3D library took too long to load'));
      }, CONFIG.loadTimeoutMs);

      import(url).then(function (module) {
        window.clearTimeout(timer);
        resolve(module);
      }).catch(function (error) {
        window.clearTimeout(timer);
        reject(error);
      });
    });
  }

  function failScene(reason, error) {
    sceneReady = false;
    if (sceneApi) { sceneApi.destroy(); sceneApi = null; }
    if (error) { console.warn('[portfolio] 3D scene unavailable:', reason, error); }
    setSceneState('error', '3D scene unavailable (' + reason + '). The rest of the page works normally.');
    disableControl('#light-toggle', 'Light control unavailable');
    disableControl('#scene-reset');
    var container = sceneContainer();
    if (container) { container.classList.remove('is-lit'); }
  }

  function initScene() {
    var container = sceneContainer();
    var mount = $('#scene-mount');
    if (!container || !mount) { return; }

    setSceneState('loading', 'Preparing the 3D scene...');

    if (!webglAvailable()) {
      failScene('WebGL is not available in this browser');
      return;
    }

    var url = container.getAttribute('data-three-url') || CONFIG.threeUrlFallback;

    loadThree(url).then(function (THREE) {
      try {
        sceneApi = createScene(THREE, container, mount);
      } catch (error) {
        failScene('the scene could not start', error);
        return;
      }
      sceneReady = true;
      enableControl('#light-toggle');
      enableControl('#scene-reset');
      updateLightUi();
      setSceneState('ready', '3D scene ready. Light is off.');
    }).catch(function (error) {
      failScene('the 3D library could not be loaded', error);
    });
  }


  /* ========================================================
     SECTION 14 - THE 3D SCENE
     createScene builds the renderer, camera, lights and objects,
     then returns a small API used by the HTML side above.
     Colours are hex numbers like 0xff8a1f (orange).
     ======================================================== */
  function createScene(T, container, mount) {

    var listeners = [];
    function listen(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      listeners.push([target, type, handler, options]);
    }

    var smallScreen = media(CONFIG.smallScreenQuery).matches ||
      media('(pointer: coarse)').matches;

    /* ---- renderer ---- */
    var renderer = new T.WebGLRenderer({
      antialias: !smallScreen,
      alpha: true,
      powerPreference: 'low-power'
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,
      smallScreen ? CONFIG.maxPixelRatioSmall : CONFIG.maxPixelRatio));
    var canvas = renderer.domElement;
    mount.appendChild(canvas);

    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(40, 4 / 3, 0.1, 60);
    var raycaster = new T.Raycaster();
    var pointerNdc = new T.Vector2();

    /* ---- lights ---- */
    var hemi = new T.HemisphereLight(0xffa862, 0x140a04, 0.55);
    scene.add(hemi);
    var key = new T.DirectionalLight(0xffd2a8, 0.9);
    key.position.set(3, 5, 4);
    scene.add(key);
    var lampLight = new T.PointLight(0xffe0b0, 0, 0, 2);
    scene.add(lampLight);

    /* ---- bookkeeping ---- */
    var disposables = [];
    var hitMeshes = [];
    var entries = {};
    var floaters = [];
    var rgbMaterials = [];            // line materials whose colour cycles through the rainbow
    var changed = false;

    function register(id, root, scaleTargets, focusPoint) {
      var mats = [];
      root.traverse(function (child) {
        if (child.isMesh) {
          child.userData.objectId = id;
          hitMeshes.push(child);
          var m = child.material;
          if (m && m.emissive && m.userData.baseEI === undefined) {
            m.userData.baseEI = m.emissiveIntensity;
            mats.push(m);
          }
        }
      });
      entries[id] = {
        targets: scaleTargets || [root],
        mats: mats,
        level: 0,
        focus: focusPoint || new T.Vector3(0, 1.7, 0)
      };
    }

    function makeTexture(w, h, draw) {
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      var t = new T.CanvasTexture(c);
      t.colorSpace = T.SRGBColorSpace;
      disposables.push(t);
      return t;
    }

    function stdMat(color, emissive, emissiveIntensity, rough, metal) {
      return new T.MeshStandardMaterial({
        color: color,
        emissive: emissive || 0x000000,
        emissiveIntensity: emissiveIntensity || 0,
        roughness: rough === undefined ? 0.6 : rough,
        metalness: metal === undefined ? 0.2 : metal
      });
    }

    // Shortcut: make a mesh, place it, add it to a parent
    function part(parent, geometry, material, x, y, z) {
      var mesh = new T.Mesh(geometry, material);
      mesh.position.set(x || 0, y || 0, z || 0);
      parent.add(mesh);
      return mesh;
    }

    function rgbLine(geometry, offset, opacity) {
      var mat = new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: opacity || 1 });
      rgbMaterials.push({ mat: mat, offset: offset });
      return new T.LineSegments(geometry, mat);
    }

    /* ---- decorative textures (abstract, NOT real data) ---- */
    function drawScreen(ctx, w, h) {
      ctx.fillStyle = '#120b06'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#26160a'; ctx.fillRect(0, 0, w, 34);
      ctx.fillStyle = '#ffb347'; ctx.font = '16px sans-serif';
      ctx.fillText('SAMPLE VISUAL (decorative)', 14, 23);
      var bars = [0.35, 0.55, 0.42, 0.7, 0.5, 0.82, 0.62, 0.9];
      for (var i = 0; i < bars.length; i++) {
        var bh = bars[i] * (h - 120);
        ctx.fillStyle = i % 2 ? '#ff8a1f' : '#ffa94d';
        ctx.fillRect(28 + i * 52, h - 28 - bh, 34, bh);
      }
      ctx.strokeStyle = '#ffe2a8'; ctx.lineWidth = 3; ctx.beginPath();
      for (var j = 0; j < bars.length; j++) {
        var x = 45 + j * 52, y = h - 70 - bars[(j + 3) % bars.length] * (h - 160);
        if (j === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,200,150,0.3)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(20, h - 28); ctx.lineTo(w - 14, h - 28); ctx.stroke();
    }

    function drawCard(kind) {
      return function (ctx, w, h) {
        var g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, '#2c1a0d'); g.addColorStop(1, '#150c06');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ffb347'; ctx.fillRect(14, 14, 60, 6);
        ctx.fillStyle = 'rgba(226,208,187,0.5)'; ctx.fillRect(14, 28, 110, 4);
        if (kind === 0) {
          [0.4, 0.7, 0.5, 0.9, 0.6].forEach(function (v, i) {
            ctx.fillStyle = '#ff8a1f';
            ctx.fillRect(24 + i * 40, h - 18 - v * 80, 26, v * 80);
          });
        } else if (kind === 1) {
          ctx.strokeStyle = '#ff5a36'; ctx.lineWidth = 4; ctx.beginPath();
          [0.3, 0.55, 0.4, 0.75, 0.6, 0.9].forEach(function (v, i) {
            var x = 20 + i * 40, y = h - 20 - v * 85;
            if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
          });
          ctx.stroke();
        } else {
          ctx.lineWidth = 16;
          ctx.strokeStyle = '#ff8a1f'; ctx.beginPath();
          ctx.arc(w / 2, h / 2 + 12, 42, -Math.PI / 2, Math.PI * 0.9); ctx.stroke();
          ctx.strokeStyle = '#ffd166'; ctx.beginPath();
          ctx.arc(w / 2, h / 2 + 12, 42, Math.PI * 0.95, Math.PI * 1.5); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255,179,71,0.55)'; ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, w - 2, h - 2);
      };
    }

    // Empty certificate frame: clearly a placeholder, claims nothing
    function drawCertificate(ctx, w, h) {
      ctx.fillStyle = '#f3e6d3'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#b5651d'; ctx.lineWidth = 6; ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = '#6b3a1a'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('CERTIFICATE', w / 2, 54);
      ctx.font = '15px sans-serif';
      ctx.fillText('(empty placeholder)', w / 2, 84);
      ctx.fillStyle = 'rgba(107,58,26,0.35)';
      ctx.fillRect(40, 110, w - 80, 4); ctx.fillRect(60, 130, w - 120, 4);
    }

    function drawEnvelope(ctx, w, h) {
      ctx.fillStyle = '#f6ead8'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#b5651d'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w / 2, h * 0.58); ctx.lineTo(w, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w * 0.38, h * 0.5); ctx.moveTo(w, h); ctx.lineTo(w * 0.62, h * 0.5); ctx.stroke();
      ctx.fillStyle = '#ff8a1f'; ctx.beginPath(); ctx.arc(w / 2, h * 0.58, 14, 0, Math.PI * 2); ctx.fill();
    }

    function drawGlow(ctx, w, h) {
      var g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,240,200,1)');
      g.addColorStop(0.35, 'rgba(255,200,120,0.55)');
      g.addColorStop(1, 'rgba(255,160,60,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }

    /* ======================================================
       BUILD THE WORKSPACE
       Units are arbitrary. The desk top surface is at y = 1.07.
       Left to right on the desk: plant, certificate, books and cap,
       notebook, monitor, envelope, mug, cube, trophy, database.
       ====================================================== */
    var DESK_TOP = 1.07;

    // --- Desk (decoration, not clickable) ---
    var desk = new T.Group();
    var deskTop = new T.Mesh(new T.BoxGeometry(6.4, 0.14, 2.2), stdMat(0x2e2014, 0x000000, 0, 0.55, 0.25));
    deskTop.position.y = 1.0;
    desk.add(deskTop);
    var legGeo = new T.BoxGeometry(0.12, 1.0, 0.12);
    var legMat = stdMat(0x221810, 0x000000, 0, 0.7, 0.3);
    [[-3.0, 0.5, -0.95], [3.0, 0.5, -0.95], [-3.0, 0.5, 0.95], [3.0, 0.5, 0.95]].forEach(function (p) {
      part(desk, legGeo, legMat, p[0], p[1], p[2]);
    });
    var deskEdge = rgbLine(new T.EdgesGeometry(new T.BoxGeometry(6.4, 0.14, 2.2)), 0, 0.7);
    deskEdge.position.y = 1.0;
    desk.add(deskEdge);
    scene.add(desk);

    // --- Monitor (id: monitor) ---
    var monitor = new T.Group();
    var monMat = stdMat(0x1c140d, 0x3a1d05, 0.2, 0.4, 0.5);
    part(monitor, new T.CylinderGeometry(0.35, 0.4, 0.04, 28), monMat, 0, 0.02, 0);
    part(monitor, new T.BoxGeometry(0.1, 0.5, 0.08), monMat, 0, 0.27, 0);
    part(monitor, new T.BoxGeometry(1.9, 1.1, 0.07), monMat, 0, 1.05, 0);
    part(monitor, new T.PlaneGeometry(1.76, 0.96),
      new T.MeshBasicMaterial({ map: makeTexture(512, 300, drawScreen) }), 0, 1.05, 0.04);
    monitor.position.set(0, DESK_TOP, -0.45);
    scene.add(monitor);
    register('monitor', monitor, [monitor], new T.Vector3(0, 2.0, 0));

    // --- Notebook (id: notebook) ---
    var notebook = new T.Group();
    part(notebook, new T.BoxGeometry(0.9, 0.05, 0.65), stdMat(0x6b3a1a, 0x55260a, 0.25, 0.7, 0.1), 0, 0.025, 0);
    part(notebook, new T.BoxGeometry(0.84, 0.04, 0.6), stdMat(0xf3e6d3, 0x403020, 0.1, 0.9, 0), 0, 0.07, 0);
    part(notebook, new T.BoxGeometry(0.06, 0.07, 0.62), stdMat(0xff8a1f, 0xff8a1f, 0.3, 0.5, 0.1), -0.42, 0.06, 0);
    notebook.position.set(-1.05, DESK_TOP, 0.7);
    notebook.rotation.y = 0.35;
    scene.add(notebook);
    register('notebook', notebook, [notebook], new T.Vector3(-1.0, 1.2, 0.6));

    // --- Chart cube (id: chart-cube) ---
    var cubeGroup = new T.Group();
    part(cubeGroup, new T.BoxGeometry(0.5, 0.5, 0.5), stdMat(0x4a2305, 0xff8a1f, 0.3, 0.35, 0.4), 0, 0, 0);
    cubeGroup.add(rgbLine(new T.EdgesGeometry(new T.BoxGeometry(0.52, 0.52, 0.52)), 0.3, 1));
    cubeGroup.position.set(1.95, DESK_TOP + 0.4, 0.25);
    scene.add(cubeGroup);
    register('chart-cube', cubeGroup, [cubeGroup], new T.Vector3(1.9, 1.5, 0.3));

    // --- Books (id: books) ---
    var books = new T.Group();
    part(books, new T.BoxGeometry(1.0, 0.14, 0.7), stdMat(0x8a4a1a, 0x3a1d05, 0.15, 0.7, 0.1), 0, 0.07, 0).rotation.y = 0.05;
    part(books, new T.BoxGeometry(0.95, 0.12, 0.66), stdMat(0x3b2a1a, 0x1a1006, 0.1, 0.7, 0.1), 0.02, 0.2, 0).rotation.y = -0.08;
    part(books, new T.BoxGeometry(0.9, 0.12, 0.62), stdMat(0xb5651d, 0x5a2a05, 0.2, 0.7, 0.1), -0.02, 0.32, 0).rotation.y = 0.12;
    books.position.set(-2.4, DESK_TOP, 0.55);
    scene.add(books);
    register('books', books, [books], new T.Vector3(-2.4, 1.3, 0.5));

    // --- Graduation cap on the books (id: grad-cap) ---
    var cap = new T.Group();
    var capMat = stdMat(0x1a1410, 0xff8a1f, 0.12, 0.5, 0.2);
    part(cap, new T.CylinderGeometry(0.17, 0.2, 0.13, 18), capMat, 0, 0.06, 0);
    var board = part(cap, new T.BoxGeometry(0.62, 0.03, 0.62), capMat, 0, 0.14, 0);
    board.rotation.y = Math.PI / 4;
    part(cap, new T.CylinderGeometry(0.008, 0.008, 0.2, 6), stdMat(0xffb347, 0xff8a1f, 0.4, 0.4, 0.3), 0.26, 0.04, 0.0);
    part(cap, new T.SphereGeometry(0.025, 10, 8), stdMat(0xffb347, 0xff8a1f, 0.5, 0.4, 0.3), 0.26, -0.07, 0);
    cap.position.set(-2.4, DESK_TOP + 0.38, 0.55);
    cap.rotation.y = 0.4;
    scene.add(cap);
    register('grad-cap', cap, [cap], new T.Vector3(-2.4, 1.6, 0.5));

    // --- Certificate frame (id: certificate, empty placeholder) ---
    var cert = new T.Group();
    part(cert, new T.BoxGeometry(0.8, 0.58, 0.04), stdMat(0x6b4a1a, 0xff8a1f, 0.15, 0.4, 0.6), 0, 0.35, 0);
    part(cert, new T.PlaneGeometry(0.7, 0.48),
      new T.MeshBasicMaterial({ map: makeTexture(280, 192, drawCertificate) }), 0, 0.35, 0.025);
    part(cert, new T.BoxGeometry(0.06, 0.3, 0.04), stdMat(0x3b2a1a, 0, 0, 0.6, 0.3), 0, 0.15, -0.08).rotation.x = -0.5;
    cert.position.set(-2.1, DESK_TOP, -0.65);
    cert.rotation.y = 0.35;
    scene.add(cert);
    register('certificate', cert, [cert], new T.Vector3(-2.1, 1.5, -0.6));

    // --- Plant (id: plant, decoration) ---
    var plant = new T.Group();
    part(plant, new T.CylinderGeometry(0.2, 0.15, 0.3, 14), stdMat(0x8a4a1a, 0x2a1205, 0.1, 0.8, 0.1), 0, 0.15, 0);
    var leafMat = stdMat(0x2f7d4a, 0x103a20, 0.25, 0.6, 0.1);
    for (var li = 0; li < 6; li++) {
      var leaf = part(plant, new T.ConeGeometry(0.06, 0.5, 6), leafMat, 0, 0.5, 0);
      var ang = (li / 6) * Math.PI * 2;
      leaf.position.x = Math.cos(ang) * 0.1;
      leaf.position.z = Math.sin(ang) * 0.1;
      leaf.rotation.z = -Math.cos(ang) * 0.5;
      leaf.rotation.x = Math.sin(ang) * 0.5;
    }
    plant.position.set(-3.0, DESK_TOP, -0.7);
    scene.add(plant);
    register('plant', plant, [plant], new T.Vector3(-3.0, 1.5, -0.6));

    // --- Envelope (id: mail) ---
    var mail = new T.Group();
    part(mail, new T.BoxGeometry(0.62, 0.04, 0.42), stdMat(0xf6ead8, 0x302010, 0.1, 0.9, 0), 0, 0.02, 0);
    var mailTop = part(mail, new T.PlaneGeometry(0.62, 0.42),
      new T.MeshBasicMaterial({ map: makeTexture(248, 168, drawEnvelope) }), 0, 0.042, 0);
    mailTop.rotation.x = -Math.PI / 2;
    mail.position.set(1.0, DESK_TOP, 0.85);
    mail.rotation.y = -0.25;
    scene.add(mail);
    register('mail', mail, [mail], new T.Vector3(1.0, 1.2, 0.8));

    // --- Coffee mug (id: mug, decoration) ---
    var mug = new T.Group();
    part(mug, new T.CylinderGeometry(0.17, 0.15, 0.3, 20), stdMat(0xf3e6d3, 0x302010, 0.1, 0.5, 0.1), 0, 0.15, 0);
    part(mug, new T.CylinderGeometry(0.15, 0.15, 0.02, 20), stdMat(0x3a1d0a, 0x1a0a02, 0.1, 0.4, 0), 0, 0.29, 0);
    var handle = part(mug, new T.TorusGeometry(0.09, 0.025, 8, 14), stdMat(0xf3e6d3, 0x302010, 0.1, 0.5, 0.1), 0.2, 0.15, 0);
    handle.rotation.z = 0;
    mug.position.set(1.4, DESK_TOP, -0.8);
    scene.add(mug);
    register('mug', mug, [mug], new T.Vector3(1.4, 1.3, -0.7));

    // --- Trophy (id: trophy) ---
    var trophy = new T.Group();
    var goldMat = stdMat(0xffb347, 0xff8a1f, 0.35, 0.3, 0.8);
    part(trophy, new T.BoxGeometry(0.4, 0.08, 0.4), stdMat(0x3b2a1a, 0x1a1006, 0.1, 0.6, 0.2), 0, 0.04, 0);
    part(trophy, new T.CylinderGeometry(0.05, 0.07, 0.28, 12), goldMat, 0, 0.22, 0);
    part(trophy, new T.CylinderGeometry(0.2, 0.09, 0.3, 20), goldMat, 0, 0.5, 0);
    part(trophy, new T.TorusGeometry(0.1, 0.02, 8, 14), goldMat, -0.22, 0.5, 0);
    part(trophy, new T.TorusGeometry(0.1, 0.02, 8, 14), goldMat, 0.22, 0.5, 0);
    trophy.position.set(2.85, DESK_TOP, -0.5);
    scene.add(trophy);
    register('trophy', trophy, [trophy], new T.Vector3(2.85, 1.6, -0.4));

    // --- Database stack (id: database, decoration) ---
    var db = new T.Group();
    var dbMat = stdMat(0x4a2305, 0xff8a1f, 0.35, 0.4, 0.5);
    [0.06, 0.2, 0.34].forEach(function (y) {
      part(db, new T.CylinderGeometry(0.24, 0.24, 0.1, 22), dbMat, 0, y, 0);
    });
    var dbRing = rgbLine(new T.EdgesGeometry(new T.CylinderGeometry(0.245, 0.245, 0.42, 22), 30), 0.6, 0.8);
    dbRing.position.y = 0.2;
    db.add(dbRing);
    db.position.set(2.95, DESK_TOP, 0.75);
    scene.add(db);
    register('database', db, [db], new T.Vector3(2.95, 1.4, 0.7));

    // --- Floating data cards (id: data-cards) ---
    var cardsRoot = new T.Group();
    var cardDefs = [
      { x: -3.0, y: 2.9, z: 0.2, ry: 0.35, kind: 0, phase: 0 },
      { x: 3.0, y: 3.0, z: 0.0, ry: -0.35, kind: 1, phase: 2 },
      { x: 0.9, y: 3.9, z: -0.8, ry: -0.1, kind: 2, phase: 4 }
    ];
    var cardGeo = new T.PlaneGeometry(1.0, 0.64);
    var cardEdgeGeo = new T.EdgesGeometry(cardGeo);
    var cardGroups = cardDefs.map(function (d, index) {
      var g = new T.Group();
      var plane = new T.Mesh(cardGeo, new T.MeshBasicMaterial({
        map: makeTexture(256, 164, drawCard(d.kind)), side: T.DoubleSide
      }));
      g.add(plane, rgbLine(cardEdgeGeo, index * 0.15, 1));
      g.position.set(d.x, d.y, d.z);
      g.rotation.y = d.ry;
      g.userData.baseY = d.y;
      g.userData.phase = d.phase;
      cardsRoot.add(g);
      floaters.push(g);
      return g;
    });
    scene.add(cardsRoot);
    register('data-cards', cardsRoot, cardGroups, new T.Vector3(0.3, 2.8, 0));

    // --- Lamp with pull rope (rope id: cord) ---
    var lampX = -1.6;
    var lamp = new T.Group();
    var wire = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 2.2, 6), stdMat(0x6b5642, 0, 0, 0.8, 0.2));
    wire.position.set(lampX, 4.2, 0.05);
    var shade = new T.Mesh(
      new T.ConeGeometry(0.42, 0.38, 28, 1, true),
      new T.MeshStandardMaterial({ color: 0x2a1b10, emissive: 0xffe0b0, emissiveIntensity: 0,
        roughness: 0.5, metalness: 0.4, side: T.DoubleSide })
    );
    shade.position.set(lampX, 3.0, 0.05);
    var bulbMat = new T.MeshStandardMaterial({ color: 0x8a8580, emissive: 0xffe0b0,
      emissiveIntensity: 0.1, roughness: 0.3, metalness: 0 });
    var bulb = new T.Mesh(new T.SphereGeometry(0.12, 18, 14), bulbMat);
    bulb.position.set(lampX, 2.84, 0.05);
    lamp.add(wire, shade, bulb);

    // Soft glow around the bulb (a flat picture that always faces the camera)
    var glowMat = new T.SpriteMaterial({
      map: makeTexture(128, 128, drawGlow), transparent: true, opacity: 0,
      depthWrite: false, blending: T.AdditiveBlending
    });
    var glow = new T.Sprite(glowMat);
    glow.position.copy(bulb.position);
    glow.scale.set(1.2, 1.2, 1);
    lamp.add(glow);

    // Cone of light falling onto the desk
    var coneMat = new T.MeshBasicMaterial({
      color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false,
      side: T.DoubleSide, blending: T.AdditiveBlending
    });
    var lightCone = new T.Mesh(new T.ConeGeometry(1.25, 1.85, 32, 1, true), coneMat);
    lightCone.position.set(lampX, 1.9, 0.05);
    lamp.add(lightCone);

    scene.add(lamp);
    lampLight.position.copy(bulb.position);

    // The rope: beads on a string and a glowing knob. The rope is the clickable part.
    var cordBaseY = 2.78;
    var cordGroup = new T.Group();
    cordGroup.position.set(lampX + 0.3, cordBaseY, 0.05);
    var cordLine = new T.Mesh(new T.CylinderGeometry(0.014, 0.014, 0.9, 6), stdMat(0xe8dccd, 0, 0, 0.8, 0));
    cordLine.position.y = -0.45;
    cordGroup.add(cordLine);
    var beadGeo = new T.SphereGeometry(0.028, 8, 6);
    var beadMat = stdMat(0xc9b49a, 0, 0, 0.7, 0.1);
    for (var bi = 0; bi < 6; bi++) {
      part(cordGroup, beadGeo, beadMat, 0, -0.1 - bi * 0.13, 0);
    }
    var knob = new T.Mesh(new T.SphereGeometry(0.085, 16, 12), stdMat(0xff8a1f, 0xff8a1f, 0.9, 0.3, 0.2));
    knob.position.y = -0.97;
    cordGroup.add(knob);
    // Invisible fatter shape so a finger can hit the thin rope easily
    var cordHit = new T.Mesh(
      new T.CylinderGeometry(0.26, 0.26, 1.4, 10),
      new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    cordHit.position.y = -0.6;
    cordGroup.add(cordHit);
    scene.add(cordGroup);
    register('cord', cordGroup, [cordGroup], new T.Vector3(lampX, 2.0, 0));

    // --- Ambient particles ---
    var count = smallScreen ? CONFIG.particleCountSmall : CONFIG.particleCount;
    var positions = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 13;
      positions[i * 3 + 1] = 0.4 + Math.random() * 5;
      positions[i * 3 + 2] = -3.5 + Math.random() * 6;
    }
    var particleGeo = new T.BufferGeometry();
    particleGeo.setAttribute('position', new T.BufferAttribute(positions, 3));
    var particles = new T.Points(particleGeo, new T.PointsMaterial({
      color: 0xffb347, size: 0.05, transparent: true, opacity: 0.55, depthWrite: false
    }));
    scene.add(particles);

    // Animated values
    var lampLevel = 0, lampTarget = 0, pull = 0;
    var hoverId = null, focusId = null;
    var cam = { x: CONFIG.camera.x, y: CONFIG.camera.y, z: CONFIG.camera.z,
      lx: CONFIG.lookAt.x, ly: CONFIG.lookAt.y, lz: CONFIG.lookAt.z };
    var parallax = { x: 0, y: 0 };
    var zoomFactor = 1;
    var paused = false, visible = !document.hidden, inView = true;
    var rafId = null, lastTime = 0, forceRender = true, destroyed = false;

    function approach(current, target, rate, dt) {
      var d = target - current;
      if (Math.abs(d) < 0.0005) { return target; }
      changed = true;
      return current + d * (1 - Math.exp(-rate * dt));
    }

    /* How far the page has scrolled past the hero: 0 (top) to 1. */
    function scrollProgress() {
      if (reducedMotion || !CONFIG.scrollStrength) { return 0; }
      var h = container.offsetHeight || 1;
      return clamp(window.scrollY / (h * 1.4), 0, 1) * CONFIG.scrollStrength;
    }

    /* ======================================================
       PER-FRAME UPDATE
       ====================================================== */
    function update(dt, seconds) {
      // Lamp: light, bulb, glow and light cone follow the switch smoothly
      lampLevel = approach(lampLevel, lampTarget, 5, dt);
      lampLight.intensity = lampLevel * CONFIG.lampIntensity;
      bulbMat.emissiveIntensity = 0.1 + lampLevel * 3;
      bulbMat.color.setHex(lampLevel > 0.5 ? 0xfff2cc : 0x8a8580);
      shade.material.emissiveIntensity = lampLevel * 0.35;
      hemi.intensity = 0.55 + lampLevel * 0.25;
      glowMat.opacity = lampLevel * 0.95;
      glow.scale.set(1.0 + lampLevel * 0.7, 1.0 + lampLevel * 0.7, 1);
      coneMat.opacity = lampLevel * 0.1;

      // Rope dips when pulled, then springs back
      pull = approach(pull, 0, 6, dt);
      cordGroup.position.y = cordBaseY - pull * 0.16;
      cordGroup.scale.y = 1 + pull * 0.12;

      // Hover and selection feedback (scale + glow)
      Object.keys(entries).forEach(function (id) {
        var e = entries[id];
        var target = Math.max(hoverId === id ? 0.7 : 0, selectedId === id ? 1 : 0);
        e.level = approach(e.level, target, 9, dt);
        var s = 1 + e.level * 0.07;
        e.targets.forEach(function (obj) {
          obj.scale.set(s, id === 'cord' ? s * (1 + pull * 0.12) : s, s);
        });
        e.mats.forEach(function (m) { m.emissiveIntensity = m.userData.baseEI + e.level * 0.6; });
      });

      var sway = 0;
      if (!reducedMotion) {
        // RGB colour cycling on the glowing outlines
        rgbMaterials.forEach(function (r) {
          r.mat.color.setHSL((seconds * 0.07 + r.offset) % 1, 0.9, 0.6);
        });
        floaters.forEach(function (g) {
          g.position.y = g.userData.baseY + Math.sin(seconds * 0.8 + g.userData.phase) * CONFIG.floatAmount;
        });
        cubeGroup.rotation.y += dt * 0.4;
        cubeGroup.position.y = DESK_TOP + 0.4 + Math.sin(seconds * 0.9) * 0.025;
        particles.rotation.y += dt * 0.015;
        sway = Math.sin(seconds * 0.3) * CONFIG.idleSway;
        changed = true;
      } else {
        rgbMaterials.forEach(function (r) { r.mat.color.setHSL(0.08, 0.9, 0.6); });
      }

      // Camera: mouse parallax + idle sway + scroll
      var sp = scrollProgress();
      var px = reducedMotion ? 0 : parallax.x * CONFIG.parallaxStrength;
      var py = reducedMotion ? 0 : parallax.y * CONFIG.parallaxStrength * 0.5;
      var focus = focusId && entries[focusId] ? entries[focusId].focus : null;
      var lookX = CONFIG.lookAt.x + (focus ? (focus.x - CONFIG.lookAt.x) * 0.3 : 0) + sp * 0.5;
      var lookY = CONFIG.lookAt.y + (focus ? (focus.y - CONFIG.lookAt.y) * 0.3 : 0);
      var lookZ = CONFIG.lookAt.z;

      cam.x = approach(cam.x, CONFIG.camera.x + px + sway + sp * 1.8, 4, dt);
      cam.y = approach(cam.y, CONFIG.camera.y + py + sp * 0.5, 4, dt);
      cam.z = approach(cam.z, CONFIG.camera.z * zoomFactor * (1 + sp * 0.25), 4, dt);
      cam.lx = approach(cam.lx, lookX, 4, dt);
      cam.ly = approach(cam.ly, lookY, 4, dt);
      cam.lz = approach(cam.lz, lookZ, 4, dt);
      camera.position.set(cam.x, cam.y, cam.z);
      camera.lookAt(cam.lx, cam.ly, cam.lz);
    }

    /* ======================================================
       RENDER LOOP (only one can ever run)
       ====================================================== */
    function frame(now) {
      rafId = null;
      if (destroyed || paused || !visible || !inView) { return; }
      var dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
      lastTime = now;
      changed = false;
      update(dt, now / 1000);
      if (!reducedMotion || changed || forceRender) {
        renderer.render(scene, camera);
        forceRender = false;
      }
      rafId = window.requestAnimationFrame(frame);
    }
    function startLoop() {
      if (rafId !== null || destroyed || paused || !visible || !inView) { return; }
      lastTime = performance.now();
      rafId = window.requestAnimationFrame(frame);
    }
    function stopLoop() {
      if (rafId !== null) { window.cancelAnimationFrame(rafId); rafId = null; }
    }

    /* ======================================================
       RESIZE
       ====================================================== */
    function resize() {
      var w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) { return; }
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      zoomFactor = Math.max(1, 1.4 / camera.aspect);
      camera.updateProjectionMatrix();
      forceRender = true;
      startLoop();
    }
    var resizeObserver = null;
    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(mount);
    } else {
      listen(window, 'resize', resize);
    }

    /* ======================================================
       POINTER INTERACTION (never blocks page scrolling)
       ====================================================== */
    function pick(clientX, clientY) {
      var rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) { return null; }
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      camera.updateMatrixWorld();
      raycaster.setFromCamera(pointerNdc, camera);
      var hits = raycaster.intersectObjects(hitMeshes, false);
      return hits.length ? hits[0].object.userData.objectId : null;
    }

    var down = null;
    listen(canvas, 'pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) { return; }
      down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
    });
    listen(canvas, 'pointerup', function (e) {
      if (!down || down.id !== e.pointerId) { return; }
      var moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      var elapsed = performance.now() - down.t;
      down = null;
      if (moved > CONFIG.tapMovePx || elapsed > CONFIG.tapMaxMs) { return; }
      var id = pick(e.clientX, e.clientY);
      if (id) { activateObject(id); }
    });
    listen(canvas, 'pointercancel', function () { down = null; });

    function setHover(id) {
      if (hoverId === id) { return; }
      hoverId = id;
      canvas.style.cursor = id ? 'pointer' : '';
      forceRender = true;
      startLoop();
    }
    listen(container, 'pointermove', function (e) {
      if (e.pointerType === 'touch') { return; }
      var rect = container.getBoundingClientRect();
      parallax.x = clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
      parallax.y = clamp(-(((e.clientY - rect.top) / rect.height) * 2 - 1), -1, 1);
      if (e.pointerType === 'mouse' && e.target === canvas) {
        setHover(pick(e.clientX, e.clientY));
      }
      startLoop();
    });
    listen(container, 'pointerleave', function () {
      parallax.x = 0; parallax.y = 0;
      setHover(null);
      startLoop();
    });

    // Scrolling moves the camera a little (passive: never blocks scrolling)
    listen(window, 'scroll', function () {
      forceRender = true;
      startLoop();
    }, { passive: true });

    /* ======================================================
       VISIBILITY, SCREEN POSITION, CONTEXT LOSS
       ====================================================== */
    listen(document, 'visibilitychange', function () {
      visible = !document.hidden;
      if (visible) { forceRender = true; startLoop(); } else { stopLoop(); }
    });

    var viewObserver = null;
    if ('IntersectionObserver' in window) {
      viewObserver = new IntersectionObserver(function (entriesList) {
        inView = entriesList[0].isIntersecting;
        if (inView) { forceRender = true; startLoop(); } else { stopLoop(); }
      }, { threshold: 0 });
      viewObserver.observe(container);
    }

    listen(canvas, 'webglcontextlost', function () {
      failScene('the graphics context was lost');
    });
    listen(window, 'pagehide', destroy);

    /* ======================================================
       CLEANUP
       ====================================================== */
    function destroy() {
      if (destroyed) { return; }
      destroyed = true;
      stopLoop();
      listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
      listeners.length = 0;
      if (resizeObserver) { resizeObserver.disconnect(); }
      if (viewObserver) { viewObserver.disconnect(); }
      scene.traverse(function (obj) {
        if (obj.geometry) { obj.geometry.dispose(); }
        if (obj.material) {
          (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(function (m) { m.dispose(); });
        }
      });
      disposables.forEach(function (t) { t.dispose(); });
      renderer.dispose();
      if (canvas.parentNode) { canvas.parentNode.removeChild(canvas); }
    }

    /* ---- first frame ---- */
    resize();
    camera.position.set(cam.x, cam.y, cam.z);
    camera.lookAt(cam.lx, cam.ly, cam.lz);
    renderer.render(scene, camera);
    startLoop();

    /* ---- the small API used by the HTML side ---- */
    return {
      setLight: function (on) { lampTarget = on ? 1 : 0; forceRender = true; startLoop(); },
      pullCord: function () { pull = 1; forceRender = true; startLoop(); },
      setSelected: function (id) { focusId = id; forceRender = true; startLoop(); },
      resetView: function () {
        focusId = null; parallax.x = 0; parallax.y = 0;
        forceRender = true; startLoop();
      },
      setReducedMotion: function () { forceRender = true; startLoop(); },
      destroy: destroy
    };
  }


  /* ========================================================
     SECTION 15 - START EVERYTHING (each feature runs once)
     ======================================================== */
  function init() {
    markJsReady();
    initMobileNav();
    initScrollState();
    initFooterYear();
    secureExternalLinks();
    initBackToTop();
    initReveal();
    initRgbPause();
    initStretch();
    initSceneControls();
    initRopeDrag();
    runDebugReport();
    initScene();       // last, because it is the heaviest and may fail
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
