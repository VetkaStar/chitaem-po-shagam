import { createRoot } from 'react-dom/client';
import ReadingApp from '../features/lesson/ReadingApp';
import '../app/globals.css';

createRoot(document.getElementById('root')!).render(<ReadingApp />);
