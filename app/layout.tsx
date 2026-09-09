import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'Читаем по шагам',description:'Буквы, слоги и слова в своём темпе. Чтение, игры и разминки.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ru"><body>{children}</body></html>}
