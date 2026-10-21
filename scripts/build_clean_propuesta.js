const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = 'C:/Users/cf039/.gemini/antigravity/scratch/rd-fitness';
const shotsDir = path.join(rootDir, 'public/anatomy-pro/shots');
const htmlOut = path.join(rootDir, 'public/propuesta.html');
const pdfOut = path.join(rootDir, 'public/INFORME_PROPUESTA_COMERCIAL_GIMNASIOS.pdf');
const brainPdf = 'C:/Users/cf039/.gemini/antigravity/brain/6879f0e4-a349-472a-b769-d817f1294f7e/INFORME_PROPUESTA_COMERCIAL_GIMNASIOS.pdf';

function toBase64(file) {
  const p = path.join(shotsDir, file);
  if (fs.existsSync(p)) {
    return 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
  }
  return '';
}

const imgOverview = toBase64('overview.png');
const imgTv = toBase64('dev_smart_tv_55.png');
const imgScanner = toBase64('dev_scanner_2d.png');
const imgPrinter = toBase64('dev_thermal_printer.png');
const imgPhone = toBase64('dev_member_phone.png');
const imgMiniPc = toBase64('dev_minipc_pos.png');

const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dossier Técnico & Propuesta del Sistema Integral para Gimnasios</title>
  <style>
    :root {
      --bg: #090e17;
      --card: #111a2e;
      --card-2: #16223b;
      --border: rgba(255, 255, 255, 0.12);
      --gold: #f5b400;
      --gold-soft: rgba(245, 180, 0, 0.14);
      --emerald: #10b981;
      --emerald-soft: rgba(16, 185, 129, 0.14);
      --cyan: #06b6d4;
      --cyan-soft: rgba(6, 182, 212, 0.14);
      --purple: #8b5cf6;
      --text: #f8fafc;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: radial-gradient(circle at 15% 0%, #15223e 0%, var(--bg) 60%);
      color: var(--text);
      line-height: 1.55;
      padding-bottom: 70px;
    }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(9, 14, 23, 0.95);
      backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--border);
      padding: 12px 24px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .brand-pill {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      font-size: 15px;
    }
    .brand-badge {
      background: linear-gradient(135deg, var(--gold), #d97706);
      color: #000;
      font-weight: 900;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      text-transform: uppercase;
    }
    .customizer {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .customizer label {
      font-size: 12px;
      color: var(--muted);
      font-weight: 600;
    }
    .customizer input {
      background: var(--card-2);
      border: 1px solid var(--gold);
      color: #fff;
      padding: 6px 12px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13px;
      width: 220px;
    }
    .btn {
      background: var(--card-2);
      color: var(--text);
      border: 1px solid var(--border);
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: 0.2s;
    }
    .btn:hover { border-color: var(--gold); transform: translateY(-1px); }
    .btn-gold {
      background: linear-gradient(135deg, var(--gold), #e09f00);
      color: #000;
      border: none;
    }
    .container {
      max-width: 1180px;
      margin: 0 auto;
      padding: 24px 20px;
    }
    .hero {
      background: linear-gradient(135deg, rgba(22,34,59,0.95), rgba(17,26,46,0.95));
      border: 1px solid rgba(245, 180, 0, 0.35);
      border-radius: 18px;
      padding: 32px;
      margin-bottom: 24px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    }
    .hero-tag {
      display: inline-block;
      background: var(--gold-soft);
      color: var(--gold);
      border: 1px solid rgba(245,180,0,0.4);
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 12px;
    }
    .hero h1 {
      font-size: clamp(24px, 3.2vw, 36px);
      line-height: 1.2;
      margin-bottom: 12px;
      font-weight: 900;
    }
    .hero h1 span { color: var(--gold); }
    .hero p {
      font-size: 16px;
      color: #cbd5e1;
      max-width: 920px;
      margin-bottom: 22px;
    }
    .pillar-overview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 14px;
    }
    .pillar-kpi {
      background: rgba(9, 14, 23, 0.7);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
    }
    .pillar-kpi .val {
      font-size: 17px;
      font-weight: 900;
      color: var(--gold);
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .pillar-kpi .val.emerald { color: var(--emerald); }
    .pillar-kpi .val.cyan { color: var(--cyan); }
    .pillar-kpi .desc {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.45;
    }
    .section {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 26px;
      margin-bottom: 24px;
    }
    .section-title {
      font-size: 19px;
      font-weight: 900;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 10px;
      color: #fff;
    }
    .section-sub {
      color: var(--muted);
      font-size: 13.5px;
      margin-bottom: 20px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 20px;
    }
    .grid-3 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
    }
    .box {
      background: var(--card-2);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
    }
    .box h3 {
      font-size: 15px;
      font-weight: 800;
      margin-bottom: 10px;
      color: var(--gold);
    }
    .feature-list {
      list-style: none;
      display: grid;
      gap: 8px;
      font-size: 13px;
      color: #cbd5e1;
    }
    .feature-list li {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    .feature-list li::before {
      content: "✔";
      color: var(--emerald);
      font-weight: 900;
      font-size: 12px;
      flex-shrink: 0;
      margin-top: 1px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 13px;
    }
    th, td {
      padding: 11px 13px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    th {
      background: rgba(255,255,255,0.04);
      color: var(--gold);
      font-weight: 800;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
    }
    .badge-ok {
      background: var(--emerald-soft);
      color: var(--emerald);
      padding: 3px 8px;
      border-radius: 5px;
      font-weight: 800;
      font-size: 11px;
    }
    .badge-info {
      background: var(--cyan-soft);
      color: var(--cyan);
      padding: 3px 8px;
      border-radius: 5px;
      font-weight: 800;
      font-size: 11px;
    }
    .shot-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 16px;
      margin-top: 16px;
    }
    .shot-card {
      background: #070b13;
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
    }
    .shot-card img {
      width: 100%;
      height: 200px;
      object-fit: contain;
      background: #050811;
      display: block;
      border-bottom: 1px solid var(--border);
    }
    .shot-card .cap {
      padding: 12px 14px;
      font-size: 12px;
      color: #cbd5e1;
    }
    .shot-card .cap strong {
      color: var(--gold);
      display: block;
      margin-bottom: 3px;
      font-size: 13px;
    }
    .diagram-card {
      background: #070b13;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
      margin-top: 14px;
    }
    .page-break {
      page-break-after: always;
      break-after: page;
    }
    @media print {
      .topbar { display: none !important; }
      body { background: #fff !important; color: #0f172a !important; padding: 0 !important; font-size: 10.5px !important; line-height: 1.35 !important; }
      .container { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
      .hero {
        background: #fff !important;
        color: #0f172a !important;
        border: 1px solid #cbd5e1 !important;
        box-shadow: none !important;
        break-inside: avoid !important;
        margin-bottom: 8px !important;
        padding: 10px 14px !important;
        border-radius: 6px !important;
      }
      .section {
        background: #fff !important;
        color: #0f172a !important;
        border: 1px solid #cbd5e1 !important;
        box-shadow: none !important;
        break-inside: auto !important;
        margin-bottom: 8px !important;
        padding: 10px 14px !important;
        border-radius: 6px !important;
      }
      .box, .pillar-kpi, .diagram-card, .shot-card {
        background: #fff !important;
        color: #0f172a !important;
        border: 1px solid #cbd5e1 !important;
        box-shadow: none !important;
        break-inside: avoid !important;
        margin-bottom: 6px !important;
        padding: 8px 10px !important;
        border-radius: 6px !important;
      }
      p, .section-sub, .muted, .shot-card .cap, li, td, span, .desc, .feature-list li { color: #1e293b !important; font-size: 10.5px !important; }
      h1, h2, h3, .section-title, th, .pillar-kpi .val { color: #0f172a !important; }
      .hero h1 { font-size: 18px !important; margin-bottom: 4px !important; }
      .hero p { font-size: 11px !important; margin-bottom: 8px !important; }
      .hero-tag { font-size: 9.5px !important; padding: 2px 8px !important; margin-bottom: 6px !important; }
      .hero h1 span, .box h3, .shot-card .cap strong, .section-title { color: #b45309 !important; font-size: 12.5px !important; }
      .price-tag { color: #0f172a !important; font-size: 20px !important; font-weight: 900 !important; }
      .price-sub { color: #475569 !important; font-size: 11px !important; }
      th { background: #f8fafc !important; color: #0f172a !important; font-weight: 800 !important; border-bottom: 2px solid #94a3b8 !important; padding: 6px 8px !important; font-size: 10px !important; }
      td { border-bottom: 1px solid #e2e8f0 !important; color: #0f172a !important; padding: 6px 8px !important; font-size: 10.5px !important; }
      .badge-ok { background: #dcfce7 !important; color: #166534 !important; border: 1px solid #86efac !important; }
      .badge-info { background: #e0f2fe !important; color: #0369a1 !important; border: 1px solid #7dd3fc !important; }
      svg text { fill: #0f172a !important; }
      .shot-card img { height: 110px !important; object-fit: contain !important; background: #0b1120 !important; }
      .page-break { page-break-after: always !important; break-after: page !important; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="brand-pill">
      <span class="brand-badge">PROGYM 360°</span>
      <span>Propuesta del Proyecto para <strong id="topGymName" style="color:var(--gold)">TU GIMNASIO</strong></span>
    </div>
    <div class="customizer">
      <label for="gymInput">Personalizar Gimnasio:</label>
      <input id="gymInput" type="text" value="TU GIMNASIO" placeholder="Nombre del gimnasio..." oninput="syncGymName(this.value)" />
      <a class="btn" href="/anatomy-pro/index.html" target="_blank">🧬 Máquina 3D</a>
      <a class="btn" href="/display.html" target="_blank">📺 Módulo Pantalla</a>
      <button class="btn btn-gold" onclick="window.print()">🖨️ Descargar en PDF</button>
    </div>
  </header>

  <main class="container">
    <!-- PORTADA Y PRESENTACIÓN DEL PRODUCTO -->
    <section class="hero">
      <div class="hero-tag">Dossier de Presentación del Proyecto · Software & Hardware Integrado</div>
      <h1>Ecosistema Tecnológico Integral de Gestión, Control QR y Pantalla Interactiva para <span class="gym-name">TU GIMNASIO</span></h1>
      <p>
        Una solución integral desarrollada específicamente para la operación diaria de gimnasios: agiliza el acceso en recepción mediante escaneo QR instantáneo, brinda control estricto de caja por turnos, entrega una aplicación móvil para los socios y ofrece visualización interactiva adaptable a la pantalla o equipos que el local ya posea.
      </p>
      <div class="pillar-overview-grid">
        <div class="pillar-kpi">
          <div class="val">1. Panel de Gestión</div>
          <div class="desc">Administración total de socios, caja chica por turnos, POS tienda, boletas térmicas 80mm y modo local sin internet.</div>
        </div>
        <div class="pillar-kpi">
          <div class="val emerald">2. App Móvil del Socio</div>
          <div class="desc">Web App progresiva con carné QR offline, días restantes, historial de asistencia, rutinas guiadas y calculadora corporal.</div>
        </div>
        <div class="pillar-kpi">
          <div class="val cyan">3. Pantalla Recepción</div>
          <div class="desc">Display interactivo de bienvenida, alerta de vencimiento y QR gigante de Yape/Plin, adaptable a TV, Tablet o 2do monitor.</div>
        </div>
      </div>
    </section>

    <!-- DETALLE DE LOS 3 PILARES ACTUALES DEL PROYECTO -->
    <section class="section">
      <div class="section-title">📦 1. Los 3 Pilares Operativos Integrados en el Sistema</div>
      <div class="section-sub">
        Estructura funcional de los 3 módulos que componen la solución y cómo interactúan entre sí:
      </div>

      <div class="grid-3">
        <div class="box">
          <h3>Pilar 1: Panel Central de Control y Caja (Admin & Recepción)</h3>
          <ul class="feature-list">
            <li><strong>Gestión de Socios:</strong> Altas rápidas, renovación de planes, congelamiento temporal y búsqueda inmediata por DNI, nombre o código.</li>
            <li><strong>Caja Blindada por Turnos:</strong> Apertura con fondo inicial de sencillo, registro de ingresos/egresos y cuadre estricto de efectivo vs. digital (Yape / Plin / Transferencia).</li>
            <li><strong>Punto de Venta (POS Tienda):</strong> Venta ágil de bebidas, proteínas, pases diarios y cobro de planes con boleta automática.</li>
            <li><strong>Impresión Térmica 80mm:</strong> Renderizado de alta densidad en negro puro (<code>#000000</code>), código QR de comprobante y corte automático. Envío opcional a WhatsApp.</li>
            <li><strong>Modo Local PC Autónomo:</strong> Permite seguir atendiendo, cobrando y registrando asistencias en la computadora del gimnasio aun sin internet.</li>
          </ul>
        </div>

        <div class="box">
          <h3>Pilar 2: Web App Móvil para los Socios (PWA para Android & iOS)</h3>
          <ul class="feature-list">
            <li><strong>Carné Digital QR Inteligente:</strong> Abre en menos de 1 segundo en el celular del socio, incluso sin datos móviles (modo offline).</li>
            <li><strong>Semáforo de Vigencia:</strong> Indica visualmente el estado de su membresía y los días exactos que le quedan de entrenamiento.</li>
            <li><strong>Registro y Racha de Asistencias:</strong> Calendario mensual interactivo que motiva la constancia del socio mostrando los días asistidos.</li>
            <li><strong>Entrenador Virtual y Rutinas Visuales:</strong> Biblioteca de ejercicios por grupo muscular (Pecho, Espalda, Piernas, etc.) con temporizador de descanso entre series.</li>
            <li><strong>Calculadora Corporal & Récords (PR):</strong> Cálculo de IMC, tasa metabólica y registro de pesos máximos en ejercicios clave.</li>
          </ul>
        </div>

        <div class="box">
          <h3>Pilar 3: Pantalla Interactiva de Recepción (Display Cliente)</h3>
          <ul class="feature-list">
            <li><strong>Bienvenida Automática (5.5 seg):</strong> Al escanear el QR, muestra en pantalla la foto, nombre del socio, plan activo y días restantes con sonido confirmatorio.</li>
            <li><strong>Alerta Roja de Membresía Vencida:</strong> Notifica de forma inmediata y clara si el socio requiere renovar su plan antes de ingresar.</li>
            <li><strong>Proyección de Cobro Yape / Plin:</strong> Al cobrar en caja, despliega el monto exacto y el código QR oficial de Yape/Plin en grande para que el cliente escanee cómodamente.</li>
            <li><strong>Spots Publicitarios Programados:</strong> Emite anuncios rotativos configurables sobre promociones, suplementos o avisos del gimnasio.</li>
            <li><strong>100% Adaptable:</strong> Funciona en Smart TV, Tablet, monitor secundario extendido o directamente en el monitor de caja.</li>
          </ul>
        </div>
      </div>
    </section>

    <div class="page-break"></div>

    <!-- PÁGINA 2: MÓDULO OPCIONAL WEB PÚBLICA Y ADAPTABILIDAD DE EQUIPOS -->
    <section class="section">
      <div class="section-title">🌐 2. Módulo de Expansión Futura: Sitio Web Público Oficial del Gimnasio</div>
      <div class="section-sub">
        Aclaración sobre el alcance actual y la posibilidad de incorporar una página web corporativa en internet:
      </div>

      <div class="grid-2">
        <div class="box">
          <h3>¿Por qué el sistema actual se enfoca en la gestión interna?</h3>
          <p style="font-size:13px;color:#cbd5e1;margin-bottom:12px">
            El núcleo del proyecto actual está diseñado para resolver la <strong>operación diaria dentro del gimnasio</strong>: control de accesos por QR, auditoría de caja, impresión de boletas y la app móvil de los socios ya inscritos.
          </p>
          <p style="font-size:13px;color:#cbd5e1">
            Una web pública tiene como objetivo captar clientes nuevos en internet (Google, redes sociales). Por ello, se ofrece como un <strong>módulo de expansión digital opcional</strong> que puede ser desarrollado e implementado a medida del cliente.
          </p>
        </div>

        <div class="box">
          <h3>¿Qué incluiría el Sitio Web Público Corporativo si se implementa?</h3>
          <ul class="feature-list">
            <li><strong>Landing Page Corporativa:</strong> Diseño profesional con la historia, identidad y logotipo del gimnasio.</li>
            <li><strong>Ubicación y Horarios:</strong> Mapa interactivo de Google Maps, dirección exacta y horarios por turnos.</li>
            <li><strong>Catálogo de Planes y Tarifas:</strong> Detalle de membresías (diarias, mensuales, trimestrales, anuales) y promociones vigentes.</li>
            <li><strong>Galería de Instalaciones y Máquinas:</strong> Fotografías de alta calidad de las áreas de pesas, cardio y servicios.</li>
            <li><strong>Contacto Directo a WhatsApp:</strong> Botón flotante para que prospectos consulten o se inscriban con un clic.</li>
            <li><strong>Requisitos Técnicos:</strong> Requiere la adquisición de un dominio web propio (ej. <code>www.tugimnasio.pe</code> o <code>.com</code>) y servicio de hosting anual, lo cual se cotiza por separado.</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- ADAPTABILIDAD TOTAL DE EQUIPAMIENTO -->
    <section class="section">
      <div class="section-title">🖥️ 3. Adaptabilidad de Hardware: Trabajamos con lo que Tienes o lo Implementamos de Cero</div>
      <div class="section-sub">
        No exigimos comprar equipos costosos. El sistema se adapta a la infraestructura física existente de cada gimnasio:
      </div>

      <table>
        <thead>
          <tr>
            <th>Escenario de Uso</th>
            <th>Equipamiento Físico Utilizado</th>
            <th>Modo de Funcionamiento</th>
            <th>Inversión en Equipos</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Opción A: Pantalla Única (Cero Hardware Extra)</strong></td>
            <td>Laptop o PC actual del gimnasio</td>
            <td>El recepcionista atiende todo desde el Panel Admin en una sola pantalla. La confirmación de acceso QR y cobro se muestra directamente en el panel.</td>
            <td><span class="badge-ok">S/ 0 (Usa lo que ya tiene)</span></td>
          </tr>
          <tr>
            <td><strong>Opción B: Recepción con Tablet en Mostrador</strong></td>
            <td>Laptop de caja + Tablet Android/iPad sobre el mostrador</td>
            <td>La tablet muestra el módulo Display mirando hacia el socio (bienvenida QR, alertas y QR de Yape para pagar). Se conecta por red local Wi-Fi.</td>
            <td><span class="badge-info">Usa tablet existente o económica</span></td>
          </tr>
          <tr>
            <td><strong>Opción C: Doble Monitor en Recepción</strong></td>
            <td>PC con 2 salidas de video + 2do monitor para clientes</td>
            <td>El cajero opera en su monitor principal y el segundo monitor muestra la pantalla de clientes con bienvenida interactiva.</td>
            <td><span class="badge-info">Monitor HDMI estándar</span></td>
          </tr>
          <tr>
            <td><strong>Opción D: Smart TV en Sala (con o sin Cámaras CCTV)</strong></td>
            <td>Smart TV en pared + Enlace HDMI (o capturadora si hay DVR)</td>
            <td>Si el gimnasio tiene cámaras de seguridad conectadas a la TV, el sistema activa el modo <strong>Picture-in-Picture (PiP)</strong> para mostrar las cámaras el 90% del tiempo y superponer bienvenidas QR y anuncios en momentos clave. Si no tiene cámaras, funciona como pantalla de bienvenida y publicidad continua.</td>
            <td><span class="badge-info">Aprovecha la TV que tenga el local</span></td>
          </tr>
        </tbody>
      </table>
    </section>

    <div class="page-break"></div>

    <!-- PÁGINA 3: OPERACIÓN LOCAL EN LA PC DEL DUEÑO (OFFLINE-FIRST) Y EQUIPOS RECOMENDADOS -->
    <section class="section">
      <div class="section-title">⚡ 4. Fiabilidad Operativa: ¿Cómo Funciona el Modo Local en la PC del Dueño?</div>
      <div class="section-sub">
        Arquitectura de contingencia diseñada para que el gimnasio no se detenga si se corta el internet o la energía del router:
      </div>

      <!-- DIAGRAMA DE ARQUITECTURA OFFLINE-FIRST -->
      <div class="diagram-card">
        <svg viewBox="0 0 740 160" width="100%" height="160" style="display:block">
          <!-- Bloque 1 -->
          <rect x="15" y="20" width="210" height="120" rx="10" fill="#ecfdf5" stroke="#059669" stroke-width="2"/>
          <text x="120" y="44" fill="#065f46" font-size="12" font-weight="900" text-anchor="middle">1. OPERACIÓN EN LÍNEA</text>
          <text x="120" y="66" fill="#0f172a" font-size="11" font-weight="800" text-anchor="middle">Nube + Espejo Local</text>
          <text x="120" y="88" fill="#334155" font-size="10" text-anchor="middle">Cada venta y asistencia se guarda</text>
          <text x="120" y="103" fill="#334155" font-size="10" text-anchor="middle">en la nube y replica una copia</text>
          <text x="120" y="118" fill="#065f46" font-size="10" font-weight="800" text-anchor="middle">en la memoria de tu PC (&lt;1 ms)</text>

          <!-- Flecha 1 -->
          <path d="M 230 80 L 260 80" stroke="#d97706" stroke-width="3" stroke-dasharray="4,4"/>
          <polygon points="265,80 257,75 257,85" fill="#d97706"/>
          <text x="247" y="70" fill="#b45309" font-size="9" font-weight="800" text-anchor="middle">Si no hay red</text>

          <!-- Bloque 2 -->
          <rect x="270" y="20" width="220" height="120" rx="10" fill="#fffbeb" stroke="#d97706" stroke-width="2"/>
          <text x="380" y="44" fill="#92400e" font-size="12" font-weight="900" text-anchor="middle">2. MODO LOCAL PC</text>
          <text x="380" y="66" fill="#0f172a" font-size="11" font-weight="800" text-anchor="middle">Contingencia Automática</text>
          <text x="380" y="88" fill="#334155" font-size="10" text-anchor="middle">El escáner QR valida en 0.1s,</text>
          <text x="380" y="103" fill="#334155" font-size="10" text-anchor="middle">se imprimen boletas y se guarda</text>
          <text x="380" y="118" fill="#92400e" font-size="10" font-weight="800" text-anchor="middle">en la Cola de Memoria Local</text>

          <!-- Flecha 2 -->
          <path d="M 495 80 L 525 80" stroke="#2563eb" stroke-width="3"/>
          <polygon points="530,80 522,75 522,85" fill="#2563eb"/>
          <text x="512" y="70" fill="#1d4ed8" font-size="9" font-weight="800" text-anchor="middle">Al volver red</text>

          <!-- Bloque 3 -->
          <rect x="535" y="20" width="190" height="120" rx="10" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/>
          <text x="630" y="44" fill="#1e40af" font-size="12" font-weight="900" text-anchor="middle">3. AUTO-SINCRONIZACIÓN</text>
          <text x="630" y="66" fill="#0f172a" font-size="11" font-weight="800" text-anchor="middle">1 Clic o Automático</text>
          <text x="630" y="88" fill="#334155" font-size="10" text-anchor="middle">Las transacciones locales suben</text>
          <text x="630" y="103" fill="#334155" font-size="10" text-anchor="middle">a la nube sin duplicados y se</text>
          <text x="630" y="118" fill="#1e40af" font-size="10" font-weight="800" text-anchor="middle">actualizan en tu celular</text>
        </svg>
      </div>

      <div class="grid-3" style="margin-top:16px">
        <div class="box">
          <h3>Botón de Activación en el Panel</h3>
          <p style="font-size:12px;color:#cbd5e1">
            En la barra superior del Panel Admin existe el botón <strong>⚡ Modo Local PC</strong>. Permite forzar el modo desconectado para realizar pruebas o trabajar sin depender de la señal de internet.
          </p>
        </div>
        <div class="box">
          <h3>Indicador y Contador en Vivo</h3>
          <p style="font-size:12px;color:#cbd5e1">
            Un semáforo avisa: <code>⚡ MODO LOCAL ACTIVO · X operaciones guardadas</code>. Cada venta o registro muestra una confirmación con hora exacta, indicando que quedó grabado en la PC local.
          </p>
        </div>
        <div class="box">
          <h3>Instalador Autónomo (.BAT)</h3>
          <p style="font-size:12px;color:#cbd5e1">
            Se proporciona un archivo ejecutable para Windows (<code>Instalar_Sistema_Local_PC.bat</code>) que permite iniciar el sistema localmente con un doble clic en el escritorio.
          </p>
        </div>
      </div>
    </section>

    <!-- GALERÍA DE EQUIPOS FÍSICOS RECOMENDADOS -->
    <section class="section">
      <div class="section-title">📷 5. Especificaciones de Equipos Físicos Recomendados (Opcional)</div>
      <div class="section-sub">
        Si el gimnasio desea implementar equipos dedicados nuevos, recomendamos estos modelos probados por su durabilidad y rapidez:
      </div>

      <div class="shot-grid">
        <div class="shot-card">
          <img src="${imgScanner}" alt="Lector Óptico QR 2D" />
          <div class="cap">
            <strong>Lector Óptico 2D Manos Libres (Netum NT-2050M o Honeywell HF680)</strong>
            Sensor CMOS de 60 cuadros por segundo con lente antirreflejo. Lee códigos QR en pantallas de celular (incluso con brillo bajo o mica rajada) en 0.1 segundos sin presionar botones.
          </div>
        </div>
        <div class="shot-card">
          <img src="${imgPrinter}" alt="Impresora Térmica 80mm" />
          <div class="cap">
            <strong>Ticketera Térmica 80mm con Autocorte (Xprinter XP-N160II o Epson TM-T20III)</strong>
            Cabezal térmico japonés de 203 DPI y corte automático. Imprime boletas en negro puro (#000000) con código QR nítido que no se borra, usando papel estándar de 80mm.
          </div>
        </div>
        <div class="shot-card">
          <img src="${imgMiniPc}" alt="Mini PC de Recepción" />
          <div class="cap">
            <strong>Mini PC Compacta de Bajo Consumo (Intel N100 / Core i5, 16GB RAM, SSD NVMe)</strong>
            Chasis compacto y silencioso con doble salida HDMI (para monitor de caja y pantalla externa), arranque en 8 segundos y consumo eléctrico mínimo (15W).
          </div>
        </div>
      </div>
    </section>

    <div class="page-break"></div>

    <!-- PÁGINA 4: PLANES DE CONTRATACIÓN Y SERVICIOS -->
    <section class="section">
      <div class="section-title">💼 6. Modalidades de Contratación del Software y Servicios</div>
      <div class="section-sub">
        Opciones claras y transparentes para que el propietario elija la modalidad que mejor se adapte a su presupuesto:
      </div>

      <div class="grid-3">
        <div class="box" style="border-color:var(--gold)">
          <span class="badge-ok" style="margin-bottom:8px;display:inline-block">⭐ MODALIDAD RECOMENDADA</span>
          <h3>Plan 1: Socio Tecnológico Mensual</h3>
          <div class="price-tag" style="margin:4px 0">S/ 89 <span class="price-sub">/ mes</span></div>
          <div style="font-size:12px;color:var(--gold);margin-bottom:12px">+ S/ 290 de instalación, configuración y capacitación inicial</div>
          <ul class="feature-list">
            <li>Sistema completo: Panel Admin, Caja por turnos, Display de pantalla y Web App de socios.</li>
            <li>Bóveda en la nube 24/7 para supervisar asistencias y caja desde el celular del dueño.</li>
            <li>Soporte técnico continuo, resolución de dudas y actualizaciones del sistema.</li>
            <li>Sin permanencia forzosa.</li>
          </ul>
        </div>

        <div class="box" style="border-color:var(--emerald)">
          <span class="badge-ok" style="margin-bottom:8px;display:inline-block">🔥 AHORRO DE 2 MESES</span>
          <h3>Plan 2: Socio Tecnológico Anual</h3>
          <div class="price-tag" style="margin:4px 0;color:var(--emerald)">S/ 890 <span class="price-sub">/ año</span></div>
          <div style="font-size:12px;color:var(--emerald);margin-bottom:12px">+ S/ 190 de instalación (Equivale a solo S/ 74 al mes)</div>
          <ul class="feature-list">
            <li>Todo lo incluido en el Plan Mensual con descuento directo.</li>
            <li>Respaldo continuo en la nube, Google Sheets contable y envío de boletas por WhatsApp.</li>
            <li>Mantenimiento preventivo programado y soporte prioritario.</li>
          </ul>
        </div>

        <div class="box" style="border-color:var(--cyan)">
          <span class="badge-ok" style="margin-bottom:8px;display:inline-block">🏆 PROPIEDAD TOTAL</span>
          <h3>Plan 3: Licencia Vitalicia en Local</h3>
          <div class="price-tag" style="margin:4px 0;color:var(--cyan)">S/ 1,450</div>
          <div style="font-size:12px;color:var(--cyan);margin-bottom:12px">Pago único definitivo por el software instalado en el local</div>
          <ul class="feature-list">
            <li>Software instalado de por vida en la computadora del gimnasio.</li>
            <li>Cero mensualidades obligatorias para la operación local.</li>
            <li>Incluye instalador local .BAT, base de datos local y 6 meses de garantía técnica.</li>
            <li>Servicio opcional de nube para ver caja desde celular por S/ 50/mes.</li>
          </ul>
        </div>
      </div>

      <div class="diagram-card" style="margin-top:20px">
        <div style="font-weight:800;font-size:14px;color:var(--gold);margin-bottom:8px">Servicio de Instalación y Puesta en Marcha con Equipos Propios del Gimnasio:</div>
        <p style="font-size:13px;color:#cbd5e1">
          Si el propietario ya cuenta con su propia computadora, laptop, pantalla o ticketera, <strong>no necesita comprar equipos adicionales</strong>. Nosotros realizamos la instalación del software, la configuración del modo local y la red, la carga inicial de socios y la capacitación del personal por una tarifa única de <strong>S/ 250 a S/ 290</strong> según la modalidad elegida.
        </p>
      </div>
    </section>

    <!-- RESUMEN FINAL Y BOTÓN DE IMPRESIÓN -->
    <section class="section" style="background:linear-gradient(135deg, rgba(245,180,0,0.06), rgba(16,185,129,0.06));border-color:rgba(245,180,0,0.3)">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px">
        <div>
          <div style="font-size:17px;font-weight:900;color:#fff">Resumen del Compromiso Técnico y Entrega</div>
          <div style="font-size:13px;color:#cbd5e1;margin-top:3px;max-width:750px">
            El sistema se entrega 100% personalizado con el nombre, colores institucionales y tarifas de <strong class="gym-name">TU GIMNASIO</strong>, con garantía de funcionamiento continuo tanto en línea como en modo local sin internet.
          </div>
        </div>
        <button class="btn btn-gold" onclick="window.print()" style="font-size:13.5px;padding:9px 18px">🖨️ Imprimir / Guardar en PDF</button>
      </div>
    </section>
  </main>

  <script>
    function syncGymName(val) {
      const clean = (val || '').trim() || 'TU GIMNASIO';
      document.getElementById('topGymName').textContent = clean;
      document.querySelectorAll('.gym-name').forEach(el => { el.textContent = clean; });
    }
  </script>
</body>
</html>
`;

fs.writeFileSync(htmlOut, htmlContent, 'utf8');
console.log('✅ Wrote clean propuesta.html');

// Generate PDF using Edge
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const r = spawnSync(edge, [
  '--headless=new',
  '--disable-gpu',
  '--no-pdf-header-footer',
  '--print-to-pdf=' + pdfOut,
  'http://localhost:3000/propuesta.html'
], { encoding: 'utf8' });

console.log('Edge PDF Status:', r.status);
if (fs.existsSync(pdfOut)) {
  fs.copyFileSync(pdfOut, brainPdf);
  console.log('✅ Generated PDF and copied to brain:', fs.statSync(pdfOut).size, 'bytes');
} else {
  console.error('❌ PDF not found at', pdfOut);
}
