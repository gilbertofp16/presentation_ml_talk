// Minimal slide engine: keyboard navigation, URL hash, notes panel,
// and a presenter window kept in sync over BroadcastChannel.

(() => {
  "use strict";

  const STAGE_WIDTH = 1280;
  const STAGE_HEIGHT = 720;
  const TALK_MINUTES = 20;

  const stage = document.querySelector(".stage");
  const slides = Array.from(document.querySelectorAll(".slide"));
  const progress = document.querySelector(".progress");
  const notesPanel = document.querySelector(".notes-panel");
  const isPresenter = new URLSearchParams(location.search).has("presenter");
  const channel = "BroadcastChannel" in window ? new BroadcastChannel("genai-maturity-deck") : null;

  let current = 0;
  let timerStart = null;

  function clampIndex(n) {
    return Math.max(0, Math.min(slides.length - 1, n));
  }

  function slideTitle(slide) {
    if (!slide) return "End of deck";
    const heading = slide.querySelector("h1, h2, blockquote");
    return slide.dataset.title || (heading ? heading.textContent.trim().replace(/\s+/g, " ") : "Untitled");
  }

  function notesHtml(slide) {
    const notes = slide.querySelector(".notes");
    return notes ? notes.innerHTML : "<p>No notes for this slide.</p>";
  }

  function fitStage() {
    const scale = Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT);
    stage.style.transform = `scale(${scale})`;
  }

  function render() {
    slides.forEach((slide, k) => slide.classList.toggle("active", k === current));
    const active = slides[current];
    const accent = getComputedStyle(active).getPropertyValue("--accent");
    progress.style.width = `${((current + 1) / slides.length) * 100}%`;
    progress.style.background = accent;
    notesPanel.innerHTML = notesHtml(active);
    if (isPresenter) renderPresenter();
  }

  function goTo(n, { broadcast = true } = {}) {
    current = clampIndex(n);
    history.replaceState(null, "", `${location.search}#${current + 1}`);
    render();
    if (broadcast && channel) channel.postMessage({ type: "goto", index: current });
  }

  // ---------- Presenter view ----------

  function formatElapsed(ms) {
    const total = Math.floor(ms / 1000);
    const m = String(Math.floor(total / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  function renderPresenter() {
    document.querySelector(".p-count").textContent = `Slide ${current + 1} / ${slides.length}`;
    document.querySelector(".p-title").textContent = slideTitle(slides[current]);
    document.querySelector(".p-next").textContent = `Next: ${slideTitle(slides[current + 1])}`;
    document.querySelector(".p-notes-body").innerHTML = notesHtml(slides[current]);
  }

  function tickTimer() {
    const el = document.querySelector(".p-timer");
    if (!timerStart) {
      el.textContent = "00:00";
      return;
    }
    const elapsed = Date.now() - timerStart;
    el.textContent = formatElapsed(elapsed);
    el.classList.toggle("over", elapsed > TALK_MINUTES * 60 * 1000);
  }

  function setupPresenter() {
    document.body.classList.add("presenter");
    document.querySelector(".p-start").addEventListener("click", () => {
      timerStart = Date.now();
    });
    setInterval(tickTimer, 500);
  }

  function openPresenterWindow() {
    const url = `${location.pathname}?presenter#${current + 1}`;
    window.open(url, "genai-maturity-presenter", "width=1100,height=720");
  }

  // ---------- Input ----------

  function onKey(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
      case "PageDown":
      case " ":
        event.preventDefault();
        goTo(current + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
      case "PageUp":
        event.preventDefault();
        goTo(current - 1);
        break;
      case "Home":
        goTo(0);
        break;
      case "End":
        goTo(slides.length - 1);
        break;
      case "n":
      case "N":
        notesPanel.classList.toggle("open");
        break;
      case "p":
      case "P":
        if (!isPresenter) openPresenterWindow();
        break;
      case "f":
      case "F":
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
        break;
      default:
        break;
    }
  }

  function setupTouch() {
    let startX = null;
    window.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; }, { passive: true });
    window.addEventListener("touchend", (e) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) goTo(current + (dx < 0 ? 1 : -1));
      startX = null;
    });
  }

  function initialIndex() {
    const n = parseInt(location.hash.slice(1), 10);
    return Number.isFinite(n) ? n - 1 : 0;
  }

  function init() {
    if (slides.length === 0) throw new Error("Deck has no .slide elements");
    slides.forEach((slide, k) => {
      const num = document.createElement("span");
      num.className = "slide-num";
      num.textContent = `${String(k + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
      slide.appendChild(num);
    });
    if (isPresenter) setupPresenter();
    if (channel) {
      channel.addEventListener("message", (e) => {
        if (e.data && e.data.type === "goto") goTo(e.data.index, { broadcast: false });
      });
    }
    window.addEventListener("resize", fitStage);
    window.addEventListener("keydown", onKey);
    setupTouch();
    setTimeout(() => document.querySelector(".help").classList.add("hidden"), 4000);
    fitStage();
    goTo(initialIndex(), { broadcast: false });
  }

  init();
})();
