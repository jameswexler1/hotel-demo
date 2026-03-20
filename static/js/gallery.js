/* ============================================================
   CORTE DELLE ROSE — Gallery JS (GLightbox init)
   ============================================================ */
(function () {
  'use strict';
  if (!window.GLightbox) return;

  GLightbox({
    selector: '.glightbox',
    touchNavigation: true,
    loop: true,
    autoplayVideos: false,
    openEffect: 'fade',
    closeEffect: 'fade',
    cssEfects: {
      fade: { in: 'fadeIn', out: 'fadeOut' }
    }
  });
})();
