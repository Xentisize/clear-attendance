// Printer service utility for integrating with the JcPrinter SDK
// This service handles communication with the printer through the browser plugin

class PrinterService {
  private isConnected: boolean = false;
  private isSdkInitialized: boolean = false;
  private selectedPrinter: string | null = null;

  // Initialize the printer service connection
  async initializeService(): Promise<boolean> {
    // Check if we're in browser environment
    if (typeof window === 'undefined') {
      return false;
    }

    // Check if printer SDK functions are available
    if (typeof (window as any).getInstance !== 'function') {
      console.warn('Printer SDK not available');
      return false;
    }

    return new Promise((resolve) => {
      (window as any).getInstance(
        () => {
          // Service connected
          console.log('Printer service connected');
          this.isConnected = true;
          resolve(true);
        },
        () => {
          // Service not supported
          console.warn('Printer service not supported');
          resolve(false);
        },
        () => {
          // Service disconnected
          console.log('Printer service disconnected');
          this.isConnected = false;
          resolve(false);
        },
        () => {
          // Printer disconnected
          console.log('Printer disconnected');
          this.selectedPrinter = null;
        }
      );
    });
  }

  // Initialize the SDK
  async initializeSdk(): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    // Check if initSdk function is available
    if (typeof (window as any).initSdk !== 'function') {
      console.warn('initSdk function not available');
      return false;
    }

    return new Promise((resolve) => {
      const initParams = {
        fontDir: ""
      };

      (window as any).initSdk(initParams, (error: any, data: any) => {
        if (error) {
          console.error('SDK initialization error:', error);
          resolve(false);
          return;
        }

        const { errorCode } = data.resultAck;
        if (errorCode === 0) {
          console.log('SDK initialized successfully');
          this.isSdkInitialized = true;
          resolve(true);
        } else {
          console.error('SDK initialization failed');
          resolve(false);
        }
      });
    });
  }

  // Get list of available printers
  async getPrinters(): Promise<any[]> {
    if (!this.isConnected) {
      return [];
    }

    // Check if getAllPrinters function is available
    if (typeof (window as any).getAllPrinters !== 'function') {
      console.warn('getAllPrinters function not available');
      return [];
    }

    return new Promise((resolve) => {
      (window as any).getAllPrinters((error: any, data: any) => {
        if (error) {
          console.error('Get printers error:', error);
          resolve([]);
          return;
        }

        const { errorCode, info } = data.resultAck;
        if (errorCode === 0) {
          try {
            const printers = JSON.parse(info);
            resolve(Object.keys(printers).map(name => ({
              name,
              port: printers[name]
            })));
          } catch (e) {
            console.error('Error parsing printer info:', e);
            resolve([]);
          }
        } else {
          resolve([]);
        }
      });
    });
  }

  // Select a printer
  async selectPrinter(printerName: string, port: number): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    // Check if selectPrinter function is available
    if (typeof (window as any).selectPrinter !== 'function') {
      console.warn('selectPrinter function not available');
      return false;
    }

    return new Promise((resolve) => {
      (window as any).selectPrinter(printerName, port, (error: any, data: any) => {
        if (error) {
          console.error('Select printer error:', error);
          resolve(false);
          return;
        }

        const { errorCode } = data.resultAck;
        if (errorCode === 0) {
          console.log('Printer selected successfully');
          this.selectedPrinter = printerName;
          resolve(true);
        } else {
          console.error('Select printer failed');
          resolve(false);
        }
      });
    });
  }

  // Print a label for a participant
  async printParticipantLabel(participant: any): Promise<boolean> {
    if (!this.isConnected || !this.isSdkInitialized || !this.selectedPrinter) {
      return false;
    }

    try {
      // Define label dimensions (50mm x 30mm)
      const labelWidth = 50;
      const labelHeight = 30;

      // Initialize drawing board
      const initResult = await this.initDrawingBoard(labelWidth, labelHeight);
      if (!initResult) {
        return false;
      }

      // Start print job
      const startResult = await this.startPrintJob(3, 1, 1, 1);
      if (!startResult) {
        return false;
      }

      // Draw participant information
      await this.drawParticipantInfo(participant, labelWidth, labelHeight);

      // Commit job
      const commitResult = await this.commitJob();
      if (!commitResult) {
        return false;
      }

      // End job
      const endResult = await this.endPrintJob();
      return endResult;
    } catch (error) {
      console.error('Print label error:', error);
      return false;
    }
  }

  // Initialize drawing board
  private initDrawingBoard(width: number, height: number): Promise<boolean> {
    if (typeof (window as any).InitDrawingBoard !== 'function') {
      console.warn('InitDrawingBoard function not available');
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      const params = {
        width,
        height,
        rotate: 0,
        path: "",
        verticalShift: 0,
        HorizontalShift: 0
      };

      (window as any).InitDrawingBoard(params, (error: any, data: any) => {
        if (error) {
          console.error('Init drawing board error:', error);
          resolve(false);
          return;
        }

        const { errorCode } = data.resultAck;
        resolve(errorCode === 0);
      });
    });
  }

  // Draw participant information on the label
  private async drawParticipantInfo(participant: any, labelWidth: number, labelHeight: number): Promise<void> {
    // Draw title
    await this.drawText('ATTENDANCE LABEL', 2, 2, labelWidth - 4, 4, 0, 3.5, 1, 1);

    // Draw participant name
    const name = `${participant.title || ''} ${participant.first_name} ${participant.last_name}`.trim();
    await this.drawText(name, 2, 7, labelWidth - 4, 4, 0, 3, 0, 1);

    // Draw staff ID
    await this.drawText(`ID: ${participant.staff_id}`, 2, 11, labelWidth - 4, 3, 0, 2.5, 0, 1);

    // Draw department
    await this.drawText(`${participant.department || ''}`, 2, 14, labelWidth - 4, 3, 0, 2.5, 0, 1);

    // Draw post
    await this.drawText(`${participant.post || ''}`, 2, 17, labelWidth - 4, 3, 0, 2.5, 0, 1);

    // Draw QR code with participant ID
    await this.drawQrCode(participant.id, 2, 20, 25, 25, 31, 0);
  }

  // Draw text
  private drawText(
    value: string,
    x: number,
    y: number,
    width: number,
    height: number,
    rotate: number,
    fontSize: number,
    textAlignHorizontal: number,
    textAlignVertical: number
  ): Promise<boolean> {
    if (typeof (window as any).DrawLableText !== 'function') {
      console.warn('DrawLableText function not available');
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      const params = {
        x,
        y,
        width,
        height,
        value,
        fontFamily: "宋体",
        rotate,
        fontSize,
        textAlignHorizonral: textAlignHorizontal,
        textAlignVertical,
        letterSpacing: 0.0,
        lineSpacing: 1.0,
        lineMode: 6,
        fontStyle: [false, false, false, false]
      };

      (window as any).DrawLableText(params, (error: any, data: any) => {
        if (error) {
          console.error('Draw text error:', error);
          resolve(false);
          return;
        }

        const { errorCode } = data.resultAck;
        resolve(errorCode === 0);
      });
    });
  }

  // Draw QR code
  private drawQrCode(
    value: string,
    x: number,
    y: number,
    width: number,
    height: number,
    codeType: number,
    rotate: number
  ): Promise<boolean> {
    if (typeof (window as any).DrawLableQrCode !== 'function') {
      console.warn('DrawLableQrCode function not available');
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      const params = {
        x,
        y,
        width,
        height,
        value,
        codeType,
        rotate
      };

      (window as any).DrawLableQrCode(params, (error: any, data: any) => {
        if (error) {
          console.error('Draw QR code error:', error);
          resolve(false);
          return;
        }

        const { errorCode } = data.resultAck;
        resolve(errorCode === 0);
      });
    });
  }

  // Start print job
  private startPrintJob(
    printDensity: number,
    printLabelType: number,
    printMode: number,
    count: number
  ): Promise<boolean> {
    if (typeof (window as any).startJob !== 'function') {
      console.warn('startJob function not available');
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      (window as any).startJob(printDensity, printLabelType, printMode, count, (error: any, data: any) => {
        if (error) {
          console.error('Start job error:', error);
          resolve(false);
          return;
        }

        const { errorCode } = data.resultAck;
        resolve(errorCode === 0);
      });
    });
  }

  // Commit job
  private commitJob(): Promise<boolean> {
    if (typeof (window as any).commitJob !== 'function') {
      console.warn('commitJob function not available');
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      const printerImageProcessingInfo = JSON.stringify({
        printerImageProcessingInfo: {
          printQuantity: 1
        }
      });

      (window as any).commitJob(null, printerImageProcessingInfo, (error: any, data: any) => {
        if (error) {
          console.error('Commit job error:', error);
          resolve(false);
          return;
        }

        const { errorCode } = data.resultAck;
        resolve(errorCode === 0);
      });
    });
  }

  // End print job
  private endPrintJob(): Promise<boolean> {
    if (typeof (window as any).endJob !== 'function') {
      console.warn('endJob function not available');
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      (window as any).endJob((error: any, data: any) => {
        if (error) {
          console.error('End job error:', error);
          resolve(false);
          return;
        }

        const { errorCode } = data.resultAck;
        resolve(errorCode === 0);
      });
    });
  }

  // Check if service is connected
  isConnectedService(): boolean {
    return this.isConnected;
  }

  // Check if SDK is initialized
  isSdkInitializedService(): boolean {
    return this.isSdkInitialized;
  }

  // Get selected printer
  getSelectedPrinter(): string | null {
    return this.selectedPrinter;
  }
}

// Create singleton instance
const printerService = new PrinterService();

export default printerService;