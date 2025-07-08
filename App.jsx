
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Admin from './pages/Admin';
import Coureur from './pages/Coureur';
import Organisateur from './pages/Organisateur';
import Navbar from './components/Navbar';

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/admin' element={<Admin />} />
        <Route path='/coureur' element={<Coureur />} />
        <Route path='/organisateur' element={<Organisateur />} />
      </Routes>
    </BrowserRouter>
  );
}
