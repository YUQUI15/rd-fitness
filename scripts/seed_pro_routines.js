const { q } = require('../server/db');

const newTemplates = [
  {
    name: "Fuerza 5x5 Progresiva",
    goal: "Ganar fuerza máxima, densidad muscular y técnica en básicos",
    level: "intermedio",
    dpw: 3,
    description: "Método clásico de 5 series de 5 repeticiones con cargas pesadas. Descanso amplio de 2 a 3 minutos entre series pesadas para recuperación completa del sistema nervioso.",
    days: [
      [
        "Día A: Sentadilla, Banca y Remo",
        [
          ["Barbell_Squat", 5, "5", 150],
          ["Barbell_Bench_Press_-_Medium_Grip", 5, "5", 150],
          ["Bent_Over_Barbell_Row", 5, "5", 120],
          ["Plank", 3, "45 s", 45, 45]
        ]
      ],
      [
        "Día B: Sentadilla, Militar y Peso Muerto",
        [
          ["Barbell_Squat", 5, "5", 150],
          ["Overhead_Press_Barbell", 5, "5", 150],
          ["Barbell_Deadlift", 3, "5", 180],
          ["Dips_Chest", 3, "8-10", 90]
        ]
      ],
      [
        "Día C: Fuerza y Asistencia",
        [
          ["Barbell_Squat", 5, "5", 150],
          ["Barbell_Bench_Press_-_Medium_Grip", 5, "5", 150],
          ["T_Bar_Row", 5, "5", 120],
          ["Close_Grip_Lat_Pulldown", 3, "8-10", 75]
        ]
      ]
    ]
  },
  {
    name: "Glúteos & Piernas Pro Esculpido",
    goal: "Especialización en glúteos redondos, femorales y cintura estrecha",
    level: "intermedio",
    dpw: 4,
    description: "4 días por semana. Dos sesiones dedicadas a glúteos y piernas con ejercicios biomecánicamente óptimos, combinados con torso superior y core para una figura atlética y proporcionada.",
    days: [
      [
        "Glúteo & Isquiotibiales A",
        [
          ["Barbell_Hip_Thrust", 4, "10-12", 120],
          ["Bulgarian_Split_Squat", 3, "10 por pierna", 90],
          ["Romanian_Deadlift", 4, "10", 90],
          ["Cable_Glute_Kickback", 3, "15 por pierna", 60],
          ["Abductor_Machine", 3, "20", 45]
        ]
      ],
      [
        "Torso & Cintura Fina",
        [
          ["Close_Grip_Lat_Pulldown", 4, "10", 75],
          ["Incline_Dumbbell_Press", 3, "12", 60],
          ["Side_Lateral_Raise", 4, "15", 45],
          ["Cable_Rear_Delt_Fly", 3, "15", 45],
          ["Ab_Wheel_Rollout", 3, "10", 60],
          ["Russian_Twist", 3, "20", 45]
        ]
      ],
      [
        "Glúteo & Cuádriceps B",
        [
          ["Hack_Squat", 4, "10", 120],
          ["Leg_Press", 3, "12", 90],
          ["Dumbbell_Step_Up", 3, "12 por pierna", 60],
          ["Leg_Extensions", 3, "15", 60],
          ["Single_Leg_Hip_Thrust", 3, "12 por pierna", 45]
        ]
      ],
      [
        "Posterior, Core & HIIT",
        [
          ["Sumo_Deadlift", 4, "8", 120],
          ["Seated_Leg_Curl", 4, "12", 60],
          ["Seated_Calf_Raise", 4, "15", 45],
          ["Cable_Rope_Crunch", 3, "15", 60],
          ["Running_Treadmill", 1, "15 min", 0, 900]
        ]
      ]
    ]
  },
  {
    name: "Empuje–Tirón–Piernas (PPL) Elite (6 días)",
    goal: "Máxima hipertrofia muscular y volumen semanal para intermedios y avanzados",
    level: "avanzado",
    dpw: 6,
    description: "La división más respetada en culturismo natural: Empuje, Tirón, Pierna repetido dos veces por semana con variaciones de ejercicio A y B para cubrir todos los ángulos anatómicos.",
    days: [
      [
        "Empuje A (Pecho / Hombro / Tríceps)",
        [
          ["Barbell_Bench_Press_-_Medium_Grip", 4, "6-8", 120],
          ["Overhead_Press_Barbell", 3, "8-10", 90],
          ["Dips_Chest", 3, "10", 75],
          ["Side_Lateral_Raise", 4, "15", 45],
          ["Skull_Crushers", 3, "10", 60],
          ["Triceps_Pushdown_-_Rope_Attachment", 3, "12", 45]
        ]
      ],
      [
        "Tirón A (Espalda / Bíceps / Deltoides Post)",
        [
          ["Barbell_Deadlift", 3, "5", 150],
          ["Close_Grip_Lat_Pulldown", 4, "8-10", 90],
          ["T_Bar_Row", 3, "10", 90],
          ["Face_Pull", 4, "15", 45],
          ["Preacher_Curl", 3, "10", 60],
          ["Hammer_Curls", 3, "12", 45]
        ]
      ],
      [
        "Pierna A (Fuerza de Cuádriceps)",
        [
          ["Barbell_Squat", 4, "6-8", 150],
          ["Leg_Press", 3, "10-12", 90],
          ["Bulgarian_Split_Squat", 3, "10 por pierna", 75],
          ["Leg_Extensions", 3, "12-15", 60],
          ["Standing_Calf_Raises", 4, "15", 45],
          ["Hanging_Knee_Raise", 3, "12", 45]
        ]
      ],
      [
        "Empuje B (Inclinado & Aislamiento)",
        [
          ["Incline_Dumbbell_Press", 4, "8-10", 90],
          ["Arnold_Dumbbell_Press", 3, "10", 75],
          ["Low_Cable_Crossover", 3, "12", 60],
          ["Cable_Rear_Delt_Fly", 4, "15", 45],
          ["Close_Grip_Bench_Press", 3, "10", 60],
          ["Bench_Dips", 3, "12", 45]
        ]
      ],
      [
        "Tirón B (Espalda Amplitud & Bombeo)",
        [
          ["Wide-Grip_Lat_Pulldown", 4, "8-10", 90],
          ["One-Arm_Dumbbell_Row", 4, "10 por lado", 75],
          ["Straight_Arm_Cable_Pulldown", 3, "12", 60],
          ["Dumbbell_Rear_Delt_Fly", 4, "15", 45],
          ["Bicep_Curl_21s", 3, "21", 60],
          ["Concentration_Curl", 3, "12", 45]
        ]
      ],
      [
        "Pierna B (Glúteos & Isquiotibiales)",
        [
          ["Barbell_Hip_Thrust", 4, "8-10", 120],
          ["Romanian_Deadlift", 4, "8-10", 90],
          ["Seated_Leg_Curl", 4, "10-12", 60],
          ["Abductor_Machine", 4, "15", 45],
          ["Seated_Calf_Raise", 4, "15", 45],
          ["Cable_Rope_Crunch", 3, "15", 45]
        ]
      ]
    ]
  },
  {
    name: "Entrenamiento Exprés 35 Minutos",
    goal: "Alta densidad, resultados rápidos y salud en poco tiempo",
    level: "principiante",
    dpw: 3,
    description: "Diseñado para personas con agenda apretada. Series con descansos breves de 45 segundos para mantener la frecuencia cardíaca elevada y estimular el músculo en 35 minutos exactos.",
    days: [
      [
        "Sesión Exprés A (Cuerpo Completo)",
        [
          ["Goblet_Squat", 3, "12", 45],
          ["Dumbbell_Bench_Press", 3, "12", 45],
          ["One-Arm_Dumbbell_Row", 3, "12 por lado", 45],
          ["Crunches", 3, "15", 30],
          ["Rope_Jumping", 3, "1 min", 30, 60]
        ]
      ],
      [
        "Sesión Exprés B (Fuerza & Postura)",
        [
          ["Romanian_Deadlift", 3, "10", 45],
          ["Dumbbell_Shoulder_Press", 3, "10", 45],
          ["Close_Grip_Lat_Pulldown", 3, "10", 45],
          ["Dumbbell_Lunges", 3, "10 por pierna", 45],
          ["Plank", 3, "30 s", 30, 30]
        ]
      ],
      [
        "Sesión Exprés C (Circuito Metabólico)",
        [
          ["Leg_Press", 3, "12", 45],
          ["Pushups", 3, "12", 45],
          ["Seated_Cable_Rows", 3, "12", 45],
          ["Bench_Dips", 3, "12", 45],
          ["Burpees", 3, "10", 45]
        ]
      ]
    ]
  }
];

const existsEx = id => !!q.get('SELECT 1 x FROM exercises WHERE id=?', id);

q.tx(() => {
  for (const t of newTemplates) {
    const existing = q.get('SELECT id FROM routines WHERE name=? AND template=1', t.name);
    let routineId;
    if (existing) {
      routineId = existing.id;
      q.run('DELETE FROM routine_items WHERE routine_id=?', routineId);
      q.run('UPDATE routines SET goal=?, level=?, days_per_week=?, description=? WHERE id=?',
        t.goal, t.level, t.dpw, t.description, routineId);
    } else {
      const r = q.run('INSERT INTO routines(name,goal,level,days_per_week,description,template) VALUES(?,?,?,?,?,1)',
        t.name, t.goal, t.level, t.dpw, t.description);
      routineId = r.lastInsertRowid;
    }

    t.days.forEach(([title, items], di) => {
      items.forEach(([ex, sets, reps, rest, secs], pos) => {
        if (!existsEx(ex)) {
          console.warn(`Warning: Exercise ${ex} not found in database!`);
          return;
        }
        q.run('INSERT INTO routine_items(routine_id,day_index,day_title,pos,ex_id,sets,reps,seconds,rest) VALUES(?,?,?,?,?,?,?,?,?)',
          routineId, di, title, pos, ex, sets, reps, secs ?? null, rest);
      });
    });
    console.log(`Saved template routine: ${t.name} (ID: ${routineId}) with ${t.days.length} days`);
  }
});
