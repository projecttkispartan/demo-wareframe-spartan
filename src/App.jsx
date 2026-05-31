import { useState, useLayoutEffect } from 'react';
import Dashboard from './pages/Dashboard.jsx';
import BOMEditor from './pages/BOMEditor.jsx';
import { readStoredFontCase, FONT_CASE_STORAGE_KEY } from './components/ui/FontCaseToggle.jsx';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState('dashboard');
  const [kursUsd, setKursUsd] = useState(16004);
  const [kursEur, setKursEur] = useState(17500);
  const [fontCase, setFontCase] = useState(readStoredFontCase);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.remove('font-case-uppercase', 'font-case-normal');
    root.classList.add(fontCase === 'normal' ? 'font-case-normal' : 'font-case-uppercase');
    try {
      localStorage.setItem(FONT_CASE_STORAGE_KEY, fontCase);
    } catch {
      /* ignore */
    }
  }, [fontCase]);

  return (
    <div className="viewport-shell flex flex-col">
      {currentRoute === 'editor' ? (
        <BOMEditor
          onBack={() => setCurrentRoute('dashboard')}
          kursUsd={kursUsd}
          setKursUsd={setKursUsd}
          kursEur={kursEur}
          setKursEur={setKursEur}
          fontCase={fontCase}
          setFontCase={setFontCase}
        />
      ) : (
        <Dashboard
          onNewProject={() => setCurrentRoute('editor')}
          kursUsd={kursUsd}
          setKursUsd={setKursUsd}
          kursEur={kursEur}
          setKursEur={setKursEur}
          fontCase={fontCase}
          setFontCase={setFontCase}
        />
      )}
    </div>
  );
}
