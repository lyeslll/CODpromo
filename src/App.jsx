import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Admin from "./pages/Admin.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* لوحة التحكم تبقى داكنة دائماً بغضّ النظر عن ثيم الموقع */}
        <Route
          path="/admin"
          element={
            <div className="dark">
              <Admin />
            </div>
          }
        />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
