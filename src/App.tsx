import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "@/pages/Login";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Dashboard from "@/pages/Dashboard";
import Trials from "@/pages/Trials";
import TrialDetail from "@/pages/TrialDetail";
import Sites from "@/pages/Sites";
import Subjects from "@/pages/Subjects";
import Blinding from "@/pages/Blinding";
import ToastContainer from "@/components/Toast";

export default function App() {
  return (
    <Router>
      <ToastContainer />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="trials" element={<Trials />} />
          <Route path="trials/:id" element={<TrialDetail />} />
          <Route path="sites" element={<Sites />} />
          <Route path="subjects" element={<Subjects />} />
          <Route path="blinding" element={<Blinding />} />
        </Route>
      </Routes>
    </Router>
  );
}
