/**
 * TextFixer v1.0
 * Herramienta profesional de búsqueda y reemplazo para archivos de configuración
 * y logs de seguridad informática / Check Point networking.
 *
 * Arquitectura:
 * - Todo en un solo archivo JSX para uso como artifact en Claude.ai
 * - Lógica separada en hooks/utils internos
 * - Estado local con useReducer para cambios complejos
 * - No depende de localStorage ni Redux
 */

import { useState, useReducer, useRef, useCallback, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────

/** Escapa caracteres especiales para uso seguro en RegExp */
const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Crea un RegExp seguro a partir de texto de búsqueda */
const crearRegex = (buscar, ignorarCase) => {
  if (!buscar) return null;
  try {
    return new RegExp(escaparRegex(buscar), ignorarCase ? "gi" : "g");
  } catch {
    return null;
  }
};

/**
 * Analiza el texto y genera un array de cambios propuestos.
 * No modifica el original.
 */
const generarCambios = (texto, buscar, reemplazar, ignorarCase) => {
  if (!texto || !buscar) return [];
  const lineas = texto.split("\n");
  const regex = crearRegex(buscar, ignorarCase);
  if (!regex) return [];

  const cambios = [];
  lineas.forEach((linea, idx) => {
    regex.lastIndex = 0;
    if (regex.test(linea)) {
      regex.lastIndex = 0;
      cambios.push({
        id: idx,
        linea: idx,
        original: linea,
        modificado: linea.replace(regex, reemplazar),
        aplicar: true,
      });
    }
  });
  return cambios;
};

/**
 * Aplica los cambios aprobados al texto original
 * y devuelve el texto final.
 */
const aplicarCambios = (texto, cambios) => {
  const lineas = texto.split("\n");
  cambios.forEach(({ linea, modificado, aplicar }) => {
    if (aplicar) lineas[linea] = modificado;
  });
  return lineas.join("\n");
};

/**
 * Resalta coincidencias en un texto plano devolviendo
 * un array de partes: { texto, tipo: 'normal'|'match'|'replace' }
 */
const resaltarTexto = (linea, buscar, ignorarCase, esModificado = false, reemplazar = "") => {
  if (!buscar || !linea) return [{ texto: linea || "", tipo: "normal" }];
  const regex = crearRegex(buscar, ignorarCase);
  if (!regex) return [{ texto: linea, tipo: "normal" }];

  const partes = [];
  let ultimo = 0;
  let match;
  regex.lastIndex = 0;

  if (esModificado && reemplazar) {
    // En vista modificada resaltamos el reemplazo
    const reemplazarEscapado = crearRegex(reemplazar, ignorarCase);
    if (reemplazarEscapado) {
      reemplazarEscapado.lastIndex = 0;
      while ((match = reemplazarEscapado.exec(linea)) !== null) {
        if (match.index > ultimo) partes.push({ texto: linea.slice(ultimo, match.index), tipo: "normal" });
        partes.push({ texto: match[0], tipo: "replace" });
        ultimo = match.index + match[0].length;
        if (!reemplazarEscapado.global) break;
      }
    }
  } else {
    while ((match = regex.exec(linea)) !== null) {
      if (match.index > ultimo) partes.push({ texto: linea.slice(ultimo, match.index), tipo: "normal" });
      partes.push({ texto: match[0], tipo: "match" });
      ultimo = match.index + match[0].length;
    }
  }

  if (ultimo < linea.length) partes.push({ texto: linea.slice(ultimo), tipo: "normal" });
  return partes.length ? partes : [{ texto: linea, tipo: "normal" }];
};

// ─────────────────────────────────────────────
// REDUCER DE CAMBIOS
// ─────────────────────────────────────────────

const cambiosReducer = (state, action) => {
  switch (action.type) {
    case "SET":
      return action.cambios;
    case "TOGGLE":
      return state.map((c) => c.id === action.id ? { ...c, aplicar: !c.aplicar } : c);
    case "APLICAR_UNO":
      return state.map((c) => c.id === action.id ? { ...c, aplicar: true } : c);
    case "IGNORAR_UNO":
      return state.map((c) => c.id === action.id ? { ...c, aplicar: false } : c);
    case "APLICAR_TODOS":
      return state.map((c) => ({ ...c, aplicar: true }));
    case "IGNORAR_TODOS":
      return state.map((c) => ({ ...c, aplicar: false }));
    case "CLEAR":
      return [];
    default:
      return state;
  }
};

// ─────────────────────────────────────────────
// COMPONENTE: LineaViewer
// ─────────────────────────────────────────────

const LineaViewer = ({
  numero,
  texto,
  partes,
  esModificada,
  onAplicar,
  onIgnorar,
  aplicada,
  esActiva,
}) => {
  
  return (
    <div
  className={`flex items-start group relative transition-colors ${
    esActiva
      ? "bg-white/10"
      : esModificada
      ? aplicada
        ? "bg-green-950/20"
        : "bg-red-950/10"
      : ""
  }`}
      style={{ minHeight: "1.5rem" }}
    >
      <span
        className="select-none text-right pr-3 pl-2 shrink-0 text-xs leading-6"
        style={{ color: "#4a5568", minWidth: "3rem", fontFamily: "monospace" }}
      >
        {numero + 1}
      </span>
      <span
        className="flex-1 leading-6 text-sm whitespace-pre overflow-hidden"
        style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace", color: "#d6d6d6" }}
      >
        {partes.map((p, i) => (
          <span
            key={i}
            style={
              p.tipo === "match"
                ? { backgroundColor: "#ff9800", color: "#000", borderRadius: "2px", padding: "0 1px" }
                : p.tipo === "replace"
                ? { backgroundColor: "#00c853", color: "#000", borderRadius: "2px", padding: "0 1px" }
                : {}
            }
          >
            {p.texto}
          </span>
        ))}
      </span>
      {esModificada && (
        <div className="flex items-center gap-1 shrink-0 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onAplicar}
            title="Aplicar cambio"
            className="flex items-center justify-center rounded border text-xs w-6 h-6 transition-colors"
            style={{
              borderColor: aplicada ? "#00c853" : "#2a2f3a",
              background: aplicada ? "#00c85322" : "transparent",
              color: "#00c853",
            }}
          >
            ✓
          </button>
          <button
            onClick={onIgnorar}
            title="Ignorar cambio"
            className="flex items-center justify-center rounded border text-xs w-6 h-6 transition-colors"
            style={{
              borderColor: !aplicada ? "#ef4444" : "#2a2f3a",
              background: !aplicada ? "#ef444422" : "transparent",
              color: "#ef4444",
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// COMPONENTE: StatCard
// ─────────────────────────────────────────────

const StatCard = ({ icon, label, value, color }) => (
  <div
    className="flex-1 flex items-center gap-3 rounded-lg px-4 py-3"
    style={{ background: "#171a21", border: "1px solid #2a2f3a" }}
  >
    <span style={{ color, fontSize: "1.25rem" }}>{icon}</span>
    <div>
      <div className="text-xs mb-0.5" style={{ color: "#6b7280" }}>{label}</div>
      <div className="text-xl font-bold tabular-nums" style={{ color, fontFamily: "monospace" }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────
// APP PRINCIPAL
// ─────────────────────────────────────────────

export default function TextFixer() {
  // Estado de archivo
  const [textoOriginal, setTextoOriginal] = useState("");
  const [nombreArchivo, setNombreArchivo] = useState(null);
  const [dragging, setDragging] = useState(false);

  // Estado de búsqueda
  const [buscar, setBuscar] = useState("");
  const [reemplazar, setReemplazar] = useState("");
  const [ignorarCase, setIgnorarCase] = useState(true);
  const [modoLinea, setModoLinea] = useState(true); // false = todos, true = línea por línea
  const [analizado, setAnalizado] = useState(false);

  // Cambios
  const [cambios, dispatch] = useReducer(cambiosReducer, []);
  const [navIdx, setNavIdx] = useState(0); // índice actual en modo línea por línea

  // Refs para scroll sincronizado
  const scrollLeftRef = useRef(null);
  const scrollRightRef = useRef(null);
  const syncingRef = useRef(false);

  const fileInputRef = useRef(null);

  // ── Scroll sincronizado ──
  const handleScrollLeft = useCallback(() => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (scrollRightRef.current) {
      scrollRightRef.current.scrollTop = scrollLeftRef.current.scrollTop;
      scrollRightRef.current.scrollLeft = scrollLeftRef.current.scrollLeft;
    }
    syncingRef.current = false;
  }, []);

  const handleScrollRight = useCallback(() => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (scrollLeftRef.current) {
      scrollLeftRef.current.scrollTop = scrollRightRef.current.scrollTop;
      scrollLeftRef.current.scrollLeft = scrollRightRef.current.scrollLeft;
    }
    syncingRef.current = false;
  }, []);

  // ── Carga de archivo ──
  const cargarArchivo = useCallback((file) => {
    if (!file || !file.name.endsWith(".txt")) {
      alert("Por favor selecciona un archivo .txt");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setTextoOriginal(e.target.result);
      setNombreArchivo(file.name);
      dispatch({ type: "CLEAR" });
      setAnalizado(false);
      setNavIdx(0);
    };
    reader.readAsText(file, "utf-8");
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files[0]) cargarArchivo(e.target.files[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files[0]) cargarArchivo(e.dataTransfer.files[0]);
  };

  // ── Análisis ──
  const handleAnalizar = useCallback(() => {
    if (!textoOriginal || !buscar) return;
    const nuevos = generarCambios(textoOriginal, buscar, reemplazar, ignorarCase);
    dispatch({ type: "SET", cambios: nuevos });
    setAnalizado(true);
    setNavIdx(0);
  }, [textoOriginal, buscar, reemplazar, ignorarCase]);

  const handleReemplazarTodos = useCallback(() => {
    handleAnalizar();
    // Luego de analizar aplicamos todos
    setTimeout(() => dispatch({ type: "APLICAR_TODOS" }), 0);
  }, [handleAnalizar]);

  // ── Estadísticas ──
  const stats = useMemo(() => {
    const lineas = textoOriginal ? textoOriginal.split("\n").length : 0;
    const total = cambios.length;
    const aplicados = cambios.filter((c) => c.aplicar).length;
    const ignorados = total - aplicados;
    const porcentaje = lineas > 0 ? ((aplicados / lineas) * 100).toFixed(1) : "0.0";
    return { lineas, total, aplicados, ignorados, porcentaje };
  }, [textoOriginal, cambios]);

  // ── Vista previa ──
  const lineasOriginales = useMemo(() => textoOriginal.split("\n"), [textoOriginal]);

  const lineasModificadas = useMemo(() => {
    if (!analizado || cambios.length === 0) return lineasOriginales;
    return aplicarCambios(textoOriginal, cambios).split("\n");
  }, [textoOriginal, lineasOriginales, cambios, analizado]);

  const cambiosPorLinea = useMemo(() => {
    const map = {};
    cambios.forEach((c) => { map[c.linea] = c; });
    return map;
  }, [cambios]);

  // ── Navegación línea por línea ──
  const cambioActual = cambios[navIdx] ?? null;

  const irAnterior = () => setNavIdx((i) => Math.max(0, i - 1));
  const irSiguiente = () => setNavIdx((i) => Math.min(cambios.length - 1, i + 1));

  const aplicarActual = () => {
  if (!cambioActual) return;

  dispatch({
    type: "APLICAR_UNO",
    id: cambioActual.id,
  });

  setNavIdx((i) =>
    Math.min(i + 1, cambios.length - 1)
  );
};
  const ignorarActual = () => {
  if (!cambioActual) return;

  dispatch({
    type: "IGNORAR_UNO",
    id: cambioActual.id,
  });

  setNavIdx((i) =>
    Math.min(i + 1, cambios.length - 1)
  );
};

  // ── Scroll al cambio actual en nav ──
  useEffect(() => {
    if (cambioActual && scrollLeftRef.current) {
      const lineHeight = 24;
      const top = cambioActual.linea * lineHeight;
      scrollLeftRef.current.scrollTop = Math.max(0, top - 120);
    }
  }, [navIdx, cambioActual]);

  // ── Guardar ──
  const handleGuardar = () => {
    if (!textoOriginal) return;
    const resultado = aplicarCambios(textoOriginal, cambios);
    const blob = new Blob([resultado], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo ? `modificado_${nombreArchivo}` : "resultado.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render líneas ──
  const renderLineas = (lineas, esVistaDerecha) => {
    return lineas.map((linea, idx) => {
      const cambio = cambiosPorLinea[idx];
      const esModificada = esVistaDerecha && !!cambio;
      const partes = analizado && buscar
        ? esVistaDerecha && cambio
          ? resaltarTexto(lineas[idx], reemplazar, ignorarCase, true, reemplazar)
          : resaltarTexto(lineas[idx], buscar, ignorarCase, false)
        : [{ texto: linea, tipo: "normal" }];

      return (
        <LineaViewer
  key={idx}
  numero={idx}
  texto={linea}
  partes={partes}
  esModificada={esModificada}
  aplicada={cambio?.aplicar ?? false}
  esActiva={
    modoLinea &&
    cambioActual &&
    cambioActual.linea === idx
  }
  onAplicar={() => dispatch({ type: "APLICAR_UNO", id: cambio?.id })}
  onIgnorar={() => dispatch({ type: "IGNORAR_UNO", id: cambio?.id })}
/>
      );
    });
  };

  // ── Estilos base ──
  const panelStyle = { background: "#171a21", border: "1px solid #2a2f3a" };
  const viewerStyle = { background: "#0b0d12", border: "1px solid #2a2f3a" };
  const inputStyle = {
    background: "#0f1115",
    border: "1px solid #2a2f3a",
    color: "#d6d6d6",
    borderRadius: "6px",
    padding: "6px 10px",
    fontSize: "13px",
    outline: "none",
    width: "100%",
  };

  return (
  <div
    style={{
      background: "#0f1115",
      height: "100vh",
      overflow: "hidden",
      color: "#d6d6d6",
      fontFamily: "system-ui, sans-serif",
      display: "flex",
      flexDirection: "column",
    }}
  >
      {/* ── HEADER ── */}
      <header
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ background: "#171a21", borderBottom: "1px solid #2a2f3a" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{ background: "#ff9800", color: "#000" }}
          >
            TF
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm" style={{ color: "#d6d6d6" }}>TextFixer</span>
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: "#2a2f3a", color: "#9ca3af", fontSize: "10px" }}
              >
                v1.0
              </span>
            </div>
            <div className="text-xs" style={{ color: "#6b7280" }}>
              Comparar • Buscar • Reemplazar
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors"
            style={{ background: "#2a2f3a", border: "1px solid #3a3f4a", color: "#d6d6d6" }}
          >
            📂 Abrir archivo
          </button>
          <button
            onClick={handleGuardar}
            disabled={!textoOriginal}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-opacity"
            style={{
              background: textoOriginal ? "#7c3aed" : "#2a2f3a",
              color: "#fff",
              opacity: textoOriginal ? 1 : 0.5,
              cursor: textoOriginal ? "pointer" : "not-allowed",
            }}
          >
            💾 Guardar cambios
          </button>
        </div>
      </header>

      {/* ── PANEL DE CONTROL ── */}
      <div
        className="px-4 py-3 shrink-0"
        style={{ background: "#171a21", borderBottom: "1px solid #2a2f3a" }}
      >
        <div className="flex items-start gap-4 flex-wrap">

          {/* Upload zona */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors shrink-0"
            style={{
              ...panelStyle,
              width: "180px",
              minHeight: "72px",
              border: dragging ? "1px solid #ff9800" : "1px dashed #2a2f3a",
              padding: "10px",
            }}
          >
            <span style={{ fontSize: "1.3rem" }}>☁️</span>
            <span className="text-xs text-center mt-1" style={{ color: "#6b7280" }}>
              {nombreArchivo ? (
                <span style={{ color: "#00c853" }}>✓ {nombreArchivo}</span>
              ) : (
                <>Arrastra tu archivo .txt<br />o haz clic para seleccionar</>
              )}
            </span>
          </div>
          <input ref={fileInputRef} type="file" accept=".txt" className="hidden" onChange={handleFileChange} />

          {/* Buscar */}
          <div className="flex-1 min-w-40">
            <label className="text-xs mb-1 block" style={{ color: "#6b7280" }}>Buscar</label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: "#ff9800", fontSize: "10px" }}>●</span>
              <input
                style={{ ...inputStyle, paddingLeft: "22px" }}
                value={buscar}
                onChange={(e) => { setBuscar(e.target.value); setAnalizado(false); }}
                placeholder="texto a buscar..."
              />
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: "#9ca3af" }}>
                <input
                  type="checkbox"
                  checked={ignorarCase}
                  onChange={(e) => setIgnorarCase(e.target.checked)}
                  className="w-3 h-3"
                />
                Ignorar mayúsculas/minúsculas
              </label>
            </div>
          </div>

          {/* Reemplazar */}
          <div className="flex-1 min-w-40">
            <label className="text-xs mb-1 block" style={{ color: "#6b7280" }}>Reemplazar con</label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: "#00c853", fontSize: "10px" }}>●</span>
              <input
                style={{ ...inputStyle, paddingLeft: "22px" }}
                value={reemplazar}
                onChange={(e) => { setReemplazar(e.target.value); setAnalizado(false); }}
                placeholder="texto de reemplazo..."
              />
            </div>
          </div>

          {/* Modo */}
          <div className="shrink-0">
            <label className="text-xs mb-1 block" style={{ color: "#6b7280" }}>Modo de reemplazo</label>
            <div
              className="rounded-md p-2 text-xs flex flex-col gap-1"
              style={{ background: "#0f1115", border: "1px solid #2a2f3a" }}
            >
              <label className="flex items-center gap-2 cursor-pointer" style={{ color: "#d6d6d6" }}>
                <input
                  type="radio"
                  name="modo"
                  checked={!modoLinea}
                  onChange={() => setModoLinea(false)}
                  className="w-3 h-3"
                  style={{ accentColor: "#7c3aed" }}
                />
                Reemplazar todos
              </label>
              <label className="flex items-center gap-2 cursor-pointer" style={{ color: "#d6d6d6" }}>
                <input
                  type="radio"
                  name="modo"
                  checked={modoLinea}
                  onChange={() => setModoLinea(true)}
                  className="w-3 h-3"
                  style={{ accentColor: "#7c3aed" }}
                />
                Línea por línea
              </label>
              <div className="text-xs mt-0.5" style={{ color: "#4a5568" }}>
                Revisa y decide qué cambios aplicar.
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex flex-col gap-2 shrink-0">
            <label className="text-xs" style={{ color: "#6b7280" }}>Acciones rápidas</label>
            <button
              onClick={handleAnalizar}
              disabled={!textoOriginal || !buscar}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-opacity"
              style={{
                background: "#7c3aed",
                color: "#fff",
                opacity: textoOriginal && buscar ? 1 : 0.4,
                cursor: textoOriginal && buscar ? "pointer" : "not-allowed",
              }}
            >
              🔍 Analizar cambios
            </button>
            <button
              onClick={handleReemplazarTodos}
              disabled={!textoOriginal || !buscar}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-opacity"
              style={{
                background: "#2a2f3a",
                color: "#d6d6d6",
                border: "1px solid #3a3f4a",
                opacity: textoOriginal && buscar ? 1 : 0.4,
                cursor: textoOriginal && buscar ? "pointer" : "not-allowed",
              }}
            >
              🔄 Reemplazar todos
            </button>
          </div>
        </div>
      </div>

      {/* ── VIEWERS ── */}
      <div
  className="flex flex-1 gap-0 overflow-hidden"
  style={{
    minHeight: 0,
    maxHeight: "100%",
  }}
>

        {/* Viewer izquierdo - Original */}
        <div className="flex flex-col flex-1" style={{ minWidth: 0 }}>
          <div
            className="flex items-center justify-between px-3 py-2 shrink-0"
            style={{ background: "#171a21", borderBottom: "1px solid #2a2f3a", borderRight: "1px solid #2a2f3a" }}
          >
            <div className="flex items-center gap-2">
              <span style={{ color: "#ff9800", fontSize: "10px" }}>●</span>
              <span className="text-sm font-medium" style={{ color: "#d6d6d6" }}>Archivo original</span>
            </div>
            {analizado && cambios.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#ff980022", color: "#ff9800", border: "1px solid #ff980044" }}>
                {cambios.length} coincidencias
              </span>
            )}
          </div>
          <div
  ref={scrollLeftRef}
  onScroll={handleScrollLeft}
  className="flex-1 overflow-auto"
  style={{
    ...viewerStyle,
    borderRight: "1px solid #2a2f3a",
    height: "100%",
    maxHeight: "100%",
    overscrollBehavior: "contain",
  }}
>
            {textoOriginal ? (
              <div style={{ minWidth: "max-content" }}>
                {renderLineas(lineasOriginales, false)}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full" style={{ color: "#4a5568" }}>
                <span className="text-sm">Carga un archivo .txt para comenzar</span>
              </div>
            )}
          </div>
        </div>

        {/* Viewer derecho - Modificado */}
        <div className="flex flex-col flex-1" style={{ minWidth: 0 }}>
          <div
            className="flex items-center justify-between px-3 py-2 shrink-0"
            style={{ background: "#171a21", borderBottom: "1px solid #2a2f3a" }}
          >
            <div className="flex items-center gap-2">
              <span style={{ color: "#00c853", fontSize: "10px" }}>●</span>
              <span className="text-sm font-medium" style={{ color: "#d6d6d6" }}>Archivo modificado (vista previa)</span>
            </div>
            {analizado && cambios.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#00c85322", color: "#00c853", border: "1px solid #00c85344" }}>
                {stats.aplicados} cambios detectados
              </span>
            )}
          </div>
          <div
  ref={scrollRightRef}
  onScroll={handleScrollRight}
  className="flex-1 overflow-auto"
  style={{
    ...viewerStyle,
    height: "100%",
    maxHeight: "100%",
    overscrollBehavior: "contain",
  }}
>
            {textoOriginal ? (
              <div style={{ minWidth: "max-content" }}>
                {renderLineas(lineasModificadas, true)}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full" style={{ color: "#4a5568" }}>
                <span className="text-sm">La vista previa aparecerá aquí</span>
              </div>
            )}
          </div>
          {/* Navegación línea por línea */}
          {modoLinea && analizado && cambios.length > 0 && (
            <div
              className="flex items-center justify-between px-3 py-2 shrink-0"
              style={{ background: "#171a21", borderTop: "1px solid #2a2f3a" }}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={irAnterior}
                  disabled={navIdx === 0}
                  className="px-3 py-1 rounded text-sm flex items-center gap-1 transition-opacity"
                  style={{ background: "#2a2f3a", color: "#d6d6d6", opacity: navIdx === 0 ? 0.4 : 1 }}
                >
                  ← Anterior
                </button>
                <span className="text-xs" style={{ color: "#6b7280" }}>
                  {navIdx + 1} de {cambios.length}
                </span>
                <button
                  onClick={irSiguiente}
                  disabled={navIdx >= cambios.length - 1}
                  className="px-3 py-1 rounded text-sm flex items-center gap-1 transition-opacity"
                  style={{ background: "#2a2f3a", color: "#d6d6d6", opacity: navIdx >= cambios.length - 1 ? 0.4 : 1 }}
                >
                  Siguiente →
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={aplicarActual}
                  className="px-3 py-1 rounded text-sm flex items-center gap-1"
                  style={{ background: "#00c85322", color: "#00c853", border: "1px solid #00c85344" }}
                >
                  ✓ Aplicar cambio
                </button>
                <button
                  onClick={ignorarActual}
                  className="px-3 py-1 rounded text-sm flex items-center gap-1"
                  style={{ background: "#ef444422", color: "#ef4444", border: "1px solid #ef444444" }}
                >
                  ✕ Ignorar cambio
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── STATS ── */}
      <div
        className="flex gap-3 px-4 py-3 shrink-0"
        style={{ borderTop: "1px solid #2a2f3a", background: "#0f1115" }}
      >
        <StatCard icon="📄" label="Líneas totales" value={stats.lineas} color="#d6d6d6" />
        <StatCard icon="🔍" label="Coincidencias encontradas" value={stats.total} color="#ff9800" />
        <StatCard icon="✅" label="Cambios aplicados" value={stats.aplicados} color="#00c853" />
        <StatCard icon="🚫" label="Cambios ignorados" value={stats.ignorados} color="#ef4444" />
        <StatCard icon="%" label="Porcentaje modificado" value={`${stats.porcentaje}%`} color="#7c3aed" />
      </div>
    </div>
  );
}
