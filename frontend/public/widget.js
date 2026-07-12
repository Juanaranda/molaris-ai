(function () {
  var script = document.currentScript;
  var clinic  = script.getAttribute("data-clinic")  || "galana";
  var color   = script.getAttribute("data-color")   || "#1A5C7A";
  var origin  = script.getAttribute("data-origin")  || "https://app.molari.ai";
  var greet   = script.getAttribute("data-greet") !== "false"; // muestra burbuja de bienvenida

  // ── Estilos ──────────────────────────────────────────────────────────────────
  var style = document.createElement("style");
  style.textContent = [
    "#molaris-btn{position:fixed;bottom:24px;right:24px;z-index:99999;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;transition:transform .2s,box-shadow .2s;}",
    "#molaris-btn:hover{transform:scale(1.08);box-shadow:0 6px 24px rgba(0,0,0,.3);}",
    "#molaris-badge{position:absolute;top:-3px;right:-3px;width:18px;height:18px;background:#EF4444;border-radius:50%;border:2px solid #fff;font-size:10px;font-weight:700;color:#fff;display:flex;align-items:center;justify-content:center;animation:molaris-pulse 1.8s infinite;}",
    "@keyframes molaris-pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.2);}}",
    "#molaris-bubble{position:fixed;bottom:92px;right:24px;z-index:99997;background:#fff;border-radius:18px 18px 4px 18px;padding:12px 16px;font-family:system-ui,sans-serif;font-size:13px;color:#1e293b;line-height:1.4;box-shadow:0 4px 20px rgba(0,0,0,.15);max-width:220px;cursor:pointer;animation:molaris-fadein .4s ease;}",
    "#molaris-bubble::after{content:'';position:absolute;bottom:-8px;right:20px;border-left:8px solid transparent;border-right:8px solid transparent;border-top:8px solid #fff;}",
    "@keyframes molaris-fadein{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}",
    "#molaris-frame{position:fixed;bottom:92px;right:24px;z-index:99998;width:370px;height:580px;border:none;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.2);display:none;overflow:hidden;animation:molaris-slidein .25s ease;}",
    "@keyframes molaris-slidein{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}",
    "@media(max-width:480px){#molaris-frame{width:100vw;height:100dvh;bottom:0;right:0;border-radius:0;}#molaris-bubble{right:12px;}}",
  ].join("");
  document.head.appendChild(style);

  // ── Botón flotante ────────────────────────────────────────────────────────────
  var btn = document.createElement("button");
  btn.id = "molaris-btn";
  btn.setAttribute("aria-label", "Abrir chat de atención");
  btn.setAttribute("aria-expanded", "false");
  btn.style.background = color;
  btn.style.position = "relative";

  var badge = document.createElement("span");
  badge.id = "molaris-badge";
  badge.textContent = "1";
  btn.appendChild(badge);

  // ── Burbuja de bienvenida ────────────────────────────────────────────────────
  var bubble = null;
  if (greet) {
    bubble = document.createElement("div");
    bubble.id = "molaris-bubble";
    bubble.textContent = "👋 ¡Hola! ¿En qué te puedo ayudar?";
    bubble.addEventListener("click", openChat);
    document.body.appendChild(bubble);
    // Auto-ocultar burbuja tras 8 segundos
    setTimeout(function () {
      if (bubble && bubble.parentNode) bubble.parentNode.removeChild(bubble);
      bubble = null;
    }, 8000);
  }

  // ── Iframe ───────────────────────────────────────────────────────────────────
  var frame = document.createElement("iframe");
  frame.id = "molaris-frame";
  frame.title = "Asistente virtual";
  frame.allow = "clipboard-write";
  // Carga diferida — src se asigna al primer clic para no bloquear la página
  var frameLoaded = false;

  document.body.appendChild(btn);
  document.body.appendChild(frame);

  // ── Iconos ───────────────────────────────────────────────────────────────────
  var ICON_CHAT  = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var ICON_CLOSE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  function renderBtn(isOpen) {
    btn.innerHTML = (isOpen ? ICON_CLOSE : ICON_CHAT);
    if (!isOpen) btn.appendChild(badge);
  }
  renderBtn(false);

  // ── Toggle ───────────────────────────────────────────────────────────────────
  var open = false;

  function openChat() {
    if (open) return;
    open = true;
    // Quitar burbuja si aún existe
    if (bubble && bubble.parentNode) { bubble.parentNode.removeChild(bubble); bubble = null; }
    // Carga lazy del iframe
    if (!frameLoaded) {
      frame.src = origin + "/widget?clinic=" + encodeURIComponent(clinic) + "&color=" + encodeURIComponent(color);
      frameLoaded = true;
    }
    frame.style.display = "block";
    btn.setAttribute("aria-expanded", "true");
    renderBtn(true);
  }

  btn.addEventListener("click", function () {
    if (open) {
      open = false;
      frame.style.display = "none";
      btn.setAttribute("aria-expanded", "false");
      renderBtn(false);
    } else {
      openChat();
    }
  });
})();
