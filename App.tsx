
import React, { useState, useRef, useEffect } from 'react';
import { generateJudicialDraft } from './services/geminiService';
import { GenerationState, JudicialResolutionInput, LitigantDocument } from './types';

interface SavedTemplate {
  id: string;
  name: string;
  content: string;
}

const DEFAULT_TEMPLATE: SavedTemplate = {
  id: 'default',
  name: 'Plantilla Estándar',
  content: `
EXPEDIENTE: [EXPEDIENTE]
ESPECIALISTA: [ESPECIALISTA]
DEMANDANTE: [DEMANDANTE]
DEMANDADA: [DEMANDADA]

Santiago, [FECHA_ACTUAL]

VISTO; el escrito de fecha [F.Ingreso], presentado por la parte [PARTE], y;

EN VISTA DE:
1. Que, ...
2. Que, ...

SE RESUELVE:
Primero.- ...
Segundo.- ...

Regístrese y Notifíquese.
`
};

export default function App() {
  const [showHelp, setShowHelp] = useState(false);
  const [copyStatus, setCopyStatus] = useState(false);
  const [documents, setDocuments] = useState<LitigantDocument[]>([]);
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  
  const [formData, setFormData] = useState<Omit<JudicialResolutionInput, 'documents'>>({
    template: '',
    extraInstructions: ''
  });

  const [state, setState] = useState<GenerationState>({
    isGenerating: false,
    resultHtml: '',
    error: null
  });

  const [isLoaded, setIsLoaded] = useState(false);

  const wordInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Load initial state
  useEffect(() => {
    const saved = localStorage.getItem('lex_redactor_v5_storage');
    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTemplates(parsed);
          setSelectedTemplateId(parsed[0].id);
          setFormData(prev => ({ ...prev, template: parsed[0].content }));
        } else if (Array.isArray(parsed)) {
          setTemplates([]);
        }
      } catch (e) {
        setTemplates([DEFAULT_TEMPLATE]);
        setSelectedTemplateId(DEFAULT_TEMPLATE.id);
        setFormData(prev => ({ ...prev, template: DEFAULT_TEMPLATE.content }));
      }
    } else {
      setTemplates([DEFAULT_TEMPLATE]);
      setSelectedTemplateId(DEFAULT_TEMPLATE.id);
      setFormData(prev => ({ ...prev, template: DEFAULT_TEMPLATE.content }));
    }
    setIsLoaded(true);
  }, []);

  // Persist state changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('lex_redactor_v5_storage', JSON.stringify(templates));
    }
  }, [templates, isLoaded]);

  const selectTemplate = (template: SavedTemplate | null) => {
    if (template) {
      setSelectedTemplateId(template.id);
      setFormData(prev => ({ ...prev, template: template.content }));
    } else {
      setSelectedTemplateId('');
      setFormData(prev => ({ ...prev, template: '' }));
    }
    setState(prev => ({ ...prev, resultHtml: '', error: null }));
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopyStatus(true);
      setTimeout(() => setCopyStatus(false), 2000);
    });
  };

  const deleteTemplate = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    const templateToDelete = templates.find(t => t.id === id);
    if (!templateToDelete) return;

    if (window.confirm(`¿Desea eliminar la plantilla "${templateToDelete.name}"?`)) {
      setTemplates(prev => prev.filter(t => t.id !== id));
      
      if (selectedTemplateId === id) {
        setSelectedTemplateId('');
        setFormData(prev => ({ ...prev, template: '' }));
      }
    }
  };

  const handleWordUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    
    setIsProcessingFile(true);
    
    for (const file of files) {
      if (!file.name.endsWith('.docx')) continue;
      
      const filePromise = new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const arrayBuffer = event.target?.result as ArrayBuffer;
            const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
            const fileName = file.name.replace('.docx', '');
            
            setTemplates(prev => {
              const existingIndex = prev.findIndex(t => t.name.toLowerCase() === fileName.toLowerCase());
              
              if (existingIndex !== -1) {
                if (window.confirm(`Ya existe una plantilla llamada "${fileName}". ¿Desea REEMPLAZARLA con esta nueva versión?`)) {
                  const updated = [...prev];
                  const existingId = updated[existingIndex].id;
                  updated[existingIndex] = { ...updated[existingIndex], content: result.value };
                  
                  if (selectedTemplateId === existingId) {
                    setFormData(f => ({ ...f, template: result.value }));
                  }
                  return updated;
                }
                return prev;
              }
              
              const newTemplate = { id: Date.now().toString() + Math.random(), name: fileName, content: result.value };
              // Select the last one uploaded
              setSelectedTemplateId(newTemplate.id);
              setFormData(f => ({ ...f, template: newTemplate.content }));
              return [...prev, newTemplate];
            });
          } catch (err) { console.error("Error al leer archivo Word:", file.name); }
          finally { resolve(); }
        };
        reader.readAsArrayBuffer(file);
      });
      
      await filePromise;
    }
    
    setIsProcessingFile(false);
    if (wordInputRef.current) wordInputRef.current.value = '';
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    
    setIsProcessingFile(true);
    const pdfjsLib = (window as any).pdfjsLib;

    for (const file of files) {
      if (!file.name.endsWith('.pdf')) continue;

      const reader = new FileReader();
      const filePromise = new Promise<LitigantDocument>((resolve, reject) => {
        reader.onload = async (event) => {
          try {
            const arrayBuffer = event.target?.result as ArrayBuffer;
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let text = "";
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const content = await page.getTextContent();
              text += content.items.map((item: any) => item.str).join(" ") + "\n\n";
            }
            resolve({ id: Math.random().toString(36).substr(2, 9), name: file.name, text });
          } catch (err) { reject(err); }
        };
        reader.readAsArrayBuffer(file);
      });

      try {
        const newDoc = await filePromise;
        setDocuments(prev => [...prev, newDoc]);
      } catch (err) {
        console.error("Error procesando PDF:", file.name);
      }
    }
    
    setIsProcessingFile(false);
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  };

  const removeDocument = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  const handleGenerate = async () => {
    if (documents.length === 0) {
      setState(prev => ({ ...prev, error: 'Debe cargar al menos un escrito del litigante.' }));
      return;
    }
    if (!formData.template.trim()) {
      setState(prev => ({ ...prev, error: 'Debe proporcionar una plantilla o formato.' }));
      return;
    }
    setState({ isGenerating: true, resultHtml: '', error: null });
    try {
      const html = await generateJudicialDraft({ ...formData, documents });
      setState({ isGenerating: false, resultHtml: html, error: null });
    } catch (err: any) {
      setState({ isGenerating: false, resultHtml: '', error: err.message || "Error en la generación." });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-900 font-sans select-none">
      <header className="bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path></svg>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-800 leading-none">LEX REDACTOR <span className="text-indigo-600">PRO</span></h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.25em] mt-1.5">Especialista Judicial • Sistema de Élite</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <button 
            onClick={handleShare} 
            className={`text-[11px] font-black px-4 py-2 rounded-xl border-2 transition-all flex items-center ${copyStatus ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-white border-indigo-100 text-indigo-600 hover:border-indigo-600'}`}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
            {copyStatus ? '¡URL COPIADA!' : 'COPIAR ENLACE'}
          </button>
          <button onClick={() => setShowHelp(!showHelp)} className="text-[11px] font-bold text-slate-500 hover:text-indigo-600 flex items-center transition-colors group">
            <svg className="w-5 h-5 mr-2 text-slate-300 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            MANUAL
          </button>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-10 overflow-hidden">
        <section className="flex flex-col space-y-8 overflow-y-auto pr-3 custom-scroll">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 space-y-8">
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <span className="w-6 h-6 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center text-[10px] font-black">01</span>
                  <span className={`text-[11px] font-black uppercase tracking-widest ${documents.length > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                    Expediente Digital ({documents.length})
                  </span>
                </div>
                <button 
                  onClick={() => pdfInputRef.current?.click()} 
                  className="text-[10px] font-black bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-700 transition-all flex items-center shadow-lg"
                  disabled={isProcessingFile}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                  CARGAR ESCRITOS
                </button>
                <input type="file" ref={pdfInputRef} onChange={handlePdfUpload} accept=".pdf" multiple className="hidden" />
              </div>
              
              <div className={`min-h-[100px] max-h-40 overflow-y-auto p-4 rounded-2xl border-2 border-dashed transition-all ${documents.length > 0 ? 'border-indigo-100 bg-indigo-50/20' : 'border-slate-100 bg-slate-50'}`}>
                {documents.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 py-4 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider">Sin documentos cargados</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-indigo-100 shadow-sm">
                        <span className="text-[11px] font-bold text-slate-700 truncate max-w-[80%]">{doc.name}</span>
                        <button onClick={() => removeDocument(doc.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <span className="w-6 h-6 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center text-[10px] font-black">02</span>
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Formatos Judiciales</span>
                </div>
                <div className="flex items-center space-x-3">
                  <button onClick={() => wordInputRef.current?.click()} className="text-[10px] font-black text-slate-500 hover:text-indigo-600 transition-all">+ SUBIR .DOCX</button>
                </div>
                <input type="file" ref={wordInputRef} onChange={handleWordUpload} accept=".docx" multiple className="hidden" />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2 custom-scroll-h min-h-[48px] items-center">
                {templates.length === 0 ? (
                  <div className="flex items-center space-x-4">
                    <span className="text-[10px] font-bold text-slate-300 italic">No hay formatos cargados.</span>
                    <button onClick={() => {
                      setTemplates([DEFAULT_TEMPLATE]);
                      setSelectedTemplateId(DEFAULT_TEMPLATE.id);
                      setFormData(prev => ({ ...prev, template: DEFAULT_TEMPLATE.content }));
                    }} className="text-[10px] font-black text-indigo-400 underline uppercase tracking-widest hover:text-indigo-600 transition-colors">Cargar Plantilla Estándar</button>
                  </div>
                ) : (
                  templates.map((t) => (
                    <div 
                      key={t.id} 
                      onClick={() => selectTemplate(t)} 
                      className={`flex-shrink-0 px-4 py-2.5 rounded-xl border-2 text-[10px] font-black uppercase tracking-tight transition-all cursor-pointer relative group pr-8 ${selectedTemplateId === t.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-500 hover:border-indigo-200'}`}
                    >
                      {t.name}
                      <button 
                        onClick={(e) => deleteTemplate(t.id, e)}
                        className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center transition-all ${selectedTemplateId === t.id ? 'text-white/60 hover:text-white' : 'text-slate-300 hover:text-red-500'}`}
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="relative">
                <textarea 
                  name="template" 
                  value={formData.template} 
                  onChange={(e) => setFormData({...formData, template: e.target.value})} 
                  placeholder="Sube tu archivo Word modificado o escribe aquí..."
                  className="w-full h-48 p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none text-[11px] font-mono text-slate-600 focus:border-indigo-500 transition-all resize-none" 
                />
                <div className="absolute bottom-4 right-4 flex space-x-2">
                  <button 
                    onClick={() => setFormData({...formData, template: ''})}
                    className="bg-slate-200 text-slate-600 text-[9px] font-black px-4 py-2 rounded-xl hover:bg-slate-300 transition-all uppercase tracking-widest"
                  >
                    Limpiar
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <span className="w-6 h-6 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center text-[10px] font-black">03</span>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Instrucciones de la Causa</span>
              </div>
              <textarea 
                name="extraInstructions" 
                value={formData.extraInstructions} 
                onChange={(e) => setFormData({...formData, extraInstructions: e.target.value})} 
                placeholder="Ej: 'Aceptar el desistimiento', 'Citar jurisprudencia sobre costas'..." 
                className="w-full h-24 p-5 bg-white border-2 border-slate-100 rounded-2xl outline-none text-xs text-slate-700 focus:border-indigo-500 transition-all shadow-sm" 
              />
            </div>

            <button 
              onClick={handleGenerate} 
              disabled={state.isGenerating || isProcessingFile} 
              className={`w-full py-5 rounded-[1.5rem] font-black text-sm uppercase tracking-[0.3em] shadow-2xl transition-all transform active:scale-95 ${state.isGenerating || isProcessingFile ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-500/40'}`}
            >
              {state.isGenerating ? 'PROCESANDO CON IA...' : 'GENERAR RESOLUCIÓN'}
            </button>
            {state.error && <p className="text-red-500 text-[10px] font-bold uppercase mt-2 text-center tracking-widest">{state.error}</p>}
          </div>
        </section>

        <section className="flex flex-col h-full">
          <div className="bg-[#1e293b] rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.4)] flex-1 flex flex-col overflow-hidden border border-slate-700">
            <div className="px-8 py-5 border-b border-slate-700 flex justify-between items-center bg-slate-800/60 backdrop-blur-md">
              <div className="flex items-center">
                <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full mr-4 shadow-[0_0_15px_rgba(99,102,241,0.8)]"></div>
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Hoja de Redacción</h2>
              </div>
              {state.resultHtml && (
                <button 
                  onClick={() => {
                    const blob = new Blob([state.resultHtml], { type: 'text/html' });
                    navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]).then(() => alert("Copiado al portapapeles."));
                  }} 
                  className="bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-2xl hover:bg-indigo-600 transition-all shadow-xl"
                >
                  COPIAR TODO
                </button>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-12 preview-container bg-[#0f172a]/40 select-text custom-scroll">
              {state.isGenerating ? (
                <div className="h-full flex flex-col items-center justify-center space-y-8 animate-pulse">
                   <p className="text-[11px] font-black uppercase tracking-[0.4em] text-indigo-400">Generando borrador judicial...</p>
                </div>
              ) : state.resultHtml ? (
                <div className="judicial-preview shadow-2xl animate-in fade-in zoom-in-95 duration-700 rounded-sm">
                   <div dangerouslySetInnerHTML={{ __html: state.resultHtml }} />
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center px-16 opacity-30 animate-in fade-in duration-700">
                  <svg className="w-24 h-24 text-slate-600 mb-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  <p className="text-[12px] font-black uppercase tracking-[0.4em] text-slate-500 text-center">Analiza escritos y genera autos rápidamente</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 px-10 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
        <div className="flex items-center space-x-2">
           <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
           <span>LEX REDACTOR PRO • ENTORNO SEGURO</span>
        </div>
        <span>SISTEMA DE ÉLITE JUDICIAL</span>
      </footer>

      {showHelp && (
        <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-md z-50 flex items-center justify-center p-6" onClick={() => setShowHelp(false)}>
          <div className="bg-white rounded-[2rem] p-12 max-w-xl w-full shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl font-black mb-6 uppercase tracking-tight text-slate-800">Guía de Sistema</h3>
            <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
              
              <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                <h4 className="font-black text-indigo-900 mb-2 uppercase text-xs tracking-widest">⚠️ ESPACIO DE TRABAJO PERSONAL</h4>
                <p>Esta herramienta utiliza el almacenamiento local de tu navegador. Tus plantillas y documentos son <strong>privados</strong> y solo tú puedes verlos en este dispositivo. Si compartes la aplicación mediante la pestaña "Compartir" de la plataforma, tus colegas tendrán su propio espacio de trabajo independiente.</p>
              </div>

              <div className="space-y-4">
                <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Flujo de Trabajo Externo</h4>
                <ul className="list-disc pl-5 space-y-3">
                  <li><strong>Copia vs Original:</strong> Al subir un Word, la App crea una <strong>copia</strong> interna. El archivo Word original en su PC nunca es modificado.</li>
                  <li><strong>Actualizar Formatos:</strong> Si edita su Word original, simplemente suba el archivo nuevo con el mismo nombre y el sistema lo actualizará automáticamente.</li>
                  <li><strong>Borrado:</strong> Puede borrar plantillas individuales usando la "×" en cada pestaña.</li>
                  <li><strong>Persistencia:</strong> Todo se guarda localmente en su navegador (LocalStorage).</li>
                </ul>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button 
                  onClick={() => { if(window.confirm("¿Restablecer todo el sistema? Se perderán todas tus plantillas personalizadas.")) { localStorage.clear(); window.location.reload(); } }} 
                  className="text-[10px] font-black text-red-400 hover:text-red-600 uppercase tracking-widest"
                >
                  Resetear base de datos (Peligro)
                </button>
              </div>
            </div>
            <button onClick={() => setShowHelp(false)} className="mt-10 w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest">CERRAR</button>
          </div>
        </div>
      )}


    </div>
  );
}
