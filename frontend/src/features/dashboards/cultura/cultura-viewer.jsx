import { CulturaStatCard as StatCard } from "./cultura-stat-card";
import React, { useState, useMemo, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  ChevronRight, ChevronDown, UploadCloud, RotateCcw, Info, FileSpreadsheet,
} from "lucide-react";

export function createCulturaDashboard(dataset) {


// ---------------------------------------------------------------------------
// Design tokens (mesma identidade do Portal Financeiro)
// ---------------------------------------------------------------------------
const NAVY = "#0f172a";
const RED = "#0f6fe8";
const CREAM = "#f5f7fb";
const CARD = "#ffffff";
const LINE = "#d8e0e9";
const INK = "#0f172a";
const MUTED = "#64748b";
const POS = "#1B6B3C";
const NEG = "#B3273E";
const SERIF = "Sora, sans-serif";
const MONO = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const SANS = "Manrope, sans-serif";

// ---------------------------------------------------------------------------
// Estrutura fixa do DRE
// ---------------------------------------------------------------------------
const ORDERED_LINES = dataset.ORDERED_LINES;
const LINE_LABELS = dataset.LINE_LABELS;
const BOLD_LINES = new Set(["03", "06", "10", "15"]);
const ACCENT_LINES = new Set(["10", "15"]);
const lineKey = (dreFull) => (dreFull || "").split("-")[0];

// ---------------------------------------------------------------------------
// Dataset embutido (export real: Ano 2025 · 1º Semestre · Filial Todos)
// Colunas de origem: DRE, plan_contas_joined ("Classificação - Descrição"), Descricao (Filial), VALOR CONTÁBIL
// ---------------------------------------------------------------------------
const DRE_L = dataset.DRE_L;
const CLASSIF_L = dataset.CLASSIF_L;
const CONTA_L = dataset.CONTA_L;
const FILIAL_L = dataset.FILIAL_L;
const DATA_L = dataset.DATA_L;
const EMBEDDED_ROWS = dataset.EMBEDDED_ROWS;
const EMBEDDED_DATA = EMBEDDED_ROWS.map(function(r){return {dre:DRE_L[r[0]],classif:CLASSIF_L[r[1]],conta:CONTA_L[r[2]],filial:FILIAL_L[r[3]],data:DATA_L[r[4]],valor:r[5]};});
const EMBEDDED_META = dataset.EMBEDDED_META;

// Tabela oficial de filiais (Filiais.csv) — Descrição completa + Grupo Filial por código abreviado
// BURITIS, CASTELO, SION, SHOPPING FALLS não constam nesta tabela oficial (mesmo padrão das holdings já removidas)
const FILIAL_META = dataset.FILIAL_META;
const GRUPO_FILIAL_OPTIONS = dataset.GRUPO_FILIAL_OPTIONS;

// ---------------------------------------------------------------------------
// Dados de alunos por filial/mês (base do rateio proporcional)
// ---------------------------------------------------------------------------
const ALUNOS_FILIAL_L = dataset.ALUNOS_FILIAL_L;
const ALUNOS_FORIG_L = dataset.ALUNOS_FORIG_L;
const ALUNOS_DATA_L = dataset.ALUNOS_DATA_L;
const ALUNOS_ROWS = dataset.ALUNOS_ROWS;
const ALUNOS_DATA = ALUNOS_ROWS.map(function(r){return {data:ALUNOS_DATA_L[r[0]],filial:ALUNOS_FILIAL_L[r[1]],filialOriginal:ALUNOS_FORIG_L[r[2]],alunos:r[3],turmas:r[4]};});

const SGC_FILIAL_L = dataset.SGC_FILIAL_L;
const SGC_CLASSIF_L = dataset.SGC_CLASSIF_L;
const SGC_CONTA_L = dataset.SGC_CONTA_L;
const SGC_DATA_L = dataset.SGC_DATA_L;
const SGC_ROWS = dataset.SGC_ROWS;
const SGC_DATA = SGC_ROWS.map(function(r){return {data:SGC_DATA_L[r[0]],filial:SGC_FILIAL_L[r[1]],classif:SGC_CLASSIF_L[r[2]],conta:SGC_CONTA_L[r[3]],valor:r[4]};});

const CURSOS_FILIAL_L = dataset.CURSOS_FILIAL_L;
const CURSOS_DATA_L = dataset.CURSOS_DATA_L;
const CURSOS_FM_ROWS = dataset.CURSOS_FM_ROWS;
const CURSOS_POR_FM = CURSOS_FM_ROWS.map(function(r){return {data:CURSOS_DATA_L[r[0]],filial:CURSOS_FILIAL_L[r[1]],turmas:r[2],cursos:r[3],matriculasArquivo:r[4],novato:r[5],rematriculado:r[6],recuperado:r[7]};});
const CURSOS_RANKING = dataset.CURSOS_RANKING;
const TURMAS_RANKING = dataset.TURMAS_RANKING;
const TURMAS_FILIAL_L = dataset.TURMAS_FILIAL_L;
const TURMAS_CURSO_L = dataset.TURMAS_CURSO_L;
const TURMAS_SEM_L = dataset.TURMAS_SEM_L;
const TURMAS_ROWS = dataset.TURMAS_ROWS;
const TURMAS_COMPLETO = TURMAS_ROWS.map(function(r){return {token:r[0],filial:TURMAS_FILIAL_L[r[1]],curso:TURMAS_CURSO_L[r[2]],alunos:r[3],semestre:TURMAS_SEM_L[r[4]]};});
const CURSOS_POR_FILIAL_ANO = dataset.CURSOS_POR_FILIAL_ANO;
const CURSOS_REDE_POR_MES = dataset.CURSOS_REDE_POR_MES;
const CURSOS_REDE_ANO = dataset.CURSOS_REDE_ANO;


// ---------------------------------------------------------------------------
// Regras de rateio (motor por número de alunos + pools especiais)
// Estas listas ficam editáveis na aba "Regras de Rateio"
// ---------------------------------------------------------------------------
const DEFAULT_RATEIO_RULES = {
  // Filiais que têm % de alunos (participam do rateio proporcional normal).
  // Quem NÃO estiver aqui (ex.: MATRIZ) tem seu valor 100% redistribuído.
  // Filiais elegíveis a RECEBER rateio: qualquer filial que tenha dado de aluno no
  // arquivo carregado — inclui a BV (que tem alunos, mesmo classificada como
  // Corporativo/Matriz pra outros fins). Baseado no Grupo Filial ficava errado,
  // porque excluía a BV mesmo quando ela não é contribuinte da regra em questão.
  filiaisComPercentual: Array.from(new Set(ALUNOS_DATA.map((a) => a.filial))),
};

const filialGrupo = (f) => (FILIAL_META[f] ? FILIAL_META[f].grupo : "Não identificado");
const filialLabel = (f) => (FILIAL_META[f] ? FILIAL_META[f].descricao : f);

// lookup classificação -> nome da conta, montado a partir do próprio balancete carregado
const CONTA_POR_CLASSIF = {};
for (const r of EMBEDDED_DATA) {
  if (r.classif && r.conta && !CONTA_POR_CLASSIF[r.classif]) CONTA_POR_CLASSIF[r.classif] = r.conta;
}
const classifLabel = (c) => (CONTA_POR_CLASSIF[c] ? `${c} — ${CONTA_POR_CLASSIF[c]}` : c);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtBRL(n) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n || 0);
  return `${sign}R$ ${abs.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function monthSortKey(label) {
  const m = String(label).match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return parseInt(m[2], 10) * 100 + parseInt(m[1], 10);
  return null;
}

// extrai o número do mês (1-12) de um rótulo "MM/AAAA"; retorna null se não bater o formato
function monthNumber(label) {
  const m = String(label).match(/^(\d{1,2})\/(\d{4})$/);
  return m ? parseInt(m[1], 10) : null;
}

// "Todos" | "1º Semestre" | "2º Semestre" a partir do rótulo "MM/AAAA"
function semestreOf(label) {
  const mn = monthNumber(label);
  if (mn === null) return null;
  return mn <= 6 ? "1º Semestre" : "2º Semestre";
}

function parseBRLCell(v) {
  if (typeof v === "number") return v;
  let s = String(v ?? "").trim();
  if (!s) return 0;
  const neg = s.startsWith("-");
  s = s.replace(/^-?\s*R\$\s*/i, "");
  const hasComma = s.includes(","), hasDot = s.includes(".");
  if (hasComma && hasDot) s = s.replace(/\./g, "").replace(",", ".");
  else if (hasComma) s = s.replace(",", ".");
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return neg ? -Math.abs(n) : n;
}

function readWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    if (/\.csv$/i.test(file.name)) {
      reader.onload = (e) => {
        try { resolve(XLSX.read(e.target.result, { type: "string" })); }
        catch (err) { reject(err); }
      };
      reader.readAsText(file, "utf-8");
    } else {
      reader.onload = (e) => {
        try { resolve(XLSX.read(e.target.result, { type: "array", cellDates: true })); }
        catch (err) { reject(err); }
      };
      reader.readAsArrayBuffer(file);
    }
  });
}

function parseUploadedDre(wb) {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
  if (rows.length === 0) throw new Error("Planilha vazia.");
  const cols = Object.keys(rows[0]);
  const findCol = (...cands) => cols.find((c) => cands.some((x) => c.toLowerCase().trim() === x));
  const cDre = findCol("dre");
  const cJoined = findCol("plan_contas_joined", "conta");
  const cClassif = findCol("classificacao", "classificação");
  const cConta = findCol("conta", "descricao conta", "descrição conta");
  const cFilial = findCol("descricao", "descrição", "filial");
  const cValor = findCol("valor contábil", "valor contabil", "valor");
  const cData = findCol("data", "mes", "mês");
  if (!cDre || !cValor || (!cJoined && !cConta)) {
    throw new Error("Não encontrei as colunas esperadas (DRE, plan_contas_joined/Conta, Descricao/Filial, VALOR CONTÁBIL).");
  }
  const out = [];
  for (const r of rows) {
    const dre = String(r[cDre] ?? "").trim();
    if (!dre) continue;
    let classif = "", conta = "";
    if (cJoined && String(r[cJoined] ?? "").includes(" - ")) {
      const [a, ...b] = String(r[cJoined]).split(" - ");
      classif = a.trim(); conta = b.join(" - ").trim();
    } else {
      classif = cClassif ? String(r[cClassif] ?? "").trim() : "";
      conta = cConta ? String(r[cConta] ?? "").trim() : "";
    }
    const filial = cFilial ? String(r[cFilial] ?? "").trim() : "";
    const valor = parseBRLCell(r[cValor]);
    const data = cData ? String(r[cData] ?? "").trim() : "";
    out.push({ dre, classif, conta, filial, valor, data });
  }
  return out;
}

// ---------------------------------------------------------------------------
// UI primitives
// ---------------------------------------------------------------------------
function Select({ value, onChange, options, disabled, title }) {
  return (
    <select
      value={value}
      disabled={disabled}
      title={title}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: "8px 10px", borderRadius: 6, border: `1px solid ${LINE}`,
        fontFamily: SANS, fontSize: 13, color: disabled ? MUTED : INK,
        background: disabled ? "#F4F3EF" : "#fff", minWidth: 140,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function FilterLabel({ children }) {
  return (
    <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 0.4, textTransform: "uppercase", marginRight: 6 }}>
      {children}
    </span>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 10, padding: 22, ...style }}>
      {children}
    </div>
  );
}

function Button({ children, onClick, variant = "primary", style }) {
  const variants = {
    primary: { background: NAVY, color: "#fff" },
    accent: { background: RED, color: "#fff" },
    ghost: { background: "transparent", color: NAVY, border: `1px solid ${LINE}` },
  };
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 18px", borderRadius: 7, fontFamily: SANS, fontSize: 14, fontWeight: 600,
        cursor: "pointer", border: "1px solid transparent", ...variants[variant], ...style,
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
function DreView({ title }) {
  const [rawData, setRawData] = useState(EMBEDDED_DATA);
  const [meta, setMeta] = useState(EMBEDDED_META);
  const [filial, setFilial] = useState("Todos");
  const [grupoFilial, setGrupoFilial] = useState("Todos");
  const [semestre, setSemestre] = useState("Todos");
  const [mes, setMes] = useState("Todos");
  const [expandedLines, setExpandedLines] = useState(new Set());
  const [expandedContas, setExpandedContas] = useState(new Set());
  const [uploadError, setUploadError] = useState(null);
  const [uploadInfo, setUploadInfo] = useState(null);
  const inputRef = useRef(null);

  const hasDataDim = useMemo(() => rawData.some((r) => r.data), [rawData]);
  const filiais = useMemo(() => {
    const s = new Set(rawData.map((r) => r.filial).filter(Boolean));
    return Array.from(s).sort();
  }, [rawData]);
  const meses = useMemo(() => {
    if (!hasDataDim) return [];
    const s = new Set(rawData.map((r) => r.data).filter(Boolean));
    return Array.from(s)
      .filter((d) => semestre === "Todos" || semestreOf(d) === semestre)
      .sort((a, b) => {
        const ka = monthSortKey(a), kb = monthSortKey(b);
        if (typeof ka === "number" && typeof kb === "number") return ka - kb;
        return String(a).localeCompare(String(b));
      });
  }, [rawData, hasDataDim, semestre]);

  const filtered = useMemo(() => {
    return rawData.filter((r) => {
      if (filial !== "Todos" && r.filial !== filial) return false;
      if (grupoFilial !== "Todos" && filialGrupo(r.filial) !== grupoFilial) return false;
      if (hasDataDim && semestre !== "Todos" && semestreOf(r.data) !== semestre) return false;
      if (hasDataDim && mes !== "Todos" && r.data !== mes) return false;
      return true;
    });
  }, [rawData, filial, grupoFilial, semestre, mes, hasDataDim]);

  // total por linha DRE
  const lineTotals = useMemo(() => {
    const t = {};
    for (const r of filtered) {
      const k = lineKey(r.dre);
      // linhas totalizadoras (03/06/10/15) são sempre calculadas por fórmula,
      // nunca somadas direto do dado bruto (mesmo que existam linhas com esse rótulo)
      if (BOLD_LINES.has(k)) continue;
      t[k] = (t[k] || 0) + r.valor;
    }
    // 03 = 01 - 02 · 06 = 03 - 04 · 10 = 06 - 08 - 09 · 15 = 10 + 11
    // (02/04/08/09 já são guardados com sinal negativo, então soma = subtração da magnitude)
    const l01 = t["01"] || 0;
    const l02 = t["02"] || 0;
    const l04 = t["04"] || 0;
    const l08 = t["08"] || 0;
    const l09 = t["09"] || 0;
    const l11 = t["11"] || 0;
    t["03"] = l01 + l02;
    t["06"] = t["03"] + l04;
    t["10"] = t["06"] + l08 + l09;
    t["15"] = t["10"] + l11;
    return t;
  }, [filtered]);

  // contas agrupadas por linha (exclui linhas totalizadoras, que não têm classif/conta)
  const contasByLine = useMemo(() => {
    const map = {};
    for (const r of filtered) {
      if (!r.conta) continue;
      const k = lineKey(r.dre);
      const ck = `${r.classif}||${r.conta}`;
      if (!map[k]) map[k] = {};
      if (!map[k][ck]) map[k][ck] = { classif: r.classif, conta: r.conta, valor: 0, porFilial: {} };
      map[k][ck].valor += r.valor;
      map[k][ck].porFilial[r.filial] = (map[k][ck].porFilial[r.filial] || 0) + r.valor;
    }
    const out = {};
    for (const k in map) {
      out[k] = Object.values(map[k]).sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
    }
    return out;
  }, [filtered]);

  const toggleLine = (k) => {
    setExpandedLines((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  };
  const toggleConta = (key) => {
    setExpandedContas((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };

  const handleUpload = useCallback(async (file) => {
    setUploadError(null);
    setUploadInfo(null);
    try {
      const wb = await readWorkbook(file);
      const parsed = parseUploadedDre(wb);
      if (parsed.length === 0) throw new Error("Nenhuma linha reconhecida no arquivo.");
      setRawData(parsed);
      setMeta({ ano: "—", mes: "—", origem: file.name });
      setFilial("Todos");
      setGrupoFilial("Todos");
      setMes("Todos");
      setExpandedLines(new Set());
      setExpandedContas(new Set());
      setUploadInfo(`${parsed.length} linhas carregadas de "${file.name}"`);
    } catch (e) {
      setUploadError(e.message || "Não foi possível ler o arquivo.");
    }
  }, []);

  const resetToEmbedded = () => {
    setRawData(EMBEDDED_DATA);
    setMeta(EMBEDDED_META);
    setFilial("Todos"); setGrupoFilial("Todos"); setMes("Todos");
    setExpandedLines(new Set()); setExpandedContas(new Set());
    setUploadError(null); setUploadInfo(null);
  };

  const filiaisVisiveis = grupoFilial === "Todos" ? filiais : filiais.filter((f) => filialGrupo(f) === grupoFilial);
  const filialOptions = [{ value: "Todos", label: "Todos" }, ...filiaisVisiveis.map((f) => ({ value: f, label: filialLabel(f) }))];
  const grupoFilialPresentes = Array.from(new Set(filiais.map(filialGrupo)));
  const grupoFilialOptions = [{ value: "Todos", label: "Todos" }, ...GRUPO_FILIAL_OPTIONS.filter((g) => grupoFilialPresentes.includes(g)).map((g) => ({ value: g, label: g }))];
  const mesOptions = hasDataDim
    ? [{ value: "Todos", label: "Todos" }, ...meses.map((m) => ({ value: m, label: m }))]
    : [{ value: "Todos", label: meta.mes || "Todos" }];
  const semestreOptions = [{ value: "Todos", label: "Todos" }, { value: "1º Semestre", label: "1º Semestre" }, { value: "2º Semestre", label: "2º Semestre" }];

  return (
    <div style={{ minHeight: "100%", background: CREAM, fontFamily: SANS, color: INK }}>
      <div style={{ height: 6, background: `linear-gradient(90deg, ${NAVY} 0%, ${NAVY} 60%, ${RED} 100%)` }} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px 60px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: 1.6, color: RED, textTransform: "uppercase" }}>
              Portal Financeiro
            </div>
            <h1 style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 400, color: NAVY, margin: "4px 0 0" }}>
              {title}
            </h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
            />
            <button
              onClick={() => inputRef.current?.click()}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 7, border: `1px solid ${LINE}`, background: "#fff", color: NAVY, fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              <UploadCloud size={15} /> Carregar novo período
            </button>
            {meta.origem !== EMBEDDED_META.origem && (
              <button
                onClick={resetToEmbedded}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 7, border: `1px solid ${LINE}`, background: "transparent", color: MUTED, fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                <RotateCcw size={15} /> Restaurar exemplo
              </button>
            )}
          </div>
        </div>

        {uploadError && (
          <div style={{ display: "flex", gap: 8, background: "#FBEAEC", border: "1px solid #E7495F", borderRadius: 8, padding: "10px 12px", marginBottom: 16, fontFamily: SANS, fontSize: 13, color: "#7A1526" }}>
            <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} /> {uploadError}
          </div>
        )}
        {uploadInfo && (
          <div style={{ display: "flex", gap: 8, background: "#E7F4EC", border: "1px solid #9FD3B4", borderRadius: 8, padding: "10px 12px", marginBottom: 16, fontFamily: SANS, fontSize: 13, color: "#1B5E3A" }}>
            <FileSpreadsheet size={16} style={{ flexShrink: 0, marginTop: 1 }} /> {uploadInfo}
          </div>
        )}

        {/* Filtros */}
        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", background: CARD, border: `1px solid ${LINE}`, borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
          <div>
            <FilterLabel>Ano</FilterLabel>
            <Select value={meta.ano} onChange={() => {}} options={[{ value: meta.ano, label: meta.ano }]} disabled title="Disponível quando o arquivo tiver mais de um ano" />
          </div>
          <div>
            <FilterLabel>Semestre</FilterLabel>
            <Select value={semestre} onChange={(v) => { setSemestre(v); setMes("Todos"); }} options={semestreOptions} disabled={!hasDataDim} />
          </div>
          <div>
            <FilterLabel>Mês</FilterLabel>
            <Select value={mes} onChange={setMes} options={mesOptions} disabled={!hasDataDim} title={!hasDataDim ? "Este arquivo não tem coluna de Data/Mês — carregue um export mensal para habilitar" : undefined} />
          </div>
          <div>
            <FilterLabel>Grupo Filial</FilterLabel>
            <Select
              value={grupoFilial}
              onChange={(v) => { setGrupoFilial(v); setFilial("Todos"); }}
              options={grupoFilialOptions}
            />
          </div>
          <div>
            <FilterLabel>Filial</FilterLabel>
            <Select value={filial} onChange={setFilial} options={filialOptions} />
          </div>
          <div style={{ marginLeft: "auto", fontFamily: SANS, fontSize: 11, color: MUTED }}>
            Fonte: {meta.origem}
          </div>
        </div>

        {!hasDataDim && (
          <div style={{ display: "flex", gap: 8, background: "#FFF6DA", border: "1px solid #E9CD6E", borderRadius: 8, padding: "10px 12px", marginBottom: 16, fontFamily: SANS, fontSize: 12.5, color: "#5C4A00" }}>
            <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            Este arquivo traz apenas os totais de {meta.mes} / {meta.ano} — sem detalhe por conta ou por filial, então o clique para abrir cada linha não tem o que mostrar aqui. Para reativar o drill-down (e o filtro de Mês), carregue um export com as colunas Classificação/Conta, Filial e, se possível, Data.
          </div>
        )}

        {/* Tabela DRE */}
        <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "12px 16px", background: NAVY, color: "#fff", fontFamily: SANS, fontSize: 12, fontWeight: 700, letterSpacing: 0.3 }}>DRE</th>
                <th style={{ textAlign: "right", padding: "12px 16px", background: NAVY, color: "#fff", fontFamily: SANS, fontSize: 12, fontWeight: 700, letterSpacing: 0.3 }}>Valor Contábil</th>
              </tr>
            </thead>
            <tbody>
              {ORDERED_LINES.map((k) => {
                const val = lineTotals[k] || 0;
                const bold = BOLD_LINES.has(k);
                const accent = ACCENT_LINES.has(k);
                const contas = contasByLine[k] || [];
                const expanded = expandedLines.has(k);
                const rowBg = accent ? "#EEF1F6" : bold ? CREAM : "#fff";
                return (
                  <React.Fragment key={k}>
                    <tr
                      onClick={() => contas.length > 0 && toggleLine(k)}
                      style={{ background: rowBg, borderTop: `1px solid ${LINE}`, cursor: contas.length > 0 ? "pointer" : "default" }}
                    >
                      <td style={{ padding: "10px 16px", fontFamily: SANS, fontWeight: bold ? 700 : 500, color: NAVY }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {contas.length > 0 ? (
                            expanded ? <ChevronDown size={15} color={MUTED} /> : <ChevronRight size={15} color={MUTED} />
                          ) : (
                            <span style={{ width: 15, display: "inline-block" }} />
                          )}
                          {LINE_LABELS[k]}
                        </span>
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: MONO, fontSize: 13.5, fontWeight: bold ? 700 : 400, color: val < 0 ? NEG : val > 0 ? POS : MUTED }}>
                        {fmtBRL(val)}
                      </td>
                    </tr>
                    {expanded && contas.map((c) => {
                      const ckey = `${k}|${c.classif}|${c.conta}`;
                      const cExpanded = expandedContas.has(ckey);
                      const filiaisDaConta = Object.entries(c.porFilial).filter(([n, v]) => n && v !== 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
                      const canDrillFilial = filial === "Todos" && filiaisDaConta.length > 0;
                      return (
                        <React.Fragment key={ckey}>
                          <tr
                            onClick={() => canDrillFilial && toggleConta(ckey)}
                            style={{ borderTop: `1px solid ${LINE}`, cursor: canDrillFilial ? "pointer" : "default" }}
                          >
                            <td style={{ padding: "7px 16px 7px 40px", fontFamily: SANS, fontSize: 13, color: INK }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                {canDrillFilial ? (
                                  cExpanded ? <ChevronDown size={13} color={MUTED} /> : <ChevronRight size={13} color={MUTED} />
                                ) : (
                                  <span style={{ width: 13, display: "inline-block" }} />
                                )}
                                <span style={{ color: MUTED, fontFamily: MONO, fontSize: 11, marginRight: 4 }}>{c.classif}</span>
                                {c.conta}
                              </span>
                            </td>
                            <td style={{ padding: "7px 16px", textAlign: "right", fontFamily: MONO, fontSize: 13, color: c.valor < 0 ? NEG : c.valor > 0 ? POS : MUTED }}>
                              {fmtBRL(c.valor)}
                            </td>
                          </tr>
                          {cExpanded && filiaisDaConta.map(([fName, fVal]) => (
                            <tr key={fName} style={{ background: "#FCFBF9" }}>
                              <td style={{ padding: "5px 16px 5px 66px", fontFamily: SANS, fontSize: 12, color: MUTED }}>{fName}</td>
                              <td style={{ padding: "5px 16px", textAlign: "right", fontFamily: MONO, fontSize: 12, color: fVal < 0 ? NEG : fVal > 0 ? POS : MUTED }}>
                                {fmtBRL(fVal)}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ textAlign: "center", marginTop: 24, fontFamily: SANS, fontSize: 11, color: MUTED }}>
          CULTURA INGLESA · PORTAL FINANCEIRO — {title} (clique numa linha para abrir as contas; clique numa conta para ver por filial)
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Motor de rateio (proporcional por alunos + pools especiais)
// ---------------------------------------------------------------------------
function round2(n) { return Math.round(n * 100) / 100; }

function buildAlunosIndex(alunosData) {
  const byMonth = {};
  for (const a of alunosData) {
    if (!byMonth[a.data]) byMonth[a.data] = {};
    byMonth[a.data][a.filial] = a.alunos;
  }
  const totalByMonth = {};
  for (const data in byMonth) {
    // Total de Alunos = soma de TODAS as filiais com aluno cadastrado (inclusive BV),
    // mesmo que a BV não receba fatia — bate com a coluna "Total de Alunos" do Power BI
    totalByMonth[data] = Object.values(byMonth[data]).reduce((a, b) => a + b, 0);
  }
  return { byMonth, totalByMonth };
}

// Valor Matrizes a Ratear: soma do Balancete das filiais "Corporativo / Matriz" —
// independe do filtro de Filial (é a base fixa a ser dividida pelas próximas regras),
// mas respeita o filtro de Mês selecionado.
function computeMatrizesARatear(rawData, mes, filiaisPorLinha) {
  const porLinha = {};
  const porConta = {};
  const porLinhaMes = {}; // { dre: { data: valor } } — pool da linha inteira (usado no total da linha)
  const porClassifMes = {}; // { classif: { data: valor } } — pool só daquela conta específica (usado no rateio por conta)
  for (const r of rawData) {
    const poolDaLinha = filiaisPorLinha[r.dre] || [];
    if (!poolDaLinha.includes(r.filial)) continue;
    if (!porLinhaMes[r.dre]) porLinhaMes[r.dre] = {};
    porLinhaMes[r.dre][r.data] = (porLinhaMes[r.dre][r.data] || 0) + r.valor;
    if (!porClassifMes[r.classif]) porClassifMes[r.classif] = {};
    porClassifMes[r.classif][r.data] = (porClassifMes[r.classif][r.data] || 0) + r.valor;
    if (mes !== "Todos" && r.data !== mes) continue;
    porLinha[r.dre] = (porLinha[r.dre] || 0) + r.valor;
    if (r.conta) {
      const ck = `${r.dre}|${r.classif}|${r.conta}`;
      porConta[ck] = (porConta[ck] || 0) + r.valor;
    }
  }
  return { porLinha, porConta, porLinhaMes, porClassifMes };
}

// Por padrão, só a linha 01-Receita Bruta tem filiais definidas no pool.
// As demais linhas (Deduções, Custo Variável, Custo Fixo, Despesas, Outras Receitas)
// começam vazias — cada uma vai precisar da sua própria regra, definida na aba Regras de Rateio.
const DEFAULT_FILIAIS_POR_LINHA = dataset.DEFAULT_FILIAIS_POR_LINHA;

function computeRateio(rawData, alunosData, rules) {
  const { byMonth, totalByMonth } = buildAlunosIndex(alunosData);
  const percOf = (filial, data) => {
    const tot = totalByMonth[data];
    if (!tot) return 0;
    const al = (byMonth[data] && byMonth[data][filial]) || 0;
    return al / tot;
  };
  const alunosOf = (filial, data) => (byMonth[data] && byMonth[data][filial]) || 0;
  const totalAlunosOf = (data) => totalByMonth[data] || 0;

  const groups = {};
  for (const r of rawData) {
    const key = `${r.data}|${r.dre}|${r.classif}|${r.conta}`;
    if (!groups[key]) groups[key] = { data: r.data, dre: r.dre, classif: r.classif, conta: r.conta, porFilial: {} };
    groups[key].porFilial[r.filial] = (groups[key].porFilial[r.filial] || 0) + r.valor;
  }

  const out = [];

  // Gera uma linha para cada filial operacional em cada (mês, DRE, classificação),
  // mesmo com balancete zero — necessário pras regras por linha do DRE funcionarem
  // (cada uma decide por conta própria, via filiaisPorLinhaEfetivo, quem contribui/recebe).
  for (const key in groups) {
    const g = groups[key];
    const filiaisRelevantes = new Set([...rules.filiaisComPercentual, ...Object.keys(g.porFilial)]);
    for (const filial of filiaisRelevantes) {
      const balancete = g.porFilial[filial] || 0;
      out.push({
        data: g.data, dre: g.dre, classif: g.classif, conta: g.conta, filial,
        balancete: round2(balancete),
        percRateio: percOf(filial, g.data), alunosFilial: alunosOf(filial, g.data),
        totalAlunos: totalAlunosOf(g.data),
      });
    }
  }
  return out;
}

const DEFAULT_RULE_TOGGLES = dataset.DEFAULT_RULE_TOGGLES;

// Assistência Médica e PAT — únicas contas de Despesas lançadas 100% na BV
const CLASSIF_ASSISTENCIA_PAT_BV = dataset.CLASSIF_ASSISTENCIA_PAT_BV;

// Classificações de Marketing/BV que hoje já são rateadas no BI oficial (todas em 08-Custo Fixo)
const CLASSIF_MARKETING_BV = dataset.CLASSIF_MARKETING_BV;

// Mapa: toggle -> linha do DRE afetada (todas usam a mesma regra: tudo que a MATRIZ
// tiver naquela linha vira pool e é redistribuído entre as filiais com alunos)
const TOGGLE_MATRIZ_POR_LINHA = dataset.TOGGLE_MATRIZ_POR_LINHA;

const TOGGLE_LABELS = dataset.TOGGLE_LABELS;

const CLASSIF_RECUPERACAO_DESPESAS = "4.1.2.10.010.002";
const CLASSIF_COFINS = "3.2.1.10.010.001";
const CLASSIF_RECEITA_ADM = "4.1.1.10.010.001";

// Aplica a regra: Recuperação de Despesas (11-Outras Receitas) reduz o COFINS (02-Deduções).
// A conta Recuperação de Despesas fica zerada (some de Outras Receitas) e seu valor,
// mês a mês, é somado ao COFINS (que é negativo, então somar reduz a dedução).
function applyRecuperacaoCofinsRule(rawData, enabled) {
  if (!enabled) return { data: rawData, ajustesPorMes: {} };
  const recuperacaoPorMes = {};
  for (const r of rawData) {
    if (r.classif === CLASSIF_RECUPERACAO_DESPESAS) {
      recuperacaoPorMes[r.data] = (recuperacaoPorMes[r.data] || 0) + r.valor;
    }
  }
  const mesesJaAjustados = new Set(); // existe mais de uma linha de COFINS por mês — ajusta só 1x
  const out = [];
  for (const r of rawData) {
    if (r.classif === CLASSIF_RECUPERACAO_DESPESAS) {
      // zera — o valor dela vira parte do ajuste do COFINS, não fica mais em Outras Receitas
      continue;
    }
    if (r.classif === CLASSIF_COFINS && !mesesJaAjustados.has(r.data)) {
      mesesJaAjustados.add(r.data);
      const ajuste = recuperacaoPorMes[r.data] || 0;
      out.push({ ...r, valor: round2(r.valor + ajuste) });
      continue;
    }
    out.push(r);
  }
  return { data: out, ajustesPorMes: recuperacaoPorMes };
}

// Todas as 6 contas de encargos trabalhistas (as que aparecem duplicadas em Despesas).
const CLASSIF_FOLHA_DESTINO = dataset.CLASSIF_FOLHA_DESTINO;
// Das 6, só estas 5 têm cobertura no arquivo do SGC hoje — a Provisão de Férias
// (3.4.1.10.014.004) não veio no último export, então continua na estimativa por aluno.
const CLASSIF_FOLHA_DESTINO_SGC = dataset.CLASSIF_FOLHA_DESTINO_SGC;
const CLASSIF_FOLHA_ORIGEM = dataset.CLASSIF_FOLHA_ORIGEM;

// Aplica a regra: substitui o valor estimado (rateado por alunos) de FGTS, INSS e Provisões
// pelo custo REAL de folha de pagamento vindo do sistema SGC, por filial e por mês.
// As linhas antigas das classificações "destino" com cobertura no SGC (Custo Variável) são
// removidas e trocadas pelas linhas do SGC. A Provisão de Férias fica de fora dessa troca
// (não tem no arquivo do SGC), mantendo a estimativa por aluno normalmente.
// As 6 classificações "origem" (as mesmas contas, hoje duplicadas em Despesas) são sempre
// zeradas — senão a mesma folha de pagamento conta duas vezes na rede, mesmo pra Provisão de Férias.
function applySgcSubstitution(rawData, sgcData, enabled) {
  if (!enabled) return rawData;
  const destinoSet = new Set(CLASSIF_FOLHA_DESTINO_SGC);
  const origemSet = new Set(CLASSIF_FOLHA_ORIGEM);
  const semFolha = rawData.filter((r) => !destinoSet.has(r.classif) && !origemSet.has(r.classif));
  const comSgc = sgcData.map((s) => ({
    dre: "04-Custo Variável", classif: s.classif, conta: s.conta, filial: s.filial, data: s.data, valor: s.valor,
  }));
  return [...semFolha, ...comSgc];
}

// ---------------------------------------------------------------------------
// Aba: DRE Rateio (usa o motor acima; drill-down mostra a memória de cálculo)
// ---------------------------------------------------------------------------
function RateioView({ rules, toggles }) {
  const [filial, setFilial] = useState("Todos");
  const [grupoFilial, setGrupoFilial] = useState("Todos");
  const [semestre, setSemestre] = useState("Todos");
  const [mes, setMes] = useState("Todos");
  const [expandedLines, setExpandedLines] = useState(new Set());
  const [expandedContas, setExpandedContas] = useState(new Set());

  // regra: Recuperação de Despesas reduz o COFINS — só afeta esta aba (DRE Rateio),
  // o "Valor DRE Contábil" continua mostrando o original, sem esse ajuste
  const { data: baseDataCofins, ajustesPorMes: recuperacaoAjustes } = useMemo(
    () => applyRecuperacaoCofinsRule(EMBEDDED_DATA, toggles.recuperacaoReduzCofins),
    [toggles.recuperacaoReduzCofins]
  );

  // regra: substitui FGTS/INSS/Provisões pelo custo real de folha do SGC (por filial/mês)
  const baseData = useMemo(
    () => applySgcSubstitution(baseDataCofins, SGC_DATA, toggles.sgcSubstituiFolha),
    [baseDataCofins, toggles.sgcSubstituiFolha]
  );

  // filiaisPorLinhaEfetivo: quais filiais entram no pool de cada linha do DRE, de acordo
  // com os toggles ligados na aba "Ligar/Desligar Regras" (Receita Bruta, Deduções BV, etc.)
  const filiaisPorLinhaEfetivo = useMemo(() => {
    const base = { ...DEFAULT_FILIAIS_POR_LINHA };
    if (toggles.receitaBrutaRateada) {
      const atual = base["01-Receita Bruta"] || [];
      const novos = ["MATRIZ"].filter((f) => !atual.includes(f));
      if (novos.length) base["01-Receita Bruta"] = [...atual, ...novos];
    }
    if (toggles.deducoesBVRateada) {
      const atual = base["02-Deduções da Receita"] || [];
      if (!atual.includes("BV")) base["02-Deduções da Receita"] = [...atual, "BV"];
    }
    if (toggles.marketingBVRateado) {
      const atual = base["08-Custo Fixo"] || [];
      if (!atual.includes("BV")) base["08-Custo Fixo"] = [...atual, "BV"];
    }
    if (toggles.assistenciaPatBVRateado) {
      const atual = base["09-Despesas"] || [];
      if (!atual.includes("BV")) base["09-Despesas"] = [...atual, "BV"];
    }
    // MATRIZ nas demais linhas (Deduções, Custo Variável, Custo Fixo, Despesas, Outras Receitas) —
    // cada uma com seu próprio toggle independente
    for (const toggleKey in TOGGLE_MATRIZ_POR_LINHA) {
      if (!toggles[toggleKey]) continue;
      const linha = TOGGLE_MATRIZ_POR_LINHA[toggleKey];
      const atual = base[linha] || [];
      if (!atual.includes("MATRIZ")) base[linha] = [...atual, "MATRIZ"];
    }
    return base;
  }, [toggles.receitaBrutaRateada, toggles.deducoesBVRateada, toggles.marketingBVRateado, toggles.assistenciaPatBVRateado, toggles.deducoesMatrizRateada, toggles.custoVariavelMatrizRateado, toggles.custoFixoMatrizRateado, toggles.despesasMatrizRateadas, toggles.outrasReceitasMatrizRateadas]);

  const rateioData = useMemo(() => computeRateio(baseData, ALUNOS_DATA, rules), [baseData, rules]);
  const matrizesARatear = useMemo(() => computeMatrizesARatear(baseData, mes, filiaisPorLinhaEfetivo), [baseData, mes, filiaisPorLinhaEfetivo]);

  const filiais = useMemo(() => Array.from(new Set(rateioData.map((r) => r.filial))).sort(), [rateioData]);
  const meses = useMemo(() => Array.from(new Set(rateioData.map((r) => r.data)))
    .filter((d) => semestre === "Todos" || semestreOf(d) === semestre)
    .sort((a, b) => {
      const ka = monthSortKey(a), kb = monthSortKey(b);
      if (typeof ka === "number" && typeof kb === "number") return ka - kb;
      return String(a).localeCompare(String(b));
    }), [rateioData, semestre]);

  const filtered = useMemo(() => rateioData.filter((r) => {
    if (filial !== "Todos" && r.filial !== filial) return false;
    if (grupoFilial !== "Todos" && filialGrupo(r.filial) !== grupoFilial) return false;
    if (semestre !== "Todos" && semestreOf(r.data) !== semestre) return false;
    if (mes !== "Todos" && r.data !== mes) return false;
    return true;
  }), [rateioData, filial, grupoFilial, semestre, mes]);

  // Valor DRE Contábil = total bruto original (sem rateio), com os mesmos filtros de Filial/Mês da tela
  const dreContabilTotals = useMemo(() => {
    const t = {};
    for (const r of EMBEDDED_DATA) {
      if (filial !== "Todos" && r.filial !== filial) continue;
      if (grupoFilial !== "Todos" && filialGrupo(r.filial) !== grupoFilial) continue;
      if (semestre !== "Todos" && semestreOf(r.data) !== semestre) continue;
      if (mes !== "Todos" && r.data !== mes) continue;
      const k = lineKey(r.dre);
      t[k] = (t[k] || 0) + r.valor;
    }
    const l01 = t["01"] || 0, l02 = t["02"] || 0, l04 = t["04"] || 0;
    const l08 = t["08"] || 0, l09 = t["09"] || 0, l11 = t["11"] || 0;
    t["03"] = l01 + l02;
    t["06"] = t["03"] + l04;
    t["10"] = t["06"] + l08 + l09;
    t["15"] = t["10"] + l11;
    return t;
  }, [filial, grupoFilial, semestre, mes]);

  // mesma coisa, mas por conta (classificação) — pra dar pra comparar dentro do detalhamento
  const dreContabilPorConta = useMemo(() => {
    const t = {};
    for (const r of EMBEDDED_DATA) {
      if (filial !== "Todos" && r.filial !== filial) continue;
      if (grupoFilial !== "Todos" && filialGrupo(r.filial) !== grupoFilial) continue;
      if (semestre !== "Todos" && semestreOf(r.data) !== semestre) continue;
      if (mes !== "Todos" && r.data !== mes) continue;
      if (!r.conta) continue;
      const ck = `${r.classif}||${r.conta}`;
      t[ck] = (t[ck] || 0) + r.valor;
    }
    return t;
  }, [filial, grupoFilial, mes]);

  const lineTotals = useMemo(() => {
    const balancetePorLinha = {};
    const poolContribPorLinha = {};
    const seen = new Set();
    for (const r of filtered) {
      const k = lineKey(r.dre);
      if (BOLD_LINES.has(k)) continue;
      // o Balancete das filiais que estão no pool DESSA LINHA não entra aqui — o dinheiro delas
      // já está representado pelo pool (Valor Matrizes a Ratear); somar os dois duplicaria
      const poolDaLinha = filiaisPorLinhaEfetivo[r.dre] || [];
      if (!poolDaLinha.includes(r.filial)) {
        balancetePorLinha[k] = (balancetePorLinha[k] || 0) + r.balancete;
      }
      const dedupeKey = `${r.dre}|${r.data}|${r.filial}`;
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        const matrizMes = (matrizesARatear.porLinhaMes[r.dre] && matrizesARatear.porLinhaMes[r.dre][r.data]) || 0;
        poolContribPorLinha[k] = (poolContribPorLinha[k] || 0) + matrizMes * r.percRateio;
      }
    }
    const t = {};
    for (const k of ["01", "02", "04", "08", "09", "11"]) {
      t[k] = (balancetePorLinha[k] || 0) + (poolContribPorLinha[k] || 0);
    }
    const l01 = t["01"] || 0, l02 = t["02"] || 0, l04 = t["04"] || 0;
    const l08 = t["08"] || 0, l09 = t["09"] || 0, l11 = t["11"] || 0;
    t["03"] = l01 + l02;
    t["06"] = t["03"] + l04;
    t["10"] = t["06"] + l08 + l09;
    t["15"] = t["10"] + l11;
    return t;
  }, [filtered, matrizesARatear, filiaisPorLinhaEfetivo]);

  const contasByLine = useMemo(() => {
    // mapa filial -> "classif||conta" onde ela tem receita bruta própria (linha 01),
    // usado só pra embutir a fatia da ADM direto na conta da própria filial
    const filialHomeContaReceita = {};
    for (const r of EMBEDDED_DATA) {
      if (r.dre !== "01-Receita Bruta" || r.classif === CLASSIF_RECEITA_ADM || !r.conta) continue;
      if (Math.abs(r.valor) < 0.01) continue;
      if (!filialHomeContaReceita[r.filial]) filialHomeContaReceita[r.filial] = `${r.classif}||${r.conta}`;
    }

    const map = {};
    for (const r of filtered) {
      if (!r.conta) continue;
      const k = lineKey(r.dre);
      const poolDaLinha = filiaisPorLinhaEfetivo[r.dre] || [];
      // se a filial CONTRIBUI pro pool dessa linha, o valor próprio dela some (já foi 100%
      // pro pool) — mas ela AINDA recebe a fatia proporcional se tiver alunos (percRateio > 0),
      // igual qualquer outra filial. Ex.: a BV contribui com o COFINS/PIS dela, mas também
      // tem alunos, então recebe de volta a fatia que lhe cabe.
      const balanceteProprio = poolDaLinha.includes(r.filial) ? 0 : r.balancete;
      // usa o pool só DAQUELA conta específica (não da linha inteira) — assim uma
      // conta sem nada a ver com a regra (ex.: ISS) não recebe fatia do pool de outra (ex.: COFINS)
      const matrizMes = (matrizesARatear.porClassifMes[r.classif] && matrizesARatear.porClassifMes[r.classif][r.data]) || 0;
      const valorRateioCalc = round2(matrizMes * r.percRateio);
      const valorAposRateio = round2(balanceteProprio + valorRateioCalc);

      // Em 01-Receita Bruta, a fatia da conta ADM é embutida direto na conta de receita
      // própria da filial (não cria uma linha "Receita de Mensalidades ADM" separada) —
      // fica mais fácil de validar, já que cada filial mostra um único número.
      let ck = `${r.classif}||${r.conta}`;
      let classifOut = r.classif, contaOut = r.conta;
      if (k === "01" && r.classif === CLASSIF_RECEITA_ADM) {
        const home = filialHomeContaReceita[r.filial];
        if (home) {
          ck = home;
          [classifOut, contaOut] = home.split("||");
        }
        // se não tem "conta própria" pra fundir (ex.: a própria MATRIZ), mantém a conta ADM
        // original — assim ela aparece na lista mesmo filtrando só pela MATRIZ, zerada
        // (o valor dela já foi 100% pro pool, é isso que o Valor Após Rateio = 0 mostra)
      }

      if (!map[k]) map[k] = {};
      if (!map[k][ck]) map[k][ck] = { classif: classifOut, conta: contaOut, valorRateio: 0, detalhes: [] };
      map[k][ck].valorRateio += valorAposRateio;
      // só guarda a linha se ela realmente tem algo (balancete próprio OU fatia do rateio) —
      // senão a Memória de Cálculo fica poluída com filiais que não têm nada a ver com essa conta
      if (Math.abs(r.balancete) > 0.004 || Math.abs(valorAposRateio) > 0.004) {
        map[k][ck].detalhes.push({ ...r, classif: classifOut, conta: contaOut, valorRateioCalc, valorAposRateio, matrizMes });
      }
    }
    const out = {};
    for (const k in map) {
      out[k] = Object.values(map[k])
        .filter((c) => Math.abs(c.valorRateio) > 0.004 || c.detalhes.some((d) => Math.abs(d.balancete) > 0.004))
        .sort((a, b) => Math.abs(b.valorRateio) - Math.abs(a.valorRateio));
    }
    return out;
  }, [filtered, matrizesARatear, filiaisPorLinhaEfetivo]);

  const toggleLine = (k) => setExpandedLines((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleConta = (key) => setExpandedContas((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const filiaisVisiveis = grupoFilial === "Todos" ? filiais : filiais.filter((f) => filialGrupo(f) === grupoFilial);
  const filialOptions = [{ value: "Todos", label: "Todos" }, ...filiaisVisiveis.map((f) => ({ value: f, label: filialLabel(f) }))];
  const grupoFilialPresentes = Array.from(new Set(filiais.map(filialGrupo)));
  const grupoFilialOptions = [{ value: "Todos", label: "Todos" }, ...GRUPO_FILIAL_OPTIONS.filter((g) => grupoFilialPresentes.includes(g)).map((g) => ({ value: g, label: g }))];
  const mesOptions = [{ value: "Todos", label: "Todos" }, ...meses.map((m) => ({ value: m, label: m }))];
  const semestreOptions = [{ value: "Todos", label: "Todos" }, { value: "1º Semestre", label: "1º Semestre" }, { value: "2º Semestre", label: "2º Semestre" }];

  return (
    <div style={{ minHeight: "100%", background: CREAM, fontFamily: SANS, color: INK }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px 60px" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: 1.6, color: RED, textTransform: "uppercase" }}>
            Portal Financeiro
          </div>
          <h1 style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 400, color: NAVY, margin: "4px 0 0" }}>DRE Rateio</h1>
          <p style={{ fontFamily: SANS, fontSize: 13, color: MUTED, marginTop: 6, maxWidth: 620 }}>
            Valores redistribuídos entre filiais proporcionalmente ao número de alunos, de acordo com as regras ligadas.
            Clique numa conta para ver a memória de cálculo por filial.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {Object.keys(DEFAULT_RULE_TOGGLES).filter((k) => toggles[k]).length === 0 ? (
              <RuleStatusBadge on={false} label="Nenhuma regra ligada" />
            ) : (
              Object.keys(DEFAULT_RULE_TOGGLES).filter((k) => toggles[k]).map((k) => (
                <RuleStatusBadge key={k} on={true} label={TOGGLE_LABELS[k] || k} />
              ))
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", background: CARD, border: `1px solid ${LINE}`, borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
          <div>
            <FilterLabel>Semestre</FilterLabel>
            <Select value={semestre} onChange={(v) => { setSemestre(v); setMes("Todos"); }} options={semestreOptions} />
          </div>
          <div>
            <FilterLabel>Mês</FilterLabel>
            <Select value={mes} onChange={setMes} options={mesOptions} />
          </div>
          <div>
            <FilterLabel>Grupo Filial</FilterLabel>
            <Select value={grupoFilial} onChange={(v) => { setGrupoFilial(v); setFilial("Todos"); }} options={grupoFilialOptions} />
          </div>
          <div>
            <FilterLabel>Filial</FilterLabel>
            <Select value={filial} onChange={setFilial} options={filialOptions} />
          </div>
        </div>

        <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "12px 16px", background: NAVY, color: "#fff", fontFamily: SANS, fontSize: 12, fontWeight: 700 }}>DRE</th>
                <th style={{ textAlign: "right", padding: "12px 16px", background: NAVY, color: "#fff", fontFamily: SANS, fontSize: 12, fontWeight: 700 }}>Valor DRE Contábil</th>
                <th style={{ textAlign: "right", padding: "12px 16px", background: NAVY, color: "#fff", fontFamily: SANS, fontSize: 12, fontWeight: 700 }}>Valor Após Rateio</th>
              </tr>
            </thead>
            <tbody>
              {ORDERED_LINES.map((k) => {
                const val = lineTotals[k] || 0;
                const valContabil = dreContabilTotals[k] || 0;
                const bold = BOLD_LINES.has(k);
                const accent = ACCENT_LINES.has(k);
                const contas = contasByLine[k] || [];
                const expanded = expandedLines.has(k);
                const rowBg = accent ? "#EEF1F6" : bold ? CREAM : "#fff";
                const dreFull = LINE_LABELS[k];
                return (
                  <React.Fragment key={k}>
                    <tr onClick={() => contas.length > 0 && toggleLine(k)} style={{ background: rowBg, borderTop: `1px solid ${LINE}`, cursor: contas.length > 0 ? "pointer" : "default" }}>
                      <td style={{ padding: "10px 16px", fontFamily: SANS, fontWeight: bold ? 700 : 500, color: NAVY }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {contas.length > 0 ? (expanded ? <ChevronDown size={15} color={MUTED} /> : <ChevronRight size={15} color={MUTED} />) : <span style={{ width: 15, display: "inline-block" }} />}
                          {LINE_LABELS[k]}
                        </span>
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: MONO, fontSize: 13, fontWeight: bold ? 700 : 400, color: valContabil < 0 ? NEG : valContabil > 0 ? POS : MUTED, opacity: 0.7 }}>
                        {fmtBRL(valContabil)}
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: MONO, fontSize: 13.5, fontWeight: bold ? 700 : 400, color: val < 0 ? NEG : val > 0 ? POS : MUTED }}>
                        {fmtBRL(val)}
                      </td>
                    </tr>
                    {k === "02" && toggles.deducoesBVRateada && (
                      <tr>
                        <td colSpan={3} style={{ padding: "0 16px 10px" }}>
                          <div style={{
                            display: "flex", gap: 8, alignItems: "flex-start",
                            background: "#FFF6DA", border: "1px solid #E9CD6E", borderRadius: 8,
                            padding: "10px 12px", fontFamily: SANS, fontSize: 12, color: "#5C4A00",
                          }}>
                            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                            <span>
                              <strong>Regra "Deduções da BV rateadas" está ligada.</strong> COFINS e PIS, hoje 100% na filial BV, estão sendo
                              redistribuídos entre as filiais com alunos, proporcional ao % de cada uma — inclusive a própria BV recebe uma fatia de volta.
                              O total desta linha ("{fmtBRL(val)}") não muda, porque é o mesmo dinheiro sendo redistribuído entre as mesmas filiais — para
                              ver o efeito da regra, <strong>filtre por uma filial específica</strong> (ex.: MB) no topo da tela, ou abra a conta COFINS/PIS
                              abaixo e expanda a Memória de Cálculo de cada filial.
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {expanded && contas.map((c) => {
                      const ckey = `${k}|${c.classif}|${c.conta}`;
                      const cExpanded = expandedContas.has(ckey);
                      const contaKey = `${c.classif}||${c.conta}`;
                      const valContabilConta = dreContabilPorConta[contaKey] || 0;
                      const mudou = Math.abs(valContabilConta - c.valorRateio) > 1;
                      return (
                        <React.Fragment key={ckey}>
                          <tr onClick={() => toggleConta(ckey)} style={{ borderTop: `1px solid ${LINE}`, cursor: "pointer", background: mudou ? "#FCFBF3" : "transparent" }}>
                            <td style={{ padding: "7px 16px 7px 40px", fontFamily: SANS, fontSize: 13, color: INK }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                {cExpanded ? <ChevronDown size={13} color={MUTED} /> : <ChevronRight size={13} color={MUTED} />}
                                <span style={{ color: MUTED, fontFamily: MONO, fontSize: 11, marginRight: 4 }}>{c.classif}</span>
                                {c.conta}
                                {mudou && (
                                  <span style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, color: "#8A6D00", background: "#FFF6DA", padding: "1px 6px", borderRadius: 999 }}>
                                    alterada
                                  </span>
                                )}
                              </span>
                            </td>
                            <td style={{ padding: "7px 16px", textAlign: "right", fontFamily: MONO, fontSize: 13, color: valContabilConta < 0 ? NEG : valContabilConta > 0 ? POS : MUTED, opacity: 0.7 }}>
                              {fmtBRL(valContabilConta)}
                            </td>
                            <td style={{ padding: "7px 16px", textAlign: "right", fontFamily: MONO, fontSize: 13, color: c.valorRateio < 0 ? NEG : c.valorRateio > 0 ? POS : MUTED }}>
                              {fmtBRL(c.valorRateio)}
                            </td>
                          </tr>
                          {cExpanded && c.classif === CLASSIF_COFINS && toggles.recuperacaoReduzCofins && (
                            <MemoriaCalculoRecuperacao ajustesPorMes={recuperacaoAjustes} mesesVisiveis={mes !== "Todos" ? [mes] : meses} />
                          )}
                          {cExpanded && toggles.deducoesBVRateada && (c.classif === CLASSIF_COFINS || c.classif === "3.2.1.10.010.004") && (
                            <tr>
                              <td colSpan={3} style={{ padding: "0 16px 0 56px", background: "#FCFBF9" }}>
                                <div style={{
                                  display: "flex", gap: 8, alignItems: "flex-start",
                                  background: "#FFF6DA", border: "1px solid #E9CD6E", borderRadius: 8,
                                  padding: "10px 12px", marginBottom: 10, fontFamily: SANS, fontSize: 12, color: "#5C4A00",
                                }}>
                                  <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                                  <span>
                                    <strong>Regra aplicada:</strong> como essa conta está 100% lançada na filial BV, o valor dela vai inteiro
                                    para o pool "Valor Matrizes a Ratear" e é redistribuído entre todas as filiais com alunos, proporcional ao % de cada uma —
                                    veja o detalhe mês a mês na Memória de Cálculo abaixo.
                                  </span>
                                </div>
                              </td>
                            </tr>
                          )}
                          {cExpanded && toggles.sgcSubstituiFolha && CLASSIF_FOLHA_DESTINO_SGC.includes(c.classif) && (
                            <tr>
                              <td colSpan={3} style={{ padding: "0 16px 0 56px", background: "#FCFBF9" }}>
                                <div style={{
                                  display: "flex", gap: 8, alignItems: "flex-start",
                                  background: "#FFF6DA", border: "1px solid #E9CD6E", borderRadius: 8,
                                  padding: "10px 12px", marginBottom: 10, fontFamily: SANS, fontSize: 12, color: "#5C4A00",
                                }}>
                                  <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                                  <span>
                                    <strong>Regra aplicada — não é rateio, é substituição:</strong> o valor que essa conta tinha (estimado
                                    por número de alunos) foi <strong>trocado</strong> pelo custo real de folha de pagamento de cada filial,
                                    vindo do sistema SGC. Não é uma divisão entre filiais — é a troca de uma estimativa por um dado real.
                                    Total Contábil (estimado): {fmtBRL(round2(EMBEDDED_DATA.filter((r) => r.classif === c.classif).reduce((a, r) => a + r.valor, 0)))} →
                                    Total SGC (real): {fmtBRL(round2(SGC_DATA.filter((s) => s.classif === c.classif).reduce((a, s) => a + s.valor, 0)))}.
                                    Veja o valor por filial e mês na Memória de Cálculo abaixo — a coluna "Balancete" já mostra o valor do SGC.
                                  </span>
                                </div>
                              </td>
                            </tr>
                          )}
                          {cExpanded && <MemoriaCalculo detalhes={c.detalhes} />}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ textAlign: "center", marginTop: 24, fontFamily: SANS, fontSize: 11, color: MUTED }}>
          CULTURA INGLESA · PORTAL FINANCEIRO — DRE Rateio (motor: proporcional por alunos + pools BV/Matriz e pool total)
        </div>
      </div>
    </div>
  );
}

// Memória de cálculo específica da regra "Recuperação de Despesas reduz o COFINS" —
// mostra mês a mês: COFINS antes da regra, valor abatido, e COFINS depois da regra.
function MemoriaCalculoRecuperacao({ ajustesPorMes, mesesVisiveis }) {
  const cofinsOriginalPorMes = useMemo(() => {
    const t = {};
    for (const r of EMBEDDED_DATA) {
      if (r.classif !== CLASSIF_COFINS) continue;
      t[r.data] = (t[r.data] || 0) + r.valor;
    }
    return t;
  }, []);

  const linhas = mesesVisiveis
    .map((m) => {
      const cofinsAntes = round2(cofinsOriginalPorMes[m] || 0);
      const abatimento = round2(ajustesPorMes[m] || 0);
      const cofinsDepois = round2(cofinsAntes + abatimento);
      return { mes: m, cofinsAntes, abatimento, cofinsDepois };
    })
    .sort((a, b) => {
      const ka = monthSortKey(a.mes), kb = monthSortKey(b.mes);
      if (typeof ka === "number" && typeof kb === "number") return ka - kb;
      return String(a.mes).localeCompare(String(b.mes));
    });

  const totalAntes = round2(linhas.reduce((a, l) => a + l.cofinsAntes, 0));
  const totalAbatimento = round2(linhas.reduce((a, l) => a + l.abatimento, 0));
  const totalDepois = round2(linhas.reduce((a, l) => a + l.cofinsDepois, 0));

  return (
    <tr>
      <td colSpan={3} style={{ padding: "0 16px 16px 56px", background: "#FCFBF9" }}>
        <div style={{
          display: "flex", gap: 8, alignItems: "flex-start",
          background: "#FFF6DA", border: "1px solid #E9CD6E", borderRadius: 8,
          padding: "10px 12px", marginBottom: 10, fontFamily: SANS, fontSize: 12, color: "#5C4A00",
        }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            <strong>Regra aplicada:</strong> o valor de <strong>4.1.2.10.010.002 – Recuperação de Despesas</strong> (que
            saiu de "11-Outras Receitas") é somado ao COFINS mês a mês, reduzindo a dedução.
          </span>
        </div>
        <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color: NAVY, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.3 }}>
          Memória de cálculo — Recuperação de Despesas × COFINS
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontFamily: MONO, fontSize: 11.5, width: "100%" }}>
            <thead>
              <tr style={{ color: MUTED }}>
                <th style={{ textAlign: "left", padding: "4px 8px", fontFamily: SANS, fontWeight: 700 }}>Mês</th>
                <th style={{ textAlign: "right", padding: "4px 8px", fontFamily: SANS, fontWeight: 700 }}>COFINS antes da regra</th>
                <th style={{ textAlign: "right", padding: "4px 8px", fontFamily: SANS, fontWeight: 700 }}>Recuperação de Despesas (abatido)</th>
                <th style={{ textAlign: "right", padding: "4px 8px", fontFamily: SANS, fontWeight: 700 }}>COFINS após a regra</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.mes} style={{ borderTop: `1px solid ${LINE}` }}>
                  <td style={{ padding: "4px 8px", fontFamily: SANS }}>{l.mes}</td>
                  <td style={{ padding: "4px 8px", textAlign: "right", color: l.cofinsAntes < 0 ? NEG : l.cofinsAntes > 0 ? POS : MUTED }}>{fmtBRL(l.cofinsAntes)}</td>
                  <td style={{ padding: "4px 8px", textAlign: "right", color: "#8A6D00" }}>{fmtBRL(l.abatimento)}</td>
                  <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 700, color: l.cofinsDepois < 0 ? NEG : l.cofinsDepois > 0 ? POS : MUTED }}>{fmtBRL(l.cofinsDepois)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: `2px solid ${NAVY}`, fontWeight: 700 }}>
                <td style={{ padding: "5px 8px", fontFamily: SANS }}>Total</td>
                <td style={{ padding: "5px 8px", textAlign: "right", color: totalAntes < 0 ? NEG : totalAntes > 0 ? POS : MUTED }}>{fmtBRL(totalAntes)}</td>
                <td style={{ padding: "5px 8px", textAlign: "right", color: "#8A6D00" }}>{fmtBRL(totalAbatimento)}</td>
                <td style={{ padding: "5px 8px", textAlign: "right", color: totalDepois < 0 ? NEG : totalDepois > 0 ? POS : MUTED }}>{fmtBRL(totalDepois)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

function MemoriaCalculo({ detalhes }) {
  // agrupa por (Data, Filial) — pode ter mais de uma origem no mesmo mês/filial quando a
  // conta foi mesclada (ex.: receita própria da filial + fatia da conta ADM embutida)
  const grouped = {};
  for (const r of detalhes) {
    const key = `${r.data}||${r.filial}`;
    if (!grouped[key]) {
      grouped[key] = {
        data: r.data, filial: r.filial, balancete: 0, matrizMes: 0,
        valorRateioCalc: 0, valorAposRateio: 0,
        percRateio: r.percRateio, totalAlunos: r.totalAlunos, alunosFilial: r.alunosFilial,
      };
    }
    grouped[key].balancete += r.balancete;
    grouped[key].matrizMes += r.matrizMes;
    grouped[key].valorRateioCalc += r.valorRateioCalc;
    grouped[key].valorAposRateio += r.valorAposRateio;
  }
  const withCalc = Object.values(grouped)
    .map((r) => ({ ...r, balancete: round2(r.balancete), matrizMes: round2(r.matrizMes), valorRateioCalc: round2(r.valorRateioCalc), valorAposRateio: round2(r.valorAposRateio) }))
    .sort((a, b) => {
      const ka = monthSortKey(a.data), kb = monthSortKey(b.data);
      if (typeof ka === "number" && typeof kb === "number" && ka !== kb) return ka - kb;
      return a.filial.localeCompare(b.filial);
    });

  const totalBalancete = round2(withCalc.reduce((a, r) => a + r.balancete, 0));
  const totalRateio = round2(withCalc.reduce((a, r) => a + r.valorRateioCalc, 0));
  const totalAposRateio = round2(totalBalancete + totalRateio);
  const mostraFilial = new Set(withCalc.map((r) => r.filial)).size > 1;

  return (
    <tr>
      <td colSpan={2} style={{ padding: "10px 16px 16px 56px", background: "#FCFBF9" }}>
        <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color: NAVY, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.3 }}>
          Memória de cálculo
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontFamily: MONO, fontSize: 11.5, width: "100%" }}>
            <thead>
              <tr style={{ color: MUTED }}>
                <th style={{ textAlign: "left", padding: "4px 8px", fontFamily: SANS, fontWeight: 700 }}>Data</th>
                {mostraFilial && <th style={{ textAlign: "left", padding: "4px 8px", fontFamily: SANS, fontWeight: 700 }}>Filial</th>}
                <th style={{ textAlign: "right", padding: "4px 8px", fontFamily: SANS, fontWeight: 700 }}>Balancete</th>
                <th style={{ textAlign: "right", padding: "4px 8px", fontFamily: SANS, fontWeight: 700 }}>Valor Matrizes a Ratear</th>
                <th style={{ textAlign: "right", padding: "4px 8px", fontFamily: SANS, fontWeight: 700 }}>Total de Alunos</th>
                <th style={{ textAlign: "right", padding: "4px 8px", fontFamily: SANS, fontWeight: 700 }}>Alunos Filial</th>
                <th style={{ textAlign: "right", padding: "4px 8px", fontFamily: SANS, fontWeight: 700 }}>% Rateio</th>
                <th style={{ textAlign: "right", padding: "4px 8px", fontFamily: SANS, fontWeight: 700 }}>Valor Rateio</th>
                <th style={{ textAlign: "right", padding: "4px 8px", fontFamily: SANS, fontWeight: 700 }}>Valor Após o Rateio</th>
              </tr>
            </thead>
            <tbody>
              {withCalc.map((r, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${LINE}` }}>
                  <td style={{ padding: "4px 8px", fontFamily: SANS }}>{r.data}</td>
                  {mostraFilial && <td style={{ padding: "4px 8px", fontFamily: SANS }}>{filialLabel(r.filial)}</td>}
                  <td style={{ padding: "4px 8px", textAlign: "right", color: r.balancete < 0 ? NEG : r.balancete > 0 ? POS : MUTED }}>{fmtBRL(r.balancete)}</td>
                  <td style={{ padding: "4px 8px", textAlign: "right", color: r.matrizMes !== 0 ? "#8A6D00" : MUTED }}>{fmtBRL(r.matrizMes)}</td>
                  <td style={{ padding: "4px 8px", textAlign: "right" }}>{r.totalAlunos.toLocaleString("pt-BR")}</td>
                  <td style={{ padding: "4px 8px", textAlign: "right" }}>{r.alunosFilial.toLocaleString("pt-BR")}</td>
                  <td style={{ padding: "4px 8px", textAlign: "right" }}>{(r.percRateio * 100).toFixed(4)}%</td>
                  <td style={{ padding: "4px 8px", textAlign: "right", color: r.valorRateioCalc < 0 ? NEG : r.valorRateioCalc > 0 ? POS : MUTED }}>{fmtBRL(r.valorRateioCalc)}</td>
                  <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 700, color: r.valorAposRateio < 0 ? NEG : r.valorAposRateio > 0 ? POS : MUTED }}>{fmtBRL(r.valorAposRateio)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: `2px solid ${NAVY}`, fontWeight: 700 }}>
                <td style={{ padding: "5px 8px", fontFamily: SANS }} colSpan={mostraFilial ? 2 : 1}>Total</td>
                <td style={{ padding: "5px 8px", textAlign: "right", color: totalBalancete < 0 ? NEG : totalBalancete > 0 ? POS : MUTED }}>{fmtBRL(totalBalancete)}</td>
                <td style={{ padding: "5px 8px" }} colSpan={4}></td>
                <td style={{ padding: "5px 8px", textAlign: "right", color: totalRateio < 0 ? NEG : totalRateio > 0 ? POS : MUTED }}>{fmtBRL(totalRateio)}</td>
                <td style={{ padding: "5px 8px", textAlign: "right", color: totalAposRateio < 0 ? NEG : totalAposRateio > 0 ? POS : MUTED }}>{fmtBRL(totalAposRateio)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

function RuleStatusBadge({ on, label }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontFamily: SANS, fontSize: 11.5, fontWeight: 700,
      padding: "5px 10px", borderRadius: 999,
      background: on ? "#E7F4EC" : "#F3F3F3",
      color: on ? POS : MUTED,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: on ? POS : "#B7B7B7" }} />
      {label}: {on ? "Ligada" : "Desligada"}
    </span>
  );
}


// ---------------------------------------------------------------------------
// Aba: Ligar/Desligar Regras — controla o que o motor de rateio aplica
// ---------------------------------------------------------------------------
function ToggleSwitch({ on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 44, height: 24, borderRadius: 999, border: "none", cursor: "pointer",
        background: on ? POS : "#D9D9D9", position: "relative", flexShrink: 0,
        transition: "background 0.15s",
      }}
    >
      <span style={{
        position: "absolute", top: 2, left: on ? 22 : 2,
        width: 20, height: 20, borderRadius: "50%", background: "#fff",
        transition: "left 0.15s", boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
      }} />
    </button>
  );
}

function ContaChips({ classifs, color }) {
  const cor = color || NAVY;
  const bg = color === RED ? "#FBEAEC" : color === "#8A6D00" ? "#FFF6DA" : "#EEF1F6";
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
      {classifs.map((c) => (
        <span key={c} style={{ fontFamily: MONO, fontSize: 10.5, padding: "3px 7px", borderRadius: 5, background: bg, color: cor }}>
          {classifLabel(c)}
        </span>
      ))}
    </div>
  );
}

function ToggleRow({ title, description, on, onChange, disabled, extra }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
      padding: "16px 0", borderTop: `1px solid ${LINE}`, opacity: disabled ? 0.45 : 1,
    }}>
      <div style={{ maxWidth: 620 }}>
        <div style={{ fontFamily: SANS, fontSize: 14.5, fontWeight: 700, color: NAVY, marginBottom: 4 }}>{title}</div>
        <div style={{ fontFamily: SANS, fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>{description}</div>
        {extra && <div style={{ marginTop: 8 }}>{extra}</div>}
      </div>
      <ToggleSwitch on={on} onChange={disabled ? () => {} : onChange} />
    </div>
  );
}
function TogglesView({ toggles, setToggles }) {
  const set = (key) => (v) => setToggles((prev) => ({ ...prev, [key]: v }));

  return (
    <div style={{ minHeight: "100%", background: CREAM, fontFamily: SANS, color: INK }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px 60px" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: 1.6, color: RED, textTransform: "uppercase" }}>
            Portal Financeiro
          </div>
          <h1 style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 400, color: NAVY, margin: "4px 0 0" }}>Ligar/Desligar Regras</h1>
          <p style={{ fontFamily: SANS, fontSize: 13, color: MUTED, marginTop: 6, maxWidth: 640 }}>
            Cada chave abaixo liga ou desliga uma forma diferente de dividir valores entre as unidades. Com tudo desligado,
            a aba "DRE Rateio" mostra os números exatamente como estão no balancete — sem nenhuma divisão.
          </p>
        </div>

        <Card>
          <ToggleRow
            title="Usar a Recuperação de Despesas para abater o COFINS"
            description="Hoje existe um valor de “Recuperação de Despesas” que aparece como receita extra. Esta regra usa esse valor para diminuir o imposto COFINS, em vez de deixá-lo separado como receita — o efeito final no resultado é o mesmo, mas fica mais correto contabilmente."
            on={toggles.recuperacaoReduzCofins}
            onChange={set("recuperacaoReduzCofins")}
            extra={<ContaChips classifs={[CLASSIF_RECUPERACAO_DESPESAS, CLASSIF_COFINS]} color={RED} />}
          />
        </Card>

        <div style={{ height: 20 }} />

        <Card>
          <ToggleRow
            title="Dividir o COFINS e o PIS da unidade BV entre todas as unidades"
            description="O COFINS e o PIS hoje estão lançados inteiramente na unidade BV. Esta regra divide esse valor entre todas as unidades, na proporção do número de alunos de cada uma — a própria BV também recebe sua parte de volta, já que ela tem alunos."
            on={toggles.deducoesBVRateada}
            onChange={set("deducoesBVRateada")}
            extra={<ContaChips classifs={[CLASSIF_COFINS, "3.2.1.10.010.004"]} color={RED} />}
          />
          <ToggleRow
            title="Dividir as contas de Marketing da unidade BV entre todas as unidades"
            description="Brindes, Rádio, Publicidade, Eventos, Material Promocional, Mídias Digitais e outras contas de Marketing hoje concentradas na unidade BV — o mesmo grupo que já é rateado no BI oficial. Esta regra divide esse valor entre todas as unidades, na proporção do número de alunos de cada uma."
            on={toggles.marketingBVRateado}
            onChange={set("marketingBVRateado")}
            extra={<ContaChips classifs={CLASSIF_MARKETING_BV} />}
          />
          <ToggleRow
            title="Dividir Assistência Médica e PAT da unidade BV entre todas as unidades"
            description="Assistência Médica e o PAT (Programa de Alimentação do Trabalhador) são as únicas contas de Despesas lançadas 100% na unidade BV — as outras filiais também precisam desse custo, mas hoje ele fica todo concentrado na BV. Esta regra divide esse valor entre todas as unidades, na proporção do número de alunos de cada uma."
            on={toggles.assistenciaPatBVRateado}
            onChange={set("assistenciaPatBVRateado")}
            extra={<ContaChips classifs={CLASSIF_ASSISTENCIA_PAT_BV} />}
          />
        </Card>

        <div style={{ height: 20 }} />

        <Card>
          <ToggleRow
            title="Usar o valor real da folha de pagamento nos encargos trabalhistas"
            description="Em vez de estimar quanto cada unidade gasta com FGTS, INSS, 13º e remunerações (dividindo por número de alunos), usa o valor exato que veio do sistema de folha de pagamento (SGC) — fica mais preciso, porque é o custo real de cada unidade. A Provisão de Férias não tem cobertura no arquivo do SGC atual, então continua na estimativa por aluno. As 6 contas existem duplicadas em 09-Despesas, com códigos diferentes (provavelmente um resquício de reclassificação de plano de contas) — a regra sempre zera essas 6 contas equivalentes em Despesas, pra mesma folha não contar duas vezes (mesmo pra Provisão de Férias)."
            on={toggles.sgcSubstituiFolha}
            onChange={set("sgcSubstituiFolha")}
            extra={<ContaChips classifs={CLASSIF_FOLHA_DESTINO_SGC} color="#8A6D00" />}
          />
          <div style={{ overflowX: "auto", marginTop: 4 }}>
            <table style={{ borderCollapse: "collapse", fontFamily: MONO, fontSize: 11.5, width: "100%" }}>
              <thead>
                <tr style={{ color: MUTED }}>
                  <th style={{ textAlign: "left", padding: "4px 8px", fontFamily: SANS, fontWeight: 700 }}>Classificação</th>
                  <th style={{ textAlign: "left", padding: "4px 8px", fontFamily: SANS, fontWeight: 700 }}>Conta</th>
                </tr>
              </thead>
              <tbody>
                {CLASSIF_FOLHA_DESTINO_SGC.map((c) => {
                  const conta = (SGC_DATA.find((s) => s.classif === c) || {}).conta || "";
                  return (
                    <tr key={c} style={{ borderTop: `1px solid ${LINE}` }}>
                      <td style={{ padding: "4px 8px" }}>{c}</td>
                      <td style={{ padding: "4px 8px", fontFamily: SANS }}>{conta}</td>
                    </tr>
                  );
                })}
                <tr style={{ borderTop: `1px solid ${LINE}` }}>
                  <td style={{ padding: "4px 8px" }}>3.4.1.10.014.004</td>
                  <td style={{ padding: "4px 8px", fontFamily: SANS, color: MUTED, fontStyle: "italic" }}>Provisao Ferias — sem cobertura no SGC, segue estimada por aluno</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <div style={{ height: 20 }} />


        <Card>
          <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 8 }}>
            Dividir grupos de contas da Matriz
          </div>
          <p style={{ fontFamily: SANS, fontSize: 12.5, color: MUTED, marginBottom: 0 }}>
            Toda conta lançada na Matriz dentro da linha do DRE indicada deixa de ficar concentrada ali e passa a ser
            dividida entre as unidades, na proporção do número de alunos de cada uma. Cada chave abaixo é independente —
            você pode ligar só uma, várias, ou todas ao mesmo tempo. Quando a área tem mais de uma conta na Matriz
            (todas menos a Receita), cada conta dividida aparece separada na lista, marcada com o selo "alterada".
          </p>
          <ToggleRow
            title="Receita Bruta"
            description="Divide a Receita de Mensalidades ADM e outras receitas que hoje aparecem só na Matriz entre todas as unidades."
            on={toggles.receitaBrutaRateada}
            onChange={set("receitaBrutaRateada")}
          />
          <ToggleRow
            title="Deduções da Receita (impostos sobre vendas)"
            description="Divide, entre as unidades, os impostos e deduções sobre receita que hoje estão lançados na Matriz."
            on={toggles.deducoesMatrizRateada}
            onChange={set("deducoesMatrizRateada")}
          />
          <ToggleRow
            title="Custo Variável"
            description="Divide, entre as unidades, os custos variáveis que hoje estão lançados na Matriz."
            on={toggles.custoVariavelMatrizRateado}
            onChange={set("custoVariavelMatrizRateado")}
          />
          <ToggleRow
            title="Custo Fixo"
            description="Divide, entre as unidades, os custos fixos que hoje estão lançados na Matriz."
            on={toggles.custoFixoMatrizRateado}
            onChange={set("custoFixoMatrizRateado")}
          />
          <ToggleRow
            title="Despesas"
            description="Divide, entre as unidades, as despesas que hoje estão lançadas na Matriz."
            on={toggles.despesasMatrizRateadas}
            onChange={set("despesasMatrizRateadas")}
          />
          <ToggleRow
            title="Outras Receitas"
            description="Divide, entre as unidades, as outras receitas que hoje estão lançadas na Matriz."
            on={toggles.outrasReceitasMatrizRateadas}
            onChange={set("outrasReceitasMatrizRateadas")}
          />
        </Card>

        <div style={{ height: 20 }} />

        <Card>
          <h2 style={{ fontFamily: SERIF, fontSize: 18, color: NAVY, margin: "0 0 6px" }}>Pendências conhecidas</h2>
          <ul style={{ fontFamily: SANS, fontSize: 13, color: MUTED, lineHeight: 1.6, margin: 0, paddingLeft: 18 }}>
            <li>Transferência 4.1.2.10.010.002 → 3.2.1.10.010.001 — regra documentada, ainda não aplicada aqui por falta dessas contas no dataset atual.</li>
            <li>Rateio da Receita ADM — já é coberto automaticamente pela regra "Receita Bruta" acima, já que a Receita ADM está 100% em MATRIZ.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Aba: Comparativo de Filial — matriz DRE x Filial, com o Valor Após Rateio
// (usa exatamente as mesmas regras/toggles ativas na aba DRE Rateio)
// ---------------------------------------------------------------------------
function ComparativoFilialView({ rules, toggles }) {
  const [semestre, setSemestre] = useState("Todos");
  const [mes, setMes] = useState("Todos");

  const { data: baseDataCofins } = useMemo(
    () => applyRecuperacaoCofinsRule(EMBEDDED_DATA, toggles.recuperacaoReduzCofins),
    [toggles.recuperacaoReduzCofins]
  );
  const baseData = useMemo(
    () => applySgcSubstitution(baseDataCofins, SGC_DATA, toggles.sgcSubstituiFolha),
    [baseDataCofins, toggles.sgcSubstituiFolha]
  );

  const filiaisPorLinhaEfetivo = useMemo(() => {
    const base = { ...DEFAULT_FILIAIS_POR_LINHA };
    if (toggles.receitaBrutaRateada) {
      const atual = base["01-Receita Bruta"] || [];
      const novos = ["MATRIZ"].filter((f) => !atual.includes(f));
      if (novos.length) base["01-Receita Bruta"] = [...atual, ...novos];
    }
    if (toggles.deducoesBVRateada) {
      const atual = base["02-Deduções da Receita"] || [];
      if (!atual.includes("BV")) base["02-Deduções da Receita"] = [...atual, "BV"];
    }
    if (toggles.marketingBVRateado) {
      const atual = base["08-Custo Fixo"] || [];
      if (!atual.includes("BV")) base["08-Custo Fixo"] = [...atual, "BV"];
    }
    if (toggles.assistenciaPatBVRateado) {
      const atual = base["09-Despesas"] || [];
      if (!atual.includes("BV")) base["09-Despesas"] = [...atual, "BV"];
    }
    // MATRIZ nas demais linhas (Deduções, Custo Variável, Custo Fixo, Despesas, Outras Receitas) —
    // cada uma com seu próprio toggle independente
    for (const toggleKey in TOGGLE_MATRIZ_POR_LINHA) {
      if (!toggles[toggleKey]) continue;
      const linha = TOGGLE_MATRIZ_POR_LINHA[toggleKey];
      const atual = base[linha] || [];
      if (!atual.includes("MATRIZ")) base[linha] = [...atual, "MATRIZ"];
    }
    return base;
  }, [toggles.receitaBrutaRateada, toggles.deducoesBVRateada, toggles.marketingBVRateado, toggles.assistenciaPatBVRateado, toggles.deducoesMatrizRateada, toggles.custoVariavelMatrizRateado, toggles.custoFixoMatrizRateado, toggles.despesasMatrizRateadas, toggles.outrasReceitasMatrizRateadas]);

  const rateioData = useMemo(() => computeRateio(baseData, ALUNOS_DATA, rules), [baseData, rules]);
  const matrizesARatear = useMemo(() => computeMatrizesARatear(baseData, mes, filiaisPorLinhaEfetivo), [baseData, mes, filiaisPorLinhaEfetivo]);

  const meses = useMemo(() => Array.from(new Set(rateioData.map((r) => r.data)))
    .filter((d) => semestre === "Todos" || semestreOf(d) === semestre)
    .sort((a, b) => {
      const ka = monthSortKey(a), kb = monthSortKey(b);
      if (typeof ka === "number" && typeof kb === "number") return ka - kb;
      return String(a).localeCompare(String(b));
    }), [rateioData, semestre]);

  const filiais = useMemo(() => Array.from(new Set(rateioData.map((r) => r.filial))).sort(), [rateioData]);

  // matriz: { filial: { '01': valor, '02': valor, ... } }
  const matriz = useMemo(() => {
    const t = {};
    for (const f of filiais) t[f] = {};
    const seen = new Set();
    for (const r of rateioData) {
      if (semestre !== "Todos" && semestreOf(r.data) !== semestre) continue;
      if (mes !== "Todos" && r.data !== mes) continue;
      const k = lineKey(r.dre);
      if (BOLD_LINES.has(k)) continue;
      if (!t[r.filial]) t[r.filial] = {};
      const poolDaLinha = filiaisPorLinhaEfetivo[r.dre] || [];
      if (!poolDaLinha.includes(r.filial)) {
        t[r.filial][k] = (t[r.filial][k] || 0) + r.balancete;
      } else if (t[r.filial][k] === undefined) {
        t[r.filial][k] = 0;
      }
      const dedupeKey = `${r.dre}|${r.data}|${r.filial}`;
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        const matrizMes = (matrizesARatear.porLinhaMes[r.dre] && matrizesARatear.porLinhaMes[r.dre][r.data]) || 0;
        t[r.filial][k] = (t[r.filial][k] || 0) + matrizMes * r.percRateio;
      }
    }
    for (const f in t) {
      const l01 = t[f]["01"] || 0, l02 = t[f]["02"] || 0, l04 = t[f]["04"] || 0;
      const l08 = t[f]["08"] || 0, l09 = t[f]["09"] || 0, l11 = t[f]["11"] || 0;
      t[f]["03"] = l01 + l02;
      t[f]["06"] = t[f]["03"] + l04;
      t[f]["10"] = t[f]["06"] + l08 + l09;
      t[f]["15"] = t[f]["10"] + l11;
    }
    return t;
  }, [rateioData, matrizesARatear, filiaisPorLinhaEfetivo, filiais, semestre, mes]);

  const totalGeral = useMemo(() => {
    const t = {};
    for (const k of ORDERED_LINES) {
      t[k] = filiais.reduce((a, f) => a + (matriz[f] && matriz[f][k] || 0), 0);
    }
    return t;
  }, [matriz, filiais]);

  const mesOptions = [{ value: "Todos", label: "Todos" }, ...meses.map((m) => ({ value: m, label: m }))];
  const semestreOptions = [{ value: "Todos", label: "Todos" }, { value: "1º Semestre", label: "1º Semestre" }, { value: "2º Semestre", label: "2º Semestre" }];

  return (
    <div style={{ minHeight: "100%", background: CREAM, fontFamily: SANS, color: INK }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px 60px" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: 1.6, color: RED, textTransform: "uppercase" }}>
            Portal Financeiro
          </div>
          <h1 style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 400, color: NAVY, margin: "4px 0 0" }}>Comparativo de Filial</h1>
          <p style={{ fontFamily: SANS, fontSize: 13, color: MUTED, marginTop: 6, maxWidth: 640 }}>
            Todas as filiais lado a lado, com o Valor Após Rateio de cada linha do DRE — usando as mesmas regras
            ligadas hoje na aba "DRE Rateio".
          </p>
        </div>

        <div style={{ display: "flex", gap: 20, alignItems: "center", background: CARD, border: `1px solid ${LINE}`, borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
          <div>
            <FilterLabel>Semestre</FilterLabel>
            <Select value={semestre} onChange={(v) => { setSemestre(v); setMes("Todos"); }} options={semestreOptions} />
          </div>
          <div>
            <FilterLabel>Mês</FilterLabel>
            <Select value={mes} onChange={setMes} options={mesOptions} />
          </div>
        </div>

        <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 10, overflow: "auto", maxWidth: "100%" }}>
          <table style={{ borderCollapse: "collapse", fontFamily: MONO, fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{
                  position: "sticky", left: 0, zIndex: 2, textAlign: "left", padding: "10px 14px",
                  background: NAVY, color: "#fff", fontFamily: SANS, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap",
                }}>DRE</th>
                {filiais.map((f) => (
                  <th key={f} style={{ textAlign: "right", padding: "10px 12px", background: NAVY, color: "#fff", fontFamily: SANS, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                    {filialLabel(f)}
                  </th>
                ))}
                <th style={{ textAlign: "right", padding: "10px 14px", background: RED, color: "#fff", fontFamily: SANS, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {ORDERED_LINES.map((k) => {
                const bold = BOLD_LINES.has(k);
                const accent = ACCENT_LINES.has(k);
                const rowBg = accent ? "#EEF1F6" : bold ? CREAM : "#fff";
                return (
                  <tr key={k} style={{ background: rowBg, borderTop: `1px solid ${LINE}` }}>
                    <td style={{
                      position: "sticky", left: 0, zIndex: 1, padding: "8px 14px", fontFamily: SANS,
                      fontWeight: bold ? 700 : 500, color: NAVY, background: rowBg, whiteSpace: "nowrap",
                    }}>
                      {LINE_LABELS[k]}
                    </td>
                    {filiais.map((f) => {
                      const v = (matriz[f] && matriz[f][k]) || 0;
                      return (
                        <td key={f} style={{ padding: "8px 12px", textAlign: "right", fontWeight: bold ? 700 : 400, color: v < 0 ? NEG : v > 0 ? POS : MUTED, whiteSpace: "nowrap" }}>
                          {fmtBRL(v)}
                        </td>
                      );
                    })}
                    <td style={{ padding: "8px 14px", textAlign: "right", fontWeight: 700, color: totalGeral[k] < 0 ? NEG : totalGeral[k] > 0 ? POS : MUTED, whiteSpace: "nowrap" }}>
                      {fmtBRL(totalGeral[k])}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ textAlign: "center", marginTop: 24, fontFamily: SANS, fontSize: 11, color: MUTED }}>
          CULTURA INGLESA · PORTAL FINANCEIRO — Comparativo de Filial (arraste pra o lado pra ver todas as unidades)
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba: Turmas — réplica da tela "Turmas" do Business Analytics oficial.
// Como o DRE não tem detalhe por turma, a Receita/Custo/Ebitda/Lucro de cada
// turma é uma ALOCAÇÃO PROPORCIONAL: valor da filial × (alunos da turma ÷
// soma de alunos de todas as turmas daquela filial no recorte escolhido).
// ---------------------------------------------------------------------------
function BarraComClique({ dados, maxItens, corBarra, formatador, calculoFn }) {
  const [aberto, setAberto] = useState(null);
  const itens = dados.slice(0, maxItens);
  const maxAbs = Math.max(1, ...itens.map((d) => Math.abs(d.valor)));
  return (
    <div>
      {itens.map((d, i) => (
        <div key={d.label + i} style={{ marginBottom: 7, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 150, fontFamily: MONO, fontSize: 10.5, color: INK, textAlign: "right", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {d.label}
            </div>
            <div
              style={{ flex: 1, background: "#EEECE6", borderRadius: 4, height: 16, position: "relative", cursor: "pointer" }}
              onClick={() => setAberto(aberto === i ? null : i)}
            >
              <div style={{ width: `${(Math.abs(d.valor) / maxAbs) * 100}%`, background: corBarra || NAVY, height: "100%", borderRadius: 4 }} />
            </div>
            <div style={{ width: 70, fontFamily: MONO, fontSize: 10.5, color: INK, flexShrink: 0, textAlign: "right" }}>
              {formatador ? formatador(d.valor) : d.valor.toLocaleString("pt-BR")}
            </div>
          </div>
          {aberto === i && calculoFn && (
            <div style={{
              marginTop: 4, marginLeft: 158, background: NAVY, color: "#fff", padding: "8px 12px", borderRadius: 8,
              fontFamily: MONO, fontSize: 11, lineHeight: 1.6, boxShadow: "0 4px 10px rgba(0,0,0,0.18)", display: "inline-block",
            }}>
              <div style={{ fontFamily: SANS, fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4, opacity: 0.8 }}>
                Como chegamos nesse número
              </div>
              {calculoFn(d)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TurmasView({ rules, toggles }) {
  const [semestre, setSemestre] = useState("Todos");
  const [mes, setMes] = useState("Todos");
  const [filial, setFilial] = useState("Todos");

  const semestreEfetivo = mes !== "Todos" ? semestreOf(mes) : (semestre !== "Todos" ? semestre : "Todos");

  const { data: baseDataCofins } = useMemo(
    () => applyRecuperacaoCofinsRule(EMBEDDED_DATA, toggles.recuperacaoReduzCofins),
    [toggles.recuperacaoReduzCofins]
  );
  const baseData = useMemo(
    () => applySgcSubstitution(baseDataCofins, SGC_DATA, toggles.sgcSubstituiFolha),
    [baseDataCofins, toggles.sgcSubstituiFolha]
  );
  const filiaisPorLinhaEfetivo = useMemo(() => {
    const base = { ...DEFAULT_FILIAIS_POR_LINHA };
    if (toggles.receitaBrutaRateada) base["01-Receita Bruta"] = ["MATRIZ"];
    if (toggles.deducoesBVRateada) base["02-Deduções da Receita"] = [...(base["02-Deduções da Receita"] || []), "BV"];
    if (toggles.marketingBVRateado) base["08-Custo Fixo"] = [...(base["08-Custo Fixo"] || []), "BV"];
    if (toggles.assistenciaPatBVRateado) base["09-Despesas"] = [...(base["09-Despesas"] || []), "BV"];
    for (const tk in TOGGLE_MATRIZ_POR_LINHA) {
      if (!toggles[tk]) continue;
      base[TOGGLE_MATRIZ_POR_LINHA[tk]] = [...(base[TOGGLE_MATRIZ_POR_LINHA[tk]] || []), "MATRIZ"];
    }
    return base;
  }, [toggles]);
  const rateioData = useMemo(() => computeRateio(baseData, ALUNOS_DATA, rules), [baseData, rules]);
  const matrizesARatear = useMemo(() => computeMatrizesARatear(baseData, mes, filiaisPorLinhaEfetivo), [baseData, mes, filiaisPorLinhaEfetivo]);

  // financeiro POR FILIAL (respeitando semestre/mes), pra depois ratear pra cada turma
  const financeiroPorFilial = useMemo(() => {
    const t = {}; // filial -> { receita, custo, ebitda, lucro }
    const seen = new Set();
    for (const r of rateioData) {
      if (mes !== "Todos" && r.data !== mes) continue;
      if (mes === "Todos" && semestre !== "Todos" && semestreOf(r.data) !== semestre) continue;
      const k = lineKey(r.dre);
      if (BOLD_LINES.has(k)) continue;
      if (!t[r.filial]) t[r.filial] = {};
      const poolDaLinha = filiaisPorLinhaEfetivo[r.dre] || [];
      if (!poolDaLinha.includes(r.filial)) t[r.filial][k] = (t[r.filial][k] || 0) + r.balancete;
      const dedupeKey = `${r.dre}|${r.data}|${r.filial}`;
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        const matrizMes = (matrizesARatear.porLinhaMes[r.dre] && matrizesARatear.porLinhaMes[r.dre][r.data]) || 0;
        t[r.filial][k] = (t[r.filial][k] || 0) + matrizMes * r.percRateio;
      }
    }
    const out = {};
    for (const f in t) {
      const l01 = t[f]["01"] || 0, l02 = t[f]["02"] || 0, l04 = t[f]["04"] || 0, l08 = t[f]["08"] || 0, l09 = t[f]["09"] || 0, l11 = t[f]["11"] || 0;
      const l10 = (l01 + l02) + l04 + l08 + l09;
      out[f] = { receita: l01, custo: l04 + l08 + l09, ebitda: l10, lucro: l10 + l11 };
    }
    return out;
  }, [rateioData, matrizesARatear, filiaisPorLinhaEfetivo, semestre, mes]);

  // turmas filtradas por semestre/filial (mes vira semestre automaticamente)
  const turmasFiltradas = useMemo(() => {
    return TURMAS_COMPLETO.filter((t) => {
      if (filial !== "Todos" && t.filial !== filial) return false;
      if (semestreEfetivo !== "Todos" && t.semestre !== semestreEfetivo) return false;
      return true;
    });
  }, [filial, semestreEfetivo]);

  // soma de alunos por filial dentro do recorte (base do rateio proporcional)
  const alunosPorFilialNoRecorte = useMemo(() => {
    const t = {};
    for (const tm of turmasFiltradas) t[tm.filial] = (t[tm.filial] || 0) + tm.alunos;
    return t;
  }, [turmasFiltradas]);

  // aloca receita/custo/ebitda/lucro pra cada turma, proporcional ao peso de alunos dela na filial
  const turmasComFinanceiro = useMemo(() => {
    return turmasFiltradas.map((tm) => {
      const fin = financeiroPorFilial[tm.filial] || { receita: 0, custo: 0, ebitda: 0, lucro: 0 };
      const totalAlunosFilial = alunosPorFilialNoRecorte[tm.filial] || 1;
      const peso = tm.alunos / totalAlunosFilial;
      return {
        ...tm,
        receita: fin.receita * peso,
        custo: fin.custo * peso,
        ebitda: fin.ebitda * peso,
        lucro: fin.lucro * peso,
        custoPorAluno: tm.alunos > 0 ? (fin.custo * peso) / tm.alunos : 0,
        totalAlunosFilial, finFilial: fin, peso,
      };
    });
  }, [turmasFiltradas, financeiroPorFilial, alunosPorFilialNoRecorte]);

  const numeroTurmas = turmasFiltradas.length;
  const somaReceita = turmasComFinanceiro.reduce((s, t) => s + t.receita, 0);
  const somaCusto = turmasComFinanceiro.reduce((s, t) => s + t.custo, 0);
  const somaEbitda = turmasComFinanceiro.reduce((s, t) => s + t.ebitda, 0);
  const somaLucro = turmasComFinanceiro.reduce((s, t) => s + t.lucro, 0);
  const receitaPorTurma = numeroTurmas > 0 ? somaReceita / numeroTurmas : 0;
  const custoPorTurmaMedia = numeroTurmas > 0 ? somaCusto / numeroTurmas : 0;
  const ebitdaPorTurma = numeroTurmas > 0 ? somaEbitda / numeroTurmas : 0;
  const lucroPorTurma = numeroTurmas > 0 ? somaLucro / numeroTurmas : 0;

  const custoAlunoPorTurmaChart = useMemo(() =>
    [...turmasComFinanceiro].sort((a, b) => a.custoPorAluno - b.custoPorAluno).slice(0, 14)
      .map((t) => ({ label: t.token, valor: round2(t.custoPorAluno), _t: t })),
    [turmasComFinanceiro]
  );
  const alunosPorTurmaChart = useMemo(() =>
    [...turmasComFinanceiro].sort((a, b) => b.alunos - a.alunos).slice(0, 14)
      .map((t) => ({ label: t.token, valor: t.alunos, _t: t })),
    [turmasComFinanceiro]
  );
  const custoPorTurmaChart = useMemo(() =>
    [...turmasComFinanceiro].sort((a, b) => a.custo - b.custo).slice(0, 14)
      .map((t) => ({ label: t.token, valor: round2(t.custo), _t: t })),
    [turmasComFinanceiro]
  );
  const receitaCustoChart = useMemo(() =>
    [...turmasComFinanceiro].sort((a, b) => b.receita - a.receita).slice(0, 12)
      .map((t) => ({ label: t.token, receita: round2(t.receita), custo: round2(t.custo), _t: t })),
    [turmasComFinanceiro]
  );

  const meses = useMemo(() => Array.from(new Set(ALUNOS_DATA.map((a) => a.data))).sort((a, b) => monthSortKey(a) - monthSortKey(b)), []);
  const filiais = useMemo(() => Array.from(new Set(TURMAS_COMPLETO.map((t) => t.filial))).sort(), []);
  const semestreOptions = [{ value: "Todos", label: "Todos" }, { value: "1º Semestre", label: "1º Semestre" }, { value: "2º Semestre", label: "2º Semestre" }];
  const mesOptions = [{ value: "Todos", label: "Todos" }, ...meses.map((m) => ({ value: m, label: m }))];
  const filialOptions = [{ value: "Todos", label: "Todos" }, ...filiais.map((f) => ({ value: f, label: filialLabel(f) }))];

  const [hoverCard, setHoverCard] = useState(null);
  const CardLat = ({ id, label, valor, cor, calculo }) => (
    <div
      style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: "14px 16px", position: "relative", cursor: calculo ? "pointer" : "default" }}
      onClick={() => setHoverCard(hoverCard === id ? null : id)}
    >
      <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontFamily: SERIF, fontSize: 22, color: cor || NAVY, marginTop: 4 }}>{valor}</div>
      {calculo && hoverCard === id && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 20, minWidth: 260,
          background: NAVY, color: "#fff", padding: "10px 12px", borderRadius: 8,
          fontFamily: MONO, fontSize: 11.5, lineHeight: 1.5, boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        }}>
          <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4, opacity: 0.8 }}>Como chegamos nesse número</div>
          {calculo}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: "100%", background: CREAM, fontFamily: SANS, color: INK }}>
      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "28px 20px 60px" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: 1.6, color: RED, textTransform: "uppercase" }}>
            Portal Financeiro
          </div>
          <h1 style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 400, color: NAVY, margin: "4px 0 0" }}>Turmas</h1>
          <p style={{ fontFamily: SANS, fontSize: 13, color: MUTED, marginTop: 6, maxWidth: 700 }}>
            Receita, Custo, Ebitda e Lucro por turma são uma <strong>alocação proporcional</strong>: o valor da filial (do DRE) é dividido
            entre as turmas dela, na proporção do número de alunos de cada turma — o DRE não tem detalhe por turma, então essa é a melhor
            estimativa possível. Clique nas barras ou nos cartões pra ver a conta exata.
          </p>
        </div>

        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", background: CARD, border: `1px solid ${LINE}`, borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
          <div>
            <FilterLabel>Semestre</FilterLabel>
            <Select value={semestre} onChange={(v) => { setSemestre(v); setMes("Todos"); }} options={semestreOptions} />
          </div>
          <div>
            <FilterLabel>Mês</FilterLabel>
            <Select value={mes} onChange={setMes} options={mesOptions} />
          </div>
          <div>
            <FilterLabel>Filial</FilterLabel>
            <Select value={filial} onChange={setFilial} options={filialOptions} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 230, flexShrink: 0 }}>
            <CardLat
              id="turmas" label="Número de Turmas" valor={numeroTurmas.toLocaleString("pt-BR")}
              calculo={<>Turmas distintas no recorte selecionado{filial !== "Todos" ? ` (${filialLabel(filial)})` : " (todas as filiais)"}{semestreEfetivo !== "Todos" ? `, ${semestreEfetivo}` : ", ano completo"}.</>}
            />
            <CardLat
              id="receita" label="Receita Bruta por Turma" valor={fmtBRL(round2(receitaPorTurma))}
              calculo={<>Receita total alocada às turmas: {fmtBRL(round2(somaReceita))}<br />÷ Número de Turmas: {numeroTurmas.toLocaleString("pt-BR")}<br />= {fmtBRL(round2(receitaPorTurma))}</>}
            />
            <CardLat
              id="custo" label="Despesas/Custos por Turma" valor={fmtBRL(round2(custoPorTurmaMedia))} cor={NEG}
              calculo={<>Custo total alocado às turmas: {fmtBRL(round2(somaCusto))}<br />÷ Número de Turmas: {numeroTurmas.toLocaleString("pt-BR")}<br />= {fmtBRL(round2(custoPorTurmaMedia))}</>}
            />
            <CardLat
              id="ebitda" label="Ebitda por Turma" valor={fmtBRL(round2(ebitdaPorTurma))}
              calculo={<>Ebitda total alocado às turmas: {fmtBRL(round2(somaEbitda))}<br />÷ Número de Turmas: {numeroTurmas.toLocaleString("pt-BR")}<br />= {fmtBRL(round2(ebitdaPorTurma))}</>}
            />
            <CardLat
              id="lucro" label="Lucro Líquido por Turma" valor={fmtBRL(round2(lucroPorTurma))}
              calculo={<>Lucro Líquido total alocado às turmas: {fmtBRL(round2(somaLucro))}<br />÷ Número de Turmas: {numeroTurmas.toLocaleString("pt-BR")}<br />= {fmtBRL(round2(lucroPorTurma))}</>}
            />
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 460px", background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: 18 }}>
                <h2 style={{ fontFamily: SERIF, fontSize: 16, color: NAVY, margin: "0 0 12px" }}>Custo Aluno por Turma <span style={{ fontSize: 10.5, color: MUTED, fontWeight: 400 }}>(as 14 mais caras)</span></h2>
                <BarraComClique
                  dados={custoAlunoPorTurmaChart} maxItens={14} corBarra={RED} formatador={(v) => fmtBRL(v)}
                  calculoFn={(d) => {
                    const t = d._t;
                    return <>Custo da turma: {fmtBRL(round2(t.custo))}<br />÷ Alunos da turma: {t.alunos}<br />= {fmtBRL(round2(t.custoPorAluno))} por aluno<br /><span style={{ opacity: 0.7 }}>(custo da turma = custo de {filialLabel(t.filial)} × {t.alunos}/{t.totalAlunosFilial} alunos)</span></>;
                  }}
                />
              </div>
              <div style={{ flex: "1 1 460px", background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: 18 }}>
                <h2 style={{ fontFamily: SERIF, fontSize: 16, color: NAVY, margin: "0 0 12px" }}>Alunos por Turma <span style={{ fontSize: 10.5, color: MUTED, fontWeight: 400 }}>(as 14 maiores)</span></h2>
                <BarraComClique
                  dados={alunosPorTurmaChart} maxItens={14} corBarra={NAVY}
                  calculoFn={(d) => {
                    const t = d._t;
                    return <>Curso: {t.curso}<br />Filial: {filialLabel(t.filial)}<br />Alunos distintos na turma: {t.alunos}</>;
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 460px", background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: 18 }}>
                <h2 style={{ fontFamily: SERIF, fontSize: 16, color: NAVY, margin: "0 0 12px" }}>Custo por Turma <span style={{ fontSize: 10.5, color: MUTED, fontWeight: 400 }}>(as 14 mais caras, total)</span></h2>
                <BarraComClique
                  dados={custoPorTurmaChart} maxItens={14} corBarra={RED} formatador={(v) => fmtBRL(v)}
                  calculoFn={(d) => {
                    const t = d._t;
                    return <>Custo de {filialLabel(t.filial)} no recorte: {fmtBRL(round2(t.finFilial.custo))}<br />× peso da turma: {t.alunos}/{t.totalAlunosFilial} alunos ({(t.peso * 100).toFixed(2)}%)<br />= {fmtBRL(round2(t.custo))}</>;
                  }}
                />
              </div>
              <div style={{ flex: "1 1 460px", background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: 18 }}>
                <h2 style={{ fontFamily: SERIF, fontSize: 16, color: NAVY, margin: "0 0 12px" }}>Receita × Custo <span style={{ fontSize: 10.5, color: MUTED, fontWeight: 400 }}>(top 12 por receita)</span></h2>
                <div>
                  {receitaCustoChart.map((d, i) => {
                    const maxAbs = Math.max(1, ...receitaCustoChart.map((x) => Math.max(Math.abs(x.receita), Math.abs(x.custo))));
                    return (
                      <div key={d.label + i} style={{ marginBottom: 8 }}>
                        <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, marginBottom: 2 }}>{d.label}</div>
                        <div style={{ display: "flex", height: 12, gap: 1 }}>
                          <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
                            <div style={{ width: `${(Math.abs(d.custo) / maxAbs) * 100}%`, background: RED, borderRadius: "3px 0 0 3px" }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ width: `${(d.receita / maxAbs) * 100}%`, background: "#1F8A70", borderRadius: "0 3px 3px 0" }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ display: "flex", gap: 16, fontFamily: SANS, fontSize: 11, marginTop: 8 }}>
                    <span><span style={{ display: "inline-block", width: 9, height: 9, background: "#1F8A70", borderRadius: 2, marginRight: 5 }} />Receita</span>
                    <span><span style={{ display: "inline-block", width: 9, height: 9, background: RED, borderRadius: 2, marginRight: 5 }} />Custo</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{
          display: "flex", gap: 8, alignItems: "flex-start",
          background: "#FFF6DA", border: "1px solid #E9CD6E", borderRadius: 8,
          padding: "10px 12px", marginTop: 20, fontFamily: SANS, fontSize: 12, color: "#5C4A00",
        }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Todos os valores por turma são estimados por alocação proporcional (não vêm direto do DRE, que só tem detalhe por filial).
            Clique em qualquer barra ou cartão pra ver a fórmula usada.
          </span>
        </div>
      </div>
    </div>
  );
}

function CursosTurmasView() {
  const [mes, setMes] = useState("Todos");
  const [filial, setFilial] = useState("Todos");
  const [hoverTipo, setHoverTipo] = useState(null);

  const meses = useMemo(() => CURSOS_REDE_POR_MES.map((r) => r.data).sort((a, b) => {
    const ka = monthSortKey(a), kb = monthSortKey(b);
    return (typeof ka === "number" && typeof kb === "number") ? ka - kb : String(a).localeCompare(String(b));
  }), []);
  const filiais = useMemo(() => Array.from(new Set(CURSOS_POR_FILIAL_ANO.map((r) => r.filial))).sort(), []);

  // Escolhe a fonte certa pra evitar duplicar turmas/cursos ao somar meses ou filiais:
  // - Filial específica + Mês específico -> linha exata em CURSOS_POR_FM
  // - Filial específica + Todos os meses -> linha anual (distinta) em CURSOS_POR_FILIAL_ANO
  // - Todas as filiais + Mês específico  -> linha da rede (distinta) em CURSOS_REDE_POR_MES
  // - Todas as filiais + Todos os meses  -> CURSOS_REDE_ANO
  const resumo = useMemo(() => {
    if (filial !== "Todos" && mes !== "Todos") {
      return CURSOS_POR_FM.find((r) => r.filial === filial && r.data === mes) || { turmas: 0, cursos: 0, matriculasArquivo: 0, novato: 0, rematriculado: 0, recuperado: 0 };
    }
    if (filial !== "Todos" && mes === "Todos") {
      return CURSOS_POR_FILIAL_ANO.find((r) => r.filial === filial) || { turmas: 0, cursos: 0, matriculasArquivo: 0, novato: 0, rematriculado: 0, recuperado: 0 };
    }
    if (filial === "Todos" && mes !== "Todos") {
      return CURSOS_REDE_POR_MES.find((r) => r.data === mes) || { turmas: 0, cursos: 0, matriculasArquivo: 0, novato: 0, rematriculado: 0, recuperado: 0 };
    }
    return CURSOS_REDE_ANO;
  }, [filial, mes]);

  // Alunos: SEMPRE do DRE (ALUNOS_DATA), nunca do arquivo de turmas/cursos
  const alunosDre = useMemo(() => {
    let rows = ALUNOS_DATA;
    if (filial !== "Todos") rows = rows.filter((a) => a.filial === filial);
    if (mes !== "Todos") rows = rows.filter((a) => a.data === mes);
    if (mes === "Todos" && filial !== "Todos") {
      // media mensal do ano pra essa filial, pra nao somar 12 meses de alunos matriculados
      const porMes = {};
      for (const a of rows) porMes[a.data] = (porMes[a.data] || 0) + a.alunos;
      const valores = Object.values(porMes);
      return valores.length ? Math.round(valores.reduce((s, v) => s + v, 0) / valores.length) : 0;
    }
    if (mes === "Todos" && filial === "Todos") {
      const porMes = {};
      for (const a of rows) porMes[a.data] = (porMes[a.data] || 0) + a.alunos;
      const valores = Object.values(porMes);
      return valores.length ? Math.round(valores.reduce((s, v) => s + v, 0) / valores.length) : 0;
    }
    return rows.reduce((s, a) => s + a.alunos, 0);
  }, [filial, mes]);

  const mediaAlunosPorTurma = resumo.turmas > 0 ? (alunosDre / resumo.turmas) : 0;
  const totalTipos = (resumo.novato || 0) + (resumo.rematriculado || 0) + (resumo.recuperado || 0);
  const pctNovato = totalTipos ? (resumo.novato / totalTipos) * 100 : 0;
  const pctRematriculado = totalTipos ? (resumo.rematriculado / totalTipos) * 100 : 0;
  const pctRecuperado = totalTipos ? (resumo.recuperado / totalTipos) * 100 : 0;

  // Comparativo por filial (respeitando o filtro de mês)
  const comparativoFiliais = useMemo(() => {
    const fonte = mes === "Todos" ? CURSOS_POR_FILIAL_ANO : CURSOS_POR_FM.filter((r) => r.data === mes);
    return [...fonte].sort((a, b) => b.turmas - a.turmas);
  }, [mes]);

  // Ranking de cursos — o arquivo é anual, então esse ranking não muda com o filtro de mês/filial
  // (mantém como visão do ano inteiro, deixado claro no rótulo)
  const topCursos = useMemo(() => [...CURSOS_RANKING].sort((a, b) => b.alunos - a.alunos).slice(0, 12), []);

  const mesOptions = [{ value: "Todos", label: "Todos" }, ...meses.map((m) => ({ value: m, label: m }))];
  const filialOptions = [{ value: "Todos", label: "Todos" }, ...filiais.map((f) => ({ value: f, label: filialLabel(f) }))];

  return (
    <div style={{ minHeight: "100%", background: CREAM, fontFamily: SANS, color: INK }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px 60px" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: 1.6, color: RED, textTransform: "uppercase" }}>
            Portal Financeiro
          </div>
          <h1 style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 400, color: NAVY, margin: "4px 0 0" }}>Cursos e Turmas</h1>
          <p style={{ fontFamily: SANS, fontSize: 13, color: MUTED, marginTop: 6, maxWidth: 640 }}>
            Indicadores de turmas e cursos por filial e mês. O número de alunos usado aqui é sempre o mesmo do DRE —
            o arquivo de turmas só entra com turmas, cursos e matrículas.
          </p>
        </div>

        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", background: CARD, border: `1px solid ${LINE}`, borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
          <div>
            <FilterLabel>Mês</FilterLabel>
            <Select value={mes} onChange={setMes} options={mesOptions} />
          </div>
          <div>
            <FilterLabel>Filial</FilterLabel>
            <Select value={filial} onChange={setFilial} options={filialOptions} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
          <StatCard label="Turmas" valor={resumo.turmas.toLocaleString("pt-BR")} sub={mes === "Todos" ? "IDs distintos no ano (conta turmas dos 2 semestres separado)" : "ativas no mês"} />
          <StatCard label="Cursos oferecidos" valor={resumo.cursos.toLocaleString("pt-BR")} sub={mes === "Todos" ? "distintos no ano" : "no mês"} />
          <StatCard
            label="Alunos por turma"
            valor={mediaAlunosPorTurma.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
            sub={`${alunosDre.toLocaleString("pt-BR")} alunos (DRE) ÷ ${resumo.turmas.toLocaleString("pt-BR")} turmas`}
            cor={RED}
          />
          <StatCard label="Matrículas no arquivo" valor={resumo.matriculasArquivo.toLocaleString("pt-BR")} sub="referência do arquivo de turmas" />
        </div>

        {mes === "Todos" && (
          <div style={{
            display: "flex", gap: 8, alignItems: "flex-start",
            background: "#FFF6DA", border: "1px solid #E9CD6E", borderRadius: 8,
            padding: "10px 12px", marginBottom: 20, fontFamily: SANS, fontSize: 12, color: "#5C4A00",
          }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Com "Mês: Todos", o número de turmas soma os IDs distintos do ano inteiro — como a turma troca de identificador
              entre o 1º e o 2º semestre, a mesma turma física pode contar duas vezes, e a média de alunos por turma fica menor
              que a real. Para ver o número exato de turmas simultâneas e a média real, escolha um mês específico no filtro.
            </span>
          </div>
        )}

        <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: "18px 20px", marginBottom: 24 }}>
          <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 12 }}>
            Novato × Rematriculado × Recuperado
          </div>
          <div style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", marginBottom: 10, position: "relative" }}>
            <div
              style={{ width: `${pctNovato}%`, background: RED, cursor: "pointer" }}
              onMouseEnter={() => setHoverTipo("novato")}
              onMouseLeave={() => setHoverTipo(null)}
            />
            <div
              style={{ width: `${pctRematriculado}%`, background: NAVY, cursor: "pointer" }}
              onMouseEnter={() => setHoverTipo("rematriculado")}
              onMouseLeave={() => setHoverTipo(null)}
            />
            <div
              style={{ width: `${pctRecuperado}%`, background: "#8A6D00", cursor: "pointer" }}
              onMouseEnter={() => setHoverTipo("recuperado")}
              onMouseLeave={() => setHoverTipo(null)}
            />
            {hoverTipo && (
              <div style={{
                position: "absolute", bottom: "calc(100% + 6px)",
                left: hoverTipo === "novato" ? `${pctNovato / 2}%` : hoverTipo === "rematriculado" ? `${pctNovato + pctRematriculado / 2}%` : `${pctNovato + pctRematriculado + pctRecuperado / 2}%`,
                transform: "translateX(-50%)", zIndex: 10,
                background: NAVY, color: "#fff", padding: "6px 10px", borderRadius: 6,
                fontFamily: SANS, fontSize: 11.5, whiteSpace: "nowrap", boxShadow: "0 4px 10px rgba(0,0,0,0.18)",
              }}>
                {hoverTipo === "novato" && <span>Novato: {pctNovato.toFixed(1)}% ({(resumo.novato || 0).toLocaleString("pt-BR")} alunos)</span>}
                {hoverTipo === "rematriculado" && <span>Rematriculado: {pctRematriculado.toFixed(1)}% ({(resumo.rematriculado || 0).toLocaleString("pt-BR")} alunos)</span>}
                {hoverTipo === "recuperado" && <span>Recuperado: {pctRecuperado.toFixed(1)}% ({(resumo.recuperado || 0).toLocaleString("pt-BR")} alunos)</span>}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontFamily: SANS, fontSize: 12.5 }}>
            <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 999, background: RED, marginRight: 6 }} />Novato: {pctNovato.toFixed(1)}% ({(resumo.novato || 0).toLocaleString("pt-BR")})</span>
            <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 999, background: NAVY, marginRight: 6 }} />Rematriculado: {pctRematriculado.toFixed(1)}% ({(resumo.rematriculado || 0).toLocaleString("pt-BR")})</span>
            <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 999, background: "#8A6D00", marginRight: 6 }} />Recuperado: {pctRecuperado.toFixed(1)}% ({(resumo.recuperado || 0).toLocaleString("pt-BR")})</span>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 20, color: NAVY, margin: "0 0 12px" }}>Comparativo por filial {mes !== "Todos" ? `— ${mes}` : "— ano completo"}</h2>
          <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: MONO, fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "10px 14px", background: NAVY, color: "#fff", fontFamily: SANS, fontSize: 11.5, fontWeight: 700 }}>Filial</th>
                  <th style={{ textAlign: "right", padding: "10px 14px", background: NAVY, color: "#fff", fontFamily: SANS, fontSize: 11.5, fontWeight: 700 }}>Turmas</th>
                  <th style={{ textAlign: "right", padding: "10px 14px", background: NAVY, color: "#fff", fontFamily: SANS, fontSize: 11.5, fontWeight: 700 }}>Cursos</th>
                  <th style={{ textAlign: "right", padding: "10px 14px", background: NAVY, color: "#fff", fontFamily: SANS, fontSize: 11.5, fontWeight: 700 }}>Alunos (DRE)</th>
                  <th style={{ textAlign: "right", padding: "10px 14px", background: NAVY, color: "#fff", fontFamily: SANS, fontSize: 11.5, fontWeight: 700 }}>Alunos/Turma</th>
                </tr>
              </thead>
              <tbody>
                {comparativoFiliais.map((r) => {
                  let alunosF;
                  if (mes === "Todos") {
                    const porMes = {};
                    for (const a of ALUNOS_DATA.filter((a) => a.filial === r.filial)) porMes[a.data] = (porMes[a.data] || 0) + a.alunos;
                    const valores = Object.values(porMes);
                    alunosF = valores.length ? Math.round(valores.reduce((s, v) => s + v, 0) / valores.length) : 0;
                  } else {
                    alunosF = ALUNOS_DATA.filter((a) => a.filial === r.filial && a.data === mes).reduce((s, a) => s + a.alunos, 0);
                  }
                  const media = r.turmas > 0 ? alunosF / r.turmas : 0;
                  return (
                    <tr key={r.filial} style={{ borderTop: `1px solid ${LINE}` }}>
                      <td style={{ padding: "8px 14px", fontFamily: SANS }}>{filialLabel(r.filial)}</td>
                      <td style={{ padding: "8px 14px", textAlign: "right" }}>{r.turmas}</td>
                      <td style={{ padding: "8px 14px", textAlign: "right" }}>{r.cursos}</td>
                      <td style={{ padding: "8px 14px", textAlign: "right" }}>{alunosF.toLocaleString("pt-BR")}</td>
                      <td style={{ padding: "8px 14px", textAlign: "right", fontWeight: 700, color: RED }}>{media.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 style={{ fontFamily: SERIF, fontSize: 20, color: NAVY, margin: "0 0 4px" }}>Cursos mais procurados</h2>
          <p style={{ fontFamily: SANS, fontSize: 12, color: MUTED, marginTop: 0, marginBottom: 12 }}>Ano completo 2025, rede toda (esse ranking não muda com os filtros acima).</p>
          <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: MONO, fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "10px 14px", background: NAVY, color: "#fff", fontFamily: SANS, fontSize: 11.5, fontWeight: 700 }}>Curso</th>
                  <th style={{ textAlign: "right", padding: "10px 14px", background: NAVY, color: "#fff", fontFamily: SANS, fontSize: 11.5, fontWeight: 700 }}>Alunos</th>
                  <th style={{ textAlign: "right", padding: "10px 14px", background: NAVY, color: "#fff", fontFamily: SANS, fontSize: 11.5, fontWeight: 700 }}>Turmas</th>
                  <th style={{ textAlign: "right", padding: "10px 14px", background: NAVY, color: "#fff", fontFamily: SANS, fontSize: 11.5, fontWeight: 700 }}>Filiais</th>
                </tr>
              </thead>
              <tbody>
                {topCursos.map((c, i) => (
                  <tr key={c.curso} style={{ borderTop: `1px solid ${LINE}`, background: i < 3 ? "#FFF6DA" : "transparent" }}>
                    <td style={{ padding: "8px 14px", fontFamily: SANS }}>
                      <span style={{ color: MUTED, marginRight: 8 }}>{i + 1}.</span>{c.curso}
                    </td>
                    <td style={{ padding: "8px 14px", textAlign: "right", fontWeight: 700 }}>{c.alunos.toLocaleString("pt-BR")}</td>
                    <td style={{ padding: "8px 14px", textAlign: "right" }}>{c.turmas}</td>
                    <td style={{ padding: "8px 14px", textAlign: "right" }}>{c.filiais}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 24, fontFamily: SANS, fontSize: 11, color: MUTED }}>
          CULTURA INGLESA · PORTAL FINANCEIRO — Cursos e Turmas (base: arquivo de turmas/cursos importado; alunos: DRE)
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba: Alunos — cruza os valores financeiros do DRE com os dados de
// turmas/cursos/filiais, no estilo do painel "Business Analytics" oficial.
// ---------------------------------------------------------------------------
function BarrasHorizontais({ dados, maxItens = 8, corBarra }) {
  const [hover, setHover] = useState(null);
  const itens = dados.slice(0, maxItens);
  const max = Math.max(1, ...itens.map((d) => d.valor));
  const total = itens.reduce((s, d) => s + d.valor, 0);
  return (
    <div>
      {itens.map((d, i) => {
        const pct = total > 0 ? (d.valor / total) * 100 : 0;
        return (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, position: "relative" }}>
            <div style={{ width: 130, fontFamily: SANS, fontSize: 11.5, color: INK, textAlign: "right", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {d.label}
            </div>
            <div
              style={{ flex: 1, background: "#EEECE6", borderRadius: 4, height: 16, position: "relative", cursor: "pointer" }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div style={{ width: `${(d.valor / max) * 100}%`, background: corBarra || NAVY, height: "100%", borderRadius: 4 }} />
              {hover === i && (
                <div style={{
                  position: "absolute", bottom: "calc(100% + 6px)", left: 0, zIndex: 10,
                  background: NAVY, color: "#fff", padding: "6px 10px", borderRadius: 6,
                  fontFamily: SANS, fontSize: 11.5, whiteSpace: "nowrap", boxShadow: "0 4px 10px rgba(0,0,0,0.18)",
                }}>
                  <strong>{d.label}</strong>: {d.valor.toLocaleString("pt-BR")} ({pct.toFixed(1)}% do exibido)
                  <div style={{ position: "absolute", top: "100%", left: 14, width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: `5px solid ${NAVY}` }} />
                </div>
              )}
            </div>
            <div style={{ width: 52, fontFamily: MONO, fontSize: 11.5, color: INK, flexShrink: 0 }}>{d.valor.toLocaleString("pt-BR")}</div>
          </div>
        );
      })}
    </div>
  );
}

function SparklineAlunos({ pontos }) {
  const [hover, setHover] = useState(null);
  const w = 640, h = 130, pad = 8;
  const max = Math.max(...pontos.map((p) => p.valor));
  const min = Math.min(...pontos.map((p) => p.valor));
  const range = Math.max(1, max - min);
  const stepX = (w - pad * 2) / Math.max(1, pontos.length - 1);
  const coords = pontos.map((p, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((p.valor - min) / range) * (h - pad * 2);
    return [x, y];
  });
  const linha = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = linha + ` L${coords[coords.length - 1][0].toFixed(1)},${h - pad} L${coords[0][0].toFixed(1)},${h - pad} Z`;
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 150, overflow: "visible" }}>
        <path d={area} fill="#EEECE6" />
        <path d={linha} fill="none" stroke={NAVY} strokeWidth="2" />
        {coords.map(([x, y], i) => (
          <circle
            key={i} cx={x} cy={y} r={hover === i ? 5 : 2.5} fill={hover === i ? RED : NAVY}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        {pontos.map((p, i) => (
          <text key={i} x={coords[i][0]} y={h - 2} fontSize="9" fill={MUTED} textAnchor="middle" fontFamily="sans-serif">
            {p.label}
          </text>
        ))}
      </svg>
      {hover !== null && (
        <div style={{
          position: "absolute",
          left: `${(coords[hover][0] / w) * 100}%`, top: `${(coords[hover][1] / h) * 100}%`,
          transform: "translate(-50%, -130%)", zIndex: 10,
          background: NAVY, color: "#fff", padding: "6px 10px", borderRadius: 6,
          fontFamily: SANS, fontSize: 11.5, whiteSpace: "nowrap", boxShadow: "0 4px 10px rgba(0,0,0,0.18)", pointerEvents: "none",
        }}>
          <strong>{pontos[hover].label}/2025</strong>: {pontos[hover].valor.toLocaleString("pt-BR")} alunos
        </div>
      )}
    </div>
  );
}

function AlunosView({ rules, toggles }) {
  const [mes, setMes] = useState("Todos");
  const [filial, setFilial] = useState("Todos");

  const { data: baseDataCofins } = useMemo(
    () => applyRecuperacaoCofinsRule(EMBEDDED_DATA, toggles.recuperacaoReduzCofins),
    [toggles.recuperacaoReduzCofins]
  );
  const baseData = useMemo(
    () => applySgcSubstitution(baseDataCofins, SGC_DATA, toggles.sgcSubstituiFolha),
    [baseDataCofins, toggles.sgcSubstituiFolha]
  );
  const filiaisPorLinhaEfetivo = useMemo(() => {
    const base = { ...DEFAULT_FILIAIS_POR_LINHA };
    if (toggles.receitaBrutaRateada) base["01-Receita Bruta"] = ["MATRIZ"];
    if (toggles.deducoesBVRateada) base["02-Deduções da Receita"] = [...(base["02-Deduções da Receita"] || []), "BV"];
    if (toggles.marketingBVRateado) base["08-Custo Fixo"] = [...(base["08-Custo Fixo"] || []), "BV"];
    if (toggles.assistenciaPatBVRateado) base["09-Despesas"] = [...(base["09-Despesas"] || []), "BV"];
    for (const tk in TOGGLE_MATRIZ_POR_LINHA) {
      if (!toggles[tk]) continue;
      const linha = TOGGLE_MATRIZ_POR_LINHA[tk];
      base[linha] = [...(base[linha] || []), "MATRIZ"];
    }
    return base;
  }, [toggles]);
  const rateioData = useMemo(() => computeRateio(baseData, ALUNOS_DATA, rules), [baseData, rules]);
  const matrizesARatear = useMemo(() => computeMatrizesARatear(baseData, mes, filiaisPorLinhaEfetivo), [baseData, mes, filiaisPorLinhaEfetivo]);

  // financeiro (mesma logica das outras abas: Balancete + fatia do pool, filtrado por filial/mes)
  const financeiro = useMemo(() => {
    const t = {};
    const seen = new Set();
    for (const r of rateioData) {
      if (filial !== "Todos" && r.filial !== filial) continue;
      if (mes !== "Todos" && r.data !== mes) continue;
      const k = lineKey(r.dre);
      if (BOLD_LINES.has(k)) continue;
      const poolDaLinha = filiaisPorLinhaEfetivo[r.dre] || [];
      if (!poolDaLinha.includes(r.filial)) t[k] = (t[k] || 0) + r.balancete;
      const dedupeKey = `${r.dre}|${r.data}|${r.filial}`;
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        const matrizMes = (matrizesARatear.porLinhaMes[r.dre] && matrizesARatear.porLinhaMes[r.dre][r.data]) || 0;
        t[k] = (t[k] || 0) + matrizMes * r.percRateio;
      }
    }
    const l01 = t["01"] || 0, l02 = t["02"] || 0, l04 = t["04"] || 0, l08 = t["08"] || 0, l09 = t["09"] || 0, l11 = t["11"] || 0;
    const l03 = l01 + l02, l06 = l03 + l04, l10 = l06 + l08 + l09, l15 = l10 + l11;
    const custoTotal = l04 + l08 + l09; // Custo Variável + Custo Fixo + Despesas
    return { receitaBruta: l01, custoTotal, ebitda: l10, lucroLiquido: l15 };
  }, [rateioData, matrizesARatear, filiaisPorLinhaEfetivo, filial, mes]);

  // volume de alunos: sempre do arquivo de turmas/cursos (distintos), cruzando com a filial do DRE
  const volume = useMemo(() => {
    if (filial !== "Todos" && mes !== "Todos") {
      const r = CURSOS_POR_FM.find((r) => r.filial === filial && r.data === mes);
      return r || { matriculasArquivo: 0, novato: 0, rematriculado: 0, recuperado: 0 };
    }
    if (filial !== "Todos" && mes === "Todos") {
      return CURSOS_POR_FILIAL_ANO.find((r) => r.filial === filial) || { matriculasArquivo: 0, novato: 0, rematriculado: 0, recuperado: 0 };
    }
    if (filial === "Todos" && mes !== "Todos") {
      return CURSOS_REDE_POR_MES.find((r) => r.data === mes) || { matriculasArquivo: 0, novato: 0, rematriculado: 0, recuperado: 0 };
    }
    return CURSOS_REDE_ANO;
  }, [filial, mes]);

  const numeroAlunos = volume.matriculasArquivo || 1;
  const receitaPorAluno = financeiro.receitaBruta / numeroAlunos;
  const custoPorAluno = financeiro.custoTotal / numeroAlunos;
  const ebitdaPorAluno = financeiro.ebitda / numeroAlunos;
  const lucroPorAluno = financeiro.lucroLiquido / numeroAlunos;
  const margemLucro = financeiro.receitaBruta !== 0 ? (financeiro.lucroLiquido / financeiro.receitaBruta) * 100 : 0;

  // alunos ativos ao longo do ano (sempre do DRE — ALUNOS_DATA)
  const alunosAtivosPorMes = useMemo(() => {
    const meses12 = Array.from(new Set(ALUNOS_DATA.map((a) => a.data))).sort((a, b) => monthSortKey(a) - monthSortKey(b));
    return meses12.map((m) => {
      let rows = ALUNOS_DATA.filter((a) => a.data === m);
      if (filial !== "Todos") rows = rows.filter((a) => a.filial === filial);
      return { label: m.split("/")[0], valor: rows.reduce((s, a) => s + a.alunos, 0) };
    });
  }, [filial]);

  // alunos por filial (do arquivo de turmas, respeitando o filtro de mes)
  const alunosPorFilial = useMemo(() => {
    const fonte = mes === "Todos" ? CURSOS_POR_FILIAL_ANO : CURSOS_POR_FM.filter((r) => r.data === mes);
    return fonte
      .map((r) => ({ label: filialLabel(r.filial), valor: r.matriculasArquivo }))
      .sort((a, b) => b.valor - a.valor);
  }, [mes]);

  const alunosPorCurso = useMemo(() => CURSOS_RANKING.map((c) => ({ label: c.curso, valor: c.alunos })), []);
  const alunosPorTurma = useMemo(() => TURMAS_RANKING.map((t) => ({ label: t.token, valor: t.alunos })), []);
  const alunosPorTipo = useMemo(() => ([
    { label: "Rematriculado", valor: volume.rematriculado || 0 },
    { label: "Novato", valor: volume.novato || 0 },
    { label: "Recuperado", valor: volume.recuperado || 0 },
  ]), [volume]);

  const meses = useMemo(() => Array.from(new Set(ALUNOS_DATA.map((a) => a.data))).sort((a, b) => monthSortKey(a) - monthSortKey(b)), []);
  const filiais = useMemo(() => Array.from(new Set(CURSOS_POR_FILIAL_ANO.map((r) => r.filial))).sort(), []);
  const mesOptions = [{ value: "Todos", label: "Todos" }, ...meses.map((m) => ({ value: m, label: m }))];
  const filialOptions = [{ value: "Todos", label: "Todos" }, ...filiais.map((f) => ({ value: f, label: filialLabel(f) }))];

  const [hoverCard, setHoverCard] = useState(null);
  const CardMini = ({ id, label, valor, cor, calculo }) => (
    <div
      style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 8, padding: "10px 14px", flex: "1 1 150px", minWidth: 140, position: "relative", cursor: calculo ? "pointer" : "default" }}
      onMouseEnter={() => calculo && setHoverCard(id)}
      onMouseLeave={() => setHoverCard(null)}
    >
      <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontFamily: SERIF, fontSize: 20, color: cor || NAVY, marginTop: 2 }}>{valor}</div>
      {calculo && hoverCard === id && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 20, minWidth: 240,
          background: NAVY, color: "#fff", padding: "10px 12px", borderRadius: 8,
          fontFamily: MONO, fontSize: 11.5, lineHeight: 1.5, boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        }}>
          <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4, opacity: 0.8 }}>Como chegamos nesse número</div>
          {calculo}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: "100%", background: CREAM, fontFamily: SANS, color: INK }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 20px 60px" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: 1.6, color: RED, textTransform: "uppercase" }}>
            Portal Financeiro
          </div>
          <h1 style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 400, color: NAVY, margin: "4px 0 0" }}>Alunos</h1>
          <p style={{ fontFamily: SANS, fontSize: 13, color: MUTED, marginTop: 6, maxWidth: 680 }}>
            Cruza os valores do DRE (com as regras ligadas na aba "Ligar/Desligar Regras") com os dados de turmas e cursos.
            O número de alunos usado nos indicadores por aluno vem do arquivo de turmas (matrículas distintas), não do DRE.
          </p>
        </div>

        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", background: CARD, border: `1px solid ${LINE}`, borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
          <div>
            <FilterLabel>Mês</FilterLabel>
            <Select value={mes} onChange={setMes} options={mesOptions} />
          </div>
          <div>
            <FilterLabel>Filial</FilterLabel>
            <Select value={filial} onChange={setFilial} options={filialOptions} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
          <div style={{ flex: "1 1 260px", background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color: RED, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 }}>Resultado Financeiro</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <CardMini label="Receita Bruta" valor={fmtBRL(round2(financeiro.receitaBruta))} />
              <CardMini label="Resultado Líquido" valor={fmtBRL(round2(financeiro.lucroLiquido))} />
              <CardMini label="Margem de Lucro" valor={`${margemLucro.toFixed(2)}%`} cor="#8A6D00" />
            </div>
          </div>
          <div style={{ flex: "1 1 340px", background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color: RED, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 }}>Indicadores por Aluno</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <CardMini
                id="receita" label="Receita Bruta / Aluno" valor={fmtBRL(round2(receitaPorAluno))}
                calculo={<>Receita Bruta: {fmtBRL(round2(financeiro.receitaBruta))}<br />÷ Número de Alunos: {numeroAlunos.toLocaleString("pt-BR")}<br />= {fmtBRL(round2(receitaPorAluno))}</>}
              />
              <CardMini
                id="custo" label="Custo / Aluno" valor={fmtBRL(round2(custoPorAluno))} cor={NEG}
                calculo={<>Custo Variável + Custo Fixo + Despesas: {fmtBRL(round2(financeiro.custoTotal))}<br />÷ Número de Alunos: {numeroAlunos.toLocaleString("pt-BR")}<br />= {fmtBRL(round2(custoPorAluno))}</>}
              />
              <CardMini
                id="ebitda" label="Ebitda / Aluno" valor={fmtBRL(round2(ebitdaPorAluno))}
                calculo={<>Ebitda (10): {fmtBRL(round2(financeiro.ebitda))}<br />÷ Número de Alunos: {numeroAlunos.toLocaleString("pt-BR")}<br />= {fmtBRL(round2(ebitdaPorAluno))}</>}
              />
              <CardMini
                id="lucro" label="Result. Líquido / Aluno" valor={fmtBRL(round2(lucroPorAluno))}
                calculo={<>Lucro Líquido (15): {fmtBRL(round2(financeiro.lucroLiquido))}<br />÷ Número de Alunos: {numeroAlunos.toLocaleString("pt-BR")}<br />= {fmtBRL(round2(lucroPorAluno))}</>}
              />
            </div>
          </div>
          <div style={{ flex: "1 1 180px", background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color: RED, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 }}>Volume</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <CardMini label="Número de Alunos" valor={numeroAlunos.toLocaleString("pt-BR")} />
            </div>
          </div>
        </div>

        <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 17, color: NAVY, margin: "0 0 8px" }}>Número de alunos ativos {filial !== "Todos" ? `— ${filialLabel(filial)}` : "— rede toda"}</h2>
          <SparklineAlunos pontos={alunosAtivosPorMes} />
        </div>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
          <div style={{ flex: "1 1 460px", background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: 18 }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 17, color: NAVY, margin: "0 0 12px" }}>Alunos por filial</h2>
            <BarrasHorizontais dados={alunosPorFilial} maxItens={8} corBarra={NAVY} />
          </div>
          <div style={{ flex: "1 1 460px", background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: 18 }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 17, color: NAVY, margin: "0 0 12px" }}>Alunos por curso <span style={{ fontSize: 11, color: MUTED, fontWeight: 400 }}>(ano completo)</span></h2>
            <BarrasHorizontais dados={alunosPorCurso} maxItens={8} corBarra={RED} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 460px", background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: 18 }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 17, color: NAVY, margin: "0 0 12px" }}>Alunos por turma <span style={{ fontSize: 11, color: MUTED, fontWeight: 400 }}>(top 8, ano completo)</span></h2>
            <BarrasHorizontais dados={alunosPorTurma} maxItens={8} corBarra="#8A6D00" />
          </div>
          <div style={{ flex: "1 1 460px", background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: 18 }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 17, color: NAVY, margin: "0 0 12px" }}>Alunos por tipo</h2>
            <BarrasHorizontais dados={alunosPorTipo} maxItens={3} corBarra={NAVY} />
          </div>
        </div>

        <div style={{
          display: "flex", gap: 8, alignItems: "flex-start",
          background: "#FFF6DA", border: "1px solid #E9CD6E", borderRadius: 8,
          padding: "10px 12px", marginTop: 20, fontFamily: SANS, fontSize: 12, color: "#5C4A00",
        }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Os valores desta aba cruzam duas fontes: o financeiro vem do DRE (com as regras ligadas hoje), e turmas/cursos/matrículas
            vêm do arquivo de turmas importado. Por isso os números de alunos aqui podem variar um pouco (1 a 5%) dos números "oficiais"
            do painel Business Analytics — a diferença normalmente é só uma questão de data de corte entre as duas fontes.
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App com abas (DRE Contábil / DRE Rateio / Regras de Rateio)
// ---------------------------------------------------------------------------
function App() {
  const [tab, setTab] = useState("contabil");
  const [rateioRules] = useState(DEFAULT_RATEIO_RULES);
  const [ruleToggles, setRuleToggles] = useState(DEFAULT_RULE_TOGGLES);

  const tabBtn = (id, label) => (
    <button
      onClick={() => setTab(id)}
      style={{
        padding: "10px 18px",
        borderRadius: "8px 8px 0 0",
        border: "none",
        borderBottom: tab === id ? `3px solid ${RED}` : `3px solid transparent`,
        background: tab === id ? "#fff" : "transparent",
        color: tab === id ? NAVY : MUTED,
        fontFamily: SANS,
        fontSize: 13.5,
        fontWeight: tab === id ? 700 : 500,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ minHeight: "100%", background: CREAM }}>
      <div style={{ display: "flex", gap: 4, padding: "10px 20px 0", background: CREAM, borderBottom: `1px solid ${LINE}`, flexWrap: "wrap" }}>
        {tabBtn("contabil", "DRE Contábil")}
        {tabBtn("rateio", "DRE Rateio")}
        {tabBtn("comparativo", "Comparativo de Filial")}
        {tabBtn("alunos", "Alunos")}
        {tabBtn("turmas", "Turmas")}
        {tabBtn("cursos", "Cursos e Turmas")}
        {tabBtn("toggles", "Ligar/Desligar Regras")}
      </div>
      <div style={{ display: tab === "contabil" ? "block" : "none" }}>
        <DreView key="contabil" title="DRE Contábil" />
      </div>
      <div style={{ display: tab === "rateio" ? "block" : "none" }}>
        <RateioView key="rateio" rules={rateioRules} toggles={ruleToggles} />
      </div>
      <div style={{ display: tab === "comparativo" ? "block" : "none" }}>
        <ComparativoFilialView key="comparativo" rules={rateioRules} toggles={ruleToggles} />
      </div>
      <div style={{ display: tab === "alunos" ? "block" : "none" }}>
        <AlunosView key="alunos" rules={rateioRules} toggles={ruleToggles} />
      </div>
      <div style={{ display: tab === "turmas" ? "block" : "none" }}>
        <TurmasView key="turmas" rules={rateioRules} toggles={ruleToggles} />
      </div>
      <div style={{ display: tab === "cursos" ? "block" : "none" }}>
        <CursosTurmasView key="cursos" />
      </div>
      <div style={{ display: tab === "toggles" ? "block" : "none" }}>
        <TogglesView key="toggles" toggles={ruleToggles} setToggles={setRuleToggles} />
      </div>
    </div>
  );
}

return App;
}
