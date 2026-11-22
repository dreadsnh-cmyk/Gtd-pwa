import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "fractionne-focus-v1";
const MAX_MINUTES = 90;

function loadIntervals() {
  try {
    const intervals = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(intervals) ? intervals : [];
  } catch {
    return [];
  }
}

export function mmss(seconds) {
  const minutes = Math.floor(seconds / 60);
  return [minutes, seconds % 60].map(value => String(value).padStart(2, "0")).join(":");
}

function suggestedDuration(intervals) {
  const recent = intervals.slice(-3);
  if (recent.length === 3 && recent.every(interval => interval.held)) {
    return Math.min(MAX_MINUTES, Math.max(...recent.map(interval => interval.target)) + 2);
  }
  return Math.min(MAX_MINUTES, intervals.at(-1)?.target ?? 10);
}

export default function FocusIntervals({ task, onUnlink, onComplete, onIntervalEnd }) {
  const [intervals, setIntervals] = useState(loadIntervals);
  const [active, setActive] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [duration, setDuration] = useState(() => suggestedDuration(intervals));
  const [title, setTitle] = useState("");
  const [urges, setUrges] = useState([]);
  const [saveError, setSaveError] = useState(false);
  const [notice, setNotice] = useState("");
  const audioRef = useRef(null);
  const finishingRef = useRef(false);

  useEffect(() => () => { audioRef.current?.close().catch(() => {}); }, []);

  function signalEnd() {
    if (navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 500]);
    const audio = audioRef.current;
    if (!audio) return;
    audio.resume().then(() => {
      [0, 0.32, 0.64].forEach(offset => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, audio.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.18, audio.currentTime + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + offset + 0.23);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(audio.currentTime + offset);
        oscillator.stop(audio.currentTime + offset + 0.24);
      });
    }).catch(() => {});
  }

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(intervals));
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, [intervals]);

  function finish(elapsed) {
    if (!active || finishingRef.current) return;
    finishingRef.current = true;
    const targetSeconds = active.target * 60;
    const record = {
      ...active,
      sec: Math.min(targetSeconds, Math.floor(elapsed / 1000)),
      held: elapsed >= targetSeconds * 1000,
      urges: urges.map(urge => urge.second),
      notes: urges.map(urge => urge.note.trim()),
    };
    if (record.held) { signalEnd(); setNotice("⏰ Intervalle terminé !"); }
    else setNotice("Intervalle arrêté.");
    const next = [...intervals, record];
    onIntervalEnd(record);
    setActive(null);
    setIntervals(next);
    setDuration(suggestedDuration(next));
  }

  useEffect(() => {
    if (!active) return;
    const update = () => {
      const elapsed = Date.now() - active.ts;
      const remaining = active.target * 60 - elapsed / 1000;
      if (remaining <= 0) finish(elapsed);
      else setSeconds(Math.ceil(remaining));
    };
    const timer = setInterval(update, 250);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, [active, intervals, urges]);

  function start(event) {
    event.preventDefault();
    const target = Number(duration);
    if (!Number.isInteger(target) || target < 1 || target > MAX_MINUTES) return;
    finishingRef.current = false;
    setNotice("");
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioRef.current ??= new AudioContext();
        audioRef.current.resume().catch(() => {});
      }
    } catch { /* Le minuteur reste utilisable sans son. */ }
    setActive({ ts: Date.now(), target, task: task?.text ?? title.trim(), taskId: task?.id });
    setSeconds(target * 60);
    setUrges([]);
  }

  function recordUrge() {
    const elapsed = Date.now() - active.ts;
    if (elapsed >= active.target * 60000) {
      finish(elapsed);
      return;
    }
    setUrges(previous => [...previous, { second: Math.floor(elapsed / 1000), note: "" }]);
  }

  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  const weeklySeconds = intervals.reduce((total, interval) => interval.ts >= monday.getTime() ? total + interval.sec : total, 0);
  const held = intervals.filter(interval => interval.held).length;
  const latestUrge = urges.at(-1);

  return (
    <section className="focus-intervals" aria-label="Fractionné de focus">
      <h2>Fractionné de focus</h2>
      {active ? (
        <div className="focus-card">
          <div>{active.task || "Intervalle de focus"}</div>
          <div className="focus-clock" role="timer">{mmss(seconds)}</div>
          {latestUrge && (
            <label>
              Envie de lâcher notée à {mmss(latestUrge.second)} ({urges.length})
              <input key={urges.length} value={latestUrge.note}
                placeholder="Qu’est-ce qui m’a fait décrocher ? (facultatif)"
                onChange={event => {
                  const note = event.target.value;
                  setUrges(previous => [...previous.slice(0, -1), { ...previous.at(-1), note }]);
                }} />
            </label>
          )}
          <button className="focus-secondary" onClick={recordUrge}>Envie de lâcher, je la note et je continue</button>
          <button className="focus-secondary" onClick={() => finish(Date.now() - active.ts)}>Arrêter ici</button>
        </div>
      ) : (
        <form className="focus-card" onSubmit={start}>
          {task ? (
            <div className="focus-linked-task">
              <strong>{task.text}</strong>
              <span>{task.context}</span>
              <button type="button" className="focus-secondary" onClick={onUnlink}>Dissocier la tâche</button>
            </div>
          ) : (
            <label>Tâche unique<input value={title} onChange={event => setTitle(event.target.value)} placeholder="Ex. devis chantier" /></label>
          )}
          <label>Durée (min)
            <input type="number" min="1" max={MAX_MINUTES} inputMode="numeric" required
              value={duration} onChange={event => setDuration(event.target.value)} />
          </label>
          <p className="focus-hint">
            {intervals.length
              ? `Durée conseillée · ${suggestedDuration(intervals)} min. Après trois intervalles tenus, la durée conseillée augmente de 2 minutes, jusqu’à 90 minutes.`
              : "Durée conseillée pour commencer · 10 min."}
          </p>
          <button type="submit">Démarrer l’intervalle</button>
          {task && task.status !== "Terminé" && (
            <button type="button" className="focus-secondary" onClick={() => onComplete(task.id)}>Marquer la tâche comme terminée</button>
          )}
        </form>
      )}

      {notice && <p role="status" className="focus-end-notice">{notice}</p>}
      {saveError && <p role="status">Le navigateur n’a pas pu enregistrer l’historique du focus.</p>}
      <div className="focus-card focus-stats">
        <div><strong>{intervals.length}</strong>intervalles</div>
        <div><strong>{intervals.length ? Math.round(100 * held / intervals.length) : 0}%</strong>tenus</div>
        <div><strong>{Math.round(weeklySeconds / 60)} min</strong>cette semaine</div>
      </div>
      <div className="focus-card">
        <h3>Historique des intervalles</h3>
        {intervals.length === 0 && <p className="focus-hint">Aucun intervalle pour l’instant.</p>}
        {intervals.slice(-30).reverse().map((interval, index) => (
          <div className="focus-log" key={`${interval.ts}-${index}`}>
            <strong>{interval.held ? "Tenu" : "Arrêté"}</strong> · {mmss(interval.sec)} / {interval.target} min
            <div className="focus-hint">
              {interval.task || "Sans titre"} · {new Date(interval.ts).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
            </div>
            {interval.urges?.map((second, position) => (
              <div className="focus-hint" key={position}>
                Envie à {mmss(second)}{interval.notes?.[position] && ` · ${interval.notes[position]}`}
              </div>
            ))}
          </div>
        ))}
        {intervals.length > 0 && (
          <button className="focus-secondary" onClick={() => {
            if (!window.confirm("Effacer tout l’historique des intervalles ?")) return;
            setIntervals([]);
            setDuration(10);
          }}>Effacer l’historique des intervalles</button>
        )}
      </div>
    </section>
  );
}
