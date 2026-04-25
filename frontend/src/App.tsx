import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Home } from '@/pages/Home';
import { Installer } from '@/pages/Installer';
import { Homeowner } from '@/pages/Homeowner';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/installer" element={<Installer />} />
        <Route path="/homeowner" element={<Homeowner />} />
      </Routes>
    </BrowserRouter>
  );
}
