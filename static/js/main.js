/* ============================================================
   CORTE DELLE ROSE — Main JS
   Custom cursor, header scroll, mobile nav, reveal, strip
   ============================================================ */

(function () {
  'use strict';

  /* ── Custom Cursor ──────────────────────────────────────── */
  const cursor = document.createElement('div');
  cursor.className = 'cursor';
  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  document.body.append(cursor, ring);

  let mx = -100, my = -100, rx = -100, ry = -100;
  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  document.addEventListener('mousedown', () => document.body.classList.add('cursor-click'));
  document.addEventListener('mouseup',   () => document.body.classList.remove('cursor-click'));

  const hoverEls = 'a,button,.room-card,.exp-card,.gallery-masonry__item';
  document.querySelectorAll(hoverEls).forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
  });

  let rafId;
  function animateCursor() {
    cursor.style.left = mx + 'px';
    cursor.style.top  = my + 'px';
    rx += (mx - rx) * 0.20;
    ry += (my - ry) * 0.20;
    ring.style.left = rx + 'px';
    ring.style.top  = ry + 'px';
    rafId = requestAnimationFrame(animateCursor);
  }
  animateCursor();

  /* ── Header Scroll & Hero Mode ──────────────────────────── */
  const header = document.getElementById('site-header');
  const hero   = document.getElementById('hero');

  function updateHeader() {
    const scrolled = window.scrollY > 30;
    header.classList.toggle('is-scrolled', scrolled);
    if (hero) {
      const heroBottom = hero.getBoundingClientRect().bottom;
      header.classList.toggle('is-hero', heroBottom > 80);
    }
  }
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  /* ── Mobile Nav ─────────────────────────────────────────── */
  const toggle    = document.querySelector('.nav-toggle');
  const mobileNav = document.getElementById('mobile-nav');

  if (toggle && mobileNav) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      mobileNav.hidden = open;
      mobileNav.classList.toggle('is-open', !open);
      document.body.style.overflow = open ? '' : 'hidden';
      // Stagger links
      mobileNav.querySelectorAll('.mobile-nav__link').forEach((a, i) => {
        a.style.transitionDelay = open ? '0ms' : `${i * 60}ms`;
      });
    });

    mobileNav.querySelectorAll('.mobile-nav__link').forEach(a => {
      a.addEventListener('click', () => {
        toggle.setAttribute('aria-expanded', 'false');
        mobileNav.hidden = true;
        mobileNav.classList.remove('is-open');
        document.body.style.overflow = '';
      });
    });
  }

  /* ── Scroll Reveal (IntersectionObserver) ───────────────── */
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length && 'IntersectionObserver' in window) {
    const revealObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          revealObs.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    reveals.forEach(el => revealObs.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('is-visible'));
  }

  /* ── GSAP ScrollTrigger Parallax (if available) ─────────── */
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    // Hero parallax
    const heroBg = document.querySelector('.hero__bg');
    if (heroBg) {
      gsap.to(heroBg, {
        y: '20%',
        ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
      });
    }

    // CTA banner parallax
    const ctaBg = document.querySelector('.cta-banner__bg');
    if (ctaBg) {
      gsap.to(ctaBg, {
        scale: 1,
        ease: 'none',
        scrollTrigger: { trigger: '.cta-banner', start: 'top bottom', end: 'bottom top', scrub: true }
      });
    }

    // Section numbers counter animation
    document.querySelectorAll('.usp__num').forEach(el => {
      const target = parseFloat(el.textContent);
      if (!isNaN(target)) {
        gsap.from(el, {
          textContent: 0,
          duration: 1.5,
          ease: 'power2.out',
          snap: { textContent: 1 },
          scrollTrigger: { trigger: el, start: 'top 85%' },
          onUpdate() { el.textContent = Math.ceil(parseFloat(el.textContent)) + (el.textContent.includes('+') ? '+' : el.textContent.includes('ha') ? 'ha' : ''); }
        });
      }
    });
  }

  /* ── Hero Image Crossfade ───────────────────────────────── */
  const img1 = document.querySelector('.hero__img--1');
  const img2 = document.querySelector('.hero__img--2');
  if (img1 && img2) {
    let show1 = true;
    setInterval(() => {
      show1 = !show1;
      img1.classList.toggle('is-hidden',  !show1);
      img2.classList.toggle('is-visible', !show1);
    }, 7000);
  }

  /* ── Home Booking Bar → Rooms Page ─────────────────────── */
  const hbCheckin  = document.getElementById('hb-checkin');
  const hbCheckout = document.getElementById('hb-checkout');
  const hbGuests   = document.getElementById('hb-guests');
  const hbSubmit   = document.getElementById('hb-submit');

  if (hbCheckin && window.flatpickr) {
    const hbFpIn = flatpickr(hbCheckin, {
      dateFormat: 'Y-m-d',
      minDate: 'today',
      disableMobile: true,
      onChange([d]) {
        hbFpOut.set('minDate', d);
      }
    });
    const hbFpOut = flatpickr(hbCheckout, {
      dateFormat: 'Y-m-d',
      minDate: new Date().fp_incr(1),
      disableMobile: true
    });
  }

  /* ── Contact Form (basic) ───────────────────────────────── */
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = contactForm.querySelector('[type=submit]');
      btn.disabled = true;
      btn.textContent = '…';
      await new Promise(r => setTimeout(r, 1200));
      btn.textContent = '✓ Sent!';
      setTimeout(() => { btn.disabled = false; btn.textContent = btn.dataset.orig || 'Send Message'; contactForm.reset(); }, 3000);
    });
    const btn = contactForm.querySelector('[type=submit]');
    if (btn) btn.dataset.orig = btn.textContent;
  }

  /* ── Smooth anchor scroll ───────────────────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });

})();
