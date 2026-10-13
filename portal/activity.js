// 公開記録と自動生成の実行履歴を読み取る。投稿や記事の作成・送信は行わない。
(() => {
  "use strict";

  const sources = {
    instagram: "https://raw.githubusercontent.com/takochi92/afe/ccr-622bec71-djrqes/records/ig_posts.csv",
    threads: "https://raw.githubusercontent.com/takochi92/afe/ccr-622bec71-djrqes/records/posts.csv",
    note: "https://raw.githubusercontent.com/takochi92/pt-kokushi/stats/note-stats.json",
    care: "https://raw.githubusercontent.com/takochi92/kaigo-/sns-auto/index.json",
    boat: "https://api.github.com/repos/takochi92/minamoyomi/actions/workflows/daily-x.yml/runs?per_page=12"
  };
  const list = document.getElementById("activity-list");
  const status = document.getElementById("activity-status");
  const refresh = document.getElementById("activity-refresh");
  if (!list || !status || !refresh) return;

  const formatTime = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit"
  });
  const allowedHosts = {
    instagram: new Set(["www.instagram.com", "instagram.com"]),
    threads: new Set(["www.threads.com", "threads.com"]),
    note: new Set(["note.com", "www.note.com"]),
    care: new Set(["raw.githubusercontent.com"]),
    boat: new Set(["github.com"])
  };

  function validLink(value, type) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && allowedHosts[type].has(url.hostname) ? url.href : null;
    } catch {
      return null;
    }
  }

  function utcDate(value) {
    const date = new Date(value.replace(" ", "T") + "Z");
    return Number.isFinite(date.getTime()) ? date : null;
  }

  function excerpt(value) {
    const clean = String(value || "").replace(/^"/, "").replace(/"$/, "").replace(/\s+/g, " ").trim();
    return clean.length > 100 ? clean.slice(0, 100) + "…" : clean;
  }

  function socialRows(text, type) {
    // 台帳には複数行の本文が入るため、投稿日時で始まる行だけを読む。
    const result = [];
    const seen = new Set();
    const pattern = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),[^,]*,(https:\/\/[^,]+),[^,]*,(.*)$/;
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(pattern);
      if (!match) continue;
      const date = utcDate(match[1]);
      const url = validLink(match[2], type);
      if (!date || !url || seen.has(url)) continue;
      seen.add(url);
      result.push({
        type, date, url,
        title: type === "instagram" ? "Instagram 投稿" : "Threads 投稿",
        detail: excerpt(match[3]) || "公開済みの投稿を開く",
        state: "投稿済み"
      });
    }
    return result;
  }

  function noteRows(data) {
    if (!data || data.ok !== true || !Array.isArray(data.articles)) {
      throw new Error("note の公開データを取得できませんでした");
    }
    return data.articles.flatMap(article => {
      const date = new Date(article.publishedAt);
      const url = validLink(article.url, "note");
      return Number.isFinite(date.getTime()) && url
        ? [{type: "note", date, url, title: "note 記事公開",
            detail: excerpt(article.title), state: "公開済み"}]
        : [];
    });
  }

  async function careRows(data) {
    if (!data || !Array.isArray(data.posts)) throw new Error("おやのての下書き一覧を取得できませんでした");
    const items = data.posts.flatMap(post => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(post.date)) return [];
      const date = new Date(post.date + "T06:43:00+09:00");
      const root = "https://raw.githubusercontent.com/takochi92/kaigo-/sns-auto/";
      const safePath = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}\/[a-zA-Z0-9._-]+$/.test(value) ? value : null;
      const caption = safePath(post.caption);
      const image = Array.isArray(post.images) ? safePath(post.images[0]) : null;
      if (!Number.isFinite(date.getTime()) || !caption) return [];
      return [{
        type: "care", date, url: root + caption,
        title: "おやのて · Instagram 原稿・画像を作成",
        detail: excerpt(post.title), state: "下書き作成済み",
        image: image ? root + image : null,
        imageCount: Array.isArray(post.images) ? post.images.length : 0,
        dateOnly: true
      }];
    });
    await Promise.all(items.map(async item => {
      try {
        const caption = await read(item.url);
        item.detail = excerpt(caption) || item.detail;
      } catch {
        // 見出しと画像が取得できていれば、その記録を表示する。
      }
    }));
    return items;
  }

  function boatRows(data) {
    if (!data || !Array.isArray(data.workflow_runs)) throw new Error("艇ろぐの作成履歴を取得できませんでした");
    return data.workflow_runs.flatMap(run => {
      if (run.status !== "completed" || run.conclusion !== "success") return [];
      const date = new Date(run.created_at);
      const url = validLink(run.html_url, "boat");
      return Number.isFinite(date.getTime()) && url
        ? [{type: "boat", date, url, title: "艇ろぐ · X 原稿の作成処理",
            detail: "自動生成ワークフローの成功記録。原稿は Atelier で確認", state: "処理成功"}]
        : [];
    });
  }

  async function read(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const separator = url.includes("?") ? "&" : "?";
      const response = await fetch(url + separator + "updated=" + Date.now(), {
        cache: "no-store", signal: controller.signal
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.text();
    } finally {
      clearTimeout(timeout);
    }
  }

  function render(items) {
    list.replaceChildren();
    if (!items.length) {
      const li = document.createElement("li");
      li.textContent = "表示できる公開記録はありません。";
      list.append(li);
      return;
    }
    for (const item of items.slice(0, 16)) {
      const li = document.createElement("li");
      const icon = document.createElement("span");
      icon.className = "activity-icon" +
        (item.type === "threads" ? " threads" : item.type === "note" ? " note-icon" : item.type === "care" ? " care-icon" : item.type === "boat" ? " boat-icon" : "");
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = ({instagram:"◎", threads:"@", note:"N", care:"親", boat:"艇"})[item.type];
      const main = document.createElement("span");
      main.className = "activity-main";
      const heading = document.createElement("strong");
      const link = document.createElement("a");
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = item.title + " ↗";
      heading.append(link);
      const detail = document.createElement("small");
      detail.textContent = item.detail;
      main.append(heading, detail);
      if (item.image) {
        const imageLink = document.createElement("a");
        imageLink.href = item.image;
        imageLink.target = "_blank";
        imageLink.rel = "noopener noreferrer";
        imageLink.className = "activity-image-link";
        const thumbnail = document.createElement("img");
        thumbnail.src = item.image;
        thumbnail.alt = item.detail + "の画像";
        thumbnail.loading = "lazy";
        imageLink.append(thumbnail);
        const count = document.createElement("span");
        count.textContent = "1枚目を開く（全" + item.imageCount + "枚）↗";
        imageLink.append(count);
        main.append(imageLink);
      }
      const meta = document.createElement("span");
      meta.className = "activity-meta";
      const time = document.createElement("time");
      time.dateTime = item.date.toISOString();
      time.textContent = item.dateOnly ? item.date.toLocaleDateString("ja-JP", {timeZone:"Asia/Tokyo"}) : formatTime.format(item.date);
      const state = document.createElement("span");
      state.className = "done";
      state.textContent = item.state;
      meta.append(time, state);
      li.append(icon, main, meta);
      list.append(li);
    }
  }

  async function load() {
    refresh.disabled = true;
    status.textContent = "公開記録を更新中…";
    const result = await Promise.allSettled([
      read(sources.instagram).then(value => socialRows(value, "instagram")),
      read(sources.threads).then(value => socialRows(value, "threads")),
      read(sources.note).then(value => noteRows(JSON.parse(value))),
      read(sources.care).then(value => careRows(JSON.parse(value))),
      read(sources.boat).then(value => boatRows(JSON.parse(value)))
    ]);
    const errors = [];
    const items = [];
    result.forEach((entry, index) => {
      if (entry.status === "fulfilled") items.push(...entry.value);
      else errors.push(["Instagram", "Threads", "note", "おやのて", "艇ろぐ"][index]);
    });
    items.sort((a, b) => b.date - a.date);
    render(items);
    const checked = formatTime.format(new Date());
    status.textContent = errors.length
      ? "一部の記録を取得できませんでした（" + errors.join("・") + "）。" + checked + " 確認"
      : checked + " 確認 · 最新 " + Math.min(items.length, 16) + " 件を表示（全 " + items.length + " 件）";
    refresh.disabled = false;
  }

  refresh.addEventListener("click", load);
  load();
  setInterval(load, 5 * 60 * 1000);
})();

