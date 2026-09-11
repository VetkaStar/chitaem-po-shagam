'use client';
import { Volume2 } from 'lucide-react';
import './task-instruction.css';
export default function TaskInstruction({
  text,
  sound,
  speak,
}: {
  text: string;
  sound: boolean;
  speak: (text: string) => void;
}) {
  return (
    <div className="task-instruction">
      {sound && (
        <button
          className="speak-button"
          aria-label="Послушать инструкцию"
          onClick={() => speak(text)}
        >
          <Volume2 size={18} />
        </button>
      )}
      <p>{text}</p>
    </div>
  );
}
