/**
 * Brand New Printer Service Based on Successful pc-react Demo
 * 
 * This service is a complete rewrite based on the working implementation
 * found in the pc-react folder, which uses proper WebSocket management,
 * message routing, and print listener patterns.
 */

interface SocketOptions {
  resetTime: number;
  timeout: number;
}

interface PromisePoolItem {
  timestamp: number;
  content: any;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeoutCallback: ReturnType<typeof setTimeout>;
}

interface ApiRequest {
  apiName: string;
  parameter?: any;
}

/**
 * WebSocket Management Class (Based on pc-react/src/Socket.ts)
 */
class PrinterSocket {
  public url: string = "ws://127.0.0.1:37989";
  public options: SocketOptions = { resetTime: 3000, timeout: 10000 };
  public customClose: boolean = false;
  public isProcessingCommitJob: boolean = false;
  
  private promisePool: { [key: string]: PromisePoolItem } = {};
  private _websocket: WebSocket | undefined;
  public printListeners: Set<(msg: any) => void> = new Set();
  private openChangeCallback: ((isOpen: boolean) => void) | null = null;

  constructor(options: Partial<SocketOptions> = {}) {
    this.options = { ...this.options, ...options };
  }

  private isJSON(str: any): any | boolean {
    if (typeof str === "string") {
      try {
        return JSON.parse(str);
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  private closeCallback(): void {
    if (!this.customClose) {
      this.isProcessingCommitJob = false;
      this.close(false);
      this._websocket = undefined;
      this.printListeners.clear();
      
      const timer = setTimeout(async () => {
        try {
          await this.open(this.openChangeCallback || undefined);
          clearTimeout(timer);
        } catch (error) {
          console.error("WebSocket reconnection failed:", error);
          if (this.openChangeCallback) {
            this.openChangeCallback(false);
          }
        }
      }, this.options.resetTime);
      this.customClose = false;
    }
  }

  public open(openChange?: (isOpen: boolean) => void): Promise<{ e: Event, ws: PrinterSocket }> {
    if (openChange) {
      this.openChangeCallback = openChange;
    }
    
    return new Promise((resolve) => {
      if (typeof this._websocket === "undefined") {
        this._websocket = new WebSocket(this.url);
        
        this._websocket.onopen = (e: Event) => {
          console.log("🔗 WebSocket connected successfully");
          if (openChange) {
            openChange(true);
          }
          resolve({ e, ws: this });
        };
        
        this._websocket.onerror = () => {
          console.error("❌ WebSocket error occurred");
          if (openChange) {
            openChange(false);
          }
          this.isProcessingCommitJob = false;
          this.closeCallback();
        };
        
        this._websocket.onclose = () => {
          console.log("🔌 WebSocket connection closed");
          if (openChange) {
            openChange(false);
          }
          this.printListeners.clear();
          this.closeCallback();
        };
        
        this._websocket.onmessage = (e: MessageEvent) => {
          const msg = this.isJSON(e.data) ? JSON.parse(e.data as string) : e.data;
          this.messageRouter(msg);
        };
      }
    });
  }

  /**
   * Message Router - Core logic from pc-react demo
   */
  private messageRouter(msg: any): void {
    // Handle commitJob auto-reports
    const isAutoReport = msg.apiName === 'commitJob';
    
    if (msg.apiName && msg.apiName !== 'getPrinterHighLevelInfo' && msg.apiName !== 'printStatus' && !isAutoReport) {
      // Handle normal API responses
      this.handleApiResponse(msg);
    } else if (isAutoReport) {
      // Handle device auto-reports
      this.handleEventPush(msg);
    }
  }

  private handleApiResponse(msg: any): void {
    const req = this.promisePool[msg.apiName];
    if (!req) return;

    if (msg.apiName === 'commitJob') {
      if (msg.resultAck?.info === 'commitJob ok!') {
        req.resolve(msg);
        this.cleanupRequest(msg.apiName, req);
        this.isProcessingCommitJob = true;
      }
    } else {
      if (msg.resultAck?.errorCode !== 0) {
        this.isProcessingCommitJob = false;
      }
      req.resolve(msg);
      this.cleanupRequest(msg.apiName, req);
    }
  }

  private handleEventPush(msg: any): void {
    // Send to all print listeners
    this.printListeners.forEach(listener => listener(msg));
    
    // Handle error states
    if (msg.resultAck?.errorCode !== 0) {
      this.isProcessingCommitJob = false;
    }
  }

  private cleanupRequest(apiName: string, req: PromisePoolItem): void {
    if (req) {
      clearTimeout(req.timeoutCallback);
    }
    delete this.promisePool[apiName];
  }

  public close(closing: boolean = true): void {
    this.customClose = closing;
    if (this._websocket && this._websocket.readyState === WebSocket.OPEN) {
      this.clearAllListeners();
      if (this.openChangeCallback) {
        this.openChangeCallback(false);
      }
      this._websocket.close();
    }
  }

  public send(content: any, timeout: number | null = null): Promise<any> {
    const timestamp = new Date().getTime();
    const timeoutCallback = setTimeout(() => {
      if (content.apiName === "commitJob") {
        this.isProcessingCommitJob = true;
      }
      const req = this.promisePool[content.apiName];
      if (req && req.timestamp === timestamp) {
        req.resolve({
          apiName: content.apiName,
          resultAck: { errorCode: 22 },
          Error: "Request timeout",
        });
        clearTimeout(req.timeoutCallback);
        delete this.promisePool[content.apiName];
      }
    }, timeout !== null ? timeout : this.options.timeout);

    return new Promise((resolve, reject) => {
      this.promisePool[content.apiName] = {
        timestamp,
        content,
        resolve,
        reject,
        timeoutCallback,
      };

      if (this._websocket && this._websocket.readyState === WebSocket.OPEN) {
        this._websocket.send(JSON.stringify({ ...content }));
      } else {
        this.promisePool[content.apiName].resolve({
          apiName: content.apiName,
          resultAck: { errorCode: 22 },
          Error: "WebSocket not connected",
        });
      }
    });
  }

  public addPrintListener(callback: (msg: any) => void): (msg: any) => void {
    if (typeof callback !== "function") {
      console.error("addPrintListener: callback must be a function");
      return callback;
    }

    this.printListeners.delete(callback);
    this.printListeners.add(callback);
    return callback;
  }

  public removePrintListener(callback: (msg: any) => void): void {
    if (!callback) {
      console.error("removePrintListener: callback is required");
      return;
    }

    const removed = this.printListeners.delete(callback);
    if (!removed) {
      console.warn("removePrintListener: callback not found in listeners");
    }
  }

  public clearAllListeners(): void {
    const count = this.printListeners.size;
    this.printListeners.clear();
    console.log(`Cleared ${count} listeners`);
  }

  public getStatus(): number | undefined {
    return this._websocket?.readyState;
  }
}

/**
 * Printer Service Class (Based on pc-react patterns)
 */
class PrinterService {
  private socket: PrinterSocket;
  private isConnected: boolean = false;
  private isSdkInitialized: boolean = false;
  private selectedPrinter: string | null = null;
  private selectedPort: number | null = null;
  private isPrinting: boolean = false;

  // Print configuration matching pc-react demo
  private jsonObj = {
    printerImageProcessingInfo: {
      printQuantity: 1,
    },
  };

  // Print settings
  private density: number = 3;
  private labelType: number = 1;
  private printMode: number = 1;

  constructor() {
    this.socket = new PrinterSocket();
  }

  /**
   * Initialize connection to print service
   */
  public async connect(): Promise<boolean> {
    try {
      console.log('🔗 Connecting to printer service...');
      
      await this.socket.open((isOpen: boolean) => {
        this.isConnected = isOpen;
        console.log(`🔗 WebSocket connection: ${isOpen ? 'OPEN' : 'CLOSED'}`);
      });

      console.log('✅ Successfully connected to printer service');
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to printer service:', error);
      return false;
    }
  }

  /**
   * Initialize SDK
   */
  public async initializeSdk(): Promise<boolean> {
    if (!this.isConnected) {
      console.error('❌ Cannot initialize SDK - not connected');
      return false;
    }

    try {
      console.log('🔧 Initializing SDK...');
      
      const response = await this.socket.send({
        apiName: "initSdk",
        parameter: { fontDir: "" }
      });

      const result = JSON.parse(response.resultAck.errorCode);
      if (result === 0) {
        this.isSdkInitialized = true;
        console.log('✅ SDK initialized successfully');
        return true;
      } else {
        console.error('❌ SDK initialization failed:', response);
        return false;
      }
    } catch (error) {
      console.error('❌ SDK initialization error:', error);
      return false;
    }
  }

  /**
   * Get all available printers
   */
  public async getAllPrinters(): Promise<{ [key: string]: string }> {
    if (!this.isConnected) {
      throw new Error('Printer service not connected');
    }

    try {
      console.log('🔍 Getting all printers...');
      
      const response = await this.socket.send({ apiName: "getAllPrinters" });
      
      if (response.resultAck.errorCode === 0) {
        const printers = JSON.parse(response.resultAck.info);
        console.log('✅ Found printers:', printers);
        return printers;
      } else {
        console.warn('⚠️ No printers found');
        return {};
      }
    } catch (error) {
      console.error('❌ Error getting printers:', error);
      throw error;
    }
  }

  /**
   * Select and connect to a printer
   */
  public async selectPrinter(printerName: string, port: number): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Printer service not connected');
    }

    try {
      console.log(`🖨️ Selecting printer: ${printerName}:${port}`);
      
      const response = await this.socket.send({
        apiName: "selectPrinter",
        parameter: {
          printerName: printerName,
          port: port,
        },
      });

      const result = JSON.parse(response.resultAck.errorCode);
      if (result === 0) {
        this.selectedPrinter = printerName;
        this.selectedPort = port;
        console.log('✅ Printer selected successfully');
        return true;
      } else {
        console.error('❌ Failed to select printer:', response);
        return false;
      }
    } catch (error) {
      console.error('❌ Error selecting printer:', error);
      throw error;
    }
  }

  /**
   * Initialize drawing board
   */
  private async initDrawingBoard(params: any): Promise<boolean> {
    try {
      const response = await this.socket.send({
        apiName: "InitDrawingBoard",
        parameter: params,
      });
      return response.resultAck.errorCode === 0;
    } catch (error) {
      console.error('❌ Error initializing drawing board:', error);
      return false;
    }
  }

  /**
   * Draw label text
   */
  private async drawLabelText(params: any): Promise<boolean> {
    try {
      const response = await this.socket.send({
        apiName: "DrawLableText",
        parameter: params,
      });
      return parseInt(JSON.parse(response.resultAck.errorCode)) === 0;
    } catch (error) {
      console.error('❌ Error drawing text:', error);
      return false;
    }
  }

  /**
   * Print participant badge (main public method)
   */
  public async printParticipantBadge(participantData: {
    name: string;
    id: string;
    department: string;
  }): Promise<boolean> {
    if (!this.isReady()) {
      throw new Error('Printer not ready. Please connect, initialize SDK, and select a printer first.');
    }

    console.log('🖨️ Starting participant badge print...');
    
    try {
      // Set up print listener
      let printListener: ((msg: any) => void) | null = null;
      let isCompleted = false;
      
      const printPromise = new Promise<boolean>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (!isCompleted) {
            console.warn('⏰ Print job timeout');
            cleanup();
            resolve(false);
          }
        }, 30000);

        const cleanup = () => {
          if (printListener) {
            this.socket.removePrintListener(printListener);
            printListener = null;
          }
          clearTimeout(timeout);
        };

        printListener = this.socket.addPrintListener(async (msg) => {
          const resultAck = msg?.resultAck;
          console.log('📨 Print listener received:', resultAck);

          if (resultAck?.errorCode === 0 && resultAck?.info === 'commitJob ok!') {
            console.log('✅ Commit job successful');
          }

          // Check completion
          if (resultAck?.printCopies >= 1 && resultAck?.printPages >= 1) {
            console.log('🏁 Print job complete, ending job...');
            try {
              if (this.socket.getStatus() === WebSocket.OPEN) {
                await this.socket.send({ apiName: 'endJob' });
                console.log('✅ Print job ended successfully');
              }
              isCompleted = true;
              cleanup();
              resolve(true);
            } catch (error) {
              console.error('❌ Error ending job:', error);
              isCompleted = true;
              cleanup();
              resolve(false);
            }
          }

          if (resultAck?.errorCode !== 0) {
            console.error('❌ Print error:', resultAck?.info);
            cleanup();
            reject(new Error(resultAck?.info || 'Print failed'));
          }
        });

        // Start the print process
        this.executePrintJob(participantData).catch(reject);
      });

      const result = await printPromise;
      console.log(`🖨️ Print job ${result ? 'completed successfully' : 'failed'}`);
      return result;

    } catch (error) {
      console.error('❌ Print job failed:', error);
      throw error;
    }
  }

  /**
   * Execute the actual print job
   */
  private async executePrintJob(participantData: {
    name: string;
    id: string;
    department: string;
  }): Promise<void> {
    console.log('🎯 Executing print job...');

    // Step 1: Start print job
    const startResponse = await this.socket.send({
      apiName: "startJob",
      parameter: {
        printDensity: this.density,
        printLabelType: this.labelType,
        printMode: this.printMode,
        count: this.jsonObj.printerImageProcessingInfo.printQuantity,
      },
    });

    if (startResponse.resultAck.errorCode !== 0) {
      throw new Error('Failed to start print job');
    }

    // Step 2: Initialize drawing board (54mm x 25mm label)
    const canvasSuccess = await this.initDrawingBoard({
      width: 54,
      height: 25,
      rotate: 0,
      path: "",
      verticalShift: 0,
      HorizontalShift: 0
    });

    if (!canvasSuccess) {
      throw new Error('Failed to initialize drawing board');
    }

    // Step 3: Draw text elements
    const textElements = [
      {
        x: 2,
        y: 2,
        height: 6,
        width: 50,
        value: participantData.name,
        fontSize: 4,
        rotate: 0,
        textAlignHorizonral: 1, // Center
        textAlignVertical: 1,   // Middle
        lineMode: 6,
        fontStyle: 1 // Bold
      },
      {
        x: 2,
        y: 9,
        height: 4,
        width: 50,
        value: `ID: ${participantData.id}`,
        fontSize: 2.5,
        rotate: 0,
        textAlignHorizonral: 1,
        textAlignVertical: 1,
        lineMode: 6,
        fontStyle: 0
      },
      {
        x: 2,
        y: 15,
        height: 4,
        width: 50,
        value: participantData.department,
        fontSize: 2,
        rotate: 0,
        textAlignHorizonral: 1,
        textAlignVertical: 1,
        lineMode: 6,
        fontStyle: 0
      }
    ];

    for (const element of textElements) {
      const success = await this.drawLabelText(element);
      if (!success) {
        throw new Error('Failed to draw text element');
      }
    }

    // Step 4: Commit job (exactly like pc-react demo)
    console.log('📤 Committing print job...');
    await this.socket.send({
      apiName: "commitJob",
      parameter: {
        printData: undefined, // Exactly like pc-react demo
        printerImageProcessingInfo: this.jsonObj.printerImageProcessingInfo, // Not JSON string
      },
    });
  }

  /**
   * Check if printer service is ready
   */
  public isReady(): boolean {
    return this.isConnected && this.isSdkInitialized && !!this.selectedPrinter;
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(): {
    isConnected: boolean;
    isSdkInitialized: boolean;
    selectedPrinter: string | null;
    socketStatus: number | undefined;
  } {
    return {
      isConnected: this.isConnected,
      isSdkInitialized: this.isSdkInitialized,
      selectedPrinter: this.selectedPrinter,
      socketStatus: this.socket.getStatus(),
    };
  }

  /**
   * Disconnect from printer service
   */
  public disconnect(): void {
    this.socket.close(true);
    this.isConnected = false;
    this.isSdkInitialized = false;
    this.selectedPrinter = null;
    this.selectedPort = null;
    console.log('🔌 Printer service disconnected');
  }

  /**
   * Set print density
   */
  public setPrintDensity(density: number): void {
    this.density = density;
  }

  /**
   * Set label type
   */
  public setLabelType(labelType: number): void {
    this.labelType = labelType;
  }

  /**
   * Set print mode
   */
  public setPrintMode(printMode: number): void {
    this.printMode = printMode;
  }

  // Backward compatibility methods for existing admin page
  public async initialize(): Promise<boolean> {
    return await this.connect();
  }

  public isConnectedService(): boolean {
    return this.isConnected;
  }

  public isSdkInitializedService(): boolean {
    return this.isSdkInitialized;
  }

  public getSelectedPrinter(): string | null {
    return this.selectedPrinter;
  }

  public async getPrinters(): Promise<Array<{name: string; port: number; status: string}>> {
    try {
      const printers = await this.getAllPrinters();
      return Object.keys(printers).map(name => ({
        name,
        port: parseInt(printers[name]),
        status: 'available'
      }));
    } catch (error) {
      console.error('Error getting printers:', error);
      return [];
    }
  }

  public async printParticipantLabel(participant: any): Promise<boolean> {
    // Map old participant structure to new structure
    const participantData = {
      name: `${participant.title || ''} ${participant.first_name} ${participant.last_name}`.trim(),
      id: participant.staff_id || participant.id,
      department: participant.department || 'N/A'
    };
    
    return await this.printParticipantBadge(participantData);
  }

  public getRetryCount(): number {
    // Return 0 for compatibility - new service handles retries internally
    return 0;
  }

  public isMaxRetriesReached(): boolean {
    // Return false for compatibility - new service handles retries internally
    return false;
  }

  public resetConnection(): void {
    this.disconnect();
  }
}

// Create singleton instance
let printerServiceInstance: PrinterService | null = null;

export const getPrinterService = (): PrinterService => {
  if (!printerServiceInstance) {
    printerServiceInstance = new PrinterService();
  }
  return printerServiceInstance;
};

// Create a singleton instance for direct export (backward compatibility)
const printerServiceSingleton = getPrinterService();

export default printerServiceSingleton;
