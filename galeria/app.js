// ===============================
// Config
// ===============================
const PICS_DIR = "pics";
const INDEX_CSV = `${PICS_DIR}/indice_imagenes.csv`;

// Elementos UI
const gridEl = document.getElementById("grid");
const emptyEl = document.getElementById("emptyState");
const countShownEl = document.getElementById("countShown");

const filterEstadoEl = document.getElementById("filterEstado");
const filterTecnicaEl = document.getElementById("filterTecnica");
const searchBoxEl = document.getElementById("searchBox");
const clearBtnEl = document.getElementById("clearBtn");

// Lightbox
const lightboxEl = document.getElementById("lightbox");
const lbBackdrop = document.getElementById("lbBackdrop");
const lbClose = document.getElementById("lbClose");
const lbPrev = document.getElementById("lbPrev");
const lbNext = document.getElementById("lbNext");
const lbImg = document.getElementById("lbImg");
const lbCaption = document.getElementById("lbCaption");
const lbCounter = document.getElementById("lbCounter");

// Data
let allRows = [];
let filteredRows = [];
let currentIndex = 0;

// ===============================
// CSV parser simple (soporta comillas)
// ===============================
function parseCSV(text) {
  // Normaliza saltos
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const rows = [];
  let i = 0, field = "", row = [], inQuotes = false;

  while (i < text.length) {
    const c = text[i];

    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (!inQuotes && (c === "," || c === "\n")) {
      row.push(field);
      field = "";
      if (c === "\n") {
        rows.push(row);
        row = [];
      }
      i++;
      continue;
    }

    field += c;
    i++;
  }

  // último campo
  row.push(field);
  rows.push(row);

  const headers = rows.shift().map(h => h.trim());
  return rows
    .filter(r => r.some(v => String(v).trim() !== ""))
    .map(r => {
      const obj = {};
      headers.forEach((h, idx) => obj[h] = (r[idx] ?? "").trim());
      return obj;
    });
}

// ===============================
// Utilidades
// ===============================
const norm = (s) => (s ?? "").toString().trim();
const uniqSorted = (arr) => [...new Set(arr.filter(Boolean))].sort((a,b)=>a.localeCompare(b, "es"));
const contains = (haystack, needle) => norm(haystack).toLowerCase().includes(norm(needle).toLowerCase());

function rowToSearchBlob(r){
  // Ajusta si quieres incluir/excluir campos
  return [
    r.Sede, r.Genero, r.tecnica_grupo, r.Tecnica, r.Estado, r.Municipio,
    r.archivo_descargado, r.id
  ].map(norm).join(" • ");
}

function imageSrc(r){
  // archivo_descargado viene como "xxx.jpg"
  return `${PICS_DIR}/${r.archivo_descargado}`;
}

// ===============================
// Render filtros
// ===============================
function populateFilters(rows){
  const estados = uniqSorted(rows.map(r => norm(r.Estado)));
  const tecnicas = uniqSorted(rows.map(r => norm(r.Tecnica) || norm(r["Técnica"]) ));

  // Estado
  estados.forEach(e => {
    const opt = document.createElement("option");
    opt.value = e;
    opt.textContent = e;
    filterEstadoEl.appendChild(opt);
  });

  // Técnica
  tecnicas.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    filterTecnicaEl.appendChild(opt);
  });
}

// ===============================
// Render galería
// ===============================
function renderGrid(rows){
  gridEl.innerHTML = "";

  rows.forEach((r, idx) => {
    const card = document.createElement("article");
    card.className = "card";
    card.tabIndex = 0;

    const img = document.createElement("img");
    img.className = "thumb";
    img.loading = "lazy";
    img.src = imageSrc(r);
    img.alt = norm(r.Tecnica) || norm(r["Técnica"]) || "Imagen";

    const meta = document.createElement("div");
    meta.className = "meta";

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = norm(r.Tecnica) || norm(r["Técnica"]) || "(Sin técnica)";

    const kv = document.createElement("div");
    kv.className = "kv";
    kv.innerHTML = `
      <div><b>Estado:</b> ${norm(r.Estado) || "-"}</div>
      <div><b>Municipio:</b> ${norm(r.Municipio) || "-"}</div>
      <div><b>Sede:</b> ${norm(r.Sede) || "-"}</div>
      <div><b>Género:</b> ${norm(r.Genero) || "-"}</div>
    `;

    const pills = document.createElement("div");
    pills.className = "pills";
    const p1 = document.createElement("span");
    p1.className = "pill";
    p1.textContent = norm(r.tecnica_grupo) || "sin grupo";
    const p2 = document.createElement("span");
    p2.className = "pill";
    p2.textContent = norm(r.archivo_descargado) || "sin archivo";
    pills.appendChild(p1);
    pills.appendChild(p2);

    meta.appendChild(title);
    meta.appendChild(kv);
    meta.appendChild(pills);

    card.appendChild(img);
    card.appendChild(meta);

    // abrir lightbox en clic / enter / espacio
    card.addEventListener("click", () => openLightbox(idx));
    card.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        openLightbox(idx);
      }
    });

    gridEl.appendChild(card);
  });

  countShownEl.textContent = rows.length.toString();
  emptyEl.classList.toggle("hidden", rows.length !== 0);
}

// ===============================
// Filtrado
// ===============================
function applyFilters(){
  const estado = filterEstadoEl.value;
  const tecnica = filterTecnicaEl.value;
  const q = searchBoxEl.value;

  filteredRows = allRows.filter(r => {
    if (r.status && r.status !== "ok") return false; // solo OK por defecto
    if (estado && norm(r.Estado) !== estado) return false;

    const rTec = norm(r.Tecnica) || norm(r["Técnica"]);
    if (tecnica && rTec !== tecnica) return false;

    if (q) {
      const blob = rowToSearchBlob(r).toLowerCase();
      if (!blob.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  renderGrid(filteredRows);
}

// ===============================
// Lightbox / Carrusel
// ===============================
function openLightbox(idx){
  if (!filteredRows.length) return;
  currentIndex = Math.max(0, Math.min(idx, filteredRows.length - 1));
  updateLightbox();
  lightboxEl.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeLightbox(){
  lightboxEl.classList.add("hidden");
  document.body.style.overflow = "";
}

function prevImg(){
  if (!filteredRows.length) return;
  currentIndex = (currentIndex - 1 + filteredRows.length) % filteredRows.length;
  updateLightbox();
}

function nextImg(){
  if (!filteredRows.length) return;
  currentIndex = (currentIndex + 1) % filteredRows.length;
  updateLightbox();
}

function updateLightbox(){
  const r = filteredRows[currentIndex];
  lbImg.src = imageSrc(r);
  lbImg.alt = norm(r.Tecnica) || "Imagen";

  const caption = `
    <div><b>Técnica:</b> ${norm(r.Tecnica) || "-"}</div>
    <div><b>Estado:</b> ${norm(r.Estado) || "-"}</div>
    <div><b>Municipio:</b> ${norm(r.Municipio) || "-"}</div>
    <div><b>Sede:</b> ${norm(r.Sede) || "-"}</div>
    <div><b>Género:</b> ${norm(r.Genero) || "-"}</div>
    <div><b>Grupo:</b> ${norm(r.tecnica_grupo) || "-"}</div>
    <div class="muted" style="margin-top:6px;">
      <b>Archivo:</b> ${norm(r.archivo_descargado) || "-"} • <b>ID:</b> ${norm(r.id) || "-"}
    </div>
  `;
  lbCaption.innerHTML = caption;

  lbCounter.textContent = `${currentIndex + 1} / ${filteredRows.length}`;
}

// Eventos lightbox
lbBackdrop.addEventListener("click", closeLightbox);
lbClose.addEventListener("click", closeLightbox);
lbPrev.addEventListener("click", prevImg);
lbNext.addEventListener("click", nextImg);

document.addEventListener("keydown", (ev) => {
  if (lightboxEl.classList.contains("hidden")) return;
  if (ev.key === "Escape") closeLightbox();
  if (ev.key === "ArrowLeft") prevImg();
  if (ev.key === "ArrowRight") nextImg();
});

// Swipe básico (touch)
let touchX = null;
lbImg.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, {passive:true});
lbImg.addEventListener("touchend", (e) => {
  if (touchX === null) return;
  const endX = e.changedTouches[0].clientX;
  const dx = endX - touchX;
  touchX = null;
  if (Math.abs(dx) > 40) (dx > 0 ? prevImg() : nextImg());
}, {passive:true});

// ===============================
// Init
// ===============================
async function init(){
  const res = await fetch(INDEX_CSV, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar ${INDEX_CSV}. ¿Estás sirviendo con un servidor local?`);
  const text = await res.text();
  const rows = parseCSV(text);

  // Normaliza: si "archivo_descargado" viene vacío, intenta "ruta_archivo"
  allRows = rows.map(r => {
    if (!r.archivo_descargado && r.ruta_archivo) {
      const parts = r.ruta_archivo.split(/[/\\]/);
      r.archivo_descargado = parts[parts.length - 1];
    }
    return r;
  });

  populateFilters(allRows);
  applyFilters();
}

// listeners filtros
filterEstadoEl.addEventListener("change", applyFilters);
filterTecnicaEl.addEventListener("change", applyFilters);
searchBoxEl.addEventListener("input", () => {
  // pequeño debounce manual
  clearTimeout(window.__qT);
  window.__qT = setTimeout(applyFilters, 120);
});

clearBtnEl.addEventListener("click", () => {
  filterEstadoEl.value = "";
  filterTecnicaEl.value = "";
  searchBoxEl.value = "";
  applyFilters();
});

// run
init().catch(err => {
  console.error(err);
  gridEl.innerHTML = `
    <div class="empty">
      <h2>Error al cargar datos</h2>
      <p class="muted">${err.message}</p>
      <p class="muted">Tip: ejecuta un servidor local (ver instrucciones abajo).</p>
    </div>
  `;
  countShownEl.textContent = "0";
});
