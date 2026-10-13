// 公開済みの記録だけを読み取る。投稿や記事の作成・送信は行わない。
(() => {
  "use strict";

  const sources = {
    instagram: "https://raw.githubusercontent.com/takochi92/afe/ccr-622bec71-djrqes/records/ig_posts.csv",
    threads: "https://raw.githubusercontent.com/takochi92/afe/ccr-622bec71-djrqes/records/posts.csv",
    note: "https://raw.githubusercontent.com/takochi92/pt-kokushi/stats/note-stats.json"
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
    note: new Set(["note.com", "www.note.com"])
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
    for (const item of items.slice(0, 12)) {
      const li = document.createElement("li");
      const icon = document.createElement("span");
      icon.className = "activity-icon" +
        (item.type === "threads" ? " threads" : item.type === "note" ? " note-icon" : "");
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = item.type === "instagram" ? "◎" : item.type === "threads" ? "@" : "N";
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
      const meta = document.createElement("span");
      meta.className = "activity-meta";
      const time = document.createElement("time");
      time.dateTime = item.date.toISOString();
      time.textContent = formatTime.format(item.date);
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
      read(sources.note).then(value => noteRows(JSON.parse(value)))
    ]);
    const errors = [];
    const items = [];
    result.forEach((entry, index) => {
      if (entry.status === "fulfilled") items.push(...entry.value);
      else errors.push(["Instagram", "Threads", "note"][index]);
    });
    items.sort((a, b) => b.date - a.date);
    render(items);
    const checked = formatTime.format(new Date());
    status.textContent = errors.length
      ? "一部の記録を取得できませんでした（" + errors.join("・") + "）。" + checked + " 確認"
      : checked + " 確認 · 最新 " + Math.min(items.length, 12) + " 件を表示（全 " + items.length + " 件）";
    refresh.disabled = false;
  }

  refresh.addEventListener("click", load);
  load();
  setInterval(load, 5 * 60 * 1000);
})();

