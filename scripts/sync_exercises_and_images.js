const fs = require('fs');
const path = require('path');
const https = require('https');

const rootDir = path.join(__dirname, '..');
const exFilePath = path.join(rootDir, 'data', 'exercises.json');
const exdbPath = path.join(rootDir, 'exdb.json');
const publicExDir = path.join(rootDir, 'public', 'ex');

const exdb = JSON.parse(fs.readFileSync(exdbPath, 'utf8'));
const exdbMap = new Map(exdb.map(e => [e.id, e]));

// Mapping for the 40 existing exercises that need images downloaded
const fixMap = {
  Dips_Chest: 'Dips_-_Chest_Version',
  Decline_Barbell_Press: 'Decline_Barbell_Bench_Press',
  Low_Cable_Crossover: 'Low_Cable_Crossover',
  Dumbbell_Pullover: 'Straight-Arm_Dumbbell_Pullover',
  T_Bar_Row: 'T-Bar_Row_with_Handle',
  Close_Grip_Lat_Pulldown: 'Close-Grip_Front_Lat_Pulldown',
  Incline_Dumbbell_Row: 'Dumbbell_Incline_Row',
  Straight_Arm_Cable_Pulldown: 'Straight-Arm_Pulldown',
  Overhead_Press_Barbell: 'Standing_Military_Press',
  Arnold_Dumbbell_Press: 'Arnold_Dumbbell_Press',
  Dumbbell_Rear_Delt_Fly: 'Seated_Bent-Over_Rear_Delt_Raise',
  Cable_Rear_Delt_Fly: 'Cable_Rear_Delt_Fly',
  Bulgarian_Split_Squat: 'Split_Squat_with_Dumbbells',
  Hack_Squat: 'Hack_Squat',
  Sumo_Deadlift: 'Sumo_Deadlift',
  Seated_Leg_Curl: 'Seated_Leg_Curl',
  Adductor_Machine: 'Thigh_Adductor',
  Abductor_Machine: 'Thigh_Abductor',
  Seated_Calf_Raise: 'Seated_Calf_Raise',
  Cable_Glute_Kickback: 'One-Legged_Cable_Kickback',
  Dumbbell_Step_Up: 'Dumbbell_Step_Ups',
  Single_Leg_Hip_Thrust: 'Barbell_Glute_Bridge',
  Preacher_Curl: 'Preacher_Curl',
  Bicep_Curl_21s: 'Close-Grip_Standing_Barbell_Curl',
  Concentration_Curl: 'Concentration_Curls',
  Cable_Bicep_Curl: 'Standing_Biceps_Cable_Curl',
  Close_Grip_Bench_Press: 'Close-Grip_Barbell_Bench_Press',
  Bench_Dips: 'Bench_Dips',
  Skull_Crushers: 'EZ-Bar_Skullcrusher',
  Barbell_Wrist_Curl: 'Palms-Up_Barbell_Wrist_Curl_Over_A_Bench',
  Reverse_Barbell_Curl: 'Reverse_Barbell_Curl',
  Dumbbell_Shrugs: 'Dumbbell_Shrug',
  Ab_Wheel_Rollout: 'Ab_Roller',
  Hanging_Knee_Raise: 'Hanging_Leg_Raise',
  Cable_Rope_Crunch: 'Cable_Crunch',
  Burpees: 'Freehand_Jump_Squat',
  Lat_Prayer_Cable: 'Rope_Straight-Arm_Pulldown',
  Incline_Chest_Cable_Fly: 'Incline_Cable_Flye',
  Bayesian_Cable_Curl: 'Standing_One-Arm_Cable_Curl',
  Farmers_Walk: 'Farmers_Walk'
};

// 37 brand-new exercises across all muscle groups (all IDs verified in exdb.json)
const newExercises = [
  // PECHO (4)
  {
    id: 'Butterfly',
    nombre: 'Aperturas en máquina Pec Deck (Contractora)',
    grupo: 'Pecho',
    tipo: 'aislamiento',
    equipo: 'Máquina contractora (Pec Deck)',
    nivel: 'principiante',
    musculos: 'Pectoral mayor (porción esternal e interna), deltoides anterior',
    efecto: 'Aisla el pectoral manteniendo tensión constante incluso en el punto de máxima contracción central.',
    pasos: [
      'Ajusta el asiento para que los agarres queden exactamente a la altura media de tu pecho.',
      'Siéntate con la espalda completamente pegada al respaldo y toma los manerales con los codos ligeramente flexionados.',
      'Exhala y junta los brazos frente a tu pecho en un arco fluido.',
      'Sostén la contracción isométrica en el centro durante 1 a 2 segundos apretando el pecho.',
      'Inhala y abre los brazos controladamente hasta sentir un estiramiento profundo sin que las placas choquen.'
    ],
    errores: [
      'Despegar la espalda o adelantar los hombros al cerrar los brazos.',
      'Llevar los brazos demasiado atrás forzando la cápsula anterior del hombro.'
    ],
    consejo: 'Enfócate en empujar con la parte interna de los codos en lugar de apretar con exceso las manos.',
    variante: 'Aperturas en polea alta o con mancuernas en banco plano.',
    imagenes: ['/ex/Butterfly/0.jpg', '/ex/Butterfly/1.jpg'],
    ingles: 'Butterfly / Pec Deck'
  },
  {
    id: 'Cable_Chest_Press',
    nombre: 'Press de pecho en poleas de pie',
    grupo: 'Pecho',
    tipo: 'hipertrofia',
    equipo: 'Poleas dobles a media altura',
    nivel: 'intermedio',
    musculos: 'Pectoral mayor, deltoides anterior, tríceps, core estabilizador',
    efecto: 'Combina el empuje horizontal de hipertrofia con convergencia natural de brazos y activación del core.',
    pasos: [
      'Ajusta ambas poleas a la altura del pecho y coloca manerales individuales.',
      'Da un paso al frente colocando un pie adelantado en posición de tijera para máxima estabilidad.',
      'Empuja ambos manerales hacia adelante haciendo que converjan ligeramente frente al centro de tu pecho.',
      'Aprieta los pectorales al extender los brazos sin bloquear bruscamente los codos.',
      'Regresa despacio hasta que las manos lleguen a la línea del pecho.'
    ],
    errores: [
      'Perder el equilibrio por no adelantar una pierna de apoyo.',
      'Encoger los trapecios hacia las orejas durante el empuje.'
    ],
    consejo: 'Cruza ligeramente una muñeca sobre otra al final si buscas máxima contracción de las fibras internas.',
    variante: 'Sentado en banco a 75 grados frente a las poleas para mayor aislamiento.',
    imagenes: ['/ex/Cable_Chest_Press/0.jpg', '/ex/Cable_Chest_Press/1.jpg'],
    ingles: 'Cable Chest Press'
  },
  {
    id: 'Barbell_Incline_Bench_Press_-_Medium_Grip',
    nombre: 'Press inclinado con barra (agarre medio)',
    grupo: 'Pecho',
    tipo: 'fuerza',
    equipo: 'Barra olímpica y banco inclinado',
    nivel: 'intermedio',
    musculos: 'Pectoral superior (haz clavicular), deltoides anterior, tríceps',
    efecto: 'Constructor fundamental de masa y fuerza para la parte superior del pecho bajo la clavícula.',
    pasos: [
      'Recuéstate en el banco inclinado (30 a 45 grados) apoyando firmemente los pies en el piso.',
      'Sujeta la barra con un agarre ligeramente mayor al ancho de los hombros y retrae las escápulas.',
      'Saca la barra del soporte y bájala de forma controlada hacia la parte alta del esternón (bajo las clavículas).',
      'Haz una breve pausa rozando el pecho sin rebotar.',
      'Empuja con potencia hacia arriba exhalando el aire.'
    ],
    errores: [
      'Abrir los codos a 90 grados respecto al torso (mantenlos a unos 45-60 grados).',
      'Levantar los glúteos del asiento para ayudar a subir el peso.'
    ],
    consejo: 'Un ángulo de banco cercano a 30 grados maximiza el pectoral superior sin transferir demasiado trabajo al hombro.',
    variante: 'En máquina Smith inclinada o con mancuernas.',
    imagenes: ['/ex/Barbell_Incline_Bench_Press_-_Medium_Grip/0.jpg', '/ex/Barbell_Incline_Bench_Press_-_Medium_Grip/1.jpg'],
    ingles: 'Barbell Incline Bench Press'
  },
  {
    id: 'Cable_Iron_Cross',
    nombre: 'Cruz de hierro en polea alta (Iron Cross)',
    grupo: 'Pecho',
    tipo: 'aislamiento',
    equipo: 'Poleas altas dobles',
    nivel: 'intermedio',
    musculos: 'Pectoral inferior y externo, serrato anterior',
    efecto: 'Define el corte inferior del pectoral mediante aducción escapular y humeral descendente.',
    pasos: [
      'Párate exactamente en el centro de dos poleas altas tomando los manerales con brazos abiertos en cruz.',
      'Inclina levemente el tronco hacia adelante y mantén el abdomen firme.',
      'Tira de los manerales hacia abajo y adentro hasta cruzarlos frente a tu cadera.',
      'Sostén la contracción máxima apretando la base del pecho por 1 segundo.',
      'Regresa controladamente a la posición de brazos en cruz.'
    ],
    errores: [
      'Doblar excesivamente los codos convirtiendo el ejercicio en un fondo de tríceps.',
      'Balancear el cuerpo para vencer el peso.'
    ],
    consejo: 'Usa un peso moderado que te permita sentir cada fibra del pectoral inferior al bajar los brazos.',
    variante: 'Cruce de poleas tradicional a media altura.',
    imagenes: ['/ex/Cable_Iron_Cross/0.jpg', '/ex/Cable_Iron_Cross/1.jpg'],
    ingles: 'Cable Iron Cross'
  },

  // ESPALDA (4)
  {
    id: 'Chin-Up',
    nombre: 'Dominadas supinas (Chin-Ups)',
    grupo: 'Espalda',
    tipo: 'fuerza',
    equipo: 'Barra de dominadas',
    nivel: 'intermedio',
    musculos: 'Dorsal ancho, bíceps braquial, romboides, core',
    efecto: 'Gran estiramiento y contracción del dorsal ancho con fuerte reclutamiento sinérgico de los bíceps.',
    pasos: [
      'Cuelga de la barra con las palmas mirando hacia ti (agarre supino) al ancho de los hombros.',
      'Activa las escápulas tirando de los hombros hacia abajo lejos de las orejas.',
      'Tracciona tu cuerpo hacia arriba llevando los codos hacia las costillas hasta que la barbilla supere la barra.',
      'Aprieta dorsales y bíceps en la cima un instante.',
      'Desciende de manera controlada hasta extender los brazos por completo.'
    ],
    errores: [
      'Hacer medias repeticiones sin bajar por completo.',
      'Impulsarse pateando con las piernas (kipping) sin control.'
    ],
    consejo: 'Piensa en llevar el pecho hacia la barra sacando el esternón en lugar de estirar el cuello.',
    variante: 'Con banda elástica de asistencia si aún no logras 6 repeticiones estrictas, o con lastre.',
    imagenes: ['/ex/Chin-Up/0.jpg', '/ex/Chin-Up/1.jpg'],
    ingles: 'Chin-Up'
  },
  {
    id: 'Inverted_Row',
    nombre: 'Remo invertido en barra (Australian Pull-Up)',
    grupo: 'Espalda',
    tipo: 'fuerza',
    equipo: 'Barra en rack o Multipower',
    nivel: 'principiante',
    musculos: 'Espalda media, romboides, dorsal ancho, deltoides posterior, bíceps',
    efecto: 'Excelente ejercicio de tracción horizontal con peso corporal para fortalecer postura y preparar dominadas.',
    pasos: [
      'Coloca una barra asegurada a la altura de tu cintura y sitúate debajo de ella boca arriba.',
      'Sujeta la barra con agarre prono un poco más ancho que los hombros y estira el cuerpo en línea recta apoyado en los talones.',
      'Aprieta glúteos y abdomen para que tu cuerpo no se hunda.',
      'Tira con los codos hacia el suelo llevando el pecho hasta tocar la barra.',
      'Baja con control manteniendo el cuerpo rígido como una tabla.'
    ],
    errores: [
      'Dejar caer la cadera perdiendo la línea recta entre tobillos, cadera y hombros.',
      'Adelantar la cabeza para tocar la barra con la barbilla en vez del pecho.'
    ],
    consejo: 'Cuanto más baja esté la barra (cuerpo más horizontal), más exigente será el ejercicio.',
    variante: 'Flexiona las rodillas apoyando las plantas de los pies para reducir la dificultad.',
    imagenes: ['/ex/Inverted_Row/0.jpg', '/ex/Inverted_Row/1.jpg'],
    ingles: 'Inverted Row'
  },
  {
    id: 'Bent_Over_Two-Dumbbell_Row',
    nombre: 'Remo inclinado con dos mancuernas',
    grupo: 'Espalda',
    tipo: 'hipertrofia',
    equipo: 'Mancuernas',
    nivel: 'intermedio',
    musculos: 'Dorsal ancho, romboides, trapecio medio, erectores espinales',
    efecto: 'Permite un recorrido libre y simétrico de ambas escápulas para ganar densidad en toda la espalda.',
    pasos: [
      'Toma un par de mancuernas, flexiona las rodillas y lleva la cadera atrás inclinando el torso a 45 grados.',
      'Mantén la espalda recta, pecho afuera y mirada al suelo a un metro delante de ti.',
      'Tracciona ambas mancuernas hacia la cadera pegando los codos al cuerpo.',
      'Junta los omóplatos con fuerza en la parte superior.',
      'Desciende las mancuernas controladamente estirando los dorsales.'
    ],
    errores: [
      'Curvar la zona lumbar por falta de bisagra de cadera.',
      'Subir las mancuernas hacia los hombros encogiendo el cuello.'
    ],
    consejo: 'Gira las palmas para que se miren entre sí (agarre neutro) para proteger los hombros y activar más el dorsal bajo.',
    variante: 'Con palmas hacia arriba (agarre supino) o apoyando la frente en el respaldo de un banco inclinado.',
    imagenes: ['/ex/Bent_Over_Two-Dumbbell_Row/0.jpg', '/ex/Bent_Over_Two-Dumbbell_Row/1.jpg'],
    ingles: 'Bent Over Two-Dumbbell Row'
  },
  {
    id: 'Kneeling_Single-Arm_High_Pulley_Row',
    nombre: 'Jalón unilateral arrodillado en polea alta',
    grupo: 'Espalda',
    tipo: 'aislamiento',
    equipo: 'Polea alta con maneral individual',
    nivel: 'intermedio',
    musculos: 'Dorsal ancho (fibras ilíacas e inferiores), redondo mayor',
    efecto: 'Alinea perfectamente el cable con la dirección de las fibras del dorsal ancho para una contracción máxima sin asimetrías.',
    pasos: [
      'Coloca un maneral individual en la polea alta y arrodíllate sobre una rodilla a un paso de distancia.',
      'Toma el maneral con el brazo del mismo lado de la rodilla apoyada en el suelo.',
      'Deja que el peso estire tu brazo y escápula hacia arriba y adelante sin girar el tronco.',
      'Exhala y jala el codo hacia tu cadera describiendo un arco descendente pegado al costado.',
      'Pausa 1 segundo apretando el dorsal bajo y regresa despacio.'
    ],
    errores: [
      'Rotar excesivamente el torso para jalar más peso.',
      'Separar el codo del cuerpo perdiendo tensión en el dorsal.'
    ],
    consejo: 'Coloca tu mano libre sobre tu dorsal trabajando para sentir físicamente cómo se contrae en cada repetición.',
    variante: 'Sentado en banco frente a la polea media.',
    imagenes: ['/ex/Kneeling_Single-Arm_High_Pulley_Row/0.jpg', '/ex/Kneeling_Single-Arm_High_Pulley_Row/1.jpg'],
    ingles: 'Kneeling Single-Arm High Pulley Row'
  },

  // HOMBROS (4)
  {
    id: 'Band_Pull_Apart',
    nombre: 'Separación de banda para hombro posterior (Band Pull-Apart)',
    grupo: 'Hombros',
    tipo: 'aislamiento',
    equipo: 'Banda elástica',
    nivel: 'principiante',
    musculos: 'Deltoides posterior, romboides, trapecio medio, manguito rotador',
    efecto: 'Fortalece la salud articular del hombro, corrige los hombros caídos hacia adelante y activa la espalda alta.',
    pasos: [
      'Párate erguido sosteniendo una banda elástica frente a ti a la altura de los hombros con brazos extendidos.',
      'Mantén los hombros bajos (lejos de las orejas) y el abdomen firme.',
      'Exhala y abre los brazos hacia los lados estirando la banda hasta que toque tu pecho.',
      'Aprieta los omóplatos y la parte posterior del hombro por 1 segundo.',
      'Regresa lentamente sin perder la tensión de la banda.'
    ],
    errores: [
      'Arquear la espalda baja al abrir los brazos.',
      'Doblar y estirar los codos convirtiéndolo en una extensión de tríceps.'
    ],
    consejo: 'Excelente para realizar 2 series de 15-20 repeticiones antes de cualquier día de press de banca o hombro.',
    variante: 'Con agarre supino (palmas hacia arriba) para enfatizar la rotación externa del hombro.',
    imagenes: ['/ex/Band_Pull_Apart/0.jpg', '/ex/Band_Pull_Apart/1.jpg'],
    ingles: 'Band Pull Apart'
  },
  {
    id: 'Bent_Over_Low-Pulley_Side_Lateral',
    nombre: 'Elevación posterior unilateral en polea baja',
    grupo: 'Hombros',
    tipo: 'aislamiento',
    equipo: 'Polea baja con maneral',
    nivel: 'intermedio',
    musculos: 'Deltoides posterior, infraespinoso, trapecio medio',
    efecto: 'Tensión continua desde el inicio del recorrido para dar redondez 3D a la cara posterior del hombro.',
    pasos: [
      'Sitúate de lado frente a una polea baja e inclina el torso hacia adelante hasta quedar casi paralelo al suelo.',
      'Apoya tu mano libre sobre la rodilla o un banco para dar soporte a la espalda baja.',
      'Toma el maneral cruzando el brazo por debajo del pecho y elévalo lateralmente hacia arriba con el codo ligeramente flexionado.',
      'Sube hasta que el brazo quede alineado con tu espalda y regresa controladamente.'
    ],
    errores: [
      'Balancear el torso hacia arriba para lanzar el cable con inercia.',
      'Usar demasiado peso encogiendo el trapecio.'
    ],
    consejo: 'Guía el movimiento con el meñique o la parte externa del codo para aislar el deltoides posterior.',
    variante: 'Con mancuerna a un brazo apoyado en banco.',
    imagenes: ['/ex/Bent_Over_Low-Pulley_Side_Lateral/0.jpg', '/ex/Bent_Over_Low-Pulley_Side_Lateral/1.jpg'],
    ingles: 'Bent Over Low-Pulley Side Lateral'
  },
  {
    id: 'Alternating_Deltoid_Raise',
    nombre: 'Elevaciones alternadas frontales y laterales con mancuernas',
    grupo: 'Hombros',
    tipo: 'hipertrofia',
    equipo: 'Mancuernas',
    nivel: 'principiante',
    musculos: 'Deltoides anterior y lateral, trapecio superior',
    efecto: 'Trabaja de forma combinada la cabeza frontal y lateral del hombro aumentando el tiempo bajo tensión.',
    pasos: [
      'Párate firme sosteniendo dos mancuernas a los costados con postura atlética.',
      'Eleva los brazos hacia el frente hasta la altura de los ojos y baja con control.',
      'En la siguiente repetición, eleva los brazos lateralmente hasta la altura de los hombros.',
      'Continúa alternando una repetición frontal y una lateral manteniendo los codos suavemente flexionados.'
    ],
    errores: [
      'Columpiar la cadera para subir las mancuernas.',
      'Subir por encima de la línea de los hombros comprometiendo la articulación.'
    ],
    consejo: 'Controla la bajada en 2 segundos completos para duplicar el estímulo muscular sin usar cargas excesivas.',
    variante: 'Sentado en banco con respaldo a 90 grados para eliminar cualquier balanceo.',
    imagenes: ['/ex/Alternating_Deltoid_Raise/0.jpg', '/ex/Alternating_Deltoid_Raise/1.jpg'],
    ingles: 'Alternating Deltoid Raise'
  },
  {
    id: 'Alternating_Kettlebell_Press',
    nombre: 'Press militar alternado con pesas rusas (Kettlebells)',
    grupo: 'Hombros',
    tipo: 'fuerza',
    equipo: 'Pesas rusas (Kettlebells)',
    nivel: 'intermedio',
    musculos: 'Deltoides anterior y lateral, tríceps, serrato anterior, oblicuos',
    efecto: 'El centro de gravedad desplazado de la kettlebell exige mayor reclutamiento de los estabilizadores del hombro.',
    pasos: [
      'Limpia dos pesas rusas hasta la posición de rack frente a tus hombros con muñecas rectas y codos pegados.',
      'Aprieta glúteos y abdomen fuertemente.',
      'Presiona una pesa rusa verticalmente sobre la cabeza rotando el brazo hasta que el bíceps quede cerca de la oreja.',
      'Baja la pesa de vuelta al rack y repite inmediatamente con el brazo opuesto.'
    ],
    errores: [
      'Dejar que la muñeca se doble hacia atrás por el peso de la campana.',
      'Hiperextender la espalda baja al empujar.'
    ],
    consejo: 'Mantén la pesa que espera abajo bien activa en posición de rack, esto genera trabajo isométrico continuo.',
    variante: 'Con mancuernas de pie o sentado.',
    imagenes: ['/ex/Alternating_Kettlebell_Press/0.jpg', '/ex/Alternating_Kettlebell_Press/1.jpg'],
    ingles: 'Alternating Kettlebell Press'
  },

  // PIERNAS (5)
  {
    id: 'Barbell_Walking_Lunge',
    nombre: 'Zancadas caminando con barra',
    grupo: 'Piernas',
    tipo: 'fuerza',
    equipo: 'Barra olímpica',
    nivel: 'intermedio',
    musculos: 'Cuádriceps, glúteo mayor, isquiotibiales, aductores, core',
    efecto: 'Construye piernas atléticas, mejora la coordinación intermuscular y corrige desequilibrios de fuerza entre ambas piernas.',
    pasos: [
      'Coloca la barra sobre tus trapecios (nunca sobre las vértebras del cuello) y asegúrate de tener espacio libre.',
      'Da un paso largo hacia adelante manteniendo el torso erguido y la mirada al frente.',
      'Desciende la cadera hasta que ambas rodillas formen un ángulo de 90 grados y la rodilla trasera quede a 2-3 cm del suelo.',
      'Empuja con fuerza a través del talón y mediopié delantero para avanzar directamente al siguiente paso con la otra pierna.'
    ],
    errores: [
      'Golpear la rodilla trasera contra el suelo.',
      'Dejar que la rodilla delantera colapse hacia adentro (valgo de rodilla).'
    ],
    consejo: 'Un paso ligeramente más corto enfatiza el cuádriceps; un paso más largo enfatiza el glúteo e isquios.',
    variante: 'Con mancuernas a los costados para mayor seguridad y facilidad de equilibrio.',
    imagenes: ['/ex/Barbell_Walking_Lunge/0.jpg', '/ex/Barbell_Walking_Lunge/1.jpg'],
    ingles: 'Barbell Walking Lunge'
  },
  {
    id: 'Barbell_Squat_To_A_Bench',
    nombre: 'Sentadilla al cajón con barra (Box Squat)',
    grupo: 'Piernas',
    tipo: 'fuerza',
    equipo: 'Barra, rack y cajón o banco plano',
    nivel: 'intermedio',
    musculos: 'Cuádriceps, glúteos, isquiotibiales, cadena posterior',
    efecto: 'Enseña a iniciar la sentadilla con la cadera hacia atrás, asegura profundidad constante y desarrolla potencia explosiva desde abajo.',
    pasos: [
      'Coloca un banco o cajón detrás de ti a una altura donde tus muslos queden paralelos al piso al sentarte.',
      'Saca la barra del rack, separa los pies un poco más que el ancho de hombros y toma aire en el abdomen.',
      'Lleva la cadera hacia atrás y abajo de manera controlada hasta posarte suavemente en el banco.',
      'Mantén el torso y el abdomen totalmente rígidos durante 1 segundo sobre el cajón sin relajarte.',
      'Explota hacia arriba empujando el suelo con los pies.'
    ],
    errores: [
      'Dejarse caer de golpe sobre el banco comprimiendo la columna.',
      'Balancearse hacia atrás y hacia adelante en el banco para tomar impulso.'
    ],
    consejo: 'Toca el banco con control total como si fuera de cristal antes de subir con potencia.',
    variante: 'Con mancuerna tipo Goblet Squat hacia un banco para principiantes.',
    imagenes: ['/ex/Barbell_Squat_To_A_Bench/0.jpg', '/ex/Barbell_Squat_To_A_Bench/1.jpg'],
    ingles: 'Barbell Box Squat'
  },
  {
    id: 'Glute_Ham_Raise',
    nombre: 'Curl nórdico / Glute Ham Raise (GHR)',
    grupo: 'Piernas',
    tipo: 'fuerza',
    equipo: 'Banco GHR o soporte de tobillos',
    nivel: 'avanzado',
    musculos: 'Isquiotibiales (bíceps femoral, semitendinoso), glúteos, gemelos',
    efecto: 'El ejercicio de peso corporal más potente para blindar los isquiotibiales contra desgarros y ganar fuerza excéntrica.',
    pasos: [
      'Asegura tus tobillos en el rodillo o banco GHR con las rodillas apoyadas sobre el cojín.',
      'Cruza los brazos sobre el pecho y mantén una línea recta desde las rodillas hasta los hombros (cadera extendida).',
      'Inhala y déjate bajar hacia adelante lo más lento posible resistiendo la gravedad con los femorales.',
      'Frena al final con las manos si es necesario y contrae fuertemente los isquios y glúteos para regresar arriba.'
    ],
    errores: [
      'Doblar la cadera sacando los glúteos hacia atrás al subir.',
      'Dejarse caer sin controlar la fase excéntrica.'
    ],
    consejo: 'Si aún es muy intenso, sujeta una banda elástica anclada detrás de ti para asistirte en la subida.',
    variante: 'Curl femoral tumbado o sentado en máquina.',
    imagenes: ['/ex/Glute_Ham_Raise/0.jpg', '/ex/Glute_Ham_Raise/1.jpg'],
    ingles: 'Glute Ham Raise'
  },
  {
    id: 'Good_Morning',
    nombre: 'Buenos días con barra (Good Morning)',
    grupo: 'Piernas',
    tipo: 'fuerza',
    equipo: 'Barra olímpica',
    nivel: 'intermedio',
    musculos: 'Isquiotibiales, glúteo mayor, erectores espinales',
    efecto: 'Fortalece toda la cadena posterior y la bisagra de cadera, transfiriendo fuerza directa a la sentadilla y peso muerto.',
    pasos: [
      'Apoya la barra en la parte posterior de los hombros (posición de barra baja) con pies al ancho de cadera.',
      'Desbloquea ligeramente las rodillas (15 grados) y mantén ese ángulo fijo.',
      'Inhala y empuja los glúteos directamente hacia la pared de atrás inclinando el torso con la espalda totalmente recta.',
      'Baja hasta sentir un estiramiento intenso en los isquiotibiales (torso a unos 45-70 grados).',
      'Exhala y extiende la cadera apretando los glúteos para volver a la vertical.'
    ],
    errores: [
      'Redondear la espalda baja por intentar bajar más allá de tu flexibilidad de isquios.',
      'Colocar la barra muy alta sobre el cuello donde pueda rodar hacia adelante.'
    ],
    consejo: 'Empieza con pesos ligeros o moderados; la técnica de bisagra de cadera siempre va antes que los kilos.',
    variante: 'Con banda elástica pisándola y pasándola tras la nuca.',
    imagenes: ['/ex/Good_Morning/0.jpg', '/ex/Good_Morning/1.jpg'],
    ingles: 'Good Morning'
  },
  {
    id: 'Calf_Press_On_The_Leg_Press_Machine',
    nombre: 'Elevación de gemelos en prensa de piernas',
    grupo: 'Piernas',
    tipo: 'hipertrofia',
    equipo: 'Prensa de piernas a 45°',
    nivel: 'principiante',
    musculos: 'Gastrocnemio (gemelos), sóleo',
    efecto: 'El ángulo de flexión de cadera con rodillas extendidas proporciona un pre-estiramiento superior del gastrocnemio.',
    pasos: [
      'Siéntate en la prensa y coloca únicamente el tercio delantero de las plantas de los pies en el borde inferior de la plataforma.',
      'Extiende las piernas manteniendo una micro-flexión de seguridad en las rodillas (nunca las hiperextiendas) y deja puestos los seguros de la prensa.',
      'Inhala y deja que la plataforma empuje tus puntas hacia ti logrando el máximo estiramiento del talón.',
      'Exhala y empuja la plataforma con las puntas de los pies lo más lejos posible, pausando 2 segundos arriba.'
    ],
    errores: [
      'Rebotar rápido en la parte baja aprovechando el reflejo elástico del tendón de Aquiles.',
      'Bloquear las rodillas hacia atrás.'
    ],
    consejo: 'Mantén siempre puestos los seguros mecánicos de la prensa por seguridad mientras trabajas con el borde de los pies.',
    variante: 'Elevación de gemelos de pie en máquina o con mancuerna en escalón.',
    imagenes: ['/ex/Calf_Press_On_The_Leg_Press_Machine/0.jpg', '/ex/Calf_Press_On_The_Leg_Press_Machine/1.jpg'],
    ingles: 'Calf Press On Leg Press'
  },

  // GLÚTEOS (3)
  {
    id: 'Monster_Walk',
    nombre: 'Caminata lateral con banda (Monster Walk)',
    grupo: 'Glúteos',
    tipo: 'aislamiento',
    equipo: 'Mini-banda elástica (Mini-band)',
    nivel: 'principiante',
    musculos: 'Glúteo medio, glúteo menor, tensor de la fascia lata',
    efecto: 'Activa y esculpe el glúteo superior/lateral y estabiliza la pelvis y rodillas antes de entrenar pierna.',
    pasos: [
      'Coloca una banda elástica circular justo por encima de las rodillas o en los tobillos.',
      'Adopta una posición de cuarto de sentadilla con la cadera hacia atrás y el pecho erguido.',
      'Da pasos laterales controlados manteniendo siempre la banda tensa (no juntes los pies del todo).',
      'Camina 12 a 15 pasos hacia la derecha y luego 12 a 15 pasos hacia la izquierda.'
    ],
    errores: [
      'Juntar demasiado los pies perdiendo la tensión de la banda entre pasos.',
      'Caminar con las piernas totalmente rígidas y rectas.'
    ],
    consejo: 'Apunta las puntas de los pies ligeramente hacia adentro para maximizar la activación del glúteo medio.',
    variante: 'Abducciones sentado con banda o máquina abductora.',
    imagenes: ['/ex/Monster_Walk/0.jpg', '/ex/Monster_Walk/1.jpg'],
    ingles: 'Monster Walk'
  },
  {
    id: 'Physioball_Hip_Bridge',
    nombre: 'Puente de glúteo elevado sobre balón suizo',
    grupo: 'Glúteos',
    tipo: 'hipertrofia',
    equipo: 'Balón suizo (Fitball)',
    nivel: 'intermedio',
    musculos: 'Glúteo mayor, isquiotibiales, core profundo',
    efecto: 'La base inestable multiplica el reclutamiento de fibras de glúteo e isquiotibiales junto con los estabilizadores pélvicos.',
    pasos: [
      'Acuéstate boca arriba en el suelo y apoya los talones y pantorrillas sobre un balón suizo.',
      'Abre los brazos a los lados en el suelo para equilibrarte.',
      'Exhala y eleva la cadera contrayendo fuertemente los glúteos hasta alinear rodillas, cadera y hombros.',
      'Sostén arriba 2 segundos sin que el balón ruede y desciende despacio.'
    ],
    errores: [
      'Empujar con el cuello o arquear la zona lumbar en lugar de retrovertir la pelvis.',
      'Perder el control del balón por hacer las repeticiones con prisa.'
    ],
    consejo: 'Para hacerlo aún más intenso, al llegar arriba flexiona las rodillas trayendo el balón hacia tus glúteos.',
    variante: 'Con los pies apoyados sobre un banco fijo si buscas meter peso sobre la cadera.',
    imagenes: ['/ex/Physioball_Hip_Bridge/0.jpg', '/ex/Physioball_Hip_Bridge/1.jpg'],
    ingles: 'Physioball Hip Bridge'
  },
  {
    id: 'Kneeling_Squat',
    nombre: 'Sentadilla de rodillas con barra para glúteo',
    grupo: 'Glúteos',
    tipo: 'hipertrofia',
    equipo: 'Barra o Multipower y colchoneta',
    nivel: 'intermedio',
    musculos: 'Glúteo mayor, glúteo medio, erectores espinales',
    efecto: 'Elimina la participación de las pantorrillas y reduce el brazo de palanca de rodilla para aislar la extensión de cadera.',
    pasos: [
      'Coloca una colchoneta gruesa bajo el rack o máquina Smith y arrodíllate con la barra sobre tus trapecios.',
      'Inhala y lleva los glúteos hacia atrás hasta sentarte sobre tus talones inclinando ligeramente el torso.',
      'Exhala y empuja la cadera hacia adelante con fuerza apretando los glúteos hasta quedar nuevamente erguido de rodillas.'
    ],
    errores: [
      'Hiperextender la columna lumbar al llegar adelante.',
      'Hacerlo sin acolchado adecuado para las rodillas.'
    ],
    consejo: 'Realízalo en máquina Smith para concentrarte 100% en exprimir los glúteos sin preocuparte por el equilibrio.',
    variante: 'Pull-through en polea baja con cuerda.',
    imagenes: ['/ex/Kneeling_Squat/0.jpg', '/ex/Kneeling_Squat/1.jpg'],
    ingles: 'Kneeling Squat'
  },

  // BÍCEPS (4)
  {
    id: 'EZ-Bar_Curl',
    nombre: 'Curl de bíceps con barra Z de pie',
    grupo: 'Bíceps',
    tipo: 'fuerza',
    equipo: 'Barra Z (EZ-Bar)',
    nivel: 'principiante',
    musculos: 'Bíceps braquial (cabeza corta y larga), braquial anterior, braquiorradial',
    efecto: 'El ángulo ergonómico de la barra Z permite cargar buen peso protegiendo las muñecas y los codos de tendinitis.',
    pasos: [
      'Párate firme sosteniendo la barra Z en su curvatura media o ancha con las palmas semigiradas hacia arriba.',
      'Pega los codos a los costados de tu torso y mantén el pecho alto.',
      'Exhala y flexiona los codos subiendo la barra en arco hasta la altura de los hombros.',
      'Aprieta los bíceps durante 1 segundo arriba y baja controladamente en 2-3 segundos.'
    ],
    errores: [
      'Columpiar la espalda hacia atrás para lanzar el peso.',
      'Adelantar excesivamente los codos convirtiendo el final en un press frontal.'
    ],
    consejo: 'Apoya la espalda contra una pared si notas que tiendes a balancearte con cargas altas.',
    variante: 'Agarre cerrado en la barra Z para enfatizar la cabeza larga (pico del bíceps).',
    imagenes: ['/ex/EZ-Bar_Curl/0.jpg', '/ex/EZ-Bar_Curl/1.jpg'],
    ingles: 'EZ-Bar Curl'
  },
  {
    id: 'Alternate_Incline_Dumbbell_Curl',
    nombre: 'Curl de bíceps en banco inclinado con mancuernas',
    grupo: 'Bíceps',
    tipo: 'hipertrofia',
    equipo: 'Mancuernas y banco inclinado a 45-60°',
    nivel: 'intermedio',
    musculos: 'Cabeza larga del bíceps braquial',
    efecto: 'Coloca el hombro en hiperextensión estirando al máximo la cabeza larga del bíceps para desarrollar el pico del brazo.',
    pasos: [
      'Ajusta un banco a 45-60 grados y recuéstate apoyando bien la espalda y la cabeza.',
      'Deja colgar los brazos totalmente verticales hacia el suelo con una mancuerna en cada mano.',
      'Sin llevar el codo hacia adelante, flexiona el brazo girando la palma hacia arriba (supinación).',
      'Contrae fuerte arriba y desciende hasta estirar el brazo por completo sintiendo la tensión en el bíceps.'
    ],
    errores: [
      'Adelantar los codos al subir, lo que anula la ventaja del banco inclinado.',
      'Despegar los hombros o la cabeza del respaldo.'
    ],
    consejo: 'Usa un 20% menos de peso que en el curl de pie; aquí el estiramiento profundo hace todo el trabajo.',
    variante: 'Simultáneo con ambos brazos o curl bayesiano en polea.',
    imagenes: ['/ex/Alternate_Incline_Dumbbell_Curl/0.jpg', '/ex/Alternate_Incline_Dumbbell_Curl/1.jpg'],
    ingles: 'Incline Dumbbell Curl'
  },
  {
    id: 'Cable_Hammer_Curls_-_Rope_Attachment',
    nombre: 'Curl martillo en polea baja con cuerda',
    grupo: 'Bíceps',
    tipo: 'hipertrofia',
    equipo: 'Polea baja con cuerda doble',
    nivel: 'principiante',
    musculos: 'Braquial anterior, braquiorradial, bíceps (cabeza larga)',
    efecto: 'Engrosa el brazo visto de frente al desarrollar el músculo braquial debajo del bíceps y el antebrazo.',
    pasos: [
      'Conecta la cuerda en la polea más baja y sujétala con agarre neutro (pulgares apuntando hacia arriba).',
      'Da medio paso atrás, fija los codos a tus costados y mantén la espalda erguida.',
      'Sube la cuerda hacia tu pecho manteniendo las muñecas firmes.',
      'En la parte alta, separa ligeramente los extremos de la cuerda y aprieta por 1 segundo antes de bajar.'
    ],
    errores: [
      'Separar los codos del tronco al subir.',
      'Dejar caer el peso sin frenar la bajada.'
    ],
    consejo: 'Excelente último ejercicio de bíceps para lograr un bombeo total en brazos y antebrazos.',
    variante: 'Curl martillo con mancuernas alternado o cruzado al pecho.',
    imagenes: ['/ex/Cable_Hammer_Curls_-_Rope_Attachment/0.jpg', '/ex/Cable_Hammer_Curls_-_Rope_Attachment/1.jpg'],
    ingles: 'Cable Rope Hammer Curl'
  },
  {
    id: 'Drag_Curl',
    nombre: 'Drag Curl con barra (Curl arrastrado)',
    grupo: 'Bíceps',
    tipo: 'aislamiento',
    equipo: 'Barra recta o barra Z',
    nivel: 'intermedio',
    musculos: 'Bíceps braquial (pico), deltoides posterior',
    efecto: 'Elimina la participación del deltoides anterior llevando los codos hacia atrás mientras la barra sube rozando el torso.',
    pasos: [
      'Sostén la barra con agarre supino al ancho de los hombros apoyada contra tus muslos.',
      'En lugar de describir un arco hacia adelante, sube la barra arrastrándola pegada a tu abdomen y pecho.',
      'A medida que la barra sube, lleva los codos hacia atrás.',
      'Aprieta los bíceps al llegar bajo el pecho y desciende rozando nuevamente el torso.'
    ],
    errores: [
      'Despegar la barra del cuerpo convirtiéndolo en un curl tradicional.',
      'Encoger los trapecios hacia las orejas.'
    ],
    consejo: 'Concentra toda tu mente en apretar el bíceps en la cima; la sensación de congestión en el pico es única.',
    variante: 'Con mancuernas o en máquina Smith.',
    imagenes: ['/ex/Drag_Curl/0.jpg', '/ex/Drag_Curl/1.jpg'],
    ingles: 'Drag Curl'
  },

  // TRÍCEPS (4)
  {
    id: 'Cable_One_Arm_Tricep_Extension',
    nombre: 'Extensión de tríceps unilateral en polea alta',
    grupo: 'Tríceps',
    tipo: 'aislamiento',
    equipo: 'Polea alta con maneral o sin accesorio',
    nivel: 'principiante',
    musculos: 'Tríceps braquial (cabeza lateral y medial)',
    efecto: 'Permite corregir asimetrías de fuerza entre brazos y alinear el hombro con el codo sin estrés en las muñecas.',
    pasos: [
      'Colócate frente a la polea alta y sujeta el maneral (o directamente la bola del cable) con una mano.',
      'Pega el codo al costado de tu torso y déjalo fijo como una bisagra.',
      'Exhala y extiende el antebrazo completamente hacia abajo hasta bloquear suavemente el codo.',
      'Aprieta el tríceps 1 segundo abajo y regresa lento hasta los 90 grados.'
    ],
    errores: [
      'Separar el codo del cuerpo o empujar con el hombro hacia abajo.',
      'Doblar la muñeca durante el empuje.'
    ],
    consejo: 'Prueba hacerlo tanto con agarre prono (palma abajo) como supino (palma arriba) para estimular todas las fibras.',
    variante: 'Con cuerda a dos manos.',
    imagenes: ['/ex/Cable_One_Arm_Tricep_Extension/0.jpg', '/ex/Cable_One_Arm_Tricep_Extension/1.jpg'],
    ingles: 'Single-Arm Cable Tricep Pushdown'
  },
  {
    id: 'Cable_Incline_Triceps_Extension',
    nombre: 'Extensión de tríceps tras nuca en polea y banco inclinado',
    grupo: 'Tríceps',
    tipo: 'hipertrofia',
    equipo: 'Polea baja, cuerda/barra y banco inclinado',
    nivel: 'intermedio',
    musculos: 'Cabeza larga del tríceps braquial',
    efecto: 'Estira la cabeza larga del tríceps (la más grande del brazo) bajo tensión continua de polea y con espalda apoyada.',
    pasos: [
      'Coloca un banco inclinado de espaldas a una polea baja o media.',
      'Siéntate y sujeta la barra o cuerda por detrás de tu cabeza con los codos apuntando hacia el techo.',
      'Manteniendo los brazos superiores fijos al lado de las orejas, extiende los codos hacia arriba y adelante.',
      'Baja lentamente sintiendo el estiramiento profundo detrás del brazo.'
    ],
    errores: [
      'Abrir los codos hacia los lados al extender.',
      'Arquear la espalda despegándola del respaldo.'
    ],
    consejo: 'La cabeza larga representa dos tercios del tamaño del tríceps; siempre incluye un ejercicio sobre la cabeza.',
    variante: 'De pie inclinado hacia adelante de espaldas a la polea alta.',
    imagenes: ['/ex/Cable_Incline_Triceps_Extension/0.jpg', '/ex/Cable_Incline_Triceps_Extension/1.jpg'],
    ingles: 'Cable Incline Triceps Extension'
  },
  {
    id: 'Close-Grip_Dumbbell_Press',
    nombre: 'Press neutro cerrado con mancuernas (Crush Press)',
    grupo: 'Tríceps',
    tipo: 'fuerza',
    equipo: 'Mancuernas y banco plano',
    nivel: 'principiante',
    musculos: 'Tríceps braquial, pectoral interno, deltoides anterior',
    efecto: 'Gran constructor de fuerza y masa para tríceps y centro del pecho, muy amigable con los hombros y muñecas.',
    pasos: [
      'Recuéstate en un banco plano con dos mancuernas y júntalas con agarre neutro (palmas mirándose).',
      'Presiona una mancuerna contra la otra fuertemente sobre tu pecho.',
      'Baja las mancuernas unidas hacia el esternón manteniendo los codos pegados a tus costillas.',
      'Empuja con fuerza hacia arriba sin dejar de presionar las mancuernas entre sí.'
    ],
    errores: [
      'Separar las mancuernas o abrir los codos hacia afuera.',
      'Rebotar las pesas sobre el pecho.'
    ],
    consejo: 'El apretón constante entre las mancuernas crea una activación isométrica brutal en tríceps y pecho interno.',
    variante: 'Press cerrado con barra Z.',
    imagenes: ['/ex/Close-Grip_Dumbbell_Press/0.jpg', '/ex/Close-Grip_Dumbbell_Press/1.jpg'],
    ingles: 'Close-Grip Dumbbell Press'
  },
  {
    id: 'Body_Tricep_Press',
    nombre: 'Extensión de tríceps con peso corporal en barra',
    grupo: 'Tríceps',
    tipo: 'hipertrofia',
    equipo: 'Barra fija en rack o banco alto',
    nivel: 'intermedio',
    musculos: 'Tríceps braquial (las 3 cabezas), core anti-extensión',
    efecto: 'Equivalente al rompecráneos pero usando tu propio peso corporal, logrando gran estímulo excéntrico.',
    pasos: [
      'Apoya las manos al ancho de los hombros sobre una barra fija a la altura de la cintura o cadera.',
      'Da un paso atrás quedando en posición de plancha inclinada sobre las puntas de los pies.',
      'Flexiona únicamente los codos metiendo la cabeza por debajo de la barra mientras los codos apuntan hacia abajo.',
      'Extiende los brazos con fuerza usando los tríceps para volver a la posición inicial.'
    ],
    errores: [
      'Hundir la cadera o arquear la espalda baja.',
      'Hacer una flexión de pecho abriendo los codos en lugar de doblar solo los codos.'
    ],
    consejo: 'Sube la altura de la barra si quieres hacerlo más sencillo, o bájala para aumentar la intensidad.',
    variante: 'De rodillas en el suelo para principiantes.',
    imagenes: ['/ex/Body_Tricep_Press/0.jpg', '/ex/Body_Tricep_Press/1.jpg'],
    ingles: 'Bodyweight Tricep Extension'
  },

  // ANTEBRAZOS (2)
  {
    id: 'Palms-Down_Wrist_Curl_Over_A_Bench',
    nombre: 'Curl de muñeca inverso en banco (Extensores de antebrazo)',
    grupo: 'Antebrazos',
    tipo: 'aislamiento',
    equipo: 'Barra o mancuernas y banco plano',
    nivel: 'principiante',
    musculos: 'Extensores radiales y cubitales del carpo (cara superior del antebrazo)',
    efecto: 'Desarrolla la cara externa del antebrazo y previene la epicondilitis (codo de tenista) al equilibrar los flexores.',
    pasos: [
      'Arrodíllate frente a un banco plano y apoya los antebrazos sobre él con las muñecas sobresaliendo del borde.',
      'Sujeta la barra con agarre prono (palmas hacia abajo).',
      'Deja bajar las muñecas controladamente hacia el suelo.',
      'Eleva el dorso de las manos lo más alto posible contrayendo la parte superior del antebrazo por 1 segundo.'
    ],
    errores: [
      'Levantar los antebrazos del banco para usar los bíceps.',
      'Usar cargas excesivas que impidan el rango completo de la muñeca.'
    ],
    consejo: 'Trabaja en rangos de 15 a 25 repeticiones buscando el ardor muscular localizado.',
    variante: 'Con mancuernas de forma unilateral.',
    imagenes: ['/ex/Palms-Down_Wrist_Curl_Over_A_Bench/0.jpg', '/ex/Palms-Down_Wrist_Curl_Over_A_Bench/1.jpg'],
    ingles: 'Reverse Wrist Curl'
  },
  {
    id: 'Plate_Pinch',
    nombre: 'Agarre de pinza con discos (Plate Pinch)',
    grupo: 'Antebrazos',
    tipo: 'fuerza',
    equipo: 'Discos olímpicos o estándar',
    nivel: 'principiante',
    musculos: 'Flexores profundos de los dedos, aductor del pulgar, antebrazos, trapecio',
    efecto: 'Multiplica la fuerza real de agarre de manos y dedos para peso muerto, dominadas y deportes de contacto.',
    pasos: [
      'Toma uno o dos discos lisos y sujétalos a los costados usando únicamente la pinza de tus dedos y el pulgar (sin meter los dedos en el agujero).',
      'Párate totalmente erguido con los hombros hacia atrás y el pecho alto.',
      'Sostén los discos apretando con máxima fuerza durante 30 a 45 segundos.',
      'Bájalos con cuidado al terminar el tiempo.'
    ],
    errores: [
      'Apoyar los discos contra los muslos para descansar el agarre.',
      'Encorvar los hombros hacia adelante.'
    ],
    consejo: 'Seca bien tus manos antes de empezar para evitar que el sudor resbale el disco.',
    variante: 'Caminar 20 metros sosteniendo los discos en pinza.',
    imagenes: ['/ex/Plate_Pinch/0.jpg', '/ex/Plate_Pinch/1.jpg'],
    ingles: 'Plate Pinch Hold'
  },

  // TRAPECIO (2)
  {
    id: 'Barbell_Shrug',
    nombre: 'Encogimiento de hombros con barra (Barbell Shrugs)',
    grupo: 'Trapecio',
    tipo: 'fuerza',
    equipo: 'Barra olímpica',
    nivel: 'principiante',
    musculos: 'Trapecio superior, elevador de la escápula',
    efecto: 'Permite manejar cargas elevadas para construir trapecios altos, gruesos y potentes que protegen el cuello.',
    pasos: [
      'Párate erguido sosteniendo la barra frente a tus muslos con agarre prono al ancho de los hombros.',
      'Mantén los brazos totalmente rectos y la mirada al frente.',
      'Exhala y eleva los hombros directamente hacia las orejas lo más alto posible.',
      'Haz una pausa isométrica de 2 segundos completos en la cima antes de bajar lentamente.'
    ],
    errores: [
      'Girar los hombros en círculos (no aporta beneficio y desgasta el manguito rotador).',
      'Adelantar la cabeza como tortuga al subir el peso.'
    ],
    consejo: 'Si tu agarre se cansa antes que tus trapecios, usa correas de levantamiento (straps) en las series pesadas.',
    variante: 'En máquina Smith o con barra hexagonal (Trap Bar).',
    imagenes: ['/ex/Barbell_Shrug/0.jpg', '/ex/Barbell_Shrug/1.jpg'],
    ingles: 'Barbell Shrug'
  },
  {
    id: 'Upright_Cable_Row',
    nombre: 'Remo al mentón en polea baja con agarre amplio',
    grupo: 'Trapecio',
    tipo: 'hipertrofia',
    equipo: 'Polea baja con barra o cuerda',
    nivel: 'intermedio',
    musculos: 'Trapecio superior y medio, deltoides lateral',
    efecto: 'Desarrolla en simultáneo los trapecios y la cara lateral del hombro con tensión suave y continua de polea.',
    pasos: [
      'Sujeta una barra o cuerda en la polea baja con un agarre al ancho de los hombros (nunca demasiado cerrado).',
      'Tracciona el peso verticalmente guiando el movimiento con los codos hacia arriba y afuera.',
      'Detente cuando los codos lleguen a la altura de los hombros (la barra llega a la altura del esternón).',
      'Pausa un instante arriba y baja con total control.'
    ],
    errores: [
      'Usar un agarre muy junto subiendo las manos hasta la barbilla (provoca pinzamiento subacromial).',
      'Balancear la espalda baja.'
    ],
    consejo: 'Usar cuerda o agarre al ancho de hombros hasta la altura del pecho hace que el ejercicio sea 100% seguro para el hombro.',
    variante: 'Con mancuernas a los lados del cuerpo.',
    imagenes: ['/ex/Upright_Cable_Row/0.jpg', '/ex/Upright_Cable_Row/1.jpg'],
    ingles: 'Upright Cable Row'
  },

  // CORE (3)
  {
    id: 'Cable_Russian_Twists',
    nombre: 'Giros rusos / Leñador en polea (Woodchopper)',
    grupo: 'Core',
    tipo: 'hipertrofia',
    equipo: 'Polea a media altura con maneral',
    nivel: 'intermedio',
    musculos: 'Oblicuos internos y externos, transverso abdominal, serrato',
    efecto: 'Define la cintura y fortalece la potencia rotacional y anti-rotacional del tronco.',
    pasos: [
      'Colócate de lado a una polea situada a la altura del pecho y toma el maneral con ambas manos entrelazadas.',
      'Da un paso lateral para tensar el cable y extiende los brazos frente a tu esternón.',
      'Manteniendo la cadera estable y los brazos casi rectos, gira el torso hacia el lado opuesto en un arco de 180 grados.',
      'Siente la contracción en los oblicuos y regresa frenando el peso lentamente.'
    ],
    errores: [
      'Mover solo los brazos sin rotar la caja torácica.',
      'Girar bruscamente las rodillas sin pivotar el pie trasero.'
    ],
    consejo: 'Controla el regreso; resistir el tirón de la polea al volver trabaja el core tanto como el giro inicial.',
    variante: 'Press Pallof isométrico en polea para enfoque anti-rotación.',
    imagenes: ['/ex/Cable_Russian_Twists/0.jpg', '/ex/Cable_Russian_Twists/1.jpg'],
    ingles: 'Cable Woodchopper / Russian Twist'
  },
  {
    id: 'Ab_Crunch_Machine',
    nombre: 'Crunch abdominal en máquina',
    grupo: 'Core',
    tipo: 'hipertrofia',
    equipo: 'Máquina de abdominales',
    nivel: 'principiante',
    musculos: 'Recto abdominal (superior y medio), oblicuos',
    efecto: 'Permite aplicar sobrecarga progresiva real con placas de peso para hipertrofiar los bloques abdominales.',
    pasos: [
      'Ajusta el asiento de la máquina y sujeta los agarres superiores asegurando los pies bajo los rodillos.',
      'Inhala profundo y al exhalar todo el aire enrolla tu torso hacia abajo acercando las costillas a la pelvis.',
      'Aprieta el abdomen fuertemente en el punto inferior durante 1-2 segundos.',
      'Regresa despacio sin que las placas descansen.'
    ],
    errores: [
      'Tirar con la fuerza de los brazos o flexionar la cadera con la espalda recta.',
      'No expulsar el aire al contraer el abdomen.'
    ],
    consejo: 'Piensa en doblar la columna vertebral vértebra por vértebra como si enrollaras una alfombra.',
    variante: 'Crunch en polea alta arrodillado con cuerda.',
    imagenes: ['/ex/Ab_Crunch_Machine/0.jpg', '/ex/Ab_Crunch_Machine/1.jpg'],
    ingles: 'Ab Crunch Machine'
  },
  {
    id: 'Alternate_Heel_Touchers',
    nombre: 'Toques de talón alternados en suelo (Oblicuos)',
    grupo: 'Core',
    tipo: 'aislamiento',
    equipo: 'Colchoneta (Peso corporal)',
    nivel: 'principiante',
    musculos: 'Oblicuos externos e internos, recto abdominal superior',
    efecto: 'Tonifica las paredes laterales del abdomen sin impacto lumbar, ideal para circuitos de core.',
    pasos: [
      'Acuéstate boca arriba con las rodillas flexionadas y las plantas de los pies apoyadas en el suelo.',
      'Eleva ligeramente los hombros y omóplatos del piso manteniendo la tensión abdominal.',
      'Inclina el torso lateralmente para tocar tu talón derecho con la mano derecha.',
      'Regresa al centro y toca inmediatamente el talón izquierdo con la mano izquierda.'
    ],
    errores: [
      'Acercar demasiado los talones a los glúteos haciendo que el recorrido sea nulo.',
      'Forzar el cuello mirando hacia las rodillas en vez de hacia el techo.'
    ],
    consejo: 'No dejes que tus omóplatos toquen el suelo en ningún momento de la serie para mantener tensión continua.',
    variante: 'Bicicleta abdominal alternada.',
    imagenes: ['/ex/Alternate_Heel_Touchers/0.jpg', '/ex/Alternate_Heel_Touchers/1.jpg'],
    ingles: 'Alternate Heel Touchers'
  },

  // CARDIO & METABÓLICO (3)
  {
    id: 'Battling_Ropes',
    nombre: 'Ondas con cuerdas de batalla (Battle Ropes)',
    grupo: 'Cardio',
    tipo: 'cardio',
    equipo: 'Cuerdas de batalla (Battle Ropes)',
    nivel: 'intermedio',
    musculos: 'Hombros, brazos, espalda alta, core, sistema cardiovascular',
    efecto: 'Quema calórica masiva y acondicionamiento metabólico de tren superior sin impacto en rodillas ni tobillos.',
    pasos: [
      'Toma los extremos de las cuerdas, adopta media sentadilla atlética con abdomen firme y espalda recta.',
      'Mueve los brazos arriba y abajo de forma alternada a máxima velocidad creando ondas continuas hasta el anclaje.',
      'Respira de forma rítmica y constante manteniendo los hombros estables durante el intervalo (20 a 40 segundos).'
    ],
    errores: [
      'Quedarse totalmente rígido de piernas o encorvar la espalda al cansarse.',
      'Dejar las cuerdas demasiado tensas sin margen para que se formen ondas.'
    ],
    consejo: 'Alterna intervalos de 30 segundos de ondas rápidas con 30 segundos de descanso para un HIIT brutal.',
    variante: 'Ondas dobles simultáneas (Slams) para mayor potencia explosiva.',
    imagenes: ['/ex/Battling_Ropes/0.jpg', '/ex/Battling_Ropes/1.jpg'],
    ingles: 'Battling Ropes'
  },
  {
    id: 'Front_Box_Jump',
    nombre: 'Salto al cajón pliométrico (Box Jump)',
    grupo: 'Cardio',
    tipo: 'cardio',
    equipo: 'Cajón pliométrico',
    nivel: 'intermedio',
    musculos: 'Cuádriceps, glúteos, gemelos, fibras rápidas tipo II',
    efecto: 'Desarrolla potencia explosiva de tren inferior, agilidad atlética y eleva las pulsaciones rápidamente.',
    pasos: [
      'Párate frente al cajón a unos 30-40 cm con los pies al ancho de los hombros.',
      'Lleva ligeramente la cadera atrás y los brazos atrás para cargar potencia.',
      'Salta impulsándote con brazos y piernas para aterrizar suavemente con toda la planta de ambos pies en el centro del cajón.',
      'Extiende la cadera arriba y baja dando un paso controlado hacia atrás (nunca saltando de espaldas).'
    ],
    errores: [
      'Aterrizar haciendo mucho ruido con las rodillas hundidas hacia adentro.',
      'Elegir un cajón demasiado alto donde tengas que encoger excesivamente las piernas.'
    ],
    consejo: 'Un buen salto pliométrico suena silencioso al aterrizar sobre el cajón ("pies de gato").',
    variante: 'Step-ups rápidos al cajón sin salto si buscas cero impacto articular.',
    imagenes: ['/ex/Front_Box_Jump/0.jpg', '/ex/Front_Box_Jump/1.jpg'],
    ingles: 'Front Box Jump'
  },
  {
    id: 'Bicycling',
    nombre: 'Ciclismo / Bicicleta estática o Spinning',
    grupo: 'Cardio',
    tipo: 'cardio',
    equipo: 'Bicicleta estática o de spinning',
    nivel: 'principiante',
    musculos: 'Sistema cardiorrespiratorio, cuádriceps, isquiotibiales, gemelos',
    efecto: 'Mejora la capacidad aeróbica, oxida grasas y acelera la recuperación activa de las piernas sin impacto articular.',
    pasos: [
      'Ajusta la altura del sillín a la altura de tu hueso de la cadera al estar de pie junto a la bici.',
      'Siéntate con el torso ligeramente inclinado, hombros relajados y manos sin recargar peso en el manubrio.',
      'Pedalea de forma redonda empujando con el metatarso manteniendo una cadencia entre 75 y 95 RPM.',
      'Regula la perilla de resistencia según hagas cardio continuo (LISS) o sprints por intervalos (HIIT).'
    ],
    errores: [
      'Sillín demasiado bajo (sobrecarga el tendón rotuliano) o demasiado alto (bamboleo de cadera).',
      'Pedalear sin nada de resistencia rebotando en el asiento.'
    ],
    consejo: 'En la parte más baja del pedal, tu rodilla debe conservar una ligera flexión de unos 25 grados.',
    variante: 'Intervalos de 20 seg de sprint de pie con resistencia alta + 40 seg suave sentado.',
    imagenes: ['/ex/Bicycling/0.jpg', '/ex/Bicycling/1.jpg'],
    ingles: 'Stationary Cycling'
  },

  // MOVILIDAD & ESTIRAMIENTO (2)
  {
    id: '90_90_Hamstring',
    nombre: 'Movilidad activa de isquiotibiales 90/90',
    grupo: 'Movilidad',
    tipo: 'movilidad',
    equipo: 'Colchoneta',
    nivel: 'principiante',
    musculos: 'Isquiotibiales, cadena posterior, nervio ciático',
    efecto: 'Descomprime la zona lumbar y aumenta la longitud funcional de los isquiotibiales antes o después de entrenar pierna.',
    pasos: [
      'Acuéstate boca arriba con la espalda baja bien apoyada en el suelo.',
      'Eleva una pierna con la cadera a 90 grados sujetando la parte posterior del muslo con ambas manos.',
      'Extiende lentamente la rodilla llevando el talón hacia el techo hasta sentir un estiramiento agradable.',
      'Mantén 3 segundos arriba con el pie flexionado hacia ti y vuelve a doblar la rodilla. Repite 10 veces por pierna.'
    ],
    errores: [
      'Levantar la cabeza y tensar el cuello.',
      'Forzar el estiramiento con dolor agudo.'
    ],
    consejo: 'Excelente calentamiento dinámico antes de hacer peso muerto rumano o sentadilla profunda.',
    variante: 'Con una banda elástica pasada por la planta del pie.',
    imagenes: ['/ex/90_90_Hamstring/0.jpg', '/ex/90_90_Hamstring/1.jpg'],
    ingles: '90/90 Hamstring Mobility'
  },
  {
    id: 'IT_Band_and_Glute_Stretch',
    nombre: 'Estiramiento profundo de glúteo y banda iliotibial',
    grupo: 'Movilidad',
    tipo: 'movilidad',
    equipo: 'Colchoneta o banda',
    nivel: 'principiante',
    musculos: 'Glúteo medio, piramidal, tensor de la fascia lata, banda iliotibial',
    efecto: 'Alivia la sobrecarga de cadera y previene molestias laterales de rodilla y ciática falsa (síndrome del piramidal).',
    pasos: [
      'Acuéstate boca arriba y cruza una pierna extendida o semiflexionada hacia el lado opuesto de tu cuerpo.',
      'Mantén ambos hombros pegados al suelo mientras dejas caer la pierna cruzada.',
      'Respira profundo por la nariz y suelta el aire relajando la cadera durante 30 segundos por lado.'
    ],
    errores: [
      'Despegar los hombros del piso perdiendo la torsión de cadera.',
      'Aguantar la respiración mientras estiras.'
    ],
    consejo: 'Realízalo al finalizar tu sesión de pierna o glúteo para acelerar la recuperación muscular.',
    variante: 'Estiramiento de figura 4 boca arriba abrazando la rodilla.',
    imagenes: ['/ex/IT_Band_and_Glute_Stretch/0.jpg', '/ex/IT_Band_and_Glute_Stretch/1.jpg'],
    ingles: 'Glute and IT Band Stretch'
  }
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
      return resolve(true);
    }
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(dest); } catch (e) {}
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(true));
      });
    }).on('error', (err) => {
      file.close();
      try { fs.unlinkSync(dest); } catch (e) {}
      reject(err);
    });
  });
}

async function main() {
  const current = JSON.parse(fs.readFileSync(exFilePath, 'utf8'));
  const currentIds = new Set(current.map(e => e.id));

  // 1. Update paths on the 40 existing exercises so each has its own /ex/<id>/0.jpg and 1.jpg
  for (const ex of current) {
    if (fixMap[ex.id]) {
      ex.imagenes = [`/ex/${ex.id}/0.jpg`, `/ex/${ex.id}/1.jpg`];
    }
  }

  // 2. Append new exercises
  let added = 0;
  for (const ne of newExercises) {
    if (!exdbMap.has(ne.id)) {
      throw new Error(`New exercise ID not found in exdb.json: ${ne.id}`);
    }
    if (!currentIds.has(ne.id)) {
      current.push(ne);
      currentIds.add(ne.id);
      added++;
    }
  }

  fs.writeFileSync(exFilePath, JSON.stringify(current, null, 2), 'utf8');
  console.log(`Updated exercises.json: ${current.length} total exercises (${added} new).`);

  // 3. Download all missing images for both the 40 fixed exercises and the 37 new exercises
  const toDownload = [];
  for (const [targetId, sourceId] of Object.entries(fixMap)) {
    toDownload.push({ targetId, sourceId });
  }
  for (const ne of newExercises) {
    toDownload.push({ targetId: ne.id, sourceId: ne.id });
  }

  let downloadedCount = 0;
  for (const item of toDownload) {
    for (const idx of [0, 1]) {
      const url = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${item.sourceId}/${idx}.jpg`;
      const dest = path.join(publicExDir, item.targetId, `${idx}.jpg`);
      const existed = fs.existsSync(dest) && fs.statSync(dest).size > 1000;
      await downloadFile(url, dest);
      if (!existed) downloadedCount++;
    }
  }
  console.log(`Downloaded ${downloadedCount} new image files into public/ex/.`);

  // 4. Final audit: verify EVERY exercise in exercises.json has both 0.jpg and 1.jpg on disk > 1KB
  let missing = 0;
  for (const ex of current) {
    if (!ex.imagenes || ex.imagenes.length === 0) {
      console.error(`ERROR: Exercise ${ex.id} has no imagenes array!`);
      missing++;
      continue;
    }
    for (const imgRel of ex.imagenes) {
      const abs = path.join(rootDir, 'public', imgRel);
      if (!fs.existsSync(abs) || fs.statSync(abs).size < 500) {
        console.error(`ERROR: Missing or corrupt image for ${ex.id}: ${abs}`);
        missing++;
      }
    }
  }
  if (missing > 0) {
    process.exit(1);
  }
  console.log(`VERIFIED: 100% of ${current.length} exercises have valid local images on disk!`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
