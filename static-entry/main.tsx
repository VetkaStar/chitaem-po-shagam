import { createRoot } from 'react-dom/client';
import ReadingApp from '../features/lesson/ReadingApp';
import ProfileGate from '../features/portal/ProfileGate';
import '../app/globals.css';

createRoot(document.getElementById('root')!).render(<ProfileGate><ReadingApp /></ProfileGate>);
