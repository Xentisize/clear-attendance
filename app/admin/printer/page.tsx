'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import printerService from '@/utils/printerService';
import { createClient } from '@/utils/supabase/client';
import {
	AlertCircle,
	CheckCircle2,
	Info,
	Loader2,
	Printer,
	RefreshCw,
	Settings,
	Wifi,
	WifiOff,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface PrinterDevice {
	name: string;
	port: number;
}

interface PrinterStatus {
	isConnected: boolean;
	isSdkInitialized: boolean;
	selectedPrinter: string | null;
	availablePrinters: PrinterDevice[];
	retryCount?: number;
	maxRetriesReached?: boolean;
}

export default function PrinterManagement() {
	const [loading, setLoading] = useState(true);
	const [printerStatus, setPrinterStatus] = useState<PrinterStatus>({
		isConnected: false,
		isSdkInitialized: false,
		selectedPrinter: null,
		availablePrinters: [] as PrinterDevice[],
		retryCount: 0,
		maxRetriesReached: false,
	});
	const [isInitializing, setIsInitializing] = useState(false);
	const [isRefreshingPrinters, setIsRefreshingPrinters] = useState(false);
	const [testPrintLoading, setTestPrintLoading] = useState(false);
	const [message, setMessage] = useState<{
		type: 'success' | 'error' | 'info';
		text: string;
	} | null>(null);
	const router = useRouter();

	const checkPrinterStatus = useCallback(async () => {
		const status: PrinterStatus = {
			isConnected: printerService.isConnectedService(),
			isSdkInitialized: printerService.isSdkInitializedService(),
			selectedPrinter: printerService.getSelectedPrinter(),
			availablePrinters: [],
			retryCount: printerService.getRetryCount(),
			maxRetriesReached: printerService.isMaxRetriesReached(),
		};

		if (status.isConnected) {
			try {
				const printers = await printerService.getPrinters();
				status.availablePrinters = printers as PrinterDevice[];
			} catch (error) {
				console.error('Error getting printers:', error);
			}
		}

		setPrinterStatus(status);
	}, []);

	useEffect(() => {
		const checkUser = async () => {
			const supabase = await createClient();
			const {
				data: { session },
			} = await supabase.auth.getSession();

			if (!session) {
				router.push('/admin/login');
				return;
			}

			// Check if user is admin
			const { data: adminData, error: adminError } = await supabase
				.from('admins')
				.select('id, email, name')
				.eq('email', session.user.email)
				.single();

			if (adminError || !adminData) {
				// Sign out if not admin
				await supabase.auth.signOut();
				router.push('/admin/login');
				return;
			}

			setLoading(false);
		};

		checkUser();
	}, [router]);

	useEffect(() => {
		// Check printer status on component mount
		const checkStatus = async () => {
			await checkPrinterStatus();
		};
		checkStatus();
	}, [checkPrinterStatus]);

	const initializePrinter = async () => {
		setIsInitializing(true);
		setMessage(null);

		try {
			// Initialize service
			const serviceConnected = await printerService.initialize();
			if (!serviceConnected) {
				setMessage({
					type: 'error',
					text: 'Failed to connect to printer service. Please ensure the printer plugin is installed and running.',
				});
				setIsInitializing(false);
				return;
			}

			// Initialize SDK
			const sdkInitialized = await printerService.initializeSdk();
			if (!sdkInitialized) {
				setMessage({
					type: 'error',
					text: 'Failed to initialize printer SDK.',
				});
				setIsInitializing(false);
				return;
			}

			setMessage({
				type: 'success',
				text: 'Printer service initialized successfully.',
			});
			await checkPrinterStatus();
		} catch (error) {
			console.error('Initialization error:', error);
			setMessage({
				type: 'error',
				text: 'An error occurred during initialization.',
			});
		} finally {
			setIsInitializing(false);
		}
	};

	const refreshPrinters = async () => {
		setIsRefreshingPrinters(true);
		setMessage(null);

		try {
			const printers = await printerService.getPrinters();
			setPrinterStatus((prev) => ({ ...prev, availablePrinters: printers }));
			setMessage({
				type: 'success',
				text: `Found ${printers.length} printer(s).`,
			});
		} catch (error) {
			console.error('Error refreshing printers:', error);
			setMessage({ type: 'error', text: 'Failed to refresh printer list.' });
		} finally {
			setIsRefreshingPrinters(false);
		}
	};

	const selectPrinter = async (printer: PrinterDevice) => {
		setMessage(null);

		try {
			// Check if service is still connected before selecting
			if (!printerService.isConnectedService()) {
				setMessage({
					type: 'error',
					text: 'Printer service disconnected. Please reinitialize.',
				});
				await checkPrinterStatus();
				return;
			}

			const success = await printerService.selectPrinter(
				printer.name,
				printer.port,
			);
			if (success) {
				setMessage({
					type: 'success',
					text: `Printer "${printer.name}" selected successfully.`,
				});
				// Update status without calling getPrinters() to avoid WebSocket overload
				const status: PrinterStatus = {
					isConnected: printerService.isConnectedService(),
					isSdkInitialized: printerService.isSdkInitializedService(),
					selectedPrinter: printerService.getSelectedPrinter(),
					availablePrinters: printerStatus.availablePrinters, // Keep existing list
					retryCount: printerService.getRetryCount(),
					maxRetriesReached: printerService.isMaxRetriesReached(),
				};
				setPrinterStatus(status);
			} else {
				// Check if we should suggest reconnection
				const retryCount = printerService.getRetryCount();
				const maxReached = printerService.isMaxRetriesReached();

				let errorMessage = `Failed to select printer "${printer.name}".`;
				if (maxReached) {
					errorMessage +=
						' Maximum retry attempts reached. Please reinitialize the service.';
				} else if (retryCount > 0) {
					errorMessage += ` Retry attempt ${retryCount} failed.`;
				}

				setMessage({
					type: 'error',
					text: errorMessage,
				});
				await checkPrinterStatus();
			}
		} catch (error) {
			console.error('Error selecting printer:', error);
			setMessage({
				type: 'error',
				text: 'An error occurred while selecting the printer. The connection may have been lost.',
			});
			// Reset connection state if there's an error
			printerService.resetConnection();
			await checkPrinterStatus();
		}
	};

	const resetConnection = async () => {
		setMessage(null);
		printerService.resetConnection();
		setMessage({
			type: 'info',
			text: 'Connection reset. Please reinitialize the printer service.',
		});
		await checkPrinterStatus();
	};

	const testPrint = async () => {
		setTestPrintLoading(true);
		setMessage(null);

		try {
			// Create test participant data
			const testParticipant = {
				id: 'test-001',
				title: 'Mr.',
				first_name: 'Test',
				last_name: 'User',
				staff_id: 'EMP001',
				department: 'IT Department',
				post: 'Software Engineer',
			};

			const success =
				await printerService.printParticipantLabel(testParticipant);
			if (success) {
				setMessage({
					type: 'success',
					text: 'Test label printed successfully.',
				});
			} else {
				setMessage({ type: 'error', text: 'Failed to print test label.' });
			}
		} catch (error) {
			console.error('Test print error:', error);
			setMessage({
				type: 'error',
				text: 'An error occurred during test printing.',
			});
		} finally {
			setTestPrintLoading(false);
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin" />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<main>
				<div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
					<div className="px-4 py-6 sm:px-0">
						<div className="mb-6">
							<h2 className="text-2xl font-bold text-gray-900 mb-2">
								Printer Management
							</h2>
							<p className="text-gray-600">
								Monitor and manage the connected printer for attendance labels.
							</p>
						</div>

						{/* Message Display */}
						{message && (
							<Alert
								className="mb-6"
								variant={message.type === 'error' ? 'destructive' : 'default'}
							>
								{message.type === 'success' ? (
									<CheckCircle2 className="h-4 w-4" />
								) : message.type === 'error' ? (
									<AlertCircle className="h-4 w-4" />
								) : (
									<Info className="h-4 w-4" />
								)}
								<AlertDescription>{message.text}</AlertDescription>
							</Alert>
						)}

						{/* Printer Status */}
						<Card className="mb-6">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Settings className="h-5 w-5" />
									Printer Status
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									<div className="flex items-center">
										{printerStatus.isConnected ? (
											<Wifi className="h-4 w-4 text-green-500 mr-3" />
										) : (
											<WifiOff className="h-4 w-4 text-red-500 mr-3" />
										)}
										<div>
											<div className="text-sm font-medium text-gray-900">
												Service Connection
											</div>
											<Badge
												variant={
													printerStatus.isConnected ? 'default' : 'destructive'
												}
												className="mt-1"
											>
												{printerStatus.isConnected
													? 'Connected'
													: 'Disconnected'}
											</Badge>
											{((printerStatus.retryCount ?? 0) > 0 ||
												printerStatus.maxRetriesReached) && (
												<div className="text-xs text-orange-600 mt-1">
													{printerStatus.maxRetriesReached
														? 'Max retries reached'
														: `Retries: ${printerStatus.retryCount ?? 0}`}
												</div>
											)}
										</div>
									</div>
									<div className="flex items-center">
										{printerStatus.isSdkInitialized ? (
											<CheckCircle2 className="h-4 w-4 text-green-500 mr-3" />
										) : (
											<AlertCircle className="h-4 w-4 text-red-500 mr-3" />
										)}
										<div>
											<div className="text-sm font-medium text-gray-900">
												SDK Status
											</div>
											<Badge
												variant={
													printerStatus.isSdkInitialized
														? 'default'
														: 'destructive'
												}
												className="mt-1"
											>
												{printerStatus.isSdkInitialized
													? 'Initialized'
													: 'Not Initialized'}
											</Badge>
										</div>
									</div>
									<div className="flex items-center">
										{printerStatus.selectedPrinter ? (
											<Printer className="h-4 w-4 text-green-500 mr-3" />
										) : (
											<Printer className="h-4 w-4 text-gray-400 mr-3" />
										)}
										<div>
											<div className="text-sm font-medium text-gray-900">
												Selected Printer
											</div>
											<Badge
												variant={
													printerStatus.selectedPrinter ? 'default' : 'outline'
												}
												className="mt-1"
											>
												{printerStatus.selectedPrinter || 'None'}
											</Badge>
										</div>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Control Panel */}
						<Card className="mb-6">
							<CardHeader>
								<CardTitle>Control Panel</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="flex flex-wrap gap-4">
									<Button
										onClick={initializePrinter}
										disabled={isInitializing}
										className="flex items-center gap-2"
									>
										{isInitializing ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<Settings className="h-4 w-4" />
										)}
										{isInitializing
											? 'Initializing...'
											: 'Initialize Printer Service'}
									</Button>

									<Button
										variant="outline"
										onClick={refreshPrinters}
										disabled={
											!printerStatus.isConnected || isRefreshingPrinters
										}
										className="flex items-center gap-2"
									>
										{isRefreshingPrinters ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<RefreshCw className="h-4 w-4" />
										)}
										{isRefreshingPrinters
											? 'Refreshing...'
											: 'Refresh Printers'}
									</Button>

									<Button
										variant="default"
										onClick={testPrint}
										disabled={
											!printerStatus.selectedPrinter || testPrintLoading
										}
										className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
									>
										{testPrintLoading ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<Printer className="h-4 w-4" />
										)}
										{testPrintLoading ? 'Printing...' : 'Test Print'}
									</Button>

									<Button
										variant="outline"
										onClick={checkPrinterStatus}
										className="flex items-center gap-2"
									>
										<RefreshCw className="h-4 w-4" />
										Refresh Status
									</Button>

									{((printerStatus.retryCount ?? 0) > 0 ||
										printerStatus.maxRetriesReached) && (
										<Button
											variant="outline"
											onClick={resetConnection}
											className="flex items-center gap-2 border-orange-500 text-orange-600 hover:bg-orange-50"
										>
											<WifiOff className="h-4 w-4" />
											Reset Connection
										</Button>
									)}
								</div>
							</CardContent>
						</Card>

						{/* Available Printers */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Printer className="h-5 w-5" />
									Available Printers
								</CardTitle>
							</CardHeader>
							<CardContent>
								{printerStatus.availablePrinters.length === 0 ? (
									<div className="text-center py-8">
										<Printer className="mx-auto h-12 w-12 text-gray-400 mb-4" />
										<div className="text-gray-500 mb-2">No printers found</div>
										<div className="text-sm text-gray-400">
											{!printerStatus.isConnected
												? 'Please initialize the printer service first.'
												: 'Click "Refresh Printers" to scan for available printers.'}
										</div>
									</div>
								) : (
									<div className="space-y-3">
										{printerStatus.availablePrinters.map((printer) => (
											<Card
												key={`${printer.name}-${printer.port}`}
												className={cn(
													'p-4 transition-colors cursor-pointer',
													printerStatus.selectedPrinter === printer.name
														? 'border-primary bg-primary/5'
														: 'hover:bg-gray-50',
												)}
											>
												<div className="flex items-center justify-between">
													<div className="flex items-center">
														<Printer
															className={cn(
																'h-4 w-4 mr-3',
																printerStatus.selectedPrinter === printer.name
																	? 'text-primary'
																	: 'text-gray-400',
															)}
														/>
														<div>
															<div className="text-sm font-medium text-gray-900">
																{printer.name}
															</div>
															<div className="text-sm text-gray-500">
																Port: {printer.port}
															</div>
														</div>
													</div>
													<div>
														{printerStatus.selectedPrinter === printer.name ? (
															<Badge variant="default">Selected</Badge>
														) : (
															<Button
																variant="outline"
																size="sm"
																onClick={() => selectPrinter(printer)}
															>
																Select
															</Button>
														)}
													</div>
												</div>
											</Card>
										))}
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</div>
			</main>
		</div>
	);
}
