import { useState, useEffect, useRef } from "react";

const CONTEXTS = ["📥 Inbox", "🏠 Maison", "💼 Travail BTP", "📞 Appels", "🛒 Courses", "🌴 Guadeloupe", "📚 Lecture"];
const STATUSES = ["À traiter", "En cours", "Délégué", "Terminé"];
const STATUS_COLORS = {
  "À traiter": { bg: "#FFF3CD", text: "#856404", dot: "#FFC107" },
  "En cours":  { bg: "#D1ECF1", text: "#0C5460", dot: "#17A2B8" },
  "Délégué":   { bg: "#E2D9F3", text: "#563D7C", dot: "#6F42C1" },
  "Terminé":   { bg: "#D4EDDA", text: "#155724", dot: "#28A745" },
};
const STORAGE_KEY = "gtd_tasks_norbert";
const POMODORO_DURATION = 25 * 60;
const SHORT_BREAK = 5 * 60;

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

  // Focus / Pomodoro state
  const [focusTask, setFocusTask] = useState(null);
  const [timeLeft, setTimeLeft] = useState(POMODORO_DURATION);
  const [running, setRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [customMinutes, setCustomMinutes] = useState(25);
  const intervalRef = useRef(null);
  const inputRef = useRef();

  useEffect(() => { saveTasks(tasks); }, [tasks]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            if (!isBreak) {
              setSessions(s => s + 1);
              setIsBreak(true);
              setTimeLeft(SHORT_BREAK);
            } else {
              setIsBreak(false);
              setTimeLeft(customMinutes * 60);
            }
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, isBreak, customMinutes]);

  const startFocus = (task) => {
    setFocusTask(task);
    setTimeLeft(customMinutes * 60);
    setRunning(false);
    setIsBreak(false);
    setTab("focus");
  };

  const resetTimer = () => {
    setRunning(false);
    setIsBreak(false);
    setTimeLeft(customMinutes * 60);
  };

  const addTask = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setTasks(prev => [{ id: Date.now(), text: trimmed, context, status: "À traiter", createdAt: new Date().toLocaleDateString("fr-FR"), note: "" }, ...prev]);
    setInput("");
    inputRef.current?.focus();
  };

  const updateStatus = (id, status) => setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  const deleteTask = (id) => setTasks(prev => prev.filter(t => t.id !== id));
  const saveEdit = (id) => { setTasks(prev => prev.map(t => t.id === id ? { ...t, text: editText } : t)); setEditId(null); };

  const filtered = tasks.filter(t => {
    const matchStatus = filter === "Tous" || t.status === filter;
    const matchCtx = filterCtx === "Tous" || t.context === filterCtx;
    const matchSearch = t.text.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchCtx && matchSearch;
  });

  const counts = STATUSES.reduce((acc, s) => { acc[s] = tasks.filter(t => t.status === s).length; return acc; }, {});

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const secs = String(timeLeft % 60).padStart(2, "0");
  const progress = isBreak
    ? 1 - timeLeft / SHORT_BREAK
    : 1 - timeLeft / (customMinutes * 60);
  const circumference = 2 * Math.PI * 80;

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
              { key: "focus", label: "🔥 Mode Focus" },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                background: tab === t.key ? "#F7F5F0" : "transparent",
                color: tab === t.key ? "#1A1A2E" : "#9A9080",
                border: "none", borderRadius: "8px 8px 0 0",
                padding: "10px 20px", fontSize: 13,
                fontFamily: "sans-serif", fontWeight: tab === t.key ? "700" : "400",
                cursor: "pointer", transition: "all 0.2s",
              }}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px" }}>

        {/* ===== CAPTURE TAB ===== */}
        {tab === "capture" && (
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
              }}>Tout · <strong>{tasks.length}</strong></div>
            </div>

            {/* Capture zone */}
            <div style={{ background: "#fff", border: "2px solid #1A1A2E", borderRadius: 12, padding: "18px", marginBottom: 20, boxShadow: "4px 4px 0 #C9A84C" }}>
              <p style={{ margin: "0 0 10px", fontSize: 11, letterSpacing: 2, color: "#9A9080", fontFamily: "sans-serif", textTransform: "uppercase" }}>✏️ Capture rapide</p>
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addTask(); } }}
                placeholder="Qu'est-ce qui occupe ton esprit en ce moment ?" rows={2}
                style={{ width: "100%", border: "none", outline: "none", fontSize: 15, fontFamily: "Georgia, serif", color: "#1A1A2E", resize: "none", background: "transparent", lineHeight: 1.6, boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <select value={context} onChange={e => setContext(e.target.value)} style={{ border: "1px solid #D0C8B0", borderRadius: 6, padding: "5px 8px", fontSize: 12, background: "#F7F5F0", color: "#1A1A2E", fontFamily: "sans-serif", cursor: "pointer" }}>
                  {CONTEXTS.map(c => <option key={c}>{c}</option>)}
                </select>
                <button onClick={addTask} style={{ background: "#1A1A2E", color: "#C9A84C", border: "none", borderRadius: 6, padding: "7px 18px", fontSize: 12, fontFamily: "sans-serif", fontWeight: "700", cursor: "pointer" }}>+ Ajouter</button>
                <span style={{ fontSize: 11, color: "#B0A898", fontFamily: "sans-serif" }}>ou Entrée</span>
              </div>
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher..."
                style={{ border: "1px solid #D0C8B0", borderRadius: 6, padding: "6px 10px", fontSize: 12, fontFamily: "sans-serif", background: "#fff", color: "#1A1A2E", outline: "none", flex: 1, minWidth: 140 }} />
              <select value={filterCtx} onChange={e => setFilterCtx(e.target.value)}
                style={{ border: "1px solid #D0C8B0", borderRadius: 6, padding: "6px 8px", fontSize: 12, background: "#fff", color: "#1A1A2E", fontFamily: "sans-serif", cursor: "pointer" }}>
                <option value="Tous">Tous contextes</option>
                {CONTEXTS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            {/* Task list */}
            {filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#B0A898", fontFamily: "sans-serif", fontSize: 13 }}>
                {tasks.length === 0 ? "Commence par capturer ce qui te pèse sur l'esprit..." : "Aucune tâche dans ce filtre."}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map(task => {
                const sc = STATUS_COLORS[task.status];
                const isEdit = editId === task.id;
                return (
                  <div key={task.id} style={{ background: "#fff", border: "1px solid #E0D8C8", borderLeft: `4px solid ${sc.dot}`, borderRadius: 8, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
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

            {tasks.length > 0 && (
              <div style={{ marginTop: 20, textAlign: "center", fontSize: 11, color: "#C0B8A8", fontFamily: "sans-serif" }}>
                {tasks.filter(t => t.status === "Terminé").length} terminée(s) sur {tasks.length}
              </div>
            )}
          </>
        )}

        {/* ===== FOCUS TAB ===== */}
        {tab === "focus" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>

            {/* Task selector */}
            <div style={{ width: "100%", marginBottom: 24 }}>
              <p style={{ fontSize: 11, letterSpacing: 2, color: "#9A9080", fontFamily: "sans-serif", textTransform: "uppercase", marginBottom: 8 }}>
                🎯 Tâche en cours
              </p>
              {focusTask ? (
                <div style={{ background: "#1A1A2E", borderRadius: 10, padding: "14px 16px", borderLeft: "4px solid #E74C3C" }}>
                  <p style={{ margin: "0 0 6px", fontSize: 15, color: "#F0EAD6", lineHeight: 1.5 }}>{focusTask.text}</p>
                  <span style={{ fontSize: 11, color: "#9A9080", fontFamily: "sans-serif", background: "#0F1520", padding: "2px 8px", borderRadius: 10 }}>{focusTask.context}</span>
                  <button onClick={() => { setFocusTask(null); resetTimer(); }} style={{ float: "right", background: "transparent", border: "none", color: "#6A6058", cursor: "pointer", fontSize: 12, fontFamily: "sans-serif" }}>Changer</button>
                </div>
              ) : (
                <div style={{ background: "#fff", borderRadius: 10, padding: "14px", border: "2px dashed #D0C8B0", textAlign: "center" }}>
                  <p style={{ margin: 0, color: "#9A9080", fontFamily: "sans-serif", fontSize: 13 }}>
                    Sélectionne une tâche depuis l'onglet Capture 🔥
                  </p>
                  <button onClick={() => setTab("capture")} style={{ marginTop: 10, background: "#1A1A2E", color: "#C9A84C", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 12, fontFamily: "sans-serif", cursor: "pointer" }}>
                    → Aller à la liste
                  </button>
                </div>
              )}
            </div>

            {/* Duration selector */}
            <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap", justifyContent: "center" }}>
              {[15, 25, 45, 60].map(m => (
                <button key={m} onClick={() => { setCustomMinutes(m); if (!running) setTimeLeft(m * 60); }} style={{
                  background: customMinutes === m ? "#1A1A2E" : "#fff",
                  color: customMinutes === m ? "#C9A84C" : "#5A5040",
                  border: `2px solid ${customMinutes === m ? "#C9A84C" : "#D0C8B0"}`,
                  borderRadius: 8, padding: "6px 16px", fontSize: 13,
                  fontFamily: "sans-serif", cursor: "pointer", fontWeight: customMinutes === m ? "700" : "400",
                }}>{m} min</button>
              ))}
            </div>

            {/* Circle timer */}
            <div style={{ position: "relative", marginBottom: 28 }}>
              <svg width={200} height={200} viewBox="0 0 200 200">
                <circle cx={100} cy={100} r={80} fill="none" stroke="#E8E0D0" strokeWidth={8} />
                <circle cx={100} cy={100} r={80} fill="none"
                  stroke={isBreak ? "#28A745" : running ? "#E74C3C" : "#C9A84C"}
                  strokeWidth={10} strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - progress)}
                  transform="rotate(-90 100 100)"
                  style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
                />
                <text x={100} y={90} textAnchor="middle" fill="#1A1A2E" fontSize={36} fontFamily="Georgia, serif" fontWeight="bold">
                  {mins}:{secs}
                </text>
                <text x={100} y={118} textAnchor="middle" fill="#9A9080" fontSize={12} fontFamily="sans-serif">
                  {isBreak ? "☕ Pause" : running ? "🔥 Focus" : "⏸ Prêt"}
                </text>
                {sessions > 0 && (
                  <text x={100} y={140} textAnchor="middle" fill="#C9A84C" fontSize={11} fontFamily="sans-serif">
                    {"🍅".repeat(Math.min(sessions, 8))}
                  </text>
                )}
              </svg>
            </div>

            {/* Controls */}
            <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
              <button onClick={() => setRunning(r => !r)} style={{
                background: running ? "#E74C3C" : "#1A1A2E",
                color: running ? "#fff" : "#C9A84C",
                border: "none", borderRadius: 10, padding: "14px 36px",
                fontSize: 15, fontFamily: "sans-serif", fontWeight: "700",
                cursor: "pointer", letterSpacing: 1,
              }}>
                {running ? "⏸ Pause" : "▶ Démarrer"}
              </button>
              <button onClick={resetTimer} style={{
                background: "#F7F5F0", color: "#5A5040",
                border: "2px solid #D0C8B0", borderRadius: 10, padding: "14px 20px",
                fontSize: 15, fontFamily: "sans-serif", cursor: "pointer",
              }}>↺</button>
            </div>

            {/* Mark done */}
            {focusTask && (
              <button onClick={() => {
                updateStatus(focusTask.id, "Terminé");
                setFocusTask(null);
                resetTimer();
                setTab("capture");
              }} style={{
                background: "#D4EDDA", color: "#155724",
                border: "2px solid #28A745", borderRadius: 10,
                padding: "12px 28px", fontSize: 13,
                fontFamily: "sans-serif", fontWeight: "700",
                cursor: "pointer",
              }}>
                ✅ Marquer comme terminé
              </button>
            )}

            {/* Sessions info */}
            <p style={{ marginTop: 24, fontSize: 12, color: "#B0A898", fontFamily: "sans-serif", textAlign: "center" }}>
              {sessions} session{sessions > 1 ? "s" : ""} complétée{sessions > 1 ? "s" : ""} · Pause de 5 min après chaque session
            </p>
          </div>
        )}
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
