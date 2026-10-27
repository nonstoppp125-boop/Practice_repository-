/* =============================================================================
   script.js — Data Analyst Portfolio (GitHub Pages ready)
   -----------------------------------------------------------------------------
   Matched to the real index.html and style.css:
     menu button  = #nav-toggle        menu = #primary-nav
     nav links    = .nav-link          footer year = #current-year
   - Plain JavaScript (ES6+). No libraries, no build tools.
   - Works with: <script src="script.js" defer></script>
   - If one feature fails, the rest of the site keeps working.
   - To turn a feature OFF, change true to false in CONFIG below.
   - Smooth scrolling and back-to-top are NOT done here on purpose: your CSS
     already has scroll-behavior, scroll-padding-top and reduced-motion rules,
     and href="#top" works natively. Less code = fewer bugs.
   ============================================================================= */

(function () {
  "use strict";

  /* ===========================================================================
     1. CONFIGURATION AND INITIALIZATION
     You normally do NOT need to change anything here.
     =========================================================================== */
  const CONFIG = {
    // Feature switches: true = ON, false = OFF
    features: {
      mobileMenu: true,
      activeNavigation: true,
      externalLinkSafety: true,
      footerYear: true,
      placeholderCheck: true   // helper: lists leftover YOUR_... placeholders (see section 9)
    },

    // Must match the hamburger breakpoint in style.css (@media (max-width: 1180px)).
    // If you change it in CSS, change it here too.
    mobileBreakpointPx: 1180,

    // Class names added by this script. Must exist in your CSS (see the CSS block).
    openClass: "active",         // added to #primary-nav and #nav-toggle when menu is open
    activeLinkClass: "active",   // added to the nav link of the section you are reading

    // Selectors: first match wins. Add more names with commas if you rename things.
    selectors: {
      menuToggle: "#nav-toggle, .nav-toggle, .menu-toggle, .hamburger",
      menu: "#primary-nav, .primary-nav, .nav-links, .nav-menu",
      navLinks: ".nav-link",
      sections: "main > section[id]",
      footerYear: "#current-year, #year, [data-year]",
      topSection: "#home"
    }
  };

  /* ===========================================================================
     2. SAFE DOM UTILITIES
     =========================================================================== */
  const queryOne = (selector, root = document) => {
    try { return root.querySelector(selector); } catch (e) { return null; }
  };

  const queryAll = (selector, root = document) => {
    try { return Array.from(root.querySelectorAll(selector)); } catch (e) { return []; }
  };

  // Runs one feature safely. If it crashes, only that feature stops.
  function runSafely(featureName, featureFunction) {
    try {
      featureFunction();
    } catch (error) {
      console.warn("[portfolio] '" + featureName + "' was skipped:", error);
    }
  }

  // "#about" -> the element with id="about" (or null if there is none)
  function getSectionFromLink(link) {
    const href = link.getAttribute("href");
    if (!href || href.charAt(0) !== "#" || href.length < 2) return null;
    let id = href.slice(1);
    try { id = decodeURIComponent(id); } catch (e) { /* keep raw id */ }
    return document.getElementById(id);
  }

  /* ===========================================================================
     3. MOBILE NAVIGATION
     HTML (already there): <button id="nav-toggle" aria-expanded aria-controls="primary-nav">
                           <nav id="primary-nav"> ... </nav>
     CSS needed:           .primary-nav.active { display: flex; }  (in the CSS block I gave)
     =========================================================================== */
  function setupMobileMenu() {
    const toggleButton = queryOne(CONFIG.selectors.menuToggle);
    const menu = queryOne(CONFIG.selectors.menu);
    if (!toggleButton || !menu) return; // nothing to do

    const openClass = CONFIG.openClass;

    // Make sure the button and menu are connected for screen readers
    if (!menu.id) menu.id = "primary-nav";
    toggleButton.setAttribute("aria-controls", menu.id);

    const isOpen = () => menu.classList.contains(openClass);

    function setMenuState(shouldOpen) {
      menu.classList.toggle(openClass, shouldOpen);
      toggleButton.classList.toggle(openClass, shouldOpen);
      toggleButton.setAttribute("aria-expanded", String(shouldOpen));
    }

    setMenuState(false); // start clean so the visible state and aria-expanded always agree

    // A real <button> already supports Enter and Space, so only click is needed
    toggleButton.addEventListener("click", function () {
      setMenuState(!isOpen());
    });

    // Close when any link inside the menu is chosen (one listener for all links)
    menu.addEventListener("click", function (event) {
      if (event.target.closest && event.target.closest("a")) setMenuState(false);
    });

    // Escape closes the menu and returns focus to the button
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape" || !isOpen()) return;
      setMenuState(false);
      if (toggleButton.offsetParent !== null) toggleButton.focus(); // only if the button is visible
    });

    // Click outside closes the menu
    document.addEventListener("click", function (event) {
      if (!isOpen()) return;
      if (menu.contains(event.target) || toggleButton.contains(event.target)) return;
      setMenuState(false);
    });

    // When the screen becomes desktop-sized, reset the menu
    if (typeof window.matchMedia === "function") {
      const desktopQuery = window.matchMedia("(min-width: " + (CONFIG.mobileBreakpointPx + 1) + "px)");
      const onChange = function (e) { if (e.matches) setMenuState(false); };
      if (desktopQuery.addEventListener) desktopQuery.addEventListener("change", onChange);
      else if (desktopQuery.addListener) desktopQuery.addListener(onChange);
    }
  }

  /* ===========================================================================
     4. ACTIVE NAVIGATION AND SECTION TRACKING
     Highlights the nav link of the section you are reading.
     CSS needed: .nav-link.active { ... }  (in the CSS block I gave)
     Also sets aria-current="location" on the current link.
     Note: your page has an "approach" section but no nav link for it, so no link
     is highlighted while you read it. (Optional: add a nav link, see guide below.)
     =========================================================================== */
  function setupActiveNavigation() {
    let links = queryAll(CONFIG.selectors.navLinks);
    if (!links.length) {
      const menu = queryOne(CONFIG.selectors.menu);
      links = menu ? queryAll("a", menu) : [];
    }

    // Pair each valid in-page link with its section
    const sectionToLinks = new Map();
    links.forEach(function (link) {
      const section = getSectionFromLink(link);
      if (!section) return;
      if (!sectionToLinks.has(section)) sectionToLinks.set(section, []);
      sectionToLinks.get(section).push(link);
    });
    if (!sectionToLinks.size) return;

    const linkedSections = Array.from(sectionToLinks.keys());
    const lastLinkedSection = linkedSections[linkedSections.length - 1];
    const homeSection = queryOne(CONFIG.selectors.topSection);
    const firstLinkedSection = (homeSection && sectionToLinks.has(homeSection)) ? homeSection : linkedSections[0];

    const activeClass = CONFIG.activeLinkClass;
    let currentSection; // undefined at start, so the first update always runs

    function setActiveSection(section) {
      const key = section && sectionToLinks.has(section) ? section : null;
      if (key === currentSection) return; // no pointless DOM writes
      currentSection = key;
      links.forEach(function (link) {
        link.classList.remove(activeClass);
        link.removeAttribute("aria-current");
      });
      if (key) {
        sectionToLinks.get(key).forEach(function (link) {
          link.classList.add(activeClass);
          link.setAttribute("aria-current", "location");
        });
      }
    }

    // Main tracking: a thin "reading band" near the upper-middle of the screen.
    // We observe ALL top-level sections, so sections without a nav link clear the highlight.
    if ("IntersectionObserver" in window) {
      const observedSections = queryAll(CONFIG.selectors.sections);
      linkedSections.forEach(function (s) { if (observedSections.indexOf(s) === -1) observedSections.push(s); });

      const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActiveSection(entry.target);
        });
      }, { rootMargin: "-30% 0px -60% 0px", threshold: 0 });

      observedSections.forEach(function (section) { observer.observe(section); });
    }

    // Very top and very bottom of the page: one passive listener, limited to once per frame
    let framePending = false;
    function checkPageEdges() {
      framePending = false;
      const atTop = window.pageYOffset <= 10;
      const atBottom = window.innerHeight + window.pageYOffset >= document.documentElement.scrollHeight - 4;
      if (atTop) setActiveSection(firstLinkedSection);
      else if (atBottom) setActiveSection(lastLinkedSection);
    }
    window.addEventListener("scroll", function () {
      if (framePending) return;
      framePending = true;
      window.requestAnimationFrame(checkPageEdges);
    }, { passive: true });
    checkPageEdges();
  }

  /* ===========================================================================
     5. SMOOTH SCROLLING / 6. BACK-TO-TOP
     Intentionally handled by the browser + your CSS (html { scroll-behavior: smooth;
     scroll-padding-top } and the reduced-motion rule). The footer link
     <a class="back-to-top" href="#top"> works natively. Nothing to do here.
     =========================================================================== */

  /* ===========================================================================
     7. EXTERNAL-LINK ENHANCEMENT
     Never changes any link address and never forces new tabs.
     Only adds rel="noopener noreferrer" to links that already open in a new tab
     (your HTML already has it; this is just a safety net for links you add later).
     =========================================================================== */
  function setupExternalLinkSafety() {
    queryAll('a[target="_blank"]').forEach(function (link) {
      const tokens = (link.getAttribute("rel") || "").split(/\s+/).filter(Boolean);
      let changed = false;
      ["noopener", "noreferrer"].forEach(function (token) {
        if (tokens.indexOf(token) === -1) { tokens.push(token); changed = true; }
      });
      if (changed) link.setAttribute("rel", tokens.join(" "));
    });
  }

  /* ===========================================================================
     8. DYNAMIC FOOTER YEAR
     HTML (already there): &copy; <span id="current-year">YEAR</span> YOUR_NAME
     Only that small span changes. Uses the visitor's browser date.
     =========================================================================== */
  function setupFooterYear() {
    const yearElement = queryOne(CONFIG.selectors.footerYear);
    if (yearElement) yearElement.textContent = String(new Date().getFullYear());
  }

  /* ===========================================================================
     9. OPTIONAL PROGRESSIVE ENHANCEMENT: PLACEHOLDER CHECK
     Changes nothing on the page. When you open your site with  ?check=1  at the end
     of the address (example: https://you.github.io/repo/?check=1) and open the
     browser console (F12 > Console), it lists the YOUR_... placeholders you have
     not replaced yet. Normal visitors never see anything.
     =========================================================================== */
  function setupPlaceholderCheck() {
    if (!window.URLSearchParams || !new URLSearchParams(window.location.search).has("check")) return;
    const found = (document.body.textContent || "").match(/YOUR_[A-Z0-9_]+/g) || [];
    queryAll("a[href]").forEach(function (link) {
      const href = link.getAttribute("href") || "";
      const match = href.match(/YOUR_[A-Z0-9_]+/g);
      if (match) found.push.apply(found, match);
    });
    const unique = Array.from(new Set(found));
    if (unique.length) console.info("[portfolio] Placeholders still to replace:", unique.join(", "));
    else console.info("[portfolio] No YOUR_... placeholders found.");
  }

  /* ===========================================================================
     10. ERROR HANDLING AND SAFE START
     =========================================================================== */
  function initializePortfolio() {
    const f = CONFIG.features;
    if (f.mobileMenu) runSafely("mobile menu", setupMobileMenu);
    if (f.activeNavigation) runSafely("active navigation", setupActiveNavigation);
    if (f.externalLinkSafety) runSafely("external links", setupExternalLinkSafety);
    if (f.footerYear) runSafely("footer year", setupFooterYear);
    if (f.placeholderCheck) runSafely("placeholder check", setupPlaceholderCheck);
  }

  // Works whether the DOM is already ready or not, and never runs twice.
  let hasInitialized = false;
  function startOnce() {
    if (hasInitialized) return;
    hasInitialized = true;
    initializePortfolio();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startOnce);
  } else {
    startOnce();
  }
})();

/* =============================================================================
   GUIDE AND SUGGESTIONS (comments only: nothing here runs)
   =============================================================================

   HOW TO CHANGE THINGS
   --------------------
   1. Turn a feature off: in CONFIG.features change true to false.
   2. Menu or highlight not working? Make sure the CSS block for the navigation
      is pasted at the bottom of style.css (it defines .primary-nav.active and
      .nav-link.active). If you use other class names, change CONFIG.openClass
      and CONFIG.activeLinkClass.
   3. If you change the hamburger breakpoint in style.css (1180px), change
      CONFIG.mobileBreakpointPx to the same number.
   4. Add an "Approach" link to the menu (optional): in index.html, inside
      <ul class="nav-list">, after the Skills line add:
         <li><a class="nav-link" href="#approach">Approach</a></li>
      The script will highlight it automatically.
   5. Find leftover placeholders: open your live site with ?check=1 at the end of
      the address, press F12, open Console.

   ASSUMPTIONS
   -----------
   - Reviewed against your real index.html and style.css, but NOT run in a browser.
   - No links, results, certificates or statistics are created or changed here.
     Links like YOUR_GITHUB_URL stay broken until you replace them.

   SUGGESTIONS
   -----------
   - Replace "YEAR" in the footer HTML with the current year as a fallback for
     visitors without JavaScript.
   - Show 2-3 real projects first (dataset, question, tools, insight, link).
   - Add the resume PDF at assets/resume.pdf, or delete both Resume buttons.
   - Run Lighthouse (Chrome DevTools) after replacing all placeholders.
   ============================================================================= */
