(() => {
  "use strict";

  const careList = document.getElementById("care-drafts");
  const boatList = document.getElementById("boat-drafts");
  const status = document.getElementById("draft-status");
  const toggle = document.getElementById("draft-toggle-posted");
  if (!careList || !boatList || !status || !toggle) return;

  const careRoot = "https://raw.githubusercontent.com/takochi92/kaigo-/sns-auto/";
  const boatRoot = "https://raw.githubusercontent.com/takochi92/minamoyomi/x-auto/";
  const safePath = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}\/[a-zA-Z0-9._-]+$/.test(value);
  const todayJst = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const keepFrom = () => new Date(Date.parse(todayJst()) - 13 * 86400e3).toISOString().slice(0, 10);
  const storageKey = "afe-posted-drafts-v1";
  const visibleCount = { care: 3, boat: 3 };
  let cached = { care: [], boat: [] };
  let loaded = { care: false, boat: false };
  let showPosted = false;

  function readPosted() {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch { return {}; }
  }

  function keyFor(post, project) {
    return project === "care" ? "care:" + post.date : "boat:" + post.id;
  }

  function setPosted(post, project, posted) {
    const values = readPosted();
    const key = keyFor(post, project);
    if (posted) values[key] = Date.now();
    else delete values[key];
    try { localStorage.setItem(storageKey, JSON.stringify(values)); }
    catch { status.textContent = "このブラウザでは投稿済みの状態を保存できません。"; return; }
    renderAll();
    status.textContent = posted ? "投稿済みにしました。通常の一覧から非表示になりました。" : "未投稿に戻しました。";
    window.dispatchEvent(new Event("afe-draft-status-changed"));
  }

  async function read(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url + (url.includes("?") ? "&" : "?") + "v=" + Date.now(), {
        cache: "no-store", signal: controller.signal
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  async function copyText(text, field) {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        field.focus(); field.select();
        if (!document.execCommand("copy")) throw new Error("copy_failed");
      }
      status.textContent = "本文をコピーしました。";
    } catch {
      field.focus(); field.select();
      status.textContent = "本文を選択しました。端末のコピー操作を使ってください。";
    }
  }

  async function imageBlob(url) {
    const response = await read(url);
    const source = await response.blob();
    if (!source.type.startsWith("image/")) throw new Error("invalid_image");
    return source;
  }

  async function copyImage(url) {
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") throw new Error("unsupported");
      const source = await imageBlob(url);
      const bitmap = await createImageBitmap(source);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      canvas.getContext("2d").drawImage(bitmap, 0, 0);
      bitmap.close();
      const png = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
      if (!png) throw new Error("conversion_failed");
      await navigator.clipboard.write([new ClipboardItem({"image/png": png})]);
      status.textContent = "画像をコピーしました。";
    } catch {
      status.textContent = "この端末では画像コピーができません。画像の「保存」を使ってください。";
    }
  }

  async function saveImage(url, name) {
    try {
      const blob = await imageBlob(url);
      const objectUrl = URL.createObjectURL(blob);
      const link = el("a");
      link.href = objectUrl;
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      status.textContent = "画像を保存しました。";
    } catch {
      window.open(url, "_blank", "noopener");
      status.textContent = "画像を開きました。長押しまたは右クリックで保存してください。";
    }
  }

  function renderCard(post, index, project, posted) {
    const card = el("details", "draft-card" + (posted ? " is-posted" : ""));
    if (index === 0 && !posted) card.open = true;
    const summary = el("summary", "", project === "care"
      ? (post.title || "Instagram 原稿")
      : (post.text.split("\n")[0] || "X 原稿"));
    summary.append(el("small", "", post.date + " · " + (project === "care" ? "画像 " + post.images.length + " 枚" : post.slot || "原稿")));
    const field = el("textarea");
    field.readOnly = true;
    field.value = post.text;
    field.setAttribute("aria-label", "投稿本文");
    const actions = el("div", "draft-actions");
    const copy = el("button", "", "本文をコピー");
    copy.type = "button";
    copy.addEventListener("click", () => copyText(post.text, field));
    const mark = el("button", "", posted ? "未投稿に戻す" : "投稿済みにする");
    mark.type = "button";
    mark.addEventListener("click", () => setPosted(post, project, !posted));
    actions.append(copy, mark);
    card.append(summary, field, actions);
    if (post.images.length) {
      const grid = el("div", "draft-images");
      post.images.forEach((url, i) => {
        const figure = el("figure", "draft-image");
        const img = el("img");
        img.src = url;
        img.loading = "lazy";
        img.alt = post.title + "の画像 " + (i + 1);
        const caption = el("figcaption", "", "画像 " + (i + 1) + " / " + post.images.length);
        const row = el("div", "draft-actions");
        const copyImageButton = el("button", "", "コピー");
        copyImageButton.type = "button";
        copyImageButton.addEventListener("click", () => copyImage(url));
        const save = el("button", "", "保存");
        save.type = "button";
        save.addEventListener("click", () => saveImage(url, "oyanote-" + post.date + "-" + (i + 1) + ".jpg"));
        row.append(copyImageButton, save);
        figure.append(img, caption, row);
        grid.append(figure);
      });
      card.append(grid);
    }
    return card;
  }

  function render(list, posts, project, posted) {
    list.replaceChildren();
    const remaining = posts.filter(post => !posted[keyFor(post, project)]);
    const finished = posts.filter(post => posted[keyFor(post, project)]);
    const selected = showPosted ? [...remaining, ...finished] : remaining;
    if (!selected.length) { list.append(el("p", "empty", showPosted ? "表示できる原稿はありません。" : "未投稿の原稿はありません。")); return; }
    selected.slice(0, visibleCount[project]).forEach((post, index) =>
      list.append(renderCard(post, index, project, !!posted[keyFor(post, project)])));
    if (selected.length > visibleCount[project]) {
      const more = el("button", "draft-more", "さらに表示（残り " + (selected.length - visibleCount[project]) + " 件）");
      more.type = "button";
      more.addEventListener("click", () => { visibleCount[project] += 5; renderAll(); });
      list.append(more);
    }
  }

  function renderAll() {
    const posted = readPosted();
    if (loaded.care) render(careList, cached.care, "care", posted);
    if (loaded.boat) render(boatList, cached.boat, "boat", posted);
    const count = [...cached.care.map(post => keyFor(post, "care")),
      ...cached.boat.map(post => keyFor(post, "boat"))].filter(key => posted[key]).length;
    toggle.textContent = showPosted ? "未投稿だけ表示" : "投稿済みを表示（" + count + "）";
  }

  async function loadCare() {
    const index = await (await read(careRoot + "index.json")).json();
    if (!Array.isArray(index.posts)) throw new Error("invalid_care_index");
    const candidates = index.posts.filter(post => post.date >= keepFrom() && safePath(post.caption) && Array.isArray(post.images));
    const results = await Promise.allSettled(candidates.map(async post => ({
      ...post,
      text: await (await read(careRoot + post.caption)).text(),
      images: post.images.filter(safePath).map(path => careRoot + path)
    })));
    return results.filter(result => result.status === "fulfilled").map(result => result.value);
  }

  async function loadBoat() {
    const index = await (await read(boatRoot + "index.json")).json();
    if (!Array.isArray(index.posts)) throw new Error("invalid_boat_index");
    return index.posts.filter(post => post.project === "teirogu" && post.channel === "X" &&
      /^\d{4}-\d{2}-\d{2}$/.test(post.date) && post.date >= keepFrom() && typeof post.text === "string")
      .sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)))
      .map(post => ({...post, images: []}));
  }

  async function load() {
    const results = await Promise.allSettled([loadCare(), loadBoat()]);
    if (results[0].status === "fulfilled") { cached.care = results[0].value; loaded.care = true; }
    else { loaded.care = false; careList.textContent = "おやのての原稿を取得できませんでした。"; }
    if (results[1].status === "fulfilled") { cached.boat = results[1].value; loaded.boat = true; }
    else { loaded.boat = false; boatList.textContent = "艇ろぐの原稿を取得できませんでした。"; }
    if (results.some(result => result.status === "fulfilled")) renderAll();
    status.textContent = results.every(result => result.status === "fulfilled")
      ? "原稿は約5分ごとに更新します。" : "一部の原稿を取得できませんでした。しばらくして再読み込みしてください。";
  }

  toggle.addEventListener("click", () => { showPosted = !showPosted; renderAll(); });
  window.addEventListener("storage", event => { if (event.key === storageKey) renderAll(); });
  load();
  setInterval(load, 5 * 60 * 1000);
})();

