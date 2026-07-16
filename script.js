(function () {
  const tabsEl = document.getElementById("tabs");
  const tabsLoading = document.getElementById("tabsLoading");
  const stageEl = document.getElementById("stage");
  const emptyStateEl = document.getElementById("emptyState");

  const deckNameEl = document.getElementById("deckName");
  const deckProgressEl = document.getElementById("deckProgress");

  const cardEl = document.getElementById("card");
  const cardInnerEl = document.getElementById("cardInner");
  const cardFrontEl = document.getElementById("cardFront");
  const cardBackEl = document.getElementById("cardBack");
  const frontContentEl = document.getElementById("frontContent");
  const frontImageWrapEl = document.getElementById("frontImageWrap");
  const qTextEl = document.getElementById("qText");
  const qImgEl = document.getElementById("qImg");
  const frontTagEl = document.getElementById("frontTag");
  const aTextEl = document.getElementById("aText");
  const eTextEl = document.getElementById("eText");
  const levelStarsEl = document.getElementById("levelStars");

  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const shuffleBtn = document.getElementById("shuffleBtn");
  const restartBtn = document.getElementById("restartBtn");

  // Lightbox elements
  const lightboxEl = document.getElementById("lightbox");
  const lightboxImgEl = document.getElementById("lightboxImg");
  const lightboxStageEl = document.getElementById("lightboxStage");
  const lbZoomIn = document.getElementById("lbZoomIn");
  const lbZoomOut = document.getElementById("lbZoomOut");
  const lbZoomReset = document.getElementById("lbZoomReset");
  const lbClose = document.getElementById("lbClose");

  let currentSubject = null;
  let originalDeck = [];
  let deck = [];
  let index = 0;
  let flipped = false;
  let zoomScale = 1;

  function apiUrl(params) {
    const base = CONFIG.APPS_SCRIPT_URL;
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return base + query;
  }

  function showError(msg) {
    tabsLoading.hidden = false;
    tabsLoading.textContent = msg;
    stageEl.hidden = true;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  async function loadSubjects() {
    try {
      const res = await fetch(apiUrl());
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      renderTabs(data.subjects || []);
    } catch (err) {
      showError(
        "Không tải được danh sách chủ đề. Kiểm tra lại APPS_SCRIPT_URL trong config.js."
      );
      console.error(err);
    }
  }

  function renderTabs(subjects) {
    tabsLoading.hidden = true;
    tabsEl.innerHTML = "";
    if (!subjects.length) {
      showError("Chưa có sheet (chủ đề) nào trong file Google Sheet.");
      return;
    }
    subjects.forEach((name, i) => {
      const btn = document.createElement("button");
      btn.className = "tab-btn";
      btn.textContent = name;
      btn.setAttribute("role", "tab");
      btn.addEventListener("click", () => selectSubject(name, btn));
      tabsEl.appendChild(btn);
      if (i === 0) selectSubject(name, btn);
    });
  }

  async function selectSubject(name, btnEl) {
    [...tabsEl.children].forEach((b) => b.classList.remove("active"));
    if (btnEl) btnEl.classList.add("active");
    currentSubject = name;
    stageEl.hidden = true;
    emptyStateEl.hidden = true;

    try {
      const res = await fetch(apiUrl({ subject: name }));
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      originalDeck = data.cards || [];
      if (!originalDeck.length) {
        emptyStateEl.hidden = false;
        emptyStateEl.textContent = `Sheet "${name}" chưa có câu hỏi nào.`;
        return;
      }
      deck = shuffle(originalDeck);
      index = 0;
      flipped = false;
      stageEl.hidden = false;
      renderCard();
    } catch (err) {
      emptyStateEl.hidden = false;
      emptyStateEl.textContent = "Không tải được dữ liệu cho chủ đề này.";
      console.error(err);
    }
  }

  function renderCard() {
    const card = deck[index];
    if (!card) return;

    cardEl.classList.remove("flipped");
    flipped = false;

    deckNameEl.textContent = currentSubject;
    deckProgressEl.textContent = `${index + 1} / ${deck.length}`;

    qTextEl.textContent = card["Câu hỏi"] || "";
    frontTagEl.textContent = card["Tag"] || "";

    const imgVal = (card["Ảnh"] || "").toString().trim();
    if (imgVal) {
      const src = CONFIG.GITHUB_RAW_BASE.replace(/\/$/, "") + "/" + imgVal.replace(/^\//, "");
      qImgEl.src = src;
      qImgEl.hidden = false;
      frontImageWrapEl.classList.remove("is-empty");
      frontContentEl.classList.remove("no-image");
    } else {
      qImgEl.hidden = true;
      qImgEl.removeAttribute("src");
      frontImageWrapEl.classList.add("is-empty");
      frontContentEl.classList.add("no-image");
    }

    aTextEl.textContent = card["Đáp án"] || "";
    eTextEl.textContent = card["Giải thích"] || "";

    const level = Math.min(5, Math.max(0, parseInt(card["Mức độ"], 10) || 0));
    levelStarsEl.innerHTML = "";
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement("span");
      star.className = "star" + (i <= level ? " on" : "");
      star.textContent = i <= level ? "★" : "☆";
      levelStarsEl.appendChild(star);
    }

    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === deck.length - 1;

    syncCardHeight();
  }

  // ---------- Dynamic height: measure real content so text never gets clipped ----------
  function measureNaturalHeight(faceEl) {
    const clone = faceEl.cloneNode(true);
    clone.style.position = "static";
    clone.style.visibility = "hidden";
    clone.style.height = "auto";
    clone.style.transform = "none";
    cardEl.appendChild(clone);
    const h = clone.scrollHeight;
    cardEl.removeChild(clone);
    return h;
  }

  function syncCardHeight() {
    const frontH = measureNaturalHeight(cardFrontEl);
    const backH = measureNaturalHeight(cardBackEl);
    const finalH = Math.max(frontH, backH, 260);
    cardInnerEl.style.height = finalH + "px";
  }

  // Ảnh tải xong (bất đồng bộ) có thể đổi chiều cao khối ảnh -> đo lại
  qImgEl.addEventListener("load", syncCardHeight);

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(syncCardHeight, 150);
  });

  function flip() {
    flipped = !flipped;
    cardEl.classList.toggle("flipped", flipped);
  }

  function goNext() {
    if (index < deck.length - 1) {
      index++;
      renderCard();
    }
  }

  function goPrev() {
    if (index > 0) {
      index--;
      renderCard();
    }
  }

  // Clicking the card flips it — except clicking the image, which opens the lightbox instead.
  cardEl.addEventListener("click", flip);
  cardEl.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      flip();
    }
  });

  frontImageWrapEl.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!qImgEl.hidden && qImgEl.src) openLightbox(qImgEl.src);
  });

  nextBtn.addEventListener("click", goNext);
  prevBtn.addEventListener("click", goPrev);

  shuffleBtn.addEventListener("click", () => {
    deck = shuffle(originalDeck);
    index = 0;
    renderCard();
  });

  restartBtn.addEventListener("click", () => {
    deck = shuffle(originalDeck);
    index = 0;
    renderCard();
  });

  document.addEventListener("keydown", (e) => {
    if (lightboxEl.classList.contains("is-open")) {
      if (e.key === "Escape") closeLightbox();
      return;
    }
    if (stageEl.hidden) return;
    if (e.target.tagName === "BUTTON") return;
    if (e.key === "ArrowRight") goNext();
    if (e.key === "ArrowLeft") goPrev();
  });

  // ---------- Lightbox (zoom in/out on the illustration image) ----------
  function openLightbox(src) {
    lightboxImgEl.src = src;
    zoomScale = 1;
    applyZoom();
    lightboxEl.classList.add("is-open");
  }

  function closeLightbox() {
    lightboxEl.classList.remove("is-open");
    lightboxImgEl.src = "";
  }

  function applyZoom() {
    lightboxImgEl.style.transform = `scale(${zoomScale})`;
    lbZoomReset.textContent = Math.round(zoomScale * 100) + "%";
  }

  lbZoomIn.addEventListener("click", () => {
    zoomScale = Math.min(4, zoomScale + 0.25);
    applyZoom();
  });
  lbZoomOut.addEventListener("click", () => {
    zoomScale = Math.max(0.5, zoomScale - 0.25);
    applyZoom();
  });
  lbZoomReset.addEventListener("click", () => {
    zoomScale = 1;
    applyZoom();
  });
  lbClose.addEventListener("click", closeLightbox);

  lightboxStageEl.addEventListener("click", (e) => {
    if (e.target === lightboxStageEl) closeLightbox();
  });

  lightboxStageEl.addEventListener(
    "wheel",
    (e) => {
      if (!lightboxEl.classList.contains("is-open")) return;
      e.preventDefault();
      zoomScale = e.deltaY < 0
        ? Math.min(4, zoomScale + 0.15)
        : Math.max(0.5, zoomScale - 0.15);
      applyZoom();
    },
    { passive: false }
  );

  loadSubjects();
})();
