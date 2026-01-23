import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import ValidationDashboard from './pages/ValidationDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/validation" element={<ValidationDashboard />} />
        {/* Add more routes here as the project grows */}
      </Routes>
    </Router>
  );
}

export default App;
