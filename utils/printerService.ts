// Printer service utility for integrating with the JcPrinter SDK
// This service handles communication with the printer through the browser plugin

// Type definitions for printer-related data structures
interface PrinterInfo {
	name: string;
	port: number;
	status: string;
}

interface PrintTextParams {
	x: number;
	y: number;
	height: number;
	width: number;
	value: string;
	fontFamily: string;
	rotate: number;
	fontSize: number;
	textAlignHorizonral: number;
	textAlignVertical: number;
	letterSpacing: number;
	lineSpacing: number;
	lineMode: number;
	fontStyle: boolean[];
}

interface PrintQRCodeParams {
	x: number;
	y: number;
	height: number;
	width: number;
	value: string;
	codeType: number;
	rotate: number;
}

interface DrawingBoardParams {
	width: number;
	height: number;
	rotate: number;
	path: string;
	verticalShift: number;
	HorizontalShift: number;
}

interface ParticipantData {
	name: string;
	id: string;
	department?: string;
	position?: string;
}

// SDK wrapper to handle all window method calls
// Note: Now using direct window calls to match DEMO behavior

class PrinterService {
	private static instance: PrinterService;
	private isConnected: boolean = false;
	private isSdkInitialized: boolean = false;
	private selectedPrinter: string | null = null;
	private status: string = 'disconnected';
	private connectionRetries = 0;
	private maxRetries = 3;
	private isDrawing: boolean = false; // Add drawing state management like DEMO

	// Singleton pattern - only one instance across the app
	public static getInstance(): PrinterService {
		// For development mode stability, also check if there's a global instance
		if (typeof window !== 'undefined') {
			// Store instance reference in window for cross-navigation persistence
			const globalKey = '__PRINTER_SERVICE_INSTANCE__';
			if (!(window as any)[globalKey]) {
				console.log('🏗️ Creating new PrinterService singleton instance');
				(window as any)[globalKey] = new PrinterService();
			} else {
				console.log(
					'🔄 Returning existing PrinterService singleton instance from window',
				);
				console.log('🔄 Current state:', {
					isConnected: (window as any)[globalKey].isConnected,
					selectedPrinter: (window as any)[globalKey].selectedPrinter,
					status: (window as any)[globalKey].status,
				});
			}
			PrinterService.instance = (window as any)[globalKey];
		} else {
			// Fallback for SSR
			if (!PrinterService.instance) {
				console.log('🏗️ Creating new PrinterService singleton instance (SSR)');
				PrinterService.instance = new PrinterService();
			}
		}
		return PrinterService.instance;
	}

	// Private constructor to prevent direct instantiation
	private constructor() {
		const timestamp = new Date().toISOString();
		console.log('🏗️ PrinterService singleton instance created at:', timestamp);
		console.log('🏗️ Instance ID:', Math.random().toString(36).substr(2, 9));
	}

	// Add a delay utility to prevent WebSocket message overload
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	// Check if the connection is healthy
	private async checkConnectionHealth(): Promise<boolean> {
		if (!this.isConnected) {
			return false;
		}

		// Try to get printers to verify connection
		try {
			const printers = await this.getPrinters();
			return Array.isArray(printers);
		} catch {
			return false;
		}
	}

	// Reconnect if needed
	private async reconnectIfNeeded(): Promise<boolean> {
		if (this.connectionRetries >= this.maxRetries) {
			console.error('Max reconnection attempts reached');
			return false;
		}

		const isHealthy = await this.checkConnectionHealth();
		if (!isHealthy) {
			console.log('Connection unhealthy, attempting reconnection...');
			this.connectionRetries++;
			this.isConnected = false;
			this.isSdkInitialized = false;
			this.selectedPrinter = null;

			const connected = await this.initialize();
			if (connected) {
				const sdkInitialized = await this.initializeSdk();
				return sdkInitialized;
			}
		}

		return isHealthy;
	}

	// Initialize the printer service connection
	async initialize(): Promise<boolean> {
		return new Promise((resolve) => {
			// Check if SDK is available
			if (typeof (window as any).getInstance !== 'function') {
				console.warn('Printer SDK not available');
				resolve(false);
				return;
			}

			// Initialize the printer SDK connection
			try {
				(window as any).getInstance(
					() => {
						console.log('Printer SDK connected');
						this.isConnected = true;
						this.status = 'connected';
						resolve(true);
					},
					() => {
						console.warn('Printer SDK not supported');
						this.status = 'not_supported';
						resolve(false);
					},
					() => {
						console.warn('Printer SDK disconnected');
						this.isConnected = false;
						this.isSdkInitialized = false;
						this.selectedPrinter = null;
						this.status = 'disconnected';
						resolve(false);
					},
					() => {
						console.warn('Printer disconnected');
						this.selectedPrinter = null;
						this.status = 'printer_disconnected';
					},
				);
			} catch (error) {
				console.error('Error initializing printer SDK:', error);
				this.status = 'error';
				resolve(false);
			}
		});
	} // Initialize the SDK
	async initializeSdk(): Promise<boolean> {
		return new Promise((resolve) => {
			if (typeof (window as any).initSdk !== 'function') {
				console.warn('Printer SDK initSdk method not available');
				resolve(false);
				return;
			}

			try {
				const initParams = { fontDir: '/public/js/' };
				(window as any).initSdk(initParams, (error: any, data: any) => {
					if (error) {
						console.error('Error initializing SDK:', error);
						resolve(false);
					} else {
						console.log('SDK initialized successfully:', data);
						this.isSdkInitialized = true;
						resolve(true);
					}
				});
			} catch (error) {
				console.error('Error calling initSdk:', error);
				resolve(false);
			}
		});
	}

	// Get list of available printers
	async getPrinters(): Promise<PrinterInfo[]> {
		if (!this.isConnected) {
			return [];
		}

		// Add a small delay to prevent WebSocket message overload
		// This helps prevent the WebSocket from closing due to rapid successive calls
		await this.delay(100);

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

				const result = data as {
					resultAck: { errorCode: number; info: string };
				};
				const { errorCode, info } = result.resultAck;
				if (errorCode === 0) {
					try {
						const printers = JSON.parse(info) as Record<string, number>;
						resolve(
							Object.keys(printers).map((name) => ({
								name,
								port: printers[name],
								status: 'available',
							})),
						);
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
			console.error('Service not connected');
			return false;
		}

		// CRITICAL: Check if SDK is initialized before attempting selectPrinter
		if (!this.isSdkInitialized) {
			console.error('SDK not initialized before selectPrinter call');
			// Try to initialize SDK first
			const sdkInitialized = await this.initializeSdk();
			if (!sdkInitialized) {
				console.error('Failed to initialize SDK for selectPrinter');
				return false;
			}
		}

		// Add a longer delay to ensure WebSocket connection is fully stable
		// The WebSocket needs significant time to be ready for selectPrinter messages
		console.log('Waiting for WebSocket to stabilize before selectPrinter...');
		await this.delay(3000); // Increased to 3 seconds

		// Double-check connection status after delay
		if (!this.isConnected) {
			console.error('Service disconnected during delay');
			return false;
		}

		// Check if selectPrinter function is available on window directly
		if (typeof (window as any).selectPrinter !== 'function') {
			console.warn('selectPrinter function not available on window');
			return false;
		}

		// Reset selected printer state before attempting new selection
		this.selectedPrinter = null;

		// Implement retry mechanism for selectPrinter to handle WebSocket instability
		const maxRetries = 2;
		for (let attempt = 0; attempt < maxRetries; attempt++) {
			console.log(`SelectPrinter attempt ${attempt + 1}/${maxRetries}`);

			// Try to "warm up" the WebSocket connection with a simple call first
			if (attempt === 0) {
				console.log('Warming up WebSocket with getAllPrinters...');
				try {
					await this.getPrinters();
					console.log('WebSocket warmed up successfully');
					await this.delay(500); // Small additional delay after warmup
				} catch (error) {
					console.warn('WebSocket warmup failed:', error);
				}
			}

			const result = await this.attemptSelectPrinter(printerName, port);
			if (result) {
				return true;
			}

			// If failed and not the last attempt, wait before retry
			if (attempt < maxRetries - 1) {
				console.log('SelectPrinter failed, waiting before retry...');
				await this.delay(2000);

				// Check if connection is still alive
				if (!this.isConnected) {
					console.log('Connection lost during retry, aborting');
					return false;
				}
			}
		}
		return false;
	}

	private async attemptSelectPrinter(
		printerName: string,
		port: number,
	): Promise<boolean> {
		// Log the parameters we're about to send
		console.log('About to call selectPrinter with:', {
			printerName,
			port,
			portType: typeof port,
		});

		return new Promise((resolve) => {
			// Call selectPrinter directly on window like in the demo
			// Ensure port is an integer like in the DEMO
			(window as any).selectPrinter(
				printerName,
				parseInt(port.toString()), // Ensure it's parsed as integer like DEMO
				// biome-ignore lint/suspicious/noExplicitAny: Third-party SDK callback types
				(error: any, data: any) => {
					if (error) {
						console.error('Select printer error:', error);
						resolve(false);
						return;
					}

					try {
						const { errorCode, info } = data.resultAck;
						if (errorCode === 0) {
							console.log('Printer selected successfully');
							this.selectedPrinter = printerName;
							this.connectionRetries = 0; // Reset retry counter on success
							resolve(true);
						} else {
							console.error(
								'Select printer failed with error code:',
								errorCode,
								'info:',
								info,
							);
							resolve(false);
						}
					} catch (parseError) {
						console.error('Error parsing select printer response:', parseError);
						resolve(false);
					}
				},
			);
		});
	}

	// Print a label for a participant
	async printParticipantLabel(participant: any): Promise<boolean> {
		console.log('🖨️ ==> printParticipantLabel START');
		console.log('🖨️ Service status:', {
			isConnected: this.isConnected,
			isSdkInitialized: this.isSdkInitialized,
			selectedPrinter: this.selectedPrinter,
		});

		if (!this.isConnected || !this.isSdkInitialized || !this.selectedPrinter) {
			console.error('❌ Printer service not ready for printing');
			return false;
		}

		try {
			// Set drawing state like DEMO
			console.log('🖨️ Setting isDrawing = true (DEMO pattern)');
			this.isDrawing = true;

			// Try using exact DEMO dimensions - 40x60 like the text example instead of 50x20
			const labelWidth = 40;
			const labelHeight = 60;

			console.log('🖨️ Starting print job with DEMO text dimensions:', {
				labelWidth,
				labelHeight,
			});

			// Initialize drawing board
			console.log('🖨️ Step 1: InitDrawingBoard...');
			const initResult = await this.initDrawingBoard(labelWidth, labelHeight);
			if (!initResult) {
				console.error('❌ Step 1 FAILED: InitDrawingBoard');
				return false;
			}
			console.log('✅ Step 1 SUCCESS: InitDrawingBoard');

			// Start print job
			console.log('🖨️ Step 2: StartJob...');
			const startResult = await this.startPrintJob(3, 1, 1, 1);
			if (!startResult) {
				console.error('❌ Step 2 FAILED: StartJob');
				return false;
			}
			console.log('✅ Step 2 SUCCESS: StartJob');

			// Draw participant information
			console.log('🖨️ Step 3: Drawing participant info...');
			await this.drawParticipantInfo(participant, labelWidth, labelHeight);
			console.log('✅ Step 3 SUCCESS: Drawing participant info');

			// Add a delay to ensure all drawing operations are completed
			// This matches the DEMO's approach of ensuring drawing is finished
			console.log('🖨️ Step 4: Waiting for drawing operations to complete...');
			await this.delay(1000); // 1 second delay
			console.log('✅ Step 4 SUCCESS: Drawing wait completed');

			// Set drawing completed state like DEMO BEFORE commitJob (critical!)
			console.log(
				'🖨️ Setting isDrawing = false before commitJob (DEMO pattern)',
			);
			this.isDrawing = false;

			// Commit job
			console.log('🖨️ Step 5: CommitJob...');
			const commitResult = await this.commitJob();
			if (!commitResult) {
				console.error('❌ Step 5 FAILED: CommitJob');
				return false;
			}
			console.log('✅ Step 5 SUCCESS: CommitJob');

			// Add delay between commitJob and endJob to prevent callback conflicts
			console.log('🖨️ Step 6: Waiting between commit and end...');
			await this.delay(2000); // 2 second delay to let commitJob settle
			console.log('✅ Step 6 SUCCESS: Wait completed');

			// End job
			console.log('🖨️ Step 7: EndJob...');
			const endResult = await this.endPrintJob();
			if (!endResult) {
				console.error('❌ Step 7 FAILED: EndJob');
				return false;
			}
			console.log('✅ Step 6 SUCCESS: EndJob');

			console.log('🎉 Print job completed successfully');
			return true;
		} catch (error) {
			console.error('💥 Print label error:', error);
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
			// Use parameters matching the DEMO format exactly
			const params = {
				width,
				height,
				rotate: 0,
				path: 'ZT001.ttf', // This font path is critical - missing in our original implementation
				verticalShift: 0,
				HorizontalShift: 0,
			};

			console.log('InitDrawingBoard params:', params);

			(window as any).InitDrawingBoard(params, (error: any, data: any) => {
				if (error) {
					console.error('Init drawing board error:', error);
					resolve(false);
					return;
				}

				const { errorCode, info } = data.resultAck;
				console.log('InitDrawingBoard result:', { errorCode, info });
				resolve(errorCode === 0);
			});
		});
	}

	// Draw participant information on the label
	private async drawParticipantInfo(
		participant: any,
		labelWidth: number,
		labelHeight: number,
	): Promise<void> {
		console.log('Drawing participant info with dimensions:', {
			labelWidth,
			labelHeight,
		});

		// Use EXACT parameters from DEMO text.js working example
		const name =
			`${participant.title || ''} ${participant.first_name} ${participant.last_name}`.trim();

		console.log('Drawing text with EXACT DEMO parameters...');

		// This matches exactly the DEMO text.js first element parameters
		const textResult = await this.drawText(
			name,
			4.0, // marginX * 2 like DEMO
			4.0, // marginY * 2 like DEMO
			34.0, // width - marginX * 2 (40-6) like DEMO titleWidth
			7.4, // height - exact titleHeight from DEMO
			0,
			5.6, // fontSize - exact titleFontSize from DEMO
			1, // textAlignHorizontal - 1 like DEMO (center)
			1, // textAlignVertical - 1 like DEMO (center)
		);

		if (!textResult) {
			console.error('Failed to draw text with DEMO parameters');
			return;
		}

		console.log('Text drawn successfully with DEMO parameters');
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
		textAlignVertical: number,
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
				fontFamily: '宋体',
				rotate,
				fontSize,
				textAlignHorizonral: textAlignHorizontal,
				textAlignVertical,
				letterSpacing: 0.0,
				lineSpacing: 1.0,
				lineMode: 6,
				fontStyle: [false, false, false, false],
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
		rotate: number,
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
				rotate,
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
		count: number,
	): Promise<boolean> {
		if (typeof (window as any).startJob !== 'function') {
			console.warn('startJob function not available');
			return Promise.resolve(false);
		}

		return new Promise((resolve) => {
			(window as any).startJob(
				printDensity,
				printLabelType,
				printMode,
				count,
				(error: any, data: any) => {
					if (error) {
						console.error('Start job error:', error);
						resolve(false);
						return;
					}

					const { errorCode } = data.resultAck;
					resolve(errorCode === 0);
				},
			);
		});
	}

	// Commit job
	private commitJob(): Promise<boolean> {
		if (typeof (window as any).commitJob !== 'function') {
			console.warn('commitJob function not available');
			return Promise.resolve(false);
		}

		return new Promise((resolve) => {
			let resolved = false; // Flag to prevent multiple resolutions

			const printerImageProcessingInfo = {
				printerImageProcessingInfo: {
					printQuantity: 1,
				},
			};

			console.log(
				'🖨️ About to call commitJob with:',
				printerImageProcessingInfo,
			);

			(window as any).commitJob(
				null,
				JSON.stringify(printerImageProcessingInfo),
				(error: any, data: any) => {
					console.log('🖨️ CommitJob callback received:', {
						error,
						data,
						resolved,
						apiName: data?.apiName,
					});

					// Check if this is actually a commitJob callback
					if (data?.apiName && data.apiName !== 'commitJob') {
						console.log('⚠️ Ignoring non-commitJob callback:', data.apiName);
						return;
					}

					if (resolved) {
						console.log('⚠️ Ignoring duplicate commitJob callback');
						return;
					}

					if (error) {
						console.error('❌ Commit job error:', error);
						resolved = true;
						resolve(false);
						return;
					}

					const { errorCode, info } = data.resultAck;
					console.log('🖨️ CommitJob result:', { errorCode, info });

					if (errorCode !== 0) {
						console.error(
							'❌ CommitJob failed with errorCode:',
							errorCode,
							'info:',
							info,
						);
						resolved = true;
						resolve(false);
						return;
					}

					console.log('✅ CommitJob succeeded!');
					resolved = true;
					resolve(true);
				},
			);
		});
	}

	// End print job
	private endPrintJob(): Promise<boolean> {
		console.log('🔚 ==> START EndPrintJob operation');

		if (typeof (window as any).endJob !== 'function') {
			console.error('❌ EndJob function not available on window');
			return Promise.resolve(false);
		}

		return new Promise((resolve) => {
			console.log('🔚 About to call endJob...');

			(window as any).endJob((error: any, data: any) => {
				console.log('🔚 EndJob callback received:', { error, data });

				if (error) {
					console.error('❌ End job error:', error);
					resolve(false);
					return;
				}

				const { errorCode, info } = data.resultAck;
				console.log('🔚 EndJob result:', { errorCode, info });

				if (errorCode !== 0) {
					console.error(
						'❌ EndJob failed with errorCode:',
						errorCode,
						'info:',
						info,
					);
					resolve(false);
					return;
				}

				console.log('✅ EndJob succeeded!');
				resolve(true);
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

	// Get printer status information
	getPrinterStatus(): {
		isConnected: boolean;
		isSdkInitialized: boolean;
		selectedPrinter: string | null;
		hasRequiredFunctions: boolean;
	} {
		const hasRequiredFunctions =
			typeof window !== 'undefined' &&
			typeof (window as any).getInstance === 'function' &&
			typeof (window as any).initSdk === 'function' &&
			typeof (window as any).getAllPrinters === 'function' &&
			typeof (window as any).selectPrinter === 'function';

		return {
			isConnected: this.isConnected,
			isSdkInitialized: this.isSdkInitialized,
			selectedPrinter: this.selectedPrinter,
			hasRequiredFunctions,
		};
	}

	// Test if the printer service is fully ready
	isFullyReady(): boolean {
		return this.isConnected && this.isSdkInitialized && !!this.selectedPrinter;
	}

	// Disconnect from printer service
	disconnect(): void {
		this.isConnected = false;
		this.isSdkInitialized = false;
		this.selectedPrinter = null;
		this.connectionRetries = 0;
		this.status = 'disconnected';
	}

	// Reset connection state (useful when WebSocket disconnects)
	resetConnection(): void {
		console.log('Resetting printer connection state');
		this.disconnect();
	}

	// Get connection retry count
	getRetryCount(): number {
		return this.connectionRetries;
	}

	// Check if max retries reached
	isMaxRetriesReached(): boolean {
		return this.connectionRetries >= this.maxRetries;
	}
}

// Export singleton instance
const printerService = PrinterService.getInstance();

export default printerService;
