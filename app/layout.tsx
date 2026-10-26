import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Stardust Studio - Generador & Editor IA de Videos Líricos',
  description: 'Crea videos musicales con letras estilo Spotify traducidas al español para YouTube y Shorts',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen antialiased bg-[#090a0f] text-zinc-100 selection:bg-emerald-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
