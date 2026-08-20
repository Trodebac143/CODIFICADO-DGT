const CSV_URLS = ["BASE_INFRACCIONES.csv", "base_infracciones.csv", "BASE_INFRACCIONES_DGT_actualizada_SOA_DROGAS.csv"];
let records = [];
let ultimoResultadoFicha = null;

const state = {
  materia: "",
  history: [],
  alcohol: {grupo:"", medio:"", supuesto:"", reincidente:"", vehiculo:""},
  drogas: {supuesto:"", vehiculo:""},
  soa: {vehiculo:"", circula:""},
  itv: {estado:"", detalle:""},
  permisos: {tipo:"", detalle:"", judicial:"", judicialPena:""}
};

function cleanRows(rows){ return rows.filter(r => r && r.id); }

function parseCSVLine(line){
  const result=[]; let current=""; let inQuotes=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch === '"'){
      if(inQuotes && line[i+1] === '"'){ current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if(ch === ',' && !inQuotes){
      result.push(current); current="";
    } else current += ch;
  }
  result.push(current);
  return result;
}

function loadCSVSync(csvUrl){
  try{
    var xhr = new XMLHttpRequest();
    xhr.open("GET", csvUrl, false);
    xhr.send(null);
    if(xhr.status !== 0 && xhr.status !== 200) return null;
    var text = xhr.responseText;
    var lines = text.split(/\r?\n/).filter(function(x){ return x.trim() !== ""; });
    if(lines.length < 2) return null;
    var headers = parseCSVLine(lines[0]).map(function(h){ return h.trim(); });
    var rows = lines.slice(1).map(function(line){
      var vals = parseCSVLine(line);
      var obj = {};
      headers.forEach(function(h,i){ obj[h] = (vals[i] || "").trim(); });
      return obj;
    });
    return cleanRows(rows);
  }catch(e){
    console.warn("No se pudo cargar CSV:", csvUrl, e);
    return null;
  }
}

function loadCSV(){
  for(var i = 0; i < CSV_URLS.length; i++){
    var result = loadCSVSync(CSV_URLS[i]);
    if(result && result.length > 0){
      console.log("CSV cargado:", CSV_URLS[i], result.length, "filas");
      return Promise.resolve(result);
    }
  }
  alert("No se ha podido cargar la base de infracciones. El CSV debe estar junto al index y llamarse BASE_INFRACCIONES.csv o base_infracciones.csv");
  return Promise.resolve([]);
}

function resetState(){
  state.materia = "";
  state.history = [];
  state.alcohol = {grupo:"", medio:"", supuesto:"", reincidente:"", vehiculo:""};
  state.drogas = {supuesto:""};
  state.soa = {vehiculo:"", circula:""};
  state.itv = {estado:"", detalle:""};
  state.permisos = {tipo:"", detalle:"", judicial:"", judicialPena:""};
}

function resetAll(){
  resetState();
  const actionBar = document.getElementById("actionBar");
  if(actionBar) actionBar.style.display = "grid";
  document.querySelectorAll("#materiaRow button").forEach(b=>b.classList.remove("active"));
  document.getElementById("treeArea").innerHTML = "";
  document.getElementById("resultado").innerHTML = "Selecciona una materia para empezar.";
}

function activateMatterButton(materia){
  document.querySelectorAll("#materiaRow button").forEach(b=>{
    b.classList.toggle("active", b.dataset.materia === materia);
  });
}

function saveSnapshot(){
  state.history.push(JSON.stringify({
    materia: state.materia,
    alcohol: state.alcohol,
    drogas: state.drogas,
    soa: state.soa,
    itv: state.itv,
    permisos: state.permisos
  }));
}

function goBack(){
  if(!state.history.length) return;
  const prev = JSON.parse(state.history.pop());
  state.materia = prev.materia;
  state.alcohol = prev.alcohol;
  state.drogas = prev.drogas;
  state.soa = prev.soa;
  state.itv = prev.itv;
  state.permisos = prev.permisos;
  activateMatterButton(state.materia);
  const actionBar = document.getElementById("actionBar");
  if(state.materia === "VMP"){
    renderVmpInfo();
  } else {
    if(actionBar) actionBar.style.display = "grid";
    renderTree();
  }
}

function selectMatter(materia){
  saveSnapshot();
  state.materia = materia;
  state.alcohol = {grupo:"", medio:"", supuesto:"", reincidente:"", vehiculo:""};
  state.drogas = {supuesto:""};
  state.soa = {vehiculo:"", circula:""};
  state.itv = {estado:"", detalle:""};
  state.permisos = {tipo:"", detalle:"", judicial:"", judicialPena:""};
  activateMatterButton(materia);
  const actionBar = document.getElementById("actionBar");
  if(materia === "VMP"){
    window.location.href = "notas_vmp.html?v=3";
    return;
  }
  if(actionBar) actionBar.style.display = "grid";
  renderTree();
  document.getElementById("resultado").innerHTML = "Completa el árbol y pulsa Resolver.";
}

document.querySelectorAll("#materiaRow button[data-materia]").forEach(btn=>{
  btn.addEventListener("click", ()=> selectMatter(btn.dataset.materia));
});

document.getElementById("btnApuntesRef").addEventListener("click", ()=>{
  window.location.href = "apuntes.html";
});

function makeStep(title, options, current, onClick){
  const card = document.createElement("div");
  card.className = "step";
  const h = document.createElement("h2"); h.textContent = title; card.appendChild(h);
  const opts = document.createElement("div"); opts.className = "options";
  options.forEach(raw=>{
    const value = typeof raw === "object" ? raw.value : raw;
    const htmlLabel = typeof raw === "object" ? raw.html : null;
    const label = typeof raw === "object" ? raw.label : raw;
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-pressed", current === value ? "true" : "false");
    if(htmlLabel){ b.innerHTML = htmlLabel; } else { b.textContent = label; }
    if(current === value) b.classList.add("active");
    b.addEventListener("click", ()=>{
      opts.querySelectorAll("button").forEach(btn=>{
        btn.classList.remove("active");
        btn.setAttribute("aria-pressed", "false");
      });
      b.classList.add("active");
      b.setAttribute("aria-pressed", "true");
      onClick(value);
    });
    opts.appendChild(b);
  });
  card.appendChild(opts);
  return card;
}

function renderPath(text){
  const el = document.createElement("div");
  el.className = "path";
  el.textContent = text;
  return el;
}

function getCurrentBreadcrumbParts(){
  const parts = ["Inicio"];
  if(!state.materia) return parts;
  parts.push(state.materia === "VMP" ? "Notas VMPs" : state.materia);

  if(state.materia === "ALCOHOL"){
    if(state.alcohol.grupo) parts.push(state.alcohol.grupo);
    if(state.alcohol.medio) parts.push(state.alcohol.medio);
    if(state.alcohol.supuesto && state.alcohol.supuesto !== state.alcohol.medio) parts.push(state.alcohol.supuesto);
    if(state.alcohol.reincidente) parts.push("Reincidente: " + state.alcohol.reincidente);
    if(state.alcohol.vehiculo) parts.push(state.alcohol.vehiculo);
  }
  if(state.materia === "DROGAS"){
    if(state.drogas.supuesto) parts.push(state.drogas.supuesto);
    if(state.drogas.vehiculo) parts.push(state.drogas.vehiculo);
  }
  if(state.materia === "SOA"){
    if(state.soa.vehiculo) parts.push(state.soa.vehiculo);
    if(state.soa.circula) parts.push(state.soa.circula === "SÍ" ? "Circulando" : "No circulando / estacionado");
  }
  if(state.materia === "ITV"){
    if(state.itv.estado) parts.push(state.itv.estado);
    if(state.itv.detalle) parts.push(state.itv.detalle);
  }
  if(state.materia === "PERMISOS"){
    if(state.permisos.tipo) parts.push(state.permisos.tipo);
    if(state.permisos.detalle) parts.push(state.permisos.detalle);
    if(state.permisos.judicial) parts.push(state.permisos.judicial);
    if(state.permisos.judicialPena) parts.push(state.permisos.judicialPena);
  }
  return parts;
}

function renderBreadcrumbs(){
  const wrap = document.createElement("nav");
  wrap.className = "breadcrumbs";
  wrap.setAttribute("aria-label", "Ruta de selección");

  const label = document.createElement("span");
  label.className = "bc-label";
  label.textContent = "Ruta";
  wrap.appendChild(label);

  const parts = getCurrentBreadcrumbParts();
  parts.forEach((part, index)=>{
    if(index > 0){
      const sep = document.createElement("span");
      sep.className = "bc-sep";
      sep.textContent = "›";
      wrap.appendChild(sep);
    }
    const chip = document.createElement("span");
    chip.className = "bc-chip" + (part === "—" ? " pending" : "");
    chip.textContent = part;
    wrap.appendChild(chip);
  });
  return wrap;
}

function makeExternalLinkStep(){
  const wrap = document.createElement("div");
  wrap.className = "step";
  wrap.innerHTML = `<div class="step-title">Consulta oficial</div>`;
  const row = document.createElement("div");
  row.className = "row";
  const b = document.createElement("button");
  b.type = "button";
  b.className = "secondaryLink";
  b.textContent = "CONSULTAR PAÍSES CON CONVENIO";
  b.onclick = ()=> window.open("https://www.dgt.es/nuestros-servicios/permisos-de-conducir/permisos-extranjeros-y-de-fuerzas-y-cuerpos-de-seguridad/canjes-de-permisos/paises-con-convenio-de-canjes/", "_blank");
  row.appendChild(b);
  wrap.appendChild(row);
  const note = document.createElement("div");
  note.className = "note";
  note.textContent = "Abre el listado oficial DGT en una pestaña nueva.";
  wrap.appendChild(note);
  return wrap;
}

function makeMarginAccessStep(){
  const wrap = document.createElement("div");
  wrap.className = "step";
  wrap.innerHTML = `<div class="step-title">Márgenes de error alcohol</div>`;
  const row = document.createElement("div");
  row.className = "row";
  const b = document.createElement("button");
  b.type = "button";
  b.className = "secondaryLink";
  b.textContent = "📊 CONSULTAR TABLA DE MÁRGENES";
  b.onclick = showMarginTable;
  row.appendChild(b);
  wrap.appendChild(row);
  const note = document.createElement("div");
  note.className = "note marginWarn";
  note.textContent = "Márgenes de error en aplicación de la Orden ICT/155/2020";
  wrap.appendChild(note);
  return wrap;
}

function makeTramoStep(options, current, onPick){
  const wrap = document.createElement("div");
  wrap.className = "step";

  const header = document.createElement("div");
  header.className = "tramoHeader";
  header.innerHTML = `<div class="step-title">3. Tramo — <span class="marginWarn">Márgenes de error en aplicación de la Orden ICT/155/2020</span></div>`;

  const marginBtn = document.createElement("button");
  marginBtn.type = "button";
  marginBtn.className = "marginCalcBtn";
  marginBtn.textContent = "Cálculo tasa real tras margen";
  marginBtn.onclick = showMarginTable;
  header.appendChild(marginBtn);
  wrap.appendChild(header);

  const row = document.createElement("div");
  row.className = "row";
  options.forEach(opt=>{
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = opt;
    if(opt === current) b.classList.add("active");
    b.onclick = ()=> onPick(opt);
    row.appendChild(b);
  });
  wrap.appendChild(row);
  return wrap;
}

function valorRealAlcohol(valorMedido){
  const v = Number(String(valorMedido).replace(",", "."));
  if(Number.isNaN(v) || v < 0) return null;
  const real = v < 0.400 ? Math.max(0, v - 0.030) : v * 0.925;
  return Math.round(real * 100) / 100;
}

function tramoOrientativo(valorReal){
  if(valorReal === null) return "Introduce un valor válido.";
  if(valorReal <= 0) return "Sin tasa corregida apreciable.";
  if(valorReal <= 0.15) return "Zona 0,15: relevante para novel/profesional o menor.";
  if(valorReal <= 0.25) return "Por encima de 0,15 y hasta 0,25.";
  if(valorReal <= 0.50) return "Tramo >0,25 y <=0,50.";
  if(valorReal <= 0.60) return "Tramo >0,50 y <=0,60.";
  return "Tramo >0,60: tratar como zona penal en resto de vehículos; en BICIS/VMP/EPAC solo rama administrativa.";
}

function showMarginTable(){
  const area = document.getElementById("treeArea");
  area.innerHTML = `
    <div class="section">
      <h2>📊 Tabla rápida de márgenes de error — alcohol en aire</h2>
      <div class="note marginWarn">Márgenes de error en aplicación de la Orden ICT/155/2020</div>
      <div class="marginTableWrap">
        <table class="marginTable">
          <thead><tr><th>Lectura del aparato</th><th>Valor tras margen de error</th><th>Zona</th><th>Uso práctico</th></tr></thead>
          <tbody>
            <tr><td>0,14</td><td>0,11</td><td>🟢 Bajo 0,15</td><td>Por debajo del umbral 0,15</td></tr>
            <tr><td>0,18</td><td>0,15</td><td>🟡 Umbral 0,15</td><td>Primer valor útil tras margen para novel/profesional</td></tr>
            <tr><td>0,24</td><td>0,21</td><td>🟢 Bajo 0,25</td><td>No alcanza 0,25 tras margen</td></tr>
            <tr><td>0,28</td><td>0,25</td><td>🟡 Umbral 0,25</td><td>Primer valor útil para tramo general</td></tr>
            <tr><td>0,43</td><td>0,40</td><td>🟠 Zona 0,40</td><td>Valorar accidente / infracción / síntomas</td></tr>
            <tr><td>0,54</td><td>0,50</td><td>🟠 Umbral 0,50</td><td>Último valor dentro de >0,25 y ≤0,50</td></tr>
            <tr><td>0,55</td><td>0,51</td><td>🟠 Zona >0,50</td><td>Entra en tramo >0,50 y ≤0,60</td></tr>
            <tr><td>0,65</td><td>0,60</td><td>🔴 Límite 0,60</td><td>No supera 0,60 tras margen: todavía no zona penal por tasa</td></tr>
            <tr><td>0,66</td><td>0,61</td><td>🔴 Zona >0,60</td><td>Supera 0,60 tras margen: prioridad penal en resto de vehículos</td></tr>
          </tbody>
        </table>
      </div>
      <div class="calcBox">
        <div class="step-title">🧮 Calcular valor real aproximado</div>
        <input id="alcoholCalcInput" class="tinyInput" inputmode="decimal" placeholder="Ejemplo: 0,47">
        <div class="row" style="margin-top:10px"><button type="button" onclick="calcularMargenAlcohol()">Calcular</button><button type="button" onclick="renderTree()">Volver al árbol</button></div>
        <div id="alcoholCalcResult" class="note"></div>
      </div>
    </div>`;
}

function calcularMargenAlcohol(){
  const input = document.getElementById("alcoholCalcInput");
  const out = document.getElementById("alcoholCalcResult");
  const real = valorRealAlcohol(input.value);
  if(real === null){ out.innerHTML = "Valor no válido."; return; }
  out.innerHTML = `<strong>Valor tras margen de error:</strong> ${String(real.toFixed(2)).replace(".", ",")} mg/l. <br><strong>Criterio:</strong> ${tramoOrientativo(real)}`;
}


const VMP_INFO_CARDS = [
  {
    title: "Carecer de autorización administrativa / vehículo fuera de norma",
    code: ["RGV", "Art. 1", "Ap. 1", "Op. 5B"],
    amount: "500 / 250 €",
    text: "Circular con un vehículo que carece de la correspondiente autorización administrativa, permiso de circulación, vehículo fuera de norma o vehículo ilegal.",
    note: "Puede dar lugar a inmovilización. En el codificado aparece también como VEH 001 / LSV 066, opción 5B, con referencia a instrucciones DGT sobre VMP."
  },
  {
    title: "Elementos técnicos obligatorios del VMP",
    code: ["RGV", "Art. 7", "Ap. 3", "Op. 5B"],
    amount: "200 / 100 €",
    text: "Circular con un VMP careciendo de elementos sujetos a reglamentación técnica, incumpliendo el Anexo XXI de características y requisitos técnicos de los VMP.",
    note: "Útil especialmente para VMP posteriores al 22/01/2024 con certificado de circulación.",
    list: [
      "No disponer de dos frenos independientes.",
      "No disponer de sistema de estabilización en estacionamiento.",
      "Uso de neumáticos lisos o tipo slick.",
      "No llevar catadióptricos frontal, laterales y trasero.",
      "No estar equipado con avisador acústico integrado.",
      "No llevar visualizador de nivel de batería y velocidad instantánea.",
      "Carecer de placa de marcaje de fábrica cuando proceda.",
      "Carecer de portaidentificador cuando proceda."
    ]
  },
  {
    title: "Luces no reglamentarias",
    code: ["RGV", "Art. 15", "Ap. 5", "Op. 5A"],
    amount: "200 / 100 €",
    text: "Circular llevando instaladas más luces de las reglamentariamente admitidas o de color diferente al establecido reglamentariamente.",
    note: "Especificar en denuncia qué luces o color no reglamentario se observa."
  },
  {
    title: "Casco en VMP - Ordenanza municipal",
    code: ["Ordenanza Movilidad", "Art. 39 bis", "Ap. 2", "Punto 2.4"],
    amount: "Según ordenanza",
    text: "El uso del casco es obligatorio para todas las personas usuarias de vehículos de movilidad personal.",
    note: "Base competencial: art. 139 LBRL en defecto de normativa sectorial específica y art. 25.2.g LBRL sobre tráfico y movilidad."
  }
];

function renderVmpInfo(){
  const treeEl = document.getElementById("treeArea");
  const resultEl = document.getElementById("resultado");
  const actionBar = document.getElementById("actionBar");
  if(actionBar) actionBar.style.display = "none";
  if(resultEl) resultEl.innerHTML = "";
  if(!treeEl) return;
  treeEl.innerHTML = `
    <div class="vmp-notas-screen">
      <div class="vmp-notas-wrap">
        <h2 class="vmp-notas-title">Vehículos de Movilidad Personal</h2>
        <p class="vmp-notas-subtitle">Vehículos eléctricos de una sola plaza, sin sillín o con sillín y sistema de autoequilibrado.</p>

        <div class="vmp-type-list">
          <div class="vmp-type-card vmp-heavy">
            <div class="vmp-type-icon heavy"><span class="scoot">🛴</span><span class="vmp-type-badge">25+</span></div>
            <div>
              <div class="vmp-type-title">VMP &gt; 25 kg</div>
              <div class="vmp-type-text">Velocidad máxima de fabricación: superior a 14 km/h y hasta 25 km/h. La LSOA los considera vehículos a motor. Seguro obligatorio.</div>
            </div>
          </div>
          <div class="vmp-type-card vpl-light">
            <div class="vmp-type-icon light"><span class="scoot">🛴</span><span class="vmp-type-badge">&lt;25</span></div>
            <div>
              <div class="vmp-type-title">Vehículo Personal Ligero &lt; 25 kg</div>
              <div class="vmp-type-text">Velocidad máxima de fabricación: superior a 6 km/h y hasta 25 km/h. NO tienen consideración de vehículos a motor.</div>
            </div>
          </div>
          <div class="vmp-type-card vpl-heavy">
            <div class="vmp-type-icon wide"><span class="scoot">🛴</span><span class="vmp-type-badge">&gt;25</span></div>
            <div>
              <div class="vmp-type-title">Vehículo Personal Ligero &gt; 25 kg</div>
              <div class="vmp-type-text">Velocidad máxima de fabricación: superior a 6 km/h y hasta 14 km/h. NO tienen consideración de vehículos a motor.</div>
            </div>
          </div>
        </div>

        <div class="vmp-dgt-link-box">
          <a class="vmp-dgt-link" href="https://www.dgt.es/nuestros-servicios/tu-vehiculo/vehiculos-de-movilidad-personal-vmp/" target="_blank" rel="noopener noreferrer">Listado modelos certificados por DGT</a>
        </div>

        <div class="vmp-note-box vmp-important">
          <h3>Desde el 22/01/2024</h3>
          <ul class="vmp-note-list">
            <li><strong>Certificado de circulación.</strong> Comercializado antes del 22/01/2024: exento hasta el 23/01/2027.</li>
            <li><strong>Comercializado después del 22/01/2024:</strong> <span class="vmp-code-pill">VEH 22-B-2.5A</span> · 200 €. No disponer un vehículo de movilidad personal del certificado de circulación que garantiza el cumplimiento de los requisitos técnicos exigibles.</li>
            <li><strong>En todo caso, a partir del 23/01/2027:</strong> <span class="vmp-code-pill">VEH 22-B-2.5A</span> · 200 €.</li>
            <li><strong>Inscripción en Registro Nacional de Vehículos:</strong> <span class="vmp-code-pill">VEH 22-B-2.5B</span> · 100 €. No inscribir un vehículo de movilidad personal en el Registro Nacional de Vehículos.</li>
            <li><strong>Etiqueta identificativa y placa de marcaje:</strong> <span class="vmp-code-pill">VEH 22-B-2.5C</span> · 80 €. No disponer y exhibir en un vehículo de movilidad personal la etiqueta identificativa prevista o la placa de marcaje de fabricante.</li>
          </ul>
        </div>

        <div class="vmp-note-box">
          <h3>Requisitos técnicos — Anexo XXI</h3>
          <ul class="vmp-note-list">
            <li><strong>VEH 22-B-2.5D</strong> · 500 / 250 €. Incumplimiento muy grave: manipulación de limitación de velocidad para aumentarla, modificación estructural u otros supuestos de mayor gravedad.</li>
            <li><strong>VEH 22-B-2.5E</strong> · 200 / 100 €. Incumplimiento grave: no dispone o no funciona sistema de iluminación, ruedas u otros elementos técnicos relevantes.</li>
            <li><strong>VEH 22-B-2.5F</strong> · 100 / 50 €. Incumplimiento leve: ausencia de dispositivo sonoro, pata de cabra u otros elementos leves.</li>
          </ul>
          <div class="vmp-table-wrap">
            <table class="vmp-tech-table">
              <thead><tr><th>Artículo / opción</th><th>Requisito concreto</th><th>Importe</th></tr></thead>
              <tbody>
                <tr><td><span class="vmp-code-pill">RGV 7-3-5B</span></td><td><strong>2.6</strong> No disponer de dos frenos independientes, pudiendo ser accionados desde el mismo actuador.</td><td>200 / 100 €</td></tr>
                <tr><td><span class="vmp-code-pill">RGV 7-3-5B</span></td><td><strong>2.7</strong> No disponer de sistema de estabilización en aparcamiento.</td><td>200 / 100 €</td></tr>
                <tr><td><span class="vmp-code-pill">RGV 7-3-5B</span></td><td><strong>2.8</strong> Utilización de neumáticos lisos o tipo slick.</td><td>200 / 100 €</td></tr>
                <tr><td><span class="vmp-code-pill">RGV 7-3-5B</span></td><td><strong>2.9</strong> Catadióptricos frontal blanco, en ambos laterales blanco o color amarillo auto, y trasero rojo.</td><td>200 / 100 €</td></tr>
                <tr><td><span class="vmp-code-pill">RGV 7-3-5B</span></td><td><strong>2.11</strong> No estar equipado de un avisador acústico integrado en el propio vehículo.</td><td>200 / 100 €</td></tr>
                <tr><td><span class="vmp-code-pill">RGV 7-3-5B</span></td><td><strong>2.15</strong> No llevar instalado un visualizador integrado en el propio vehículo, nivel de batería y velocidad instantánea.</td><td>200 / 100 €</td></tr>
                <tr><td><span class="vmp-code-pill">RGV 7-3-5B</span></td><td><strong>2.23.1</strong> Carecer de placa de marcaje de fábrica único siendo la compra posterior a 12/01/2022.</td><td>200 / 100 €</td></tr>
                <tr><td><span class="vmp-code-pill">RGV 7-3-5B</span></td><td><strong>2.24</strong> Carecer de portaidentificador, normalmente bajo luz trasera roja.</td><td>200 / 100 €</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="vmp-note-box vmp-danger">
          <h3>No denunciar simultáneamente</h3>
          <ul class="vmp-note-list">
            <li>No denunciar a la vez <strong>certificado de circulación 5A</strong> y <strong>no inscripción en registro 5B</strong> cuando la falta de inscripción derive de no disponer de certificado.</li>
            <li>No denunciar <strong>placa de marcaje 5C</strong> si el motivo base es que no dispone de certificado de circulación 5A.</li>
            <li>No denunciar <strong>etiqueta identificativa 5C</strong> si el motivo base es que no está inscrito en registro 5B.</li>
            <li>Primero fija la infracción base y evita duplicar hechos derivados de la misma carencia.</li>
          </ul>
        </div>
      </div>
    </div>
`;
}

function renderTree(){
  const area = document.getElementById("treeArea");
  area.innerHTML = "";
  if(!state.materia) return;
  area.appendChild(renderBreadcrumbs());

  if(state.materia === "ALCOHOL"){
    area.appendChild(makeStep("1. Grupo", ["CONDUCTORES EN GENERAL", "NÓVELES / PROFESIONALES", "MENORES DE EDAD"], state.alcohol.grupo, (opt)=>{
      saveSnapshot();
      state.alcohol = {grupo:opt, medio:"", supuesto:"", reincidente:"", vehiculo:""};
      renderTree();
    }));

    if(state.alcohol.grupo){
      area.appendChild(makeStep("2. Tipo", ["REALIZA PRUEBA", "0,40 + ACCIDENTE / INFRACCIÓN", "NEGATIVA A REALIZAR PRUEBA"], state.alcohol.medio, (opt)=>{
        saveSnapshot();
        state.alcohol.medio = opt;
        state.alcohol.supuesto = "";
        state.alcohol.reincidente = "";
        state.alcohol.vehiculo = "";
        renderTree();
      }));
    }

    if(state.alcohol.medio){
      const general = state.alcohol.grupo === "CONDUCTORES EN GENERAL";
      const menores = state.alcohol.grupo === "MENORES DE EDAD";
      let options = [];

      if(state.alcohol.medio === "REALIZA PRUEBA"){
        if(menores){
          options = ["> 0 y <= 0,50", "> 0,50 y <= 0,60", "> 0,60"];
        } else {
          options = general
            ? ["> 0,25 y <= 0,50", "> 0,50 y <= 0,60", "> 0,60"]
            : ["> 0,15 y < 0,30", "> 0,30 y <= 0,60", "> 0,60"];
        }
      }

      if(options.length){
        area.appendChild(makeTramoStep(options, state.alcohol.supuesto, (opt)=>{
          saveSnapshot();
          state.alcohol.supuesto = opt;
          state.alcohol.reincidente = "";
          state.alcohol.vehiculo = "";
          renderTree();
        }));
      } else {
        state.alcohol.supuesto = state.alcohol.medio;
      }
    }

    const needsReincidence = state.alcohol.medio === "REALIZA PRUEBA" && !!state.alcohol.supuesto;
    if(needsReincidence){
      area.appendChild(makeStep("4. ¿Reincidente?", ["SÍ","NO"], state.alcohol.reincidente, (opt)=>{
        saveSnapshot();
        state.alcohol.reincidente = opt;
        state.alcohol.vehiculo = "";
        renderTree();
      }));
    }

    const needsVehicle = state.alcohol.medio && (
      ["NEGATIVA A REALIZAR PRUEBA","0,40 + ACCIDENTE / INFRACCIÓN"].includes(state.alcohol.medio) ||
      (state.alcohol.medio === "REALIZA PRUEBA" && !!state.alcohol.supuesto && !!state.alcohol.reincidente)
    );

    if(needsVehicle){
      const vehicleStepNumber = needsReincidence ? "5" : "3";
      area.appendChild(makeStep(`${vehicleStepNumber}. Vehículo`, ["BICIS / VMP / EPAC", "RESTO DE VEHÍCULOS"], state.alcohol.vehiculo, (opt)=>{
        saveSnapshot();
        state.alcohol.vehiculo = opt;
        renderTree();
      }));
    }

    area.appendChild(renderPath(`Ruta: ALCOHOL → ${state.alcohol.grupo || "—"} → ${state.alcohol.medio || "—"} → ${state.alcohol.supuesto || "—"}${needsReincidence ? " → " + (state.alcohol.reincidente || "—") : ""}${needsVehicle ? " → " + (state.alcohol.vehiculo || "—") : ""}`));
  }

  if(state.materia === "DROGAS"){
    area.appendChild(makeStep("1. Supuesto", ["POSITIVO", "NEGATIVA A REALIZAR PRUEBA"], state.drogas.supuesto, (opt)=>{
      saveSnapshot();
      state.drogas.supuesto = opt;
      state.drogas.vehiculo = "";
      renderTree();
    }));
    if(state.drogas.supuesto === "NEGATIVA A REALIZAR PRUEBA"){
      area.appendChild(makeStep("2. Tipo de vehículo", ["BICIS/EPAC/VMP","RESTO DE VEHÍCULOS"], state.drogas.vehiculo, (opt)=>{
        saveSnapshot();
        state.drogas.vehiculo = opt;
        renderTree();
      }));
    }
    area.appendChild(renderPath(`Ruta: DROGAS → ${state.drogas.supuesto || "—"}${state.drogas.vehiculo ? " → " + state.drogas.vehiculo : ""}`));
  }

  if(state.materia === "SOA"){
    area.appendChild(makeStep("1. Vehículo", ["CICLOMOTOR","MOTOCICLETA","TURISMO","3ª CATEGORÍA","VMP","VPL"], state.soa.vehiculo, (opt)=>{
      saveSnapshot();
      state.soa.vehiculo = opt;
      state.soa.circula = "";
      renderTree();
    }));
    if(state.soa.vehiculo){
      area.appendChild(makeStep("2. ¿Circula?", ["SÍ","NO"], state.soa.circula, (opt)=>{
        saveSnapshot();
        state.soa.circula = opt;
        renderTree();
      }));
    }
    area.appendChild(renderPath(`Ruta: SOA → ${state.soa.vehiculo || "—"} → ${state.soa.circula || "—"}`));
  }

  if(state.materia === "ITV"){
    area.appendChild(makeStep("1. Estado ITV", ["CADUCADA","DESFAVORABLE","NEGATIVA"], state.itv.estado, (opt)=>{
      saveSnapshot();
      state.itv.estado = opt;
      state.itv.detalle = "";
      renderTree();
    }));
    if(state.itv.estado === "DESFAVORABLE"){
      area.appendChild(makeStep("2. Detalle", ["CIRCULANDO", "FUERA DE PLAZO"], state.itv.detalle, (opt)=>{
        saveSnapshot();
        state.itv.detalle = opt;
        renderTree();
      }));
    }
    if(state.itv.estado === "NEGATIVA"){
      area.appendChild(makeStep("2. Detalle", ["CIRCULANDO", "PONER EN CIRCULACIÓN"], state.itv.detalle, (opt)=>{
        saveSnapshot();
        state.itv.detalle = opt;
        renderTree();
      }));
    }
    area.appendChild(renderPath(`Ruta: ITV → ${state.itv.estado || "—"} → ${state.itv.detalle || "—"}`));
  }

  if(state.materia === "PERMISOS"){
    area.appendChild(makeStep("1. Tipo", ["CADUCADO","SIN PERMISO","PERMISO NO VÁLIDO"], state.permisos.tipo, (opt)=>{
      saveSnapshot();
      state.permisos = {tipo:opt, detalle:"", judicial:"", judicialPena:""};
      renderTree();
    }));

    if(state.permisos.tipo === "SIN PERMISO"){
      area.appendChild(makeStep("2. Detalle", ["NUNCA OBTENIDO","PÉRDIDA TOTAL DE PUNTOS","PRIVACIÓN JUDICIAL"], state.permisos.detalle, (opt)=>{
        saveSnapshot();
        state.permisos.detalle = opt;
        state.permisos.judicial = "";
        state.permisos.judicialPena = "";
        renderTree();
      }));
      if(state.permisos.detalle === "PRIVACIÓN JUDICIAL"){
        area.appendChild(makeStep("3. Situación", ["DENTRO DEL PLAZO DE PENA","FUERA DEL PLAZO DE PENA"], state.permisos.judicial, (opt)=>{
          saveSnapshot();
          state.permisos.judicial = opt;
          state.permisos.judicialPena = "";
          renderTree();
        }));

        if(state.permisos.judicial === "FUERA DEL PLAZO DE PENA"){
          area.appendChild(makeStep("4. Duración de la pena", ["PENA < 2 AÑOS","PENA DE 2 AÑOS O MÁS"], state.permisos.judicialPena, (opt)=>{
            saveSnapshot();
            state.permisos.judicialPena = opt;
            renderTree();
          }));
        }
      }
    }

    if(state.permisos.tipo === "PERMISO NO VÁLIDO"){
      area.appendChild(makeStep("2. Detalle", ["EXTRANJERO CANJEABLE","EXTRANJERO NO CANJEABLE","NO HABILITA PARA ESE VEHÍCULO","INCUMPLIMIENTO DE REQUISITOS ADMINISTRATIVOS"], state.permisos.detalle, (opt)=>{
        saveSnapshot();
        state.permisos.detalle = opt;
        renderTree();
      }));
      area.appendChild(makeExternalLinkStep());
    }

    area.appendChild(renderPath(`Ruta: PERMISOS → ${state.permisos.tipo || "—"} → ${state.permisos.detalle || "—"}${state.permisos.judicial ? " → " + state.permisos.judicial : ""}${state.permisos.judicialPena ? " → " + state.permisos.judicialPena : ""}`));
  }
}

function findById(id){ return records.find(r => String(r.id) === String(id)) || null; }

function recordFromTree(){
  if(state.materia === "SOA"){
    const map = {
      "CICLOMOTOR|SÍ":"1","MOTOCICLETA|SÍ":"2","TURISMO|SÍ":"3","3ª CATEGORÍA|SÍ":"4",
      "CICLOMOTOR|NO":"5","MOTOCICLETA|NO":"6","TURISMO|NO":"7","3ª CATEGORÍA|NO":"8",
      "VMP|SÍ":"SOA_VMP_CIRCULA","VMP|NO":"SOA_VMP_CARECE",
      "VPL|SÍ":"SOA_VPL_CIRCULA","VPL|NO":"SOA_VPL_CARECE"
    };
    return findById(map[`${state.soa.vehiculo}|${state.soa.circula}`]);
  }

  if(state.materia === "DROGAS"){
    if(state.drogas.supuesto === "POSITIVO") return findById("18");
    if(state.drogas.supuesto === "NEGATIVA A REALIZAR PRUEBA" && state.drogas.vehiculo === "BICIS/EPAC/VMP") return findById("DROGAS_NEG_BICI_VMP_EPAC");
    if(state.drogas.supuesto === "NEGATIVA A REALIZAR PRUEBA" && state.drogas.vehiculo === "RESTO DE VEHÍCULOS") return findById("19");
    return null;
  }

  if(state.materia === "ITV"){
    if(state.itv.estado === "CADUCADA") return findById("20");
    if(state.itv.estado === "DESFAVORABLE" && state.itv.detalle === "CIRCULANDO") return findById("21");
    if(state.itv.estado === "DESFAVORABLE" && state.itv.detalle === "FUERA DE PLAZO") return findById("22");
    if(state.itv.estado === "NEGATIVA" && state.itv.detalle === "CIRCULANDO") return findById("23");
    if(state.itv.estado === "NEGATIVA" && state.itv.detalle === "PONER EN CIRCULACIÓN") return findById("24");
    return null;
  }

  if(state.materia === "PERMISOS"){
    if(state.permisos.tipo === "CADUCADO") return findById("9");
    if(state.permisos.tipo === "SIN PERMISO" && state.permisos.detalle === "NUNCA OBTENIDO") return findById("10");
    if(state.permisos.tipo === "SIN PERMISO" && state.permisos.detalle === "PÉRDIDA TOTAL DE PUNTOS") return findById("11");
    if(state.permisos.tipo === "SIN PERMISO" && state.permisos.detalle === "PRIVACIÓN JUDICIAL" && state.permisos.judicial === "DENTRO DEL PLAZO DE PENA") return findById("12");
    if(state.permisos.tipo === "SIN PERMISO" && state.permisos.detalle === "PRIVACIÓN JUDICIAL" && state.permisos.judicial === "FUERA DEL PLAZO DE PENA" && state.permisos.judicialPena === "PENA < 2 AÑOS") return findById("13");
    
    if(state.permisos.tipo === "SIN PERMISO" && state.permisos.detalle === "PRIVACIÓN JUDICIAL" && state.permisos.judicial === "FUERA DEL PLAZO DE PENA" && state.permisos.judicialPena === "PENA DE 2 AÑOS O MÁS") return findById("38");
    if(state.permisos.tipo === "PERMISO NO VÁLIDO" && state.permisos.detalle === "EXTRANJERO CANJEABLE") return findById("14");
    if(state.permisos.tipo === "PERMISO NO VÁLIDO" && state.permisos.detalle === "EXTRANJERO NO CANJEABLE") return findById("15");
    if(state.permisos.tipo === "PERMISO NO VÁLIDO" && state.permisos.detalle === "NO HABILITA PARA ESE VEHÍCULO") return findById("16");
    if(state.permisos.tipo === "PERMISO NO VÁLIDO" && state.permisos.detalle === "INCUMPLIMIENTO DE REQUISITOS ADMINISTRATIVOS") return findById("17");
    return null;
  }

  if(state.materia === "ALCOHOL"){
    const g = state.alcohol.grupo;
    const m = state.alcohol.medio;
    const s = state.alcohol.supuesto;
    const r = state.alcohol.reincidente;

    if(m === "NEGATIVA A REALIZAR PRUEBA") return findById("37");

    if(m === "0,40 + ACCIDENTE / INFRACCIÓN"){
      if(g === "MENORES DE EDAD") return findById("39");
      return findById(g === "CONDUCTORES EN GENERAL" ? "25" : "31");
    }

    if(g === "MENORES DE EDAD"){
      if(m === "REALIZA PRUEBA"){
        if(r === "NO" && s === "> 0 y <= 0,50") return findById("39");
        if(r === "SÍ" && s === "> 0 y <= 0,50") return findById("40");
        if(r === "NO" && s === "> 0,50 y <= 0,60") return findById("27");
        if(r === "SÍ" && s === "> 0,50 y <= 0,60") return findById("29");
        if(r === "NO" && s === "> 0,60") return findById("27");
        if(r === "SÍ" && s === "> 0,60") return findById("29");
      }
    }

    if(g === "CONDUCTORES EN GENERAL"){
      if(m === "REALIZA PRUEBA"){
        if(r === "NO" && s === "> 0,25 y <= 0,50") return findById("25");
        if(r === "NO" && s === "> 0,50 y <= 0,60") return findById("27");
        if(r === "NO" && s === "> 0,60") return findById("27");
        if(r === "SÍ" && s === "> 0,25 y <= 0,50") return findById("29");
        if(r === "SÍ" && s === "> 0,50 y <= 0,60") return findById("29");
        if(r === "SÍ" && s === "> 0,60") return findById("29");
      }
    }

    if(g === "NÓVELES / PROFESIONALES"){
      if(m === "REALIZA PRUEBA"){
        if(r === "NO" && s === "> 0,15 y < 0,30") return findById("31");
        if(r === "NO" && s === "> 0,30 y <= 0,60") return findById("33");
        if(r === "NO" && s === "> 0,60") return findById("33");
        if(r === "SÍ" && s === "> 0,15 y < 0,30") return findById("35");
        if(r === "SÍ" && s === "> 0,30 y <= 0,60") return findById("35");
        if(r === "SÍ" && s === "> 0,60") return findById("35");
      }
    }
  }
  return null;
}

function applyOperationalOverlays(record){
  if(!record) return null;
  const out = {...record};
  const comentarioCsv = record.comentario_operativo;

  if(
    state.materia === "PERMISOS" &&
    state.permisos.tipo === "SIN PERMISO" &&
    state.permisos.detalle === "PRIVACIÓN JUDICIAL" &&
    state.permisos.judicial === "FUERA DEL PLAZO DE PENA" &&
    state.permisos.judicialPena === "PENA DE 2 AÑOS O MÁS"
  ){
    out.alerta_penal = "NO";
    out.referencia_penal = "—";
    out.accion_prioritaria = "No se ejerce la acción penal. Procede denuncia administrativa.";
    out.comentario_operativo = "No procede art. 384 CP si la pena de privación ya está cumplida. La mera indicación en sentencia de que debe realizar curso de sensibilización/reeducación para recuperar la autorización no convierte automáticamente la conducción posterior en delito de desobediencia.";
  }

  if(state.materia === "ALCOHOL"){
    const isVmpEpac = state.alcohol.vehiculo === "BICIS / VMP / EPAC";

    if(state.alcohol.grupo === "MENORES DE EDAD"){
      if(state.alcohol.medio === "REALIZA PRUEBA" && state.alcohol.supuesto === "> 0 y <= 0,50"){
        out.comentario_operativo = "Menor de edad: tasa 0,00 obligatoria. Resultado positivo: infracción administrativa. Márgenes de error en aplicación de la Orden ICT/155/2020.";
      }
      if(state.alcohol.medio === "REALIZA PRUEBA" && state.alcohol.supuesto === "> 0,50 y <= 0,60"){
        out.comentario_operativo = "Menor de edad con tasa superior a 0,50 e inferior a 0,66 mg/l en aire espirado. Infracción administrativa. Márgenes de error en aplicación de la Orden ICT/155/2020.";
      }
    }

    if(state.alcohol.medio === "NEGATIVA A REALIZAR PRUEBA"){
      out.alerta_penal = "SI";
      out.referencia_penal = "CP 383";
      out.accion_prioritaria = "Tramitar diligencias penales y adoptar medidas sobre el vehículo";
      out.comentario_operativo = "La negativa a la prueba de alcohol tiene reproche penal.";
    }

    if(state.alcohol.medio === "REALIZA PRUEBA" && state.alcohol.supuesto === "> 0,60"){
      out.alerta_penal = "SI";
      out.referencia_penal = "CP 379.2";
      out.accion_prioritaria = "Ejercer acción penal y adoptar medidas sobre el vehículo";
      out.comentario_operativo = "Tasa penal en aire espirado desde > 0,60, con prioridad operativa penal. Márgenes de error en aplicación de la Orden ICT/155/2020.";
    }

    if(state.alcohol.medio === "0,40 + ACCIDENTE / INFRACCIÓN"){
      out.alerta_penal = "SI";
      out.referencia_penal = "Valorar CP 379.2 por influencia";
      out.accion_prioritaria = "Valorar diligencias penales por influencia según sintomatología, accidente o infracción";
      out.comentario_operativo = "No hay penal automático por el dato aislado, pero debe valorarse la influencia en la conducción.";
    }

    if(isVmpEpac){
      out.alerta_penal = "NO";
      out.referencia_penal = "—";
      out.accion_prioritaria = "Denunciar administrativamente. En BICIS / VMP / EPAC no se contempla vía penal en esta rama de la aplicación.";
      const baseComment = out.comentario_operativo && out.comentario_operativo !== "—" ? out.comentario_operativo + " " : "";
      out.comentario_operativo = baseComment + "BICIS / VMP / EPAC: se mantiene solo respuesta administrativa en esta rama.";
    }
  }
  if(comentarioCsv && comentarioCsv !== "—"){
    out.comentario_operativo = comentarioCsv;
  }

  return out;
}


function isTreeComplete(){
  if(state.materia === "VMP") return true;
  if(state.materia === "ALCOHOL"){
    if(!state.alcohol.grupo || !state.alcohol.medio) return false;
    if(["NEGATIVA A REALIZAR PRUEBA","0,40 + ACCIDENTE / INFRACCIÓN"].includes(state.alcohol.medio)) return !!state.alcohol.vehiculo;
    return !!(state.alcohol.supuesto && state.alcohol.reincidente && state.alcohol.vehiculo);
  }

  if(state.materia === "DROGAS") return state.drogas.supuesto === "POSITIVO" || (state.drogas.supuesto === "NEGATIVA A REALIZAR PRUEBA" && !!state.drogas.vehiculo);
  if(state.materia === "SOA") return !!(state.soa.vehiculo && state.soa.circula);
  if(state.materia === "ITV"){
    if(state.itv.estado === "CADUCADA") return true;
    if(state.itv.estado === "DESFAVORABLE" || state.itv.estado === "NEGATIVA") return !!state.itv.detalle;
    return false;
  }
  if(state.materia === "PERMISOS"){
    if(state.permisos.tipo === "CADUCADO") return true;
    if(state.permisos.tipo === "PERMISO NO VÁLIDO") return !!state.permisos.detalle;
    if(state.permisos.tipo === "SIN PERMISO"){
      if(!state.permisos.detalle) return false;
      if(state.permisos.detalle !== "PRIVACIÓN JUDICIAL") return true;
      if(state.permisos.judicial === "DENTRO DEL PLAZO DE PENA") return true;
      if(state.permisos.judicial === "FUERA DEL PLAZO DE PENA") return !!state.permisos.judicialPena;
    }
    return false;
  }
  return false;
}

document.getElementById("btnResolver").addEventListener("click", ()=>{
  if(state.materia === "VMP"){ renderVmpInfo(); return; }
  if(!state.materia || !isTreeComplete()){
    document.getElementById("resultado").innerHTML = "Completa el árbol antes de resolver.";
    return;
  }
  const rec = applyOperationalOverlays(recordFromTree());
  renderResult(rec);
});
document.getElementById("btnLimpiar").addEventListener("click", resetAll);
document.getElementById("btnVolver").addEventListener("click", goBack);


function initThemeToggle(){
  const btn = document.getElementById("themeToggle");
  if(!btn) return;
  const savedTheme = localStorage.getItem("temaAppDGT") || "dia";
  function applyTheme(theme){
    const dark = theme === "noche";
    document.body.classList.toggle("dark-mode", dark);
    btn.textContent = dark ? "🌙 Noche" : "☀️ Día";
    localStorage.setItem("temaAppDGT", theme);
  }
  applyTheme(savedTheme);
  btn.addEventListener("click", ()=>{
    const next = document.body.classList.contains("dark-mode") ? "dia" : "noche";
    applyTheme(next);
  });
}
initThemeToggle();

loadCSV().then(rows => { records = rows; });
