/* ==========================================================
   script.js  |  Futuristic Data Analyst Learning Portfolio
   ORANGE THEME
   ----------------------------------------------------------
   WHAT THIS FILE DOES
   1. Mobile menu, active menu link, footer year, scroll reveal.
   2. Loads Three.js and builds a 3D desk scene in code.
   3. Lets visitors click or tap 3D objects, and use real HTML
      buttons that do exactly the same things.
   4. Moves the camera a little as the page scrolls.

   BEGINNER NOTES
   - Settings you can safely change are in the CONFIG block.
   - Everything is wrapped in one function so it does not clash
     with anything else on the page.
   - If something is missing from the HTML, that feature is
     skipped. Nothing here should break the rest of the page.
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
    // Used only if #scene-container has no data-three-url attribute.
    threeUrlFallback: 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
    loadTimeoutMs: 15000,          // give up on the library after this long

    maxPixelRatio: 2,              // sharpness limit on desktop
    maxPixelRatioSmall: 1.5,       // lower on phones to stay smooth

    particleCount: 110,            // floating dots (desktop)
    particleCountSmall: 45,        // floating dots (phones)

    parallaxStrength: 0.55,        // how much the camera follows the mouse
    scrollStrength: 1,             // how much the camera moves while scrolling (0 = off)
    idleSway: 0.1,                 // slow camera drift when mouse is not used
    floatAmount: 0.06,             // how far floating cards bob up and down

    lampIntensity: 14,             // brightness of the lamp when switched on
    tapMovePx: 10,                 // finger/mouse may move this far and still count as a tap
    tapMaxMs: 700,                 // longest press that still counts as a tap

    camera: { x: 0, y: 2.5, z: 7.4 },     // where the camera sits
    lookAt: { x: 0, y: 1.7, z: 0 },       // where the camera looks

    smallScreenQuery: '(max-width: 40em)',
    desktopNavQuery: '(min-width: 62em)',
    debugParam: 'debug'            // add ?debug=1 to the web address to list unfilled placeholders
  };


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

  // matchMedia wrapper that never crashes in odd browsers
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
    if (sceneApi) {
      sceneApi.setReducedMotion(reducedMotion);
    }
  });

  var sceneApi = null; // filled in when the 3D scene is running


  /* ========================================================
     SECTION 3 - PAGE STATE (no-js -> js-ready)
     ======================================================== */
  function markJsReady() {
    document.body.classList.remove('no-js');
    document.body.classList.add('js-ready');
  }


  /* ========================================================
     SECTION 4 - MOBILE NAVIGATION
     Needs: #nav-toggle (button) and #site-nav.
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

    toggle.addEventListener('click', function () {
      setOpen(!isOpen());
    });

    // Choosing a link closes the menu
    nav.addEventListener('click', function (event) {
      var link = event.target.closest ? event.target.closest('a') : null;
      if (link) { setOpen(false); }
    });

    // Escape closes the menu and returns focus to the button
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen()) {
        setOpen(false);
        toggle.focus();
      }
    });

    // Clicking or tapping outside closes it
    document.addEventListener('click', function (event) {
      if (!isOpen()) { return; }
      if (nav.contains(event.target) || toggle.contains(event.target)) { return; }
      setOpen(false);
    });

    // Switching to the wide layout resets the menu
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

      // The "current" section is the last one whose top is above 35% of the screen
      var line = (header ? header.offsetHeight : 0) + window.innerHeight * 0.35;
      var current = items[0];
      items.forEach(function (item) {
        if (item.section.getBoundingClientRect().top <= line) { current = item; }
      });

      // At the very bottom, highlight the last section
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

  // Links that open a new tab get safe rel values
  function secureExternalLinks() {
    $all('a[target="_blank"]').forEach(function (a) {
      var rel = (a.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
      ['noopener', 'noreferrer'].forEach(function (value) {
        if (rel.indexOf(value) === -1) { rel.push(value); }
      });
      a.setAttribute('rel', rel.join(' '));
    });
  }

  // After back-to-top is used, move keyboard focus to the top
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
     Elements with data-reveal get is-visible when they appear.
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
     SECTION 8 - OPTIONAL DEBUG MODE
     Open the site with ?debug=1 on the end of the address and
     the browser console lists text that still needs replacing.
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
     SECTION 9 - OBJECT REGISTRY (3D objects and their meaning)
     ----------------------------------------------------------
     HOW TO ADD A NEW INTERACTIVE OBJECT
     1. Add an entry below with a unique id.
        action 'section' needs a target such as '#projects'.
     2. In createScene (Section 12) create the 3D shape and call
        register('your-id', group).
     3. In index.html add a button with data-scene-object="your-id"
        and data-target="#section".
     ======================================================== */
  var OBJECTS = {
    'cord': {
      label: 'Pull cord',
      action: 'toggle-light',
      description: 'Pull cord: switches the desk lamp on and off. This is the same as the Pull the cord button.'
    },
    'monitor': {
      label: 'Monitor',
      action: 'section',
      target: '#projects',
      linkText: 'Go to Projects',
      description: 'Monitor: stands for the Projects section. The chart on its screen is a decorative sample, not a real result.'
    },
    'data-cards': {
      label: 'Floating data cards',
      action: 'section',
      target: '#skills',
      linkText: 'Go to Skills',
      description: 'Floating data cards: stand for the Skills section. The graphics are abstract and do not show measurements.'
    },
    'notebook': {
      label: 'Notebook',
      action: 'section',
      target: '#case-studies',
      linkText: 'Go to Case Studies',
      description: 'Notebook: stands for the Case Studies section, where written analyses will appear once they exist.'
    },
    'chart-cube': {
      label: 'Chart cube',
      action: 'section',
      target: '#about',
      linkText: 'Go to About',
      description: 'Chart cube: stands for the About section and the purpose of this portfolio.'
    }
  };

  // Current UI state (shared by 3D clicks and HTML buttons)
  var selectedId = null;
  var lightOn = false;
  var sceneReady = false;
  var defaultDescription = '';


  /* ========================================================
     SECTION 10 - SCENE UI (HTML side of the scene)
     Everything here works with or without the 3D canvas.
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
    var button = $('#light-toggle');
    var container = sceneContainer();
    if (container) { container.classList.toggle('is-lit', lightOn); }
    if (button) {
      button.setAttribute('aria-pressed', lightOn ? 'true' : 'false');
      var label = $('.button__label', button);
      if (label) {
        label.textContent = lightOn ? 'Pull the cord: light is on' : 'Pull the cord: light is off';
      }
    }
  }

  // Disable a control and say why (never leave a fake working button)
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
     or from an HTML button. This keeps both in step. */
  function activateObject(id) {
    var def = OBJECTS[id];
    if (!def) { return; }

    if (def.action === 'toggle-light') {
      if (!sceneReady) { return; }
      setLight(!lightOn);
      showDescription(def.description, null);
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

  // One delegated click listener for all scene controls
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

    // Until the 3D scene is ready, the two scene-only buttons stay disabled
    disableControl('#light-toggle', 'Light control loading...');
    disableControl('#scene-reset');
  }


  /* ========================================================
     SECTION 11 - THREE.JS LOADING AND WEBGL CHECK
     Three.js is loaded once, from the CDN, only when WebGL works.
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
     SECTION 12 - THE 3D SCENE
     createScene builds the renderer, camera, lights and objects,
     then returns a small API used by the HTML side above.
     Colours here are hex numbers like 0xff8a1f (orange).
     ======================================================== */
  function createScene(T, container, mount) {

    /* ---- housekeeping: listeners are tracked so destroy() can remove them ---- */
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
      alpha: true,                       // transparent, so the CSS background shows through
      powerPreference: 'low-power'
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,
      smallScreen ? CONFIG.maxPixelRatioSmall : CONFIG.maxPixelRatio));
    var canvas = renderer.domElement;
    mount.appendChild(canvas);

    /* ---- scene, camera ---- */
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
    var lampLight = new T.PointLight(0xffe0b0, 0, 0, 2);   // the lamp: off until switched on
    scene.add(lampLight);

    /* ---- shared bookkeeping ---- */
    var disposables = [];            // textures made here, disposed on destroy
    var hitMeshes = [];              // only these can be clicked
    var entries = {};                // id -> { targets, mats, level, focus }
    var floaters = [];               // objects that bob gently
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

    /* ---- decorative textures (abstract shapes, NOT real data) ---- */
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

    function stdMat(color, emissive, emissiveIntensity, rough, metal) {
      return new T.MeshStandardMaterial({
        color: color,
        emissive: emissive || 0x000000,
        emissiveIntensity: emissiveIntensity || 0,
        roughness: rough === undefined ? 0.6 : rough,
        metalness: metal === undefined ? 0.2 : metal
      });
    }

    /* ======================================================
       BUILD THE WORKSPACE
       Units are arbitrary. The desk top surface is at y = 1.07.
       ====================================================== */
    var DESK_TOP = 1.07;

    // --- Desk (not clickable) ---
    var desk = new T.Group();
    var deskTop = new T.Mesh(new T.BoxGeometry(4.6, 0.14, 2.0), stdMat(0x2e2014, 0x000000, 0, 0.55, 0.25));
    deskTop.position.y = 1.0;
    desk.add(deskTop);
    var legGeo = new T.BoxGeometry(0.12, 1.0, 0.12);
    var legMat = stdMat(0x221810, 0x000000, 0, 0.7, 0.3);
    [[-2.15, 0.5, -0.9], [2.15, 0.5, -0.9], [-2.15, 0.5, 0.9], [2.15, 0.5, 0.9]].forEach(function (p) {
      var leg = new T.Mesh(legGeo, legMat);
      leg.position.set(p[0], p[1], p[2]);
      desk.add(leg);
    });
    var edge = new T.LineSegments(
      new T.EdgesGeometry(new T.BoxGeometry(4.6, 0.14, 2.0)),
      new T.LineBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.5 })
    );
    edge.position.y = 1.0;
    desk.add(edge);
    scene.add(desk);

    // --- Monitor (id: monitor) ---
    var monitor = new T.Group();
    var monMat = stdMat(0x1c140d, 0x3a1d05, 0.2, 0.4, 0.5);
    var base = new T.Mesh(new T.CylinderGeometry(0.35, 0.4, 0.04, 28), monMat);
    base.position.y = 0.02;
    var neck = new T.Mesh(new T.BoxGeometry(0.1, 0.5, 0.08), monMat);
    neck.position.y = 0.27;
    var bezel = new T.Mesh(new T.BoxGeometry(1.9, 1.1, 0.07), monMat);
    bezel.position.y = 1.05;
    var screenTex = makeTexture(512, 300, drawScreen);
    var screen = new T.Mesh(new T.PlaneGeometry(1.76, 0.96),
      new T.MeshBasicMaterial({ map: screenTex }));
    screen.position.set(0, 1.05, 0.04);
    monitor.add(base, neck, bezel, screen);
    monitor.position.set(0, DESK_TOP, -0.35);
    scene.add(monitor);
    register('monitor', monitor, [monitor], new T.Vector3(0, 2.0, 0));

    // --- Notebook (id: notebook) ---
    var notebook = new T.Group();
    var cover = new T.Mesh(new T.BoxGeometry(0.9, 0.05, 0.65), stdMat(0x6b3a1a, 0x55260a, 0.25, 0.7, 0.1));
    cover.position.y = 0.025;
    var pages = new T.Mesh(new T.BoxGeometry(0.84, 0.04, 0.6), stdMat(0xf3e6d3, 0x403020, 0.1, 0.9, 0));
    pages.position.y = 0.07;
    var strip = new T.Mesh(new T.BoxGeometry(0.06, 0.07, 0.62), stdMat(0xff8a1f, 0xff8a1f, 0.3, 0.5, 0.1));
    strip.position.set(-0.42, 0.06, 0);
    notebook.add(cover, pages, strip);
    notebook.position.set(-0.85, DESK_TOP, 0.55);
    notebook.rotation.y = 0.35;
    scene.add(notebook);
    register('notebook', notebook, [notebook], new T.Vector3(-0.8, 1.2, 0.5));

    // --- Chart cube (id: chart-cube) ---
    var cubeGroup = new T.Group();
    var cubeMesh = new T.Mesh(new T.BoxGeometry(0.5, 0.5, 0.5), stdMat(0x4a2305, 0xff8a1f, 0.3, 0.35, 0.4));
    var cubeEdges = new T.LineSegments(
      new T.EdgesGeometry(new T.BoxGeometry(0.52, 0.52, 0.52)),
      new T.LineBasicMaterial({ color: 0xffb347 })
    );
    cubeGroup.add(cubeMesh, cubeEdges);
    cubeGroup.position.set(1.45, DESK_TOP + 0.4, 0.45);
    scene.add(cubeGroup);
    register('chart-cube', cubeGroup, [cubeGroup], new T.Vector3(1.45, 1.5, 0.4));

    // --- Floating data cards (id: data-cards, three cards) ---
    var cardsRoot = new T.Group();
    var cardDefs = [
      { x: -2.1, y: 2.5, z: 0.3, ry: 0.35, kind: 0, phase: 0 },
      { x: 2.0, y: 2.6, z: 0.1, ry: -0.35, kind: 1, phase: 2 },
      { x: 0.6, y: 3.5, z: -0.6, ry: -0.1, kind: 2, phase: 4 }
    ];
    var cardGeo = new T.PlaneGeometry(1.0, 0.64);
    var cardEdgeGeo = new T.EdgesGeometry(cardGeo);
    var cardEdgeMat = new T.LineBasicMaterial({ color: 0xffb347 });
    var cardGroups = cardDefs.map(function (d) {
      var g = new T.Group();
      var tex = makeTexture(256, 164, drawCard(d.kind));
      var plane = new T.Mesh(cardGeo, new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide }));
      g.add(plane, new T.LineSegments(cardEdgeGeo, cardEdgeMat));
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

    // --- Lamp with pull cord (cord id: cord) ---
    var lampX = -1.5;
    var lamp = new T.Group();
    var wire = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 1.8, 6), stdMat(0x6b5642, 0, 0, 0.8, 0.2));
    wire.position.set(lampX, 3.8, 0.05);
    var shade = new T.Mesh(
      new T.ConeGeometry(0.42, 0.38, 28, 1, true),
      new T.MeshStandardMaterial({ color: 0x2a1b10, emissive: 0xffe0b0, emissiveIntensity: 0,
        roughness: 0.5, metalness: 0.4, side: T.DoubleSide })
    );
    shade.position.set(lampX, 2.98, 0.05);
    var bulbMat = new T.MeshStandardMaterial({ color: 0x8a8580, emissive: 0xffe0b0,
      emissiveIntensity: 0.1, roughness: 0.3, metalness: 0 });
    var bulb = new T.Mesh(new T.SphereGeometry(0.12, 18, 14), bulbMat);
    bulb.position.set(lampX, 2.82, 0.05);
    lamp.add(wire, shade, bulb);
    scene.add(lamp);
    lampLight.position.copy(bulb.position);

    // Cord: a thin line plus a bright knob. The cord is the clickable part.
    var cordBaseY = 2.74;
    var cordGroup = new T.Group();
    cordGroup.position.set(lampX + 0.28, cordBaseY, 0.05);
    var cordLine = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.9, 6), stdMat(0xd8cbbd, 0, 0, 0.8, 0));
    cordLine.position.y = -0.45;
    var knob = new T.Mesh(new T.SphereGeometry(0.075, 16, 12), stdMat(0xff8a1f, 0xff8a1f, 0.9, 0.3, 0.2));
    knob.position.y = -0.95;
    // Invisible fatter shape so a finger can hit the thin cord easily
    var cordHit = new T.Mesh(
      new T.CylinderGeometry(0.25, 0.25, 1.4, 10),
      new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    cordHit.position.y = -0.6;
    cordGroup.add(cordLine, knob, cordHit);
    scene.add(cordGroup);
    register('cord', cordGroup, [cordGroup], new T.Vector3(lampX, 2.0, 0));

    // --- Ambient particles (cheap: one Points object that turns slowly) ---
    var count = smallScreen ? CONFIG.particleCountSmall : CONFIG.particleCount;
    var positions = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 11;
      positions[i * 3 + 1] = 0.4 + Math.random() * 4.6;
      positions[i * 3 + 2] = -3.5 + Math.random() * 6;
    }
    var particleGeo = new T.BufferGeometry();
    particleGeo.setAttribute('position', new T.BufferAttribute(positions, 3));
    var particles = new T.Points(particleGeo, new T.PointsMaterial({
      color: 0xffb347, size: 0.045, transparent: true, opacity: 0.55, depthWrite: false
    }));
    scene.add(particles);

    // Which values can be animated, and where they should go
    var lampLevel = 0, lampTarget = 0, pull = 0;
    var hoverId = null, focusId = null;
    var cam = { x: CONFIG.camera.x, y: CONFIG.camera.y, z: CONFIG.camera.z,
      lx: CONFIG.lookAt.x, ly: CONFIG.lookAt.y, lz: CONFIG.lookAt.z };
    var parallax = { x: 0, y: 0 };
    var zoomFactor = 1;
    var paused = false, visible = !document.hidden, inView = true;
    var rafId = null, lastTime = 0, forceRender = true, destroyed = false;

    /* ---- animation helper: move a number toward a target smoothly ---- */
    function approach(current, target, rate, dt) {
      var d = target - current;
      if (Math.abs(d) < 0.0005) { return target; }
      changed = true;
      return current + d * (1 - Math.exp(-rate * dt));
    }

    /* How far the page has scrolled past the hero: 0 (top) to 1 (gone). */
    function scrollProgress() {
      if (reducedMotion || !CONFIG.scrollStrength) { return 0; }
      var h = container.offsetHeight || 1;
      return clamp(window.scrollY / (h * 1.4), 0, 1) * CONFIG.scrollStrength;
    }

    /* ======================================================
       PER-FRAME UPDATE
       ====================================================== */
    function update(dt, seconds) {
      // Lamp brightness and glow follow the light switch smoothly
      lampLevel = approach(lampLevel, lampTarget, 5, dt);
      lampLight.intensity = lampLevel * CONFIG.lampIntensity;
      bulbMat.emissiveIntensity = 0.1 + lampLevel * 3;
      bulbMat.color.setHex(lampLevel > 0.5 ? 0xfff2cc : 0x8a8580);
      shade.material.emissiveIntensity = lampLevel * 0.35;
      hemi.intensity = 0.55 + lampLevel * 0.25;

      // Cord dips when pulled, then springs back
      pull = approach(pull, 0, 6, dt);
      cordGroup.position.y = cordBaseY - pull * 0.14;

      // Hover and selection feedback (scale + glow)
      Object.keys(entries).forEach(function (id) {
        var e = entries[id];
        var target = Math.max(hoverId === id ? 0.7 : 0, selectedId === id ? 1 : 0);
        e.level = approach(e.level, target, 9, dt);
        var s = 1 + e.level * 0.06;
        e.targets.forEach(function (obj) { obj.scale.set(s, s, s); });
        e.mats.forEach(function (m) { m.emissiveIntensity = m.userData.baseEI + e.level * 0.6; });
      });

      // Gentle idle motion (skipped for reduced motion)
      var sway = 0;
      if (!reducedMotion) {
        floaters.forEach(function (g) {
          g.position.y = g.userData.baseY + Math.sin(seconds * 0.8 + g.userData.phase) * CONFIG.floatAmount;
        });
        cubeGroup.rotation.y += dt * 0.4;
        cubeGroup.position.y = DESK_TOP + 0.4 + Math.sin(seconds * 0.9) * 0.025;
        particles.rotation.y += dt * 0.015;
        sway = Math.sin(seconds * 0.3) * CONFIG.idleSway;
        changed = true;
      }

      // Camera: parallax + idle sway + scroll, and a soft look toward the selected object
      var sp = scrollProgress();
      var px = reducedMotion ? 0 : parallax.x * CONFIG.parallaxStrength;
      var py = reducedMotion ? 0 : parallax.y * CONFIG.parallaxStrength * 0.5;
      var focus = focusId && entries[focusId] ? entries[focusId].focus : null;
      var lookX = CONFIG.lookAt.x + (focus ? (focus.x - CONFIG.lookAt.x) * 0.3 : 0) + sp * 0.5;
      var lookY = CONFIG.lookAt.y + (focus ? (focus.y - CONFIG.lookAt.y) * 0.3 : 0);
      var lookZ = CONFIG.lookAt.z;

      cam.x = approach(cam.x, CONFIG.camera.x + px + sway + sp * 1.6, 4, dt);
      cam.y = approach(cam.y, CONFIG.camera.y + py + sp * 0.5, 4, dt);
      cam.z = approach(cam.z, CONFIG.camera.z * zoomFactor * (1 + sp * 0.3), 4, dt);
      cam.lx = approach(cam.lx, lookX, 4, dt);
      cam.ly = approach(cam.ly, lookY, 4, dt);
      cam.lz = approach(cam.lz, lookZ, 4, dt);
      camera.position.set(cam.x, cam.y, cam.z);
      camera.lookAt(cam.lx, cam.ly, cam.lz);
    }

    /* ======================================================
       RENDER LOOP (only one can ever run)
       Runs only while: page visible, scene on screen, not paused.
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
      renderer.setSize(w, h, false);          // CSS already sizes the canvas to 100%
      camera.aspect = w / h;
      // On narrow, tall shapes move the camera back so everything stays in view
      zoomFactor = Math.max(1, 1.35 / camera.aspect);
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
       POINTER INTERACTION
       - Tap or click: picks the object under the finger.
       - Mouse move: hover glow and camera parallax.
       - Page scrolling is never blocked (no preventDefault).
       ====================================================== */
    function pick(clientX, clientY) {
      var rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) { return null; }
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      camera.updateMatrixWorld();
      raycaster.setFromCamera(pointerNdc, camera);
      // Only registered objects are tested, so decoration never blocks a click
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
      if (moved > CONFIG.tapMovePx || elapsed > CONFIG.tapMaxMs) { return; }   // it was a scroll or drag
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
     SECTION 13 - START EVERYTHING (each feature runs once)
     ======================================================== */
  function init() {
    markJsReady();
    initMobileNav();
    initScrollState();
    initFooterYear();
    secureExternalLinks();
    initBackToTop();
    initReveal();
    initSceneControls();
    runDebugReport();
    initScene();       // last, because it is the heaviest and may fail
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
