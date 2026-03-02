// ==UserScript==
// @name         Bullet Auto Buyer Advanced
// @namespace    https://omerta-bullet/
// @version      2.11
// @description  Bullet factory smart auto buyer (menu + clicklimit backoff + cooldown)
// @match        *://omerta.com.tr/*
// @match        *://www.omerta.com.tr/*
// @match        https://barafranca.com/*
// @match        https://www.barafranca.com/*
// @run-at       document-idle
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
  "use strict";

  /* ================================
     SETTINGS (Persistent)
  ================================ */

  let isRunning = GM_getValue("Run", false);
  let autoBuy = GM_getValue("autoBuy", false);
  let targetPrice = GM_getValue("targetPrice", 700);
  let intervalSec = GM_getValue("intervalSec", 3); // 1-60 arası
  let lastClickLimitDetected = GM_getValue("lastClickLimitDetected", 0);

  const CLICK_LIMIT_BACKOFF_MS = 10_000;

  /* ================================
     GM MENU
  ================================ */

  function buildMenu() {
    GM_registerMenuCommand(
      "Run Script: " + (isRunning ? "ON" : "OFF"),
      () => {
        isRunning = !isRunning;
        GM_setValue("Run", isRunning);
        alert("Script is now " + (isRunning ? "RUNNING" : "STOPPED"));
        location.reload();
      }
    );

    GM_registerMenuCommand(
      "Auto Buy: " + (autoBuy ? "ON" : "OFF"),
      () => {
        autoBuy = !autoBuy;
        GM_setValue("autoBuy", autoBuy);
        alert("Auto Buy is now " + (autoBuy ? "ON" : "OFF"));
        location.reload();
      }
    );

    GM_registerMenuCommand(
      "Set Target Bullet Price (Current: $" + targetPrice + ")",
      () => {
        const val = prompt("Enter target bullet price:", String(targetPrice));
        if (val !== null && val.trim() !== "" && !isNaN(val)) {
          targetPrice = parseInt(val, 10);
          GM_setValue("targetPrice", targetPrice);
          alert("Target price set to $" + targetPrice);
          location.reload();
        }
      }
    );

    GM_registerMenuCommand(
      "Set Interval Seconds (1-60) (Current: " + intervalSec + "s)",
      () => {
        const val = prompt("Enter interval in seconds (1-60):", String(intervalSec));
        if (val !== null && val.trim() !== "" && !isNaN(val)) {
          let parsed = parseFloat(val);
          if (parsed < 1) parsed = 1;
          if (parsed > 60) parsed = 60;
          intervalSec = parsed;
          GM_setValue("intervalSec", intervalSec);
          alert("Interval set to " + intervalSec + " seconds");
          location.reload();
        }
      }
    );
  }

  buildMenu();

  /* ================================
     HELPERS
  ================================ */

  function isBulletPage() {
    return window.location.pathname.includes("bullets2.php");
  }

  function isClickLimitReached() {
    const container = document.querySelector("#game_container");
    if (!container) return false;
    return container.innerText.includes("You reached your click limit");
  }

  function isOnCooldown() {
    const text = document.body.innerText;
    return (
      text.includes("You need to wait another") &&
      text.includes("before you can buy bullets again")
    );
  }

  function parsePage() {
    const priceInput = document.querySelector('input[name="curprice"]');
    const currentPrice = priceInput ? parseInt(priceInput.value, 10) : null;

    const stockMatch = document.body.innerText.match(/There are\s+([0-9,]+)\s+bullets/i);
    const factoryBulletCount = stockMatch
      ? parseInt(stockMatch[1].replace(/,/g, ""), 10)
      : null;

    const amountInputElement = document.querySelector("#lbfAmount");
    const maxAmount = amountInputElement ? parseInt(amountInputElement.value, 10) : null;

    const buyButtonElement = document.querySelector('input[name="buy_sys"]');

    return {
      currentPrice,
      factoryBulletCount,
      maxAmount,
      amountInputElement,
      buyButtonElement,
    };
  }

function clickBulletFactory() {
    const link = document.querySelector('a[href="/bullets2.php"][data-menu="bullets"]');

    if (!link) {
        console.warn("Bullet link not found.");
        return false;
    }

    link.click();
    return true;
}

  /* ================================
     MAIN FLOW
  ================================ */

  async function main() {
    if (!isRunning) {
      console.log("Script is OFF. Skipping.");
      return;
    }

    clickBulletFactory();

    const now = Date.now();

    // 0) Backoff penceresi aktifse (click limit görmüşüz ve 10s dolmamış)
    if (lastClickLimitDetected + CLICK_LIMIT_BACKOFF_MS > now) {
      console.log("Click-limit backoff active. Skipping.");
      return;
    }

    // 1) Click limit sayfası mı?
    if (isClickLimitReached()) {
      console.warn("Click limit detected. Entering 10s backoff.");
      lastClickLimitDetected = now;
      GM_setValue("lastClickLimitDetected", lastClickLimitDetected);
      return; // burada sleep YOK
    }

    // 2) Cooldown kontrolü
    if (isOnCooldown()) {
      console.warn("Cooldown detected. Turning script OFF.");
      isRunning = false;
      GM_setValue("Run", false);
      return;
    }

    // 3) Parse + fiyat kontrolü
    const data = parsePage();
    if (!data.currentPrice) {
      console.log("Price not found.");
      return;
    }

    console.log(
      "Current:", data.currentPrice,
      "Target:", targetPrice,
      "Stock:", data.factoryBulletCount,
      "Max:", data.maxAmount,
      "AutoBuy:", autoBuy
    );

    // 4) Fiyat yüksekse işlem yok (interval zaten tekrar çağıracak)
    if (data.currentPrice > targetPrice) {
      console.log("Price too high. Waiting next tick...");
      return;
    }

    // 5) Fiyat uygun -> autoBuy açık ise satın al
    if (autoBuy && data.buyButtonElement) {
      console.log("Buying bullets...");
      data.buyButtonElement.click();
      return;
    }

    console.log("Price acceptable but AutoBuy is OFF.");
  }

  /* ================================
     LOOP
  ================================ */

  // intervalSec float olabilir (2.5 gibi). setInterval ms ile çalışır.
  setInterval(main, Math.max(1, intervalSec) * 1000);
})();