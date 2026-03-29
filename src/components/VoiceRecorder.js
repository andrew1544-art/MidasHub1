'use client';
import { useState, useRef } from 'react';

export default function VoiceRecorder({ onRecorded }) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onRecorded?.(blob);
        setDuration(0);
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch (e) {
      alert('Microphone access denied. Enable it in your browser settings.');
    }
  };

  const stop = () => {
    if (mediaRef.current && mediaRef.current.state === 'recording') {
      mediaRef.current.stop();
    }
    setRecording(false);
    clearInterval(timerRef.current);
  };

  const cancel = () => {
    if (mediaRef.current && mediaRef.current.state === 'recording') {
      mediaRef.current.ondataavailable = null;
      mediaRef.current.onstop = null;
      mediaRef.current.stop();
      mediaRef.current.stream?.getTracks().forEach(t => t.stop());
    }
    chunksRef.current = [];
    setRecording(false);
    setDuration(0);
    clearInterval(timerRef.current);
  };

  const fmt = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

  if (recording) {
    return (
      <div className="flex items-center gap-2 flex-1">
        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs text-red-400 font-mono">{fmt(duration)}</span>
        <div className="flex-1" />
        <button onClick={cancel} className="text-xs text-white/30 px-2 py-1">Cancel</button>
        <button onClick={stop} className="btn-primary py-2 px-4 text-xs">⏹ Send</button>
      </div>
    );
  }

  return (
    <button onClick={start} className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-lg hover:bg-white/10 transition shrink-0" title="Voice message">
      🎤
    </button>
  );
}
