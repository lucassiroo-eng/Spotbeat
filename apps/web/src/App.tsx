import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider } from './store/gameStore';
import Join from './pages/Join';
import Callback from './pages/Callback';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import Analytics from './pages/admin/Analytics';

export default function App() {
  return (
    <GameProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<Navigate to="/join" replace />} />
          <Route path="/join" element={<Join />} />
          <Route path="/join/:code" element={<Join />} />
          <Route path="/callback" element={<Callback />} />
          <Route path="/lobby/:code" element={<Lobby />} />
          <Route path="/game/:code" element={<Game />} />
          <Route path="/admin/analytics" element={<Analytics />} />
        </Routes>
      </BrowserRouter>
    </GameProvider>
  );
}
