// Seconda difesa contro gli annunci di YouTube: nasconde i riquadri pubblicitari,
// porta alla fine e salta un annuncio che parte lo stesso, e se compare l'avviso
// sugli ad blocker lo chiude e fa ripartire il video.
(() => {
  const style = document.createElement("style");
  style.textContent = `
    ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, ytd-promoted-sparkles-web-renderer,
    ytd-display-ad-renderer, ytd-banner-promo-renderer, ytd-statement-banner-renderer,
    ytd-companion-slot-renderer, ytd-action-companion-ad-renderer, ytd-player-legacy-desktop-watch-ads-renderer,
    #masthead-ad, #player-ads, .ytp-ad-overlay-container, .ytp-ad-image-overlay,
    ytm-promoted-sparkles-web-renderer, ytm-companion-ad-renderer, ad-slot-renderer,
    ytd-enforcement-message-view-model, tp-yt-paper-dialog:has(ytd-enforcement-message-view-model)
    { display: none !important; }`;
  (document.head || document.documentElement).appendChild(style);

  let pausedByWarning = false;
  function check() {
    const player = document.querySelector(".html5-video-player"),
      video = player?.querySelector("video");
    // Annuncio partito comunque: alla fine e "Salta"
    if (player?.classList.contains("ad-showing")) {
      if (video && Number.isFinite(video.duration) && video.duration > 0) video.currentTime = video.duration;
      document
        .querySelectorAll(".ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button-container button")
        .forEach((b) => b.click());
    }
    // Avviso sugli ad blocker: via la finestra e lo sfondo scuro, il video riparte
    const warning = document.querySelector("ytd-enforcement-message-view-model");
    if (warning) {
      warning.closest("tp-yt-paper-dialog")?.remove();
      warning.remove();
      document.querySelectorAll("tp-yt-iron-overlay-backdrop").forEach((b) => b.remove());
      document.body.style.removeProperty("overflow");
      pausedByWarning = true;
    }
    if (pausedByWarning && video?.paused && !player?.classList.contains("ad-showing")) {
      video.play().catch(() => {});
      pausedByWarning = false;
    }
  }
  new MutationObserver(check).observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
    childList: true,
  });
  setInterval(check, 500);
})();
