import { useState, useEffect, useRef } from "react";
import FocusIntervals, { mmss } from "./FocusIntervals.jsx";
import { VoiceRecorder, VoicePlayer, deleteRecording } from "./VoiceRecorder.jsx";

const CONTEXTS = ["📥 Inbox", "🏠 Maison", "💼 Travail BTP", "🔒 Vie privée", "📞 Appels", "🛒 Courses", "🌴 Guadeloupe", "📚 Lecture"];
const PRIVATE_CONTEXT = "🔒 Vie privée";
const STATUSES = ["À traiter", "En cours", "Délégué", "Terminé"];
const STATUS_COLORS = {
  "À traiter": { bg: "#FFF3CD", text: "#856404", dot: "#FFC107" },
  "En cours":  { bg: "#D1ECF1", text: "#0C5460", dot: "#17A2B8" },
  "Délégué":   { bg: "#E2D9F3", text: "#563D7C", dot: "#6F42C1" },
  "Terminé":   { bg: "#D4EDDA", text: "#155724", dot: "#28A745" },
};
const STORAGE_KEY = "gtd_tasks_norbert";

function loadTasks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveTasks(tasks) { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }

export default function GTDApp() {
  const [tab, setTab] = useState("capture"); // capture | focus
  const [tasks, setTasks] = useState(loadTasks);
  const [input, setInput] = useState("");
  const [context, setContext] = useState("📥 Inbox");
  const [filter, setFilter] = useState("Tous");
  const [filterCtx, setFilterCtx] = useState("Tous");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [search, setSearch] = useState("");

  const [focusTaskId, setFocusTaskId] = useState(null);
  const focusTask = tasks.find(task => task.id === focusTaskId);
  const inputRef = useRef();

  useEffect(() => { saveTasks(tasks); }, [tasks]);

  const startFocus = (task) => {
    setFocusTaskId(task.id);
    setTab("focus");
  };

  const addTask = (voiceId = null) => {
    const trimmed = input.trim();
    if (!trimmed && !voiceId) return;
    setTasks(prev => [{ id: Date.now(), text: trimmed || "Mémo vocal", context: tab === "private" ? PRIVATE_CONTEXT : context, history: voiceId ? [{ at: new Date().toISOString(), kind: "voice", text: "Mémo vocal", voiceId }] : [], status: "À traiter", createdAt: new Date().toLocaleDateString("fr-FR"), note: "" }, ...prev]);
    setInput("");
    inputRef.current?.focus();
  };

  const updateStatus = (id, status) => {
    const at = new Date().toISOString();
    setTasks(prev => prev.map(task => {
      if (task.id !== id || task.status === status) return task;
      return {
        ...task,
        status,
        history: [...(task.history ?? []), { at, kind: "status", text: `${task.status} → ${status}` }],
      };
    }));
  };

  const addFocusToHistory = (interval) => {
    if (interval.taskId == null) return;
    const entry = {
      at: new Date().toISOString(),
      kind: "focus",
      text: `${interval.held ? "Intervalle tenu" : "Intervalle arrêté"} · ${mmss(interval.sec)} / ${interval.target} min`,
      details: interval.urges.map((second, index) =>
        `Envie à ${mmss(second)}${interval.notes[index] ? ` · ${interval.notes[index]}` : ""}`),
    };
    setTasks(previous => previous.map(task => task.id === interval.taskId
      ? { ...task, history: [...(task.history ?? []), entry] }
      : task));
  };

  const addFollowUp = (id, event) => {
    event.preventDefault();
    const text = new FormData(event.currentTarget).get("followUp").trim();
    if (!text) return;
    const entry = { at: new Date().toISOString(), kind: "note", text };
    setTasks(prev => prev.map(task => task.id === id
      ? { ...task, history: [...(task.history ?? []), entry] }
      : task));
    event.currentTarget.reset();
  };
  const deleteTask = (id) => {
    const task = tasks.find(t => t.id === id);
    setTasks(prev => prev.filter(t => t.id !== id));
    task?.history?.filter(entry => entry.voiceId).forEach(entry => deleteRecording(entry.voiceId).catch(() => {}));
  };
  const addVoiceFollowUp = (id, voiceId) => {
    setTasks(prev => prev.map(task => task.id === id
      ? { ...task, history: [...(task.history ?? []), { at: new Date().toISOString(), kind: "voice", text: "Mémo vocal", voiceId }] }
      : task));
  };
  const saveEdit = (id) => {
    const at = new Date().toISOString();
    setTasks(prev => prev.map(task => {
      if (task.id !== id || task.text === editText) return task;
      return {
        ...task,
        text: editText,
        history: [...(task.history ?? []), { at, kind: "edit", text: editText, previous: task.text }],
      };
    }));
    setEditId(null);
  };

  const visibleTasks = tasks.filter(t => tab === "private" ? t.context === PRIVATE_CONTEXT : t.context !== PRIVATE_CONTEXT);
  const filtered = visibleTasks.filter(t => {
    const matchStatus = filter === "Tous" || t.status === filter;
    const matchCtx = filterCtx === "Tous" || t.context === filterCtx;
    const matchSearch = t.text.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchCtx && matchSearch;
  });

  const counts = STATUSES.reduce((acc, s) => { acc[s] = visibleTasks.filter(t => t.status === s).length; return acc; }, {});

  return (
    <div style={{ minHeight: "100vh", background: "#F7F5F0", fontFamily: "'Georgia', serif", padding: 0 }}>
      {/* Header */}
      <div style={{ background: "#1A1A2E", color: "#E8E0D0", padding: "20px 24px 0", borderBottom: "3px solid #C9A84C" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 2 }}>
            <span style={{ fontSize: 10, letterSpacing: 4, color: "#C9A84C", textTransform: "uppercase" }}>GTD</span>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: "normal", color: "#F0EAD6" }}>Collecte & Suivi</h1>
          </div>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: "#9A9080" }}>Vide ton esprit. Tout capturer. Rien oublier.</p>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 0 }}>
            {[
              { key: "capture", label: "📥 Capture & Suivi" },
              { key: "private", label: "🔒 Vie privée" },
              { key: "focus", label: "🔥 Mode Focus" },
            ].map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); setFilter("Tous"); setFilterCtx("Tous"); setSearch(""); }} style={{
                background: tab === t.key ? "#F7F5F0" : "transparent",
                color: tab === t.key ? "#1A1A2E" : "#9A9080",
                border: "none", borderRadius: "8px 8px 0 0",
                padding: "10px 12px", fontSize: 12,
                fontFamily: "sans-serif", fontWeight: tab === t.key ? "700" : "400",
                cursor: "pointer", transition: "all 0.2s",
              }}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px" }}>

        {/* ===== CAPTURE TAB ===== */}
        {(tab === "capture" || tab === "private") && (
          <>
            {/* Stats */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {STATUSES.map(s => (
                <div key={s} onClick={() => setFilter(filter === s ? "Tous" : s)} style={{
                  background: STATUS_COLORS[s].bg, color: STATUS_COLORS[s].text,
                  padding: "5px 12px", borderRadius: 20, fontSize: 12, fontFamily: "sans-serif",
                  display: "flex", alignItems: "center", gap: 5, cursor: "pointer",
                  border: filter === s ? `2px solid ${STATUS_COLORS[s].dot}` : "2px solid transparent",
                  fontWeight: filter === s ? "700" : "400",
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLORS[s].dot, display: "inline-block" }} />
                  {s} <strong>{counts[s]}</strong>
                </div>
              ))}
              <div onClick={() => setFilter("Tous")} style={{
                background: "#E8E0D0", color: "#5A5040", padding: "5px 12px", borderRadius: 20,
                fontSize: 12, fontFamily: "sans-serif", cursor: "pointer",
                border: filter === "Tous" ? "2px solid #C9A84C" : "2px solid transparent",
                fontWeight: filter === "Tous" ? "700" : "400",
              }}>Tout · <strong>{visibleTasks.length}</strong></div>
            </div>

            {/* Capture zone */}
            <div style={{ background: "#fff", border: "2px solid #1A1A2E", borderRadius: 12, padding: "18px", marginBottom: 20, boxShadow: "4px 4px 0 #C9A84C" }}>
              <p style={{ margin: "0 0 10px", fontSize: 11, letterSpacing: 2, color: "#9A9080", fontFamily: "sans-serif", textTransform: "uppercase" }}>{tab === "private" ? "🔒 Capture personnelle" : "✏️ Capture rapide"}</p>
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addTask(); } }}
                placeholder={tab === "private" ? "Qu’aimerais-tu garder en tête pour ta vie privée ?" : "Qu'est-ce qui occupe ton esprit en ce moment ?"} rows={2}
                style={{ width: "100%", border: "none", outline: "none", fontSize: 15, fontFamily: "Georgia, serif", color: "#1A1A2E", resize: "none", background: "transparent", lineHeight: 1.6, boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {tab === "private" ? <span style={{ fontSize: 12, fontFamily: "sans-serif" }}>🔒 Vie privée</span> : <select value={context} onChange={e => setContext(e.target.value)} style={{ border: "1px solid #D0C8B0", borderRadius: 6, padding: "5px 8px", fontSize: 12, background: "#F7F5F0", color: "#1A1A2E", fontFamily: "sans-serif", cursor: "pointer" }}>
                  {CONTEXTS.filter(c => c !== PRIVATE_CONTEXT).map(c => <option key={c}>{c}</option>)}
                </select>}
                <button onClick={() => addTask()} style={{ background: "#1A1A2E", color: "#C9A84C", border: "none", borderRadius: 6, padding: "7px 18px", fontSize: 12, fontFamily: "sans-serif", fontWeight: "700", cursor: "pointer" }}>+ Ajouter</button>
                <span style={{ fontSize: 11, color: "#B0A898", fontFamily: "sans-serif" }}>ou Entrée</span>
                <VoiceRecorder onSave={voiceId => addTask(voiceId)} />
              </div>
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher..."
                style={{ border: "1px solid #D0C8B0", borderRadius: 6, padding: "6px 10px", fontSize: 12, fontFamily: "sans-serif", background: "#fff", color: "#1A1A2E", outline: "none", flex: 1, minWidth: 140 }} />
              {tab !== "private" && <select value={filterCtx} onChange={e => setFilterCtx(e.target.value)}
                style={{ border: "1px solid #D0C8B0", borderRadius: 6, padding: "6px 8px", fontSize: 12, background: "#fff", color: "#1A1A2E", fontFamily: "sans-serif", cursor: "pointer" }}>
                <option value="Tous">Tous contextes</option>
                {CONTEXTS.filter(c => c !== PRIVATE_CONTEXT).map(c => <option key={c}>{c}</option>)}
              </select>}
            </div>

            {/* Task list */}
            {filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#B0A898", fontFamily: "sans-serif", fontSize: 13 }}>
                {visibleTasks.length === 0 ? "Commence par capturer ce qui te pèse sur l'esprit..." : "Aucune tâche dans ce filtre."}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map(task => {
                const sc = STATUS_COLORS[task.status];
                const isEdit = editId === task.id;
                return (
                  <div key={task.id} style={{ background: "#fff", border: "1px solid #E0D8C8", borderLeft: `4px solid ${sc.dot}`, borderRadius: 8, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isEdit ? (
                        <textarea value={editText} onChange={e => setEditText(e.target.value)} autoFocus rows={2}
                          style={{ width: "100%", border: "1px solid #C9A84C", borderRadius: 4, padding: "4px 8px", fontSize: 14, fontFamily: "Georgia, serif", resize: "none", outline: "none", boxSizing: "border-box" }} />
                      ) : (
                        <p style={{ margin: "0 0 6px", fontSize: 14, color: task.status === "Terminé" ? "#B0A898" : "#1A1A2E", textDecoration: task.status === "Terminé" ? "line-through" : "none", lineHeight: 1.5 }}>{task.text}</p>
                      )}
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, color: "#9A9080", fontFamily: "sans-serif", background: "#F0EAD6", padding: "2px 7px", borderRadius: 10 }}>{task.context}</span>
                        <span style={{ fontSize: 10, color: "#B0A898", fontFamily: "sans-serif" }}>{task.createdAt}</span>
                        <select value={task.status} onChange={e => updateStatus(task.id, e.target.value)}
                          style={{ fontSize: 10, border: `1px solid ${sc.dot}`, background: sc.bg, color: sc.text, borderRadius: 10, padding: "2px 6px", fontFamily: "sans-serif", cursor: "pointer" }}>
                          {STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <details className="task-follow-up">
                        <summary>Suivi ({task.history?.length ?? 0})</summary>
                        <ol>
                          <li><strong>Capture</strong> · {task.createdAt}</li>
                          {task.note && <li>{task.note}</li>}
                          {task.history?.map((entry, index) => (
                            <li key={index}>
                              <time dateTime={entry.at}>{new Date(entry.at).toLocaleString("fr-FR", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}</time>
                              <strong>{ { status: "Statut", edit: "Modification", note: "Note", focus: "Focus", voice: "Vocal" }[entry.kind] }</strong>
                              {entry.kind === "edit" && <div>Avant · {entry.previous}</div>}
                              <div>{entry.text}</div>
                              {entry.voiceId && <VoicePlayer id={entry.voiceId} />}
                              {entry.details?.map((detail, index) => <div key={index}>{detail}</div>)}
                            </li>
                          ))}
                        </ol>
                        <form onSubmit={event => addFollowUp(task.id, event)}>
                          <label>
                            Ajouter une précision ou une avancée
                            <textarea name="followUp" rows={2} required />
                          </label>
                          <button type="submit">Ajouter au suivi</button>
                        </form>
                        <VoiceRecorder onSave={voiceId => addVoiceFollowUp(task.id, voiceId)} />
                      </details>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {isEdit ? (
                        <>
                          <button onClick={() => saveEdit(task.id)} style={btnStyle("#28A745")}>✓</button>
                          <button onClick={() => setEditId(null)} style={btnStyle("#6C757D")}>✗</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startFocus(task)} style={btnStyle("#E74C3C")} title="Mode Focus">🔥</button>
                          <button onClick={() => { setEditId(task.id); setEditText(task.text); }} style={btnStyle("#C9A84C")} title="Modifier">✏️</button>
                          <button onClick={() => deleteTask(task.id)} style={btnStyle("#DC3545")} title="Supprimer">🗑</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {visibleTasks.length > 0 && (
              <div style={{ marginTop: 20, textAlign: "center", fontSize: 11, color: "#C0B8A8", fontFamily: "sans-serif" }}>
                {visibleTasks.filter(t => t.status === "Terminé").length} terminée(s) sur {visibleTasks.length}
              </div>
            )}
          </>
        )}

        <div hidden={tab !== "focus"}>
          <FocusIntervals
            task={focusTask}
            onIntervalEnd={addFocusToHistory}
            onUnlink={() => setFocusTaskId(null)}
            onComplete={id => {
              updateStatus(id, "Terminé");
              setFocusTaskId(null);
              setTab("capture");
            }}
          />
        </div>
      </div>
    </div>
  );
}

function btnStyle(color) {
  return {
    background: color + "15", border: `1px solid ${color}40`, color,
    borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 12,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
  };
}

