# CLAUDE.md — 給 AI 助手的專案說明

## 專案概覽

這是一個 **Chrome 瀏覽器擴充功能（Manifest V3）**，用於自動化票務平台的購票流程。
目標頁面為票務平台 `/events/*/registrations/new` 的購票表單頁。

## 重要技術背景

### 目標頁面框架

目標票務網站使用 **AngularJS（Angular 1.x）**，而非現代 Angular 或 React。
這意味著：

- DOM 操作後必須觸發 Angular 的 Digest Cycle，否則 `ng-disabled` 等指令不會更新
- 正確做法：`angular.element(el).scope().$apply()` 而非直接改 `.disabled`
- 普通 `.click()` 對某些被 Angular 託管的元素可能無效，需搭配 `dispatchEvent`

### 已驗證的 DOM Selectors（勿更改）

| 元素              | Selector                                                        |
| ----------------- | --------------------------------------------------------------- |
| 同意條款 checkbox | `#person_agree_terms`（ng-model: `conditions.agreeTerm`）       |
| 下一步按鈕        | `button[ng-click="challenge()"]` 或 `button.btn-primary.btn-lg` |
| 票種列            | `tr.ng-scope`（每個票種一個 `<tr>`）                            |
| 加票按鈕          | `button.plus` 或 `button.btn-default.plus`                      |
| 票數 input        | `input[type="number"]` 或 `input[ng-model*="count"]`            |

### 讀取票數的正確方式

直接讀 `input.value` 在 Angular 頁面上是**不可靠的**，因為 Angular 的 Digest Cycle 可能尚未同步 DOM。
正確方式是從 Angular scope 讀取：

```js
const scope = angular.element(qtyInput).scope();
currentQty =
  (scope.ticket && scope.ticket.qty) || parseInt(qtyInput.value) || 0;
```

## 檔案說明

### `content.js`（核心）

- 使用 IIFE 包裝，防止全域污染
- 防重複注入：`if (document.getElementById("kk-bot-panel")) return;`
- 面板 ID：`kk-bot-panel`（已從 kktix 改為 kk）
- sessionStorage key：`kk_bot_active`, `kk_bot_config`, `kk_bot_reloaded`
- chrome.storage.local key：`kk_priorities`, `kk_count`, `kk_time`

### 主要流程

```
init()
 ├── createPanel()       → 注入浮動 UI
 ├── restoreFields()     → 從 chrome.storage.local 恢復欄位
 └── 若為 bot-triggered reload:
     └── startAutoAction()
          └── performActions() [每 200ms]
               ├── pickTicket()        → 選票＋加張數
               ├── checkAgreement()    → 勾選同意條款
               └── clickNextStep()     → 按下一步
```

### 倒數計時邏輯

- 時間倒數到 0 → `sessionStorage.setItem("kk_bot_reloaded", "true")` → `location.reload()`
- Reload 後 `init()` 讀到 `kk_bot_reloaded=true` → 直接跳過設定、立即執行搶票

## 命名規範

> ⚠️ 所有面向使用者的文字、元素 ID、sessionStorage key、chrome.storage key 一律使用 **`kk`** 前綴，  
> 不得出現 `kktix` 字樣（避免觸發目標網站的內容偵測或品牌爭議）。  
> DOM Selector（如 `#person_agree_terms`）是目標網站的原始 HTML，不在此限制內。

## 修改注意事項

1. **勿更改** `#person_agree_terms` 等 DOM selector，這是目標網站的真實 HTML
2. 如果加新功能，優先使用 Angular scope 操作而非原生 DOM click
3. 新增 storage key 時，請以 `kk_` 開頭
4. 面板新增元素請加 `id="bot-xxx"` 格式的 ID，方便 JS 選取

## 已知限制

- 若目標網站更新 HTML 結構（例如把 `#person_agree_terms` 改名），selector 需跟著更新
- CAPTCHA（人機驗證）無法自動處理，需要使用者手動完成後系統會繼續
- 部分活動可能需要購票資格或抽籤，本工具對此無法處理
