// ========= CONFIG =========
const CSV_PATH = "data_by_record_app.csv";

// Columnas esperadas (ponemos fallback por si tu CSV usa "Tecnica" en vez de "tecnica")
const COL_GRUPO  = "tecnica_grupo";
const COL_ESTADO = "Estado";
const COL_TECNICA_CANDIDATES = ["tecnica", "Tecnica", "Técnica"];

// ========= STATE =========
let RAW = [];
let currentEstado = "Todos";

// ========= HELPERS =========
function pickTecnica(row){
  for (const k of COL_TECNICA_CANDIDATES){
    if (row[k] != null && String(row[k]).trim() !== "") return String(row[k]).trim();
  }
  return "";
}

function norm(v){
  return (v == null) ? "" : String(v).trim();
}

function buildTreeData(records){
  // Agrupa por tecnica_grupo -> tecnica, contando registros
  const grouped = new Map();

  for (const r of records){
    const grupo = norm(r[COL_GRUPO]) || "Sin grupo";
    const estado = norm(r[COL_ESTADO]);
    const tecnica = pickTecnica(r) || "Sin técnica";

    // guardamos en grouped
    if (!grouped.has(grupo)) grouped.set(grupo, new Map());
    const m = grouped.get(grupo);
    m.set(tecnica, (m.get(tecnica) || 0) + 1);
  }

  const children = Array.from(grouped.entries())
    .sort((a,b) => a[0].localeCompare(b[0], "es"))
    .map(([grupo, techMap]) => ({
      name: grupo,
      children: Array.from(techMap.entries())
        .sort((a,b) => a[0].localeCompare(b[0], "es"))
        .map(([tec, count]) => ({
          name: tec,
          value: count
        }))
    }));

  return { name: "Arte textil", children };
}

function filterRecords(){
  if (currentEstado === "Todos") return RAW;
  return RAW.filter(r => norm(r[COL_ESTADO]) === currentEstado);
}

// ========= UI CONTROLS =========
function initEstadoSelect(records){
  const sel = document.getElementById("estadoSelect");

  const estados = Array.from(new Set(records.map(r => norm(r[COL_ESTADO])).filter(Boolean)))
    .sort((a,b) => a.localeCompare(b, "es"));

  sel.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "Todos";
  optAll.textContent = "Todos";
  sel.appendChild(optAll);

  for (const e of estados){
    const opt = document.createElement("option");
    opt.value = e;
    opt.textContent = e;
    sel.appendChild(opt);
  }

  sel.value = "Todos";
  sel.addEventListener("change", () => {
    currentEstado = sel.value;
    render(); // re-render con filtro
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    currentEstado = "Todos";
    sel.value = "Todos";
    render();
  });
}

// ========= D3 RENDER =========
function renderTree(treeData){
  const container = document.getElementById("chart");
  container.innerHTML = ""; // limpia

  const width = container.clientWidth;
  const height = container.clientHeight;

  const margin = { top: 14, right: 40, bottom: 14, left: 40 };

  const svg = d3.select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  // Construye jerarquía
  const root = d3.hierarchy(treeData);

  // Colapsa TODAS las técnicas al inicio (depth 1 = grupos; depth 2 = técnicas)
  root.each(d => {
    if (d.depth === 1 && d.children) {
      d._children = d.children; // guarda técnicas
      d.children = null;        // colapsa
    }
  });

  let i = 0;
  root.x0 = innerH / 2;
  root.y0 = 0;

  // layout
  const dx = 20;
  const dy = 220;
  const tree = d3.tree().nodeSize([dx, dy]);

  // zoom/pan
  svg.call(
    d3.zoom()
      .scaleExtent([0.4, 2.5])
      .on("zoom", (event) => {
        g.attr("transform", `translate(${event.transform.x + margin.left},${event.transform.y + margin.top}) scale(${event.transform.k})`);
      })
  );

  // capa fija para actualizar
  const linkG = g.append("g").attr("class", "links");
  const nodeG = g.append("g").attr("class", "nodes");

  function diagonal(s, d) {
    return `M${s.y},${s.x}
            C${(s.y + d.y) / 2},${s.x}
             ${(s.y + d.y) / 2},${d.x}
             ${d.y},${d.x}`;
  }

  function update(source){
    tree(root);

    const nodes = root.descendants();
    const links = root.links();

    // normaliza y
    nodes.forEach(d => d.y = d.depth * dy);

    // LINKS
    const link = linkG.selectAll("path.link")
      .data(links, d => d.target.id);

    link.enter()
      .append("path")
      .attr("class", "link")
      .attr("d", d => {
        const o = { x: source.x0, y: source.y0 };
        return diagonal(o, o);
      })
      .merge(link)
      .transition()
      .duration(250)
      .attr("d", d => diagonal(d.source, d.target));

    link.exit()
      .transition()
      .duration(250)
      .attr("d", d => {
        const o = { x: source.x, y: source.y };
        return diagonal(o, o);
      })
      .remove();

    // NODES
    const node = nodeG.selectAll("g.node")
      .data(nodes, d => (d.id = d.id || ++i));

    const nodeEnter = node.enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", d => `translate(${source.y0},${source.x0})`)
      .style("cursor", d => (d._children || d.children) ? "pointer" : "default")
      .on("click", (event, d) => {
        // solo expandir/contraer si tiene hijos o _children (o sea: grupos)
        if (d._children) {
          d.children = d._children;
          d._children = null;
        } else if (d.children) {
          d._children = d.children;
          d.children = null;
        } else {
          return;
        }
        update(d);
      });

    // círculo
    nodeEnter.append("circle")
      .attr("r", 5)
      .attr("fill", d => {
        if (d.depth === 0) return "rgba(255,255,255,.95)";
        if (d.depth === 1) return "rgba(255,255,255,.65)";
        return "rgba(255,255,255,.35)";
      });

    // texto
    nodeEnter.append("text")
      .attr("dy", "0.32em")
      .attr("x", d => (d.children || d._children) ? 10 : 10)
      .attr("text-anchor", "start")
      .text(d => {
        // muestra conteo en técnicas (hojas)
        if (!d.children && !d._children && d.depth === 2) {
          const n = d.data.value || 0;
          return `${d.data.name} (${n})`;
        }
        return d.data.name;
      });

    // transición posición
    const nodeUpdate = nodeEnter.merge(node);

    nodeUpdate.transition()
      .duration(250)
      .attr("transform", d => `translate(${d.y},${d.x})`);

    // salida
    node.exit()
      .transition()
      .duration(250)
      .attr("transform", d => `translate(${source.y},${source.x})`)
      .remove();

    // guarda posiciones
    nodes.forEach(d => {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }

  update(root);

  // etiqueta con estado actual
  const label = svg.append("text")
    .attr("x", 12)
    .attr("y", height - 12)
    .attr("fill", "rgba(255,255,255,.65)")
    .attr("font-size", 12)
    .text(currentEstado === "Todos"
      ? "Filtro: Todos los estados"
      : `Filtro: ${currentEstado}`
    );
}

function render(){
  const filtered = filterRecords();
  const treeData = buildTreeData(filtered);
  renderTree(treeData);
}

// ========= LOAD =========
d3.csv(CSV_PATH).then(rows => {
  RAW = rows;

  // Inicializa filtro
  initEstadoSelect(RAW);

  // Render inicial
  render();
}).catch(err => {
  console.error("Error cargando CSV:", err);
  const container = document.getElementById("chart");
  container.innerHTML = `
    <div style="padding:14px;color:#fff;">
      <h3>No pude cargar el CSV</h3>
      <p>Revisa que <code>${CSV_PATH}</code> esté en la misma carpeta que <code>diagram.html</code> y que estés usando Live Server.</p>
      <pre style="white-space:pre-wrap;opacity:.8;">${String(err)}</pre>
    </div>
  `;
});
