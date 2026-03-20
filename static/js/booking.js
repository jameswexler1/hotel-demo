/* ============================================================
   CORTE DELLE ROSE — Booking JS
   Drawer, flatpickr, Stripe Elements, voucher PDF
   ============================================================ */

(function () {
  'use strict';

  /* ── State ──────────────────────────────────────────────── */
  const state = {
    roomId:    null,
    roomName:  null,
    roomPrice: 0,
    roomImg:   null,
    capacity:  2,
    checkin:   null,
    checkout:  null,
    nights:    0,
    total:     0,
    guests:    2,
    firstName: '',
    lastName:  '',
    email:     '',
    phone:     '',
    requests:  '',
    bookingRef: '',
    step:      1
  };

  /* ── DOM refs ────────────────────────────────────────────── */
  const overlay        = document.getElementById('bookingOverlay');
  const drawer         = document.getElementById('bookingDrawer');
  const closeBtn       = document.getElementById('bookingClose');
  const roomImg        = document.getElementById('bookingRoomImg');
  const roomName       = document.getElementById('bookingRoomName');
  const roomPriceEl    = document.getElementById('bookingRoomPrice');
  const stepIndicators = document.querySelectorAll('.booking-step');

  const panel1      = document.getElementById('stepPanel1');
  const panel2      = document.getElementById('stepPanel2');
  const panel3      = document.getElementById('stepPanel3');
  const successEl   = document.getElementById('bookingSuccess');

  const bdCheckin   = document.getElementById('bd-checkin');
  const bdCheckout  = document.getElementById('bd-checkout');
  const bdGuests    = document.getElementById('bd-guests');
  const nextDatesBtn   = document.getElementById('stepNextDates');
  const backDatesBtn   = document.getElementById('stepBackDates');
  const nextDetailsBtn = document.getElementById('stepNextDetails');
  const backDetailsBtn = document.getElementById('stepBackDetails');
  const payBtn      = document.getElementById('payBtn');
  const payBtnText  = document.getElementById('payBtnText');
  const payBtnLoad  = document.getElementById('payBtnLoading');
  const summaryEl   = document.getElementById('bookingSummary');
  const summaryNightsEl = document.getElementById('summaryNights');
  const summaryTotalEl  = document.getElementById('summaryTotal');
  const finalSummaryEl  = document.getElementById('bookingFinalSummary');
  const downloadBtn = document.getElementById('downloadVoucher');

  // Room single page card
  const openBtn     = document.getElementById('openBookingDrawer');
  const rcCheckin   = document.getElementById('rc-checkin');
  const rcCheckout  = document.getElementById('rc-checkout');
  const rcSummary   = document.getElementById('rcSummary');
  const rcTotal     = document.getElementById('rc-total') || document.getElementById('rcTotal');

  if (!overlay || !drawer) return; // not on a page with the drawer

  /* ── Flatpickr helpers ───────────────────────────────────── */
  let fpIn, fpOut;

  function initDatePickers(blockedDates) {
    if (!bdCheckin || !bdCheckout || !window.flatpickr) return;

    fpIn = flatpickr(bdCheckin, {
      dateFormat: 'Y-m-d',
      minDate: 'today',
      disableMobile: true,
      disable: blockedDates || [],
      onChange([d]) {
        const next = new Date(d);
        next.setDate(next.getDate() + 1);
        fpOut.set('minDate', next);
        fpOut.clear();
        state.checkin = d ? formatDate(d) : null;
        state.checkout = null;
        updateDateSummary();
        updateNextDatesBtn();
      }
    });

    fpOut = flatpickr(bdCheckout, {
      dateFormat: 'Y-m-d',
      minDate: new Date().fp_incr(1),
      disableMobile: true,
      disable: blockedDates || [],
      onChange([d]) {
        state.checkout = d ? formatDate(d) : null;
        updateDateSummary();
        updateNextDatesBtn();
      }
    });
  }

  // Room-card date pickers on single room page
  if (rcCheckin && window.flatpickr && window.CDR && window.CDR.currentRoom) {
    const blocked = window.CDR.currentRoomBlocked || [];
    const rcFpIn = flatpickr(rcCheckin, {
      dateFormat: 'Y-m-d',
      minDate: 'today',
      disable: blocked,
      disableMobile: true,
      onChange([d]) {
        const next = new Date(d); next.setDate(next.getDate() + 1);
        rcFpOut.set('minDate', next);
        rcFpOut.clear();
        updateRcSummary();
      }
    });
    const rcFpOut = flatpickr(rcCheckout, {
      dateFormat: 'Y-m-d',
      minDate: new Date().fp_incr(1),
      disable: blocked,
      disableMobile: true,
      onChange() { updateRcSummary(); }
    });

    function updateRcSummary() {
      const ci = rcFpIn.selectedDates[0];
      const co = rcFpOut.selectedDates[0];
      if (!ci || !co) { if (rcSummary) rcSummary.hidden = true; return; }
      const nights = Math.round((co - ci) / 864e5);
      const total  = nights * window.CDR.currentRoom.price;
      if (rcSummary) rcSummary.hidden = false;
      if (rcTotal)   rcTotal.textContent = '€' + total.toLocaleString('de-DE');
    }
  }

  /* ── Open drawer ─────────────────────────────────────────── */
  function openDrawer(rId, rName, rPrice, rImg, rCapacity) {
    state.roomId   = rId;
    state.roomName = rName;
    state.roomPrice= parseFloat(rPrice) || 0;
    state.roomImg  = rImg;
    state.capacity = parseInt(rCapacity) || 2;
    state.step     = 1;

    // Update banner
    if (roomImg)     { roomImg.src = rImg; roomImg.alt = rName; }
    if (roomName)    roomName.textContent = rName;
    if (roomPriceEl) roomPriceEl.textContent = 'from €' + state.roomPrice + ' / night';

    // Update guest options
    if (bdGuests) {
      bdGuests.innerHTML = '';
      for (let i = 1; i <= state.capacity; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i + (i === 1 ? ' Guest' : ' Guests');
        if (i === 2) opt.selected = true;
        bdGuests.appendChild(opt);
      }
    }

    // Init date pickers with this room's blocked dates
    const blocked = (window.CDR && window.CDR.blockedDates) ? (window.CDR.blockedDates[rId] || []) : [];
    if (fpIn) { fpIn.destroy(); fpOut.destroy(); }
    initDatePickers(blocked);

    // Reset panels
    goToStep(1);
    resetSuccess();

    // Open
    overlay.classList.add('is-open');
    overlay.removeAttribute('aria-hidden');
    drawer.classList.add('is-open');
    drawer.removeAttribute('aria-hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => closeBtn && closeBtn.focus(), 300);
  }

  function closeDrawer() {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  overlay.addEventListener('click', closeDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

  /* ── Trigger from room card button ──────────────────────── */
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      openDrawer(
        openBtn.dataset.roomId,
        openBtn.dataset.roomName,
        openBtn.dataset.roomPrice,
        openBtn.dataset.roomImage,
        openBtn.dataset.roomCapacity
      );
    });
  }

  // "Book Now" buttons on room cards
  document.querySelectorAll('[data-room-id]').forEach(btn => {
    if (btn === openBtn) return;
    btn.addEventListener('click', e => {
      e.preventDefault();
      openDrawer(
        btn.dataset.roomId,
        btn.dataset.roomName,
        btn.dataset.roomPrice,
        btn.dataset.roomImage,
        btn.dataset.roomCapacity
      );
    });
  });

  /* ── Step management ─────────────────────────────────────── */
  function goToStep(n) {
    state.step = n;
    [panel1, panel2, panel3].forEach((p, i) => {
      if (!p) return;
      p.hidden = (i + 1) !== n;
    });
    stepIndicators.forEach(el => {
      const s = parseInt(el.dataset.step);
      el.classList.toggle('is-active', s === n);
      el.classList.toggle('is-done',   s < n);
    });
    if (n === 3) buildStripe();
  }

  /* ── Date / nights logic ─────────────────────────────────── */
  function formatDate(d) {
    return d.toISOString().split('T')[0];
  }
  function calcNights() {
    if (!state.checkin || !state.checkout) return 0;
    const ci = new Date(state.checkin);
    const co = new Date(state.checkout);
    return Math.max(0, Math.round((co - ci) / 864e5));
  }
  function updateDateSummary() {
    state.nights = calcNights();
    state.total  = state.nights * state.roomPrice;
    if (!summaryEl) return;
    if (state.nights > 0) {
      summaryEl.hidden = false;
      summaryNightsEl.textContent = state.nights + (state.nights === 1 ? ' night' : ' nights');
      summaryTotalEl.textContent  = '€' + state.total.toLocaleString('de-DE');
    } else {
      summaryEl.hidden = true;
    }
  }
  function updateNextDatesBtn() {
    if (nextDatesBtn) nextDatesBtn.disabled = !(state.checkin && state.checkout && state.nights > 0);
  }

  if (nextDatesBtn) {
    nextDatesBtn.addEventListener('click', () => {
      state.guests = parseInt(bdGuests?.value) || 2;
      goToStep(2);
    });
  }
  if (backDatesBtn)   backDatesBtn.addEventListener('click',   () => goToStep(1));
  if (backDetailsBtn) backDetailsBtn.addEventListener('click', () => goToStep(2));

  if (nextDetailsBtn) {
    nextDetailsBtn.addEventListener('click', () => {
      const fn = document.getElementById('bd-firstname');
      const ln = document.getElementById('bd-lastname');
      const em = document.getElementById('bd-email');
      if (!fn?.value.trim() || !ln?.value.trim() || !em?.value.includes('@')) {
        alert('Please fill in your name and a valid email address.'); return;
      }
      state.firstName = fn.value.trim();
      state.lastName  = ln.value.trim();
      state.email     = em.value.trim();
      state.phone     = document.getElementById('bd-phone')?.value.trim() || '';
      state.requests  = document.getElementById('bd-requests')?.value.trim() || '';
      buildFinalSummary();
      goToStep(3);
    });
  }

  function buildFinalSummary() {
    if (!finalSummaryEl) return;
    finalSummaryEl.innerHTML = `
      <strong>${state.roomName}</strong>
      <div style="display:flex;flex-direction:column;gap:4px;font-size:0.85rem;color:var(--stone)">
        <span>Check-in: ${state.checkin}</span>
        <span>Check-out: ${state.checkout}</span>
        <span>${state.nights} night${state.nights !== 1 ? 's' : ''} · ${state.guests} guest${state.guests !== 1 ? 's' : ''}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:12px;padding-top:12px;border-top:1px solid var(--cream-dark)">
        <span style="font-size:0.75rem;color:var(--stone);letter-spacing:0.1em;text-transform:uppercase">Total</span>
        <strong style="font-family:var(--font-display);font-size:1.8rem;color:var(--olive)">€${state.total.toLocaleString('de-DE')}</strong>
      </div>`;
  }

  /* ── Stripe ──────────────────────────────────────────────── */
  let stripe, cardElement;

  function buildStripe() {
    const key = window.CDR?.stripeKey;
    if (!key || !window.Stripe || stripe) return;
    stripe = Stripe(key);
    const elements = stripe.elements({ locale: window.CDR?.lang || 'en' });
    const stripeContainer = document.getElementById('stripe-card-element');
    if (!stripeContainer || stripeContainer.dataset.mounted) return;
    cardElement = elements.create('card', {
      style: {
        base: {
          fontFamily: "'Jost', sans-serif",
          fontSize: '15px',
          color: '#1C1E19',
          '::placeholder': { color: '#9A9186' }
        }
      }
    });
    cardElement.mount('#stripe-card-element');
    stripeContainer.dataset.mounted = 'true';
    cardElement.on('change', e => {
      const errEl = document.getElementById('stripe-card-errors');
      if (errEl) errEl.textContent = e.error ? e.error.message : '';
    });
  }

  /* ── Payment submission ──────────────────────────────────── */
  if (payBtn) {
    payBtn.addEventListener('click', async () => {
      if (!stripe || !cardElement) return;

      payBtnText.hidden = true;
      payBtnLoad.hidden = false;
      payBtn.disabled   = true;

      try {
        // 1. Create PaymentIntent on server
        const piRes = await fetch(`${window.CDR.apiBase}/create-payment-intent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId:    state.roomId,
            roomName:  state.roomName,
            checkin:   state.checkin,
            checkout:  state.checkout,
            nights:    state.nights,
            guests:    state.guests,
            total:     state.total,
            email:     state.email,
            firstName: state.firstName,
            lastName:  state.lastName,
            lang:      window.CDR?.lang || 'en'
          })
        });

        const piData = await piRes.json();

        if (!piRes.ok || piData.error) throw new Error(piData.error || 'Payment setup failed.');

        // 2. Confirm card payment
        const { error: stripeErr } = await stripe.confirmCardPayment(piData.clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: {
              name:  `${state.firstName} ${state.lastName}`,
              email: state.email,
              phone: state.phone
            }
          }
        });

        if (stripeErr) throw new Error(stripeErr.message);

        // 3. Success
        state.bookingRef = piData.bookingRef || 'CDR-' + Math.random().toString(36).slice(2,8).toUpperCase();
        showSuccess();

      } catch (err) {
        const errEl = document.getElementById('stripe-card-errors');
        if (errEl) errEl.textContent = err.message;
        payBtnText.hidden = false;
        payBtnLoad.hidden = true;
        payBtn.disabled   = false;
      }
    });
  }

  /* ── Success state ───────────────────────────────────────── */
  function showSuccess() {
    [panel1, panel2, panel3].forEach(p => { if (p) p.hidden = true; });
    if (successEl) successEl.hidden = false;
  }
  function resetSuccess() {
    if (successEl) successEl.hidden = true;
    if (payBtnText) payBtnText.hidden = false;
    if (payBtnLoad) payBtnLoad.hidden = true;
    if (payBtn)     payBtn.disabled = false;
    const errEl = document.getElementById('stripe-card-errors');
    if (errEl) errEl.textContent = '';
    // Reset stripe card
    if (cardElement) { cardElement.clear(); }
    stripe = null; cardElement = null;
    const sc = document.getElementById('stripe-card-element');
    if (sc) delete sc.dataset.mounted;
  }

  /* ── PDF Voucher (jsPDF via CDN) ─────────────────────────── */
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      if (!window.jspdf) { alert('PDF library not loaded yet. Please try again in a moment.'); return; }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const W = 210, H = 297;
      const margin = 20;

      // Background
      doc.setFillColor(247, 241, 232);
      doc.rect(0, 0, W, H, 'F');

      // Header bar
      doc.setFillColor(45, 59, 44);
      doc.rect(0, 0, W, 52, 'F');

      // Rose accent stripe
      doc.setFillColor(201, 132, 110);
      doc.rect(0, 52, W, 4, 'F');

      // Hotel name
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(28);
      doc.setTextColor(247, 241, 232);
      doc.text('Corte delle Rose', margin, 28);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(201, 132, 110);
      doc.text('BOOKING CONFIRMATION & VOUCHER', margin, 40);

      // Booking ref box
      doc.setFillColor(184, 147, 63);
      doc.roundedRect(W - 80, 12, 60, 26, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text('BOOKING REF', W - 72, 22, { align: 'center' });
      doc.setFontSize(13);
      doc.text(state.bookingRef, W - 72 + 12, 32, { align: 'center' });

      // Section: Reservation Details
      let y = 76;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(201, 132, 110);
      doc.text('RESERVATION DETAILS', margin, y);

      doc.setDrawColor(235, 225, 210);
      doc.line(margin, y + 3, W - margin, y + 3);

      y += 14;
      const col2 = 110;

      function row(label, value, yPos) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(154, 145, 134);
        doc.text(label, margin, yPos);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(28, 30, 25);
        doc.text(value, margin, yPos + 7);
      }

      row('ROOM', state.roomName, y);
      row('CHECK-IN', state.checkin, y, col2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(154, 145, 134);
      doc.text('CHECK-IN', col2, y);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(28, 30, 25);
      doc.text(state.checkin, col2, y + 7);

      y += 24;
      row('NIGHTS', String(state.nights), y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(154, 145, 134);
      doc.text('CHECK-OUT', col2, y);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(28, 30, 25);
      doc.text(state.checkout, col2, y + 7);

      y += 24;
      row('GUESTS', String(state.guests), y);

      // Guest section
      y += 32;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(201, 132, 110);
      doc.text('GUEST INFORMATION', margin, y);
      doc.setDrawColor(235, 225, 210);
      doc.line(margin, y + 3, W - margin, y + 3);

      y += 14;
      row('GUEST NAME', `${state.firstName} ${state.lastName}`, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(154, 145, 134);
      doc.text('EMAIL', col2, y);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(28, 30, 25);
      doc.text(state.email, col2, y + 7);

      if (state.requests) {
        y += 24;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(154, 145, 134);
        doc.text('SPECIAL REQUESTS', margin, y);
        doc.setFontSize(9);
        doc.setTextColor(28, 30, 25);
        const lines = doc.splitTextToSize(state.requests, W - margin * 2);
        doc.text(lines, margin, y + 7);
        y += lines.length * 6;
      }

      // Total box
      y += 24;
      doc.setFillColor(45, 59, 44);
      doc.roundedRect(margin, y, W - margin * 2, 36, 2, 2, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(201, 132, 110);
      doc.text('TOTAL AMOUNT PAID', margin + 12, y + 12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24);
      doc.setTextColor(247, 241, 232);
      doc.text('€' + state.total.toLocaleString('de-DE'), margin + 12, y + 28);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(154, 145, 134);
      doc.text(`${state.nights} night${state.nights !== 1 ? 's' : ''} × €${state.roomPrice}`, W - margin - 8, y + 28, { align: 'right' });

      // Hotel info footer
      y = H - 52;
      doc.setDrawColor(201, 132, 110);
      doc.setLineWidth(0.5);
      doc.line(margin, y, W - margin, y);
      y += 10;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(154, 145, 134);
      doc.text('Via delle Rose 12, 25030 Castrezzato (BS), Lombardia, Italia', margin, y);
      doc.text('+39 030 123 4567  ·  info@cortedellrose.com', margin, y + 6);
      doc.text('corteroscampagna.com', margin, y + 12);

      // Check-in info
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(201, 132, 110);
      doc.text('CHECK-IN 15:00   ·   CHECK-OUT 11:00', W - margin, y + 6, { align: 'right' });

      // Save
      doc.save(`CortedelleRose-${state.bookingRef}.pdf`);
    });
  }

})();
