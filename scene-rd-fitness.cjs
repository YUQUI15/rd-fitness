/* Anatomy3D v2.0 — RD Fitness Club (Chivay)
 * Arquitectura Física y Lógica: Recepción Cero Fallas, Escáner QR 2D, Impresora Térmica Negro Puro,
 * DVR CCTV + Smart TV Dual (Cámaras 24/7 + PiP + Alertas QR/Yape + Spot Publicitario Rotativo) y Bóveda Cloud. */
module.exports = function () {
  const P = Anatomy3D.presets;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const XS = [-115, -30, 55];
  const Y_FRONT = -52, Y_BACK = 14;

  const unit = (id, col, row, o) =>
    P.rack1U(Object.assign({ id, at: [XS[col], row === 0 ? Y_FRONT : Y_BACK], size: [60, 38, 16] }, o));

  return {
    fig: 'FIG 01 • ARQUITECTURA INTEGRAL RD FITNESS CLUB (RECEPCIÓN + SMART TV CCTV DUAL + NUBE)',
    title: 'RD Fitness Club: Escáner QR 2D ➔ Mini PC ➔ Impresora Térmica 80mm + Smart TV CCTV PiP ➔ Cloud Vault',
    subtitle: 'Anatomía 3D interactiva del ecosistema físico y digital: acceso QR en 0.1s, boletas negro puro y TV de cámaras con alertas y publicidad rotativa',
    worldSpan: 340,
    defaultDevice: 'minipc',
    camera: { az: -0.95, el: 0.52, zoom: 1.02, target: [0, 0, 8] },
    banners: [
      { pos: [0, -82, 0], text: 'FILA RECEPCIÓN • ESCÁNER 2D + MINI PC + IMPRESORA TÉRMICA 80MM', color: '#f5b400' },
      { pos: [0, 66, 0], text: 'FILA VISUALIZACIÓN Y NUBE • DVR CCTV + SMART TV PiP + UPSTASH REDIS', color: '#27e6ff' },
    ],
    state: { checkinsPerHour: 85, promoIntervalMin: 3, printDensity: 100 },
    audit: { minInternals: 5, states: [{ checkinsPerHour: 40 }, { checkinsPerHour: 180 }] },

    controls: [
      { key: 'checkinsPerHour', label: 'Flujo de socios (ingresos QR/hora)', min: 10, max: 240, step: 5, fmt: (v) => v + ' socios/h' },
      { key: 'promoIntervalMin', label: 'Rotación de Spot Publicitario en TV', min: 1, max: 10, step: 1, fmt: (v) => 'Cada ' + v + ' min' },
      { key: 'printDensity', label: 'Densidad térmica de boleta (#000000)', min: 80, max: 100, step: 5, fmt: (v) => v + '% Negro Puro' },
    ],
    tick(state) {
      const scanMs = Math.round(95 + (state.checkinsPerHour / 240) * 25);
      const tvCctvPct = Math.round(clamp(100 - (16 / (state.promoIntervalMin * 60)) * 100 - (state.checkinsPerHour * 5.5 / 3600) * 100, 65, 98));
      const act = clamp(state.checkinsPerHour / 180, 0.2, 1);
      state.__cableAct = {
        c_scan_pc: act,
        c_pc_print: act * 0.85,
        c_pc_tv: act,
        c_dvr_pc: 0.9,
        c_dvr_tv: 0.95,
        c_pc_cloud: act * 0.8,
      };
      return { scanMs, tvCctvPct };
    },
    kpis(state, t) {
      return [
        { label: 'Lectura QR 2D', value: t.scanMs + ' ms', tone: t.scanMs <= 130 ? 'good' : 'warn' },
        { label: 'Contraste Boleta', value: state.printDensity + '% #000', tone: state.printDensity >= 95 ? 'good' : 'warn' },
        { label: 'TV en Modo CCTV', value: t.tvCctvPct + '% tiempo', tone: 'good' },
        { label: 'Bóveda Cloud + Local', value: '100% Sync', tone: 'good' },
      ];
    },
    readout: (s, t) => `SCAN ${t.scanMs}ms | BOLETA ${s.printDensity}% NEGRO | CCTV ${t.tvCctvPct}% + PiP | SPOT CADA ${s.promoIntervalMin}m`,

    ground: P.deck('rack', -138, -72, 276, 144),
    links: {
      member_qr: {
        from: null,
        to: 'scanner',
        label: 'Celular / Carné QR del Socio',
        fresnel: false,
        color: 'rgba(245,180,0,0.75)',
        pulseColor: '#f5b400',
        pulses: 4,
        path: () => [[-162, -33, 22], [-115, -33, 6]],
      },
    },

    devices: [
      unit('scanner', 0, 0, {
        body: 'graphite',
        short: '1. Escáner QR 2D (Honeywell HF680)',
        label: 'Lector Óptico 2D Imager Omnidireccional (Honeywell Orbit HF680 / Netum NT-2050M)',
        desc: 'Escáner de presentación manos libres con sensor CMOS megapíxel e iluminación antirreflejo. Lee códigos QR desde pantallas de celulares con brillo mínimo, micas rajadas o carnés plastificados en 0.1 segundos sin frustrar al socio.',
        specs: {
          Modelos: 'Honeywell Orbit HF680 / Zebra DS9308 / Netum NT-2050M',
          Sensor: 'CMOS 1280×800 Megapíxel (60 fps)',
          Tolerancia: 'Pantallas con 15% brillo, vidrio templado y QR densos',
          Interfaz: 'USB-HID Plug & Play (emulación de teclado instantánea)',
        },
        ports: [
          { id: 'qr_in', label: 'Ventana Óptica 2D', face: 'left', u: 0.5 },
          { id: 'usb_out', label: 'Salida USB-HID a Mini PC', face: 'right', u: 0.5 },
        ],
        parts: {
          nic: { label: 'Sensor Óptico CMOS 60fps', desc: 'Captura 60 cuadros por segundo a través del lente gran angular con filtro antirreflejo para pantallas OLED/LCD.', m: 'ledC' },
          cpu: { label: 'ASIC Decodificador 2D QR', desc: 'Reconstruye el código QR con corrección Reed-Solomon incluso si la pantalla del celular está manchada o agrietada.', m: 'copper' },
          ram: { label: 'Buffer de Tramas y Debounce', desc: 'Almacena la cadena `RDFIT:SOCIO` y aplica bloqueo de rebote para evitar lecturas duplicadas accidentales.', m: 'pcbblue' },
          psu: { label: 'Regulador 5V USB + Iluminación LED', desc: 'Alimenta la matriz de LEDs blancos cálidos sin parpadeo y el timbre piezoeléctrico de confirmación.', m: 'graphite' },
          storage: { label: 'Firmware HID + Sufijo Enter', desc: 'Memoria flash con el mapa de teclado español y envío automático de tecla ENTER al terminar el escaneo.', m: 'chip' },
        },
        stages: [
          { comp: 'nic', name: '1. Captura Óptica Antirreflejo', desc: 'El sensor CMOS captura el QR desde la pantalla del celular o carné sin deslumbramiento.' },
          { comp: 'cpu', name: '2. Decodificación Reed-Solomon', desc: 'El chip ASIC extrae el token `RDFIT:Mxxxx` en menos de 100 milisegundos.' },
          { comp: 'ram', name: '3. Emisión USB-HID + Beep Verde', desc: 'Envía la ráfaga USB-HID con sufijo ENTER hacia la Mini PC y emite el pitido de lectura exitosa.' },
        ],
      }),

      unit('minipc', 1, 0, {
        body: 'dark',
        short: '2. Mini PC Recepción (Core i5 / N100)',
        label: 'Estación Central de Recepción (Beelink Mini S12 Pro N100 / Core i5 16GB SSD Dual-HDMI)',
        desc: 'Cerebro operativo del gimnasio. Ejecuta el servidor Express/Node.js, valida membresías en tiempo real, envía alertas SSE a la Smart TV de cámaras, dispara la impresión térmica en negro puro y sincroniza la bóveda local con Upstash Redis.',
        specs: {
          Hardware: 'Beelink Mini S12 Pro (Intel N100) o Mini PC Core i5, 16GB RAM, 512GB NVMe',
          Video: 'Doble salida HDMI 4K@60Hz (Monitor Recepción + Smart TV Gimnasio)',
          Resiliencia: 'Arquitectura Híbrida Offline-First (JSON Local + Upstash Redis)',
          Seguridad: 'Cifrado AES-256-GCM + Sesiones HMAC-SHA256 + Rate Limit',
        },
        ports: [
          { id: 'usb_scan', label: 'Entrada USB Escáner 2D', face: 'left', u: 0.5 },
          { id: 'usb_print', label: 'Salida USB Impresora Térmica', face: 'right', u: 0.5 },
          { id: 'usb_cap', label: 'Entrada USB 3.0 Capturadora DVR', face: 'back', u: 0.25 },
          { id: 'hdmi_tv', label: 'Salida HDMI 2 hacia Smart TV', face: 'back', u: 0.50 },
          { id: 'wan_cloud', label: 'Uplink HTTPS hacia Upstash Cloud', face: 'back', u: 0.75 },
        ],
        parts: {
          nic: { label: 'Controladora USB 3.2 + Dual HDMI + GbE', desc: 'Recibe la ráfaga del lector QR, el stream UVC de la capturadora del DVR y transmite video 1080p a la TV.', m: 'gold' },
          cpu: { label: 'Procesador Intel Core i5 / N100 (Node.js)', desc: 'Ejecuta `server.js`: verifica vigencia de membresía, calcula arqueo de caja y coordina el bus SSE (`/api/screen/stream`).', m: 'copper' },
          ram: { label: 'RAM 16GB (Estado de Socios + SSE)', desc: 'Mantiene en memoria el padrón de socios, tokens de sesión y colas de eventos en tiempo real.', m: 'pcbblue' },
          storage: { label: 'SSD NVMe 512GB (`gym.json` + Backups)', desc: 'Guarda la base de datos local transaccional y las copias de seguridad cifradas AES-256.', m: 'chip' },
          psu: { label: ' Etapa VRM de Bajo Consumo (25W)', desc: 'Regulación térmica silenciosa para operación continua de 6:00 AM a 10:00 PM.', m: 'graphite' },
        },
        stages: [
          { comp: 'nic', name: '1. Recepción USB-HID / Captura DVR', desc: 'Recibe el código QR del socio o la orden de cobro Yape/Plin desde recepción.' },
          { comp: 'cpu', name: '2. Validación de Membresía y Caja', desc: 'Verifica fecha de vencimiento (`endDate`), registra asistencia y emite evento SSE hacia la TV.' },
          { comp: 'ram', name: '3. Renderizado de Ticket #000000', desc: 'Genera el comprobante térmico monocromático 100% negro puro sin escalas de grises.' },
          { comp: 'storage', name: '4. Persistencia Dual (NVMe + Cloud)', desc: 'Guarda en disco local instantáneamente y replica hacia Upstash Redis en segundo plano.' },
        ],
      }),

      unit('printer', 2, 0, {
        body: 'offwhite',
        short: '3. Impresora Térmica 80mm (Alta Densidad)',
        label: 'Impresora Térmica de Boletas 80mm con Autocorte (Xprinter XP-N160II / Epson TM-T20III)',
        desc: 'Impresora térmica directa configurada en modo monocromático de máxima densidadoscura (#000000 puro, sin tramado gris). Con papel térmico Hansol de 65g entrega boletas nítidas, intensas y legibles al instante.',
        specs: {
          Modelos: 'Xprinter XP-N160II (Calidad/Precio) o Epson TM-T20III (Industrial)',
          Cabezal: 'Rohm Japonés 203 DPI • Velocidad 200 mm/s • Vida útil 150 km',
          Papel: 'Rollo Térmico 80mm × 80m Gramaje 65g Capa Negra Intensa (Bisfenol-Free)',
          EstilosCSS: 'Forzado `#000000 !important`, `font-weight: 800/900`, `contrast(200%)`',
        },
        ports: [
          { id: 'usb_in', label: 'Entrada USB Impresión ESC/POS', face: 'left', u: 0.5 },
        ],
        parts: {
          nic: { label: 'Interfaz USB ESC/POS + Buffer 64KB', desc: 'Recibe el mapa de bits monocromático desde la Mini PC sin pérdida de paquetes.', m: 'gold' },
          cpu: { label: 'Cabezal Térmico Rohm 203 DPI', desc: 'Aplica pulso térmico al 100% de densidad para quemar el papel térmico con negro sólido e intenso.', m: 'copper' },
          ram: { label: 'Motor Paso a Paso + Rodillo Siliconado', desc: 'Tracciona el rollo de 80mm a 200 mm/s con presión uniforme para evitar letras borrosas o pálidas.', m: 'pcbblue' },
          storage: { label: 'Guillotina Automática de Acero', desc: 'Realiza el corte parcial limpio del comprobante al finalizar la impresión del código QR del socio.', m: 'steel' },
          psu: { label: 'Fuente 24V 2.5A Estabilizada', desc: 'Garantiza corriente pico constante para que el cabezal nunca imprima tenue cuando hay textos densos.', m: 'graphite' },
        },
        stages: [
          { comp: 'nic', name: '1. Recepción Raster Monocromático', desc: 'Recibe la boleta renderizada con CSS `#000000 !important` y QR de bordes nítidos (`crispEdges`).' },
          { comp: 'cpu', name: '2. Termo-Impresión a Densidad Máxima', desc: 'El cabezal térmico quema el papel de 65g a máxima temperatura para lograr letras negras intensas.' },
          { comp: 'storage', name: '3. Autocorte y Entrega de Boleta', desc: 'La guillotina corta el ticket listo para entregar al socio con su código QR nítido.' },
        ],
      }),

      unit('dvr', 0, 1, {
        body: 'plate2',
        short: '4. DVR CCTV 4CH + Capturadora USB',
        label: 'Grabador DVR/NVR de Cámaras de Seguridad + Capturadora HDMI-USB 1080p',
        desc: 'Centraliza las 4 cámaras de seguridad del gimnasio (Ingreso, Zona Pesas, Zona Cardio y Recepción). Mediante un Splitter HDMI o Capturadora HDMI-a-USB 3.0 inyecta el video en vivo dentro de `/display.html` para que la TV nunca pierda las cámaras.',
        specs: {
          Canales: '4 Cámaras Full HD 1080p (Ingreso, Musculación, Cardio, Caja)',
          Integración: 'Capturadora Video HDMI a USB 3.0 UVC 1080p60 (S/ 45) o Stream RTSP/MJPEG',
          Grabación: 'Disco Duro WD Purple Surveillance 24/7 H.265+',
          Conmutación: 'Cero pérdida de grabación durante alertas QR o spots publicitarios',
        },
        ports: [
          { id: 'cap_out', label: 'Salida Capturadora HDMI-USB a Mini PC', face: 'front', u: 0.5 },
          { id: 'hdmi_direct', label: 'Bus de Video CCTV hacia Smart TV', face: 'right', u: 0.5 },
        ],
        parts: {
          nic: { label: 'Entradas Coaxiales / PoE 4 Cámaras', desc: 'Recibe la señal en vivo de las 4 cámaras estratégicas del gimnasio.', m: 'gold' },
          cpu: { label: 'SoC Codificador H.265+ Multi-Vista', desc: 'Combina las 4 cámaras en la cuadrícula 2×2 con marca de tiempo REC en tiempo real.', m: 'copper' },
          ram: { label: 'Capturadora HDMI-a-USB 3.0 (UVC)', desc: 'Convierte la salida HDMI del DVR en una fuente de cámara USB estándar (`getUserMedia`) para la Mini PC.', m: 'ledG' },
          storage: { label: 'Disco WD Purple Vigilancia 24/7', desc: 'Graba de forma ininterrumpida las 24 horas aunque la TV esté mostrando una bienvenida o un spot.', m: 'chip' },
          psu: { label: 'Fuente 12V Dedicada CCTV', desc: 'Alimentación continua para el grabador y las cámaras infrarrojas.', m: 'graphite' },
        },
        stages: [
          { comp: 'nic', name: '1. Ingesta de 4 Cámaras CCTV', desc: 'Recibe el video continuo de Puerta Principal, Zona de Pesas, Cardio y Recepción.' },
          { comp: 'cpu', name: '2. Composición Cuadrícula 2×2 + Grabación', desc: 'Guarda el flujo H.265+ en disco y genera la vista cuádruple 1080p.' },
          { comp: 'ram', name: '3. Inyección HDMI-USB a `/display.html`', desc: 'Entrega el video en vivo al navegador de la Mini PC para mostrarlo a pantalla completa o en PiP.' },
        ],
      }),

      unit('tv', 1, 1, {
        body: 'black',
        short: '5. Smart TV 55" (CCTV + PiP + Alertas)',
        label: 'Smart TV del Gimnasio: Monitor CCTV 24/7 + PiP Automático + Alertas QR/Yape + Publicidad Rotativa',
        desc: 'Reemplaza por completo la necesidad de comprar una Tablet adicional. Muestra las cámaras de seguridad a pantalla completa el 90% del tiempo y, cuando un socio pasa su QR o realiza un Yape, encoge las cámaras a una esquina Picture-in-Picture (PiP) por 5.5s para mostrar la bienvenida o el QR de pago. Además, cada X minutos lanza un Spot Publicitario del gimnasio por 16s.',
        specs: {
          ModoBase: 'Cámaras de Seguridad CCTV 4 Canales a Pantalla Completa (90% del tiempo)',
          InterrupcionQR: 'Prioridad Alta (5.5s): Bienvenida Socio, Salida o Alerta Roja de Vencimiento + Audio',
          ModoYape: 'Prioridad Alta: Muestra QR Yape/Plin gigante con monto exacto y confirma el pago',
          ModoSpot: 'Rotación Programada (cada 3 min por 16s): Planes, Tarifas y App Entrenador con CCTV en PiP',
        },
        ports: [
          { id: 'from_dvr', label: 'Entrada Video Cámaras CCTV', face: 'left', u: 0.5 },
          { id: 'from_pc', label: 'Entrada HDMI desde Mini PC (/display.html)', face: 'front', u: 0.5 },
        ],
        parts: {
          nic: { label: 'Receptor HDMI 2.0 + Cliente SSE', desc: 'Recibe la señal de `/display.html` con reconexión automática ante cualquier microcorte.', m: 'gold' },
          cpu: { label: 'Conmutador Inteligente de Escena (TV Mode)', desc: 'Alterna sin parpadeos entre Vista Completa CCTV, Alerta Prioritaria QR/Yape y Spot Publicitario.', m: 'copper' },
          ram: { label: 'Motor Picture-in-Picture (PiP Flotante)', desc: 'Mantiene las 4 cámaras visibles en la esquina inferior derecha mientras se proyecta una alerta o publicidad.', m: 'ledC' },
          storage: { label: 'Programador de Spots Publicitarios', desc: 'Temporizador configurable (cada 2, 3, 5 o 10 min) que exhibe planes y promociones de RD Fitness Club.', m: 'pcbblue' },
          psu: { label: 'Sintetizador de Voz y Campanilla WebAudio', desc: 'Emite el sonido de acceso concedido, alerta de membresía vencida o confirmación de Yape.', m: 'graphite' },
        },
        stages: [
          { comp: 'nic', name: '1. Recepción de Video CCTV + Eventos SSE', desc: 'Mantiene en pantalla las 4 cámaras del gimnasio y escucha eventos en `/api/screen/stream`.' },
          { comp: 'ram', name: '2. Transición Suave a Picture-in-Picture (PiP)', desc: 'Al detectar un escaneo QR, cobro Yape o turno publicitario, reduce las cámaras al recuadro PiP.' },
          { comp: 'cpu', name: '3. Proyección de Bienvenida / Yape / Spot', desc: 'Muestra el nombre del socio y días restantes (5.5s) o el Spot Publicitario (16s) y luego restaura las cámaras.' },
        ],
      }),

      unit('cloud', 2, 1, {
        body: 'white',
        short: '6. Bóveda Cloud (Upstash Redis)',
        label: 'Bóveda en la Nube Upstash Redis + Sincronización Google Sheets y WhatsApp',
        desc: 'Respaldo externo instantáneo en la nube (`wise-pipefish-172734.upstash.io`). Garantiza que aunque la PC sufra un desperfecto físico, el 100% de socios, membresías, asistencias y caja estén a salvo y accesibles desde el celular del dueño.',
        specs: {
          MotorCloud: 'Upstash Redis Serverless TLS (`wise-pipefish-172734.upstash.io`)',
          Arquitectura: 'Write-Through Asíncrono + Auto-hidratación al arranque',
          Exportacion: 'Sincronización con Google Sheets, Excel CSV UTF-8 BOM y Boletas WhatsApp',
          Seguridad: 'Token REST Bearer + Copias cifradas AES-256-GCM',
        },
        ports: [
          { id: 'from_pc', label: 'Enlace TLS 1.3 desde Mini PC', face: 'front', u: 0.5 },
        ],
        parts: {
          nic: { label: 'Gateway HTTPS / TLS 1.3 Serverless', desc: 'Recibe las réplicas JSON comprimidas desde la Mini PC de recepción.', m: 'gold' },
          cpu: { label: 'Motor Redis (`rd_fitness:vault:v4`)', desc: 'Actualiza atómicamente el estado maestro del gimnasio en milisegundos.', m: 'copper' },
          ram: { label: 'Caché Distribuida Multi-AZ', desc: 'Sirve la App del Miembro (`/app`) y el panel gerencial móvil desde cualquier lugar.', m: 'ledG' },
          storage: { label: 'Persistencia Duradera + Snapshots', desc: 'Almacena el historial contable, cierres de caja y auditoría anti-fraude.', m: 'chip' },
          psu: { label: 'Conector Webhook Google Sheets / WhatsApp', desc: 'Permite exportar reportes ejecutivos y enviar comprobantes digitales al WhatsApp del socio.', m: 'pcbblue' },
        },
        stages: [
          { comp: 'nic', name: '1. Ingesta Segura REST TLS 1.3', desc: 'Recibe la actualización del estado tras cada cobro, registro o asistencia.' },
          { comp: 'cpu', name: '2. Commit Atómico en Bóveda Redis', desc: 'Guarda la clave `rd_fitness:vault:v4` con replicación redundante.' },
          { comp: 'ram', name: '3. Disponibilidad Móvil 24/7 para el Dueño', desc: 'El propietario consulta reportes, ingresos y asistencias en vivo desde su celular.' },
        ],
      }),
    ],

    cables: [
      { id: 'c_scan_pc', from: 'scanner.usb_out', to: 'minipc.usb_scan', m: 'cPoe', z: 1.0, stubA: 6, stubB: 6 },
      { id: 'c_pc_print', from: 'minipc.usb_print', to: 'printer.usb_in', m: 'cEth', z: 1.0, stubA: 6, stubB: 6 },
      { id: 'c_dvr_pc', from: 'dvr.cap_out', to: 'minipc.usb_cap', m: 'cCoax', z: 1.0, stubA: 6, stubB: 6 },
      { id: 'c_pc_tv', from: 'minipc.hdmi_tv', to: 'tv.from_pc', m: 'cWan', z: 1.0, stubA: 6, stubB: 6 },
      { id: 'c_dvr_tv', from: 'dvr.hdmi_direct', to: 'tv.from_dvr', m: 'cEth', z: 1.0, stubA: 6, stubB: 6 },
      { id: 'c_pc_cloud', from: 'minipc.wan_cloud', to: 'cloud.from_pc', m: 'cPoe', z: 1.0, stubA: 6, stubB: 6 },
    ],

    traces: [
      {
        id: 'qr_checkin_tv',
        label: '1. Ingreso QR Instantáneo (0.1s): Socio ➔ Escáner 2D ➔ Mini PC ➔ Smart TV (PiP + Bienvenida) ➔ Cloud',
        steps: [
          { type: 'link', link: 'member_qr', layer: 'Óptico QR 2D', dur: 1.4, text: 'El socio acerca su celular o carné QR al lector 2D de recepción.' },
          { type: 'inside', dev: 'scanner', enter: 'qr_in', stages: ['scanner_s1', 'scanner_s2', 'scanner_s3'], exit: 'usb_out', layer: 'Decodificación 0.1s', dur: 2.6, text: 'El sensor CMOS antirreflejo captura el QR en 0.1s, decodifica `RDFIT:SOCIO` y lo envía por USB-HID.' },
          { type: 'cable', cable: 'c_scan_pc', dir: 1, layer: 'USB-HID Instantáneo', dur: 1.1, text: 'La trama viaja por el cable USB blindado hacia la Mini PC de recepción.' },
          { type: 'inside', dev: 'minipc', enter: 'usb_scan', stages: ['minipc_s1', 'minipc_s2'], exit: 'hdmi_tv', layer: 'Validación + Evento SSE', dur: 2.6, text: 'La Mini PC verifica que la membresía está ACTIVA, registra la asistencia y dispara el evento `welcome` hacia la TV.' },
          { type: 'cable', cable: 'c_pc_tv', dir: 1, layer: 'HDMI 1080p + SSE', dur: 1.2, text: 'La señal viaja por el cable HDMI hacia la Smart TV del gimnasio.' },
          { type: 'inside', dev: 'tv', enter: 'from_pc', stages: ['tv_s1', 'tv_s2', 'tv_s3'], layer: 'PiP CCTV + Bienvenida 5.5s', dur: 3.0, text: 'La TV pasa las cámaras de seguridad a la esquina PiP, muestra la bienvenida con los días restantes del socio por 5.5s y luego vuelve a las cámaras a pantalla completa.' },
        ],
      },
      {
        id: 'sale_print_cloud',
        label: '2. Cobro de Membresía / Yape + Boleta Térmica Negro Puro (#000000) + Respaldo Cloud',
        steps: [
          { type: 'inside', dev: 'minipc', stages: ['minipc_s2', 'minipc_s3'], exit: 'usb_print', layer: 'POS Caja + Render #000000', dur: 2.6, text: 'Recepción registra el pago (Efectivo/Yape/Plin) y genera la boleta con CSS monocromático 100% negro puro.' },
          { type: 'cable', cable: 'c_pc_print', dir: 1, layer: 'USB ESC/POS 203 DPI', dur: 1.2, text: 'El comprobante de alto contraste se envía por USB a la impresora térmica de 80mm.' },
          { type: 'inside', dev: 'printer', enter: 'usb_in', stages: ['printer_s1', 'printer_s2', 'printer_s3'], layer: 'Impresión Alta Densidad', dur: 2.8, text: 'El cabezal Rohm quema el papel térmico Hansol de 65g con negro intenso y corta el ticket automáticamente.' },
          { type: 'inside', dev: 'minipc', stages: ['minipc_s4'], exit: 'wan_cloud', layer: 'Replicación Híbrida', dur: 2.0, text: 'En paralelo, la Mini PC empaqueta el nuevo estado contable y lo envía hacia Upstash Redis.' },
          { type: 'cable', cable: 'c_pc_cloud', dir: 1, layer: 'HTTPS TLS 1.3', dur: 1.2, text: 'Sincronización cifrada hacia la nube.' },
          { type: 'inside', dev: 'cloud', enter: 'from_pc', stages: ['cloud_s1', 'cloud_s2', 'cloud_s3'], layer: 'Cloud Vault Sync', dur: 2.8, text: 'Upstash Redis confirma el respaldo en la nube: el dueño ya ve el ingreso en tiempo real desde su celular.' },
        ],
      },
      {
        id: 'cctv_rotative_spot',
        label: '3. Ciclo Smart TV: Cámaras CCTV 24/7 (DVR) ➔ Spot Publicitario Programado (16s con PiP) ➔ Retorno a CCTV',
        steps: [
          { type: 'inside', dev: 'dvr', stages: ['dvr_s1', 'dvr_s2', 'dvr_s3'], exit: 'cap_out', layer: 'CCTV 4 Canales 1080p', dur: 2.6, text: 'El DVR graba las 4 cámaras 24/7 y entrega la señal de video por la capturadora HDMI-USB.' },
          { type: 'cable', cable: 'c_dvr_pc', dir: 1, layer: 'Video USB 3.0 UVC 60fps', dur: 1.2, text: 'El flujo de las cámaras ingresa a la Mini PC para integrarse en `/display.html`.' },
          { type: 'inside', dev: 'dvr', stages: ['dvr_s2'], exit: 'hdmi_direct', layer: 'Matriz de Video CCTV', dur: 1.8, text: 'El enlace directo de video mantiene sincronizada la cuadrícula 2×2 de vigilancia.' },
          { type: 'cable', cable: 'c_dvr_tv', dir: 1, layer: 'Bus Video CCTV', dur: 1.2, text: 'Transmisión continua hacia la Smart TV.' },
          { type: 'inside', dev: 'tv', enter: 'from_dvr', stages: ['tv_s1', 'tv_s2', 'tv_s3'], layer: 'Spot Rotativo 16s + CCTV PiP', dur: 3.2, text: 'Cada 3 minutos la TV lanza automáticamente el Spot Publicitario de RD Fitness Club durante 16 segundos (manteniendo las cámaras en la esquina PiP) y al terminar regresa a las cámaras a pantalla completa.' },
        ],
      },
    ],
  };
};
