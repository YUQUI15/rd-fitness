const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'data', 'exercises.json');
const current = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const currentIds = new Set(current.map(x => x.id));

const newExercises = [
  {
    id: "Dips_Chest",
    nombre: "Fondos en paralelas para pecho (Dips)",
    grupo: "Pecho",
    tipo: "fuerza",
    equipo: "Barras paralelas",
    nivel: "intermedio",
    musculos: "Pectoral mayor (inferior y externo), tríceps, deltoides anterior",
    efecto: "Ejercicio compuesto de peso corporal altamente eficaz para ensanchar y dar profundidad al pecho inferior.",
    pasos: [
      "Súbete a las barras paralelas manteniendo los brazos estirados pero sin bloquear los codos bruscamente.",
      "Inclina el torso hacia adelante unos 30 grados y flexiona ligeramente las rodillas cruzando los pies.",
      "Inhala y flexiona los codos bajando de forma controlada hasta que tus hombros queden ligeramente por debajo de los codos (o 90 grados).",
      "Siente el estiramiento profundo en el pecho sin forzar la articulación del hombro.",
      "Exhala y empuja con fuerza contrayendo los pectorales hasta regresar a la posición inicial manteniendo la inclinación del torso."
    ],
    errores: [
      "Mantener el cuerpo totalmente vertical (esto enfoca el esfuerzo en los tríceps en vez del pecho).",
      "Rebotar o descender demasiado rápido desestabilizando los hombros.",
      "Abrir los codos excesivamente hacia los lados."
    ],
    consejo: "Mantén el torso inclinado hacia adelante y los codos a unos 45 grados para maximizar el reclutamiento del pectoral.",
    variante: "Más fácil: fondos con banda elástica de asistencia o en máquina de fondos asistidos. Más difícil: con cinturón de lastre.",
    imagenes: ["/ex/Dips_Chest/0.jpg", "/ex/Dips_Chest/1.jpg"],
    ingles: "Chest Dips"
  },
  {
    id: "Decline_Barbell_Press",
    nombre: "Press declinado con barra",
    grupo: "Pecho",
    tipo: "fuerza",
    equipo: "Barra y banco declinado",
    nivel: "intermedio",
    musculos: "Pectoral inferior, tríceps, deltoides anterior",
    efecto: "Aisla la porción esternal e inferior del pectoral con menor tensión sobre la articulación glenohumeral que el press plano.",
    pasos: [
      "Asegura tus piernas en las almohadillas del banco declinado y recuéstate.",
      "Agarra la barra con una anchura ligeramente mayor a la de tus hombros.",
      "Desmonta la barra y sostenla directamente sobre la parte baja del pecho con los brazos extendidos.",
      "Inhala y baja la barra de manera controlada hasta rozar la línea inferior del pectoral.",
      "Exhala y presiona la barra verticalmente hacia arriba contrayendo fuertemente el pecho."
    ],
    errores: [
      "Bajar la barra hacia el cuello en lugar de la parte baja del pecho.",
      "Rebotar la barra contra el esternón.",
      "Separar la espalda o desacomodar las piernas del soporte."
    ],
    consejo: "Al terminar la serie, asegura la barra con ayuda de los ganchos antes de intentar incorporarte del banco declinado.",
    variante: "Con mancuernas en banco declinado para mayor libertad de movimiento en las muñecas.",
    imagenes: ["/ex/Decline_Barbell_Press/0.jpg", "/ex/Decline_Barbell_Press/1.jpg"],
    ingles: "Decline Barbell Bench Press"
  },
  {
    id: "Low_Cable_Crossover",
    nombre: "Cruce de poleas bajas ascendente",
    grupo: "Pecho",
    tipo: "hipertrofia",
    equipo: "Poleas dobles",
    nivel: "intermedio",
    musculos: "Pectoral superior (clavicular), deltoides anterior",
    efecto: "Desarrollo del haz clavicular del pectoral con tensión constante a lo largo de todo el arco de movimiento.",
    pasos: [
      "Coloca las poleas en la posición más baja y selecciona manerales individuales.",
      "Párate en el centro de la torre con un pie ligeramente adelantado para estabilidad.",
      "Toma las empuñaduras con palmas hacia adelante y codos ligeramente flexionados.",
      "Exhala y lleva las manos hacia arriba y hacia adentro en arco hasta que se encuentren frente a la altura del pecho superior.",
      "Aprieta los pectorales durante 1 segundo en el punto máximo de contracción.",
      "Inhala y regresa controladamente resistiendo el peso hasta sentir el estiramiento."
    ],
    errores: [
      "Usar impulso con la espalda o balancear el tronco hacia atrás.",
      "Flexionar y extender los codos simulando un curl de bíceps en lugar de un cruce."
    ],
    consejo: "Imagina que intentas juntar tus bíceps en el centro del pecho en la parte más alta de la repetición.",
    variante: "Alternar un brazo a la vez o realizar con mancuernas en banco inclinado.",
    imagenes: ["/ex/Low_Cable_Crossover/0.jpg", "/ex/Low_Cable_Crossover/1.jpg"],
    ingles: "Low Cable Crossover"
  },
  {
    id: "Dumbbell_Pullover",
    nombre: "Pullover con mancuerna",
    grupo: "Pecho",
    tipo: "hipertrofia",
    equipo: "Mancuerna y banco plano",
    nivel: "intermedio",
    musculos: "Pectoral mayor, dorsal ancho, serrato anterior, tríceps",
    efecto: "Expansión torácica, trabajo integral del pectoral y serrato anterior para una silueta atlética en V.",
    pasos: [
      "Apoya la parte superior de la espalda transversalmente sobre un banco plano, con la cadera ligeramente por debajo del banco.",
      "Sostén una mancuerna con ambas manos formando un rombo con los pulgares e índices bajo el disco superior.",
      "Inhala profundo y desciende la mancuerna en un arco por detrás de tu cabeza manteniendo los codos casi rectos con leve flexión.",
      "Baja hasta sentir una gran apertura y estiramiento en la caja torácica.",
      "Exhala y regresa la mancuerna a la posición vertical sobre tu pecho contrayendo el pecho y serratos."
    ],
    errores: [
      "Doblar los codos en exceso convirtiéndolo en una extensión de tríceps.",
      "Elevar excesivamente la cadera o arquear bruscamente la zona lumbar."
    ],
    consejo: "Mantén la cadera baja y respira hondo al bajar la mancuerna para maximizar la expansión de la caja torácica.",
    variante: "En banco inclinado con polea para mantener tensión en el punto más alto.",
    imagenes: ["/ex/Dumbbell_Pullover/0.jpg", "/ex/Dumbbell_Pullover/1.jpg"],
    ingles: "Dumbbell Pullover"
  },
  {
    id: "T_Bar_Row",
    nombre: "Remo con barra T",
    grupo: "Espalda",
    tipo: "fuerza",
    equipo: "Barra T o soporte Landmine",
    nivel: "intermedio",
    musculos: "Dorsal ancho, romboides, trapecio medio, deltoides posterior, erectores espinales",
    efecto: "Construye una espalda densa, gruesa y fuerte, permitiendo mover cargas altas con un agarre neutro ergonómico.",
    pasos: [
      "Colócate a horcajadas sobre la barra T con los pies al ancho de los hombros.",
      "Flexiona las rodillas, empuja la cadera hacia atrás y mantén el torso a unos 45 grados con la columna neutral.",
      "Toma el agarre neutro de la barra T con ambas manos.",
      "Inhala para presurizar el abdomen y exhala tirando de la barra hacia el ombligo.",
      "Conduce el movimiento con los codos hacia atrás y junta los omóplatos en la cima.",
      "Baja el peso controladamente hasta estirar por completo los dorsales sin perder la postura lumbar."
    ],
    errores: [
      "Redondear la espalda baja bajo carga pesada.",
      "Erguirse verticalmente para trampear con balanceo de cadera.",
      "Tirar con los bíceps en lugar de guiar con los codos."
    ],
    consejo: "Piensa en empujar tus codos hacia el techo y atrás, apretando la espalda media por 1 segundo.",
    variante: "Remo con soporte en el pecho (Chest-Supported T-Bar Row) para anular por completo la fatiga lumbar.",
    imagenes: ["/ex/T_Bar_Row/0.jpg", "/ex/T_Bar_Row/1.jpg"],
    ingles: "T-Bar Row"
  },
  {
    id: "Close_Grip_Lat_Pulldown",
    nombre: "Jalón al pecho agarre neutro cerrado",
    grupo: "Espalda",
    tipo: "hipertrofia",
    equipo: "Polea alta con maneral V",
    nivel: "principiante",
    musculos: "Dorsal ancho inferior, romboides, braquial, bíceps",
    efecto: "Mayor rango de recorrido y enfoque directo en la inserción baja del dorsal con comodidad en las muñecas.",
    pasos: [
      "Instala el maneral en V en la polea alta y ajusta el soporte de piernas.",
      "Sujeta el maneral, siéntate y fija los muslos firmemente bajo los rodillos.",
      "Inclina el torso sutilmente hacia atrás (10-15 grados) con el pecho proyectado.",
      "Inhala y exhala jalando el maneral verticalmente hacia la parte superior del pecho.",
      "Conduce los codos pegados a los costados y aprieta los dorsales abajo.",
      "Regresa lentamente dejando que el peso estire los dorsales hacia arriba."
    ],
    errores: [
      "Recostarse exageradamente hacia atrás para mover más peso con la inercia del torso.",
      "No permitir el estiramiento completo del dorsal en la fase excéntrica."
    ],
    consejo: "Detén la barra un instante sobre el esternón y siente cómo se cierran tus escápulas.",
    variante: "Jalón al pecho agarre prono abierto o jalón unilateral en polea.",
    imagenes: ["/ex/Close_Grip_Lat_Pulldown/0.jpg", "/ex/Close_Grip_Lat_Pulldown/1.jpg"],
    ingles: "Close-Grip Lat Pulldown"
  },
  {
    id: "Incline_Dumbbell_Row",
    nombre: "Remo en banco inclinado con mancuernas (Seal Row)",
    grupo: "Espalda",
    tipo: "hipertrofia",
    equipo: "Mancuernas y banco a 30-45°",
    nivel: "intermedio",
    musculos: "Espalda media, romboides, trapecio, deltoides posterior",
    efecto: "Elimina totalmente el estrés de la zona lumbar, permitiendo aislar la espalda con técnica estricta y sin trampas.",
    pasos: [
      "Coloca un banco inclinado a unos 30-40 grados y recuesta el pecho completamente sobre el respaldo.",
      "Toma una mancuerna en cada mano con los brazos colgando rectos hacia el piso.",
      "Inhala y exhala traccionando las mancuernas hacia tus costillas.",
      "Pega los codos hacia atrás y arriba, contrayendo fuertemente la espalda media durante 1 segundo.",
      "Baja las mancuernas despacio hasta el estiramiento total de los omóplatos."
    ],
    errores: [
      "Levantar el pecho del banco para ayudarse con inercia.",
      "Usar pesos excesivos que impidan una pausa isométrica arriba."
    ],
    consejo: "Ideal si tienes fatiga en la espalda baja o hernias lumbares, ya que el banco soporta tu peso corporal.",
    variante: "Con barra o cambiando a agarre prono abierto para enfocar deltoides posteriores.",
    imagenes: ["/ex/Incline_Dumbbell_Row/0.jpg", "/ex/Incline_Dumbbell_Row/1.jpg"],
    ingles: "Incline Dumbbell Row"
  },
  {
    id: "Straight_Arm_Cable_Pulldown",
    nombre: "Pullover en polea alta con brazos rectos",
    grupo: "Espalda",
    tipo: "aislamiento",
    equipo: "Polea alta con barra recta o cuerda",
    nivel: "principiante",
    musculos: "Dorsal ancho, serrato anterior, tríceps (cabeza larga)",
    efecto: "Aislamiento directo del dorsal ancho sin intervención de los bíceps. Excelente como pre-agotamiento o finisher.",
    pasos: [
      "Coloca una barra recta en la polea alta y tómala con agarre prono al ancho de hombros.",
      "Da dos pasos hacia atrás e inclina el torso hacia adelante unos 30 grados manteniendo la espalda recta.",
      "Con los brazos casi rectos (ligera flexión en los codos bloqueada), exhala y baja la barra en arco hacia los muslos.",
      "Aprieta los dorsales firmemente durante 1 segundo cuando la barra toque la parte alta de los muslos.",
      "Inhala y regresa la barra lentamente por encima del nivel de la cabeza para un estiramiento dorsal completo."
    ],
    errores: [
      "Flexionar y estirar los codos (convirtiéndolo en tríceps pushdown).",
      "Redondear la espalda o encorvar los hombros hacia adelante."
    ],
    consejo: "Mantén el ángulo de los codos completamente congelado durante todo el movimiento.",
    variante: "Utilizar la cuerda en lugar de la barra para conseguir mayor rango de contracción atrás.",
    imagenes: ["/ex/Straight_Arm_Cable_Pulldown/0.jpg", "/ex/Straight_Arm_Cable_Pulldown/1.jpg"],
    ingles: "Straight-Arm Pulldown"
  },
  {
    id: "Overhead_Press_Barbell",
    nombre: "Press militar con barra de pie (OHP)",
    grupo: "Hombros",
    tipo: "fuerza",
    equipo: "Barra olímpica",
    nivel: "intermedio",
    musculos: "Deltoides anterior, deltoides lateral, tríceps, trapecios, core",
    efecto: "El ejercicio rey de fuerza vertical de tren superior. Desarrolla hombros anchos y gran estabilidad de tronco.",
    pasos: [
      "Párate con los pies al ancho de caderas y la barra apoyada en la parte superior del pecho / clavículas.",
      "Agarra la barra justo por fuera de los hombros con los antebrazos completamente verticales.",
      "Aprieta glúteos, cuádriceps y abdomen para crear una base rígida inquebrantable.",
      "Lleva la cabeza ligeramente hacia atrás para despejar el camino de la barra.",
      "Exhala y empuja la barra directamente en línea recta hacia el techo.",
      "Una vez que la barra pase la cabeza, lleva la cabeza naturalmente hacia adelante y bloquea los brazos sobre la cabeza.",
      "Inhala y desciende la barra controladamente de vuelta a las clavículas."
    ],
    errores: [
      "Arquear excesivamente la zona lumbar hacia atrás por falta de fuerza de core.",
      "Separar los codos hacia atrás en lugar de apuntarlos ligeramente adelante.",
      "Usar impulso de las piernas (eso sería Push Press en lugar de Press estricto)."
    ],
    consejo: "Aprieta los glúteos al máximo durante todo el levantamiento para blindar la columna lumbar.",
    variante: "Sentado en banco con respaldo o con mancuernas para menor exigencia de estabilidad.",
    imagenes: ["/ex/Overhead_Press_Barbell/0.jpg", "/ex/Overhead_Press_Barbell/1.jpg"],
    ingles: "Standing Overhead Barbell Press"
  },
  {
    id: "Arnold_Dumbbell_Press",
    nombre: "Press Arnold con mancuernas",
    grupo: "Hombros",
    tipo: "hipertrofia",
    equipo: "Mancuernas y banco",
    nivel: "intermedio",
    musculos: "Deltoides anterior, deltoides lateral, tríceps",
    efecto: "Popularizado por Arnold Schwarzenegger. La rotación de 180° involucra las cabezas anterior y lateral del hombro.",
    pasos: [
      "Siéntate en un banco con respaldo a 90 grados sosteniendo dos mancuernas a la altura de la clavícula.",
      "Comienza con las palmas mirando hacia tu cuerpo (agarre supino), como al final de un curl de bíceps.",
      "Exhala y comienza a empujar las mancuernas hacia arriba mientras rotas las muñecas hacia afuera.",
      "Al llegar a la cima con los brazos extendidos, las palmas deben estar mirando hacia el frente.",
      "Inhala y desciende controladamente invirtiendo la rotación hasta volver a palmas mirando al pecho."
    ],
    errores: [
      "Chocar las mancuernas bruscamente arriba.",
      "Rotar los codos de forma descontrolada que cause molestias en el manguito rotador."
    ],
    consejo: "Usa un peso moderado para controlar la rotación fluida y sin tirones.",
    variante: "De pie o de forma unilateral para desafiar la estabilidad del core.",
    imagenes: ["/ex/Arnold_Dumbbell_Press/0.jpg", "/ex/Arnold_Dumbbell_Press/1.jpg"],
    ingles: "Arnold Dumbbell Press"
  },
  {
    id: "Dumbbell_Rear_Delt_Fly",
    nombre: "Pájaros con mancuernas (deltoides posterior)",
    grupo: "Hombros",
    tipo: "aislamiento",
    equipo: "Mancuernas",
    nivel: "principiante",
    musculos: "Deltoides posterior, romboides, trapecio medio",
    efecto: "Corrige los hombros caídos hacia adelante causados por el uso del celular y horas sentado frente al computador.",
    pasos: [
      "Siéntate en el borde de un banco o inclínate de pie con el torso casi paralelo al piso.",
      "Sostén mancuernas ligeras bajo tus piernas con las palmas enfrentadas y codos apenas flexionados.",
      "Exhala y eleva las mancuernas hacia los lados guiando con los codos hasta que queden alineados con los hombros.",
      "Aprieta la parte posterior de los hombros durante 1 segundo.",
      "Inhala y regresa lentamente sin balancear el torso."
    ],
    errores: [
      "Usar mancuernas demasiado pesadas y balancear la espalda.",
      "Tirar con los trapecios encogiendo el cuello hacia arriba."
    ],
    consejo: "Piensa en empujar los nudillos hacia las paredes laterales en lugar de elevar hacia el techo.",
    variante: "Apoyando el pecho en un banco inclinado para mayor aislamiento postural.",
    imagenes: ["/ex/Dumbbell_Rear_Delt_Fly/0.jpg", "/ex/Dumbbell_Rear_Delt_Fly/1.jpg"],
    ingles: "Dumbbell Rear Delt Fly"
  },
  {
    id: "Cable_Rear_Delt_Fly",
    nombre: "Elevaciones posteriores en polea cruzada",
    grupo: "Hombros",
    tipo: "aislamiento",
    equipo: "Poleas dobles altas sin manerales",
    nivel: "intermedio",
    musculos: "Deltoides posterior, trapecio medio e inferior, romboides",
    efecto: "Brinda tensión continua ininterrumpida sobre el deltoides posterior en todo el rango articular.",
    pasos: [
      "Ajusta las dos poleas a la altura de tu cabeza y retira los manerales agarrando directamente los cables por la bola de goma.",
      "Toma el cable izquierdo con la mano derecha y el cable derecho con la mano izquierda (cables cruzados).",
      "Párate en el centro con los brazos extendidos al frente a la altura de la vista.",
      "Exhala y abre los brazos horizontalmente hacia atrás en arco hasta sentir la máxima contracción del deltoides posterior.",
      "Mantén 1 segundo la contracción y regresa inhalando despacio resistiendo el peso."
    ],
    errores: [
      "Doblar excesivamente los codos.",
      "Impulsarse con el torso hacia atrás."
    ],
    consejo: "Mantén los brazos paralelos al suelo y los hombros alejados de las orejas.",
    variante: "En máquina contractora invertida (Pec Deck invertido).",
    imagenes: ["/ex/Cable_Rear_Delt_Fly/0.jpg", "/ex/Cable_Rear_Delt_Fly/1.jpg"],
    ingles: "Cable Rear Delt Fly"
  },
  {
    id: "Bulgarian_Split_Squat",
    nombre: "Sentadilla búlgara con mancuernas",
    grupo: "Piernas",
    tipo: "fuerza",
    equipo: "Mancuernas y banco",
    nivel: "intermedio",
    musculos: "Cuádriceps, glúteo mayor, isquiotibiales, estabilizadores",
    efecto: "El ejercicio unilateral definitivo para corregir asimetrías de piernas, construir glúteos fuertes y elevar la potencia.",
    pasos: [
      "Coloca un pie apoyado en el empeine sobre un banco detrás de ti y da un paso adelante con el pie delantero.",
      "Sostén una mancuerna en cada mano a los costados del cuerpo con el torso firme.",
      "Inhala y flexiona la rodilla delantera bajando la cadera en vertical hasta que el muslo delantero quede paralelo al suelo.",
      "La rodilla trasera desciende cerca del piso sin golpearlo.",
      "Exhala y empuja el suelo firmemente con el talón y mediopié delantero para volver a subir."
    ],
    errores: [
      "Pisar demasiado cerca del banco provocando que la rodilla delantera colapse hacia adelante sin estabilidad.",
      "Inclinarse excesivamente hacia los lados o perder el equilibrio por no fijar la mirada al frente."
    ],
    consejo: "Para más cuádriceps: torso erguido. Para más glúteos: inclina el torso levemente hacia adelante (unos 15-20°).",
    variante: "Comenzar sin peso para dominar el equilibrio antes de cargar mancuernas.",
    imagenes: ["/ex/Bulgarian_Split_Squat/0.jpg", "/ex/Bulgarian_Split_Squat/1.jpg"],
    ingles: "Bulgarian Split Squat"
  },
  {
    id: "Hack_Squat",
    nombre: "Sentadilla Hack en máquina",
    grupo: "Piernas",
    tipo: "hipertrofia",
    equipo: "Máquina Hack",
    nivel: "intermedio",
    musculos: "Cuádriceps (vasto medial, lateral y recto femoral), glúteos",
    efecto: "Permite una flexión profunda de rodilla con soporte lumbar completo para un estímulo masivo de cuádriceps sin peligro de fallo de espalda.",
    pasos: [
      "Coloca la espalda y cabeza bien apoyadas en el respaldo acolchado con los hombros bajo las almohadillas.",
      "Posiciona los pies en la plataforma al ancho de caderas.",
      "Libera las palancas de seguridad y extiende las piernas sin bloquear las rodillas.",
      "Inhala y desciende de manera suave y profunda hasta lograr al menos 90 grados de flexión de rodilla.",
      "Exhala y empuja la plataforma con toda la planta del pie hasta volver a la posición inicial."
    ],
    errores: [
      "Despegar la zona lumbar o los glúteos del respaldo en la parte más profunda.",
      "Levantar los talones de la plataforma durante la bajada."
    ],
    consejo: "Baja en 3 segundos controlados y explota hacia arriba para máxima hipertrofia de cuádriceps.",
    variante: "Colocar los pies más altos en la plataforma recluta más glúteos e isquios; más abajo enfoca más cuádriceps.",
    imagenes: ["/ex/Hack_Squat/0.jpg", "/ex/Hack_Squat/1.jpg"],
    ingles: "Hack Squat"
  },
  {
    id: "Sumo_Deadlift",
    nombre: "Peso muerto sumo",
    grupo: "Piernas",
    tipo: "fuerza",
    equipo: "Barra olímpica",
    nivel: "avanzado",
    musculos: "Glúteos, aductores, cuádriceps, isquiotibiales, erectores espinales",
    efecto: "Variante de peso muerto con menor demanda de flexión de cadera y mayor activación de aductores y glúteos.",
    pasos: [
      "Adopta una postura muy amplia con los pies cerca de los discos y puntas abiertas hacia afuera (45 grados).",
      "Baja la cadera manteniendo el torso más erguido que en el peso muerto convencional.",
      "Agarra la barra por dentro de las piernas con agarre al ancho de hombros.",
      "Presuriza el abdomen, abre el pecho y bloquea las escápulas.",
      "Empuja el suelo con los pies separando las rodillas hacia afuera y extiende cadera y rodillas al mismo tiempo.",
      "Llega a posición erguida apretando los glúteos sin arquear la espalda hacia atrás."
    ],
    errores: [
      "Dejar que las rodillas se cierren hacia adentro durante el ascenso.",
      "Levantar la cadera antes que los hombros transformándolo en un Buenos Días."
    ],
    consejo: "Imagina que intentas partir el suelo por la mitad con tus pies hacia los lados.",
    variante: "Con mancuerna pesada o pesa rusa para principiantes antes de usar barra.",
    imagenes: ["/ex/Sumo_Deadlift/0.jpg", "/ex/Sumo_Deadlift/1.jpg"],
    ingles: "Sumo Deadlift"
  },
  {
    id: "Seated_Leg_Curl",
    nombre: "Curl de pierna sentado en máquina",
    grupo: "Piernas",
    tipo: "aislamiento",
    equipo: "Máquina de curl femoral sentado",
    nivel: "principiante",
    musculos: "Isquiotibiales (bíceps femoral, semitendinoso, semimembranoso)",
    efecto: "Estudios científicos demuestran mayor hipertrofia de isquios en curl sentado que tumbado, por trabajar en posición de cadera flexionada (músculo elongado).",
    pasos: [
      "Ajusta el respaldo para que la articulación de tus rodillas coincida con el eje de giro de la máquina.",
      "Baja la almohadilla de sujeción superior firmemente sobre tus muslos para fijarte al asiento.",
      "Coloca la almohadilla inferior justo por debajo de las pantorrillas (tendón de Aquiles).",
      "Exhala y flexiona las piernas tirando de los talones hacia abajo y atrás con fuerza.",
      "Aguanta 1 segundo la contracción completa bajo tus glúteos.",
      "Inhala y regresa la carga en 3 segundos controlados hasta que las piernas queden casi estiradas."
    ],
    errores: [
      "Dejar que la almohadilla de muslos quede floja permitiendo que la cadera se levante.",
      "Soltar el peso bruscamente sin controlar la fase de extensión."
    ],
    consejo: "Mantén los pies en posición neutra o dedos hacia las espinillas (dorsiflexión) para mayor enfoque femoral.",
    variante: "Curl de pierna tumbado o con mancuerna entre los pies.",
    imagenes: ["/ex/Seated_Leg_Curl/0.jpg", "/ex/Seated_Leg_Curl/1.jpg"],
    ingles: "Seated Leg Curl"
  },
  {
    id: "Adductor_Machine",
    nombre: "Máquina de aductores de cadera",
    grupo: "Piernas",
    tipo: "aislamiento",
    equipo: "Máquina de aducción",
    nivel: "principiante",
    musculos: "Aductor mayor, aductor mediano, gracilis",
    efecto: "Fortalece la cara interna del muslo, estabiliza la pelvis y previene lesiones de cadera e ingle.",
    pasos: [
      "Siéntate en la máquina con la espalda apoyada y ajusta las palancas para abrir las piernas a un rango cómodo.",
      "Coloca la cara interna de las rodillas contra los cojines acolchados.",
      "Exhala y junta las piernas apretando los cojines hacia el centro de forma controlada.",
      "Sostén la contracción durante 1 segundo al juntar las almohadillas.",
      "Inhala y abre las piernas lentamente resistiendo el retorno del peso."
    ],
    errores: [
      "Utilizar pesos excesivos que fuercen tirones en los tendones de la ingle.",
      "Separar la espalda del respaldo o rebotar el peso al juntar."
    ],
    consejo: "Prioriza el rango completo y el control sobre la cantidad de placas.",
    variante: "Aducción en polea baja con tobillera.",
    imagenes: ["/ex/Adductor_Machine/0.jpg", "/ex/Adductor_Machine/1.jpg"],
    ingles: "Hip Adductor Machine"
  },
  {
    id: "Abductor_Machine",
    nombre: "Máquina de abductores de cadera",
    grupo: "Glúteos",
    tipo: "aislamiento",
    equipo: "Máquina de abducción",
    nivel: "principiante",
    musculos: "Glúteo medio, glúteo menor, tensor de la fascia lata",
    efecto: "Desarrollo del glúteo medio para dar forma redondeada a la cadera y asegurar estabilidad en sentadillas y carrera.",
    pasos: [
      "Siéntate con la espalda bien apoyada y ajusta la máquina con las piernas juntas.",
      "Coloca la cara externa de los muslos/rodillas contra las almohadillas.",
      "Exhala y empuja las almohadillas hacia afuera abriendo las piernas al máximo rango posible.",
      "Mantén 1 segundo la contracción con las piernas abiertas sintiendo el fuego en el glúteo lateral.",
      "Inhala y cierra las piernas despacio sin dejar que las placas choquen."
    ],
    errores: [
      "Cerrar las piernas demasiado rápido perdiendo la fase excéntrica.",
      "Ayudarse empujando con las manos sobre el asiento."
    ],
    consejo: "Inclinar el torso ligeramente hacia adelante incrementa el reclutamiento del glúteo medio.",
    variante: "Abducciones en polea de pie o con banda de resistencia elástica.",
    imagenes: ["/ex/Abductor_Machine/0.jpg", "/ex/Abductor_Machine/1.jpg"],
    ingles: "Hip Abductor Machine"
  },
  {
    id: "Seated_Calf_Raise",
    nombre: "Elevación de talones sentado (Sóleo)",
    grupo: "Piernas",
    tipo: "aislamiento",
    equipo: "Máquina de sóleo sentado",
    nivel: "principiante",
    musculos: "Sóleo (músculo profundo de la pantorrilla)",
    efecto: "Al estar la rodilla flexionada a 90°, los gemelos se acortan y el esfuerzo recae 100% sobre el sóleo, dando anchura y grosor a la pantorrilla.",
    pasos: [
      "Siéntate en la máquina colocando las puntas de los pies en el borde de la plataforma y los muslos bajo las almohadillas acolchadas.",
      "Quita la palanca de seguridad elevando los talones.",
      "Inhala y baja los talones todo lo que permita tu flexibilidad para un estiramiento profundo.",
      "Exhala y empuja con fuerza con el metatarso subiendo los talones lo más alto posible.",
      "Sostén la contracción en la cima durante 2 segundos completos antes de volver a descender."
    ],
    errores: [
      "Hacer repeticiones rápidas y con rebote aprovechando el tendón de Aquiles.",
      "Poner el pie demasiado adentro de la plataforma impidiendo la flexión del tobillo."
    ],
    consejo: "La pausa de 2 segundos arriba y 1 segundo abajo anula el rebote elástico y obliga al sóleo a crecer.",
    variante: "Sentado en un banco con una barra o mancuernas sobre los muslos y un disco bajo los pies.",
    imagenes: ["/ex/Seated_Calf_Raise/0.jpg", "/ex/Seated_Calf_Raise/1.jpg"],
    ingles: "Seated Calf Raise"
  },
  {
    id: "Cable_Glute_Kickback",
    nombre: "Patada de glúteo en polea baja",
    grupo: "Glúteos",
    tipo: "aislamiento",
    equipo: "Polea baja con tobillera",
    nivel: "principiante",
    musculos: "Glúteo mayor (porción superior), glúteo medio",
    efecto: "Aislamiento hipertrófico del glúteo con tensión constante que las pesas libres no pueden ofrecer.",
    pasos: [
      "Coloca una tobillera en tu pierna de trabajo y conéctala a la polea baja.",
      "Da un paso atrás y sujétate de la estructura de la polea, inclinando el torso a unos 45 grados con la espalda recta.",
      "Inhala y exhala pateando la pierna hacia atrás y ligeramente en diagonal hacia afuera.",
      "Aprieta el glúteo en el punto más alto durante 1 segundo sin arquear la zona lumbar.",
      "Inhala y regresa la pierna hacia adelante de manera controlada."
    ],
    errores: [
      "Arquear la espalda baja para ganar altura en la patada (la cadera debe permanecer fija).",
      "Patear con impulso brusco en lugar de contracción muscular."
    ],
    consejo: "Patear con una ligera rotación externa del pie (hacia afuera) activa mejor las fibras del glúteo mayor.",
    variante: "En máquina de patada de glúteos o en cuadrupedia en el suelo con banda elástica.",
    imagenes: ["/ex/Cable_Glute_Kickback/0.jpg", "/ex/Cable_Glute_Kickback/1.jpg"],
    ingles: "Cable Glute Kickback"
  },
  {
    id: "Dumbbell_Step_Up",
    nombre: "Step-up en cajón con mancuernas",
    grupo: "Glúteos",
    tipo: "fuerza",
    equipo: "Mancuernas y cajón pliométrico o banco",
    nivel: "principiante",
    musculos: "Glúteo mayor, cuádriceps, isquiotibiales",
    efecto: "Excelente para desarrollo atlético unilateral, equilibrio funcional y gran activación del glúteo mayor en la extensión de cadera.",
    pasos: [
      "Párate frente a un cajón o banco resistente sosteniendo una mancuerna en cada mano.",
      "Coloca todo el pie derecho firmemente sobre la superficie del banco.",
      "Empuja a través del talón derecho y sube tu cuerpo extendiendo rodilla y cadera sin impulsarte con el pie que está en el suelo.",
      "Llega a posición erguida con ambos pies arriba.",
      "Desciende despacio con el pie izquierdo amortiguando la bajada.",
      "Completa las repeticiones con una pierna y cambia a la otra."
    ],
    errores: [
      "Dar un salto o empujón con la pierna del suelo en lugar de hacer la fuerza con la pierna de arriba.",
      "Apoyar solo la punta del pie en el banco en vez de toda la planta."
    ],
    consejo: "Mantén el torso levemente inclinado hacia adelante para dirigir la mayor carga al glúteo de la pierna que sube.",
    variante: "Sin peso para principiantes o aumentando la altura del cajón para mayor rango articular.",
    imagenes: ["/ex/Dumbbell_Step_Up/0.jpg", "/ex/Dumbbell_Step_Up/1.jpg"],
    ingles: "Dumbbell Step-Up"
  },
  {
    id: "Single_Leg_Hip_Thrust",
    nombre: "Puente de glúteo unilateral",
    grupo: "Glúteos",
    tipo: "aislamiento",
    equipo: "Suelo o banco (con o sin mancuerna)",
    nivel: "principiante",
    musculos: "Glúteo mayor, isquiotibiales, core",
    efecto: "Elimina asimetrías de fuerza entre glúteos y activa intensamente la musculatura pélvica.",
    pasos: [
      "Recuéstate boca arriba con las rodillas dobladas y los pies planos en el suelo.",
      "Eleva una pierna estirada o doblada hacia tu pecho en el aire.",
      "Inhala y exhala empujando el suelo con el talón de la pierna apoyada.",
      "Eleva la cadera hasta alinear rodilla, cadera y hombros, apretando el glúteo al máximo arriba durante 1 segundo.",
      "Inhala y desciende la cadera rozando el suelo antes de repetir."
    ],
    errores: [
      "Empujar con la punta del pie en lugar de con el talón.",
      "Hiperextender la zona lumbar en la parte más alta."
    ],
    consejo: "Coloca la parte alta de la espalda apoyada en un banco para mayor rango de movimiento.",
    variante: "Colocar una mancuerna sobre la cadera para añadir sobrecarga progresiva.",
    imagenes: ["/ex/Single_Leg_Hip_Thrust/0.jpg", "/ex/Single_Leg_Hip_Thrust/1.jpg"],
    ingles: "Single-Leg Hip Thrust"
  },
  {
    id: "Preacher_Curl",
    nombre: "Curl en banco Scott / predicador",
    grupo: "Bíceps",
    tipo: "aislamiento",
    equipo: "Banco predicador y barra Z",
    nivel: "intermedio",
    musculos: "Bíceps braquial (cabeza corta), braquial anterior",
    efecto: "Aislamiento estricto del bíceps imposibilitando cualquier balanceo o trampa con los hombros.",
    pasos: [
      "Siéntate en el banco predicador apoyando las axilas en la parte superior del acolchado.",
      "Toma la barra Z en las curvas interiores con agarre supino.",
      "Inhala y exhala flexionando los codos elevando la barra hacia los hombros sin despegar los brazos del banco.",
      "Aprieta los bíceps 1 segundo en el punto de máxima contracción.",
      "Inhala y baja la barra de manera muy lenta y controlada hasta que los brazos queden casi estirados (sin bloquear la articulación)."
    ],
    errores: [
      "Extender los codos con violencia al final arriesgando una lesión del tendón bicipital.",
      "Despegar el torso o levantarse del asiento para jalar la barra."
    ],
    consejo: "Usa un peso moderado y jamás sueltes la barra de golpe en la parte baja.",
    variante: "Con mancuerna a una mano para trabajar unilateralmente cada brazo.",
    imagenes: ["/ex/Preacher_Curl/0.jpg", "/ex/Preacher_Curl/1.jpg"],
    ingles: "Preacher Curl with EZ Bar"
  },
  {
    id: "Bicep_Curl_21s",
    nombre: "Curl 21 con barra",
    grupo: "Bíceps",
    tipo: "hipertrofia",
    equipo: "Barra Z o barra recta",
    nivel: "intermedio",
    musculos: "Bíceps braquial, braquiorradial",
    efecto: "Técnica avanzada de alta intensidad y congestión metabólica: 7 repeticiones inferiores + 7 superiores + 7 completas sin descanso.",
    pasos: [
      "Párate recto sosteniendo la barra con agarre supino al ancho de hombros.",
      "Fase 1: Haz 7 repeticiones desde el punto más bajo hasta la mitad del recorrido (antebrazos paralelos al piso).",
      "Fase 2: Sin detenerte, haz 7 repeticiones desde la mitad del recorrido hasta arriba del todo.",
      "Fase 3: Sin descanso, haz 7 repeticiones completas desde abajo hasta arriba.",
      "Al terminar las 21 repeticiones, desciende la barra con control."
    ],
    errores: [
      "Usar demasiado peso y no poder completar las 21 repeticiones con técnica estricta.",
      "Balancear el cuerpo para sacar las últimas repeticiones."
    ],
    consejo: "Utiliza un 50-60% del peso que usarías en una serie normal de 10 repeticiones.",
    variante: "Con mancuernas o en polea baja para variar la curva de resistencia.",
    imagenes: ["/ex/Bicep_Curl_21s/0.jpg", "/ex/Bicep_Curl_21s/1.jpg"],
    ingles: "Barbell 21s Curl"
  },
  {
    id: "Concentration_Curl",
    nombre: "Curl concentrado con mancuerna",
    grupo: "Bíceps",
    tipo: "aislamiento",
    equipo: "Mancuerna y banco",
    nivel: "principiante",
    musculos: "Bíceps braquial (pico del bíceps), braquial",
    efecto: "Uno de los ejercicios con mayor activación electromiográfica (EMG) del bíceps. Desarrolla la altura y pico muscular.",
    pasos: [
      "Siéntate en el borde de un banco con las piernas abiertas.",
      "Toma una mancuerna y apoya la parte posterior del brazo/tríceps contra la cara interna del muslo del mismo lado.",
      "Deja colgar el brazo casi estirado.",
      "Exhala y flexiona el codo levantando la mancuerna hacia tu rostro manteniendo el codo inmóvil contra el muslo.",
      "Gira sutilmente la muñeca hacia afuera en la cima (supinación) y aprieta el bíceps con fuerza.",
      "Inhala y baja la mancuerna con lentitud hasta la posición inicial."
    ],
    errores: [
      "Balancear el torso o impulsarse con la pierna.",
      "Mover el codo hacia adelante despegándolo del muslo."
    ],
    consejo: "Concéntrate exclusivamente en la contracción del bíceps sin mover ningún otro músculo del cuerpo.",
    variante: "De pie inclinado estilo Arnold.",
    imagenes: ["/ex/Concentration_Curl/0.jpg", "/ex/Concentration_Curl/1.jpg"],
    ingles: "Concentration Dumbbell Curl"
  },
  {
    id: "Cable_Bicep_Curl",
    nombre: "Curl de bíceps en polea baja",
    grupo: "Bíceps",
    tipo: "aislamiento",
    equipo: "Polea baja con barra",
    nivel: "principiante",
    musculos: "Bíceps braquial, braquial, antebrazos",
    efecto: "Mantiene tensión constante al inicio del movimiento donde las mancuernas pierden resistencia por la gravedad.",
    pasos: [
      "Coloca una barra corta en la polea baja y tómala con palmas hacia arriba al ancho de hombros.",
      "Párate erguido a un paso de la polea con los codos pegados a los costados.",
      "Exhala y flexiona los codos subiendo la barra hacia el pecho manteniendo los codos en su lugar.",
      "Aprieta los bíceps durante 1 segundo arriba.",
      "Inhala y regresa despacio hasta estirar los brazos resistiendo el tirón del cable."
    ],
    errores: [
      "Llevar los codos hacia adelante involucrando los hombros.",
      "Arquear la espalda hacia atrás al subir la carga."
    ],
    consejo: "Para mayor congestión, realiza una pausa de 2 segundos en la fase de bajada.",
    variante: "Con cuerda para enfatizar bíceps y braquial o a una sola mano.",
    imagenes: ["/ex/Cable_Bicep_Curl/0.jpg", "/ex/Cable_Bicep_Curl/1.jpg"],
    ingles: "Standing Cable Curl"
  },
  {
    id: "Close_Grip_Bench_Press",
    nombre: "Press de banca con agarre cerrado",
    grupo: "Tríceps",
    tipo: "fuerza",
    equipo: "Barra olímpica y banco plano",
    nivel: "intermedio",
    musculos: "Tríceps (las tres cabezas), pectoral superior, deltoides anterior",
    efecto: "Ejercicio básico compuesto para ganar masa y fuerza masiva en los tríceps con cargas pesadas.",
    pasos: [
      "Acuéstate en el banco plano con los ojos bajo la barra.",
      "Toma la barra con las manos al ancho de los hombros (aproximadamente a unos 30-40 cm de distancia).",
      "Desmonta la barra y colócala sobre el pecho con los brazos extendidos.",
      "Inhala y desciende la barra hacia la parte media/baja del pecho, manteniendo los codos pegados a los costados.",
      "Exhala y presiona con los tríceps hasta extender los brazos.",
      "Bloquea los codos con control en la cima sintiendo los tríceps."
    ],
    errores: [
      "Juntar las manos demasiado (menos de 20 cm causa molestias graves en las muñecas).",
      "Abrir los codos hacia afuera en lugar de mantenerlos cerca del torso."
    ],
    consejo: "Un agarre justo a la anchura de tus hombros protege tus muñecas y activa al máximo los tríceps.",
    variante: "En máquina Smith para mayor estabilidad en repeticiones pesadas.",
    imagenes: ["/ex/Close_Grip_Bench_Press/0.jpg", "/ex/Close_Grip_Bench_Press/1.jpg"],
    ingles: "Close-Grip Barbell Bench Press"
  },
  {
    id: "Bench_Dips",
    nombre: "Fondos entre bancos",
    grupo: "Tríceps",
    tipo: "fuerza",
    equipo: "Uno o dos bancos planos",
    nivel: "principiante",
    musculos: "Tríceps, deltoides anterior, pectoral superior",
    efecto: "Constructor clásico de tríceps que se puede realizar en cualquier lugar y admite sobrecarga colocando discos sobre los muslos.",
    pasos: [
      "Coloca dos bancos paralelos separados a la distancia de tus piernas.",
      "Apoya las palmas en el borde del banco trasero y los talones en el banco delantero.",
      "Inhala y flexiona los codos bajando el torso en línea recta hasta que los brazos formen un ángulo de 90 grados.",
      "Mantén la espalda muy cerca del banco trasero.",
      "Exhala y empuja con las palmas extendiendo los brazos y apretando los tríceps."
    ],
    errores: [
      "Separar el torso del banco trasero sobrecargando los hombros.",
      "Descender por debajo de los 90 grados si se siente molestia articular en el hombro."
    ],
    consejo: "Mantén el pecho erguido y los codos apuntando hacia atrás, no hacia los lados.",
    variante: "Con los pies en el suelo para principiantes; con discos en el regazo para avanzados.",
    imagenes: ["/ex/Bench_Dips/0.jpg", "/ex/Bench_Dips/1.jpg"],
    ingles: "Bench Dips"
  },
  {
    id: "Skull_Crushers",
    nombre: "Rompecráneos / Press francés con barra Z",
    grupo: "Tríceps",
    tipo: "hipertrofia",
    equipo: "Barra Z y banco plano",
    nivel: "intermedio",
    musculos: "Tríceps braquial (cabeza larga y medial)",
    efecto: "Enfoca la cabeza larga del tríceps, responsable de la mayor parte del volumen del brazo.",
    pasos: [
      "Acuéstate en el banco plano sosteniendo la barra Z con agarre prono cerrado.",
      "Extiende los brazos sobre el pecho e inclínalos levemente hacia atrás (unos 10 grados hacia tu cabeza).",
      "Inhala y flexiona únicamente los codos bajando la barra hacia tu frente o justo por detrás de la coronilla.",
      "Mantén los codos apuntando al techo sin abrirlos hacia los lados.",
      "Exhala y extiende los codos volviendo a la posición inicial apretando los tríceps."
    ],
    errores: [
      "Abrir los codos como alas hacia los costados.",
      "Mover los hombros convirtiéndolo en un pullover en lugar de una extensión pura de codo."
    ],
    consejo: "Bajar la barra ligeramente detrás de la cabeza en vez de a la frente mantiene tensión continua en la cabeza larga del tríceps.",
    variante: "Con mancuernas (agarre neutro) para evitar tensión en las muñecas.",
    imagenes: ["/ex/Skull_Crushers/0.jpg", "/ex/Skull_Crushers/1.jpg"],
    ingles: "EZ-Bar Skull Crushers"
  },
  {
    id: "Barbell_Wrist_Curl",
    nombre: "Curl de muñeca con barra (Antebrazos)",
    grupo: "Antebrazos",
    tipo: "aislamiento",
    equipo: "Barra recta o mancuernas y banco",
    nivel: "principiante",
    musculos: "Flexores del antebrazo, flexor común de los dedos",
    efecto: "Aumenta la fuerza de agarre para peso muerto y dominadas y desarrolla el grosor de los antebrazos.",
    pasos: [
      "Siéntate en un banco y apoya los antebrazos sobre tus muslos o sobre el borde del banco, dejando las muñecas colgando fuera.",
      "Sujeta la barra con las palmas hacia arriba (agarre supino).",
      "Inhala y desciende la barra abriendo ligeramente los dedos para que la barra ruede hacia las puntas.",
      "Exhala, cierra los dedos y flexiona las muñecas hacia arriba lo más alto posible.",
      "Aprieta los antebrazos durante 1 segundo arriba y repite despacio."
    ],
    errores: [
      "Mover los codos o levantar los antebrazos del banco.",
      "Utilizar demasiado peso que impida el rango articular completo."
    ],
    consejo: "Realiza repeticiones altas (15-20 reps) con cadencia controlada para maximizar la resistencia y bombeo.",
    variante: "Con mancuernas o en polea baja.",
    imagenes: ["/ex/Barbell_Wrist_Curl/0.jpg", "/ex/Barbell_Wrist_Curl/1.jpg"],
    ingles: "Barbell Wrist Curl"
  },
  {
    id: "Reverse_Barbell_Curl",
    nombre: "Curl inverso con barra (Braquiorradial)",
    grupo: "Antebrazos",
    tipo: "hipertrofia",
    equipo: "Barra Z o barra recta",
    nivel: "intermedio",
    musculos: "Braquiorradial, extensores del antebrazo, braquial",
    efecto: "Construye la parte superior del antebrazo y añade densidad al brazo visto de perfil y de frente.",
    pasos: [
      "Párate recto sujetando la barra con palmas mirando hacia abajo (agarre prono) al ancho de hombros.",
      "Pega los codos a tus costados y mantén la espalda erguida.",
      "Exhala y flexiona los codos levantando la barra hacia tus hombros sin mover los codos de su lugar.",
      "Aprieta con fuerza los antebrazos y brazos en la parte alta durante 1 segundo.",
      "Inhala y desciende la barra despacio en 3 segundos resistiendo la gravedad."
    ],
    errores: [
      "Extender las muñecas hacia arriba de forma exagerada.",
      "Balancear el torso para ayudar a subir el peso."
    ],
    consejo: "Utiliza una barra Z para mayor comodidad en las articulaciones de las muñecas.",
    variante: "En polea baja o con mancuernas.",
    imagenes: ["/ex/Reverse_Barbell_Curl/0.jpg", "/ex/Reverse_Barbell_Curl/1.jpg"],
    ingles: "Reverse Barbell Curl"
  },
  {
    id: "Dumbbell_Shrugs",
    nombre: "Encogimiento de hombros con mancuernas (Trapecios)",
    grupo: "Trapecio",
    tipo: "aislamiento",
    equipo: "Mancuernas pesadas",
    nivel: "principiante",
    musculos: "Trapecio superior, elevador de la escápula",
    efecto: "Construye trapecios gruesos y fuertes, protege el cuello en deportes de contacto y mejora la postura general.",
    pasos: [
      "Párate derecho con una mancuerna pesada en cada mano a los costados del cuerpo.",
      "Mantén los brazos completamente rectos y la mirada al frente.",
      "Exhala y encoge los hombros verticalmente hacia las orejas lo más alto posible.",
      "Sostén la contracción máxima en la cima durante 2 segundos completos.",
      "Inhala y baja los hombros lentamente hasta sentir el estiramiento completo de los trapecios."
    ],
    errores: [
      "Rotar los hombros hacia atrás o adelante (es lesivo para el manguito rotador y no aporta nada).",
      "Flexionar los codos intentando levantar la carga con los brazos."
    ],
    consejo: "El movimiento es estrictamente vertical: hacia arriba y hacia abajo, con pausa arriba.",
    variante: "Con barra olímpica por delante o por detrás (Haney Shrugs), o en máquina Smith.",
    imagenes: ["/ex/Dumbbell_Shrugs/0.jpg", "/ex/Dumbbell_Shrugs/1.jpg"],
    ingles: "Dumbbell Shrugs"
  },
  {
    id: "Ab_Wheel_Rollout",
    nombre: "Rueda abdominal (Ab Wheel Rollout)",
    grupo: "Core",
    tipo: "fuerza",
    equipo: "Rueda abdominal",
    nivel: "avanzado",
    musculos: "Recto abdominal, transverso abdominal, serrato, dorsales",
    efecto: "El mejor ejercicio anti-extensión para el abdomen. Crea un core de acero protegiendo la columna de impactos y cargas pesadas.",
    pasos: [
      "Arrodíllate sobre una colchoneta con la rueda en el suelo directamente debajo de tus hombros.",
      "Toma las empuñaduras firmemente y activa el abdomen redondeando sutilmente la espalda alta (retroversión pélvica).",
      "Inhala y rueda hacia adelante de forma controlada estirando el cuerpo en línea recta sin que la cadera caiga.",
      "Avanza hasta el punto más lejano que puedas controlar sin que tu espalda baja se hunda o arquee.",
      "Exhala, aprieta el abdomen con fuerza y jala la rueda hacia atrás regresando a la posición inicial."
    ],
    errores: [
      "Dejar que la zona lumbar se arquee o ceda hacia el piso (peligro para la columna).",
      "Tirar con las caderas hacia atrás primero en lugar de traccionar con el core."
    ],
    consejo: "Si eres principiante, rueda frente a una pared para usarla como tope de seguridad hasta ganar fuerza.",
    variante: "Rueda de pie para atletas de élite; o planchas dinámicas para progresión.",
    imagenes: ["/ex/Ab_Wheel_Rollout/0.jpg", "/ex/Ab_Wheel_Rollout/1.jpg"],
    ingles: "Ab Wheel Rollout"
  },
  {
    id: "Hanging_Knee_Raise",
    nombre: "Elevación de rodillas colgado en barra",
    grupo: "Core",
    tipo: "fuerza",
    equipo: "Barra de dominadas o torre de fondos",
    nivel: "intermedio",
    musculos: "Recto abdominal (porción inferior), flexores de cadera, oblicuos",
    efecto: "Desarrollo del abdomen inferior y descompresión de la columna vertebral al estar colgado por gravedad.",
    pasos: [
      "Cuélgate de una barra de dominadas con las manos al ancho de hombros y los brazos estirados.",
      "Activa las escápulas y aprieta el abdomen para evitar balancearte como péndulo.",
      "Exhala y eleva las rodillas hacia tu pecho, enrollando la pelvis hacia arriba en la parte final del movimiento.",
      "Sostén la contracción durante 1 segundo arriba.",
      "Inhala y desciende las piernas despacio hasta quedar extendidas sin impulsarte."
    ],
    errores: [
      "Balancear las piernas como péndulo usando inercia.",
      "Subir solo los muslos sin flexionar la pelvis (eso trabaja solo los flexores de cadera, no el abdomen)."
    ],
    consejo: "Piensa en mostrarle la pelvis a la pared frente a ti para enrollar el abdomen inferior.",
    variante: "Con piernas completamente estiradas (Hanging Leg Raise) para máxima dificultad.",
    imagenes: ["/ex/Hanging_Knee_Raise/0.jpg", "/ex/Hanging_Knee_Raise/1.jpg"],
    ingles: "Hanging Knee Raise"
  },
  {
    id: "Cable_Rope_Crunch",
    nombre: "Crunch abdominal en polea alta con cuerda",
    grupo: "Core",
    tipo: "hipertrofia",
    equipo: "Polea alta con cuerda",
    nivel: "principiante",
    musculos: "Recto abdominal (toda la pared frontal)",
    efecto: "Permite aplicar sobrecarga progresiva con peso real al abdomen para desarrollar relieve y profundidad en los 'cuadritos'.",
    pasos: [
      "Coloca una cuerda en la polea alta y arrodíllate a unos 60 cm de la torre.",
      "Sostén los extremos de la cuerda a ambos lados de tu cabeza cerca de las orejas.",
      "Fija la cadera en el espacio; el movimiento NO debe provenir de sentarte sobre los talones.",
      "Exhala y encoge el torso llevando los codos hacia las rodillas, curvando la columna y contrayendo el abdomen al máximo.",
      "Sostén la contracción durante 2 segundos sintiendo la tensión en el abdomen.",
      "Inhala y regresa despacio extendiendo la columna sin mover la cadera."
    ],
    errores: [
      "Mover la cadera hacia adelante y atrás convirtiéndolo en un balanceo de glúteos.",
      "Tirar de la cuerda con los brazos y hombros en vez de encoger la pared abdominal."
    ],
    consejo: "Imagina que intentas pegar tu esternón al ombligo en cada repetición.",
    variante: "Crunch en banco declinado con disco sobre el pecho.",
    imagenes: ["/ex/Cable_Rope_Crunch/0.jpg", "/ex/Cable_Rope_Crunch/1.jpg"],
    ingles: "Kneeling Cable Crunch"
  },
  {
    id: "Burpees",
    nombre: "Burpees completos con salto",
    grupo: "Cardio",
    tipo: "acondicionamiento",
    equipo: "Sin equipo (peso corporal)",
    nivel: "intermedio",
    musculos: "Cuerpo completo: piernas, pecho, core, hombros y sistema cardiovascular",
    efecto: "Quema calórica acelerada, incremento drástico del VO2 máx y resistencia muscular integral.",
    pasos: [
      "Párate erguido con los pies al ancho de los hombros.",
      "Agáchate en sentadilla y apoya las manos en el suelo frente a ti.",
      "Lanza los pies hacia atrás con un salto llegando a posición de plancha alta.",
      "Baja el pecho hasta tocar el suelo con una flexión de brazos controlada.",
      "Empuja el suelo, salta con los pies hacia adelante aterrizando en posición de sentadilla.",
      "Explota hacia arriba con un salto vertical aplaudiendo por encima de tu cabeza.",
      "Aterriza suavemente y encadena la siguiente repetición."
    ],
    errores: [
      "Dejar caer la cadera hacia el piso en la plancha arqueando la espalda baja.",
      "Aterrizar con las piernas rígidas sin amortiguar el impacto."
    ],
    consejo: "Enfócate en un ritmo constante y respiración rítmica en vez de hacer 5 repeticiones muy rápidas y agotarte.",
    variante: "Sprawls (sin flexión de pecho al suelo) o paso a paso sin salto para principiantes.",
    imagenes: ["/ex/Burpees/0.jpg", "/ex/Burpees/1.jpg"],
    ingles: "Full Burpees"
  }
];

let addedCount = 0;
for (const ex of newExercises) {
  if (!currentIds.has(ex.id)) {
    current.push(ex);
    currentIds.add(ex.id);
    addedCount++;
  }
}

fs.writeFileSync(filePath, JSON.stringify(current, null, 1), 'utf8');
console.log(`Successfully added ${addedCount} new exercises! Total now: ${current.length}`);
