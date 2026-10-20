/* RD Fitness Club — Escena Anatómica 3D Realista (Anatomy3D v2.0)
 * Cada equipo está esculpido en 3D con su forma física real:
 *  1. Celular / Carné QR del Socio (Vertical con pantalla OLED y QR activo)
 *  2. Escáner QR 2D de Pedestal (Base circular, cuello articulado y cabezal óptico con lente cóncavo)
 *  3. Mini PC Recepción NUC (Chasis cúbico Beelink Dual-HDMI con turbina radial giratoria, RAM SO-DIMM y NVMe)
 *  4. Impresora Térmica 80mm (Cuerpo cúbico con rollo cilíndrico de papel de 80mm adentro, cabezal Rohm, guillotina y boleta saliendo arriba)
 *  5. Cámaras Domo PTZ Infrarrojas 1080p (Mástil + cúpula domo con lente parabólico y anillo IR)
 *  6. Grabador DVR 4 Canales + Capturadora HDMI-USB (Chasis DVR con disco duro WD Purple de plato cilíndrico y conectores BNC)
 *  7. Smart TV 55" 4K Panorámica Vertical (Gran pantalla vertical 16:9 en pedestal con cuadrícula de 4 cámaras CCTV + ventana PiP + Banner de Bienvenida/Spot)
 *  8. Gateway & Bóveda Cloud Upstash Redis (Router con 4 antenas cilíndricas + núcleo Redis y respaldo Google Sheets/WhatsApp)
 */
module.exports = function () {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  return {
    fig: 'FIG 01 • ANATOMÍA 3D REALISTA DE HARDWARE Y FLUJO DE DATOS • RD FITNESS CLUB',
    title: 'RD Fitness Club: Escáner QR 2D ➔ Mini PC ➔ Impresora Térmica 80mm + Smart TV 55" CCTV PiP ➔ Cloud Vault',
    subtitle: 'Despiece Anatómico 3D en Tiempo Real • Rayos-X de Componentes Internos, Boletas Negro Puro (#000) y Smart TV Dual (Cámaras 24/7 + PiP + Publicidad)',
    hint: 'ARRASTRA PARA ORBITAR 3D • RUEDA PARA ZOOM ANATÓMICO (ABRE EQUIPOS EN RAYOS-X) • CLIC EN CUALQUIER EQUIPO O CHIP PARA VER SUS PROCESOS',
    worldSpan: 410,
    defaultDevice: 'smart_tv_55',
    camera: { az: -1.18, el: 0.46, zoom: 1.02, target: [-4, -6, 18] },

    banners: [
      { pos: [-128, -104, 0], text: 'MOSTRADOR DE RECEPCIÓN Y CAJA (ACCESO QR 0.1s + BOLETA #000)', color: '#f5b400' },
      { pos: [128, -104, 0], text: 'ZONA DE MONITOREO CCTV, SMART TV 55" PiP Y BÓVEDA CLOUD', color: '#27e6ff' },
    ],

    state: {
      checkinsPerHour: 85,
      promoIntervalMin: 3,
      printDensity: 100,
      tvMode: 'cctv_pip',
    },

    audit: {
      minInternals: 5,
      states: [
        { checkinsPerHour: 45, promoIntervalMin: 3 },
        { checkinsPerHour: 180, promoIntervalMin: 2 },
      ],
    },

    controls: [
      { key: 'checkinsPerHour', label: 'Flujo en Recepción (Socios/hora)', min: 15, max: 220, step: 5, fmt: (v) => `${v} socios/h` },
      { key: 'promoIntervalMin', label: 'Rotación Spot Publicitario en TV', min: 1, max: 10, step: 1, fmt: (v) => `Cada ${v} min (16s)` },
      { key: 'printDensity', label: 'Densidad Térmica Boleta (#000000)', min: 85, max: 100, step: 5, fmt: (v) => `${v}% Negro Intenso` },
      {
        key: 'tvMode',
        label: 'Comportamiento Smart TV 55"',
        type: 'select',
        options: [
          { v: 'cctv_pip', l: '📹 Cámaras CCTV 24/7 + PiP Automático en Alertas/Spot' },
          { v: 'promo_focus', l: '⭐ Spot Publicitario Activo + Cámaras en Esquina PiP' },
          { v: 'yape_focus', l: '🟣 Cobro QR Yape/Plin en Pantalla + Cámaras en PiP' },
        ],
      },
    ],

    tick(state) {
      const scanMs = Math.round(90 + (state.checkinsPerHour / 220) * 24);
      const promoDuty = (16 / ((state.promoIntervalMin || 3) * 60)) * 100;
      const alertDuty = ((state.checkinsPerHour || 85) * 5.5 / 3600) * 100;
      const cctvFullPct = Math.round(clamp(100 - promoDuty - alertDuty, 68, 97));
      const act = clamp((state.checkinsPerHour || 85) / 180, 0.25, 1);

      state.__cableAct = {
        c_scan_pc: act,
        c_pc_printer: act * 0.9,
        c_dvr_pc: 0.95,
        c_pc_tv: act,
        c_dvr_tv: 0.95,
        c_pc_cloud: act * 0.85,
      };

      return { scanMs, cctvFullPct };
    },

    kpis(state, tel) {
      return [
        { label: 'Velocidad Escáner 2D', value: `${tel.scanMs} ms (0.1s)`, tone: 'good' },
        { label: 'Contraste Boleta 80mm', value: `${state.printDensity}% #000000`, tone: state.printDensity >= 95 ? 'good' : 'warn' },
        { label: 'TV en Cámaras Full + PiP', value: `${tel.cctvFullPct}% Full / 100% Visible`, tone: 'good' },
        { label: 'Spot Publicitario TV', value: `16s cada ${state.promoIntervalMin} min`, tone: 'good' },
        { label: 'Bóveda Local + Cloud', value: '100% Sincronizado', tone: 'good' },
      ];
    },

    readout(state, tel) {
      return `LECTURA QR: ${tel.scanMs} ms | TICKET 80MM: ${state.printDensity}% NEGRO PURO | SMART TV 55": ${tel.cctvFullPct}% CCTV FULL + PiP ACTIVO | SPOT: CADA ${state.promoIntervalMin} MIN`;
    },

    ground: [
      // Plataforma Izquierda: Mostrador de Recepción y Caja
      { id: 'ground.desk_deck', type: 'box', min: [-215, -95, -6.2], size: [175, 190, 6.0], m: 'plate' },
      { id: 'ground.desk_rim', type: 'box', min: [-215, -95, -8.5], size: [175, 190, 2.0], m: 'rubber' },
      // Plataforma Derecha: Zona de Monitoreo CCTV, Smart TV 55" y Nube
      { id: 'ground.tv_deck', type: 'box', min: [40, -95, -6.2], size: [175, 190, 6.0], m: 'plate' },
      { id: 'ground.tv_rim', type: 'box', min: [40, -95, -8.5], size: [175, 190, 2.0], m: 'rubber' },
    ],

    links: {
      opt_qr_beam: {
        from: 'member_phone',
        to: 'scanner_2d',
        label: 'Haz Óptico 2D Antirreflejo (Lectura QR en 0.1s)',
        fresnel: true,
        radius: 6,
        color: 'rgba(245, 180, 0, 0.72)',
        pulseColor: '#f5b400',
        pulses: 5,
        path: () => [
          [-184, 39, 25],
          [-149, 39, 25],
        ],
      },
      cctv_video_link: {
        from: 'cctv_dome',
        to: 'dvr_capture',
        label: 'Señal de 4 Cámaras CCTV Full HD 1080p',
        fresnel: false,
        color: 'rgba(39, 230, 255, 0.65)',
        pulseColor: '#27e6ff',
        pulses: 6,
        path: () => [
          [68, 42, 30],
          [68, 16, 10],
        ],
      },
    },

    devices: [
      /* =====================================================================
       * 1. SMARTPHONE / CARNÉ QR DEL SOCIO (VERTICAL CON PANTALLA OLED Y QR)
       * ===================================================================== */
      {
        id: 'member_phone',
        short: '1. Celular / Carné QR Socio',
        label: 'Smartphone del Socio con Carné Digital QR (o Tarjeta PVC RD Fitness)',
        lift: 20,
        desc: 'Representa el teléfono móvil del socio mostrando su Carné Digital de Lujo con marca de agua oficial de RD Fitness Club (o su tarjeta física PVC plastificada). Incluso si la pantalla tiene el brillo al mínimo (15%) o protector de vidrio templado rajado, el código QR de alto contraste es leído al instante al acercarlo al mostrador.',
        specs: {
          'Formato Credencial': 'Carné Digital PWA (`/`) o Tarjeta PVC Física',
          'Payload QR': 'Token Único `RDFIT:SOCIO` con verificación instantánea',
          'Modo Offline': 'Service Worker `rd-v4.3` (abre el carné sin internet)',
          'Distancia Lectura': '5 cm a 25 cm frente al lector 2D manos libres',
        },
        parts: [
          { name: 'Base Soporte de Presentación', type: 'box', min: [-204, 25, 0], size: [20, 28, 4], m: 'graphite', enc: false, nest: 'ph_sh' },
          { name: 'Chasis Vertical Smartphone Unibody', type: 'box', min: [-202, 26, 4], size: [16, 26, 36], m: 'dark', enc: true, nest: 'ph_sh' },
          { name: 'Pantalla Frontal Super AMOLED', type: 'box', min: [-186, 28, 7], size: [0.6, 22, 30], m: 'lcd', enc: false, nest: 'ph_sh' },
          { name: 'Código QR Dorado Activo en Pantalla', type: 'box', min: [-185.3, 33, 15], size: [0.4, 12, 12], m: 'gold', enc: false, nest: 'ph_sh' },
          { name: 'Badge Verde Membresía Vigente', type: 'box', min: [-185.3, 31, 30], size: [0.4, 16, 3], m: 'ledG', enc: false, nest: 'ph_sh' },
          { name: 'Lente Cámara Smartphone #1', type: 'cyl', c: [-202.4, 31, 34], axis: [-1, 0, 0], r: 1.8, len: 0.6, m: 'steel', enc: false, nest: 'ph_sh' },
          { name: 'Lente Cámara Smartphone #2', type: 'cyl', c: [-202.4, 31, 29], axis: [-1, 0, 0], r: 1.8, len: 0.6, m: 'steel', enc: false, nest: 'ph_sh' },
          { name: 'Bisel Superior de Inspección', type: 'box', min: [-202, 26, 40], size: [16, 26, 2.0], m: 'alu', enc: true, lid: true, lift: [0, 0, 20] },
        ],
        ports: [],
        internals: [
          { id: 'ph_pcb', label: 'Placa Lógica Smartphone ARM64', desc: 'Ejecuta la aplicación web progresiva (PWA) de RD Fitness Club con gráficos de asistencia, récords PR y carné QR.', type: 'box', min: [-200, 28, 6], size: [3, 22, 30], m: 'pcb' },
          { id: 'ph_oled', label: 'Controlador Display AMOLED & Brillo Auto', desc: 'Renderiza el vector SVG del código QR con bordes nítidos (`crispEdges`) para lectura inmediata.', type: 'box', min: [-195, 29, 24], size: [7, 10, 11], m: 'ledC' },
          { id: 'ph_qr_tok', label: 'Motor de Credencial QR (`RDFIT:Mxxxx`)', desc: 'Almacena el identificador criptográfico único del socio vinculado a su DNI y plan vigente.', type: 'box', min: [-195, 40, 24], size: [7, 9, 11], m: 'gold' },
          { id: 'ph_pwa', label: 'Caché Offline Service Worker (`rd-v4.3`)', desc: 'Permite que el socio abra su carné QR en la puerta del gimnasio incluso si no tiene megas ni señal móvil.', type: 'box', min: [-195, 29, 15], size: [7, 20, 7], m: 'pcbblue' },
          { id: 'ph_batt', label: 'Batería Li-Po 5000 mAh', desc: 'Alimentación del dispositivo móvil del socio.', type: 'box', min: [-195, 29, 6], size: [7, 20, 7], m: 'chip' },
        ],
        pipeline: [
          { id: 'ph_s1', comp: 'ph_pwa', name: '1. Apertura Instantánea del Carné PWA', desc: 'El socio abre la app de RD Fitness Club (con o sin internet gracias al Service Worker local).' },
          { id: 'ph_s2', comp: 'ph_qr_tok', name: '2. Generación del Vector QR de Alto Contraste', desc: 'Se despliega el código QR oficial con sello de agua de RD Fitness Club.' },
          { id: 'ph_s3', comp: 'ph_oled', name: '3. Presentación frente al Escáner 2D', desc: 'El socio acerca la pantalla a 10–15 cm del lector de mostrador sin entregar su celular.' },
        ],
      },

      /* =====================================================================
       * 2. ESCÁNER QR 2D DE MOSTRADOR (HONEYWELL ORBIT HF680 / NETUM NT-2050M)
       * ===================================================================== */
      {
        id: 'scanner_2d',
        short: '2. Escáner QR 2D (Honeywell HF680)',
        label: 'Lector Óptico 2D Imager Manos Libres (Honeywell Orbit HF680 / Netum NT-2050M)',
        lift: 24,
        desc: 'Escáner de presentación omnidireccional con base pesada, columna articulada y cabezal óptico CMOS Megapíxel. A diferencia de los lectores láser antiguos de línea roja que rebotan en el vidrio del celular, este sensor fotográfico 2D captura 60 cuadros por segundo con iluminación antirreflejo y decodifica cualquier QR en 0.1 segundos sin fallas.',
        specs: {
          'Modelos Recomendados': 'Netum NT-2050M (Calidad/Precio) o Honeywell Orbit HF680 (Industrial)',
          'Tecnología Óptica': 'Sensor CMOS 2D Imager 1280×800 px (60 fps) + Luz Blanca Cálida',
          'Lectura en Celulares': 'Lee pantallas con 15% de brillo, vidrio templado rajado y ángulos de 60°',
          'Conexión': 'USB-HID Plug & Play (emula teclado y presiona ENTER en 0.1s)',
        },
        parts: [
          { name: 'Base Circular Pesada Antideslizante', type: 'cyl', c: [-130, 39, 0], axis: [0, 0, 1], r: 15.5, rTop: 12.5, len: 5, m: 'black', enc: false, nest: 'sc_sh' },
          { name: 'Anillo Cromado de Base', type: 'cyl', c: [-130, 39, 5], axis: [0, 0, 1], r: 11.5, rTop: 7.5, len: 2, m: 'steel', enc: false, nest: 'sc_sh' },
          { name: 'Cuello Articulado Inclinable', type: 'cyl', c: [-130, 39, 7], axis: [0, 0, 1], r: 5.5, rTop: 6.5, len: 7, m: 'graphite', enc: false, nest: 'sc_sh' },
          { name: 'Cabezal Óptico 2D Omnidireccional', type: 'box', min: [-148, 21, 14], size: [36, 36, 22], m: 'dark', enc: true, nest: 'sc_sh' },
          { name: 'Tambor Óptico Frontal Antirreflejo', type: 'dish', c: [-148.2, 39, 25], axis: [-1, 0, 0], R: 9.5, depth: 3.5, sides: 24, rings: 4, m: 'lcd', enc: true, nest: 'sc_sh' },
          { name: 'Aro LED Verde de Lectura Exitosa', type: 'box', min: [-148.6, 30, 33], size: [1.0, 18, 1.8], m: 'ledG', enc: false, nest: 'sc_sh' },
          { name: 'Domo Superior del Cabezal Óptico', type: 'box', min: [-148, 21, 36], size: [36, 36, 2.2], m: 'alu', enc: true, lid: true, lift: [0, 0, 24] },
        ],
        ports: [
          { id: 'usb_out', label: 'Cable USB-HID Blindado', p: [-130, 21, 18], n: [0, -1, 0], kind: 'rj45' },
        ],
        internals: [
          { id: 'sc_pcb', label: 'Placa Base de Procesamiento Óptico', desc: 'Circuito impreso de alta velocidad con bus MIPI CSI directo entre el sensor de imagen y el procesador.', type: 'box', min: [-145, 24, 15.5], size: [30, 30, 1.5], m: 'pcb' },
          { id: 'sc_cmos', label: 'Sensor CMOS Megapíxel 1280×800 (60 fps)', desc: 'Obturador global (Global Shutter) que congela la imagen del QR aunque la mano del socio esté en movimiento.', type: 'box', min: [-145, 31, 18], size: [6, 16, 9], m: 'ledC' },
          { id: 'sc_lens', label: 'Conjunto Óptico Asférico Antirreflejo', desc: 'Elimina el destello del vidrio de los teléfonos inteligentes para leer pantallas con bajo brillo.', type: 'cyl', c: [-131, 39, 22], axis: [-1, 0, 0], r: 4.0, len: 6, m: 'white' },
          { id: 'sc_leds', label: 'Matriz de Iluminación LED Blanca Cálida', desc: 'Ilumina uniformemente carnés físicos PVC sin deslumbrar la vista del recepcionista ni del socio.', type: 'box', min: [-145, 24, 28], size: [8, 30, 5], m: 'gold' },
          { id: 'sc_asic', label: 'ASIC Decodificador 2D Reed-Solomon', desc: 'Reconstruye códigos QR dañados, manchados o con micas quebradas en menos de 100 milisegundos.', type: 'box', min: [-129, 24, 18], size: [11, 12, 8], m: 'copper' },
          { id: 'sc_buzzer', label: 'Buzzer Piezoeléctrico 85 dB + Interfaz HID', desc: 'Emite el pitido nítido de confirmación e inyecta la cadena `RDFIT:SOCIO` + `ENTER` por USB.', type: 'cyl', c: [-120, 44, 18], axis: [0, 0, 1], r: 4.2, len: 9, m: 'brass' },
        ],
        pipeline: [
          { id: 'sc_s1', comp: 'sc_cmos', name: '1. Captura Global-Shutter a 60 FPS', desc: 'El sensor CMOS y el lente antirreflejo capturan el QR del celular sin importar el brillo de pantalla.' },
          { id: 'sc_s2', comp: 'sc_asic', name: '2. Corrección de Errores Reed-Solomon (0.1s)', desc: 'El procesador ASIC decodifica la matriz 2D al instante con cero lecturas fallidas.' },
          { id: 'sc_s3', comp: 'sc_buzzer', name: '3. Pitido de Confirmación + Ráfaga USB-HID', desc: 'Activa el LED verde, emite el beep audible y transmite el código con sufijo ENTER a la Mini PC.' },
        ],
      },

      /* =====================================================================
       * 3. MINI PC RECEPCIÓN NUC (BEELINK MINI S12 PRO / CORE i5 DUAL-HDMI)
       * ===================================================================== */
      {
        id: 'minipc_pos',
        short: '3. Mini PC Recepción (Beelink / Core i5)',
        label: 'Mini PC de Recepción (Beelink Mini S12 Pro N100 / Core i5 • 16GB RAM • 512GB NVMe • Dual-HDMI)',
        lift: 26,
        desc: 'Estación central compacta de recepción. Su chasis tipo NUC alberga un procesador de 4/6 núcleos, 16 GB de RAM y unidad M.2 NVMe ultrarrápida. Cuenta con doble salida HDMI nativa (una para el monitor del cajero y otra hacia la Smart TV 55" del gimnasio), ejecuta el servidor Node.js local Offline-First y coordina la impresora térmica y la bóveda en la nube.',
        specs: {
          'Modelo Recomendado': 'Beelink Mini S12 Pro (Intel N100 12va Gen) o HP/Dell Mini Core i5',
          'Memoria y Disco': '16 GB RAM DDR4 + 512 GB SSD M.2 NVMe PCIe (Arranque en 6 segundos)',
          'Salidas de Video': '2× HDMI 2.0 4K@60Hz (Monitor Recepción + Smart TV Gimnasio)',
          'Base de Datos': 'Híbrida Transaccional (`gym.json` Local + Upstash Redis Cloud)',
        },
        parts: [
          { name: 'Chasis Cúbico NUC Aluminio/ABS', type: 'box', min: [-156, -42, 0], size: [52, 42, 18], m: 'dark', enc: true, nest: 'pc_sh' },
          { name: 'Bisel Frontal con Botón Power Rojo Beelink', type: 'box', min: [-152, -42.5, 6], size: [6, 0.5, 5], m: 'ledR', enc: false, nest: 'pc_sh' },
          { name: 'Puertos Frontales USB 3.2 Gen2 (Azules)', type: 'box', min: [-142, -42.5, 7], size: [18, 0.5, 3.5], m: 'ledB', enc: false, nest: 'pc_sh' },
          { name: 'LED Frontal de Actividad NVMe', type: 'box', min: [-118, -42.5, 8], size: [8, 0.5, 1.8], m: 'ledC', enc: false, nest: 'pc_sh' },
          { name: 'Rejilla Lateral de Admisión de Aire', type: 'box', min: [-156.4, -36, 4], size: [0.4, 30, 10], m: 'graphite', enc: false, nest: 'pc_sh' },
          { name: 'Cubierta Superior Ventilada Grabada a Láser', type: 'box', min: [-156, -42, 18], size: [52, 42, 2.2], m: 'graphite', enc: true, lid: true, lift: [0, 0, 26] },
        ],
        ports: [
          { id: 'usb_scan', label: 'USB-HID Escáner 2D In', p: [-130, 0, 6], n: [0, 1, 0], kind: 'rj45' },
          { id: 'usb_print', label: 'USB 2.0 Impresora Térmica Out', p: [-130, -42, 6], n: [0, -1, 0], kind: 'rj45' },
          { id: 'usb_cap', label: 'USB 3.0 Capturadora DVR In', p: [-104, -10, 6], n: [1, 0, 0], kind: 'rj45' },
          { id: 'hdmi_tv', label: 'HDMI 2 Out (Hacia Smart TV 55")', p: [-104, -22, 6], n: [1, 0, 0], kind: 'rj45' },
          { id: 'wan_cloud', label: 'Gigabit LAN / Cloud Sync Out', p: [-104, -34, 6], n: [1, 0, 0], kind: 'rj45' },
        ],
        internals: [
          { id: 'pc_pcb', label: 'Placa Base Mini-ITX Multicapa Blindada', desc: 'Circuito impreso de 6 capas con reguladores digitales VRM y protección contra sobretensiones en todos los puertos USB y HDMI.', type: 'box', min: [-153, -39, 1.5], size: [46, 36, 1.5], m: 'pcbdark' },
          { id: 'pc_cpu', label: 'Procesador Intel Core i5 / N100 + Bloque Cobre', desc: 'Ejecuta el servidor Node.js/Express (`server.js`), valida socios en <2 ms y calcula el arqueo ciego de caja.', type: 'box', min: [-150, -35, 3.2], size: [16, 14, 7.5], m: 'copper' },
          { id: 'pc_fan', label: 'Turbina Radial Blower PWM Silenciosa', desc: 'Ventilador centrífugo de rodamiento hidráulico que mantiene el procesador fresco durante 16 horas continuas de operación.', type: 'fan', c: [-142, -13, 6.5], axis: [0, 0, 1], r: 6.0, blades: 9, thick: 3.5, angle: (cx) => cx.time * 11, m: 'black' },
          { id: 'pc_ram', label: '16 GB RAM DDR4-3200 SO-DIMM', desc: 'Almacena en memoria todo el padrón de socios, sesiones HMAC-SHA256 y el bus de eventos SSE de la Smart TV.', type: 'box', min: [-131, -36, 3.2], size: [12, 16, 5.5], m: 'pcbblue' },
          { id: 'pc_nvme', label: 'SSD M.2 NVMe PCIe 512 GB (`gym.json` + Vault)', desc: 'Guarda instantáneamente cada cobro, asistencia y copia de seguridad cifrada AES-256 sin depender de internet.', type: 'box', min: [-131, -17, 3.2], size: [12, 12, 4.5], m: 'chip' },
          { id: 'pc_io', label: 'Controladora Dual-HDMI 4K + Captura USB 3.2', desc: 'Recibe el video 1080p60 del DVR por USB 3.2 y proyecta `/display.html` hacia la Smart TV del gimnasio por HDMI.', type: 'box', min: [-116, -36, 3.2], size: [8, 30, 6.5], m: 'gold' },
        ],
        pipeline: [
          { id: 'pc_s1', comp: 'pc_io', name: '1. Ingesta USB-HID (QR) + Video DVR (USB 3.0)', desc: 'Recibe la lectura instantánea del escáner 2D y el flujo de las 4 cámaras de seguridad.' },
          { id: 'pc_s2', comp: 'pc_cpu', name: '2. Validación de Vigencia, Asistencia y Caja', desc: 'Verifica los días restantes del socio, registra el ingreso y emite el evento SSE `welcome` / `denied`.' },
          { id: 'pc_s3', comp: 'pc_ram', name: '3. Generación de Boleta Monocromática (#000000)', desc: 'Prepara el comprobante térmico en negro puro 100% sin grises y ordena el corte automático.' },
          { id: 'pc_s4', comp: 'pc_nvme', name: '4. Guardado Local NVMe + Replicación Cloud', desc: 'Asegura el dato en el SSD local en <1 ms y sincroniza la bóveda en la nube Upstash Redis.' },
        ],
      },

      /* =====================================================================
       * 4. IMPRESORA TÉRMICA 80MM CON AUTOCORTE (XPRINTER XP-N160II / EPSON TM-T20III)
       * ===================================================================== */
      {
        id: 'thermal_printer',
        short: '4. Impresora Térmica 80mm (#000 Puro)',
        label: 'Impresora Térmica de Boletas 80mm con Autocorte (Xprinter XP-N160II / Epson TM-T20III)',
        lift: 26,
        desc: 'Ticketera térmica de mostrador de 80 mm con forma cúbica real, rollo cilíndrico interno de papel térmico Hansol de 65g, cabezal japonés Rohm de 203 DPI, cuchilla de autocorte automático y boleta impresa emergiendo por la ranura superior. Configurada en modo Monocromático de Alta Densidad (`#000000 !important`) para que cada letra, monto y código QR salga negro intenso y jamás borroso.',
        specs: {
          'Modelos Recomendados': 'Xprinter XP-N160II (80mm USB/LAN) o Epson TM-T20III',
          'Cabezal y Corte': 'Rohm Japonés 203 DPI (200 mm/s) + Guillotina Automática (1.5M cortes)',
          'Papel Requerido': 'Rollo Térmico 80mm × 80m de 65 gramos (Marca Hansol Capa Negra Intensa)',
          'Nitidez Garantizada': 'CSS `#000000 !important`, `font-weight: 900`, `crispEdges` + Densidad Driver 120%',
        },
        parts: [
          { name: 'Cuerpo Cúbico Impresora Térmica 80mm', type: 'box', min: [-152, -90, 0], size: [44, 38, 24], m: 'offwhite', enc: true, nest: 'pr_sh' },
          { name: 'Panel Frontal Biselado de Control', type: 'box', min: [-150, -90.6, 4], size: [40, 0.6, 10], m: 'graphite', enc: false, nest: 'pr_sh' },
          { name: 'Botón Frontal FEED (Avance de Papel)', type: 'box', min: [-146, -91.0, 6], size: [8, 0.5, 5], m: 'steel', enc: false, nest: 'pr_sh' },
          { name: 'LED POWER Verde + LED PAPER Cian', type: 'box', min: [-124, -91.0, 8], size: [10, 0.5, 2], m: 'ledG', enc: false, nest: 'pr_sh' },
          { name: 'Labio Metálico de Salida de Boleta', type: 'box', min: [-144, -76, 24], size: [28, 3, 1.5], m: 'steel', enc: false, nest: 'pr_sh' },
          { name: 'Boleta Térmica 80mm Impresa Saliendo', type: 'box', min: [-142, -75.5, 25.5], size: [24, 1.2, 15], m: 'white', enc: false, nest: 'pr_sh' },
          { name: 'Encabezado e Importe Negro Puro (#000000)', type: 'box', min: [-139, -75.8, 35], size: [18, 0.4, 3.5], m: 'black', enc: false, nest: 'pr_sh' },
          { name: 'Código QR Nítido Impreso en Boleta', type: 'box', min: [-135, -75.8, 27.5], size: [10, 0.4, 6], m: 'dark', enc: false, nest: 'pr_sh' },
          { name: 'Compuerta Superior Abatible de Rollo', type: 'box', min: [-152, -90, 24], size: [44, 38, 2.2], m: 'alu', enc: true, lid: true, lift: [0, 0, 26] },
        ],
        ports: [
          { id: 'usb_in', label: 'Puerto USB Tipo-B Impresión ESC/POS', p: [-130, -52, 6], n: [0, 1, 0], kind: 'rj45' },
        ],
        internals: [
          { id: 'pr_roll', label: 'Rollo Cilíndrico Papel Térmico 80mm (Hansol 65g)', desc: 'Rollo de papel termosensible de 65 g/m² libre de BPA con recubrimiento químico de alto contraste que reacciona en negro profundo.', type: 'cyl', c: [-144, -66, 13], axis: [1, 0, 0], r: 8.5, len: 28, m: 'white' },
          { id: 'pr_head', label: 'Cabezal Térmico Japonés Rohm 203 DPI', desc: 'Línea de 576 micro-resistencias térmicas (8 puntos/mm) que queman el papel al 100% de densidad sólida sin tramado gris.', type: 'box', min: [-145, -80, 15], size: [30, 4, 5], m: 'copper' },
          { id: 'pr_cutter', label: 'Guillotina Automática de Acero Templado', desc: 'Cuchilla motorizada de doble hoja que realiza el corte parcial limpio de la boleta al terminar de imprimir el QR.', type: 'box', min: [-145, -87, 15], size: [30, 5, 5], m: 'steel' },
          { id: 'pr_stepper', label: 'Motor Paso a Paso + Rodillo Siliconado', desc: 'Arrastra el papel a 200 mm/s con presión constante contra el cabezal térmico para evitar líneas pálidas.', type: 'cyl', c: [-145, -82, 7], axis: [1, 0, 0], r: 3.5, len: 12, m: 'brass' },
          { id: 'pr_board', label: 'Placa ESC/POS + Fuente Estabilizada 24V 2.5A', desc: 'Mantiene los 24V estables incluso al imprimir logotipos y códigos QR densos en negro sólido.', type: 'box', min: [-131, -87, 3], size: [16, 11, 8], m: 'pcb' },
        ],
        pipeline: [
          { id: 'pr_s1', comp: 'pr_board', name: '1. Recepción del Mapa Monocromático #000000', desc: 'La placa ESC/POS recibe el ticket con CSS `#000000 !important` y `contrast(200%)` sin escalas de grises.' },
          { id: 'pr_s2', comp: 'pr_roll', name: '2. Alimentación de Papel Hansol 80mm (65g)', desc: 'El rodillo tracciona el papel de alto gramaje hacia la línea de contacto térmico.' },
          { id: 'pr_s3', comp: 'pr_head', name: '3. Quemado Térmico a 203 DPI de Alta Densidad', desc: 'El cabezal Rohm aplica calor pleno produciendo letras, montos y QR en negro intenso y duradero.' },
          { id: 'pr_s4', comp: 'pr_cutter', name: '4. Autocorte por Guillotina y Entrega', desc: 'La cuchilla de acero corta el ticket automáticamente listo para entregar al socio.' },
        ],
      },

      /* =====================================================================
       * 5. CÁMARAS DE SEGURIDAD CCTV 1080P INFRARROJAS (DOMO PTZ DEL GIMNASIO)
       * ===================================================================== */
      {
        id: 'cctv_dome',
        short: '5. Cámaras CCTV 1080p (4 Zonas)',
        label: 'Cámaras Domo Infrarrojas Full HD 1080p del Gimnasio (Ingreso, Pesas, Cardio, Recepción)',
        lift: 22,
        desc: 'Conjunto de las 4 cámaras de videovigilancia ya instaladas en RD Fitness Club (Puerta Principal, Zona de Musculación, Zona Cardio y Caja). Capturan video continuo a 1080p día y noche y lo envían hacia el DVR para su visualización permanente y en Picture-in-Picture (PiP) en la Smart TV.',
        specs: {
          'Cobertura': '4 Canales Activos (CAM 01 Ingreso, CAM 02 Pesas, CAM 03 Cardio, CAM 04 Caja)',
          'Resolución': 'Full HD 1080p (1920×1080) @ 30 fps con WDR real',
          'Visión Nocturna': 'Anillo Infrarrojo Smart-IR de 30 metros + Filtro IR-Cut',
          'Integración TV': 'Visible 100% del tiempo (Pantalla Completa 90% / Esquina PiP 10%)',
        },
        parts: [
          { name: 'Base de Anclaje a Techo/Pared', type: 'cyl', c: [68, 56, 0], axis: [0, 0, 1], r: 10, rTop: 7, len: 4, m: 'steel', enc: false, nest: 'cm_sh' },
          { name: 'Brazo Mástil Metálico CCTV', type: 'cyl', c: [68, 56, 4], axis: [0, 0, 1], r: 3.8, len: 14, m: 'offwhite', enc: false, nest: 'cm_sh' },
          { name: 'Carcasa Blindada IP67 Domo CCTV', type: 'box', min: [52, 42, 18], size: [32, 28, 22], m: 'white', enc: true, nest: 'cm_sh' },
          { name: 'Cúpula Óptica Frontal & Reflector IR', type: 'dish', c: [51.8, 56, 29], axis: [-1, 0, 0], R: 9.5, depth: 4.0, sides: 24, rings: 4, m: 'dark', enc: true, nest: 'cm_sh' },
          { name: 'LEDs Infrarrojos Nocturnos Activos', type: 'box', min: [51.4, 50, 36], size: [0.6, 12, 1.8], m: 'ledR', enc: false, nest: 'cm_sh' },
          { name: 'Visera Superior Impermeable IP67', type: 'box', min: [52, 42, 40], size: [32, 28, 2.2], m: 'alu', enc: true, lid: true, lift: [0, 0, 22] },
        ],
        ports: [],
        internals: [
          { id: 'cam_pcb', label: 'Placa de Captura y Transmisión HD', desc: 'Procesa la señal del sensor óptico con aislamiento contra ruidos eléctricos.', type: 'box', min: [55, 45, 19.5], size: [26, 22, 1.5], m: 'pcb' },
          { id: 'cam_cmos', label: 'Sensor CMOS Starlight 2MP 1080p', desc: 'Alta sensibilidad lumínica para capturar rostros y movimientos nítidos en todo el gimnasio.', type: 'box', min: [55, 50, 22], size: [7, 12, 8], m: 'ledC' },
          { id: 'cam_lens', label: 'Lente Gran Angular 2.8mm (106°) + IR-Cut', desc: 'Cubre un ángulo panorámico completo de las máquinas de pesas y la puerta de acceso.', type: 'cyl', c: [63, 56, 26], axis: [1, 0, 0], r: 4.0, len: 8, m: 'brass' },
          { id: 'cam_ir', label: 'Anillo Infrarrojo Smart-IR Automático', desc: 'Regula la intensidad infrarroja para evitar sobreexposición en objetos cercanos.', type: 'box', min: [55, 45, 31], size: [8, 22, 5], m: 'gold' },
          { id: 'cam_dsp', label: 'Procesador ISP WDR + 3D-DNR', desc: 'Compensa el contraluz de la puerta de calle de Chivay para que el ingreso siempre se vea claro.', type: 'box', min: [72, 47, 22], size: [8, 18, 8], m: 'copper' },
        ],
        pipeline: [
          { id: 'cm_s1', comp: 'cam_lens', name: '1. Captura Óptica Gran Angular (4 Zonas)', desc: 'Los lentes de 2.8mm vigilan simultáneamente Ingreso, Pesas, Cardio y Recepción.' },
          { id: 'cm_s2', comp: 'cam_cmos', name: '2. Digitalización Full HD 1080p', desc: 'El sensor Starlight entrega cuadros nítidos a 30 fps.' },
          { id: 'cm_s3', comp: 'cam_dsp', name: '3. Compensación de Contraluz WDR y Envío al DVR', desc: 'Envía el flujo de video continuo hacia el grabador DVR del gimnasio.' },
        ],
      },

      /* =====================================================================
       * 6. GRABADOR DVR 4 CANALES + CAPTURADORA HDMI-A-USB 3.0 1080P
       * ===================================================================== */
      {
        id: 'dvr_capture',
        short: '6. DVR CCTV + Capturadora USB 3.0',
        label: 'Grabador DVR/NVR 4 Canales + Capturadora de Video HDMI-a-USB 3.0 Full HD',
        lift: 24,
        desc: 'Grabador de seguridad del gimnasio con disco duro interno WD Purple (de plato magnético cilíndrico) que graba las 24 horas. Su salida HDMI pasa por un Splitter y una Capturadora HDMI-a-USB 3.0 (S/ 45) hacia la Mini PC, logrando que el video en vivo de las cámaras se integre dentro de `/display.html` sin perder jamás la grabación ni la vigilancia.',
        specs: {
          'Grabador': 'DVR/XVR 4 Canales 1080p H.265+ con Disco WD Purple 24/7',
          'Enlace a Mini PC': 'Capturadora de Video HDMI-a-USB 3.0 UVC 1080p60 (Plug & Play)',
          'Modo en `/display.html`': 'Detección directa por navegador (`getUserMedia`) o Stream IP/MJPEG',
          'Seguridad': 'Grabación continua 24/7 independiente de lo que muestre la pantalla',
        },
        parts: [
          { name: 'Chasis Metálico Grabador DVR 4CH', type: 'box', min: [46, -24, 0], size: [54, 40, 14], m: 'black', enc: true, nest: 'dv_sh' },
          { name: 'Panel Frontal DVR con LEDs CH1-CH4', type: 'box', min: [50, -24.5, 5], size: [22, 0.5, 3], m: 'ledG', enc: false, nest: 'dv_sh' },
          { name: 'LED Rojo Grabación Continua REC 24/7', type: 'box', min: [76, -24.5, 5], size: [8, 0.5, 3], m: 'ledR', enc: false, nest: 'dv_sh' },
          { name: 'Conector Coaxial BNC Trasero #1', type: 'cyl', c: [56, 16, 8], axis: [0, 1, 0], r: 1.6, len: 2.5, m: 'steel', enc: false, nest: 'dv_sh' },
          { name: 'Conector Coaxial BNC Trasero #2', type: 'cyl', c: [64, 16, 8], axis: [0, 1, 0], r: 1.6, len: 2.5, m: 'steel', enc: false, nest: 'dv_sh' },
          { name: 'Conector Coaxial BNC Trasero #3', type: 'cyl', c: [72, 16, 8], axis: [0, 1, 0], r: 1.6, len: 2.5, m: 'steel', enc: false, nest: 'dv_sh' },
          { name: 'Conector Coaxial BNC Trasero #4', type: 'cyl', c: [80, 16, 8], axis: [0, 1, 0], r: 1.6, len: 2.5, m: 'steel', enc: false, nest: 'dv_sh' },
          { name: 'Cubierta Superior DVR CCTV', type: 'box', min: [46, -24, 14], size: [54, 40, 2.0], m: 'graphite', enc: true, lid: true, lift: [0, 0, 24] },
        ],
        ports: [
          { id: 'usb_cap_out', label: 'Salida Capturadora HDMI-USB 3.0 a Mini PC', p: [46, -10, 6], n: [-1, 0, 0], kind: 'rj45' },
          { id: 'hdmi_tv_out', label: 'Bus Video HDMI hacia Smart TV 55"', p: [100, -4, 6], n: [1, 0, 0], kind: 'rj45' },
        ],
        internals: [
          { id: 'dvr_pcb', label: 'Placa Madre DVR 4 Canales + AFE', desc: 'Digitaliza las 4 entradas de cámaras con protección contra picos en los cables coaxiales.', type: 'box', min: [49, -21, 1.5], size: [48, 34, 1.4], m: 'pcb' },
          { id: 'dvr_hdd', label: 'Disco Duro WD Purple 24/7 (Plato Magnético)', desc: 'Almacenamiento de videovigilancia continua con plato giratorio de aluminio para grabación 24/7 sin pérdida de cuadros.', type: 'cyl', c: [62, 1, 3.2], axis: [0, 0, 1], r: 9.5, len: 4.5, m: 'alu' },
          { id: 'dvr_soc', label: 'SoC Codificador H.265+ Multi-Vista 2×2', desc: 'Comprime el video para el disco duro y compone en tiempo real el mosaico cuádruple de las 4 cámaras.', type: 'box', min: [76, -4, 3.2], size: [12, 14, 6], m: 'copper' },
          { id: 'dvr_split', label: 'Splitter HDMI Activo 1×2 (1080p60)', desc: 'Divide la salida de video de alta definición sin caída de señal.', type: 'box', min: [76, -19, 3.2], size: [18, 12, 5.5], m: 'gold' },
          { id: 'dvr_uvc', label: 'Capturadora HDMI-a-USB 3.0 (Chip UVC)', desc: 'Convierte la salida HDMI del DVR en un flujo USB 3.0 de 60 fps que `/display.html` muestra a pantalla completa y en modo PiP.', type: 'box', min: [51, -19, 3.2], size: [20, 9, 6], m: 'pcbblue' },
        ],
        pipeline: [
          { id: 'dv_s1', comp: 'dvr_hdd', name: '1. Grabación Ininterrumpida 24/7 en WD Purple', desc: 'Las 4 cámaras se graban en disco continuamente sin importar qué alerta o spot esté en la TV.' },
          { id: 'dv_s2', comp: 'dvr_soc', name: '2. Generación de Cuadrícula 2×2 con Sello REC', desc: 'El procesador H.265+ arma la vista de las 4 zonas del gimnasio en tiempo real.' },
          { id: 'dv_s3', comp: 'dvr_uvc', name: '3. Inyección HDMI-a-USB 3.0 hacia `/display.html`', desc: 'La capturadora entrega el video en vivo a la Mini PC para proyectarlo en la Smart TV 55".' },
        ],
      },

      /* =====================================================================
       * 7. SMART TV 55" 4K UHD PANORÁMICA VERTICAL (CÁMARAS CCTV + PiP + ALERTAS + SPOT)
       * ===================================================================== */
      {
        id: 'smart_tv_55',
        short: '7. Smart TV 55" (CCTV + PiP + Spot)',
        label: 'Smart TV 55" 4K del Gimnasio: Cámaras CCTV 24/7 + Ventana PiP + Alertas QR/Yape + Spot Publicitario',
        lift: 24,
        desc: 'Televisor panorámico vertical de 55 pulgadas del gimnasio que reemplaza por completo a la Tablet. El 90% del tiempo muestra las 4 cámaras de seguridad a pantalla completa. Cuando un socio escanea su QR o hace un Yape, las cámaras se encogen automáticamente a un recuadro Picture-in-Picture (PiP) en la esquina inferior derecha por 5.5s mientras aparece la bienvenida o el QR de pago. Además, cada 3 minutos proyecta un Spot Publicitario de 16s con los planes del gimnasio.',
        specs: {
          'Formato Físico': 'Pantalla Panorámica Vertical 50"–55" 4K UHD conectada por HDMI',
          'Modo Base (90% tiempo)': '4 Cámaras CCTV del Gimnasio a Pantalla Completa en Vivo',
          'Alertas Prioritarias (5.5s)': 'Ingreso QR (Verde), Salida (Azul), Vencido (Rojo) y Cobro Yape/Plin con CCTV en PiP',
          'Publicidad Rotativa (16s)': 'Spot Automático cada 3 min (Planes S/5 y S/90 + App Socio) con CCTV en PiP',
        },
        parts: [
          // Pedestal y soporte doble de TV
          { name: 'Base Pedestal Metálica Smart TV 55"', type: 'box', min: [126, 20, 0], size: [68, 20, 4], m: 'steel', enc: false, nest: 'tv_sh' },
          { name: 'Columna Soporte Izquierda TV', type: 'cyl', c: [142, 30, 4], axis: [0, 0, 1], r: 2.8, len: 8, m: 'graphite', enc: false, nest: 'tv_sh' },
          { name: 'Columna Soporte Derecha TV', type: 'cyl', c: [178, 30, 4], axis: [0, 0, 1], r: 2.8, len: 8, m: 'graphite', enc: false, nest: 'tv_sh' },
          // Cuerpo Vertical Panorámico 16:9 de la Smart TV (z = 12..58, ancho 80, alto 46)
          { name: 'Chasis Pantalla Panorámica 55" 4K UHD', type: 'box', min: [120, 22, 12], size: [80, 16, 46], m: 'black', enc: true, nest: 'tv_sh' },
          // Pantalla Frontal Activa dividida en Cuadrícula CCTV + Banner Central + Recuadro PiP
          { name: 'Panel Frontal Activo 55" (Mosaico 4 Cámaras CCTV)', type: 'box', min: [123, 21.3, 15], size: [74, 0.7, 40], m: 'lcd', enc: false, nest: 'tv_sh' },
          { name: 'Divisor Horizontal Cuadrícula CCTV', type: 'box', min: [123, 21.0, 34.5], size: [74, 0.3, 1.0], m: 'dark', enc: false, nest: 'tv_sh' },
          { name: 'Divisor Vertical Cuadrícula CCTV', type: 'box', min: [159.5, 21.0, 15], size: [1.0, 0.3, 40], m: 'dark', enc: false, nest: 'tv_sh' },
          { name: 'Tarjeta Central: Bienvenida Socio QR / Spot RD Fitness', type: 'box', min: [134, 20.7, 25], size: [42, 0.4, 22], m: 'gold', enc: false, nest: 'tv_sh' },
          { name: 'Indicador Verde ACCESO PERMITIDO / YAPE OK', type: 'box', min: [138, 20.4, 42], size: [34, 0.3, 3], m: 'ledG', enc: false, nest: 'tv_sh' },
          { name: 'Ventana Flotante Picture-in-Picture (PiP 4 Cámaras)', type: 'box', min: [176, 20.5, 16.5], size: [19, 0.5, 11], m: 'ledC', enc: false, nest: 'tv_sh' },
          // Marco Superior Desmontable en Rayos-X
          { name: 'Marco Superior Ultra-Slim & Cubierta de Servicio', type: 'box', min: [120, 22, 58], size: [80, 16, 2.2], m: 'alu', enc: true, lid: true, lift: [0, 0, 24] },
        ],
        ports: [
          { id: 'hdmi_from_dvr', label: 'HDMI 1 (Bus Video DVR CCTV)', p: [120, 30, 18], n: [-1, 0, 0], kind: 'rj45' },
          { id: 'hdmi_from_pc', label: 'HDMI 2 (Desde Mini PC `/display.html`)', p: [136, 22, 16], n: [0, -1, 0], kind: 'rj45' },
        ],
        internals: [
          { id: 'tv_panel', label: 'Matriz Vertical Direct-LED 55" 4K UHD', desc: 'Panel vertical de alto brillo (450 nits) visible desde las máquinas de pesas, cardio y recepción.', type: 'box', min: [124, 24, 15], size: [72, 2.5, 38], m: 'white' },
          { id: 'tv_tcon', label: 'Placa T-CON 60Hz & Mainboard Smart TV', desc: 'Controla el refresco de los 8.3 millones de píxeles sin parpadeos durante las transiciones.', type: 'box', min: [125, 28, 15], size: [22, 7, 16], m: 'pcb' },
          { id: 'tv_switcher', label: 'Conmutador Inteligente de Escena (`display.html`)', desc: 'Escucha el stream SSE `/api/screen/stream` y da prioridad absoluta a las entradas QR (5.5s) y cobros Yape.', type: 'box', min: [150, 28, 15], size: [20, 7, 16], m: 'copper' },
          { id: 'tv_pip', label: 'Motor Picture-in-Picture (PiP CCTV en Esquina)', desc: 'Encoge suavemente las 4 cámaras a la esquina inferior derecha durante una alerta o anuncio para no perder vigilancia.', type: 'box', min: [125, 28, 34], size: [22, 7, 16], m: 'ledC' },
          { id: 'tv_rotator', label: 'Programador de Spots Publicitarios (Cada 3 min)', desc: 'Lanza automáticamente durante 16 segundos las tarifas, promociones y beneficios de RD Fitness Club y luego devuelve las cámaras a pantalla completa.', type: 'box', min: [150, 28, 34], size: [20, 7, 16], m: 'pcbblue' },
          { id: 'tv_audio', label: 'Altavoces Estéreo 20W + Sintetizador WebAudio', desc: 'Reproduce la campanilla de bienvenida, la alarma grave de membresía vencida y la fanfarria de pago Yape.', type: 'cyl', c: [184, 32, 16], axis: [0, 0, 1], r: 4.0, len: 32, m: 'brass' },
        ],
        pipeline: [
          { id: 'tv_s1', comp: 'tv_panel', name: '1. Monitoreo Base: 4 Cámaras CCTV a Pantalla Completa', desc: 'El 90% del día la TV exhibe las 4 cámaras de seguridad del gimnasio en alta definición.' },
          { id: 'tv_s2', comp: 'tv_pip', name: '2. Activación Automática de Picture-in-Picture (PiP)', desc: 'Ante un escaneo QR, cobro Yape o turno publicitario, las cámaras pasan al recuadro flotante PiP.' },
          { id: 'tv_s3', comp: 'tv_switcher', name: '3. Alerta de Bienvenida QR / Yape (5.5s)', desc: 'Muestra en grande la foto del socio, sus días restantes o el QR de Yape con aviso sonoro.' },
          { id: 'tv_s4', comp: 'tv_rotator', name: '4. Spot Publicitario Rotativo (16s) y Retorno a CCTV', desc: 'Cada 3 minutos proyecta los planes del gimnasio por 16s y restaura automáticamente las cámaras a pantalla completa.' },
        ],
      },

      /* =====================================================================
       * 8. ROUTER GATEWAY + BÓVEDA CLOUD UPSTASH REDIS & GOOGLE SHEETS
       * ===================================================================== */
      {
        id: 'cloud_vault',
        short: '8. Gateway + Bóveda Cloud Redis',
        label: 'Gateway de Fibra + Bóveda en la Nube Upstash Redis (`wise-pipefish-172734.upstash.io`)',
        lift: 24,
        desc: 'Router Gateway con 4 antenas cilíndricas de alta ganancia conectado a la Bóveda Serverless Upstash Redis y Google Sheets. Cada vez que se registra un socio, un pago o una asistencia en la Mini PC, replica el cambio en la nube cifrada para que el dueño pueda auditar su gimnasio en vivo desde su celular en cualquier lugar.',
        specs: {
          'Nube Principal': 'Upstash Redis Serverless TLS (`wise-pipefish-172734.upstash.io`)',
          'Sincronización': 'Write-Through Automático + Respaldo Local `backup-vault.json`',
          'Reportes y Avisos': 'Sincronización con Google Sheets + Boletas Digitales por WhatsApp',
          'Continuidad': 'Si se corta el internet en Chivay, opera local y sincroniza al reconectar',
        },
        parts: [
          { name: 'Chasis Gateway & Cloud Bridge', type: 'box', min: [126, -82, 0], size: [58, 38, 16], m: 'dark', enc: true, nest: 'cl_sh' },
          { name: 'Barra LED Sincronización Cloud Activa', type: 'box', min: [142, -82.5, 6], size: [26, 0.5, 2.2], m: 'ledG', enc: false, nest: 'cl_sh' },
          { name: 'Torre Cilíndrica Núcleo Cloud Vault', type: 'cyl', c: [194, -63, 0], axis: [0, 0, 1], r: 9.5, len: 28, m: 'pcbblue', enc: false, nest: 'cl_sh' },
          { name: 'Anillo Luminoso Redis Serverless', type: 'cyl', c: [194, -63, 28], axis: [0, 0, 1], r: 9.8, rTop: 7.5, len: 3, m: 'ledC', enc: false, nest: 'cl_sh' },
          { name: 'Antena Cilíndrica Wi-Fi 6 #1', type: 'cyl', c: [124, -78, 2], axis: [0, 0, 1], r: 1.4, rTop: 0.9, len: 22, m: 'black', enc: false, nest: 'cl_sh' },
          { name: 'Antena Cilíndrica Wi-Fi 6 #2', type: 'cyl', c: [124, -48, 2], axis: [0, 0, 1], r: 1.4, rTop: 0.9, len: 22, m: 'black', enc: false, nest: 'cl_sh' },
          { name: 'Antena Cilíndrica Wi-Fi 6 #3', type: 'cyl', c: [186, -78, 2], axis: [0, 0, 1], r: 1.4, rTop: 0.9, len: 22, m: 'black', enc: false, nest: 'cl_sh' },
          { name: 'Antena Cilíndrica Wi-Fi 6 #4', type: 'cyl', c: [186, -48, 2], axis: [0, 0, 1], r: 1.4, rTop: 0.9, len: 22, m: 'black', enc: false, nest: 'cl_sh' },
          { name: 'Cubierta Superior de Bóveda Cloud', type: 'box', min: [126, -82, 16], size: [58, 38, 2.0], m: 'graphite', enc: true, lid: true, lift: [0, 0, 24] },
        ],
        ports: [
          { id: 'wan_in', label: 'Enlace Gigabit TLS desde Mini PC', p: [126, -63, 6], n: [-1, 0, 0], kind: 'rj45' },
        ],
        internals: [
          { id: 'cl_pcb', label: 'Placa Gateway Fibra & Cifrado TLS 1.3', desc: 'Gestiona las conexiones HTTPS persistentes hacia Upstash Redis y Google APIs.', type: 'box', min: [129, -79, 1.5], size: [52, 32, 1.5], m: 'pcb' },
          { id: 'cl_redis', label: 'Motor Upstash Redis (`rd_fitness:vault:v4`)', desc: 'Base de datos en memoria en la nube que conserva socios, membresías, caja y asistencias.', type: 'box', min: [131, -76, 3.3], size: [15, 13, 8], m: 'ledG' },
          { id: 'cl_sync', label: 'Motor de Sincronización Híbrida Offline-First', desc: 'Encola cambios cuando no hay internet y los replica atómicamente al restablecerse la red.', type: 'box', min: [149, -76, 3.3], size: [15, 13, 8], m: 'copper' },
          { id: 'cl_sheets', label: 'Conector Google Sheets & Reportes Contables', desc: 'Mantiene actualizada la hoja de cálculo en la nube y permite reimportar socios en 1 clic.', type: 'box', min: [131, -60, 3.3], size: [20, 11, 7], m: 'pcbblue' },
          { id: 'cl_wsp', label: 'Pasarela WhatsApp (Boletas y Alertas de Vencimiento)', desc: 'Envía comprobantes digitales y recordatorios de renovación directo al WhatsApp del socio.', type: 'box', min: [166, -76, 3.3], size: [12, 27, 8], m: 'gold' },
        ],
        pipeline: [
          { id: 'cl_s1', comp: 'cl_sync', name: '1. Recepción de Réplica Cifrada TLS 1.3', desc: 'Recibe el paquete de actualización desde la Mini PC tras cada cobro o asistencia.' },
          { id: 'cl_s2', comp: 'cl_redis', name: '2. Commit Atómico en Upstash Redis Cloud', desc: 'Actualiza la bóveda `rd_fitness:vault:v4` con respaldo instantáneo fuera del local.' },
          { id: 'cl_s3', comp: 'cl_wsp', name: '3. Sincronización Móvil para el Dueño + WhatsApp', desc: 'El propietario visualiza la caja y asistencias desde su celular y envía avisos por WhatsApp.' },
        ],
      },
    ],

    /* =====================================================================
     * CABLEADO FÍSICO ORTOGONAL (100% Ejes Alineados, Cero Colisiones)
     * ===================================================================== */
    cables: [
      {
        id: 'c_scan_pc',
        from: 'scanner_2d.usb_out',
        to: 'minipc_pos.usb_scan',
        m: 'cPoe',
        w: 1.8,
        z: 2.0,
        stubA: 6,
        stubB: 6,
      },
      {
        id: 'c_pc_printer',
        from: 'minipc_pos.usb_print',
        to: 'thermal_printer.usb_in',
        m: 'cEth',
        w: 1.8,
        z: 2.0,
        stubA: 4,
        stubB: 4,
      },
      {
        id: 'c_dvr_pc',
        from: 'dvr_capture.usb_cap_out',
        to: 'minipc_pos.usb_cap',
        m: 'cCoax',
        w: 1.8,
        z: 2.0,
        stubA: 8,
        stubB: 8,
      },
      {
        id: 'c_pc_tv',
        from: 'minipc_pos.hdmi_tv',
        to: 'smart_tv_55.hdmi_from_pc',
        m: 'cWan',
        w: 1.8,
        z: 2.0,
        stubA: 8,
        stubB: 8,
        via: [[-68, -22], [-68, -32], [110, -32], [110, 10], [136, 10]],
      },
      {
        id: 'c_dvr_tv',
        from: 'dvr_capture.hdmi_tv_out',
        to: 'smart_tv_55.hdmi_from_dvr',
        m: 'cEth',
        w: 1.8,
        z: 2.0,
        stubA: 6,
        stubB: 6,
        via: [[108, -4], [108, 30]],
      },
      {
        id: 'c_pc_cloud',
        from: 'minipc_pos.wan_cloud',
        to: 'cloud_vault.wan_in',
        m: 'cPoe',
        w: 1.8,
        z: 2.0,
        stubA: 8,
        stubB: 8,
        via: [[-82, -34], [-82, -63]],
      },
    ],

    /* =====================================================================
     * TRAZADORES INTERACTIVOS DE PROCESOS DE EXTREMO A EXTREMO
     * ===================================================================== */
    traces: [
      {
        id: 'trace_qr_checkin_pip',
        label: '1. Acceso QR Instantáneo (0.1s): Celular Socio ➔ Escáner 2D ➔ Mini PC ➔ Smart TV 55" (Cámaras a PiP + Bienvenida)',
        steps: [
          { type: 'inside', dev: 'member_phone', stages: ['ph_s1', 'ph_s2', 'ph_s3'], layer: 'Credencial QR Socio', dur: 2.4, text: 'El socio muestra su Carné Digital QR en la pantalla de su celular (o su tarjeta física PVC) frente al mostrador.' },
          { type: 'link', link: 'opt_qr_beam', layer: 'Lectura Óptica 2D (60 fps)', dur: 1.4, text: 'El haz óptico antirreflejo captura el código QR en 0.1 segundos incluso con brillo de pantalla bajo.' },
          { type: 'inside', dev: 'scanner_2d', stages: ['sc_s1', 'sc_s2', 'sc_s3'], exit: 'usb_out', layer: 'Decodificación ASIC 0.1s', dur: 2.8, text: 'El sensor CMOS y el chip ASIC decodifican `RDFIT:SOCIO`, encienden el aro LED verde, emiten el beep y envían la trama por USB-HID.' },
          { type: 'cable', cable: 'c_scan_pc', dir: 1, layer: 'USB-HID Instantáneo', dur: 1.2, text: 'El código viaja por el cable USB blindado hacia la Mini PC de recepción.' },
          { type: 'inside', dev: 'minipc_pos', enter: 'usb_scan', stages: ['pc_s1', 'pc_s2'], exit: 'hdmi_tv', layer: 'Validación + Evento SSE', dur: 2.8, text: 'La Mini PC verifica la membresía activa en <2 ms, registra la asistencia y envía el evento `welcome` hacia la Smart TV.' },
          { type: 'cable', cable: 'c_pc_tv', dir: 1, layer: 'HDMI 2.0 1080p + SSE', dur: 1.6, text: 'Transmisión instantánea por el cable HDMI hacia la Smart TV de 55" del gimnasio.' },
          { type: 'inside', dev: 'smart_tv_55', enter: 'hdmi_from_pc', stages: ['tv_s1', 'tv_s2', 'tv_s3'], layer: 'Smart TV: PiP + Bienvenida 5.5s', dur: 3.4, text: 'La Smart TV pasa las 4 cámaras a la esquina flotante PiP, muestra la bienvenida con foto y días restantes durante 5.5s con sonido, y luego restaura las cámaras a pantalla completa.' },
        ],
      },
      {
        id: 'trace_sale_thermal_cloud',
        label: '2. Cobro en Caja / Yape + Boleta Térmica 80mm Negro Puro (#000000) + Respaldo en Bóveda Cloud',
        steps: [
          { type: 'inside', dev: 'minipc_pos', stages: ['pc_s2', 'pc_s3'], exit: 'usb_print', layer: 'Caja POS + Render #000000', dur: 2.6, text: 'Recepción registra la venta o membresía (Efectivo/Yape/Plin) y formatea la boleta con CSS monocromático 100% negro puro.' },
          { type: 'cable', cable: 'c_pc_printer', dir: 1, layer: 'USB ESC/POS 203 DPI', dur: 1.2, text: 'El mapa de bits de alto contraste se envía a la impresora térmica de 80mm.' },
          { type: 'inside', dev: 'thermal_printer', enter: 'usb_in', stages: ['pr_s1', 'pr_s2', 'pr_s3', 'pr_s4'], layer: 'Termo-Impresión 65g + Autocorte', dur: 3.4, text: 'El rollo cilíndrico Hansol de 65g avanza, el cabezal Rohm quema las letras y el QR con negro intenso y la guillotina corta el ticket.' },
          { type: 'inside', dev: 'minipc_pos', stages: ['pc_s4'], exit: 'wan_cloud', layer: 'Persistencia Dual', dur: 2.0, text: 'Simultáneamente, la Mini PC guarda en su SSD NVMe y despacha la copia cifrada hacia la nube.' },
          { type: 'cable', cable: 'c_pc_cloud', dir: 1, layer: 'HTTPS TLS 1.3', dur: 1.5, text: 'Enlace seguro hacia el Gateway y la Bóveda Cloud.' },
          { type: 'inside', dev: 'cloud_vault', enter: 'wan_in', stages: ['cl_s1', 'cl_s2', 'cl_s3'], layer: 'Upstash Redis + WhatsApp', dur: 3.0, text: 'Upstash Redis y Google Sheets quedan actualizados al instante y se habilita el envío del comprobante digital al WhatsApp del socio.' },
        ],
      },
      {
        id: 'trace_cctv_rotative_spot',
        label: '3. Ciclo Continuo CCTV + Publicidad: 4 Cámaras 1080p ➔ DVR + Capturadora USB ➔ Smart TV 55" (Spot Rotativo 16s con PiP)',
        steps: [
          { type: 'inside', dev: 'cctv_dome', stages: ['cm_s1', 'cm_s2', 'cm_s3'], layer: '4 Cámaras 1080p Activas', dur: 2.6, text: 'Las 4 cámaras domo infrarrojas capturan en vivo Puerta Principal, Zona Pesas, Cardio y Recepción.' },
          { type: 'link', link: 'cctv_video_link', layer: 'Video Coaxial / IP 1080p', dur: 1.3, text: 'Las señales de video llegan de forma continua al grabador DVR.' },
          { type: 'inside', dev: 'dvr_capture', stages: ['dv_s1', 'dv_s2', 'dv_s3'], exit: 'usb_cap_out', layer: 'Grabación WD Purple + Captura USB 3.0', dur: 3.0, text: 'El disco WD Purple graba 24/7 mientras la capturadora HDMI-USB 3.0 inyecta el mosaico 2×2 hacia la Mini PC.' },
          { type: 'cable', cable: 'c_dvr_pc', dir: 1, layer: 'Stream UVC 1080p60', dur: 1.4, text: 'El flujo de las 4 cámaras ingresa por USB 3.0 a la Mini PC para integrarse en `/display.html`.' },
          { type: 'inside', dev: 'dvr_capture', stages: ['dv_s2'], exit: 'hdmi_tv_out', layer: 'Bus Directo HDMI CCTV', dur: 1.8, text: 'Enlace de respaldo de video de alta definición hacia la Smart TV.' },
          { type: 'cable', cable: 'c_dvr_tv', dir: 1, layer: 'Señal Video CCTV', dur: 1.2, text: 'Llegada al panel panorámico de 55 pulgadas.' },
          { type: 'inside', dev: 'smart_tv_55', enter: 'hdmi_from_dvr', stages: ['tv_s1', 'tv_s2', 'tv_s4'], layer: 'Spot Programado 16s + Retorno CCTV', dur: 3.4, text: 'Cada 3 minutos la TV lanza automáticamente el Spot Publicitario de RD Fitness Club durante 16s (con las cámaras visibles en la esquina PiP) y al finalizar restaura las 4 cámaras a pantalla completa.' },
        ],
      },
    ],
  };
};
