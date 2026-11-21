(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fa = new Intl.NumberFormat("fa-IR");
  const money = (n) => fa.format(n) + " تومان";

  const services = [
    { id: "check", name: "چکاپ و معاینه", icon: "🦷", price: 350000, dur: 30, desc: "بررسی کامل و مشاوره" },
    { id: "clean", name: "جرم‌گیری و بروساژ", icon: "✨", price: 850000, dur: 45, desc: "پاکسازی و پولیش" },
    { id: "filling", name: "ترمیم دندان", icon: "🪥", price: 1200000, dur: 60, desc: "پرکردن همرنگ" },
    { id: "root", name: "عصب‌کشی", icon: "⚡", price: 2400000, dur: 90, desc: "درمان ریشه" },
    { id: "implant", name: "ایمپلنت", icon: "🔩", price: 12000000, dur: 120, desc: "کاشت دندان" },
    { id: "ortho", name: "مشاورهٔ ارتودنسی", icon: "📐", price: 500000, dur: 30, desc: "بررسی و طرح درمان" },
  ];

  const doctors = [
    { id: "d1", name: "دکتر سارا محمدی", spec: "دندان‌پزشک عمومی", initials: "س.م" },
    { id: "d2", name: "دکتر امیر رضایی", spec: "متخصص ایمپلنت", initials: "ا.ر" },
    { id: "d3", name: "دکتر نگار کاظمی", spec: "متخصص ارتودنسی", initials: "ن.ک" },
  ];

  const KEY = "mehr_bookings";
  const state = { step: 1, serviceId: null, doctorId: null, date: null, time: null, name: "", phone: "", note: "" };

  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  };
  const save = (list) => {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
  };

  /* ---------- ابزار تاریخ ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const weekday = (d) => d.toLocaleDateString("fa-IR", { weekday: "long" });
  const dayNum = (d) => d.toLocaleDateString("fa-IR", { day: "numeric" });
  const monthName = (d) => d.toLocaleDateString("fa-IR", { month: "short" });
  const fullDate = (isoStr) => {
    const [y, m, d] = isoStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("fa-IR", { weekday: "long", day: "numeric", month: "long" });
  };

  // 0=یکشنبه ... 6=شنبه ؛ جمعه=5 تعطیل، پنجشنبه=4 فقط صبح
  const isOpen = (d) => d.getDay() !== 5;
  const isMorningOnly = (d) => d.getDay() === 4;

  function slotsFor(d) {
    const list = [];
    const push = (h, m) => list.push(`${pad(h)}:${pad(m)}`);
    for (let h = 9; h < 13; h += 1) { push(h, 0); push(h, 30); }
    if (!isMorningOnly(d)) for (let h = 16; h < 19; h += 1) { push(h, 0); push(h, 30); }
    return list;
  }

  function isTaken(dateStr, time, doctorId) {
    return load().some((b) => b.date === dateStr && b.time === time && b.doctorId === doctorId && b.status !== "cancel");
  }

  /* ---------- دادهٔ نمونه ---------- */
  function seed() {
    if (localStorage.getItem("mehr_seed") === "1") return;
    const list = load();
    const today = new Date();
    const demos = [
      { offset: 0, time: "10:00", serviceId: "check", doctorId: "d1", name: "مریم احمدی", status: "done" },
      { offset: 0, time: "16:00", serviceId: "clean", doctorId: "d1", name: "حسین مرادی", status: "new" },
      { offset: 0, time: "11:00", serviceId: "filling", doctorId: "d2", name: "زهرا کاظمی", status: "new" },
      { offset: 1, time: "10:00", serviceId: "check", doctorId: "d1", name: "مریم احمدی", status: "done" },
      { offset: 1, time: "16:30", serviceId: "clean", doctorId: "d1", name: "رضا نوری", status: "new" },
      { offset: 2, time: "09:30", serviceId: "filling", doctorId: "d2", name: "سارا کریمی", status: "new" },
      { offset: 2, time: "17:00", serviceId: "implant", doctorId: "d2", name: "علی صادقی", status: "done" },
      { offset: 3, time: "11:00", serviceId: "ortho", doctorId: "d3", name: "نگار رستمی", status: "new" },
      { offset: 4, time: "10:30", serviceId: "check", doctorId: "d3", name: "پویا شریفی", status: "cancel" },
    ];
    demos.forEach((x, i) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + x.offset);
      if (!isOpen(d)) return;
      list.push({
        code: "MH-" + (12000 + i * 37),
        serviceId: x.serviceId,
        doctorId: x.doctorId,
        date: iso(d),
        time: x.time,
        name: x.name,
        phone: "0912" + String(1000000 + i * 111111),
        note: "",
        status: x.status,
        createdAt: new Date().toISOString(),
      });
    });
    save(list);
    localStorage.setItem("mehr_seed", "1");
  }

  /* ---------- توست ---------- */
  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3000);
  }

  /* ---------- مراحل ---------- */
  function renderSteps() {
    $$(".step").forEach((el) => {
      const n = Number(el.dataset.step);
      el.classList.toggle("is-active", n === state.step);
      el.classList.toggle("is-done", n < state.step);
    });
  }

  function go(step) {
    state.step = step;
    renderSteps();
    renderPanel();
  }

  function renderPanel() {
    if (state.step === 1) return renderServiceStep();
    if (state.step === 2) return renderDoctorStep();
    if (state.step === 3) return renderDateStep();
    if (state.step === 4) return renderConfirmStep();
    return renderSuccess();
  }

  function renderServiceStep() {
    const panel = $("#panel");
    panel.innerHTML = `
      <h2>چه خدمتی می‌خواهی؟</h2>
      <p class="hint">یکی را انتخاب کن؛ زمان تقریبی هر خدمت مشخص است.</p>
      <div class="service-list">
        ${services.map((s) => `
          <button class="service-option ${state.serviceId === s.id ? "is-selected" : ""}" data-service="${s.id}">
            <span class="ico">${s.icon}</span>
            <span>
              <b>${s.name}</b>
              <small>${s.desc} · ${fa.format(s.dur)} دقیقه</small>
            </span>
            <span class="price"><b>${money(s.price)}</b></span>
          </button>`).join("")}
      </div>
      <div class="nav-btns">
        <button class="btn btn--block" id="next" ${state.serviceId ? "" : "disabled"}>ادامه</button>
      </div>`;

    $$("[data-service]", panel).forEach((b) => b.addEventListener("click", () => {
      state.serviceId = b.dataset.service;
      renderServiceStep();
    }));
    $("#next").addEventListener("click", () => go(2));
  }

  function renderDoctorStep() {
    const panel = $("#panel");
    panel.innerHTML = `
      <h2>کدام پزشک؟</h2>
      <p class="hint">می‌توانی پزشک را بر اساس تخصص انتخاب کنی.</p>
      <div class="doctor-list">
        ${doctors.map((d) => `
          <button class="doctor-option ${state.doctorId === d.id ? "is-selected" : ""}" data-doctor="${d.id}">
            <span class="avatar-lg">${d.initials}</span>
            <b>${d.name}</b>
            <small>${d.spec}</small>
          </button>`).join("")}
      </div>
      <div class="nav-btns">
        <button class="btn btn--ghost" id="back">بازگشت</button>
        <button class="btn" id="next" ${state.doctorId ? "" : "disabled"}>ادامه</button>
      </div>`;

    $$("[data-doctor]", panel).forEach((b) => b.addEventListener("click", () => {
      state.doctorId = b.dataset.doctor;
      renderDoctorStep();
    }));
    $("#back").addEventListener("click", () => go(1));
    $("#next").addEventListener("click", () => go(3));
  }

  function renderDateStep() {
    const panel = $("#panel");
    const today = new Date();
    const days = [];
    for (let i = 0; i < 14; i += 1) days.push(new Date(today.getFullYear(), today.getMonth(), today.getDate() + i));

    if (!state.date) {
      const firstOpen = days.find(isOpen);
      if (firstOpen) state.date = iso(firstOpen);
    }

    const dayObj = new Date(...state.date.split("-").map((v, i) => (i === 1 ? Number(v) - 1 : Number(v))));
    const slots = slotsFor(dayObj);

    panel.innerHTML = `
      <h2>چه روزی؟</h2>
      <p class="hint">روزهای تعطیل و ساعت‌های رزروشده غیرفعال‌اند.</p>
      <div class="dates">
        ${days.map((d) => {
          const key = iso(d);
          const open = isOpen(d);
          return `<button class="date-chip ${key === state.date ? "is-selected" : ""} ${open ? "" : "is-closed"}" data-date="${key}" ${open ? "" : "disabled"}>
            <small>${weekday(d)}</small>
            <b>${dayNum(d)}</b>
            <small>${monthName(d)}</small>
          </button>`;
        }).join("")}
      </div>
      <div class="slots">
        ${slots.map((t) => {
          const taken = isTaken(state.date, t, state.doctorId);
          return `<button class="slot ${taken ? "is-taken" : ""} ${state.time === t ? "is-selected" : ""}" data-time="${t}" ${taken ? "disabled" : ""}>${t}</button>`;
        }).join("")}
      </div>
      <div class="nav-btns">
        <button class="btn btn--ghost" id="back">بازگشت</button>
        <button class="btn" id="next" ${state.time ? "" : "disabled"}>ادامه</button>
      </div>`;

    $$("[data-date]", panel).forEach((b) => b.addEventListener("click", () => {
      state.date = b.dataset.date;
      state.time = null;
      renderDateStep();
    }));
    $$("[data-time]", panel).forEach((b) => b.addEventListener("click", () => {
      state.time = b.dataset.time;
      renderDateStep();
    }));
    $("#back").addEventListener("click", () => go(2));
    $("#next").addEventListener("click", () => go(4));
  }

  function summary() {
    const s = services.find((x) => x.id === state.serviceId);
    const d = doctors.find((x) => x.id === state.doctorId);
    return `<div class="summary">
      <div><span>خدمت</span><b>${s.name}</b></div>
      <div><span>پزشک</span><b>${d.name}</b></div>
      <div><span>تاریخ</span><b>${fullDate(state.date)}</b></div>
      <div><span>ساعت</span><b>${state.time}</b></div>
      <div><span>هزینهٔ تقریبی</span><b>${money(s.price)}</b></div>
    </div>`;
  }

  function renderConfirmStep() {
    const panel = $("#panel");
    panel.innerHTML = `
      <h2>اطلاعاتت را وارد کن</h2>
      <p class="hint">کد پیگیری بعد از ثبت صادر می‌شود.</p>
      <form class="form" id="confirmForm" novalidate>
        <div class="field">
          <label for="name">نام و نام خانوادگی</label>
          <input id="name" name="name" value="${state.name}" placeholder="مثلاً سارا محمدی" />
        </div>
        <div class="field">
          <label for="phone">شمارهٔ تماس</label>
          <input id="phone" name="phone" value="${state.phone}" inputmode="tel" placeholder="۰۹۱۲…" />
        </div>
        <div class="field">
          <label for="note">توضیح (اختیاری)</label>
          <input id="note" name="note" value="${state.note}" placeholder="مثلاً درد در دندان عقل" />
        </div>
        ${summary()}
        <div class="nav-btns">
          <button type="button" class="btn btn--ghost" id="back">بازگشت</button>
          <button type="submit" class="btn">ثبت نوبت</button>
        </div>
      </form>`;

    $("#back").addEventListener("click", () => go(3));
    $("#confirmForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const name = $("#name").value.trim();
      const phone = $("#phone").value.trim();
      const note = $("#note").value.trim();
      const digits = phone.replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/\D/g, "");

      if (name.length < 3) return toast("نام را کامل وارد کن.");
      if (digits.length < 10) return toast("شمارهٔ تماس معتبر نیست.");
      if (isTaken(state.date, state.time, state.doctorId)) return toast("این ساعت همین حالا رزرو شد؛ زمان دیگری انتخاب کن.");

      state.name = name;
      state.phone = digits;
      state.note = note;

      const code = "MH-" + Math.floor(10000 + Math.random() * 89999);
      const list = load();
      list.push({
        code,
        serviceId: state.serviceId,
        doctorId: state.doctorId,
        date: state.date,
        time: state.time,
        name,
        phone: digits,
        note,
        status: "new",
        createdAt: new Date().toISOString(),
      });
      save(list);
      state.step = 5;
      renderSuccess(code);
    });
  }

  function renderSuccess(code) {
    renderSteps();
    const s = services.find((x) => x.id === state.serviceId);
    const d = doctors.find((x) => x.id === state.doctorId);
    $("#panel").innerHTML = `
      <div class="success">
        <div class="check">✓</div>
        <h2>نوبتت ثبت شد</h2>
        <p>${s.name} — ${d.name}</p>
        <p>${fullDate(state.date)} · ساعت ${state.time}</p>
        <div class="code">${code}</div>
        <p>این کد را نگه دار؛ برای پیگیری یا لغو لازم می‌شود.</p>
        <div class="nav-btns">
          <button class="btn btn--ghost" id="newB">نوبت جدید</button>
          <button class="btn" id="trackB">پیگیری</button>
        </div>
      </div>`;
    $("#newB").addEventListener("click", reset);
    $("#trackB").addEventListener("click", () => {
      openModal("#trackModal");
      $("#trackCode").value = code;
      $("#trackCode").focus();
    });
  }

  function reset() {
    Object.assign(state, { step: 1, serviceId: null, doctorId: null, date: null, time: null, name: "", phone: "", note: "" });
    renderSteps();
    renderPanel();
    document.getElementById("booking").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- خدمات پایین صفحه ---------- */
  function renderServiceCards() {
    $("#serviceGrid").innerHTML = services.map((s) => `
      <button class="service-card" data-pick="${s.id}">
        <b>${s.icon} ${s.name}</b>
        <span>${s.desc}</span>
        <span class="meta"><span>${money(s.price)}</span><span>${fa.format(s.dur)} دقیقه</span></span>
      </button>`).join("");

    $$("[data-pick]").forEach((b) => b.addEventListener("click", () => {
      state.serviceId = b.dataset.pick;
      state.step = 1;
      renderSteps();
      renderPanel();
      document.getElementById("booking").scrollIntoView({ behavior: "smooth", block: "start" });
    }));
  }

  /* ---------- مودال‌ها ---------- */
  let lastFocus = null;
  function openModal(sel) {
    lastFocus = document.activeElement;
    const m = $(sel);
    m.hidden = false;
    const focusable = m.querySelector("input, button");
    if (focusable) setTimeout(() => focusable.focus(), 50);
  }
  function closeModals() {
    $$(".modal").forEach((m) => { m.hidden = true; });
    if (lastFocus) lastFocus.focus();
  }

  $$(".modal").forEach((m) => {
    m.addEventListener("click", (e) => { if (e.target === m) closeModals(); });
  });
  $$("[data-close]").forEach((b) => b.addEventListener("click", closeModals));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModals(); });

  $("#trackBtn").addEventListener("click", () => openModal("#trackModal"));
  $("#adminBtn").addEventListener("click", () => { renderAdmin(); openModal("#adminModal"); });

  /* ---------- پیگیری ---------- */
  $("#trackForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const code = $("#trackCode").value.trim().toUpperCase();
    const b = load().find((x) => x.code === code);
    const box = $("#trackResult");
    if (!b) {
      box.innerHTML = `<p style="color:var(--red)">نوبتی با این کد پیدا نشد.</p>`;
      return;
    }
    const s = services.find((x) => x.id === b.serviceId);
    const d = doctors.find((x) => x.id === b.doctorId);
    const labels = { new: "در انتظار تأیید", done: "انجام‌شده", cancel: "لغوشده" };
    box.innerHTML = `
      <div class="summary">
        <div><span>وضعیت</span><b class="ok">${labels[b.status] || b.status}</b></div>
        <div><span>خدمت</span><b>${s.name}</b></div>
        <div><span>پزشک</span><b>${d.name}</b></div>
        <div><span>زمان</span><b>${fullDate(b.date)} · ${b.time}</b></div>
        <div><span>بیمار</span><b>${b.name}</b></div>
      </div>`;
  });

  /* ---------- پنل مدیریت ---------- */
  function renderAdmin() {
    const list = load().slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    $("#adminCount").textContent = fa.format(list.length) + " نوبت";
    $("#adminBody").innerHTML = list.map((b) => {
      const s = services.find((x) => x.id === b.serviceId);
      const d = doctors.find((x) => x.id === b.doctorId);
      const cls = b.status === "new" ? "new" : b.status === "done" ? "done" : "cancel";
      return `<tr>
        <td>${b.code}</td>
        <td>${b.name}<br><small class="muted">${b.phone}</small></td>
        <td>${s.name}</td>
        <td>${d.name}</td>
        <td>${fullDate(b.date)}<br><small class="muted">${b.time}</small></td>
        <td>
          <select class="status" data-code="${b.code}">
            <option value="new" ${b.status === "new" ? "selected" : ""}>در انتظار</option>
            <option value="done" ${b.status === "done" ? "selected" : ""}>انجام‌شده</option>
            <option value="cancel" ${b.status === "cancel" ? "selected" : ""}>لغوشده</option>
          </select>
        </td>
      </tr>`;
    }).join("") || `<tr><td colspan="6" class="muted" style="padding:18px">نوبتی ثبت نشده.</td></tr>`;

    $$("#adminBody select").forEach((sel) => sel.addEventListener("change", () => {
      const list2 = load();
      const b = list2.find((x) => x.code === sel.dataset.code);
      if (b) { b.status = sel.value; save(list2); toast("وضعیت به‌روز شد"); renderAdmin(); }
    }));
  }

  $("#clearAll").addEventListener("click", () => {
    if (!confirm("همهٔ نوبت‌ها پاک شوند؟")) return;
    save([]);
    localStorage.setItem("mehr_seed", "1");
    renderAdmin();
    toast("همهٔ نوبت‌ها پاک شد");
  });

  /* ---------- شروع ---------- */
  seed();
  renderSteps();
  renderPanel();
  renderServiceCards();
})();
