document.addEventListener('DOMContentLoaded', function () {

  /* ── Mobile menu ── */
  var toggle = document.querySelector('.mobile-toggle');
  var menu = document.querySelector('.mobile-menu');
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      menu.classList.toggle('open');
    });
  }

  /* ── Sticky header shadow ── */
  var header = document.querySelector('header.site-header');
  if (header) {
    window.addEventListener('scroll', function () {
      header.classList.toggle('scrolled', window.scrollY > 20);
    }, { passive: true });
  }

  /* ── Scroll reveal ── */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var revealObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); revealObs.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { revealObs.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* ── Animated counters ── */
  var counters = document.querySelectorAll('[data-count]');
  if (counters.length && 'IntersectionObserver' in window) {
    var countObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        var target = parseFloat(el.dataset.count);
        var decimals = parseInt(el.dataset.decimals || '0', 10);
        var suffix = el.dataset.suffix || '';
        var duration = 1600;
        var start = null;
        function step(ts) {
          if (!start) start = ts;
          var pct = Math.min((ts - start) / duration, 1);
          var ease = 1 - Math.pow(1 - pct, 3);
          var val = target * ease;
          el.textContent = (decimals ? val.toFixed(decimals) : Math.floor(val)) + suffix;
          if (pct < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
        countObs.unobserve(el);
      });
    }, { threshold: 0.5 });
    counters.forEach(function (c) { countObs.observe(c); });
  }

  /* ── ROI Calculator ── */
  var traffic = document.getElementById('calc-traffic');
  var conv = document.getElementById('calc-conv');
  var output = document.getElementById('calc-output');
  function updateCalc() {
    if (!traffic || !conv || !output) return;
    var leads = Math.round((parseFloat(traffic.value) || 0) * (parseFloat(conv.value) || 0) / 100);
    output.textContent = leads.toLocaleString();
  }
  if (traffic) { traffic.addEventListener('input', updateCalc); conv.addEventListener('input', updateCalc); updateCalc(); }

  /* ── Tab switcher ── */
  document.querySelectorAll('.tab-switcher').forEach(function (sw) {
    var btns = sw.querySelectorAll('.tab-btn');
    var panels = sw.querySelectorAll('.tab-panel');
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        btns.forEach(function (b) { b.classList.remove('active'); });
        panels.forEach(function (p) { p.classList.remove('active'); });
        btn.classList.add('active');
        var target = sw.querySelector('.tab-panel[data-tab="' + btn.dataset.tab + '"]');
        if (target) target.classList.add('active');
      });
    });
  });

  /* ── Accordion ── */
  document.querySelectorAll('.accordion-trigger').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.parentElement;
      var wasOpen = item.classList.contains('open');
      document.querySelectorAll('.accordion-item.open').forEach(function (i) { i.classList.remove('open'); });
      if (!wasOpen) item.classList.add('open');
    });
  });

  /* ── Billing toggle ── */
  var billingSwitch = document.getElementById('billing-switch');
  if (billingSwitch) {
    var monthlyLabel = document.querySelector('[data-period-label="monthly"]');
    var annualLabel = document.querySelector('[data-period-label="annual"]');
    var monthlyPrices = document.querySelectorAll('.price-monthly');
    var annualPrices = document.querySelectorAll('.price-annual');
    billingSwitch.addEventListener('click', function () {
      var isAnnual = billingSwitch.getAttribute('aria-checked') === 'true';
      billingSwitch.setAttribute('aria-checked', String(!isAnnual));
      if (monthlyLabel) monthlyLabel.classList.toggle('active', isAnnual);
      if (annualLabel) annualLabel.classList.toggle('active', !isAnnual);
      monthlyPrices.forEach(function (el) { el.style.display = isAnnual ? '' : 'none'; });
      annualPrices.forEach(function (el) { el.style.display = isAnnual ? 'none' : ''; });
    });
  }

  /* ── Auth tabs ── */
  document.querySelectorAll('.auth-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.auth-tab').forEach(function (t) { t.classList.remove('active'); });
      document.querySelectorAll('.auth-panel').forEach(function (p) { p.classList.remove('active'); });
      tab.classList.add('active');
      var panel = document.getElementById(tab.dataset.target);
      if (panel) panel.classList.add('active');
    });
  });

  /* ── Back to top ── */
  var toTop = document.querySelector('.to-top');
  if (toTop) {
    window.addEventListener('scroll', function () {
      toTop.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ── Dashboard nav ── */
  var navButtons = document.querySelectorAll('.dash-nav button[data-section]');
  navButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      navButtons.forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.dash-section').forEach(function (s) { s.classList.remove('active'); });
      btn.classList.add('active');
      var sec = document.getElementById(btn.dataset.section);
      if (sec) sec.classList.add('active');
    });
  });

});
