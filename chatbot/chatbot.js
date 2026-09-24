(function () {
  "use strict";

  // Set this to your deployed Worker URL (see chatbot-worker/README.md).
  var CHAT_API_BASE = "https://creek-chatbot.jordan-574.workers.dev";

  var OPENING_MESSAGE =
    "Hi! 👋 Welcome to Creek Ocean Construction. How can we help you today? Whether you have a project in mind, have a question about our services, or would like to get in touch with our team, we're here to help.";

  var QUICK_OPTIONS = [
    { label: "Our Services", prompt: "What services does Creek offer?" },
    { label: "Start a Project", prompt: "I'd like to start a project with Creek." },
    { label: "Service Area", prompt: "What areas does Creek serve?" },
    { label: "View Our Work", prompt: "Can I see examples of your past work?" },
    { label: "Contact Us", action: "lead-form" },
  ];

  var messages = [];
  var hasOpenedBefore = false;
  var isSending = false;

  function getSessionId() {
    try {
      var id = sessionStorage.getItem("creekChatSessionId");
      if (!id) {
        id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
        sessionStorage.setItem("creekChatSessionId", id);
      }
      return id;
    } catch (e) {
      return "";
    }
  }

  var root = document.createElement("div");
  root.innerHTML =
    '<button id="creek-chat-toggle" aria-expanded="false" aria-controls="creek-chat-panel" aria-label="Chat with Creek Assistant">' +
    '<svg class="creek-chat-open-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' +
    '<svg class="creek-chat-close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
    "<span>Chat with us</span>" +
    "</button>" +
    '<div id="creek-chat-panel" role="dialog" aria-label="Creek Assistant chat" aria-hidden="true">' +
    '<div class="creek-chat-header">' +
    "<div>" +
    "<h2>Creek Assistant</h2>" +
    "<p>Usually replies in a few minutes</p>" +
    "</div>" +
    '<button type="button" class="creek-chat-header-close" aria-label="Close chat"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
    "</div>" +
    '<div id="creek-chat-body"></div>' +
    "</div>";

  document.body.appendChild(root);

  var toggleBtn = document.getElementById("creek-chat-toggle");
  var panel = document.getElementById("creek-chat-panel");
  var closeBtn = panel.querySelector(".creek-chat-header-close");
  var body = document.getElementById("creek-chat-body");

  function renderChatView() {
    body.innerHTML =
      '<div class="creek-chat-messages" id="creek-chat-messages" aria-live="polite"></div>' +
      '<div class="creek-chat-quick-options" id="creek-chat-quick-options"></div>' +
      '<div class="creek-chat-footer">' +
      '<form id="creek-chat-form" class="creek-chat-input-row">' +
      '<input type="text" id="creek-chat-input" placeholder="Type your message…" aria-label="Type your message" autocomplete="off">' +
      '<button type="submit" class="creek-chat-send" aria-label="Send message"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg></button>' +
      "</form>" +
      '<p class="creek-chat-alt-action">Prefer to leave your info instead? <button type="button" id="creek-chat-alt-btn">Contact our team →</button></p>' +
      "</div>";

    var messagesEl = document.getElementById("creek-chat-messages");
    messages.forEach(function (m) {
      appendBubble(messagesEl, m.role, m.content);
    });

    if (messages.length <= 1) {
      renderQuickOptions();
    }

    document.getElementById("creek-chat-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var input = document.getElementById("creek-chat-input");
      var text = input.value.trim();
      if (!text || isSending) return;
      input.value = "";
      sendUserMessage(text);
    });

    var altBtn = document.getElementById("creek-chat-alt-btn");
    altBtn.addEventListener("click", function () {
      renderLeadForm();
    });

    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderQuickOptions() {
    var container = document.getElementById("creek-chat-quick-options");
    if (!container) return;
    container.innerHTML = "";
    QUICK_OPTIONS.forEach(function (opt) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "creek-chat-quick-btn";
      btn.textContent = opt.label;
      btn.addEventListener("click", function () {
        container.innerHTML = "";
        if (opt.action === "lead-form") {
          renderLeadForm();
        } else {
          sendUserMessage(opt.prompt);
        }
      });
      container.appendChild(btn);
    });
  }

  function appendBubble(container, role, text) {
    var bubble = document.createElement("div");
    bubble.className = "creek-chat-bubble " + (role === "user" ? "user" : "bot");
    bubble.textContent = text;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
  }

  function sendUserMessage(text) {
    var messagesEl = document.getElementById("creek-chat-messages");
    messages.push({ role: "user", content: text });
    appendBubble(messagesEl, "user", text);

    var typing = document.createElement("div");
    typing.className = "creek-chat-typing";
    typing.id = "creek-chat-typing";
    typing.innerHTML = "<span></span><span></span><span></span>";
    messagesEl.appendChild(typing);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    isSending = true;

    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timeoutId = controller ? setTimeout(function () { controller.abort(); }, 25000) : null;

    fetch(CHAT_API_BASE + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages, sessionId: getSessionId() }),
      signal: controller ? controller.signal : undefined,
    })
      .then(function (res) {
        if (timeoutId) clearTimeout(timeoutId);
        if (!res.ok) throw new Error("bad response");
        return res.json();
      })
      .then(function (data) {
        var typingEl = document.getElementById("creek-chat-typing");
        if (typingEl) typingEl.remove();
        var reply = data.reply || "Sorry, I didn't catch that. Could you rephrase?";
        messages.push({ role: "assistant", content: reply });
        appendBubble(messagesEl, "assistant", reply);
      })
      .catch(function () {
        if (timeoutId) clearTimeout(timeoutId);
        var typingEl = document.getElementById("creek-chat-typing");
        if (typingEl) typingEl.remove();
        appendBubble(
          messagesEl,
          "assistant",
          "Sorry, I'm having trouble connecting right now. Please email admin@creek.construction or call 902-405-0525."
        );
      })
      .finally(function () {
        isSending = false;
      });
  }

  function renderLeadForm() {
    body.innerHTML =
      '<div class="creek-chat-subbar"><button type="button" class="creek-chat-back" id="creek-chat-back-btn">← Back to chat</button></div>' +
      '<form class="creek-chat-lead-form" id="creek-chat-lead-form">' +
      '<div id="creek-chat-lead-error" class="creek-chat-lead-error" aria-live="polite"></div>' +
      '<div><label for="creek-lead-name">Name</label><input id="creek-lead-name" name="name" type="text" autocomplete="name" required></div>' +
      '<div><label for="creek-lead-email">Email</label><input id="creek-lead-email" name="email" type="email" inputmode="email" autocomplete="email" required></div>' +
      '<div><label for="creek-lead-phone">Phone (optional)</label><input id="creek-lead-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel"></div>' +
      '<div><label for="creek-lead-type">Type of inquiry</label>' +
      '<select id="creek-lead-type" name="type">' +
      "<option>General inquiry</option>" +
      "<option>Get a quote</option>" +
      "<option>Careers / resume</option>" +
      "<option>Media & partnerships</option>" +
      "<option>Existing project</option>" +
      "</select></div>" +
      '<div><label for="creek-lead-desc">Tell us a bit about what you need</label><textarea id="creek-lead-desc" name="description" required></textarea></div>' +
      '<div class="creek-chat-lead-honeypot"><label for="creek-lead-company">Company</label><input id="creek-lead-company" name="company" type="text" tabindex="-1" aria-hidden="true" autocomplete="off"></div>' +
      '<button type="submit" class="creek-chat-lead-submit">Send to our team</button>' +
      "</form>";

    document.getElementById("creek-chat-back-btn").addEventListener("click", renderChatView);

    document.getElementById("creek-chat-lead-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var form = e.target;
      var errorEl = document.getElementById("creek-chat-lead-error");
      errorEl.textContent = "";

      var payload = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
        type: form.type.value,
        description: form.description.value.trim(),
        company: form.company.value,
        transcript: messages.map(function (m) { return m.role + ": " + m.content; }).join("\n"),
      };

      var submitBtn = form.querySelector(".creek-chat-lead-submit");
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";

      fetch(CHAT_API_BASE + "/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          if (!res.ok) throw new Error("bad response");
          return res.json();
        })
        .then(function () {
          renderLeadSuccess();
        })
        .catch(function () {
          errorEl.textContent = "Something went wrong. Please email admin@creek.construction or call 902-405-0525.";
          submitBtn.disabled = false;
          submitBtn.textContent = "Send to our team";
        });
    });
  }

  function renderLeadSuccess() {
    body.innerHTML =
      '<div class="creek-chat-subbar"><button type="button" class="creek-chat-back" id="creek-chat-back-btn-2">← Back to chat</button></div>' +
      '<div class="creek-chat-lead-success">' +
      "<p>Thanks! We've got your info and someone from our team will be in touch soon.</p>" +
      "</div>";
    document.getElementById("creek-chat-back-btn-2").addEventListener("click", renderChatView);
  }

  function openPanel() {
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    toggleBtn.setAttribute("aria-expanded", "true");

    if (!hasOpenedBefore) {
      hasOpenedBefore = true;
      messages.push({ role: "assistant", content: OPENING_MESSAGE });
      renderChatView();
    }

    var input = document.getElementById("creek-chat-input");
    if (input) input.focus();
  }

  function closePanel() {
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    toggleBtn.setAttribute("aria-expanded", "false");
    toggleBtn.focus();
  }

  toggleBtn.addEventListener("click", function () {
    var isOpen = panel.classList.contains("open");
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  });

  closeBtn.addEventListener("click", closePanel);

  // Lets page buttons (e.g. "Learn More" on service cards) open the chat with a question.
  window.CreekChat = {
    ask: function (text) {
      if (!panel.classList.contains("open")) openPanel();
      if (!document.getElementById("creek-chat-messages")) renderChatView();
      var quick = document.getElementById("creek-chat-quick-options");
      if (quick) quick.innerHTML = "";
      if (!isSending) sendUserMessage(text);
    },
  };

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panel.classList.contains("open")) {
      closePanel();
    }
  });
})();
