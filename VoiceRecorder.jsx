import { useEffect, useRef, useState } from "react";

const DB_NAME = "gtd_voice_notes";
const STORE = "recordings";
function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function withStore(mode, action) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export const saveRecording = (id, blob) => withStore("readwrite", store => store.put(blob, id));
export const getRecording = id => withStore("readonly", store => store.get(id));
export const deleteRecording = id => withStore("readwrite", store => store.delete(id));

export function VoiceRecorder({ onSave }) {
  const recorder = useRef(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => {
    const current = recorder.current;
    if (current) { current.onstop = null; current.stop(); current.stream.getTracks().forEach(track => track.stop()); }
  }, []);
  async function start() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder || !window.indexedDB) {
      setError("L’enregistrement vocal nécessite un navigateur compatible et une connexion sécurisée (HTTPS)."); return;
    }
    setBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const media = new MediaRecorder(stream);
      const chunks = [];
      media.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      media.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        recorder.current = null;
        setRecording(false);
        try {
          const blob = new Blob(chunks, { type: media.mimeType || "audio/webm" });
          if (blob.size) {
            const id = crypto.randomUUID();
            await saveRecording(id, blob);
            try { await onSave(id); } catch (err) { await deleteRecording(id); throw err; }
          }
        } catch { setError("Impossible de sauvegarder le mémo vocal. Vérifie l’espace disponible sur ton appareil."); }
        finally { setBusy(false); }
      };
      media.onerror = () => { setError("L’enregistrement a échoué."); stream.getTracks().forEach(track => track.stop()); setRecording(false); setBusy(false); };
      media.start();
      recorder.current = media;
      setRecording(true);
      setBusy(false);
    } catch { setError("Accès au microphone refusé ou indisponible. Autorise le micro dans ton navigateur."); setBusy(false); }
  }
  return <span className="voice-control">
    <button type="button" disabled={busy} onClick={() => recording ? recorder.current?.stop() : start()} aria-label={recording ? "Arrêter et sauvegarder l’enregistrement" : "Démarrer l’enregistrement vocal"}>
      {recording ? "⏹ Arrêter et sauvegarder" : "🎙️ Enregistrer une voix"}
    </button>
    {recording && <span role="status">🔴 Enregistrement en cours…</span>}
    {error && <span role="alert" className="voice-error">{error}</span>}
  </span>;
}

export function VoicePlayer({ id }) {
  const [url, setUrl] = useState(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl;
    getRecording(id).then(blob => {
      if (!active) return;
      if (blob) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }
      else setMissing(true);
    }).catch(() => { if (active) setMissing(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id]);
  return url ? <audio controls preload="none" src={url} aria-label="Écouter le mémo vocal" /> : missing ? <span>Mémo vocal indisponible sur cet appareil.</span> : <span>Chargement du mémo…</span>;
}
