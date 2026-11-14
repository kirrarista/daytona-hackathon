/* RoomLedger browser workbench. No persistence, remote assets, or build dependencies. */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const SVG_NS = "http://www.w3.org/2000/svg";
  const DEPRECIATION = {
    electronics: 0.20, furniture: 0.10, appliance: 0.14,
    kitchenware: 0.12, decor: 0.10, clothing: 0.25,
    sports: 0.16, musical: 0.08, other: 0.15,
  };
  const CONDITION_FACTOR = { new: 1, good: 0.85, fair: 0.65, poor: 0.35 };
  const FIXES = {
    tension_poles: { en: "Tension poles", ja: "突っ張り棒", unit: 2400 },
    l_brackets: { en: "L-brackets", ja: "L字金具", unit: 1200 },
    tv_straps: { en: "TV anti-tip straps", ja: "テレビ転倒防止ベルト", unit: 1800 },
    gel_mats: { en: "Anti-slip gel mats", ja: "耐震ジェルマット", unit: 900 },
    glass_film: { en: "Shatter-protection glass film", ja: "飛散防止フィルム", unit: 1600 },
    fridge_belts: { en: "Refrigerator belts", ja: "冷蔵庫転倒防止ベルト", unit: 2200 },
  };
  const UI_TEXT = {
    exportCsv: { en: "Export CSV", ja: "CSV出力" },
    printReport: { en: "Print report", ja: "レポート印刷" },
    themeDark: { en: "Dark mode", ja: "ダークモード" },
    themeLight: { en: "Light mode", ja: "ライトモード" },
    heroTitleA: { en: "Know what you own.", ja: "持ち物を、記録する。" },
    heroTitleB: { en: "Secure what matters.", ja: "大切なものを、守る。" },
    heroSummary: { en: "Turn room photos into an evidence-backed home ledger for insurance recovery and a practical plan for the next earthquake.", ja: "部屋の写真から、保険請求に使える家財の証拠リストと、地震に備える実践的な対策を作成します。" },
    startRooms: { en: "Start with your rooms", ja: "部屋の写真から始める" },
    fileRules: { en: "JPEG, PNG or WebP · up to 8 photos · 12 MB each", ja: "JPEG、PNG、WebP · 写真は8枚まで · 各12MB" },
    dropTitle: { en: "Drop room photos here", ja: "ここに部屋の写真をドロップ" },
    or: { en: "or", ja: "または" },
    chooseDevice: { en: "choose from your device", ja: "デバイスから選択" },
    clearSelection: { en: "Clear selection", ja: "選択をクリア" },
    analyzeRooms: { en: "Analyze selected rooms", ja: "選択した部屋を分析" },
    noPhotos: { en: "No photos handy?", ja: "写真がない場合は？" },
    sampleHome: { en: "Try with sample home", ja: "サンプルホームを試す" },
    sampleDetails: { en: "6 rooms · cached offline demo", ja: "6部屋 · キャッシュ済みオフライン" },
    replacementTotal: { en: "Replacement total", ja: "再調達価額の合計" },
    actualCashValue: { en: "Actual cash value", ja: "実際現金価額（ACV）" },
    currentEdited: { en: "Current edited inventory", ja: "編集後の現在の家財台帳" },
    ageAdjusted: { en: "Age & condition adjusted", ja: "年数・状態を考慮" },
    itemsLabel: { en: "Items", ja: "項目数" },
    acrossRooms: { en: "Across all included rooms", ja: "対象の全部屋" },
    roomsLabel: { en: "Rooms", ja: "部屋数" },
    usableEvidence: { en: "With usable evidence", ja: "有効な証拠写真あり" },
    insurance: { en: "Insurance", ja: "保険" },
    quakeReady: { en: "Quake-Ready", ja: "地震対策" },
    inspectEvidence: { en: "Inspect the evidence", ja: "証拠を確認" },
    inspectHint: { en: "Choose a numbered box or item. You can verify the crop, correct details, and keep totals current.", ja: "番号の枠または項目を選択。切り抜き画像の確認や修正、合計の更新ができます。" },
    plainLanguage: { en: "Plain language", ja: "わかりやすい表示" },
    technical: { en: "Technical", ja: "技術ログ" },
    yourEvidenceLedger: { en: "Your evidence ledger", ja: "家財の証拠台帳" },
  };

  const JA = {
    readiness: "地震対策スコア",
    readinessSummary: "家具などの倒れやすさを数えた相対スコアです。建物の構造安全性を示すものではありません。",
    readinessGood: "比較的安定・予防対策を継続",
    readinessFair: "中・高リスクの家具を固定",
    readinessLow: "高リスクの項目を優先",
    shopping: "転倒防止の買い物リスト",
    estimated: "見積もり",
    noFixes: "固定具が必要な中・高リスク項目はありません。",
    high: "高リスク",
    medium: "中リスク",
    low: "低リスク",
    sleeping: "就寝中に下敷きになる可能性",
    sleepingShort: "寝室の優先項目",
    reasonTitle: "落下・転倒の理由",
    highReason: "大きな揺れで倒れたり、落下したりする可能性があります。",
    mediumReason: "転倒や衝突を防ぐため、配置と固定方法を確認してください。",
    lowReason: "大きな転倒リスクの特徴は検出されていません。",
    recommendedFix: "推奨する対策",
    roomHazards: "高リスク {count} 件",
    items: "{count} 項目",
    quantity: "数量",
    total: "合計",
  };

  const state = {
    health: null,
    files: [],
    running: false,
    runId: null,
    meta: null,
    rooms: new Map(),
    tiles: new Map(),
    deletedIds: new Set(),
    selectedRoom: null,
    selectedItem: null,
    mode: "insurance",
    language: document.documentElement.dataset.language === "ja" ? "ja" : "en",
    summary: null,
    done: false,
    failures: 0,
    cleanupFailed: false,
    logs: { plain: [], technical: [] },
    logTab: "plain",
  };

  const money0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const money2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const yen = new Intl.NumberFormat("en-US", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function svgEl(tag, attributes = {}, text) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function clear(node) {
    node.replaceChildren();
    return node;
  }

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function photoUrl(value) {
    return typeof value === "string" && /^data:image\/jpeg;base64,[a-z0-9+/=\s]+$/i.test(value) ? value : "";
  }

  function acvFor(item) {
    const category = Object.hasOwn(DEPRECIATION, item.category) ? item.category : "other";
    const condition = Object.hasOwn(CONDITION_FACTOR, item.condition) ? item.condition : "fair";
    const age = Math.min(50, Math.max(0, Math.trunc(finite(item.age_years, 0))));
    const retained = (1 - DEPRECIATION[category]) ** age;
    return Math.round(finite(item.replacement_usd) * CONDITION_FACTOR[condition] * retained * 100) / 100;
  }

  function allRooms() {
    return [...state.rooms.values()].sort((a, b) => a.index - b.index);
  }

  function findItem(id) {
    for (const room of state.rooms.values()) {
      const item = room.items.find((candidate) => candidate.id === id);
      if (item) return { room, item };
    }
    return null;
  }

  function t(key) {
    return state.language === "ja" && JA[key] ? JA[key] : ({
      readiness: "Quake readiness",
      readinessSummary: "A relative tip-over risk score, not a structural safety rating.",
      readinessGood: "Comparatively stable · keep prevention in place",
      readinessFair: "Secure medium and high-risk items",
      readinessLow: "Secure high-risk items first",
      shopping: "Anchoring shopping list",
      estimated: "estimated",
      noFixes: "No medium or high-risk items currently require brackets or straps.",
      high: "High risk",
      medium: "Medium risk",
      low: "Low risk",
      sleeping: "Could fall on you while sleeping",
      sleepingShort: "Sleeping-area priority",
      reasonTitle: "Tip-over evidence",
      recommendedFix: "Recommended fixes",
      items: "{count} items",
    }[key] || key);
  }

  function sharedText(key) {
    return UI_TEXT[key]?.[state.language] || UI_TEXT[key]?.en || key;
  }

  function translateSharedUI() {
    document.querySelectorAll("[data-ui-text]").forEach((node) => { node.textContent = sharedText(node.dataset.uiText); });
    $("theme-label").textContent = sharedText(document.documentElement.dataset.theme === "dark" ? "themeLight" : "themeDark");
  }

  function riskLabel(risk) {
    return t(Object.hasOwn(JA, risk) ? risk : "low");
  }

  function roomTypeLabel(room) {
    const type = room.room_type.replaceAll("_", " ");
    if (state.language !== "ja") return type;
    return ({ bedroom: "寝室", living_room: "居間", kitchen: "台所", office: "書斎", other: "その他" })[room.room_type] || type;
  }

  function localizedItemCount(count) {
    return state.language === "ja" ? JA.items.replace("{count}", count) : `${count} items`;
  }

  function fixName(key) {
    return FIXES[key] ? FIXES[key][state.language] : key;
  }

  function localizedRiskReason(item) {
    if (state.language !== "ja") return item.risk_reason || "No detailed risk reason was supplied.";
    return item.risk === "high" ? JA.highReason : item.risk === "medium" ? JA.mediumReason : JA.lowReason;
  }

  function setBusy(busy) {
    state.running = busy;
    $("sample-button").disabled = busy;
    $("file-input").disabled = busy;
    $("clear-files").disabled = busy;
    $("analyze-button").disabled = busy || state.files.length === 0;
    $("reset-button").hidden = busy || !state.done;
  }

  function setTheme(theme) {
    const selected = theme === "dark" ? "dark" : "light";
    const root = document.documentElement;
    root.classList.add("theme-switching");
    root.dataset.theme = selected;
    try { localStorage.setItem("roomledger-theme", selected); } catch (_) { /* Theme still works without storage. */ }
    const dark = selected === "dark";
    $("theme-toggle").setAttribute("aria-pressed", String(dark));
    $("theme-toggle").setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    $("theme-label").textContent = sharedText(dark ? "themeLight" : "themeDark");
    document.querySelector('meta[name="theme-color"]').content = dark ? "#0d1420" : "#f5f2eb";
    // Flush once, then restore transitions on the following frame (not a color smear).
    void document.body.offsetWidth;
    requestAnimationFrame(() => root.classList.remove("theme-switching"));
  }

  function updateExportAvailability() {
    const available = allRooms().length > 0;
    $("csv-button").disabled = !available;
    $("report-button").disabled = !available;
  }

  function showUploadError(message) {
    $("upload-error").textContent = message;
    $("upload-error").hidden = !message;
  }

  function setEnvironment({ text, status = "ok" }) {
    const container = clear($("environment-status"));
    const light = el("span", `status-light${status === "checking" ? " is-checking" : status === "error" ? " is-error" : ""}`);
    light.setAttribute("aria-hidden", "true");
    container.append(light, el("span", "", text));
  }

  function setNosanaStatus(text, source = "waiting") {
    const pill = $("nosana-status");
    pill.textContent = text;
    pill.dataset.source = source;
    pill.title = text;
  }

  async function loadHealth() {
    try {
      const response = await fetch("/api/health", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Health check returned ${response.status}`);
      state.health = await response.json();
      const local = state.health.daytona_mode !== "live";
      setEnvironment({ text: `${local ? `Local: up to ${finite(state.health.parallel_limit, 8)} rooms` : "Daytona: live sandboxes configured"}` });
      setNosanaStatus(state.health.nosana_mode === "configured" ? `Nosana: ${state.health.model} · configured` : "Nosana: not used · offline mock", state.health.nosana_mode === "configured" ? "configured" : "mock");
      if (state.health.cleanup_warning) addLog("technical", state.health.cleanup_warning, -1);
    } catch (error) {
      setEnvironment({ text: "Workspace status unavailable · sample may still work", status: "error" });
      console.warn(error);
    }
  }

  function renderSelectedFiles() {
    const selected = state.files;
    $("selected-files").hidden = selected.length === 0;
    const list = clear($("selected-file-list"));
    selected.forEach((file) => {
      const row = el("div", "selected-file");
      row.append(el("span", "", file.name), el("span", "", `${(file.size / 1024 / 1024).toFixed(1)} MB`));
      list.append(row);
    });
    $("analyze-button").disabled = state.running || selected.length === 0;
  }

  function selectFiles(fileList) {
    showUploadError("");
    const files = [...fileList];
    if (!files.length) return;
    if (files.length > 8) {
      showUploadError("Choose at most 8 room photos for one inventory.");
      return;
    }
    const invalid = files.find((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type));
    if (invalid) {
      showUploadError(`${invalid.name} must be JPEG, PNG, or WebP.`);
      return;
    }
    const oversized = files.find((file) => !file.size || file.size > 12 * 1024 * 1024);
    if (oversized) {
      showUploadError(`${oversized.name} is empty or larger than 12 MB.`);
      return;
    }
    state.files = files;
    renderSelectedFiles();
  }

  function addLog(level, message, room = null) {
    if (!state.logs[level] || typeof message !== "string") return;
    const safeMessage = message.replace(/data:image\/[^;]+;base64,[a-z0-9+/=]+/gi, "[image omitted]");
    state.logs[level].push({ message: safeMessage.slice(0, 1000), room, time: new Date() });
    if (state.logs[level].length > 500) state.logs[level].shift();
    renderLogs();
  }

  function renderLogs() {
    ["plain", "technical"].forEach((level) => {
      const pane = clear($(`${level}-log`));
      if (!state.logs[level].length) {
        pane.append(el("div", "log-empty", level === "plain" ? "Room updates will appear here." : "Run IDs, workers, models and cleanup metadata will appear here."));
        return;
      }
      state.logs[level].forEach((entry) => {
        const row = el("div", "log-entry");
        const time = el("time", "", entry.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        const prefix = Number.isInteger(entry.room) && entry.room >= 0 ? `Room ${entry.room + 1} · ` : "";
        row.append(time, el("span", "", prefix + entry.message));
        pane.append(row);
      });
      pane.scrollTop = pane.scrollHeight;
    });
  }

  function setLogTab(tab, focus = false) {
    state.logTab = tab;
    ["plain", "technical"].forEach((level) => {
      const selected = level === tab;
      const button = $(`${level}-log-tab`);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
      $(`${level}-log`).hidden = !selected;
      if (selected && focus) button.focus();
    });
  }

  function prepareRun(files, meta = null) {
    state.files = files;
    state.meta = meta;
    state.rooms.clear();
    state.tiles.clear();
    state.deletedIds.clear();
    state.selectedRoom = null;
    state.selectedItem = null;
    state.summary = null;
    state.done = false;
    state.failures = 0;
    state.cleanupFailed = false;
    state.logs = { plain: [], technical: [] };
    files.forEach((file, index) => {
      state.tiles.set(index, { index, name: file.name.replace(/\.[^.]+$/, ""), state: "queued", sandbox: "pending", source: null, result: null, error: null, startedAt: performance.now(), elapsed: null });
    });
    $("intake").hidden = true;
    $("results").hidden = false;
    $("inventory").hidden = true;
    $("run-error").hidden = true;
    $("run-toast").hidden = true;
    $("reset-button").hidden = true;
    $("run-title").textContent = `Reading ${files.length} ${files.length === 1 ? "room" : "rooms"}`;
    $("run-context").textContent = meta ? contextForMeta(meta) : "Opening the run and preparing private room workers…";
    $("run-progress-bar").style.width = "3%";
    $("queue-text").textContent = "0 active · 0 waiting";
    $("queue-limit").textContent = "Waiting for capacity";
    $("queue-active-bar").style.width = "0%";
    $("fleet-status").textContent = `0 of ${files.length} rooms returned`;
    updateExportAvailability();
    addLog("plain", `Preparing ${files.length} room ${files.length === 1 ? "photo" : "photos"}.`);
    renderFleet();
    renderLogs();
    requestAnimationFrame(() => $("results").scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
  }

  function contextForMeta(meta) {
    if (meta.sample) return "Cached offline demo · bundled model responses · no live cloud inference";
    if (meta.daytona_mode === "live") return `Live Daytona sandboxes · inference reported per room · ${meta.parallel_limit} rooms maximum in parallel`;
    return `Local processing · no remote sandboxes · inference source reported per room · up to ${meta.parallel_limit} rooms`;
  }

  function sourceLabel(source) {
    return ({ live: "LIVE", cache: "CACHE", mock: "MOCK" })[source] || "WAIT";
  }

  const TILE_PROGRESS = { queued: 2, creating: 10, sanitizing: 26, detecting: 45, scoring: 65, refining: 82, released: 100, destroyed: 100, error: 100, cleanup_failed: 100 };

  function tileElapsed(tile) {
    return tile.elapsed !== null && Number.isFinite(Number(tile.elapsed)) ? Math.max(0, Number(tile.elapsed)) : Math.max(0, (performance.now() - tile.startedAt) / 1000);
  }

  function updateFleetClocks() {
    if (!state.running) return;
    document.querySelectorAll("#fleet .fleet-tile").forEach((card) => {
      const tile = state.tiles.get(Number(card.id.replace("fleet-room-", "")) - 1);
      if (!tile) return;
      const clock = card.querySelector(".tile-elapsed");
      if (clock) clock.textContent = `${tileElapsed(tile).toFixed(tileElapsed(tile) < 10 ? 1 : 0)}s`;
    });
  }

  function renderFleet() {
    const fleet = clear($("fleet"));
    [...state.tiles.values()].sort((a, b) => a.index - b.index).forEach((tile) => {
      const working = !["released", "destroyed", "cleanup_failed", "error", "queued"].includes(tile.state);
      const complete = Boolean(tile.result) || tile.state === "released" || tile.state === "destroyed";
      const failed = tile.state === "error" || tile.state === "cleanup_failed";
      const card = el("article", `fleet-tile${working ? " is-working" : ""}${complete && !failed ? " is-complete" : ""}${failed ? " is-failed" : ""}`);
      card.id = `fleet-room-${tile.index + 1}`;
      card.dataset.state = tile.state;
      const top = el("div", "tile-top");
      top.append(el("span", "room-number", `ROOM ${String(tile.index + 1).padStart(2, "0")}`), el("span", "fleet-state", tile.state.replaceAll("_", " ")));
      card.append(top, el("div", "fleet-room-name", tile.result?.name || tile.name));
      if (tile.result && photoUrl(tile.result.image)) {
        const imageBox = el("div", "fleet-photo");
        const image = el("img");
        image.src = photoUrl(tile.result.image);
        image.alt = "";
        image.loading = "lazy";
        imageBox.append(image);
        card.append(imageBox);
      } else {
        const placeholder = el("div", "fleet-placeholder");
        placeholder.setAttribute("aria-hidden", "true");
        placeholder.append(svgEl("svg", { viewBox: "0 0 28 28" }));
        const icon = placeholder.firstChild;
        icon.append(svgEl("path", { d: "M4 10V4h6m8 0h6v6m0 8v6h-6m-8 0H4v-6M9 15h10M14 10v9", fill: "none", stroke: "currentColor" }));
        card.append(placeholder);
      }
      const meta = el("div", "tile-meta");
      const worker = tile.sandbox && tile.sandbox !== "pending" ? tile.sandbox : "pending";
      meta.append(el("span", "", worker), el("span", "source-badge", sourceLabel(tile.source)));
      meta.lastChild.dataset.source = tile.source || "waiting";
      meta.lastChild.title = tile.source ? `Latest inference source: ${tile.source}` : "No inference event yet";
      card.append(meta);
      if (tile.error || tile.state === "cleanup_failed") card.append(el("p", "cleanup-warning", tile.error || "Cleanup needs review"));
      const timing = el("div", "tile-timing");
      timing.append(el("span", "tile-elapsed", `${tileElapsed(tile).toFixed(tileElapsed(tile) < 10 ? 1 : 0)}s`), el("span", "", "elapsed"));
      const progress = el("div", "tile-progress");
      const progressValue = Math.max(2, Math.min(100, TILE_PROGRESS[tile.state] ?? 5));
      progress.setAttribute("role", "progressbar");
      progress.setAttribute("aria-label", `${tile.name} processing progress`);
      progress.setAttribute("aria-valuenow", String(progressValue));
      progress.setAttribute("aria-valuemin", "0");
      progress.setAttribute("aria-valuemax", "100");
      const progressBar = el("span");
      progressBar.style.width = `${progressValue}%`;
      progress.append(progressBar);
      card.append(timing, progress);
      fleet.append(card);
    });
  }

  function updateProgress() {
    const total = state.tiles.size || state.files.length || 1;
    const finished = [...state.tiles.values()].filter((tile) => tile.result || tile.error || tile.state === "cleanup_failed").length;
    const completeCount = allRooms().length;
    $("run-progress-bar").style.width = `${state.done ? 100 : Math.max(3, Math.min(96, Math.round(finished / total * 100)))}%`;
    $("fleet-status").textContent = `${completeCount} of ${total} rooms returned${state.failures ? ` · ${state.failures} failed` : ""}`;
  }

  function normaliseRoom(result, index) {
    const previous = state.rooms.get(result.id) || allRooms().find((room) => room.index === index);
    const previousItems = new Map(previous ? previous.items.map((item) => [item.id, item]) : []);
    const items = Array.isArray(result.items) ? result.items : [];
    const room = {
      ...result,
      id: result.id || `room-${index + 1}`,
      index,
      name: String(result.name || `Room ${index + 1}`),
      room_type: String(result.room_type || "other"),
      items: [],
    };
    room.items = items.filter((raw) => !state.deletedIds.has(raw.id)).map((raw, itemIndex) => {
      const id = String(raw.id || `r${index + 1}-item-${itemIndex + 1}`);
      const prior = previousItems.get(id);
      if (prior?._edited) return prior;
      const box = Array.isArray(raw.box) && raw.box.length === 4 ? raw.box.map((value) => Math.max(0, Math.min(1000, finite(value)))) : [0, 0, 1000, 1000];
      const item = {
        ...raw,
        id,
        index: Math.max(1, Math.trunc(finite(raw.index, itemIndex + 1))),
        label: String(raw.label || "Household item").slice(0, 160),
        category: Object.hasOwn(DEPRECIATION, raw.category) ? raw.category : "other",
        condition: Object.hasOwn(CONDITION_FACTOR, raw.condition) ? raw.condition : "good",
        replacement_usd: Math.max(0, finite(raw.replacement_usd)),
        age_years: Math.min(50, Math.max(0, Math.trunc(finite(raw.age_years, 0)))),
        box,
        risk: ["low", "medium", "high"].includes(raw.risk) ? raw.risk : "low",
        risk_reason: String(raw.risk_reason || ""),
        near_bed_or_exit: Boolean(raw.near_bed_or_exit),
        fix_keys: Array.isArray(raw.fix_keys) ? raw.fix_keys.filter((key) => Object.hasOwn(FIXES, key)) : [],
        verified: Boolean(raw.verified),
        confidence: Math.max(0, Math.min(1, finite(raw.confidence))),
        duplicate_of: raw.duplicate_of || null,
        receipt: Boolean(raw.receipt),
        brand_model: String(raw.brand_model || ""),
      };
      item.acv_usd = acvFor(item);
      return item;
    });
    return room;
  }

  function handleEvent(event) {
    if (!event || typeof event.type !== "string") return;
    const index = Number.isInteger(event.room) ? event.room : null;
    const tile = index !== null ? state.tiles.get(index) : null;
    switch (event.type) {
      case "meta": {
        state.meta = event;
        state.runId = event.run_id;
        $("run-context").textContent = contextForMeta(event);
        $("queue-limit").textContent = `GPU limit reported by queue events · room limit ${event.parallel_limit}`;
        const mode = event.daytona_mode === "live" ? "Daytona live mode" : "Local worker mode";
        setEnvironment({ text: event.sample ? "Demo: local processing" : event.daytona_mode === "live" ? "Daytona: live sandboxes" : "Local: in-process decoding" });
        setNosanaStatus(event.sample ? "Nosana: cached sample · no live calls" : event.nosana_mode === "configured" ? `Nosana: ${event.model} · configured` : "Nosana: not used · offline mock", event.sample || event.nosana_mode !== "configured" ? "cache" : "configured");
        addLog("technical", `Run ${event.run_id} · ${mode} · ${event.nosana_mode} · model ${event.model}`);
        if (event.sample) addLog("plain", "Cached offline demo: six sample rooms use bundled responses, not live cloud inference.");
        break;
      }
      case "state":
        if (tile) {
          tile.state = event.state || tile.state;
          tile.sandbox = event.sandbox || tile.sandbox;
          tile.message = event.message || null;
          if (event.elapsed !== undefined) tile.elapsed = Math.max(0, finite(event.elapsed));
          if (["released", "destroyed", "error", "cleanup_failed"].includes(event.state) && tile.elapsed === null) tile.elapsed = tileElapsed(tile);
          if (event.state === "cleanup_failed") tile.error = "Sandbox deletion needs review";
          if (event.cleanup === "failed" || event.state === "cleanup_failed") state.cleanupFailed = true;
          if (event.state === "released" || event.state === "destroyed") addLog("plain", event.state === "destroyed" ? "Remote sandbox destroyed." : "Local room worker released.", index);
          if (event.message) addLog("technical", event.message, index);
          renderFleet();
          updateProgress();
        }
        break;
      case "queue": {
        const active = Math.max(0, Math.trunc(finite(event.active)));
        const waiting = Math.max(0, Math.trunc(finite(event.waiting)));
        const limit = Math.max(1, Math.trunc(finite(event.limit, 1)));
        $("queue-text").textContent = `${active} active · ${waiting} waiting`;
        $("queue-limit").textContent = `${limit} concurrent inference ${limit === 1 ? "slot" : "slots"}`;
        $("queue-active-bar").style.width = `${Math.min(100, active / limit * 100)}%`;
        $("gpu-queue").setAttribute("aria-label", `GPU queue: ${active} active, ${waiting} waiting, limit ${limit}`);
        break;
      }
      case "inference":
        if (tile) {
          tile.source = ["live", "cache", "mock"].includes(event.source) ? event.source : "mock";
          renderFleet();
        }
        if (state.meta?.sample) setNosanaStatus("Nosana: cached sample · no live calls", "cache");
        else if (["live", "cache", "mock"].includes(event.source)) setNosanaStatus(`Nosana: ${event.model || "model"} · ${event.source === "live" ? "live" : event.source === "cache" ? "cache" : "offline mock"}`, event.source);
        addLog("technical", `Inference ${event.source || "unknown"} · ${event.model || "model unavailable"}`, index);
        break;
      case "log":
        addLog(event.level === "technical" ? "technical" : "plain", event.message || "", index);
        break;
      case "room": {
        if (index === null || !event.result) break;
        const room = normaliseRoom(event.result, index);
        state.rooms.set(room.id, room);
        if (tile) {
          tile.result = room;
          tile.name = room.name;
          if (tile.state !== "destroyed" && tile.state !== "cleanup_failed") tile.state = "released";
        }
        if (!state.selectedRoom) state.selectedRoom = room.id;
        $("inventory").hidden = false;
        $("run-error").hidden = true;
        renderFleet();
        refreshInventory();
        updateProgress();
        addLog("plain", `${room.name} added ${room.items.length} ${room.items.length === 1 ? "item" : "items"} to the ledger.`, index);
        break;
      }
      case "dedupe": {
        const flags = Array.isArray(event.flags) ? event.flags : [];
        flags.forEach((flag) => {
          const found = findItem(flag.id);
          if (found) {
            found.item.duplicate_of = flag.duplicate_of || null;
            found.item.duplicate_confirmed = false;
          }
        });
        if (flags.length) addLog("plain", `${flags.length} possible ${flags.length === 1 ? "duplicate" : "duplicates"} flagged. Every item remains in the inventory.`);
        refreshInventory();
        break;
      }
      case "error":
        state.failures += 1;
        if (tile) {
          tile.state = "error";
          tile.error = String(event.message || "Room processing failed");
        }
        addLog("plain", "This room could not be processed. Other rooms continue.", index);
        addLog("technical", String(event.message || "Unknown room error"), index);
        renderFleet();
        updateProgress();
        break;
      case "summary":
        state.summary = event;
        addLog("technical", `Summary · ${event.rooms} rooms · ${event.sandboxes} sandboxes · ${event.destroyed} destroyed · ${event.files_retained} uploaded files retained`);
        break;
      case "done":
        finishRun(Boolean(event.ok));
        break;
      default:
        addLog("technical", `Ignored unsupported event type: ${event.type}`, index);
    }
  }

  function finishRun(ok) {
    if (state.done) return;
    state.done = true;
    setBusy(false);
    $("run-title").textContent = allRooms().length ? sharedText("yourEvidenceLedger") : "Run finished";
    $("run-progress-bar").style.width = "100%";
    $("queue-text").textContent = "0 active · 0 waiting";
    $("queue-active-bar").style.width = "0%";
    $("queue-limit").textContent = "Inference queue closed";
    if (!allRooms().length) {
      $("run-error").hidden = false;
      $("run-error-message").textContent = state.failures ? `${state.failures} room ${state.failures === 1 ? "worker" : "workers"} reported an error. Check the technical log and try different photos.` : "No visible household items or rooms were returned. Try a clearer set of photos.";
    }
    updateProgress();
    updateExportAvailability();
    addLog("plain", ok ? "All room workers have finished." : "The run finished with room errors. Usable room evidence remains available.");
    if (state.summary) showSummaryToast(state.summary, ok);
    else showToast(ok ? "Run complete" : "Run finished with errors", `${allRooms().length} rooms returned · ${allRooms().reduce((sum, room) => sum + room.items.length, 0)} items`, !ok);
  }

  function failRun(error) {
    state.done = true;
    setBusy(false);
    setEnvironment({ text: "Run interrupted · local evidence retained in this tab", status: "error" });
    const message = error instanceof Error ? error.message : "The analysis stream ended unexpectedly.";
    addLog("technical", message);
    addLog("plain", "The run stopped before completion. Any returned rooms can still be edited and exported.");
    $("run-title").textContent = allRooms().length ? "Run interrupted — partial ledger" : "Could not start the run";
    $("run-error").hidden = false;
    $("run-error-message").textContent = message;
    $("run-progress-bar").style.width = "100%";
    $("run-progress-bar").style.background = "var(--hazard)";
    updateExportAvailability();
    showToast("Analysis interrupted", message, true);
  }

  function showSummaryToast(summary, ok) {
    const rooms = Math.max(0, Math.trunc(finite(summary.rooms)));
    const items = Math.max(0, Math.trunc(finite(summary.items)));
    const retained = Math.max(0, Math.trunc(finite(summary.files_retained)));
    const duration = finite(summary.duration_seconds);
    const workerIds = new Set([...state.tiles.values()].map((tile) => tile.sandbox).filter((id) => id && !["pending", "creating"].includes(id)));
    const workerCount = workerIds.size || state.tiles.size || rooms;
    const local = summary.daytona_mode !== "live";
    let message;
    if (local) {
      message = `${rooms} rooms · ${workerCount} local workers · ${items} items · ${duration}s · ${retained} uploaded photo files retained`;
    } else {
      const sandboxes = workerCount || Math.max(0, Math.trunc(finite(summary.sandboxes)));
      message = `${rooms} rooms · ${sandboxes} sandboxes in parallel · ${items} items · ${duration}s · ${retained} uploaded photo files retained`;
      const destroyed = Math.max(0, Math.trunc(finite(summary.destroyed)));
      if (destroyed >= sandboxes && sandboxes > 0 && !state.cleanupFailed) message += " · all destroyed";
      else if (state.cleanupFailed || destroyed < sandboxes) message += " · cleanup needs review";
    }
    if (summary.failures) message += ` · ${summary.failures} failed`;
    const title = !ok ? "Run finished with room errors" : state.meta?.sample ? "Cached sample complete" : local ? "Local inventory complete" : "Live inventory complete";
    showToast(title, message, !ok || state.cleanupFailed);
  }

  function showToast(title, message, warning = false) {
    $("toast-title").textContent = title;
    $("toast-message").textContent = message;
    $("run-toast").classList.toggle("is-warning", warning);
    $("run-toast").querySelector(".toast-mark").textContent = warning ? "!" : "✓";
    $("run-toast").hidden = false;
  }

  async function responseError(response) {
    let message = `The server returned HTTP ${response.status}.`;
    try {
      const body = await response.json();
      if (body.detail) message = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch (_) {
      // Keep the bounded HTTP status message when the response is not JSON.
    }
    return new Error(message);
  }

  async function startAnalysis(files, sample = false, prepared = false) {
    if ((state.running && !prepared) || !files.length) return;
    setBusy(true);
    prepareRun(files);
    const form = new FormData();
    files.forEach((file) => form.append("files", file, file.name));
    form.append("sample", String(sample));
    try {
      const response = await fetch("/api/analyze", { method: "POST", body: form, headers: { Accept: "text/event-stream" } });
      if (!response.ok) throw await responseError(response);
      addLog("technical", `Analyze stream opened · HTTP ${response.status} · ${files.length} files`);
      const decoder = new TextDecoder();
      let buffer = "";
      const consumeFrame = (frame) => {
        const data = frame.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n").trim();
        if (!data || data === "[DONE]") return;
        try {
          handleEvent(JSON.parse(data));
        } catch (error) {
          addLog("technical", `Skipped malformed event: ${error instanceof Error ? error.message : "unknown parse error"}`);
        }
      };
      if (response.body?.getReader) {
        const reader = response.body.getReader();
        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value || new Uint8Array(), { stream: !done }).replaceAll("\r\n", "\n");
          let boundary = buffer.indexOf("\n\n");
          while (boundary >= 0) {
            consumeFrame(buffer.slice(0, boundary));
            buffer = buffer.slice(boundary + 2);
            boundary = buffer.indexOf("\n\n");
          }
          if (done) break;
        }
      } else {
        buffer = await response.text();
      }
      if (buffer.trim()) buffer.split(/\r?\n\r?\n/).forEach(consumeFrame);
      if (!state.done) finishRun(state.failures === 0);
    } catch (error) {
      failRun(error);
    }
  }

  async function runSample() {
    if (state.running) return;
    setBusy(true);
    showUploadError("");
    try {
      const response = await fetch("/api/samples", { headers: { Accept: "application/json" } });
      if (!response.ok) throw await responseError(response);
      const payload = await response.json();
      const samples = Array.isArray(payload.samples) ? payload.samples : [];
      if (!samples.length) throw new Error("No bundled sample photos are available.");
      const files = await Promise.all(samples.map(async (sample, index) => {
        const imageResponse = await fetch(sample.url);
        if (!imageResponse.ok) throw new Error(`Could not load sample room ${index + 1}.`);
        const blob = await imageResponse.blob();
        const safeName = String(sample.name || `Room ${index + 1}`).replace(/[\\/]/g, "-").slice(0, 80);
        return new File([blob], `${safeName}.jpg`, { type: "image/jpeg" });
      }));
      await startAnalysis(files, true, true);
    } catch (error) {
      setBusy(false);
      showUploadError(error instanceof Error ? error.message : "The sample home could not be loaded.");
    }
  }

  function refreshInventory() {
    const rooms = allRooms();
    if (!rooms.length) {
      updateExportAvailability();
      return;
    }
    if (!rooms.some((room) => room.id === state.selectedRoom)) state.selectedRoom = rooms[0].id;
    if (state.selectedItem && !findItem(state.selectedItem)) state.selectedItem = null;
    updateStats();
    renderRoomList();
    renderActiveRoom();
    renderQuakePanel();
    renderInspector();
    updateExportAvailability();
  }

  function updateStats() {
    const rooms = allRooms();
    const items = rooms.flatMap((room) => room.items);
    const replacement = items.reduce((sum, item) => sum + finite(item.replacement_usd), 0);
    const acv = items.reduce((sum, item) => sum + acvFor(item), 0);
    $("total-value").textContent = money0.format(replacement);
    $("acv-value").textContent = money0.format(acv);
    $("item-count").textContent = String(items.length);
    $("room-count").textContent = String(rooms.length);
  }

  function renderRoomList() {
    const list = clear($("room-list"));
    allRooms().forEach((room) => {
      const button = el("button", "room-tab");
      button.type = "button";
      button.dataset.roomId = room.id;
      button.dataset.number = String(room.index + 1).padStart(2, "0");
      button.setAttribute("aria-current", String(room.id === state.selectedRoom));
      button.setAttribute("aria-label", `${room.name}, ${localizedItemCount(room.items.length)}`);
      button.append(el("strong", "", room.name), el("small", "", `${localizedItemCount(room.items.length)} · ${money0.format(room.items.reduce((sum, item) => sum + item.replacement_usd, 0))}`));
      list.append(button);
    });
  }

  function sleepingPriority(room, item) {
    return room.room_type === "bedroom" && item.near_bed_or_exit && ["medium", "high"].includes(item.risk);
  }

  function sortedItems(room) {
    return [...room.items].sort((a, b) => {
      if (state.mode === "quake") {
        const priority = Number(sleepingPriority(room, b)) - Number(sleepingPriority(room, a));
        if (priority) return priority;
        const weights = { high: 0, medium: 1, low: 2 };
        const risk = weights[a.risk] - weights[b.risk];
        if (risk) return risk;
      }
      return a.index - b.index;
    });
  }

  function activeRoom() {
    return state.rooms.get(state.selectedRoom) || allRooms()[0] || null;
  }

  function renderActiveRoom() {
    const room = activeRoom();
    if (!room) return;
    $("active-room-name").textContent = room.name;
    const readableType = roomTypeLabel(room);
    const high = room.items.filter((item) => item.risk === "high").length;
    $("active-room-meta").textContent = `${readableType} · ${room.width || "?"} × ${room.height || "?"} · ${localizedItemCount(room.items.length)}`;
    $("active-room-risk").hidden = state.mode !== "quake" || !high;
    $("active-room-risk").textContent = state.language === "ja" ? JA.roomHazards.replace("{count}", high) : `${high} high-risk ${high === 1 ? "item" : "items"}`;
    const canvas = clear($("photo-canvas"));
    const image = el("img");
    const url = photoUrl(room.image);
    if (url) image.src = url;
    image.alt = `${room.name}: original sanitized room photograph`;
    image.id = `room-image-${room.index + 1}`;
    canvas.append(image);
    const overlay = svgEl("svg", {
      class: "box-overlay", viewBox: "0 0 1000 1000", preserveAspectRatio: "none",
      role: "group", "aria-label": `${room.name} numbered item boxes`,
    });
    overlay.id = "box-overlay";
    room.items.forEach((item) => {
      const [x0, y0, x1, y1] = item.box;
      const group = svgEl("g", {
        class: `box-target${item.id === state.selectedItem ? " is-selected" : ""}`,
        tabindex: "0", role: "button", "data-item-id": item.id, "data-risk": item.risk,
        "aria-label": `Item ${item.index}: ${item.label}`, "aria-pressed": String(item.id === state.selectedItem),
      });
      const width = Math.max(1, x1 - x0);
      const height = Math.max(1, y1 - y0);
      group.append(svgEl("title", {}, `${item.index}. ${item.label}`));
      group.append(svgEl("rect", { class: "detection-box", x: x0, y: y0, width, height }));
      const plateX = Math.min(948, Math.max(0, x0));
      const plateY = Math.min(955, Math.max(0, y0));
      group.append(svgEl("rect", { class: "number-plate", x: plateX, y: plateY, width: 52, height: 45 }));
      group.append(svgEl("text", { class: "box-number", x: plateX + 26, y: plateY + 24 }, item.index));
      overlay.append(group);
    });
    canvas.append(overlay);
    const caption = clear($("photo-caption"));
    caption.append(el("span", "", `SHA-256 ${String(room.sha256 || "unavailable").slice(0, 16)}${room.sha256 ? "…" : ""}`), el("span", "", room.metadata_removed ? "Metadata removed · sanitized JPEG" : "Sanitized evidence image"));
    $("legend-title").textContent = state.mode === "quake" && state.language === "ja" ? "番号付き家具・家電リスト" : "Numbered inventory";
    $("legend-count").textContent = localizedItemCount(room.items.length);
    renderLegend(room);
  }

  function renderLegend(room) {
    const legend = clear($("item-legend"));
    if (!room.items.length) {
      legend.append(el("p", "item-empty", state.mode === "quake" && state.language === "ja" ? "この部屋の項目はありません。" : "No items remain in this room. Deleted item numbers are not reassigned."));
      return;
    }
    sortedItems(room).forEach((item) => {
      const button = el("button", `item-row${item.id === state.selectedItem ? " is-selected" : ""}`);
      button.type = "button";
      button.dataset.itemId = item.id;
      button.setAttribute("aria-pressed", String(item.id === state.selectedItem));
      button.append(el("span", "item-index", item.index));
      const main = el("span", "item-main");
      main.append(el("strong", "", item.label));
      const detail = el("small");
      if (state.mode === "quake") {
        const dot = el("span", `risk-dot ${item.risk}`);
        dot.setAttribute("aria-hidden", "true");
        detail.append(dot, document.createTextNode(sleepingPriority(room, item) ? `${riskLabel(item.risk)} · ${t("sleepingShort")}` : `${riskLabel(item.risk)} · ${item.category}`));
      } else {
        const details = [item.category, item.condition];
        if (item.duplicate_of) details.push("possible duplicate");
        detail.textContent = details.join(" · ");
      }
      main.append(detail);
      button.append(main, el("span", "item-price", money0.format(item.replacement_usd)));
      legend.append(button);
    });
  }

  function readinessScore() {
    const rooms = allRooms();
    if (!rooms.length) return 100;
    let penalty = 0;
    rooms.forEach((room) => {
      const multiplier = room.room_type === "bedroom" ? 1.5 : 1;
      room.items.forEach((item) => {
        penalty += (item.risk === "high" ? 8 : item.risk === "medium" ? 3 : 0) * multiplier;
      });
    });
    return Math.max(0, Math.min(100, Math.round(100 - penalty / Math.sqrt(rooms.length))));
  }

  function shoppingList() {
    const quantities = new Map();
    allRooms().forEach((room) => room.items.forEach((item) => {
      if (item.risk === "low") return;
      item.fix_keys.forEach((key) => {
        if (FIXES[key]) quantities.set(key, (quantities.get(key) || 0) + 1);
      });
    }));
    return [...quantities.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, quantity]) => ({ key, quantity, total: FIXES[key].unit * quantity }));
  }

  function renderQuakePanel() {
    const score = readinessScore();
    $("readiness-score").textContent = String(score);
    $("readiness-meter").setAttribute("aria-valuenow", String(score));
    $("readiness-meter").setAttribute("aria-valuetext", `${score} / 100`);
    $("readiness-ring").style.strokeDashoffset = String(100 - score);
    $("readiness-ring").style.stroke = score >= 80 ? "var(--safe)" : score >= 55 ? "var(--gold)" : "var(--hazard)";
    $("quake-title").textContent = t("readiness");
    $("readiness-summary").textContent = t("readinessSummary");
    const band = score >= 80 ? t("readinessGood") : score >= 55 ? t("readinessFair") : t("readinessLow");
    $("readiness-band").textContent = band;
    $("readiness-band").style.borderColor = score >= 80 ? "var(--safe)" : score >= 55 ? "var(--gold)" : "var(--hazard)";
    $("readiness-band").style.color = score >= 80 ? "var(--safe)" : score >= 55 ? "var(--gold)" : "var(--hazard)";
    $("shopping-title").textContent = t("shopping");
    const list = shoppingList();
    const total = list.reduce((sum, row) => sum + row.total, 0);
    $("shopping-total").textContent = `${yen.format(total)} ${t("estimated")}`;
    const container = clear($("shopping-list"));
    if (!list.length) {
      container.append(el("p", "quake-empty", t("noFixes")));
      return;
    }
    list.forEach((row) => {
      const line = el("div", "shopping-row");
      line.append(el("span", "shopping-quantity", `× ${row.quantity}`), el("span", "shopping-product", fixName(row.key)), el("span", "shopping-price", yen.format(row.total)));
      container.append(line);
    });
  }

  function definitionList(entries) {
    const list = el("dl", "evidence-dl");
    entries.forEach(([label, value, className]) => {
      const row = el("div");
      row.append(el("dt", "", label), el("dd", className || "", value));
      list.append(row);
    });
    return list;
  }

  function renderInspector() {
    const inspector = clear($("inspector"));
    const found = state.selectedItem ? findItem(state.selectedItem) : null;
    if (!found) {
      const empty = el("div", "inspector-empty");
      const icon = svgEl("svg", { viewBox: "0 0 48 48", "aria-hidden": "true" });
      icon.append(svgEl("path", { d: "M7 17V7h10M31 7h10v10M41 31v10H31M17 41H7V31M17 25h14M24 18v14", fill: "none", stroke: "currentColor" }));
      empty.append(icon, el("h3", "", sharedText("inspectEvidence")), el("p", "", sharedText("inspectHint")));
      inspector.append(empty);
      return;
    }
    const { room, item } = found;
    const content = el("div", "inspector-content");
    const top = el("div", "inspector-topline");
    top.append(el("span", "inspector-id", item.id));
    if (item.verified) top.append(el("span", "verified-label", "Verified ✓"));
    content.append(top);
    const cropBox = el("div", "inspector-crop");
    const crop = photoUrl(item.crop);
    if (crop) {
      const image = el("img");
      image.src = crop;
      image.alt = `Evidence crop: ${item.label}`;
      cropBox.append(image);
    } else cropBox.append(el("span", "", "Evidence crop unavailable"));
    content.append(cropBox);
    const titleRow = el("div", "inspector-title-row");
    const titleGroup = el("div");
    titleGroup.append(el("h3", "", item.label), el("span", "inspector-category", item.category));
    titleRow.append(titleGroup, el("span", `risk-chip ${item.risk}`, state.mode === "quake" ? riskLabel(item.risk) : `${item.risk} risk`));
    content.append(titleRow);
    if (state.mode === "quake" && sleepingPriority(room, item)) content.append(el("div", "sleeping-badge", t("sleeping")));
    const prices = el("div", "price-pair");
    const replacement = el("div");
    replacement.append(el("span", "", "Replacement"), el("strong", "", money2.format(item.replacement_usd)));
    const acv = el("div");
    acv.append(el("span", "", "Actual cash value"), el("strong", "", money2.format(acvFor(item))));
    prices.append(replacement, acv);
    content.append(prices);
    if (item.price_flag) {
      const warning = el("p", "price-warning", "⚠ AI estimate adjusted to typical range");
      warning.title = String(item.price_flag);
      content.append(warning);
    }
    content.append(definitionList([
      ["Condition", item.condition],
      ["Estimated age", `${item.age_years} ${item.age_years === 1 ? "year" : "years"}`],
      ["Confidence", `${Math.round(item.confidence * 100)}%`],
      ["Brand / model", item.brand_model || "Not visibly identified"],
      ["Receipt", item.receipt ? "Available ✓" : "Not marked"],
      ["Box coordinates", item.box.map((value) => Math.round(value)).join(", ")],
    ]));
    if (state.mode === "quake") {
      const reason = el("div", "quake-reason");
      reason.append(el("strong", "", t("reasonTitle")), document.createTextNode(localizedRiskReason(item)));
      if (item.fix_keys.length) reason.append(el("div", "fix-tags", `${t("recommendedFix")}: ${item.fix_keys.map(fixName).join(" · ")}`));
      content.append(reason);
    }
    if (item.duplicate_of && !item.duplicate_dismissed && !item.duplicate_confirmed) {
      const duplicate = el("div", "duplicate-panel");
      duplicate.append(el("strong", "", "⚠ Possible duplicate"), el("p", "", `Matches ${item.duplicate_of}. Confirm the relationship or dismiss it — the item will not be deleted.`));
      const actions = el("div", "duplicate-actions");
      const confirm = el("button", "text-button", "Confirm duplicate");
      confirm.type = "button";
      confirm.dataset.duplicateAction = "confirm";
      confirm.dataset.itemId = item.id;
      const dismiss = el("button", "text-button", "Dismiss flag");
      dismiss.type = "button";
      dismiss.dataset.duplicateAction = "dismiss";
      dismiss.dataset.itemId = item.id;
      actions.append(confirm, dismiss);
      duplicate.append(actions);
      content.append(duplicate);
    } else if (item.duplicate_confirmed) {
      const resolution = el("div", "duplicate-resolution", `Confirmed duplicate of ${item.duplicate_of} · kept in ledger and exports.`);
      const undo = el("button", "text-button", "Undo confirmation");
      undo.type = "button";
      undo.dataset.duplicateAction = "undo";
      undo.dataset.itemId = item.id;
      resolution.append(document.createElement("br"), undo);
      content.append(resolution);
    } else if (item.duplicate_dismissed) {
      content.append(el("div", "duplicate-resolution", "Duplicate flag dismissed · item retained."));
    }
    const actions = el("div", "inspector-actions");
    const edit = el("button", "button button-gold", "Edit item");
    edit.type = "button";
    edit.id = "edit-item-button";
    edit.dataset.itemId = item.id;
    const fingerprint = definitionList([["Room fingerprint", String(room.sha256 || "Unavailable"), "fingerprint"]]);
    actions.append(edit);
    content.append(actions, fingerprint);
    inspector.append(content);
  }

  function selectItem(id) {
    const found = findItem(id);
    if (!found) return;
    const roomChanged = state.selectedRoom !== found.room.id;
    state.selectedRoom = found.room.id;
    state.selectedItem = id;
    if (roomChanged) {
      renderRoomList();
      renderActiveRoom();
    } else {
      document.querySelectorAll("[data-item-id]").forEach((node) => {
        const selected = node.dataset.itemId === id;
        node.classList.toggle("is-selected", selected);
        if (node.matches("button, g")) node.setAttribute("aria-pressed", String(selected));
      });
    }
    renderInspector();
  }

  function setMode(mode) {
    if (!["insurance", "quake"].includes(mode)) return;
    state.mode = mode;
    document.body.dataset.mode = mode;
    $("mode-insurance").setAttribute("aria-pressed", String(mode === "insurance"));
    $("mode-quake").setAttribute("aria-pressed", String(mode === "quake"));
    $("quake-panel").hidden = mode !== "quake";
    $("quake-panel").lang = mode === "quake" ? state.language : "en";
    if (activeRoom()) {
      renderRoomList();
      renderActiveRoom();
      renderQuakePanel();
      renderInspector();
    }
  }

  function toggleLanguage() {
    state.language = state.language === "en" ? "ja" : "en";
    document.documentElement.lang = state.language;
    document.documentElement.dataset.language = state.language;
    try { localStorage.setItem("roomledger-language", state.language); } catch (_) { /* Language still works without storage. */ }
    $("language-label").textContent = state.language === "ja" ? "EN" : "日本語";
    $("language-toggle").setAttribute("aria-label", state.language === "ja" ? "Switch interface to English" : "Switch interface to Japanese");
    $("quake-panel").lang = state.language;
    translateSharedUI();
    if (activeRoom()) {
      renderRoomList();
      renderActiveRoom();
      renderQuakePanel();
      renderInspector();
    }
  }

  function openEditor(id) {
    const found = findItem(id);
    if (!found) return;
    const { item } = found;
    $("edit-item-id").value = item.id;
    $("edit-label").value = item.label;
    $("edit-price").value = String(item.replacement_usd);
    $("edit-condition").value = item.condition;
    $("edit-receipt").checked = Boolean(item.receipt);
    $("edit-error").hidden = true;
    $("item-dialog-title").textContent = `Edit item ${item.index}`;
    updateAcvPreview();
    $("item-dialog").showModal();
    requestAnimationFrame(() => $("edit-label").focus());
  }

  function updateAcvPreview() {
    const found = findItem($("edit-item-id").value);
    if (!found) return;
    const preview = { ...found.item, replacement_usd: Math.max(0, finite($("edit-price").value)), condition: $("edit-condition").value };
    $("edit-acv-preview").textContent = money2.format(acvFor(preview));
  }

  function saveEdit(event) {
    event.preventDefault();
    const found = findItem($("edit-item-id").value);
    if (!found) return;
    const label = $("edit-label").value.trim();
    const price = Number($("edit-price").value);
    if (!label || !Number.isFinite(price) || price < 0 || price > 1000000) {
      $("edit-error").textContent = "Enter an item label and a replacement price from $0 to $1,000,000.";
      $("edit-error").hidden = false;
      return;
    }
    found.item.label = label.slice(0, 160);
    found.item.replacement_usd = Math.round(price * 100) / 100;
    found.item.condition = $("edit-condition").value;
    found.item.receipt = $("edit-receipt").checked;
    found.item.acv_usd = acvFor(found.item);
    found.item.price_flag = null;
    found.item._edited = true;
    $("item-dialog").close();
    refreshInventory();
    requestAnimationFrame(() => $("edit-item-button")?.focus({ preventScroll: true }));
  }

  function askDelete() {
    const found = findItem($("edit-item-id").value);
    if (!found) return;
    $("delete-confirmation-copy").textContent = `Delete “${found.item.label}” from this browser ledger and exports? Original inventory number ${found.item.index} will not be reassigned.`;
    $("item-dialog").close();
    $("delete-dialog").showModal();
  }

  function deleteItem(event) {
    event.preventDefault();
    const id = $("edit-item-id").value;
    const found = findItem(id);
    if (!found) return;
    found.room.items = found.room.items.filter((item) => item.id !== id);
    state.deletedIds.add(id);
    state.selectedItem = null;
    $("delete-dialog").close();
    refreshInventory();
    requestAnimationFrame(() => document.querySelector('.room-tab[aria-current="true"]')?.focus({ preventScroll: true }));
  }

  function resolveDuplicate(id, action) {
    const found = findItem(id);
    if (!found) return;
    if (action === "confirm") {
      found.item.duplicate_confirmed = true;
      found.item.duplicate_dismissed = false;
    } else if (action === "dismiss") {
      found.item.duplicate_dismissed = true;
      found.item.duplicate_confirmed = false;
    } else {
      found.item.duplicate_confirmed = false;
      found.item.duplicate_dismissed = false;
    }
    found.item._edited = true;
    refreshInventory();
  }

  function csvCell(value) {
    let text = String(value ?? "").replaceAll("\0", "");
    if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }

  function exportCsv() {
    const rows = [["room", "item", "category", "condition", "replacement", "ACV", "verified", "receipt", "fingerprint"]];
    allRooms().forEach((room) => [...room.items].sort((a, b) => a.index - b.index).forEach((item) => {
      rows.push([
        room.name, item.label, item.category, item.condition,
        finite(item.replacement_usd).toFixed(2), acvFor(item).toFixed(2),
        item.verified ? "true" : "false", item.receipt ? "true" : "false", room.sha256 || "",
      ]);
    }));
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "roomledger-inventory.csv";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function reportBoxes(room) {
    return room.items.map((item) => {
      const [x0, y0, x1, y1] = item.box.map((value) => Math.max(0, Math.min(1000, finite(value))));
      const color = item.risk === "high" ? "#d95845" : item.risk === "medium" ? "#a97812" : "#207d70";
      const plateX = Math.min(948, Math.max(0, x0));
      const plateY = Math.min(955, Math.max(0, y0));
      return `<g><title>${escapeHtml(`${item.index}. ${item.label}`)}</title><rect x="${x0}" y="${y0}" width="${Math.max(1, x1 - x0)}" height="${Math.max(1, y1 - y0)}" fill="${color}18" stroke="${color}" stroke-width="5" vector-effect="non-scaling-stroke"/><rect x="${plateX}" y="${plateY}" width="52" height="45" fill="${color}"/><text x="${plateX + 26}" y="${plateY + 24}" fill="white" font-family="Arial,sans-serif" font-size="25" font-weight="700" text-anchor="middle" dominant-baseline="central">${item.index}</text></g>`;
    }).join("");
  }

  function buildReport() {
    const rooms = allRooms();
    const items = rooms.flatMap((room) => room.items.map((item) => ({ room, item })));
    const replacement = items.reduce((sum, entry) => sum + entry.item.replacement_usd, 0);
    const acv = items.reduce((sum, entry) => sum + acvFor(entry.item), 0);
    const score = readinessScore();
    const shopping = shoppingList();
    const shoppingTotal = shopping.reduce((sum, row) => sum + row.total, 0);
    const disclaimer = "AI estimates — verify with receipts. Not an insurance appraisal.";
    const date = new Date().toLocaleDateString(state.language === "ja" ? "ja-JP" : "en-US", { year: "numeric", month: "long", day: "numeric" });
    const styles = `
      :root{color:#172131;background:#fff;font-family:Arial,"Noto Sans","Yu Gothic",sans-serif;line-height:1.45}*{box-sizing:border-box}body{margin:0;color:#172131}main{max-width:1000px;margin:auto;padding:46px}h1,h2,h3{font-family:Georgia,"Yu Mincho",serif;font-weight:400}h1{font-size:46px;line-height:1.08;margin:10px 0 18px}h2{font-size:27px;margin:35px 0 12px;border-bottom:2px solid #172131;padding-bottom:8px}h3{font-size:19px;margin:22px 0 8px}.brand{font-size:22px}.brand b{color:#9a731b}.lead{color:#49586a;max-width:650px}.cover{min-height:80vh;display:flex;flex-direction:column;justify-content:center}.totals{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid #a9b1ba;border-bottom:1px solid #a9b1ba;margin:28px 0}.totals div{padding:16px 12px;border-right:1px solid #d7dce1}.totals div:last-child{border:0}.totals span{display:block;color:#5a6877;font-size:11px}.totals strong{display:block;font-family:Georgia,serif;font-weight:400;font-size:26px}.readiness{font-size:20px;padding:16px;border-left:5px solid ${score >= 80 ? "#207d70" : score >= 55 ? "#a97812" : "#d95845"};background:#f4f5f6}.disclaimer{margin-top:26px;padding:14px;border:1px solid #a97812;color:#674e14;font-weight:700}.meta{color:#5a6877;font-size:12px}.room-break{page-break-before:always}.room-photo{position:relative;margin:14px 0;background:#eee}.room-photo img{display:block;width:100%;height:auto}.room-photo svg{position:absolute;inset:0;width:100%;height:100%}.room-meta{display:flex;justify-content:space-between;gap:15px;color:#5a6877;font-size:11px}table{border-collapse:collapse;width:100%;font-size:11px}th{text-align:left;color:#49586a;background:#eef0f2}th,td{padding:8px;border:1px solid #ccd2d8;vertical-align:top;overflow-wrap:anywhere}td.num,th.num{text-align:right;white-space:nowrap}.crop{width:85px;height:65px;object-fit:cover}.legend{padding:0;list-style:none;font-size:12px}.legend li{display:grid;grid-template-columns:34px 1fr auto;gap:10px;padding:7px 0;border-bottom:1px solid #e0e3e6}.number{font-family:monospace;color:#795d19}.high{color:#ac3c2c;font-weight:bold}.medium{color:#795d19}.sleeping{display:inline-block;background:#fae6e2;color:#9a2f21;padding:3px 6px;font-weight:bold}.shopping{width:100%;font-size:13px}.method{font-size:12px;color:#49586a}.fingerprints{font-family:monospace;font-size:10px;word-break:break-all}.print-button{position:fixed;right:20px;top:20px;padding:12px 18px;border:0;background:#172131;color:white;font-weight:bold;cursor:pointer}footer{margin-top:40px;padding-top:15px;border-top:1px solid #a9b1ba;font-size:12px}.footnote{font-size:10px;color:#5a6877}@page{size:A4;margin:15mm}@media print{main{max-width:none;padding:0}.print-button{display:none}.cover{min-height:245mm}h2,.room-photo,tr{break-inside:avoid}thead{display:table-header-group}.room-break{page-break-before:always}}@media(max-width:600px){main{padding:25px 16px}.totals{grid-template-columns:1fr 1fr}.totals div:nth-child(2){border-right:0}.inventory-table{font-size:9px}.crop{width:55px;height:45px}.hide-mobile{display:none}}`;
    const inventoryRows = items.map(({ room, item }) => `<tr><td>${photoUrl(item.crop) ? `<img class="crop" src="${escapeHtml(photoUrl(item.crop))}" alt="">` : ""}</td><td>${escapeHtml(room.name)}<br><span class="footnote">${escapeHtml(item.id)}</span></td><td><strong>${item.index}. ${escapeHtml(item.label)}</strong><br>${escapeHtml(item.brand_model || "—")}</td><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.condition)}<br>${item.age_years} yr</td><td class="num">${escapeHtml(money2.format(item.replacement_usd))}</td><td class="num">${escapeHtml(money2.format(acvFor(item)))}</td><td>${item.verified ? "✓" : "—"} / ${item.receipt ? "✓" : "—"}</td></tr>`).join("");
    const inventory = `<section class="room-break"><h2>Consolidated inventory</h2><p class="meta">Verified / receipt columns reflect AI refinement and user-marked proof respectively. Deleted items are excluded; original item numbers remain stable.</p><table class="inventory-table"><thead><tr><th>Crop</th><th>Room / ID</th><th>Item / brand</th><th>Category</th><th>Condition / age</th><th class="num">Replacement</th><th class="num">ACV</th><th>Verified / receipt</th></tr></thead><tbody>${inventoryRows || `<tr><td colspan="8">No items remain in the inventory.</td></tr>`}</tbody></table></section>`;
    const roomSections = rooms.map((room) => {
      const url = photoUrl(room.image);
      const legend = [...room.items].sort((a, b) => a.index - b.index).map((item) => `<li><span class="number">${item.index}</span><span><strong>${escapeHtml(item.label)}</strong> <span class="${item.risk}">${escapeHtml(riskLabel(item.risk))}</span>${sleepingPriority(room, item) ? `<br><span class="sleeping">${escapeHtml(t("sleeping"))}</span>` : ""}${item.fix_keys.length && item.risk !== "low" ? `<br><span class="footnote">${escapeHtml(t("recommendedFix"))}: ${escapeHtml(item.fix_keys.map(fixName).join(" · "))}</span>` : ""}</span><span>${escapeHtml(money0.format(item.replacement_usd))}</span></li>`).join("");
      return `<section class="room-break"><h2>${room.index + 1}. ${escapeHtml(room.name)}</h2><div class="room-meta"><span>${escapeHtml(room.room_type.replaceAll("_", " "))} · ${room.items.length} items · ${room.width} × ${room.height}</span><span>${room.metadata_removed ? "GPS & metadata removed" : "Sanitized JPEG"}</span></div><div class="room-photo">${url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(room.name)} sanitized evidence photo">` : ""}<svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="Numbered item boxes">${reportBoxes(room)}</svg></div><p class="fingerprints"><strong>Photo evidence fingerprint</strong><br>SHA-256 ${escapeHtml(room.sha256 || "Unavailable")}<br>${escapeHtml(room.captured_at || "Timestamp unavailable")}</p><ul class="legend">${legend || "<li>No items remain in this room.</li>"}</ul></section>`;
    }).join("");
    const fixes = shopping.length ? `<table class="shopping"><thead><tr><th>${escapeHtml(state.language === "ja" ? JA.quantity : "Quantity")}</th><th>${escapeHtml(state.language === "ja" ? "製品" : "Product")}</th><th class="num">${escapeHtml(state.language === "ja" ? JA.total : "Estimated JPY")}</th></tr></thead><tbody>${shopping.map((row) => `<tr><td>× ${row.quantity}</td><td>${escapeHtml(fixName(row.key))}</td><td class="num">${escapeHtml(yen.format(row.total))}</td></tr>`).join("")}</tbody></table><p><strong>${escapeHtml(yen.format(shoppingTotal))}</strong> ${escapeHtml(t("estimated"))}</p>` : `<p>${escapeHtml(t("noFixes"))}</p>`;
    const depreciation = Object.entries(DEPRECIATION).map(([category, rate]) => `<tr><td>${category}</td><td>${Math.round(rate * 100)}% per year</td></tr>`).join("");
    const evidenceRows = rooms.map((room) => `<tr><th scope="row">${escapeHtml(room.name)}</th><td class="fingerprints">${escapeHtml(room.sha256 || "Unavailable")}</td><td>${escapeHtml(room.captured_at || "Unavailable")}</td></tr>`).join("");
    return `<!doctype html><html lang="${state.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RoomLedger evidence report</title><style>${styles}</style></head><body><button class="print-button" id="print-report" type="button">Print / Save PDF</button><main><section class="cover"><div class="brand">Room<b>Ledger</b></div><h1>Home evidence &<br>quake-readiness report</h1><p class="lead">A room-by-room record of visible household property, item evidence, current replacement values, actual cash values and practical falling-hazard actions.</p><p class="meta">Prepared ${escapeHtml(date)}${state.runId ? ` · Run ${escapeHtml(state.runId)}` : ""}</p><div class="totals"><div><span>Replacement</span><strong>${escapeHtml(money0.format(replacement))}</strong></div><div><span>Actual cash value</span><strong>${escapeHtml(money0.format(acv))}</strong></div><div><span>Items</span><strong>${items.length}</strong></div><div><span>Rooms</span><strong>${rooms.length}</strong></div></div><div class="readiness">${escapeHtml(t("readiness"))}: ${score} / 100<br><small>${escapeHtml(t("readinessSummary"))}</small></div><p class="disclaimer">${disclaimer}</p></section>${inventory}${roomSections}<section class="room-break"><h2>${escapeHtml(t("shopping"))}</h2><p>Quantities are generated from fix_keys for every current medium or high-risk item. Prices are rough Japanese retail estimates, not quotations.</p>${fixes}<h2>Appendix: method & evidence</h2><div class="method"><p>Photos are decoded, EXIF/GPS metadata is removed, and a fresh sanitized JPEG is created. AI-identified objects receive normalized 0–1000 boxes and evidence crops. Item labels, brands, conditions and values remain estimates until checked.</p><p><strong>Actual cash value</strong> = replacement × condition factor × (1 − annual category depreciation)<sup>age</sup>. Age is clamped to 0–50 years. Condition factors: new 1.00, good 0.85, fair 0.65, poor 0.35. Edits recalculate ACV in the browser.</p><table><thead><tr><th>Category</th><th>Annual depreciation</th></tr></thead><tbody>${depreciation}</tbody></table><p><strong>Readiness score</strong> = 100 − (8 / high-risk item + 3 / medium-risk item), with a 1.5× multiplier in bedrooms, divided by √room count, clamped to 0–100. Bedroom priority means medium/high risk and near a bed or exit. It is a comparative furnishing-hazard score, not a structural engineering or evacuation assessment.</p><p>Possible duplicates are flagged for human confirmation and never silently removed. Photo SHA-256 fingerprints appear with each original sanitized room photograph. CSV cells are protected against spreadsheet formula injection.</p></div><h3>Photo evidence fingerprints</h3><table><thead><tr><th>Room</th><th>Sanitized JPEG SHA-256</th><th>UTC processing timestamp</th></tr></thead><tbody>${evidenceRows}</tbody></table><footer><strong>${disclaimer}</strong><br>Generated locally from the current edited browser ledger. No external report resources are loaded.</footer></section></main></body></html>`;
  }

  function openReport() {
    if (!allRooms().length) return;
    const report = window.open("", "_blank");
    if (!report) {
      showToast("Report blocked", "Allow pop-ups for this site, then choose Print report again.", true);
      return;
    }
    report.document.open();
    report.document.write(buildReport());
    report.document.close();
    report.document.getElementById("print-report")?.addEventListener("click", () => report.print());
    report.focus();
  }

  function resetApp() {
    if (state.running) return;
    state.rooms.clear();
    state.tiles.clear();
    state.files = [];
    state.meta = null;
    state.summary = null;
    state.done = false;
    state.selectedItem = null;
    state.selectedRoom = null;
    state.logs = { plain: [], technical: [] };
    $("results").hidden = true;
    $("intake").hidden = false;
    $("run-toast").hidden = true;
    $("selected-files").hidden = true;
    $("file-input").value = "";
    $("run-progress-bar").style.background = "var(--gold)";
    updateExportAvailability();
    loadHealth();
    $("intake").scrollIntoView({ block: "start" });
  }

  function bindEvents() {
    $("file-input").addEventListener("change", (event) => selectFiles(event.target.files));
    $("clear-files").addEventListener("click", () => {
      state.files = [];
      $("file-input").value = "";
      renderSelectedFiles();
      showUploadError("");
    });
    $("upload-form").addEventListener("submit", (event) => {
      event.preventDefault();
      startAnalysis(state.files, false);
    });
    $("sample-button").addEventListener("click", runSample);
    $("theme-toggle").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
    setTheme(document.documentElement.dataset.theme);
    document.documentElement.lang = state.language;
    document.documentElement.dataset.language = state.language;
    $("language-label").textContent = state.language === "ja" ? "EN" : "日本語";
    $("language-toggle").setAttribute("aria-label", state.language === "ja" ? "Switch interface to English" : "Switch interface to Japanese");
    $("quake-panel").lang = state.language;
    translateSharedUI();
    const drop = $("drop-zone");
    ["dragenter", "dragover"].forEach((type) => drop.addEventListener(type, (event) => {
      event.preventDefault();
      if (!state.running) drop.classList.add("is-dragging");
    }));
    ["dragleave", "drop"].forEach((type) => drop.addEventListener(type, (event) => {
      event.preventDefault();
      drop.classList.remove("is-dragging");
    }));
    drop.addEventListener("drop", (event) => {
      if (!state.running && event.dataTransfer?.files) selectFiles(event.dataTransfer.files);
    });

    $("room-list").addEventListener("click", (event) => {
      const button = event.target.closest("[data-room-id]");
      if (!button || !state.rooms.has(button.dataset.roomId)) return;
      state.selectedRoom = button.dataset.roomId;
      if (state.selectedItem && findItem(state.selectedItem)?.room.id !== state.selectedRoom) state.selectedItem = null;
      renderRoomList();
      renderActiveRoom();
      renderInspector();
    });
    const itemActivation = (event) => {
      const target = event.target.closest?.("[data-item-id]");
      if (target && findItem(target.dataset.itemId)) selectItem(target.dataset.itemId);
    };
    $("photo-canvas").addEventListener("click", itemActivation);
    $("item-legend").addEventListener("click", itemActivation);
    $("photo-canvas").addEventListener("keydown", (event) => {
      if (["Enter", " "].includes(event.key) && event.target.matches("[data-item-id]")) {
        event.preventDefault();
        selectItem(event.target.dataset.itemId);
      }
    });
    $("inspector").addEventListener("click", (event) => {
      const edit = event.target.closest("#edit-item-button");
      if (edit) openEditor(edit.dataset.itemId);
      const duplicate = event.target.closest("[data-duplicate-action]");
      if (duplicate) resolveDuplicate(duplicate.dataset.itemId, duplicate.dataset.duplicateAction);
    });
    $("mode-insurance").addEventListener("click", () => setMode("insurance"));
    $("mode-quake").addEventListener("click", () => setMode("quake"));
    $("language-toggle").addEventListener("click", toggleLanguage);
    $("csv-button").addEventListener("click", exportCsv);
    $("report-button").addEventListener("click", openReport);
    $("reset-button").addEventListener("click", resetApp);
    $("dismiss-toast").addEventListener("click", () => { $("run-toast").hidden = true; });

    $("item-form").addEventListener("submit", saveEdit);
    $("edit-price").addEventListener("input", updateAcvPreview);
    $("edit-condition").addEventListener("change", updateAcvPreview);
    $("close-item-dialog").addEventListener("click", () => $("item-dialog").close());
    $("cancel-edit-button").addEventListener("click", () => $("item-dialog").close());
    $("delete-item-button").addEventListener("click", askDelete);
    $("delete-form").addEventListener("submit", deleteItem);
    $("cancel-delete-button").addEventListener("click", () => $("delete-dialog").close());
    [$("item-dialog"), $("delete-dialog")].forEach((dialog) => dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    }));

    [$("plain-log-tab"), $("technical-log-tab")].forEach((button) => {
      button.addEventListener("click", () => setLogTab(button.id.startsWith("plain") ? "plain" : "technical"));
      button.addEventListener("keydown", (event) => {
        if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          const next = event.key === "Home" ? "plain" : event.key === "End" ? "technical" : state.logTab === "plain" ? "technical" : "plain";
          setLogTab(next, true);
        }
      });
    });
  }

  bindEvents();
  window.setInterval(updateFleetClocks, 500);
  renderLogs();
  loadHealth();
})();
