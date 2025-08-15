'use client';

import { getPrinterService } from '@/utils/printerService';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface PrinterContextType {
  isConnected: boolean;
  isSdkInitialized: boolean;
  selectedPrinter: string | null;
  availablePrinters: Array<{name: string; port: number; status: string}>;
  isInitializing: boolean;
  initializationError: string | null;
  
  // Actions
  refreshPrinters: () => Promise<void>;
  selectPrinter: (printerName: string, port: number) => Promise<boolean>;
  reinitialize: () => Promise<void>;
  
  // Print function
  printParticipantBadge: (participant: {
    name: string;
    id: string;
    department: string;
  }) => Promise<boolean>;
}

const PrinterContext = createContext<PrinterContextType | null>(null);

export const usePrinter = () => {
  const context = useContext(PrinterContext);
  if (!context) {
    throw new Error('usePrinter must be used within a PrinterProvider');
  }
  return context;
};

interface PrinterProviderProps {
  children: ReactNode;
}

export function PrinterProvider({ children }: PrinterProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isSdkInitialized, setIsSdkInitialized] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null);
  const [availablePrinters, setAvailablePrinters] = useState<Array<{name: string; port: number; status: string}>>([]);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  const printerService = getPrinterService();

  const updateStatus = async () => {
    const status = printerService.getConnectionStatus();
    setIsConnected(status.isConnected);
    setIsSdkInitialized(status.isSdkInitialized);
    setSelectedPrinter(status.selectedPrinter);

    // Get available printers if connected
    if (status.isConnected) {
      try {
        const printers = await printerService.getPrinters();
        setAvailablePrinters(printers);
      } catch (error) {
        console.error('Error getting printers:', error);
        setAvailablePrinters([]);
      }
    } else {
      setAvailablePrinters([]);
    }
  };

  const initializePrinter = async () => {
    setIsInitializing(true);
    setInitializationError(null);

    try {
      console.log('🔧 Initializing printer service at app level...');
      
      // Step 1: Connect to WebSocket
      const connected = await printerService.connect();
      if (!connected) {
        throw new Error('Failed to connect to printer service. Please ensure the printer plugin is installed and running.');
      }
      console.log('✅ Printer service connected');

      // Step 2: Initialize SDK
      const sdkInitialized = await printerService.initializeSdk();
      if (!sdkInitialized) {
        throw new Error('Failed to initialize printer SDK.');
      }
      console.log('✅ Printer SDK initialized');

      // Step 3: Get available printers
      const printers = await printerService.getPrinters();
      console.log('✅ Found printers:', printers);

      // Step 4: Auto-select first printer if available
      if (printers.length > 0) {
        const firstPrinter = printers[0];
        const selected = await printerService.selectPrinter(firstPrinter.name, firstPrinter.port);
        if (selected) {
          console.log('✅ Auto-selected printer:', firstPrinter.name);
        }
      }

      await updateStatus();
      console.log('🎉 Printer initialization completed successfully');
      
    } catch (error) {
      console.error('❌ Printer initialization failed:', error);
      setInitializationError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsInitializing(false);
    }
  };

  const refreshPrinters = async () => {
    try {
      const printers = await printerService.getPrinters();
      setAvailablePrinters(printers);
    } catch (error) {
      console.error('Error refreshing printers:', error);
      setAvailablePrinters([]);
    }
  };

  const selectPrinter = async (printerName: string, port: number): Promise<boolean> => {
    try {
      const success = await printerService.selectPrinter(printerName, port);
      if (success) {
        setSelectedPrinter(printerName);
      }
      return success;
    } catch (error) {
      console.error('Error selecting printer:', error);
      return false;
    }
  };

  const reinitialize = async () => {
    await initializePrinter();
  };

  const printParticipantBadge = async (participant: {
    name: string;
    id: string;
    department: string;
  }): Promise<boolean> => {
    try {
      return await printerService.printParticipantBadge(participant);
    } catch (error) {
      console.error('Print error:', error);
      throw error;
    }
  };

  // Initialize printer service when component mounts
  useEffect(() => {
    // Add a delay to ensure the printer SDK script is loaded
    const timer = setTimeout(() => {
      initializePrinter();
    }, 2000); // 2 second delay to ensure SDK script is loaded

    return () => clearTimeout(timer);
  }, []);

  // Periodic status check (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (isConnected) {
        await updateStatus();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isConnected]);

  const value: PrinterContextType = {
    isConnected,
    isSdkInitialized,
    selectedPrinter,
    availablePrinters,
    isInitializing,
    initializationError,
    refreshPrinters,
    selectPrinter,
    reinitialize,
    printParticipantBadge,
  };

  return (
    <PrinterContext.Provider value={value}>
      {children}
    </PrinterContext.Provider>
  );
}
