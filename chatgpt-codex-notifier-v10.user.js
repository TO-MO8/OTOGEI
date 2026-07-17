// ==UserScript==
// @name         ChatGPT Codex Notifier v10
// @namespace    https://openai.com/
// @version      1.0
// @description  Codex の Thinking 表示と承認待ちを見て通知する
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const CHECK_MS = 800;
  const MAX_MS = 2 * 60 * 60 * 1000;
  const THINKING_MISS_LIMIT = 3;

  let armed = false;
  let notified = false;
  let startedAt = 0;

  let seenThinking = false;
  let thinkingMissCount = 0;

  function beep(times) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();
    const start = ctx.currentTime + 0.05;

    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = i % 2 === 0 ? 880 : 660;

      gain.gain.setValueAtTime(0.0001, start + i * 0.28);
      gain.gain.exponentialRampToValueAtTime(0.08, start + i * 0.28 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + i * 0.28 + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start + i * 0.28);
      osc.stop(start + i * 0.28 + 0.2);
    }
  }

  function notifyMe(title, body) {
    let shown = false;

    try {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(title, { body });
          shown = true;
        } else if (Notification.permission === 'default') {
          Notification.requestPermission().then((perm) => {
            if (perm === 'granted') {
              new Notification(title, { body });
            } else {
              alert(title + '\n' + body);
            }
          });
          return;
        }
      }
    } catch (_) {}

    if (!shown) {
      alert(title + '\n' + body);
    }
  }

  function setStatus(text, bg) {
    const el = document.getElementById('codex-status-pill');
    if (!el) return;
    el.textContent = text;
    el.style.background = bg;
  }

  function setDebug(text) {
    const el = document.getElementById('codex-debug-pill');
    if (!el) return;
    el.textContent = text;
  }

  function stopWatch(label) {
    armed = false;
    setStatus(label || '停止中', '#6b7280');
  }

  function fireApproval(hit) {
    if (notified) return;
    notified = true;
    beep(3);
    setDebug('検知語: ' + hit);
    notifyMe('Codex: 承認待ちです', '画面を開いて確認してください');
    stopWatch('承認待ち検知');
  }

  function fireDone(hit) {
    if (notified) return;
    notified = true;
    beep(2);
    setDebug('検知語: ' + hit);
    notifyMe('Codex: 作業が終わりました', '画面を開いて確認してください');
    stopWatch('完了検知');
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getAllVisibleTextElements() {
    const all = Array.from(document.querySelectorAll('body *'));
    return all.filter((el) => {
      if (!isVisible(el)) return false;
      if (el.id === 'codex-watch-root') return false;
      if (el.closest('#codex-watch-root')) return false;
      const txt = (el.innerText || '').trim();
      if (!txt) return false;
      return true;
    });
  }

  function detectThinking() {
    const els = getAllVisibleTextElements();

    for (const el of els) {
      const txt = (el.innerText || '').trim().toLowerCase();

      if (txt === 'thinking' || txt === 'thinking...') {
        return { ok: true, hit: 'Thinking' };
      }
    }

    return { ok: false, hit: '' };
  }

  function detectApproval() {
    const els = getAllVisibleTextElements();

    for (const el of els) {
      const txt = (el.innerText || '').trim().toLowerCase();

      if (
        txt === '承認待ち' ||
        txt === '承認が必要' ||
        txt === 'approval required' ||
        txt === 'awaiting approval'
      ) {
        return { ok: true, hit: el.innerText.trim() };
      }
    }

    return { ok: false, hit: '' };
  }

  function startWatch() {
    armed = true;
    notified = false;
    startedAt = Date.now();
    seenThinking = false;
    thinkingMissCount = 0;

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const approval = detectApproval();
    if (approval.ok) {
      fireApproval(approval.hit);
      return;
    }

    const thinking = detectThinking();
    if (thinking.ok) {
      seenThinking = true;
      thinkingMissCount = 0;
      setStatus('thinking監視中', '#2563eb');
      setDebug('検知語: ' + thinking.hit);
      return;
    }

    setStatus('通知待機中', '#0f766e');
    setDebug('検知語: なし');
  }

  function scan() {
    if (!armed || notified) return;

    if (Date.now() - startedAt > MAX_MS) {
      stopWatch('時間切れ');
      return;
    }

    const approval = detectApproval();
    if (approval.ok) {
      fireApproval(approval.hit);
      return;
    }

    const thinking = detectThinking();

    if (thinking.ok) {
      seenThinking = true;
      thinkingMissCount = 0;
      setStatus('thinking監視中', '#2563eb');
      setDebug('検知語: ' + thinking.hit);
      return;
    }

    if (seenThinking) {
      thinkingMissCount += 1;
      setStatus('thinking監視中', '#2563eb');
      setDebug('thinking消失回数: ' + thinkingMissCount + '/' + THINKING_MISS_LIMIT);

      if (thinkingMissCount >= THINKING_MISS_LIMIT) {
        fireDone('Thinking 終了');
        return;
      }
      return;
    }

    setStatus('通知待機中', '#0f766e');
    setDebug('検知語: なし');
  }

  function testNotify() {
    beep(2);
    setDebug('検知語: テスト通知');
    notifyMe('Codex: テスト通知', 'ここが出れば通知機能自体はOKです');
  }

  function addUI() {
    if (document.getElementById('codex-watch-root')) return;

    const root = document.createElement('div');
    root.id = 'codex-watch-root';
    root.style.position = 'fixed';
    root.style.right = '20px';
    root.style.bottom = '20px';
    root.style.zIndex = '999999';
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.gap = '8px';
    root.style.alignItems = 'flex-end';
    root.style.fontFamily = 'system-ui, sans-serif';

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.alignItems = 'center';

    const status = document.createElement('div');
    status.id = 'codex-status-pill';
    status.textContent = '停止中';
    status.style.background = '#6b7280';
    status.style.color = 'white';
    status.style.padding = '10px 14px';
    status.style.borderRadius = '999px';
    status.style.fontSize = '13px';
    status.style.fontWeight = 'bold';

    const startBtn = document.createElement('button');
    startBtn.textContent = '🔔 通知待機';
    startBtn.style.padding = '10px 14px';
    startBtn.style.border = 'none';
    startBtn.style.borderRadius = '999px';
    startBtn.style.cursor = 'pointer';
    startBtn.style.background = '#111827';
    startBtn.style.color = 'white';
    startBtn.style.fontWeight = 'bold';
    startBtn.onclick = startWatch;

    const testBtn = document.createElement('button');
    testBtn.textContent = '🧪 テスト通知';
    testBtn.style.padding = '10px 14px';
    testBtn.style.border = 'none';
    testBtn.style.borderRadius = '999px';
    testBtn.style.cursor = 'pointer';
    testBtn.style.background = '#1d4ed8';
    testBtn.style.color = 'white';
    testBtn.style.fontWeight = 'bold';
    testBtn.onclick = testNotify;

    const stopBtn = document.createElement('button');
    stopBtn.textContent = '■ 停止';
    stopBtn.style.padding = '10px 14px';
    stopBtn.style.border = 'none';
    stopBtn.style.borderRadius = '999px';
    stopBtn.style.cursor = 'pointer';
    stopBtn.style.background = '#e5e7eb';
    stopBtn.style.color = '#111827';
    stopBtn.style.fontWeight = 'bold';
    stopBtn.onclick = () => stopWatch('停止中');

    const debug = document.createElement('div');
    debug.id = 'codex-debug-pill';
    debug.textContent = '検知語: なし';
    debug.style.background = 'rgba(17,24,39,0.9)';
    debug.style.color = 'white';
    debug.style.padding = '8px 12px';
    debug.style.borderRadius = '12px';
    debug.style.fontSize = '12px';
    debug.style.maxWidth = '420px';

    row.appendChild(status);
    row.appendChild(startBtn);
    row.appendChild(testBtn);
    row.appendChild(stopBtn);
    root.appendChild(row);
    root.appendChild(debug);
    document.body.appendChild(root);
  }

  function boot() {
    addUI();
    setInterval(scan, CHECK_MS);

    const mo = new MutationObserver(() => addUI());
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
