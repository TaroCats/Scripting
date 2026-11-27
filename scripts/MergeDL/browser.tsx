// ==UserScript==
// @name         MergeDL 下载拦截
// @namespace    local.mergedl
// @version      1.2.0
// @description  嗅探页面资源、在悬浮面板选择渠道后加入 GM 存储队列
// @match        *://*/*
// @include      *
// @run-at       document-start
// @inject-into  content
// @weight       999
// @noframes
// @grant        GM.log
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.registerMenuCommand
// ==/UserScript==

// @ts-nocheck
declare const GM: any
declare const document: any
declare const window: any
declare const location: any

(function () {
  "use strict";

  var VERSION = "1.2.0";
  var QUEUE_KEY = "mergedl.queue";

  if (window.__mergeDLInjected) {
    GM.log("MergeDL v" + VERSION + ": already injected");
    return;
  }
  window.__mergeDLInjected = true;

  var enabled = true;
  var pendingJob = null;
  var expanded = {};
  var accordionReady = false;
  var ball = null;
  var panel = null;

  function toast(message) {
    var host = document.body || document.documentElement;
    if (!host) return;
    var old = document.getElementById("__mergedl_toast");
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var node = document.createElement("div");
    node.id = "__mergedl_toast";
    node.textContent = "MergeDL · " + message;
    Object.assign(node.style, {
      position: "fixed",
      right: "16px",
      bottom: "92px",
      zIndex: "2147483645",
      padding: "10px 16px",
      borderRadius: "18px",
      background: "rgba(245, 250, 247, 0.88)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      color: "#2F6B50",
      font: "600 13px -apple-system, BlinkMacSystemFont, sans-serif",
      boxShadow: "0 8px 30px rgba(0, 0, 0, 0.18)",
      maxWidth: "70vw",
      pointerEvents: "none"
    });
    host.appendChild(node);
    setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, 2800);
  }

  var CATEGORIES = [
    { key: "video", label: "视频", icon: "🎬", pattern: /\.(mp4|mkv|avi|mov|webm|m4v|ts|wmv|flv)(\?|#|$)/i },
    { key: "audio", label: "音频", icon: "🎵", pattern: /\.(mp3|m4a|aac|flac|wav|ogg|opus)(\?|#|$)/i },
    { key: "image", label: "图片 / 图标", icon: "🖼️", pattern: /\.(jpe?g|png|gif|webp|svg|bmp|ico|heic)(\?|#|$)/i },
    { key: "archive", label: "压缩包", icon: "📦", pattern: /\.(zip|rar|7z|tar|gz|bz2|xz|iso|dmg)(\?|#|$)/i },
    { key: "torrent", label: "种子 / 磁力", icon: "🧲", pattern: /^magnet:|\.torrent(\?|#|$)/i },
    { key: "document", label: "文档", icon: "📄", pattern: /\.(pdf|epub|mobi|azw3|txt|doc|docx|xls|xlsx|ppt|pptx|csv)(\?|#|$)/i }
  ];

  function categoryOf(href) {
    for (var i = 0; i < CATEGORIES.length; i += 1) {
      if (CATEGORIES[i].pattern.test(href)) return CATEGORIES[i];
    }
    return null;
  }

  function isDownloadLink(anchor, href) {
    if (anchor && anchor.hasAttribute && anchor.hasAttribute("download")) return true;
    var category = categoryOf(href);
    if (!category) return false;
    return category.key !== "image";
  }

  function suggestedName(anchor, href) {
    var explicit = anchor && anchor.getAttribute && anchor.getAttribute("download");
    if (explicit) return explicit;
    try {
      var parsed = new URL(href, location.href);
      var last = decodeURIComponent(parsed.pathname.split("/").pop() || "");
      return last || parsed.hostname;
    } catch (error) {
      return "download";
    }
  }

  function getQueue() {
    return GM.getValue(QUEUE_KEY, []).then(function (value) {
      return Array.isArray(value) ? value : [];
    });
  }

  function setQueue(queue) {
    return GM.setValue(QUEUE_KEY, queue);
  }

  function enqueue(href, name, channel) {
    var now = Date.now();
    return getQueue().then(function (queue) {
      if (queue.some(function (item) { return item.url === href; })) {
        toast("该链接已在队列中");
        return;
      }
      queue.push({
        id: String(now) + "-" + Math.random().toString(36).slice(2, 8),
        url: href,
        filename: name || suggestedName(null, href),
        pageUrl: location.href,
        createdAt: now,
        channel: channel || "aria2"
      });
      return setQueue(queue).then(function () {
        toast("已加入队列 · " + (channel === "cloudreve" ? "Cloudreve v4" : "aria2"));
      });
    }).catch(function (error) {
      GM.log("MergeDL: enqueue failed", error);
      toast("入队失败，请查看日志");
    });
  }

  function requestPush(href, name) {
    pendingJob = {
      url: href,
      filename: name || suggestedName(null, href),
      pageUrl: location.href
    };
    ensureUI();
    if (panel) panel.style.display = "block";
    refreshPanel();
  }

  function commitPush(channel) {
    if (!pendingJob) return;
    var job = pendingJob;
    pendingJob = null;
    void enqueue(job.url, job.filename, channel);
    refreshPanel();
  }

  GM.getValue("mergedl.intercept.enabled", true).then(function (value) {
    enabled = value !== false;
    if (panel) refreshPanel();
  });

  document.addEventListener(
    "click",
    function (event) {
      var target = event.target;
      if (target && target.closest && target.closest("#__mergedl_ball, #__mergedl_panel, #__mergedl_toast")) return;
      if (!enabled || event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      var anchor = target && target.closest ? target.closest("a[href], [download], [data-download-url]") : null;
      if (!anchor) return;
      var href = anchor.href || anchor.getAttribute("href") || anchor.getAttribute("data-download-url");
      if (!href) return;
      try {
        href = new URL(href, location.href).href;
      } catch (error) {
        return;
      }
      if (!isDownloadLink(anchor, href)) return;
      event.preventDefault();
      event.stopPropagation();
      requestPush(href, suggestedName(anchor, href));
    },
    true
  );

  function sniffPage() {
    var nodes = document.querySelectorAll(
      "a[href], video[src], source[src], img[src], embed[src], iframe[src], [data-download-url]"
    );
    var seen = {};
    var found = {};
    CATEGORIES.forEach(function (category) { found[category.key] = []; });
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      var href = node.href || node.getAttribute("src") || node.getAttribute("href") || node.getAttribute("data-download-url");
      if (!href) continue;
      try {
        href = new URL(href, location.href).href;
      } catch (error) {
        continue;
      }
      var category = categoryOf(href);
      if (!category || seen[href]) continue;
      seen[href] = true;
      found[category.key].push({ url: href, name: suggestedName(node, href) });
    }
    return found;
  }

  function ensureUI() {
    if (ball) return;
    var host = document.body || document.documentElement;
    if (!host) return;

    ball = document.createElement("div");
    ball.id = "__mergedl_ball";
    ball.textContent = "M";
    ball.title = "MergeDL v" + VERSION;
    Object.assign(ball.style, {
      position: "fixed", right: "16px", bottom: "20px", width: "52px", height: "52px",
      borderRadius: "50%", background: "rgba(46, 107, 80, 0.88)",
      backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
      color: "#FFFFFF", font: "700 20px -apple-system, BlinkMacSystemFont, sans-serif",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 8px 28px rgba(0, 0, 0, 0.28)", zIndex: "2147483644",
      cursor: "pointer", userSelect: "none"
    });
    ball.addEventListener("click", function (event) {
      event.stopPropagation();
      togglePanel();
    });

    panel = document.createElement("div");
    panel.id = "__mergedl_panel";
    Object.assign(panel.style, {
      position: "fixed", right: "16px", bottom: "82px",
      width: "min(360px, calc(100vw - 32px))", maxHeight: "62vh", overflowY: "auto",
      borderRadius: "22px", background: "rgba(28, 32, 30, 0.94)",
      backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
      color: "#F2F7F4", font: "13px -apple-system, BlinkMacSystemFont, sans-serif",
      boxShadow: "0 14px 44px rgba(0, 0, 0, 0.38)", zIndex: "2147483643",
      display: "none", padding: "16px"
    });
    panel.addEventListener("click", function (event) { event.stopPropagation(); });

    host.appendChild(ball);
    host.appendChild(panel);
    refreshPanel();
  }

  function togglePanel() {
    if (!panel) return;
    var opening = panel.style.display === "none";
    panel.style.display = opening ? "block" : "none";
    if (opening) refreshPanel();
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function refreshPanel() {
    if (!panel) return;
    var found = sniffPage();
    var categories = CATEGORIES.filter(function (category) {
      return (found[category.key] || []).length > 0;
    });

    if (!accordionReady && categories.length > 0) {
      expanded[categories[0].key] = true;
      accordionReady = true;
    }

    var total = 0;
    categories.forEach(function (category) { total += found[category.key].length; });

    var html = "";
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
    html += '<strong style="font-size:16px">MergeDL</strong>';
    html += '<span style="font-size:11px;opacity:.75">v' + VERSION + "</span>";
    html += "</div>";
    html += '<div style="font-size:11px;opacity:.75;margin-bottom:12px">';
    html += (enabled ? "拦截中" : "已暂停") + " · 嗅探到 " + total + " 个资源";
    html += "</div>";

    if (pendingJob) {
      html += '<div style="border:1px solid rgba(76,140,106,.7);border-radius:14px;padding:10px;margin-bottom:12px">';
      html += '<div style="font-weight:600;margin-bottom:6px">选择推送渠道</div>';
      html += '<div style="font-size:11px;opacity:.8;margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">';
      html += escapeHTML(pendingJob.filename) + "</div>";
      html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
      html += '<button data-mergedl-channel="aria2" style="border:0;border-radius:12px;padding:6px 12px;background:#4C8C6A;color:#fff;font-size:12px;cursor:pointer">aria2</button>';
      html += '<button data-mergedl-channel="cloudreve" style="border:0;border-radius:12px;padding:6px 12px;background:#2F6B50;color:#fff;font-size:12px;cursor:pointer">Cloudreve v4</button>';
      html += '<button data-mergedl-channel="cancel" style="border:0;border-radius:12px;padding:6px 12px;background:rgba(255,255,255,.12);color:#F2F7F4;font-size:12px;cursor:pointer">取消</button>';
      html += "</div></div>";
    }

    categories.forEach(function (category) {
      var items = found[category.key] || [];
      var open = expanded[category.key] === true;
      html += '<div style="margin-bottom:8px;border-top:1px solid rgba(255,255,255,.08);padding-top:8px">';
      html += '<div data-mergedl-cat="' + category.key + '" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;padding:4px 0">';
      html += "<span>" + category.icon + " " + category.label + " (" + items.length + ")</span>";
      html += '<span style="opacity:.7">' + (open ? "▾" : "▸") + "</span>";
      html += "</div>";
      if (open) {
        items.slice(0, 8).forEach(function (item) {
          html += '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid rgba(255,255,255,.06)">';
          html += '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHTML(item.name) + "</span>";
          html += '<button data-mergedl-url="' + escapeHTML(item.url) + '" style="border:0;border-radius:12px;padding:4px 10px;background:#4C8C6A;color:#fff;font-size:11px;cursor:pointer">选择</button>';
          html += "</div>";
        });
      }
      html += "</div>";
    });

    html += '<div style="font-size:11px;opacity:.7;margin-top:10px">点击下载链接会在此选择渠道后入队。</div>';
    panel.innerHTML = html;

    var headers = panel.querySelectorAll("[data-mergedl-cat]");
    for (var h = 0; h < headers.length; h += 1) {
      headers[h].addEventListener("click", function (event) {
        var key = event.currentTarget.getAttribute("data-mergedl-cat");
        expanded[key] = expanded[key] !== true;
        refreshPanel();
      });
    }

    var channelButtons = panel.querySelectorAll("[data-mergedl-channel]");
    for (var c = 0; c < channelButtons.length; c += 1) {
      channelButtons[c].addEventListener("click", function (event) {
        var value = event.currentTarget.getAttribute("data-mergedl-channel");
        if (value === "cancel") {
          pendingJob = null;
          refreshPanel();
        } else {
          commitPush(value);
        }
      });
    }

    var urlButtons = panel.querySelectorAll("button[data-mergedl-url]");
    for (var u = 0; u < urlButtons.length; u += 1) {
      urlButtons[u].addEventListener("click", function (event) {
        var url = event.currentTarget.getAttribute("data-mergedl-url");
        requestPush(url, suggestedName(null, url));
      });
    }
  }

  function pendingCount() {
    return getQueue().then(function (queue) { return queue.length; }).catch(function () { return -1; });
  }

  GM.registerMenuCommand("MergeDL：暂停 / 恢复拦截", function () {
    enabled = !enabled;
    GM.setValue("mergedl.intercept.enabled", enabled);
    toast(enabled ? "已恢复下载拦截" : "已暂停下载拦截");
    refreshPanel();
  });

  GM.registerMenuCommand("MergeDL：状态 v" + VERSION, function () {
    pendingCount().then(function (count) {
      toast("v" + VERSION + " · " + (enabled ? "拦截中" : "已暂停") + " · 待推送 " + (count < 0 ? "?" : count) + " 个");
    });
  });

  GM.registerMenuCommand("MergeDL：查看待推送数量", function () {
    pendingCount().then(function (count) {
      toast(count < 0 ? "无法读取队列" : "待推送 " + count + " 个");
    });
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureUI, { once: true });
  } else {
    ensureUI();
  }

  GM.log("MergeDL v" + VERSION + " loaded", location.href);
})();
