
import { GoogleGenAI } from "@google/genai";
import { JudicialResolutionInput } from "../types";

// Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateJudicialDraft(input: JudicialResolutionInput): Promise<string> {
  const { documents, template, extraInstructions } = input;

  // Concatenamos los documentos con separadores claros para la IA
  const concatenatedDocs = documents.map(doc => `--- DOCUMENTO: ${doc.name} ---\n${doc.text}`).join('\n\n');

  const systemInstruction = `
    Eres un Especialista de Ejecución de Sentencia y Redactor Judicial de Élite.
    Tu objetivo es generar un borrador de resolución judicial (Auto) basado en uno o VARIOS escritos de un litigante y una plantilla.
    
    INSTRUCCIONES DE ANÁLISIS:
    1. Revisa todos los documentos proporcionados. A veces el segundo escrito aclara o modifica el primero.
    2. Identifica la pretensión principal y los argumentos de cada pieza procesal.
    
    REGLAS CRÍTICAS DE FORMATO (ESTRICTO):
    1. Salida: EXCLUSIVAMENTE código HTML. Sin explicaciones, sin markdown, solo etiquetas HTML.
    2. Fuente: Todas las etiquetas deben tener el estilo: style="font-family: 'Times New Roman', Times, serif; font-size: 12pt;".
    3. Interlineado: Estrictamente 1.15. Usa line-height: 1.15;.
    4. Alineación: Texto justificado (text-align: justify;).
    5. Estructura: 
       - Encabezados centrados y en negrita (Expediente, Especialista, etc.).
       - Secciones: Usar <strong> para VISTO;, CONSIDERANDO: o EN VISTA DE: y SE RESUELVE:.
       - Sangría: Primera línea de párrafos con text-indent: 3em;.
    6. Datos: Extrae de los escritos la fecha de ingreso (Cargo de Ingreso), número de expediente, partes y especialista.
    7. Lógica: Redacta la parte resolutiva de forma técnica y coherente con lo solicitado en los documentos.
    8. Instrucciones Extra: Si se proveen, intégralas con lenguaje técnico-jurídico.
  `;

  // Use gemini-3-pro-preview for complex tasks involving legal reasoning.
  const prompt = `
    PLANTILLA A UTILIZAR:
    ${template}

    ESCRITOS DEL LITIGANTE (MÚLTIPLES):
    ${concatenatedDocs}

    INSTRUCCIONES ADICIONALES DEL USUARIO:
    ${extraInstructions}

    Genera el borrador del Auto judicial cumpliendo estrictamente con el formato HTML solicitado.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
      },
    });

    // The response object features a text property (not a method) that directly returns the string output.
    const text = response.text || "";
    // Clean up potential markdown code block wrappers
    return text.replace(/```html|```/gi, '').trim();
  } catch (error) {
    console.error("Error generating draft:", error);
    throw new Error("No se pudo generar el borrador judicial. Intente nuevamente.");
  }
}
