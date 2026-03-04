import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { ToastProvider } from './src/components/CustomToast';
import { AlertProvider } from './src/contexts/AlertContext';
import AppNavigator from './src/navigation/AppNavigator';
import AnimatedSplash from './src/screens/shared/AnimatedSplash';
import { startOfflineSync, flushQueue } from './src/utils/offlineQueue';

function AppContent() {
  const { colors } = useTheme();
  const [splashDone, setSplashDone] = useState(false);

  return (
    <>
      <StatusBar style={colors.isDark ? 'light' : 'dark'} />
      <AppNavigator />
      {!splashDone && (
        <AnimatedSplash onFinish={() => setSplashDone(true)} />
      )}
    </>
  );
}

export default function App() {
  useEffect(() => {
    startOfflineSync();
    flushQueue();
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <AlertProvider>
            <AppContent />
          </AlertProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
