import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Validation from './pages/Validation';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/validation" element={<Validation />} />
        {/* Add more routes here as the project grows */}
      </Routes>
    </Router>
  );
}

export default App;
