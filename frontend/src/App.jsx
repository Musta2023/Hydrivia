import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';

import Login from './pages/Login';
import DashboardOverview from './pages/DashboardOverview';
import AIAnalysisPage from './pages/AIAnalysisPage';
import Visualisation3D from './pages/Visualisation3D';
import ZonesPage from './pages/ZonesPage';
import TankPage from './pages/TankPage';
import ConsumptionPage from './pages/ConsumptionPage';
import WeatherPage from './pages/WeatherPage';
import SoilPage from './pages/SoilPage';
import AlertsPage from './pages/AlertsPage';
import LogsPage from './pages/LogsPage';
import SettingsPage from './pages/SettingsPage';

function AuthenticatedApp() {
  const [activeTab, setActiveTab] = useState('overview');

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <DashboardOverview onNavigate={setActiveTab} />;
      case 'ai-analysis':
        return <AIAnalysisPage />;
      case '3d':
        return <Visualisation3D />;
      case 'zones':
        return <ZonesPage />;
      case 'tank':
        return <TankPage />;
      case 'consumption':
        return <ConsumptionPage />;
      case 'weather':
        return <WeatherPage />;
      case 'soil':
        return <SoilPage />;
      case 'alerts':
        return <AlertsPage onNavigate={setActiveTab} />;
      case 'logs':
        return <LogsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardOverview onNavigate={setActiveTab} />;
    }
  };

  return (
    <SocketProvider>
      <div className="min-h-screen bg-hydra-darkest flex text-hydra-textMain">
        {/* Fixed Left Sidebar */}
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Main Content Area */}
        <div className="flex-1 pl-64 flex flex-col min-h-screen">
          <Header activeTab={activeTab} onNavigate={setActiveTab} />

          <main className={activeTab === '3d' ? 'flex-1 p-4 lg:p-6 w-full mx-auto' : 'flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto'}>
            {renderContent()}
          </main>
        </div>
      </div>
    </SocketProvider>
  );
}

export default function App() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }

  return <AuthenticatedApp />;
}
