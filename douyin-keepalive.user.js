// ==UserScript==
// @name         抖音后台音频保护
// @namespace    https://github.com/MaoYo42/douyin-enhancer
// @version      1.1
// @license      GPL-3.0
// @homepageURL  https://github.com/MaoYo42/douyin-enhancer
// @supportURL   https://github.com/MaoYo42/douyin-enhancer/issues
// @updateURL    https://raw.githubusercontent.com/MaoYo42/douyin-enhancer/main/douyin-keepalive.user.js
// @downloadURL  https://raw.githubusercontent.com/MaoYo42/douyin-enhancer/main/douyin-keepalive.user.js
// @description  防止抖音「长时间无操作，已暂停播放」；切到后台时保持音频继续播放。控制台执行 douyinKeepAlive(false) 可临时关闭。
// @match        *://*.douyin.com/*
// @match        *://*.iesdouyin.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const TAG = "[保活]";
  const STORE_KEY = "douyin_keepalive_enabled";
  let enabled = localStorage.getItem(STORE_KEY) !== "false";
  let lastNudge = 0;
  let lastResumeAt = 0;

  const log = (...args) => console.log(TAG, ...args);
  const getVideo = () => document.querySelector("video");

  function resumeVideo(v) {
    v = v || getVideo();
    if (!v || !v.paused) return false;
    const now = Date.now();
    if (now - lastResumeAt < 1000) return false; // 防抖，避免反复调用 play()
    lastResumeAt = now;
    try {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
      log("已恢复播放");
      return true;
    } catch (e) {
      return false;
    }
  }

  // 精确找「继续播放」按钮：用 XPath 按文本精确匹配，比遍历所有 div 快得多
  function findResumeButton() {
    try {
      const res = document.evaluate(
        "//*[self::button or self::div or self::span][normalize-space(text())='继续播放']",
        document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
      );
      for (let i = 0; i < res.snapshotLength; i++) {
        const el = res.snapshotItem(i);
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return el;
      }
    } catch (e) {}
    return null;
  }

  function clickResume() {
    const el = findResumeButton();
    if (!el) return false;
    const clickable = el.closest('button, [role="button"], a') || el;
    clickable.click();
    log("已点击「继续播放」");
    setTimeout(() => resumeVideo(), 400);
    return true;
  }

  // 1) 切到后台时保音频：抖音会因为可见性变化主动暂停
  document.addEventListener("visibilitychange", () => {
    if (!enabled || !document.hidden) return;
    log("切到后台，保持音频播放");
    setTimeout(() => resumeVideo(), 300);
    setTimeout(() => resumeVideo(), 1200);
  });

  // 2) 后台被暂停时立刻拉起来（事件在后台仍会触发，不受定时器节流影响）
  document.addEventListener("pause", (e) => {
    if (!enabled) return;
    const v = e.target;
    if (!v || v.tagName !== "VIDEO") return;
    if (document.hidden) setTimeout(() => resumeVideo(v), 400);
  }, true);

  // 3) 巡检「长时间无操作」遮罩（仅在页面可见且视频暂停时工作，不干扰手动暂停）
  setInterval(() => {
    if (!enabled) return;
    const v = getVideo();
    if (!v) return;
    if (document.hidden) {
      if (v.paused) resumeVideo(v);
      return;
    }
    if (!v.paused) return;      // 正在播放就不打扰
    clickResume();              // 只有存在「继续播放」遮罩时才动手
  }, 1500);

  // 4) 主动重置抖音的空闲计时器（合成指针事件），降低遮罩出现概率
  setInterval(() => {
    if (!enabled || document.hidden) return;
    const now = Date.now();
    if (now - lastNudge < 20000) return;
    lastNudge = now;
    try {
      const x = 200 + Math.floor(Math.random() * 80);
      const y = 200 + Math.floor(Math.random() * 80);
      const base = { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window };
      document.dispatchEvent(new MouseEvent("mousemove", base));
      if (window.PointerEvent) {
        document.dispatchEvent(new PointerEvent("pointermove",
          Object.assign({ pointerType: "mouse", isPrimary: true }, base)));
      }
    } catch (e) {}
  }, 5000);

  // 手动开关
  window.douyinKeepAlive = (on) => {
    enabled = !!on;
    localStorage.setItem(STORE_KEY, String(enabled));
    log("已切换为:", enabled ? "开启" : "关闭");
    return enabled;
  };

  log("已加载，当前状态:", enabled ? "开启" : "关闭");
})();
