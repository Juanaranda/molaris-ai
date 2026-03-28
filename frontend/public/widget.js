(function () {
  var script = document.currentScript;
  var clinic = script.getAttribute("data-clinic") || "galana";
  var color  = script.getAttribute("data-color")  || "#0891B2";
  var origin = script.getAttribute("data-origin")  || "https://molaris.ai";

  // ── Estilos ──────────────────────────────────────────────────────
  var style = document.createElement("style");
  style.textContent = [
    "#molaris-btn{position:fixed;bottom:24px;right:24px;z-index:99999;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;transition:transform .2s}",
    "#molaris-btn:hover{transform:scale(1.08)}",
    "#molaris-frame{position:fixed;bottom:92px;right:24px;z-index:99998;width:370px;height:580px;border:none;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.18);display:none;overflow:hidden}",
    "@media(max-width:480px){#molaris-frame{width:100vw;height:100dvh;bottom:0;right:0;border-radius:0}}",
  ].join("");
  document.head.appendChild(style);

  // ── Botón flotante ───────────────────────────────────────────────
  var btn = document.createElement("button");
  btn.id = "molaris-btn";
  btn.setAttribute("aria-label", "Abrir chat de atención");
  btn.style.background = color;
  btn.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

  // ── Iframe ───────────────────────────────────────────────────────
  var frame = document.createElement("iframe");
  frame.id = "molaris-frame";
  frame.title = "Asistente virtual";
  frame.src = origin + "/widget?clinic=" + encodeURIComponent(clinic) + "&color=" + encodeURIComponent(color);
  frame.allow = "clipboard-write";

  document.body.appendChild(btn);
  document.body.appendChild(frame);

  // ── Toggle ───────────────────────────────────────────────────────
  var open = false;
  var ICON_CHAT = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var ICON_CLOSE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  btn.addEventListener("click", function () {
    open = !open;
    frame.style.display = open ? "block" : "none";
    btn.innerHTML = open ? ICON_CLOSE : ICON_CHAT;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });
})();
