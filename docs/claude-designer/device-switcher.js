/**
 * Device Switcher — shared JS
 * Clone DOM approach (no iframe = no black screen)
 *
 * Usage: include this script at bottom of page, after your app markup.
 * Requires: device-switcher.css loaded in <head>
 * Requires: page root element with class "app" (or pass selector to init)
 *
 * <script src="device-switcher.js"></script>
 */
(function() {
  'use strict';

  const DEVS = {
    desktop: { lbl:'Desktop',          cls:'',      w:0,    h:0,    icon:'M2 3h20a2 2 0 0 1 0 17H2a2 2 0 0 1 0-17zm6 18h8M12 17v4' },
    laptop:  { lbl:'Laptop · 1280×800',cls:'laptop',w:1280, h:800,  icon:'M2 4h20v13H2zM0 21h24' },
    tablet:  { lbl:'Tablet · 820×1180',cls:'tablet',w:820,  h:1180, icon:'M4 2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 16h.01' },
    mobile:  { lbl:'Mobile · 390×844', cls:'mobile',w:390,  h:844,  icon:'M5 2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm7 16h.01' },
  };

  function svgIcon(d) {
    return `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="${d}"/></svg>`;
  }

  // Inject HTML
  document.body.insertAdjacentHTML('beforeend', `
<div class="dvsw" id="__dvsw">
  <div class="dvmenu hid" id="__dvmenu">
    <div class="dvmenu-title">Preview Device</div>
    <button class="dvbtn on" data-dv="desktop">${svgIcon(DEVS.desktop.icon)} Desktop <span class="dvz">1440+</span></button>
    <button class="dvbtn"     data-dv="laptop"> ${svgIcon(DEVS.laptop.icon)}  Laptop  <span class="dvz">1280×800</span></button>
    <button class="dvbtn"     data-dv="tablet"> ${svgIcon(DEVS.tablet.icon)}  Tablet  <span class="dvz">820×1180</span></button>
    <button class="dvbtn"     data-dv="mobile"> ${svgIcon(DEVS.mobile.icon)}  Mobile  <span class="dvz">390×844</span></button>
  </div>
  <button class="dvtog" id="__dvtog" title="Preview device size">
    ${svgIcon(DEVS.desktop.icon)}
  </button>
</div>

<div class="dvov" id="__dvov">
  <div class="dvlbl" id="__dvlbl">Desktop</div>
  <div class="dvbezel" id="__dvbezel">
    <div class="dvscroll" id="__dvscroll">
      <div class="dvclone" id="__dvclone"></div>
    </div>
  </div>
  <button class="dvclose" id="__dvclose">
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    Tutup · ESC
  </button>
</div>
`);

  let menuOpen = false;
  let activeDev = 'desktop';

  const tog    = document.getElementById('__dvtog');
  const menu   = document.getElementById('__dvmenu');
  const ov     = document.getElementById('__dvov');
  const bezel  = document.getElementById('__dvbezel');
  const scroll = document.getElementById('__dvscroll');
  const clone  = document.getElementById('__dvclone');
  const lbl    = document.getElementById('__dvlbl');
  const close_ = document.getElementById('__dvclose');

  // Toggle menu
  tog.addEventListener('click', function(e) {
    e.stopPropagation();
    menuOpen = !menuOpen;
    menu.classList.toggle('hid', !menuOpen);
    tog.classList.toggle('on', menuOpen);
  });

  // Device buttons
  document.getElementById('__dvsw').addEventListener('click', function(e) {
    const btn = e.target.closest('[data-dv]');
    if (!btn) return;
    const key = btn.dataset.dv;
    activeDev = key;

    // Update buttons
    document.querySelectorAll('[data-dv]').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');

    // Update toggle icon
    tog.innerHTML = btn.querySelector('svg').outerHTML;

    // Close menu
    menuOpen = false;
    menu.classList.add('hid');
    tog.classList.remove('on');

    if (key === 'desktop') { ov.classList.remove('on'); return; }

    const d = DEVS[key];
    lbl.textContent = d.lbl;

    // Reset bezel classes
    bezel.classList.remove('mobile', 'tablet', 'laptop');
    if (d.cls) bezel.classList.add(d.cls);

    // Clone page content
    const app = document.querySelector('.app') || document.body;
    const cloned = app.cloneNode(true);

    // Remove device switcher and tweaks from clone
    cloned.querySelectorAll('#__dvsw,#__dvov,.tw-tog,.tweaks-panel,.tweaks-toggle,.tw-pan').forEach(el => el.remove());

    // Compute scale
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min((vw * 0.9) / d.w, (vh * 0.82) / d.h, 1);

    // Style bezel
    bezel.style.width  = d.w + 'px';
    bezel.style.height = d.h + 'px';
    bezel.style.transform = `scale(${scale})`;

    // Set clone width
    cloned.style.cssText = `width:${d.w}px;min-height:${d.h}px;overflow:hidden;position:relative;pointer-events:none;`;
    clone.innerHTML = '';
    clone.appendChild(cloned);

    // Scroll to top
    scroll.scrollTop = 0;

    ov.classList.add('on');
  });

  // Close
  function closeOv() {
    ov.classList.remove('on');
    clone.innerHTML = '';
    activeDev = 'desktop';
    document.querySelectorAll('[data-dv]').forEach(b => b.classList.remove('on'));
    document.querySelector('[data-dv="desktop"]').classList.add('on');
    tog.innerHTML = svgIcon(DEVS.desktop.icon);
    if (menuOpen) { menuOpen = false; menu.classList.add('hid'); tog.classList.remove('on'); }
  }
  close_.addEventListener('click', closeOv);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOv(); });

  // Close menu on outside click
  document.addEventListener('click', function(e) {
    if (menuOpen && !document.getElementById('__dvsw').contains(e.target)) {
      menuOpen = false;
      menu.classList.add('hid');
      tog.classList.remove('on');
    }
  });

})();
