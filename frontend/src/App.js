import React from "react";
import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { LaunchProvider } from "@/context/LaunchContext";
import Layout from "@/components/Layout";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Catalog from "@/pages/Catalog";
import Library from "@/pages/Library";
import ServerStatus from "@/pages/ServerStatus";
import CloudSaves from "@/pages/CloudSaves";
import Profile from "@/pages/Profile";
import StreamSession from "@/pages/StreamSession";
import History from "@/pages/History";
import WebrtcDemo from "@/pages/WebrtcDemo";
import { Loader2 } from "lucide-react";

function FullLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0C10]">
      <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
    </div>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullLoader />;
  if (user) return <Navigate to="/app" replace />;
  return children;
}

function AppShell({ children }) {
  return (
    <Protected>
      <LaunchProvider>
        <Layout>{children}</Layout>
      </LaunchProvider>
    </Protected>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Toaster position="top-center" theme="dark" richColors />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />

            <Route path="/app" element={<AppShell><Dashboard /></AppShell>} />
            <Route path="/app/catalog" element={<AppShell><Catalog /></AppShell>} />
            <Route path="/app/library" element={<AppShell><Library /></AppShell>} />
            <Route path="/app/history" element={<AppShell><History /></AppShell>} />
            <Route path="/app/servers" element={<AppShell><ServerStatus /></AppShell>} />
            <Route path="/app/saves" element={<AppShell><CloudSaves /></AppShell>} />
            <Route path="/app/webrtc" element={<AppShell><WebrtcDemo /></AppShell>} />
            <Route path="/app/profile" element={<AppShell><Profile /></AppShell>} />

            <Route
              path="/play"
              element={
                <Protected>
                  <LaunchProvider>
                    <StreamSession />
                  </LaunchProvider>
                </Protected>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
