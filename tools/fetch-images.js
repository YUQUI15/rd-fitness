// Descarga las imágenes de los ejercicios (free-exercise-db, dominio público) a public/ex/<id>/N.jpg
const fs = require('fs');
const path = require('path');
const list = require('../data/exercises_es.js');
const db = require('../exdb.json');
const BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

(async () => {
  const out = [];
  for (const e of list) {
    const src = db.find(x => x.id === e.id);
    if (!src) { console.log('SIN DATOS:', e.id); continue; }
    const dir = path.join(__dirname, '..', 'public', 'ex', e.id);
    fs.mkdirSync(dir, { recursive: true });
    const imgs = [];
    for (let i = 0; i < src.images.length; i++) {
      const file = path.join(dir, i + '.jpg');
      if (!fs.existsSync(file) || fs.statSync(file).size < 1000) {
        for (let t = 0; t < 3; t++) {
          try {
            const r = await fetch(BASE + src.images[i]);
            if (!r.ok) throw new Error(r.status);
            fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
            break;
          } catch (err) { if (t === 2) console.log('FALLO', e.id, i, err.message); }
        }
      }
      if (fs.existsSync(file)) imgs.push(`/ex/${e.id}/${i}.jpg`);
    }
    out.push({ ...e, imagenes: imgs, ingles: src.name });
    console.log('ok', e.id, imgs.length);
  }
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'exercises.json'), JSON.stringify(out, null, 1));
  console.log('Total', out.length);
})();
