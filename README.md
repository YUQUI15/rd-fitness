# RD Fitness Club - Sistema de Gestión y Entrenador Digital (Chivay)

Sistema integral para gimnasio con control de acceso por QR (físico y digital), punto de venta (POS), arqueo de caja, rutinas guiadas, 49 ejercicios anatómicos con imágenes y funcionamiento offline-first.

## 🚀 Despliegue Rápido en la Nube

### Opción 1: Railway / Render (Recomendada y más fácil)
1. Crea una cuenta en [Railway.app](https://railway.app) o [Render.com](https://render.com).
2. Conecta este repositorio de GitHub.
3. Configura:
   - **Start Command:** `node server/server.js`
   - **Environment Variables:**
     - `ADMIN_PASSWORD` = `TuClaveSegura2026`
     - `PORT` = `3000`
4. En Render/Railway agrega un **Persistent Disk (Volumen Persistente)** montado en `/app/storage` para que la base de datos no se borre al reiniciar.
5. Asigna tu dominio personalizado (ej. `app.rdfitnessclub.com`).

### Opción 2: Servidor VPS propio (Ubuntu en DigitalOcean / Hetzner / AWS)
1. Instala Node.js 22+:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs git
   ```
2. Clona el repositorio:
   ```bash
   git clone <URL_DE_TU_REPOSITORIO> rd-fitness
   cd rd-fitness
   npm install --omit=dev
   ```
3. Ejecuta con PM2 para que siempre esté activo:
   ```bash
   sudo npm install -g pm2
   pm2 start server/server.js --name "rd-fitness"
   pm2 startup
   pm2 save
   ```
4. Configura Nginx con SSL gratis (Certbot) para tu dominio.

## 💻 Ejecución Local en Recepción
```bash
npm install
node server/server.js
```
- Panel de Administración: `http://localhost:3000/admin/`
- App del Socio: `http://localhost:3000/`
- Impresión de Tarjetas PVC: `http://localhost:3000/admin/cards.html`
