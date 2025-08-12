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
class SDKWrapper {
	private getWindow() {
		// biome-ignore lint/suspicious/noExplicitAny: Third-party SDK requires dynamic window access
		return window as any;
	}

	hasMethod(methodName: string): boolean {
		return typeof this.getWindow()[methodName] === 'function';
	}

	getInstance(
		onConnected: () => void,
		onNotSupported: () => void,
		onDisconnected: () => void,
		onPrinterDisconnected: () => void,
	): void {
		this.getWindow().getInstance(
			onConnected,
			onNotSupported,
			onDisconnected,
			onPrinterDisconnected,
		);
	}

	// biome-ignore lint/suspicious/noExplicitAny: Third-party SDK callback types
	initSdk(
		params: { fontDir: string },
		callback: (error: any, data: any) => void,
	): void {
		this.getWindow().initSdk(params, callback);
	}

	// biome-ignore lint/suspicious/noExplicitAny: Third-party SDK callback types
	getAllPrinters(callback: (error: any, data: any) => void): void {
		this.getWindow().getAllPrinters(callback);
	}

	// biome-ignore lint/suspicious/noExplicitAny: Third-party SDK callback types
	selectPrinter(
		name: string,
		port: number,
		callback: (error: any, data: any) => void,
	): void {
		this.getWindow().selectPrinter(name, port, callback);
	}

	// biome-ignore lint/suspicious/noExplicitAny: Third-party SDK callback types
	InitDrawingBoard(
		params: DrawingBoardParams,
		callback: (error: any, data: any) => void,
	): void {
		this.getWindow().InitDrawingBoard(params, callback);
	}

	// biome-ignore lint/suspicious/noExplicitAny: Third-party SDK callback types
	DrawLableText(
		params: PrintTextParams,
		callback: (error: any, data: any) => void,
	): void {
		this.getWindow().DrawLableText(params, callback);
	}

	// biome-ignore lint/suspicious/noExplicitAny: Third-party SDK callback types
	DrawLableQrCode(
		params: PrintQRCodeParams,
		callback: (error: any, data: any) => void,
	): void {
		this.getWindow().DrawLableQrCode(params, callback);
	}

	// biome-ignore lint/suspicious/noExplicitAny: Third-party SDK callback types
	startJob(
		density: number,
		labelType: number,
		mode: number,
		count: number,
		callback: (error: any, data: any) => void,
	): void {
		this.getWindow().startJob(density, labelType, mode, count, callback);
	}

	// biome-ignore lint/suspicious/noExplicitAny: Third-party SDK callback types
	commitJob(
		param1: any,
		param2: string,
		callback: (error: any, data: any) => void,
	): void {
		this.getWindow().commitJob(param1, param2, callback);
	}

	// biome-ignore lint/suspicious/noExplicitAny: Third-party SDK callback types
	endJob(callback: (error: any, data: any) => void): void {
		this.getWindow().endJob(callback);
	}
}

class PrinterService {
	private isConnected: boolean = false;
	private isSdkInitialized: boolean = false;
	private selectedPrinter: string | null = null;
	private status: string = 'disconnected';
	private sdk: SDKWrapper = new SDKWrapper();

	// Initialize the printer service connection
	async initialize(): Promise<boolean> {
		return new Promise((resolve) => {
			// Check if SDK is available
			if (!this.sdk.hasMethod('getInstance')) {
				console.warn('Printer SDK not available');
				resolve(false);
				return;
			}

			// Initialize the printer SDK connection
			try {
				this.sdk.getInstance(
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
			if (!this.sdk.hasMethod('initSdk')) {
				console.warn('Printer SDK initSdk method not available');
				resolve(false);
				return;
			}

			try {
				const initParams = { fontDir: '/public/js/' };
				this.sdk.initSdk(initParams, (error, data) => {
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

		// Check if getAllPrinters function is available
		if (!this.sdk.hasMethod('getAllPrinters')) {
			console.warn('getAllPrinters function not available');
			return [];
		}

		return new Promise((resolve) => {
			this.sdk.getAllPrinters((error, data) => {
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
			return false;
		}

		// Check if selectPrinter function is available
		if (typeof (window as any).selectPrinter !== 'function') {
			console.warn('selectPrinter function not available');
			return false;
		}

		return new Promise((resolve) => {
			(window as any).selectPrinter(
				printerName,
				port,
				(error: any, data: any) => {
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
				},
			);
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
				path: '',
				verticalShift: 0,
				HorizontalShift: 0,
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
	private async drawParticipantInfo(
		participant: any,
		labelWidth: number,
		labelHeight: number,
	): Promise<void> {
		// Draw title
		await this.drawText(
			'ATTENDANCE LABEL',
			2,
			2,
			labelWidth - 4,
			4,
			0,
			3.5,
			1,
			1,
		);

		// Draw participant name
		const name =
			`${participant.title || ''} ${participant.first_name} ${participant.last_name}`.trim();
		await this.drawText(name, 2, 7, labelWidth - 4, 4, 0, 3, 0, 1);

		// Draw staff ID
		await this.drawText(
			`ID: ${participant.staff_id}`,
			2,
			11,
			labelWidth - 4,
			3,
			0,
			2.5,
			0,
			1,
		);

		// Draw department
		await this.drawText(
			`${participant.department || ''}`,
			2,
			14,
			labelWidth - 4,
			3,
			0,
			2.5,
			0,
			1,
		);

		// Draw post
		await this.drawText(
			`${participant.post || ''}`,
			2,
			17,
			labelWidth - 4,
			3,
			0,
			2.5,
			0,
			1,
		);

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
			const printerImageProcessingInfo = JSON.stringify({
				printerImageProcessingInfo: {
					printQuantity: 1,
				},
			});

			(window as any).commitJob(
				null,
				printerImageProcessingInfo,
				(error: any, data: any) => {
					if (error) {
						console.error('Commit job error:', error);
						resolve(false);
						return;
					}

					const { errorCode } = data.resultAck;
					resolve(errorCode === 0);
				},
			);
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
	}
}

// Create singleton instance
const printerService = new PrinterService();

export default printerService;
