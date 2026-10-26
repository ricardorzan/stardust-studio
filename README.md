# ✨ Stardust Studio

> **Estudio moderno de creación y renderizado de videos musicales con letras animadas al estilo Spotify, impulsado por Next.js, React 19 y Remotion.**

---

## 📖 Descripción General

**Stardust Studio** es una plataforma integral para transformar pistas de audio y canciones en videos dinámicos con letras sincronizadas en tiempo real (formato Spotify Canvas / Karaoke lírico). 

Permite importar pistas de audio directamente (o vía enlaces con descarga automatizada), buscar canciones y carátulas HD mediante la API de Genius, traducir versos artísticamente con **Google Gemini**, sincronizar métricas de compás mediante tap-sync y analizar frecuencias graves/agudos para efectos visuales reactivos al beat, todo renderizado a **60 FPS** en formatos horizontal (16:9) y vertical (9:16 para TikTok/Reels/Shorts).

---

## 🚀 Características Principales

- 🎵 **Importación de Audio Inteligente**: Descarga y extracción automática de audio en formato de alta fidelidad desde enlaces soportados (usando `yt-dlp`) o carga manual de archivos locales.
- 🔍 **Búsqueda Instantánea con Genius**: Integración con Genius API y web scraping multi-etapa con fallback para recuperar carátulas en alta resolución y letras oficiales.
- 🤖 **Traducción Asistida por Inteligencia Artificial**: Traducción contextual y rítmica inglés-español impulsada por **Google Gemini (`@google/genai`)**, manteniendo la cadencia lírica original.
- ⏱️ **Tap-Sync Studio & Editor de Letras**: Herramienta interactiva para sincronizar versos al vuelo con la barra espaciadora, mezclar/dividir líneas y realizar ajustes finos de milisegundos.
- 🥁 **Analizador de Frecuencias y Beat Detection**: Detección de bajos (*bass kicks*), brillos (*cymbal shimmer*) y picos rítmicos que hacen pulsar sutilmente el fondo y los efectos visuales.
- 🎨 **Personalizador Visual de Temas**:
  - Presets visuales: *Spotify Moss*, *Neon Cyberpunk*, *Sunset Glow*, *Aura Pastel*, etc.
  - Soporte para fondos degradados, colores sólidos e imágenes personalizadas (con brillo, desenfoque y escala ajustables).
  - Efectos visuales configurables: resplandor vocal (*vocal glow*), partículas flotantes, destellos de platillos y pulsación de borde.
- 🎬 **Renderizado Remotion de Alto Rendimiento**:
  - Monitor en vivo con `@remotion/player` a 60 FPS.
  - Cola de renderizado en segundo plano con notificación de progreso en tiempo real.
  - Exportación en MP4 con soporte para proporciones **16:9 (Landscape)** y **9:16 (Portrait)**.
- 💾 **Gestión de Proyectos**: Guarda, exporta, importa y administra estados de sesión en formato JSON sin perder cambios.

---

## 🛠️ Stack Tecnológico

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Turbopack)
- **Librería de UI**: [React 19](https://react.dev/)
- **Estilos**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Motor de Video**: [Remotion](https://www.remotion.dev/)
- **Iconografía**: [Lucide React](https://lucide.dev/)
- **Inteligencia Artificial**: [Google Gen AI SDK](https://github.com/google-gemini/generative-ai-js)
- **Gestor de Estado**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Utilidades Multimedia**: Web Audio API, Cheerio, yt-dlp

---

## 📋 Requisitos Previos

1. **Node.js**: Versión 18.x o superior (se recomienda Node 20 LTS).
2. **FFmpeg**: Requerido por Remotion para codificación de video en el sistema.
   - *Windows*: `winget install Gyan.FFmpeg` o `choco install ffmpeg`
   - *macOS*: `brew install ffmpeg`
   - *Linux*: `sudo apt install ffmpeg`
3. **yt-dlp** *(Opcional para descargas por URL)*:
   - En Windows, coloca el ejecutable `yt-dlp.exe` dentro de la carpeta `bin/yt-dlp.exe`.
   - Puedes descargarlo directamente desde [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases).

---

## ⚙️ Instalación y Configuración

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/tu-usuario/stardust-studio.git
   cd stardust-studio
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**:
   Copia el archivo de plantilla `.env.example` y crea `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Edita `.env.local` con tus credenciales:
   ```env
   # Clave de API de Google Gemini (Gratuita en Google AI Studio)
   GEMINI_API_KEY=tu_api_key_de_gemini

   # Token de acceso cliente de Genius API (Gratuito en Genius API Clients)
   GENIUS_ACCESS_TOKEN=tu_access_token_de_genius
   ```

4. **Iniciar el servidor de desarrollo**:
   ```bash
   npm run dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 📽️ Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo con soporte Turbopack.
- `npm run build`: Compila la aplicación para producción.
- `npm run start`: Inicia la aplicación compilada en modo producción.
- `npm run lint`: Ejecuta el linter ESLint.
- `npm run render:landscape`: Renderiza un video Remotion en formato horizontal (16:9).
- `npm run render:portrait`: Renderiza un video Remotion en formato vertical (9:16).

---

## 📁 Estructura del Proyecto

```text
stardust-studio/
├── app/                        # Rutas de Next.js (App Router)
│   ├── api/                    # Endpoints (traducción, importación, render, proyectos)
│   ├── globals.css             # Estilos globales con Tailwind v4
│   ├── layout.tsx              # Layout raíz de la app
│   └── page.tsx                # Página y flujo principal de Stardust Studio
├── bin/                        # Binarios externos (ej. yt-dlp.exe, ignorado en Git)
├── components/                 # Componentes React de la interfaz de usuario
│   ├── LyricsReviewStep.tsx    # Editor y mezclador de versos
│   ├── QuickSongSearch.tsx     # Búsqueda en Genius
│   ├── RenderProgressModal.tsx # Modal de progreso del renderizado de video
│   ├── StudioLyricsMonitor.tsx # Monitor de letras con vista previa
│   ├── TapSyncStudio.tsx       # Estudio de sincronización rítmica en tiempo real
│   ├── ThemeCustomizer.tsx     # Inspector de temas, colores y estilos
│   ├── UrlImporter.tsx         # Importador de audio desde URLs
│   └── VideoPreviewPlayer.tsx  # Reproductor Remotion en el navegador
├── lib/                        # Lógica de negocio y utilidades
│   ├── audioAnalyzer.ts        # Analizador de audio y detección de beats
│   ├── geniusClient.ts         # Cliente de la API de Genius
│   ├── lyricsScraper.ts        # Extractor de letras web
│   ├── renderManager.ts        # Gestor de tareas de renderizado con Remotion
│   └── translator.ts           # Servicio de traducción artística con IA
├── public/                     # Archivos estáticos y directorio downloads
│   └── downloads/              # Archivos generados (.jobs, audios, images, projects, videos)
├── remotion/                   # Composiciones y componentes de video Remotion
│   ├── Root.tsx                # Registro de composiciones
│   └── SpotifyLyricsComposition.tsx # Composición visual animada
└── types/                      # Definiciones de TypeScript
```

---

## 🔒 Privacidad y Control de Versiones

Este repositorio incluye una configuración de `.gitignore` diseñada para proyectos en React / Next.js y Stardust Studio, excluyendo:
- Archivos multimedia descargados o generados (`audios/`, `images/`, `videos/`, `*.mp4`, `*.m4a`, etc.).
- Proyectos guardados localmente (`projects/`, `stardust_*.json`).
- Caché y registros de renderizado (`.jobs/`, `render-*.json`).
- Binarios locales (`bin/*.exe`).
- Variables de entorno y secretos (`.env*`).

---

## 📄 Licencia

Este proyecto es privado / de uso personal. Consulta los términos de uso de los servicios externos utilizados (Genius, Google Gemini, YouTube).
