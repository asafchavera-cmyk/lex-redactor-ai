# Redactor Judicial de Élite ⚖️🤖

Herramienta avanzada de inteligencia artificial diseñada para asistir a especialistas legales y jueces en la redacción de resoluciones judiciales (Autos, Decretos, Sentencias).

## ✨ Características

- **Procesamiento de Documentos**: Sube escritos de litigantes en PDF y la IA extraerá los puntos clave.
- **Plantillas Personalizables**: Carga tus propios formatos institucionales en Word (.docx) para mantener la identidad visual de tu tribunal.
- **Generación Inteligente**: Utiliza Google Gemini Pro para redactar borradores coherentes, jurídicamente fundamentados y siguiendo formatos estrictos.
- **Previsualización en Tiempo Real**: Vista previa con formato judicial estándar (Times New Roman, 12pt, interlineado 1.15).
- **Privacidad**: Procesamiento local de archivos y conexión segura con la API de Google.

## 🚀 Instalación y Configuración

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/TU_USUARIO/TU_REPO.git
   cd TU_REPO
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**:
   Crea un archivo `.env` en la raíz del proyecto y añade tu clave de API de Gemini:
   ```env
   GEMINI_API_KEY=tu_api_key_aqui
   ```

4. **Iniciar en modo desarrollo**:
   ```bash
   npm run dev
   ```

## 🛠️ Tecnologías

- **Frontend**: React 19 + TypeScript + Tailwind CSS.
- **IA**: Google Generative AI (Gemini 1.5 Flash/Pro).
- **Procesamiento de Documentos**: 
  - `Mammoth.js` para lectura de archivos Word.
  - `PDF.js` para extracción de texto de expedientes.
- **Build Tool**: Vite.

## 📝 Uso de Plantillas

La aplicación permite subir archivos `.docx`. El sistema detectará el texto y lo usará como base. Puedes usar etiquetas como `[EXPEDIENTE]`, `[DEMANDANTE]`, etc., para que la IA sepa dónde insertar la información detectada.

---
*Desarrollado para la modernización de la gestión judicial mediante IA.*
