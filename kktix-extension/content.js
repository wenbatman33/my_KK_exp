// ====================================================
// KK 搶票助手 v2.1 - content.js
// 針對票務平台購票頁面（/events/*/registrations/new）
// ====================================================

(function () {
  "use strict";

  if (document.getElementById("kk-bot-panel")) return;

  let config = {
    priorities: [],
    ticketCount: 1,
    targetTime: "",
    enabled: false,
  };

  let countdownTimer = null;
  let actionTimer = null;

  // ── 注入浮動面板 ───────────────────────────────────
  function createPanel() {
    const panel = document.createElement("div");
    panel.id = "kk-bot-panel";
    panel.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 300px;
      background: rgba(18, 20, 26, 0.97);
      color: #e8eaf0;
      border-radius: 14px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      z-index: 2147483647;
      overflow: hidden;
      user-select: none;
    `;

    panel.innerHTML = `
      <div style="background:linear-gradient(135deg,#1a1d27,#22263a);padding:14px 16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.07);">
        <div style="font-weight:700;font-size:14px;color:#fff;">🎫 KK 搶票助手</div>
        <div id="bot-minimize" style="cursor:pointer;color:#888;font-size:18px;line-height:1;padding:0 4px;" title="最小化">－</div>
      </div>

      <div id="bot-body" style="padding:16px;">
        <div style="margin-bottom:12px;">
          <label style="display:block;color:#8892aa;font-size:11px;margin-bottom:5px;">🎟 票種優先順序（用 | 分隔）</label>
          <input id="bot-priorities" type="text" placeholder="例如: A|VIP|3280|搖滾區"
            style="width:100%;box-sizing:border-box;background:#1e2130;border:1px solid #343848;color:#e8eaf0;border-radius:8px;padding:8px 10px;font-size:12px;outline:none;" />
          <div style="color:#555;font-size:10px;margin-top:3px;">用 | 分隔，可輸入票種名或票價（如 A|3280）</div>
        </div>

        <div style="margin-bottom:12px;">
          <label style="display:block;color:#8892aa;font-size:11px;margin-bottom:5px;">🎫 購票張數</label>
          <input id="bot-count" type="number" value="1" min="1" max="8"
            style="width:100%;box-sizing:border-box;background:#1e2130;border:1px solid #343848;color:#e8eaf0;border-radius:8px;padding:8px 10px;font-size:13px;outline:none;" />
        </div>

        <div style="margin-bottom:16px;">
          <label style="display:block;color:#8892aa;font-size:11px;margin-bottom:5px;">⏰ 開始搶票時間</label>
          <input id="bot-time" type="datetime-local"
            style="width:100%;box-sizing:border-box;background:#1e2130;border:1px solid #343848;color:#e8eaf0;border-radius:8px;padding:8px 10px;font-size:12px;outline:none;color-scheme:dark;" />
          <div style="color:#555;font-size:10px;margin-top:3px;">不設定則立即執行</div>
        </div>

        <div style="display:flex;gap:8px;">
          <button id="bot-start" style="flex:1;padding:10px;border-radius:8px;border:none;cursor:pointer;font-weight:700;font-size:13px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;">
            ▶ 開始搶票
          </button>
          <button id="bot-stop" style="flex:1;padding:10px;border-radius:8px;border:none;cursor:pointer;font-weight:700;font-size:13px;background:#374151;color:#9ca3af;" disabled>
            ◼ 停止
          </button>
        </div>

        <div id="bot-status" style="margin-top:12px;padding:10px;background:#0f1117;border-radius:8px;text-align:center;font-size:13px;color:#6b7280;min-height:20px;">
          尚未啟動
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    bindEvents(panel);
  }

  // ── 事件綁定 ──────────────────────────────────────
  function bindEvents(panel) {
    let isMinimized = false;
    panel.querySelector("#bot-minimize").onclick = () => {
      isMinimized = !isMinimized;
      panel.querySelector("#bot-body").style.display = isMinimized
        ? "none"
        : "block";
      panel.querySelector("#bot-minimize").textContent = isMinimized
        ? "＋"
        : "－";
    };

    panel.querySelector("#bot-start").onclick = () => startBot(panel);
    panel.querySelector("#bot-stop").onclick = () => stopBot(panel);

    // 欄位改動時自動儲存
    ["bot-priorities", "bot-count", "bot-time"].forEach((id) => {
      panel
        .querySelector("#" + id)
        .addEventListener("input", () => saveFieldsToStorage(panel));
      panel
        .querySelector("#" + id)
        .addEventListener("change", () => saveFieldsToStorage(panel));
    });

    makeDraggable(panel);
  }

  // ── 持久儲存欄位 ──────────────────────────────────
  function saveFieldsToStorage(panel) {
    const priorities = panel.querySelector("#bot-priorities").value;
    const count = panel.querySelector("#bot-count").value;
    const time = panel.querySelector("#bot-time").value;
    chrome.storage.local.set({
      kk_priorities: priorities,
      kk_count: count,
      kk_time: time,
    });
  }

  // ── 從 chrome.storage.local 還原欄位 ─────────────
  function restoreFields(panel) {
    chrome.storage.local.get(
      ["kk_priorities", "kk_count", "kk_time"],
      (result) => {
        if (result.kk_priorities !== undefined)
          panel.querySelector("#bot-priorities").value = result.kk_priorities;
        if (result.kk_count !== undefined)
          panel.querySelector("#bot-count").value = result.kk_count;
        if (result.kk_time !== undefined)
          panel.querySelector("#bot-time").value = result.kk_time;
      },
    );
  }

  // ── 可拖曳 ────────────────────────────────────────
  function makeDraggable(el) {
    const header = el.querySelector("div:first-child");
    let isDragging = false,
      startX,
      startY,
      initRight,
      initTop;
    header.style.cursor = "grab";
    header.addEventListener("mousedown", (e) => {
      if (e.target.id === "bot-minimize") return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initRight = parseInt(el.style.right) || 20;
      initTop = parseInt(el.style.top) || 20;
      header.style.cursor = "grabbing";
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      el.style.top = Math.max(0, initTop + (e.clientY - startY)) + "px";
      el.style.right = Math.max(0, initRight - (e.clientX - startX)) + "px";
      el.style.left = "auto";
    });
    document.addEventListener("mouseup", () => {
      isDragging = false;
      header.style.cursor = "grab";
    });
  }

  // ── 更新狀態文字 ──────────────────────────────────
  function setStatus(text, color = "#6b7280") {
    const el = document.getElementById("bot-status");
    if (el) {
      el.textContent = text;
      el.style.color = color;
    }
  }

  // ── 啟動搶票 ──────────────────────────────────────
  function startBot(panel) {
    const prioritiesRaw = panel.querySelector("#bot-priorities").value.trim();
    const count = parseInt(panel.querySelector("#bot-count").value) || 1;
    const time = panel.querySelector("#bot-time").value;

    config.priorities = prioritiesRaw
      ? prioritiesRaw
          .split("|")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    config.ticketCount = count;
    config.targetTime = time;
    config.enabled = true;

    sessionStorage.setItem("kk_bot_active", "true");
    sessionStorage.setItem("kk_bot_config", JSON.stringify(config));

    setRunningUI(panel, true);

    if (time) {
      const targetMs = new Date(time).getTime();
      if (Date.now() < targetMs) {
        setStatus("⏳ 倒數中...", "#f59e0b");
        startCountdown(targetMs);
        return;
      }
    }

    setStatus("⚡ 搶票進行中...", "#10b981");
    startAutoAction();
  }

  // ── 停止搶票 ──────────────────────────────────────
  function stopBot(panel) {
    config.enabled = false;
    sessionStorage.removeItem("kk_bot_active");
    sessionStorage.removeItem("kk_bot_config");
    sessionStorage.removeItem("kk_bot_reloaded");
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    if (actionTimer) {
      clearInterval(actionTimer);
      actionTimer = null;
    }
    setRunningUI(panel, false);
    setStatus("已停止", "#6b7280");
  }

  // ── 切換 UI 按鈕狀態 ──────────────────────────────
  function setRunningUI(panel, running) {
    const startBtn = panel.querySelector("#bot-start");
    const stopBtn = panel.querySelector("#bot-stop");
    startBtn.disabled = running;
    startBtn.style.opacity = running ? "0.45" : "1";
    stopBtn.disabled = !running;
    stopBtn.style.background = running ? "#dc2626" : "#374151";
    stopBtn.style.color = running ? "white" : "#9ca3af";
  }

  // ── 倒數計時 → 時間到 reload ─────────────────────
  function startCountdown(targetMs) {
    countdownTimer = setInterval(() => {
      const diff = targetMs - Date.now();
      if (diff <= 0) {
        clearInterval(countdownTimer);
        countdownTimer = null;
        setStatus("🔄 時間到！重新整理中...", "#f59e0b");
        sessionStorage.setItem("kk_bot_reloaded", "true");
        setTimeout(() => location.reload(), 80);
      } else {
        const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
        const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
        const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
        const ms = String(Math.floor((diff % 1000) / 10)).padStart(2, "0");
        setStatus(`⏳ ${h}:${m}:${s}.${ms}`, "#f59e0b");
      }
    }, 50);
  }

  // ── 自動行動主迴圈（每 200ms） ─────────────────────
  function startAutoAction() {
    let attemptCount = 0;
    actionTimer = setInterval(() => {
      attemptCount++;
      if (attemptCount > 300) {
        clearInterval(actionTimer);
        setStatus("⚠️ 超時 60 秒，已停止", "#ef4444");
        return;
      }
      performActions();
    }, 200);
  }

  // ── 核心行動 ──────────────────────────────────────
  function performActions() {
    const ticketDone = pickTicket();
    const agreed = checkAgreement();
    if (ticketDone && agreed) {
      const went = clickNextStep();
      if (went) {
        clearInterval(actionTimer);
        actionTimer = null;
      }
    }
  }

  // ── 選票邏輯 ──────────────────────────────────────
  // 從 + 按鈕往上找包含票種名稱＋票價的 row 容器
  function getTicketRow(btn) {
    // 先嘗試 closest tr / li
    const trOrLi = btn.closest("tr") || btn.closest("li");
    if (trOrLi) return trOrLi;

    // 若沒有 tr/li，往上最多 8 層找第一個包含票種資訊的元素
    let el = btn.parentElement;
    for (let i = 0; i < 8; i++) {
      if (!el) break;
      if (
        el.querySelector("span.ticket-unit") ||
        el.querySelector(".ticket-name") ||
        el.querySelector(".ticket-price")
      ) {
        return el;
      }
      el = el.parentElement;
    }
    // 最後 fallback：直接父元素
    return btn.parentElement;
  }

  function getRowLabels(row) {
    const unitSpan = row.querySelector("span.ticket-unit");
    const nameTd =
      row.querySelector("td.ticket-name") ||
      row.querySelector("td:first-child");
    const priceTd =
      row.querySelector("td.ticket-price") ||
      row.querySelector("td:nth-child(2)");

    const rawName = unitSpan
      ? unitSpan.innerText
      : nameTd
        ? nameTd.innerText
        : "";
    // ticketName 保留全部行（供 rowMatchesKeyword 逐行比對）
    const ticketName = rawName.trim();
    const ticketPrice = priceTd
      ? priceTd.innerText.replace(/[\n\r]/g, " ").trim()
      : "";

    return { ticketName, ticketPrice };
  }

  function rowMatchesKeyword(row, keyword) {
    const kw = keyword.trim();
    if (!kw) return false;
    return row.innerText.toLowerCase().includes(kw.toLowerCase());
  }

  function pickTicket() {
    const targetCount = config.ticketCount;

    const allPlusBtns = Array.from(
      document.querySelectorAll("button.plus, button.btn-default.plus"),
    ).filter((btn) => !btn.disabled && !btn.classList.contains("disabled"));

    if (allPlusBtns.length === 0) return false;

    let targetPlusBtn = null;

    if (config.priorities.length > 0) {
      // 按優先順序找第一個符合的票種
      for (const keyword of config.priorities) {
        for (const btn of allPlusBtns) {
          const row = getTicketRow(btn);
          if (!row) continue;
          if (rowMatchesKeyword(row, keyword)) {
            targetPlusBtn = btn;
            const { ticketName, ticketPrice } = getRowLabels(row);
            setStatus(`🔍 匹配到：${ticketName || ticketPrice}`, "#60a5fa");
            break;
          }
        }
        if (targetPlusBtn) break;
      }
    }

    if (!targetPlusBtn) targetPlusBtn = allPlusBtns[0];
    if (!targetPlusBtn) return false;

    const row = getTicketRow(targetPlusBtn);

    // 讀取目前數量：優先 Angular scope，其次 input value
    const qtyInput = row
      ? row.querySelector(
          'input.input-mini, input[type="text"], input[type="number"], input[ng-model*="count"], input[ng-model*="quantity"], input[ng-model*="amount"]',
        )
      : null;

    let currentQty = 0;
    if (qtyInput) {
      try {
        const scope = window.angular && angular.element(qtyInput).scope();
        if (scope) {
          currentQty =
            (scope.ticket && (scope.ticket.qty || scope.ticket.count)) ||
            (scope.purchase_item && scope.purchase_item.qty) ||
            parseInt(qtyInput.value) ||
            0;
        } else {
          currentQty = parseInt(qtyInput.value) || 0;
        }
      } catch (e) {
        currentQty = parseInt(qtyInput.value) || 0;
      }
    }

    if (currentQty >= targetCount) {
      setStatus(`✅ 已選 ${currentQty} 張，達標！`, "#10b981");
      return true;
    }

    targetPlusBtn.click();
    setStatus(`🎟 選票 ${currentQty + 1} / ${targetCount} 張...`, "#60a5fa");
    return false;
  }

  // ── 勾選同意條款 ──────────────────────────────────
  function checkAgreement() {
    const checkbox = document.querySelector("#person_agree_terms");
    if (!checkbox) return false;
    if (checkbox.checked) return true;

    try {
      if (window.angular) {
        const $scope = angular.element(checkbox).scope();
        if ($scope && $scope.conditions) {
          $scope.conditions.agreeTerm = true;
          $scope.$apply();
        }
      }
    } catch (e) {}

    checkbox.checked = true;
    ["click", "change", "input"].forEach((evtName) => {
      checkbox.dispatchEvent(new Event(evtName, { bubbles: true }));
    });

    setStatus("✅ 已勾選同意條款，等待按鈕解鎖...", "#10b981");
    return checkbox.checked;
  }

  // ── 點擊下一步 / 電腦配位 ──────────────────────────
  function clickNextStep() {
    // 優先：電腦配位 challenge(1)，其次：自行選位/下一步 challenge()
    // 同時找有效（非 disabled）的按鈕
    const candidates = [
      document.querySelector('button[ng-click="challenge(1)"]'), // 電腦配位
      document.querySelector('button[ng-click="challenge()"]'), // 自行選位/下一步
      document.querySelector("button.btn-primary.btn-lg"),
      Array.from(document.querySelectorAll("button.btn-primary")).find((b) =>
        /下一步|電腦配位|配位|自行選位/.test(b.innerText),
      ),
    ];

    const btn = candidates.find((b) => {
      if (!b) return false;
      const isDisabled =
        b.disabled ||
        b.classList.contains("disabled") ||
        b.classList.contains("btn-disabled-alt") ||
        b.getAttribute("disabled") !== null;
      return !isDisabled;
    });

    if (!btn) {
      setStatus("⏳ 等待按鈕解鎖（下一步/電腦配位）...", "#f59e0b");
      return false;
    }

    const label =
      btn.innerText.trim() || btn.getAttribute("ng-click") || "下一步";
    btn.click();
    setStatus(`🚀 已點擊「${label}」！`, "#10b981");
    return true;
  }

  // ── 初始化 ────────────────────────────────────────
  function init() {
    createPanel();
    const panel = document.getElementById("kk-bot-panel");

    // 每次載入都從 chrome.storage.local 恢復欄位
    restoreFields(panel);

    // 判斷是否為 reload 後自動執行
    const wasActive = sessionStorage.getItem("kk_bot_active") === "true";
    const wasReloaded = sessionStorage.getItem("kk_bot_reloaded") === "true";

    if (wasActive && wasReloaded) {
      sessionStorage.removeItem("kk_bot_reloaded");

      try {
        const saved = JSON.parse(
          sessionStorage.getItem("kk_bot_config") || "{}",
        );
        config = { ...config, ...saved, enabled: true };
      } catch (e) {}

      setRunningUI(panel, true);
      setStatus("🚨 Reload 完成，開始搶票！", "#10b981");
      setTimeout(() => startAutoAction(), 800);
    }
  }

  init();
})();
