import type { ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import './practice-menu.css';
export default function PracticeMenu({
  children,
  label = 'Настройки',
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <details className="practice-menu">
      <summary>
        <SlidersHorizontal size={17} />
        <span>{label}</span>
      </summary>
      <div className="practice-menu-panel">{children}</div>
    </details>
  );
}
