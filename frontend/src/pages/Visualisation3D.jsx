import React, { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import FarmCanvas from '../components/3d/FarmCanvas';
import Bottom3DKPIBar from '../components/3d/Bottom3DKPIBar';

export default function Visualisation3D() {
  const {
    telemetry,
    mqttConnected,
    toggleZone,
  } = useSocket();

  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null);
  const [cameraPreset, setCameraPreset] = useState('free');

  const handleToggleValve = async (zoneId) => {
    try {
      const currentZone = telemetry.zones?.[zoneId];
      const isCurrentlyOn = currentZone?.valve === 'ON';
      const action = isCurrentlyOn ? 'STOP' : 'START';
      await toggleZone(zoneId, action);
    } catch (err) {
      console.error('Erreur bascule vanne:', err);
    }
  };

  const handleTogglePump = async () => {
    try {
      const isCurrentlyOn = telemetry.pump?.pump === 'ON';
      if (isCurrentlyOn) {
        const activeZones = Object.values(telemetry.zones || {}).filter((z) => z.valve === 'ON');
        for (const z of activeZones) {
          await toggleZone(z.id, 'STOP');
        }
      } else {
        await toggleZone(1, 'START');
      }
    } catch (err) {
      console.error('Erreur bascule pompe:', err);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5.2rem)] relative overflow-hidden rounded-2xl border border-hydra-border/60 bg-hydra-darkest">
      {/* 3D Scene Viewport - 100% interactif, propre et sans panneau latéral */}
      <div className="flex-1 w-full h-full relative overflow-hidden">
        <FarmCanvas
          telemetry={telemetry}
          selectedZoneId={selectedZoneId}
          setSelectedZoneId={setSelectedZoneId}
          selectedElement={selectedElement}
          setSelectedElement={setSelectedElement}
          cameraPreset={cameraPreset}
          setCameraPreset={setCameraPreset}
          onToggleValve={handleToggleValve}
          onTogglePump={handleTogglePump}
        />
      </div>

      {/* Barre KPI inférieure : compacte, moderne et discrète */}
      <Bottom3DKPIBar
        telemetry={telemetry}
        mqttConnected={mqttConnected}
        onToggleValve={handleToggleValve}
        onTogglePump={handleTogglePump}
        onResetCamera={() => {
          setCameraPreset('free');
          setSelectedElement(null);
          setSelectedZoneId(null);
        }}
        onSelectZone={(zId) => {
          setSelectedZoneId(zId);
          setSelectedElement({ type: 'zone', id: zId });
          setCameraPreset(`zone${zId}`);
        }}
      />
    </div>
  );
}
