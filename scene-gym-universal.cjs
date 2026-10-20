// Escena 3D de Escala Física, Arquitectura Espacial y Despiece Anatómico Realista (Anatomy3D v3.0)
// Tu Gimnasio (Marca Propia) (Calle Antonio José de Sucre Lt. 10, Chivay):
// Zona 1: Mostrador de Recepción y Caja (Escritorio con Monitor, Celular QR Socio, Escáner 2D Pedestal, Mini PC NUC Beelink, Impresora Térmica 80mm)
// Zona 2: Nivel Superior de Vigilancia CCTV (+3.2m / Losa z=+28 con Cámara Domo PTZ 1080p apuntando al ingreso)
// Zona 3: Gabinete Rack 19" de Seguridad y Red (Grabador DVR 4CH + Capturadora HDMI-USB 3.0 en 7U + Gateway Fibra Cloud Vault en 12U)
// Zona 4: Sala Principal del Gimnasio (Muro con Smart TV 55" 4K UHD Vertical: 4 Cámaras CCTV 24/7 + Ventana PiP + Bienvenida QR/Yape + Spot Publicitario Rotativo)
module.exports = function createRdFitnessScene() {
  const A = typeof Anatomy3D !== 'undefined' ? Anatomy3D : require('C:/Users/cf039/.gemini/config/skills/anatomy/kit/anatomy3d/core.js');
  const env = A.env;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // =========================================================================
  // ENTORNOS ARQUITECTÓNICOS Y ESTRUCTURALES 3D (Anatomy3D.env v3.0)
  // =========================================================================
  const environments = [
    env.officeRoom({
      id: 'env_reception',
      label: 'Zona 1 • Recepción y Caja Tu Gimnasio',
      subtitle: 'Mostrador de atención, acceso QR manos libres, Mini PC y emisión de boletas',
      at: [-176, -50],
      size: [106, 52, 26],
      z0: 0,
      backWall: false,
      leftWall: true,
      rightWall: false,
      desk: {
        x: -164,
        y: -40,
        w: 84,
        d: 16,
        h: 10,
        monitor: true,
        chair: true,
        monitorX: 36,
        chairX: 42,
      },
      badgeAt: [-122, -46, 29],
    }),
    env.rooftopMast({
      id: 'env_ceiling_cctv',
      label: 'Zona 2 • Viga Superior CCTV (+3.2m)',
      subtitle: 'Soporte elevado de cámaras domo infrarrojas apuntando al ingreso y máquinas',
      at: [-168, 8],
      size: [38, 26],
      roofZ: 28,
      mastH: 5,
      z0: 0,
      mast: false,
      badgeAt: [-149, 21, 52],
    }),
    env.rackCabinet19({
      id: 'env_rack_cctv',
      label: 'Zona 3 • Gabinete Rack 19" CCTV & Cloud',
      subtitle: 'Bastidor EIA-310 para DVR 4 Canales, Capturadora HDMI-USB y Gateway Cloud',
      at: [-62, 6],
      size: [36, 24, 36],
      z0: 0,
      shelves: [12, 22],
      badgeAt: [-44, 18, 43],
    }),
    env.officeRoom({
      id: 'env_gym_arena',
      label: 'Zona 4 • Sala Principal • Muro Smart TV 55"',
      subtitle: 'Área de entrenamiento con Smart TV 55" 4K (Cámaras CCTV 24/7 + PiP + Alertas + Spot)',
      at: [12, -50],
      size: [112, 82, 46],
      z0: 0,
      backWall: true,
      leftWall: false,
      rightWall: true,
      desk: {
        x: 32,
        y: 8,
        w: 72,
        d: 14,
        h: 10,
        monitor: false,
        chair: false,
      },
      badgeAt: [68, 28, 50],
    }),
  ];

  // Losas de cimentación del local
  const ground = [
    ...A.presets.deck('deck_reception', -182, -56, 162, 96),
    ...A.presets.deck('deck_arena', 6, -56, 124, 96),
  ];

  // =========================================================================
  // 1. SMARTPHONE / CARNÉ QR DEL SOCIO (Sobre esquina izquierda del mostrador z = 10)
  // =========================================================================
  const memberPhone = {
    id: 'member_phone',
    short: '1. Celular QR Socio (Mostrador)',
    label: 'Smartphone del Socio con Carné Digital QR (o Tarjeta PVC Tu Gimnasio)',
    category: 'sensor_iot',
    placement: 'desk',
    zone: 'env_reception',
    location: 'Mostrador de Recepción • Zona de Ingreso de Socios (z = +10)',
    realSize: '7.6 × 15.8 × 0.8 cm (Smartphone OLED / Carné PVC)',
    lift: 14,
    desc: 'Teléfono del socio presentado frente al lector en la esquina de acceso del mostrador de recepción (z = +10). Sus dimensiones físicas reales (7.6 × 15.8 cm) son las más compactas de la escena, mostrando en pantalla el Carné Digital con código QR y sello de agua de Tu Gimnasio (Marca Propia).',
    specs: {
      'Ubicación Física': 'Mostrador Recepción • Esquina Acceso (z = +10)',
      'Dimensiones Reales': '7.6 × 15.8 × 0.8 cm (Escala 1:1)',
      'Formato Credencial': 'Carné Digital PWA (`/`) o Tarjeta PVC Física',
      'Modo Offline': 'Service Worker `gym-v4.3` (abre sin internet)',
    },
    parts: [
      { name: 'Base Posicionadora de Acceso QR', type: 'box', min: [-161.0, -35.5, 10.0], size: [7.0, 5.5, 0.8], m: 'graphite', nest: 'ph_sh' },
      { name: 'Chasis Smartphone Unibody Vertical', type: 'box', min: [-160.5, -35.0, 10.8], size: [6.0, 4.5, 9.2], m: 'dark', enc: true, nest: 'ph_sh' },
      { name: 'Pantalla Frontal Super AMOLED', type: 'box', min: [-154.5, -34.5, 11.4], size: [0.2, 3.5, 8.0], m: 'lcd', nest: 'ph_sh' },
      { name: 'Código QR Dorado Activo en Pantalla', type: 'box', min: [-154.25, -33.9, 13.5], size: [0.15, 2.3, 3.2], m: 'gold', nest: 'ph_sh' },
      { name: 'Badge Verde MEMBRESÍA ACTIVA', type: 'box', min: [-154.25, -34.1, 17.6], size: [0.15, 2.7, 0.9], m: 'ledG', nest: 'ph_sh' },
      { name: 'Módulo Cámara Trasera Smartphone', type: 'cyl', c: [-160.7, -33.8, 18.2], axis: [-1, 0, 0], r: 0.65, len: 0.3, sides: 12, m: 'steel', nest: 'ph_sh' },
      { name: 'Bisel Superior Gorilla Glass (Tapa)', type: 'box', min: [-160.5, -35.0, 20.0], size: [6.0, 4.5, 0.8], m: 'alu', enc: true, lid: true, lift: [0, 0, 14] },
    ],
    ports: [],
    internals: [
      { id: 'ph_pcb', label: 'Placa Lógica Smartphone ARM64', desc: 'Ejecuta la PWA de Tu Gimnasio (Marca Propia) con estadísticas, rutinas y carné QR.', type: 'box', min: [-160.0, -34.5, 11.2], size: [1.1, 3.5, 8.2], m: 'pcb' },
      { id: 'ph_oled', label: 'Controlador Display AMOLED & Brillo', desc: 'Renderiza el vector SVG del código QR con bordes nítidos (`crispEdges`).', type: 'box', min: [-158.5, -34.4, 17.2], size: [3.4, 1.6, 2.2], m: 'ledC' },
      { id: 'ph_qr_tok', label: 'Motor de Token QR (`GYMPRO:Mxxxx`)', desc: 'Genera la credencial única vinculada al DNI y vigencia del socio.', type: 'box', min: [-158.5, -32.4, 17.2], size: [3.4, 1.6, 2.2], m: 'gold' },
      { id: 'ph_pwa', label: 'Caché Offline Service Worker (`gym-v4.3`)', desc: 'Permite abrir el carné QR en la puerta del gimnasio incluso sin señal móvil.', type: 'box', min: [-158.5, -34.4, 14.3], size: [3.4, 3.5, 2.2], m: 'pcbblue' },
      { id: 'ph_batt', label: 'Batería Polímero de Litio 5000 mAh', desc: 'Suministro energético regulado del teléfono.', type: 'box', min: [-158.5, -34.4, 11.3], size: [3.4, 3.5, 2.4], m: 'chip' },
    ],
    pipeline: [
      { id: 'ph_s1', comp: 'ph_pwa', name: '1. Apertura Instantánea del Carné PWA', desc: 'El socio abre su carné digital de Tu Gimnasio (Marca Propia) (con o sin internet).' },
      { id: 'ph_s2', comp: 'ph_qr_tok', name: '2. Despliegue de Código QR Oficial', desc: 'Se muestra el código QR de alto contraste con marca de agua del gimnasio.' },
      { id: 'ph_s3', comp: 'ph_oled', name: '3. Presentación frente al Escáner 2D', desc: 'El socio acerca su pantalla a 10 cm del lector manos libres sobre el mostrador.' },
    ],
  };

  // =========================================================================
  // 2. ESCÁNER QR 2D DE MOSTRADOR (Sobre el mostrador frente al celular z = 10)
  // =========================================================================
  const scanner2d = {
    id: 'scanner_2d',
    short: '2. Escáner QR 2D (Mostrador)',
    label: 'Lector Óptico 2D Manos Libres (Honeywell Orbit HF680 / Netum NT-2050M)',
    category: 'mesh_node',
    placement: 'desk',
    zone: 'env_reception',
    location: 'Mostrador de Recepción • Pedestal de Escaneo Frontal (z = +10)',
    realSize: '8.5 × 8.8 × 14.0 cm (Escáner 2D de Presentación)',
    lift: 14,
    desc: 'Escáner óptico 2D Imager de presentación ubicado sobre el mostrador de recepción (z = +10) mirando hacia el teléfono del socio. Tiene base circular pesada, cuello articulado y tambor óptico antirreflejo que lee pantallas con brillo mínimo o vidrio templado rajado en 0.1 segundos.',
    specs: {
      'Ubicación Física': 'Mostrador Recepción • Frente al Socio (z = +10)',
      'Dimensiones Reales': '8.5 × 8.8 × 14.0 cm (Manos Libres)',
      'Modelos Exactos': 'Netum NT-2050M o Honeywell Orbit HF680',
      'Sensor Óptico': 'CMOS 1280×800 Megapíxel (60 fps) + USB-HID',
    },
    parts: [
      { name: 'Base Circular Pesada Antideslizante', type: 'cyl', c: [-143.0, -32.8, 10.0], axis: [0, 0, 1], r: 4.2, rTop: 3.2, len: 1.4, sides: 16, m: 'black', nest: 'sc_sh' },
      { name: 'Cuello Cilíndrico Articulado', type: 'cyl', c: [-143.0, -32.8, 11.4], axis: [0, 0, 1], r: 1.6, len: 2.0, sides: 14, m: 'steel', nest: 'sc_sh' },
      { name: 'Cabezal Óptico 2D Omnidireccional', type: 'box', min: [-147.2, -36.5, 13.4], size: [8.4, 7.5, 7.6], m: 'dark', enc: true, nest: 'sc_sh' },
      { name: 'Lente Cóncavo Antirreflejo 60fps', type: 'dish', c: [-147.3, -32.8, 17.2], axis: [-1, 0, 0], R: 2.8, depth: 1.2, sides: 20, rings: 4, m: 'lcd', enc: true, nest: 'sc_sh' },
      { name: 'Aro LED Verde Confirmación 0.1s', type: 'box', min: [-147.4, -35.2, 20.1], size: [0.3, 4.8, 0.6], m: 'ledG', nest: 'sc_sh' },
      { name: 'Domo Superior Cabezal Óptico (Tapa)', type: 'box', min: [-147.2, -36.5, 21.0], size: [8.4, 7.5, 0.9], m: 'alu', enc: true, lid: true, lift: [0, 0, 14] },
    ],
    ports: [
      { id: 'usb_out', label: 'Salida Cable USB-HID a Mini PC', p: [-138.8, -32.8, 15.2], n: [1, 0, 0], kind: 'rj45' },
    ],
    internals: [
      { id: 'sc_pcb', label: 'Placa Base Óptica MIPI CSI', desc: 'Interconecta el sensor CMOS de obturador global con el decodificador ASIC.', type: 'box', min: [-146.6, -35.9, 13.8], size: [7.2, 6.3, 0.6], m: 'pcb' },
      { id: 'sc_cmos', label: 'Sensor CMOS Megapíxel 1280×800 (60 fps)', desc: 'Captura 60 imágenes por segundo sin importar si la pantalla tiene 15% de brillo.', type: 'box', min: [-146.6, -34.8, 14.8], size: [2.2, 4.0, 3.2], m: 'ledC' },
      { id: 'sc_lens', label: 'Lente Asférico Antirreflejo Celulares', desc: 'Suprime reflejos especulares en micas de vidrio templado.', type: 'cyl', c: [-143.8, -32.8, 16.4], axis: [1, 0, 0], r: 1.3, len: 2.0, sides: 12, m: 'white' },
      { id: 'sc_leds', label: 'Matriz Iluminación Blanca Cálida', desc: 'Ilumina códigos QR impresos o en pantalla sin encandilar.', type: 'box', min: [-146.6, -35.8, 18.6], size: [3.2, 6.0, 1.8], m: 'gold' },
      { id: 'sc_asic', label: 'Chip ASIC Decodificador Reed-Solomon', desc: 'Reconstruye el código `GYMPRO:SOCIO` en menos de 100 milisegundos.', type: 'box', min: [-141.4, -35.8, 14.8], size: [2.0, 3.0, 2.8], m: 'copper' },
      { id: 'sc_buzzer', label: 'Buzzer Piezoeléctrico 85 dB & USB-HID', desc: 'Emite el beep de confirmación y envía la ráfaga USB con tecla ENTER.', type: 'cyl', c: [-140.4, -30.8, 14.8], axis: [0, 0, 1], r: 1.1, len: 3.0, sides: 12, m: 'brass' },
    ],
    pipeline: [
      { id: 'sc_s1', comp: 'sc_cmos', name: '1. Captura Óptica Antirreflejo (60 fps)', desc: 'El sensor CMOS lee el QR desde el celular o carné sin rebotes de luz.' },
      { id: 'sc_s2', comp: 'sc_asic', name: '2. Decodificación Reed-Solomon en 0.1s', desc: 'El chip ASIC extrae el token del socio con cero lecturas fallidas.' },
      { id: 'sc_s3', comp: 'sc_buzzer', name: '3. Beep Verde + Envío USB-HID a Mini PC', desc: 'Suena la confirmación y transmite la trama por el cable USB sobre el escritorio.' },
    ],
  };

  // =========================================================================
  // 3. MINI PC NUC DE RECEPCIÓN (Sobre el escritorio junto al monitor del cajero z = 10)
  // =========================================================================
  const minipcPos = {
    id: 'minipc_pos',
    short: '3. Mini PC Beelink / Core i5 (Escritorio)',
    label: 'Mini PC de Recepción (Beelink Mini S12 Pro N100 / Core i5 • 16GB RAM • 512GB NVMe • Dual-HDMI)',
    category: 'modem_cpe',
    placement: 'desk',
    zone: 'env_reception',
    location: 'Mostrador de Recepción • Junto al Monitor del Cajero (z = +10)',
    realSize: '11.5 × 10.2 × 4.1 cm (Chasis Compacto Mini PC NUC)',
    lift: 14,
    desc: 'Cerebro operativo del gimnasio situado sobre el escritorio de recepción (z = +10) junto al monitor del cajero. Su chasis compacto NUC (11.5 × 10.2 cm) cuenta con botón de encendido rojo, puertos USB 3.2 azules y doble salida HDMI (una al monitor del cajero y otra hacia la Smart TV 55").',
    specs: {
      'Ubicación Física': 'Mostrador Recepción • Centro (z = +10)',
      'Dimensiones Reales': '11.5 × 10.2 × 4.1 cm (Formato NUC)',
      'Configuración': 'Intel Core i5 / N100 • 16GB RAM • 512GB NVMe',
      'Video Dual': 'HDMI 1 (Monitor Caja) + HDMI 2 (Smart TV 55")',
    },
    parts: [
      { name: 'Chasis Cúbico NUC Beelink S12 Pro', type: 'box', min: [-114.0, -37.0, 10.0], size: [12.0, 10.0, 4.4], m: 'dark', enc: true, nest: 'pc_sh' },
      { name: 'Botón Encendido Rojo Característico Beelink', type: 'box', min: [-113.0, -37.2, 11.4], size: [1.6, 0.2, 1.4], m: 'ledR', nest: 'pc_sh' },
      { name: 'Puertos Frontales USB 3.2 Gen2 Azules', type: 'box', min: [-110.5, -37.2, 11.6], size: [4.2, 0.2, 1.0], m: 'ledB', nest: 'pc_sh' },
      { name: 'LED Estado NVMe & Servidor Activo', type: 'box', min: [-105.0, -37.2, 11.9], size: [1.8, 0.2, 0.6], m: 'ledC', nest: 'pc_sh' },
      { name: 'Cubierta Superior Ventilada Grabada (Tapa)', type: 'box', min: [-114.0, -37.0, 14.4], size: [12.0, 10.0, 0.8], m: 'graphite', enc: true, lid: true, lift: [0, 0, 14] },
    ],
    ports: [
      { id: 'usb_scan', label: 'Entrada USB-HID desde Escáner 2D', p: [-114.0, -32.8, 11.8], n: [-1, 0, 0], kind: 'rj45' },
      { id: 'usb_print', label: 'Salida USB a Impresora Térmica 80mm', p: [-102.0, -32.8, 11.8], n: [1, 0, 0], kind: 'rj45' },
      { id: 'usb_cap', label: 'Entrada USB 3.0 Capturadora DVR', p: [-111.0, -27.0, 11.8], n: [0, 1, 0], kind: 'rj45' },
      { id: 'hdmi_tv', label: 'Salida HDMI 2 hacia Smart TV 55"', p: [-108.0, -27.0, 11.8], n: [0, 1, 0], kind: 'rj45' },
      { id: 'wan_cloud', label: 'Salida LAN Gigabit hacia Rack Cloud', p: [-105.0, -27.0, 11.8], n: [0, 1, 0], kind: 'rj45' },
    ],
    internals: [
      { id: 'pc_pcb', label: 'Placa Base Mini-ITX / NUC 6 Capas', desc: 'Placa compacta de alta densidad con VRM digital y protección ESD.', type: 'box', min: [-113.3, -36.3, 10.4], size: [10.6, 8.6, 0.5], m: 'pcbdark' },
      { id: 'pc_cpu', label: 'CPU Intel Core i5 / N100 + Bloque Cobre', desc: 'Ejecuta `server.js`, valida membresías en <2 ms y controla el arqueo de caja.', type: 'box', min: [-113.0, -35.8, 11.1], size: [4.2, 3.8, 2.2], m: 'copper' },
      { id: 'pc_fan', label: 'Turbina Radial Blower PWM Silenciosa', desc: 'Ventilador centrífugo que disipa el calor durante las 16h de operación diaria.', type: 'fan', c: [-110.9, -29.8, 12.0], axis: [0, 0, 1], r: 1.8, blades: 7, thick: 1.1, angle: (c) => c.time * 12, m: 'black' },
      { id: 'pc_ram', label: '16 GB RAM DDR4-3200 SO-DIMM', desc: 'Mantiene en memoria el padrón de socios, sesiones y colas SSE.', type: 'box', min: [-108.2, -35.8, 11.1], size: [3.0, 4.0, 1.8], m: 'pcbblue' },
      { id: 'pc_nvme', label: 'SSD M.2 NVMe PCIe 512 GB (`gym.json`)', desc: 'Almacenamiento local instantáneo a prueba de cortes de luz o caídas de red.', type: 'box', min: [-108.2, -31.2, 11.1], size: [3.0, 3.4, 1.5], m: 'chip' },
      { id: 'pc_io', label: 'Controladora Dual-HDMI 4K + Captura USB 3.2', desc: 'Recibe las cámaras del DVR por USB 3.0 y proyecta `/display.html` a la TV 55".', type: 'box', min: [-104.8, -35.8, 11.1], size: [2.0, 8.0, 2.0], m: 'gold' },
    ],
    pipeline: [
      { id: 'pc_s1', comp: 'pc_io', name: '1. Recepción USB-HID (QR) + Video DVR', desc: 'Recibe la trama del escáner 2D y el flujo 1080p de las 4 cámaras.' },
      { id: 'pc_s2', comp: 'pc_cpu', name: '2. Validación de Socio, Asistencia y Caja', desc: 'Verifica vigencia, registra asistencia y dispara la alerta SSE hacia la Smart TV.' },
      { id: 'pc_s3', comp: 'pc_ram', name: '3. Renderizado de Ticket #000000 Negro Puro', desc: 'Genera la boleta monocromática de alto contraste sin escalas de grises.' },
      { id: 'pc_s4', comp: 'pc_nvme', name: '4. Guardado NVMe Local + Sincro Cloud', desc: 'Persiste en el SSD M.2 en <1 ms y replica al instante hacia Upstash Redis.' },
    ],
  };

  // =========================================================================
  // 4. IMPRESORA TÉRMICA 80MM CON AUTOCORTE (Derecha del escritorio z = 10)
  // =========================================================================
  const thermalPrinter = {
    id: 'thermal_printer',
    short: '4. Impresora Térmica 80mm (#000)',
    label: 'Impresora Térmica de Boletas 80mm con Autocorte (Xprinter XP-N160II / Epson TM-T20III)',
    category: 'thermal_pos_80mm',
    placement: 'desk',
    zone: 'env_reception',
    location: 'Mostrador de Recepción • Lado Derecho de Caja (z = +10)',
    realSize: '14.0 × 19.0 × 13.8 cm (Ticketera 80mm + Rollo 65g)',
    lift: 15,
    desc: 'Impresora térmica de boletas de 80 mm situada a la derecha del cajero sobre el mostrador (z = +10). Su volumen es mayor que el de la Mini PC NUC y el lector QR, albergando en su interior el rollo cilíndrico de papel térmico Hansol de 65g, el cabezal japonés Rohm de 203 DPI y la guillotina de autocorte, con la boleta blanca saliendo hacia arriba impresa en negro intenso (#000000).',
    specs: {
      'Ubicación Física': 'Mostrador Recepción • Derecha Cajero (z = +10)',
      'Dimensiones Reales': '14.0 × 19.0 × 13.8 cm (Cuerpo Cúbico 80mm)',
      'Modelos Exactos': 'Xprinter XP-N160II (USB/LAN) o Epson TM-T20III',
      'Papel y Contraste': 'Rollo 80×80mm Hansol 65g + CSS `#000000 !important`',
    },
    parts: [
      { name: 'Cuerpo Cúbico Ticketera Térmica 80mm', type: 'box', min: [-95.0, -38.0, 10.0], size: [13.0, 12.0, 7.6], m: 'offwhite', enc: true, nest: 'pr_sh' },
      { name: 'Panel Frontal Biselado Botón FEED & LEDs', type: 'box', min: [-94.2, -38.25, 11.2], size: [11.4, 0.25, 3.2], m: 'graphite', nest: 'pr_sh' },
      { name: 'LED Verde POWER & Estado Térmico', type: 'box', min: [-86.0, -38.35, 12.4], size: [2.4, 0.2, 0.7], m: 'ledG', nest: 'pr_sh' },
      { name: 'Compuerta Superior Abatible de Papel (Tapa)', type: 'box', min: [-95.0, -38.0, 17.6], size: [13.0, 12.0, 0.9], m: 'alu', enc: true, lid: true, lift: [0, 0, 15] },
      { name: 'Labio Metálico de Salida Automática', type: 'box', min: [-92.5, -33.2, 18.5], size: [8.0, 1.0, 0.4], m: 'steel', lid: true, lift: [0, 0, 15], nest: 'pr_top' },
      { name: 'Boleta Térmica 80mm Saliendo Verticalmente', type: 'box', min: [-92.0, -33.0, 18.9], size: [7.0, 0.4, 5.2], m: 'white', lid: true, lift: [0, 0, 15], nest: 'pr_top' },
      { name: 'Texto e Importe Impreso Negro Puro (#000000)', type: 'box', min: [-91.2, -33.15, 22.0], size: [5.4, 0.2, 1.3], m: 'black', lid: true, lift: [0, 0, 15], nest: 'pr_top' },
      { name: 'Código QR de Alto Contraste en Boleta', type: 'box', min: [-90.2, -33.15, 19.5], size: [3.4, 0.2, 2.0], m: 'dark', lid: true, lift: [0, 0, 15], nest: 'pr_top' },
    ],
    ports: [
      { id: 'usb_in', label: 'Entrada USB Impresión ESC/POS', p: [-95.0, -32.8, 11.8], n: [-1, 0, 0], kind: 'rj45' },
    ],
    internals: [
      { id: 'pr_roll', label: 'Rollo Cilíndrico Papel Térmico 80mm (Hansol 65g)', desc: 'Rollo blanco de 65 g/m² con capa termosensible densa para impresión negro azabache.', type: 'cyl', c: [-93.2, -30.2, 13.8], axis: [1, 0, 0], r: 2.6, len: 9.4, sides: 18, m: 'white' },
      { id: 'pr_head', label: 'Cabezal Térmico Japonés Rohm 203 DPI', desc: '576 elementos térmicos que queman el papel al 100% de densidad sin grises.', type: 'box', min: [-93.5, -34.8, 14.4], size: [10.0, 1.4, 1.8], m: 'copper' },
      { id: 'pr_cutter', label: 'Guillotina Automática de Acero (1.5M cortes)', desc: 'Cuchilla motorizada que corta limpiamente la boleta al terminar el código QR.', type: 'box', min: [-93.5, -37.2, 14.4], size: [10.0, 1.8, 1.8], m: 'steel' },
      { id: 'pr_stepper', label: 'Motor Paso a Paso + Rodillo de Presión', desc: 'Tracciona el papel a 200 mm/s asegurando contacto firme contra el cabezal.', type: 'cyl', c: [-93.5, -35.2, 11.8], axis: [1, 0, 0], r: 1.1, len: 4.2, sides: 12, m: 'brass' },
      { id: 'pr_board', label: 'Placa ESC/POS + Fuente Estabilizada 24V 2.5A', desc: 'Impide caídas de tensión para que las letras jamás salgan tenues ni borrosas.', type: 'box', min: [-88.5, -37.2, 10.6], size: [5.0, 3.6, 2.8], m: 'pcb' },
    ],
    pipeline: [
      { id: 'pr_s1', comp: 'pr_board', name: '1. Recepción Raster Monocromático #000000', desc: 'Recibe la boleta con CSS `#000000 !important` y `contrast(200%)`.' },
      { id: 'pr_s2', comp: 'pr_roll', name: '2. Tracción de Papel Térmico Hansol 65g', desc: 'Avanza el papel de 80 mm sin atascos hacia la línea térmica.' },
      { id: 'pr_s3', comp: 'pr_head', name: '3. Impresión a Densidad Máxima (203 DPI)', desc: 'El cabezal Rohm quema letras gruesas (`font-weight: 900`) y QR nítido.' },
      { id: 'pr_s4', comp: 'pr_cutter', name: '4. Autocorte por Guillotina y Entrega', desc: 'Corta el comprobante automáticamente para entregarlo al socio.' },
    ],
  };

  // =========================================================================
  // 5. CÁMARA DOMO PTZ INFRARROJA 1080P (Montada en Viga Superior z = 28..42)
  // =========================================================================
  const cctvDome = {
    id: 'cctv_dome',
    short: '5. Cámaras Domo CCTV (+3.2m)',
    label: 'Cámaras Domo Infrarrojas 1080p del Gimnasio (Puerta, Pesas, Cardio y Caja)',
    category: 'cctv_ptz_dome',
    placement: 'rooftop',
    zone: 'env_ceiling_cctv',
    aimTo: 'scanner_2d',
    aimVec: [0.15, -1, -0.35],
    location: 'Viga Superior de Vigilancia • Nivel de Techo del Gimnasio (z = +28)',
    realSize: 'Ø 11.0 × 8.5 cm (Cámara Domo IP67 Full HD)',
    lift: 14,
    desc: 'Cámara domo infrarroja instalada en el nivel superior de techo/viga del gimnasio (z = +28) apuntando directamente hacia el mostrador de recepción y las zonas de entrenamiento. Representa los 4 canales activos (Ingreso, Pesas, Cardio y Caja) que alimentan el DVR las 24 horas.',
    specs: {
      'Ubicación Física': 'Nivel Superior Techo / Viga (z = +28)',
      'Dimensiones Reales': 'Ø 11.0 × 8.5 cm (Carcasa IP67)',
      'Orientación Óptica': 'Apuntada a Recepción e Ingreso (-Y, -Z)',
      'Resolución y Visión': 'Full HD 1080p @ 30fps + Smart-IR 30m',
    },
    frames: {
      aim: {
        dyn: false,
        fn: () => {
          const [ex, ey, ez] = A.aimBasis([0.15, -1, -0.35], 0);
          return { c: [-149.0, 14.5, 35.2], ex, ey, ez };
        },
      },
    },
    parts: [
      { name: 'Base Anclaje Estructural de Techo', type: 'cyl', c: [-149.0, 20.0, 28.0], axis: [0, 0, 1], r: 3.4, rTop: 2.0, len: 1.4, sides: 14, m: 'steel', nest: 'cm_mast' },
      { name: 'Columna Soporte Domo PTZ', type: 'cyl', c: [-149.0, 20.0, 29.4], axis: [0, 0, 1], r: 1.2, len: 2.6, sides: 14, m: 'offwhite', nest: 'cm_mast' },
      { name: 'Carcasa Blindada IP67 Cámara CCTV', type: 'box', min: [-154.0, 15.0, 32.0], size: [10.0, 9.5, 6.2], m: 'white', enc: true, nest: 'cm_body' },
      { name: 'Domo Óptico Direccional & Reflector IR', type: 'dish', frame: 'aim', c: [0, 0, 0], axis: [0, 0, 1], R: 2.2, depth: 1.0, sides: 20, rings: 4, m: 'dark', enc: true, cutaway: false, nest: 'cm_body' },
      { name: 'Anillo LEDs Infrarrojos Visión Nocturna', type: 'cyl', frame: 'aim', c: [0, 0, 0.2], axis: [0, 0, 1], r: 1.1, len: 0.4, sides: 14, m: 'ledR', nest: 'cm_body' },
      { name: 'Visera Superior Impermeable (Tapa)', type: 'box', min: [-154.0, 15.0, 38.2], size: [10.0, 9.5, 0.9], m: 'alu', enc: true, lid: true, lift: [0, 0, 14] },
    ],
    ports: [
      { id: 'coax_out', label: 'Salida Video HD-TVI / IP hacia Rack DVR', p: [-144.0, 19.5, 34.2], n: [1, 0, 0], kind: 'coax' },
    ],
    internals: [
      { id: 'cam_pcb', label: 'Placa Procesadora de Video 1080p', desc: 'Circuito impreso con supresor de transitorios y regulador de 12V.', type: 'box', min: [-153.2, 15.8, 32.4], size: [8.4, 7.8, 0.5], m: 'pcb' },
      { id: 'cam_cmos', label: 'Sensor CMOS Starlight 2MP Full HD', desc: 'Alta sensibilidad para captar cada ingreso y movimiento en el gimnasio.', type: 'box', min: [-153.0, 16.0, 33.2], size: [3.8, 3.2, 1.4], m: 'ledC' },
      { id: 'cam_lens', label: 'Lente Gran Angular 2.8mm (106°) + IR-Cut', desc: 'Lente de cristal con filtro mecánico día/noche automático.', type: 'cyl', c: [-149.0, 17.5, 36.4], axis: [0, -1, 0], r: 1.0, len: 2.2, sides: 12, m: 'brass' },
      { id: 'cam_ir', label: 'Controlador Smart-IR 30m Antideslumbramiento', desc: 'Ajusta la potencia infrarroja cuando un socio se acerca a la puerta.', type: 'box', min: [-148.6, 16.0, 33.2], size: [3.8, 3.2, 1.4], m: 'gold' },
      { id: 'cam_dsp', label: 'Procesador ISP WDR Real 120dB', desc: 'Compensa el contraluz de la calle en el local y transmite al DVR.', type: 'box', min: [-153.0, 19.8, 33.2], size: [8.0, 3.8, 1.8], m: 'copper' },
    ],
    pipeline: [
      { id: 'cm_s1', comp: 'cam_lens', name: '1. Captura en Altura (4 Zonas del Gimnasio)', desc: 'Las cámaras vigilan desde el techo Puerta Principal, Pesas, Cardio y Caja.' },
      { id: 'cm_s2', comp: 'cam_cmos', name: '2. Digitalización Starlight 1080p @ 30fps', desc: 'Genera imagen nítida en color o visión nocturna infrarroja.' },
      { id: 'cm_s3', comp: 'cam_dsp', name: '3. Procesamiento WDR y Bajada al Rack DVR', desc: 'Envía la señal de video por el cable coaxial/red hacia el Gabinete Rack 19".' },
    ],
  };

  // =========================================================================
  // 6. GRABADOR DVR 4 CANALES + CAPTURADORA HDMI-USB 3.0 (En Rack 19" Bahía 7U z = 12)
  // =========================================================================
  const dvrCapture = {
    id: 'dvr_capture',
    short: '6. DVR 4CH + Capturadora (Rack 19")',
    label: 'Grabador DVR/NVR 4 Canales + Capturadora de Video HDMI-a-USB 3.0 (Rack 19" 7U)',
    category: 'rack_1u',
    placement: 'rack',
    zone: 'env_rack_cctv',
    location: 'Gabinete Rack 19" CCTV • Bandeja Inferior 7U (z = +12)',
    realSize: '38.0 × 29.0 × 4.5 cm (Grabador DVR 1U + Capturadora USB 3.0)',
    lift: 16,
    desc: 'Grabador de seguridad de 4 canales montado en la bandeja de 7U (z = +12) del Gabinete Rack 19". En su interior destaca el plato cilíndrico del disco duro WD Purple de vigilancia 24/7 y el módulo Capturador HDMI-a-USB 3.0 que permite inyectar las cámaras en vivo dentro de `/display.html`.',
    specs: {
      'Ubicación Física': 'Gabinete Rack 19" • Bahía 7U (z = +12)',
      'Dimensiones Reales': '38.0 × 29.0 × 4.5 cm (Estándar 1U)',
      'Almacenamiento': 'Disco Duro WD Purple Surveillance 24/7 H.265+',
      'Puente de Video': 'Splitter HDMI + Capturadora HDMI-a-USB 3.0 1080p60',
    },
    parts: [
      { name: 'Chasis 19" 1U Grabador DVR 4 Canales', type: 'box', min: [-58.0, 10.0, 12.0], size: [26.0, 15.0, 5.2], m: 'black', enc: true, nest: 'dv_sh' },
      { name: 'Oreja Rack Izquierda DVR', type: 'box', min: [-59.8, 10.0, 12.5], size: [1.8, 0.5, 4.2], m: 'steel', nest: 'dv_sh' },
      { name: 'Oreja Rack Derecha DVR', type: 'box', min: [-32.0, 10.0, 12.5], size: [1.8, 0.5, 4.2], m: 'steel', nest: 'dv_sh' },
      { name: 'Indicadores LED Verdes CH1 • CH2 • CH3 • CH4', type: 'box', min: [-56.0, 9.75, 13.8], size: [9.0, 0.25, 1.2], m: 'ledG', nest: 'dv_sh' },
      { name: 'LED Rojo Grabación Continua REC 24/7', type: 'box', min: [-45.0, 9.75, 13.8], size: [3.5, 0.25, 1.2], m: 'ledR', nest: 'dv_sh' },
      { name: 'Dongle Capturadora Video HDMI-USB 3.0 Activo', type: 'box', min: [-38.5, 9.7, 13.4], size: [5.0, 0.3, 2.0], m: 'ledB', nest: 'dv_sh' },
      { name: 'Cubierta Superior Metálica DVR (Tapa)', type: 'box', min: [-58.0, 10.0, 17.2], size: [26.0, 15.0, 1.0], m: 'graphite', enc: true, lid: true, lift: [0, 0, 16] },
    ],
    ports: [
      { id: 'cam_in', label: 'Entrada Coaxial BNC desde Cámaras Domo', p: [-58.0, 19.5, 14.5], n: [-1, 0, 0], kind: 'coax' },
      { id: 'usb_cap_out', label: 'Salida Capturadora USB 3.0 a Mini PC', p: [-52.0, 10.0, 14.5], n: [0, -1, 0], kind: 'rj45' },
      { id: 'hdmi_tv_out', label: 'Salida Bus HDMI hacia Smart TV 55"', p: [-32.0, 17.5, 14.5], n: [1, 0, 0], kind: 'rj45' },
    ],
    internals: [
      { id: 'dvr_pcb', label: 'Placa Madre DVR 4CH & AFE Coaxial', desc: 'Recibe y ecualiza los 4 canales de cámaras Full HD 1080p.', type: 'box', min: [-57.2, 10.8, 12.4], size: [24.4, 13.4, 0.6], m: 'pcb' },
      { id: 'dvr_hdd', label: 'Disco Duro WD Purple 24/7 (Plato Magnético)', desc: 'Plato giratorio de aluminio diseñado para grabación continua 24/7 sin pérdida de cuadros.', type: 'cyl', c: [-51.5, 17.5, 13.2], axis: [0, 0, 1], r: 4.6, len: 2.2, sides: 20, m: 'alu' },
      { id: 'dvr_soc', label: 'SoC Codificador H.265+ Multi-Vista 2×2', desc: 'Comprime el video para el disco y genera el mosaico en vivo de las 4 cámaras.', type: 'box', min: [-44.5, 16.8, 13.2], size: [5.5, 6.2, 2.4], m: 'copper' },
      { id: 'dvr_split', label: 'Splitter HDMI Activo Dual 1080p60', desc: 'Divide la señal digital HDMI sin pérdida de brillo ni resolución.', type: 'box', min: [-38.2, 16.8, 13.2], size: [5.0, 6.2, 2.2], m: 'gold' },
      { id: 'dvr_uvc', label: 'Chip Capturador HDMI-a-USB 3.0 (UVC)', desc: 'Entrega el flujo de las 4 cámaras a la Mini PC para mostrarlo en la TV y en modo PiP.', type: 'box', min: [-44.5, 11.2, 13.2], size: [11.2, 4.6, 2.2], m: 'pcbblue' },
    ],
    pipeline: [
      { id: 'dv_s1', comp: 'dvr_hdd', name: '1. Grabación Continua 24/7 en Disco WD Purple', desc: 'Guarda las 4 cámaras en el disco duro sin interrupción aunque la TV muestre una alerta.' },
      { id: 'dv_s2', comp: 'dvr_soc', name: '2. Composición de Cuadrícula 2×2 en Vivo', desc: 'Combina Ingreso, Pesas, Cardio y Caja en una sola vista Full HD.' },
      { id: 'dv_s3', comp: 'dvr_uvc', name: '3. Inyección HDMI-a-USB 3.0 hacia Mini PC y TV', desc: 'Envía el video de vigilancia a `/display.html` para pantalla completa y esquina PiP.' },
    ],
  };

  // =========================================================================
  // 7. SMART TV 55" 4K UHD PANORÁMICA VERTICAL (En Muro Sala Principal z = 10..45)
  // =========================================================================
  const smartTv55 = {
    id: 'smart_tv_55',
    short: '7. Smart TV 55" 4K (CCTV + PiP + Spot)',
    label: 'Smart TV 55" 4K UHD del Gimnasio: Cámaras CCTV 24/7 + Ventana PiP + Alertas QR/Yape + Spot Publicitario',
    category: 'rack_4u_storage',
    placement: 'desk',
    zone: 'env_gym_arena',
    location: 'Sala Principal del Gimnasio • Muro Elevado de Monitoreo (z = +14 a +44)',
    realSize: '123.2 × 71.4 × 5.8 cm (Televisor Panorámico 55" 16:9)',
    lift: 18,
    desc: 'Gran pantalla panorámica vertical de 55 pulgadas (123.2 × 71.4 cm) instalada en el muro principal del gimnasio sobre su consola (z = +14 a +44). Es el equipo de mayor envergadura física de la escena y elimina por completo la necesidad de comprar una Tablet: muestra las 4 cámaras de seguridad el 90% del tiempo y, ante un escaneo QR, cobro Yape o Spot Publicitario programado (cada 3 min por 16s), encoge las cámaras a un recuadro Picture-in-Picture (PiP) en la esquina inferior derecha.',
    specs: {
      'Ubicación Física': 'Muro Sala Principal del Gimnasio (z = +14..+44)',
      'Dimensiones Reales': '123.2 × 71.4 × 5.8 cm (Panel 55" 4K 16:9)',
      'Modo Base (90% tiempo)': '4 Cámaras CCTV a Pantalla Completa en Vivo',
      'Interrupción & Spot': 'Bienvenida QR / Yape (5.5s) y Spot Promo (16s cada 3m) con PiP',
    },
    parts: [
      { name: 'Base Pedestal Metálica Ancha Smart TV 55"', type: 'box', min: [46.0, 11.0, 10.0], size: [44.0, 8.0, 1.4], m: 'steel', nest: 'tv_sh' },
      { name: 'Columna Soporte Izquierda TV 55"', type: 'cyl', c: [56.0, 15.0, 11.4], axis: [0, 0, 1], r: 1.5, len: 2.6, sides: 14, m: 'graphite', nest: 'tv_sh' },
      { name: 'Columna Soporte Derecha TV 55"', type: 'cyl', c: [80.0, 15.0, 11.4], axis: [0, 0, 1], r: 1.5, len: 2.6, sides: 14, m: 'graphite', nest: 'tv_sh' },
      // Gran Pantalla Vertical 55" (58 ancho x 6.5 espesor x 30 alto -> vol = 11,310)
      { name: 'Chasis Pantalla Panorámica Vertical 55" 4K', type: 'box', min: [39.0, 12.0, 14.0], size: [58.0, 6.5, 30.0], m: 'black', enc: true, nest: 'tv_sh' },
      // Mosaico 2x2 de Cámaras CCTV en la cara frontal (y = 11.6)
      { name: 'Panel Activo 55": Cuadrícula 4 Cámaras CCTV', type: 'box', min: [41.0, 11.6, 16.0], size: [54.0, 0.4, 26.0], m: 'lcd', nest: 'tv_sh' },
      { name: 'Divisor Horizontal Mosaico CCTV', type: 'box', min: [41.0, 11.45, 28.7], size: [54.0, 0.15, 0.6], m: 'dark', nest: 'tv_sh' },
      { name: 'Divisor Vertical Mosaico CCTV', type: 'box', min: [67.7, 11.45, 16.0], size: [0.6, 0.15, 26.0], m: 'dark', nest: 'tv_sh' },
      // Superposición Central Prioritaria (Bienvenida Socio QR / Cobro Yape / Spot Publicitario)
      { name: 'Tarjeta Central: Bienvenida QR / Yape / Spot Tu Gimnasio', type: 'box', min: [50.0, 11.3, 21.5], size: [30.0, 0.25, 15.0], m: 'gold', nest: 'tv_sh' },
      { name: 'Banner Superior Verde ACCESO CONCEDIDO • 24 DÍAS', type: 'box', min: [52.5, 11.15, 33.2], size: [25.0, 0.2, 2.2], m: 'ledG', nest: 'tv_sh' },
      // Ventana Picture-in-Picture (PiP) en la esquina inferior derecha
      { name: 'Recuadro Picture-in-Picture (PiP 4 Cámaras en Esquina)', type: 'box', min: [80.5, 11.2, 17.0], size: [13.5, 0.3, 7.8], m: 'ledC', nest: 'tv_sh' },
      // Bisel Superior Desmontable en Rayos-X
      { name: 'Marco Superior Ultra-Slim 55" (Tapa)', type: 'box', min: [39.0, 12.0, 44.0], size: [58.0, 6.5, 1.4], m: 'alu', enc: true, lid: true, lift: [0, 0, 18] },
    ],
    ports: [
      { id: 'hdmi_from_dvr', label: 'HDMI 1 • Bus Video desde DVR Rack', p: [39.0, 15.2, 18.0], n: [-1, 0, 0], kind: 'rj45' },
      { id: 'hdmi_from_pc', label: 'HDMI 2 • Señal `/display.html` desde Mini PC', p: [48.0, 12.0, 16.0], n: [0, -1, 0], kind: 'rj45' },
    ],
    internals: [
      { id: 'tv_panel', label: 'Matriz Vertical Direct-LED 55" 4K UHD', desc: 'Panel panorámico vertical de 450 nits visible desde todas las máquinas del gimnasio.', type: 'box', min: [41.5, 12.8, 16.0], size: [53.0, 1.2, 26.0], m: 'white' },
      { id: 'tv_tcon', label: 'Placa T-CON 60Hz & Escalador 4K', desc: 'Sincroniza los cuadros de video sin parpadeo al alternar entre CCTV y alertas.', type: 'box', min: [42.0, 14.5, 16.0], size: [15.0, 3.2, 11.5], m: 'pcb' },
      { id: 'tv_switcher', label: 'Conmutador Prioritario SSE (`display.html`)', desc: 'Recibe al instante los eventos `welcome`, `goodbye`, `denied` y `payment` desde la Mini PC.', type: 'box', min: [59.0, 14.5, 16.0], size: [15.0, 3.2, 11.5], m: 'copper' },
      { id: 'tv_pip', label: 'Motor Picture-in-Picture (PiP CCTV en Esquina)', desc: 'Reduce automáticamente las 4 cámaras a la esquina inferior derecha durante bienvenidas o anuncios.', type: 'box', min: [42.0, 14.5, 29.5], size: [15.0, 3.2, 12.0], m: 'ledC' },
      { id: 'tv_rotator', label: 'Programador de Spots Publicitarios (16s cada 3m)', desc: 'Muestra periódicamente los planes (Diario S/5, Mensual S/90, App Socio) y devuelve las cámaras a pantalla completa.', type: 'box', min: [59.0, 14.5, 29.5], size: [15.0, 3.2, 12.0], m: 'pcbblue' },
      { id: 'tv_audio', label: 'Altavoces Estéreo 20W + Campanilla WebAudio', desc: 'Emite las alertas audibles de bienvenida, vencimiento y pago Yape confirmado.', type: 'cyl', c: [86.0, 16.0, 16.5], axis: [0, 0, 1], r: 1.8, len: 24.0, sides: 14, m: 'brass' },
    ],
    pipeline: [
      { id: 'tv_s1', comp: 'tv_panel', name: '1. Estado Base (90%): 4 Cámaras CCTV a Pantalla Completa', desc: 'Muestra en vivo las 4 cámaras de seguridad del gimnasio a pantalla completa.' },
      { id: 'tv_s2', comp: 'tv_pip', name: '2. Reducción Automática de Cámaras a Esquina PiP', desc: 'Cuando ocurre un evento importante o toca publicidad, las cámaras pasan a la ventana PiP.' },
      { id: 'tv_s3', comp: 'tv_switcher', name: '3. Proyección Prioritaria: Bienvenida QR / Cobro Yape (5.5s)', desc: 'Despliega los datos del socio o el código QR de Yape/Plin con sonido y luego restaura las cámaras.' },
      { id: 'tv_s4', comp: 'tv_rotator', name: '4. Spot Publicitario Programado (16s cada 3 min)', desc: 'Anuncia los planes y promociones de Tu Gimnasio (Marca Propia) manteniendo las cámaras visibles en PiP.' },
    ],
  };

  // =========================================================================
  // 8. GATEWAY FIBRA + BÓVEDA CLOUD UPSTASH REDIS (En Rack 19" Bandeja 12U z = 22)
  // =========================================================================
  const cloudVault = {
    id: 'cloud_vault',
    short: '8. Gateway + Cloud Vault (Rack 12U)',
    label: 'Gateway de Fibra + Bóveda Cloud Upstash Redis (`cloud-cluster-tls.upstash.io`)',
    category: 'home_router',
    placement: 'rack',
    zone: 'env_rack_cctv',
    location: 'Gabinete Rack 19" • Bandeja Superior 12U (z = +22)',
    realSize: '28.0 × 18.0 × 4.4 cm (Gateway Wi-Fi 6 + Bridge Cloud Redis)',
    lift: 15,
    desc: 'Gateway de comunicaciones y puente hacia la Bóveda Cloud Upstash Redis instalado en la bandeja superior (12U, z = +22) del Gabinete Rack 19". Replica en tiempo real cada socio, pago y asistencia hacia la nube y Google Sheets.',
    specs: {
      'Ubicación Física': 'Gabinete Rack 19" • Bandeja 12U (z = +22)',
      'Dimensiones Reales': '28.0 × 18.0 × 4.4 cm (4 Antenas High-Gain)',
      'Motor Cloud': 'Upstash Redis Serverless TLS (`cloud-cluster-tls.upstash.io`)',
      'Integraciones': 'Google Sheets Contable + Comprobantes WhatsApp',
    },
    parts: [
      { name: 'Chasis Gateway Cloud Bridge', type: 'box', min: [-53.0, 12.0, 22.0], size: [16.0, 11.0, 3.8], m: 'dark', enc: true, nest: 'cl_sh' },
      { name: 'Barra LED Verde Sincronización Redis 100%', type: 'box', min: [-49.0, 11.75, 23.6], size: [8.0, 0.25, 0.6], m: 'ledG', nest: 'cl_sh' },
      { name: 'Cubierta Superior Gateway Cloud (Tapa)', type: 'box', min: [-53.0, 12.0, 25.8], size: [16.0, 11.0, 0.9], m: 'graphite', enc: true, lid: true, lift: [0, 0, 15] },
      ...[-52.0, -48.0, -42.0, -38.0].map((ax, i) => ({
        name: `Antena Externa Telemetría #${i + 1}`, type: 'box', min: [ax - 0.35, 22.3, 26.7], size: [0.7, 0.7, 5.2], m: 'black', nest: 'cl_ant',
      })),
    ],
    ports: [
      { id: 'wan_in', label: 'Entrada Gigabit LAN desde Mini PC Recepción', p: [-45.0, 12.0, 23.8], n: [0, -1, 0], kind: 'rj45' },
    ],
    internals: [
      { id: 'cl_pcb', label: 'Placa Base Gateway & Motor TLS 1.3', desc: 'Cifra los paquetes JSON hacia la nube con reconexión automática.', type: 'box', min: [-52.2, 12.8, 22.4], size: [14.4, 9.4, 0.5], m: 'pcb' },
      { id: 'cl_redis', label: 'Cliente Upstash Redis (`gympro:vault:v4`)', desc: 'Sincroniza atómicamente el estado completo del gimnasio en la nube.', type: 'box', min: [-51.8, 13.2, 23.1], size: [4.4, 4.2, 2.0], m: 'ledG' },
      { id: 'cl_sync', label: 'Cola Resiliente Offline-First', desc: 'Guarda los cambios si se cae el internet en el local y los sube al reconectar.', type: 'box', min: [-46.8, 13.2, 23.1], size: [4.4, 4.2, 2.0], m: 'copper' },
      { id: 'cl_sheets', label: 'Conector Google Sheets & Exportador Excel', desc: 'Actualiza la hoja de cálculo en línea y respalda los reportes gerenciales.', type: 'box', min: [-51.8, 18.0, 23.1], size: [6.8, 3.6, 1.8], m: 'pcbblue' },
      { id: 'cl_wsp', label: 'Pasarela de Boletas y Avisos WhatsApp', desc: 'Permite enviar comprobantes y alertas de vencimiento al celular del socio.', type: 'box', min: [-41.8, 13.2, 23.1], size: [3.6, 8.4, 2.0], m: 'gold' },
    ],
    pipeline: [
      { id: 'cl_s1', comp: 'cl_sync', name: '1. Recepción de Réplica desde Recepción', desc: 'Recibe cada nuevo pago, socio o asistencia desde la Mini PC.' },
      { id: 'cl_s2', comp: 'cl_redis', name: '2. Respaldo Instantáneo en Upstash Redis', desc: 'Actualiza la bóveda en la nube para que jamás se pierda información.' },
      { id: 'cl_s3', comp: 'cl_wsp', name: '3. Acceso Móvil para el Dueño + WhatsApp', desc: 'El propietario consulta su caja en vivo desde su celular y envía boletas por WhatsApp.' },
    ],
  };

  // =========================================================================
  // CABLEADO ESTRUCTURADO ORTOGONAL 3D (Respeta Alturas de Mostrador, Techo, Rack 19" y Muro TV)
  // =========================================================================
  const cables = [
    {
      id: 'c_scan_pc',
      from: 'scanner_2d.usb_out',
      to: 'minipc_pos.usb_scan',
      m: 'cPoe',
      w: 1.2,
      stubA: 3,
      stubB: 3,
      z: 10.6,
    },
    {
      id: 'c_pc_printer',
      from: 'minipc_pos.usb_print',
      to: 'thermal_printer.usb_in',
      m: 'cEth',
      w: 1.2,
      stubA: 2.5,
      stubB: 2.5,
      z: 10.6,
    },
    {
      id: 'c_cam_dvr',
      from: 'cctv_dome.coax_out',
      to: 'dvr_capture.cam_in',
      m: 'cCoax',
      w: 1.3,
      stubA: 4,
      stubB: 4,
      z: 28.5,
      via: [[-120, 19.5, 28.5], [-66, 19.5, 14.5]],
    },
    {
      id: 'c_dvr_pc',
      from: 'dvr_capture.usb_cap_out',
      to: 'minipc_pos.usb_cap',
      m: 'cEth',
      w: 1.3,
      stubA: 4,
      stubB: 4,
      z: 6.5,
      via: [[-52.0, -10.0, 6.5], [-111.0, -10.0, 6.5]],
    },
    {
      id: 'c_pc_tv',
      from: 'minipc_pos.hdmi_tv',
      to: 'smart_tv_55.hdmi_from_pc',
      m: 'cWan',
      w: 1.4,
      stubA: 4,
      stubB: 4,
      z: 8.4,
      via: [[-108.0, -16.0, 8.4], [48.0, -16.0, 8.4]],
    },
    {
      id: 'c_dvr_tv',
      from: 'dvr_capture.hdmi_tv_out',
      to: 'smart_tv_55.hdmi_from_dvr',
      m: 'cEth',
      w: 1.3,
      stubA: 4,
      stubB: 4,
      z: 14.5,
      via: [[18.0, 17.5, 14.5], [18.0, 15.2, 18.0]],
    },
    {
      id: 'c_pc_cloud',
      from: 'minipc_pos.wan_cloud',
      to: 'cloud_vault.wan_in',
      m: 'cPoe',
      w: 1.3,
      stubA: 4,
      stubB: 4,
      z: 11.8,
      via: [[-105.0, -4.0, 11.8], [-45.0, -4.0, 11.8]],
    },
  ];

  // =========================================================================
  // ENLACE ÓPTICO 2D EN EL MOSTRADOR DE RECEPCIÓN
  // =========================================================================
  const links = {
    opt_qr_beam: {
      from: 'member_phone',
      to: 'scanner_2d',
      label: 'Haz Óptico 2D Antirreflejo (0.1s)',
      fresnel: true,
      radius: 2.2,
      color: 'rgba(245, 180, 0, 0.75)',
      pulseColor: '#f5b400',
      pulses: 5,
      path: () => [
        [-154.2, -32.8, 15.8],
        [-147.3, -32.8, 17.2],
      ],
    },
  };

  // =========================================================================
  // TRAZADORES INTERACTIVOS DE PROCESOS DE EXTREMO A EXTREMO
  // =========================================================================
  const traces = [
    {
      id: 'trace_qr_checkin_pip',
      label: '1. Ingreso QR Instantáneo (0.1s): Celular Socio ➔ Escáner 2D ➔ Mini PC ➔ Smart TV 55" (Cámaras a PiP + Bienvenida)',
      steps: [
        { type: 'inside', dev: 'member_phone', stages: ['ph_s1', 'ph_s2', 'ph_s3'], layer: 'Carné QR del Socio', dur: 2.4, text: 'El socio acerca la pantalla de su celular (o tarjeta PVC) a la esquina del mostrador de recepción.' },
        { type: 'link', link: 'opt_qr_beam', layer: 'Óptico 2D 60fps (0.1s)', dur: 1.3, text: 'El lector 2D captura el código QR en 0.1 segundos sin importar si la pantalla tiene brillo bajo o vidrio templado.' },
        { type: 'inside', dev: 'scanner_2d', stages: ['sc_s1', 'sc_s2', 'sc_s3'], exit: 'usb_out', layer: 'Decodificación ASIC', dur: 2.6, text: 'El chip ASIC decodifica `GYMPRO:SOCIO`, enciende el LED verde, emite el beep y lo envía por USB-HID.' },
        { type: 'cable', cable: 'c_scan_pc', dir: 1, layer: 'Cable USB-HID Mostrador', dur: 1.1, text: 'La lectura viaja sobre el escritorio hacia la Mini PC de recepción.' },
        { type: 'inside', dev: 'minipc_pos', enter: 'usb_scan', stages: ['pc_s1', 'pc_s2'], exit: 'hdmi_tv', layer: 'Validación + Evento SSE', dur: 2.6, text: 'La Mini PC verifica la vigencia del socio en <2 ms, registra la asistencia y lanza el evento `welcome` hacia la Smart TV.' },
        { type: 'cable', cable: 'c_pc_tv', dir: 1, layer: 'Cable HDMI 2.0 a Sala Principal', dur: 1.5, text: 'La señal viaja desde el mostrador hasta la Smart TV de 55" en el muro principal del gimnasio.' },
        { type: 'inside', dev: 'smart_tv_55', enter: 'hdmi_from_pc', stages: ['tv_s1', 'tv_s2', 'tv_s3'], layer: 'Smart TV 55": PiP + Bienvenida 5.5s', dur: 3.4, text: 'La Smart TV pasa las 4 cámaras a la esquina flotante PiP, muestra la bienvenida con foto y días restantes durante 5.5s, y luego devuelve las cámaras a pantalla completa.' },
      ],
    },
    {
      id: 'trace_sale_thermal_cloud',
      label: '2. Cobro en Caja / Yape + Boleta Térmica 80mm Negro Puro (#000000) + Respaldo en Rack Cloud',
      steps: [
        { type: 'inside', dev: 'minipc_pos', stages: ['pc_s2', 'pc_s3'], exit: 'usb_print', layer: 'POS Caja + Render #000000', dur: 2.6, text: 'Recepción registra la membresía o venta (Efectivo/Yape/Plin) y genera la boleta monocromática 100% negro puro.' },
        { type: 'cable', cable: 'c_pc_printer', dir: 1, layer: 'USB ESC/POS 203 DPI', dur: 1.1, text: 'El ticket de alto contraste pasa a la impresora térmica ubicada a la derecha del cajero.' },
        { type: 'inside', dev: 'thermal_printer', enter: 'usb_in', stages: ['pr_s1', 'pr_s2', 'pr_s3', 'pr_s4'], layer: 'Impresión Hansol 65g + Autocorte', dur: 3.2, text: 'El rollo de 80mm avanza, el cabezal japonés Rohm quema las letras y el QR en negro intenso y la guillotina corta la boleta.' },
        { type: 'inside', dev: 'minipc_pos', stages: ['pc_s4'], exit: 'wan_cloud', layer: 'Replicación Híbrida', dur: 2.0, text: 'Al mismo tiempo, la Mini PC guarda en su SSD NVMe y envía la réplica hacia el Gabinete Rack 19".' },
        { type: 'cable', cable: 'c_pc_cloud', dir: 1, layer: 'Enlace Gigabit a Rack 12U', dur: 1.4, text: 'Subida hacia el Gateway de Fibra y Bóveda Cloud en la bandeja superior del Rack.' },
        { type: 'inside', dev: 'cloud_vault', enter: 'wan_in', stages: ['cl_s1', 'cl_s2', 'cl_s3'], layer: 'Upstash Redis + WhatsApp', dur: 2.8, text: 'Upstash Redis y Google Sheets quedan respaldados al instante para que el dueño vea sus ingresos desde su celular.' },
      ],
    },
    {
      id: 'trace_cctv_rotative_spot',
      label: '3. Vigilancia CCTV + Publicidad Rotativa: Cámara Domo (+3.2m) ➔ Rack DVR ➔ Mini PC ➔ Smart TV 55" (Spot 16s con PiP)',
      steps: [
        { type: 'inside', dev: 'cctv_dome', stages: ['cm_s1', 'cm_s2', 'cm_s3'], exit: 'coax_out', layer: 'Cámara Domo 1080p en Techo', dur: 2.6, text: 'Las cámaras instaladas en la viga superior (+3.2m) capturan en vivo Ingreso, Pesas, Cardio y Recepción.' },
        { type: 'cable', cable: 'c_cam_dvr', dir: 1, layer: 'Bajada Coaxial / IP a Rack 19"', dur: 1.4, text: 'El video baja desde el techo hasta la bahía 7U del Gabinete Rack 19".' },
        { type: 'inside', dev: 'dvr_capture', enter: 'cam_in', stages: ['dv_s1', 'dv_s2', 'dv_s3'], exit: 'usb_cap_out', layer: 'Disco WD Purple + Captura USB 3.0', dur: 3.0, text: 'El DVR graba 24/7 en el disco WD Purple y su capturadora HDMI-USB 3.0 envía el mosaico 2×2 hacia la Mini PC.' },
        { type: 'cable', cable: 'c_dvr_pc', dir: 1, layer: 'Stream USB 3.0 UVC 1080p60', dur: 1.4, text: 'El flujo de las 4 cámaras llega a la Mini PC para integrarse en `/display.html`.' },
        { type: 'inside', dev: 'dvr_capture', stages: ['dv_s2'], exit: 'hdmi_tv_out', layer: 'Bus HDMI Directo CCTV', dur: 1.8, text: 'Canal HDMI directo de respaldo hacia la pantalla principal.' },
        { type: 'cable', cable: 'c_dvr_tv', dir: 1, layer: 'Enlace HDMI a Muro Principal', dur: 1.3, text: 'Transmisión continua hacia la Smart TV de 55 pulgadas.' },
        { type: 'inside', dev: 'smart_tv_55', enter: 'hdmi_from_dvr', stages: ['tv_s1', 'tv_s2', 'tv_s4'], layer: 'Spot Publicitario 16s + CCTV PiP', dur: 3.4, text: 'Cada 3 minutos la Smart TV proyecta durante 16 segundos el Spot Publicitario de Tu Gimnasio (Marca Propia) (manteniendo las cámaras en la esquina PiP) y luego regresa a las 4 cámaras a pantalla completa.' },
      ],
    },
  ];

  return {
    fig: 'FIG 01 • ARQUITECTURA FÍSICA, ESPACIAL Y ANATÓMICA 3D A ESCALA REAL • PROGYM 360° • TU GIMNASIO (v3.0)',
    title: 'Tu Gimnasio (Marca Propia) a Escala Real: Mostrador de Recepción ➔ Techo CCTV (+3.2m) ➔ Rack 19" ➔ Smart TV 55" PiP',
    subtitle: 'Simulador Espacial y Anatómico 3D v3.0 • Ambientes Reales, Proporción Física Exacta, Boletas #000 y Smart TV con Cámaras + Publicidad Rotativa',
    hint: 'ARRASTRA PARA ORBITAR 3D • RUEDA PARA ZOOM ANATÓMICO • BOTÓN "🏢 ENTORNO" MUESTRA/OCULTA OFICINAS, ESCRITORIO Y RACK 19"',
    worldSpan: 340,
    defaultDevice: 'smart_tv_55',
    camera: { az: -1.16, el: 0.44, zoom: 1.05, target: [-28, -8, 18] },

    banners: [
      { pos: [-122, -62, 0], text: 'ZONA RECEPCIÓN Y CAJA (ESCRITORIO + TECHO CCTV + RACK 19")', color: '#f5b400' },
      { pos: [68, -62, 0], text: 'SALA PRINCIPAL DEL GIMNASIO (MURO SMART TV 55" 4K + PiP)', color: '#27e6ff' },
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
      { key: 'printDensity', label: 'Densidad Térmica Boleta (#000000)', min: 85, max: 100, step: 5, fmt: (v) => `${v}% Negro Puro` },
      {
        key: 'tvMode',
        label: 'Modo Activo en Smart TV 55"',
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
        c_cam_dvr: 0.95,
        c_dvr_pc: 0.95,
        c_pc_tv: act,
        c_dvr_tv: 0.95,
        c_pc_cloud: act * 0.85,
      };

      return { scanMs, cctvFullPct };
    },

    kpis(state, tel) {
      return [
        { label: 'Lectura Escáner 2D', value: `${tel.scanMs} ms (0.1s)`, tone: 'good' },
        { label: 'Contraste Boleta 80mm', value: `${state.printDensity}% #000000`, tone: state.printDensity >= 95 ? 'good' : 'warn' },
        { label: 'Smart TV 55" CCTV + PiP', value: `${tel.cctvFullPct}% Full / 100% Vig.`, tone: 'good' },
        { label: 'Spot Publicitario TV', value: `16s cada ${state.promoIntervalMin} min`, tone: 'good' },
        { label: 'Rack 19" + Cloud Vault', value: '100% Sincronizado', tone: 'good' },
      ];
    },

    readout(state, tel) {
      return `MOSTRADOR z=+10 | TECHO CCTV z=+28 | RACK 19" 7U/12U | SMART TV 55": ${tel.cctvFullPct}% CCTV + PiP | BOLETA: ${state.printDensity}% #000`;
    },

    environments,
    ground,
    links,
    devices: [
      memberPhone,
      scanner2d,
      minipcPos,
      thermalPrinter,
      cctvDome,
      dvrCapture,
      smartTv55,
      cloudVault,
    ],
    cables,
    traces,
  };
};
