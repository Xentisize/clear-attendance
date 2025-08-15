'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePrinter } from '@/contexts/PrinterContext';
import { cn } from '@/lib/utils';
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
import { useEffect, useState } from 'react';

interface PrinterDevice {
	name: string;
	port: number;
}

export default function PrinterManagement() {
	const [loading, setLoading] = useState(true);
	const [testPrintLoading, setTestPrintLoading] = useState(false);
	const [message, setMessage] = useState<{
		type: 'success' | 'error' | 'info';
		text: string;
	} | null>(null);
	const router = useRouter();

	// Use printer context instead of managing state locally
	const {
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
	} = usePrinter();

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

	// Show initialization error if any
	useEffect(() => {
		if (initializationError) {
			setMessage({
				type: 'error',
				text: initializationError,
			});
		}
	}, [initializationError]);

	const handleRefreshPrinters = async () => {
		setMessage(null);
		try {
			await refreshPrinters();
			setMessage({
				type: 'success',
				text: `Found ${availablePrinters.length} printer(s).`,
			});
		} catch (error) {
			console.error('Error refreshing printers:', error);
			setMessage({ type: 'error', text: 'Failed to refresh printer list.' });
		}
	};

	const handleSelectPrinter = async (printer: PrinterDevice) => {
		setMessage(null);
		try {
			const success = await selectPrinter(printer.name, printer.port);
			if (success) {
				setMessage({
					type: 'success',
					text: `Printer "${printer.name}" selected successfully.`,
				});
			} else {
				setMessage({
					type: 'error',
					text: `Failed to select printer "${printer.name}".`,
				});
			}
		} catch (error) {
			console.error('Error selecting printer:', error);
			setMessage({
				type: 'error',
				text: 'An error occurred while selecting the printer.',
			});
		}
	};

	const handleReinitialize = async () => {
		setMessage(null);
		try {
			await reinitialize();
			setMessage({
				type: 'success',
				text: 'Printer service reinitialized successfully.',
			});
		} catch (error) {
			console.error('Error reinitializing:', error);
			setMessage({
				type: 'error',
				text: 'Failed to reinitialize printer service.',
			});
		}
	};

	const testPrint = async () => {
		setTestPrintLoading(true);
		setMessage(null);

		try {
			// Create test participant data
			const testParticipant = {
				name: 'Test User',
				id: 'TEST001',
				department: 'IT Department'
			};

			await printParticipantBadge(testParticipant);
			setMessage({
				type: 'success',
				text: 'Test label printed successfully.',
			});
		} catch (error) {
			console.error('Test print error:', error);
			setMessage({
				type: 'error',
				text: `Test print failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
										{isConnected ? (
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
													isConnected ? 'default' : 'destructive'
												}
												className="mt-1"
											>
												{isConnected
													? 'Connected'
													: 'Disconnected'}
											</Badge>
											{isInitializing && (
												<div className="text-xs text-blue-600 mt-1">
													Initializing...
												</div>
											)}
										</div>
									</div>
									<div className="flex items-center">
										{isSdkInitialized ? (
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
													isSdkInitialized
														? 'default'
														: 'destructive'
												}
												className="mt-1"
											>
												{isSdkInitialized
													? 'Initialized'
													: 'Not Initialized'}
											</Badge>
										</div>
									</div>
									<div className="flex items-center">
										{selectedPrinter ? (
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
													selectedPrinter ? 'default' : 'outline'
												}
												className="mt-1"
											>
												{selectedPrinter || 'None'}
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
										onClick={handleReinitialize}
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
											: 'Reinitialize Printer Service'}
									</Button>

									<Button
										variant="outline"
										onClick={handleRefreshPrinters}
										disabled={!isConnected}
										className="flex items-center gap-2"
									>
										<RefreshCw className="h-4 w-4" />
										Refresh Printers
									</Button>

									<Button
										variant="default"
										onClick={testPrint}
										disabled={
											!selectedPrinter || testPrintLoading
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
								{availablePrinters.length === 0 ? (
									<div className="text-center py-8">
										<Printer className="mx-auto h-12 w-12 text-gray-400 mb-4" />
										<div className="text-gray-500 mb-2">No printers found</div>
										<div className="text-sm text-gray-400">
											{!isConnected
												? 'Please initialize the printer service first.'
												: 'Click "Refresh Printers" to scan for available printers.'}
										</div>
									</div>
								) : (
									<div className="space-y-3">
										{availablePrinters.map((printer: PrinterDevice) => (
											<Card
												key={`${printer.name}-${printer.port}`}
												className={cn(
													'p-4 transition-colors cursor-pointer',
													selectedPrinter === printer.name
														? 'border-primary bg-primary/5'
														: 'hover:bg-gray-50',
												)}
											>
												<div className="flex items-center justify-between">
													<div className="flex items-center">
														<Printer
															className={cn(
																'h-4 w-4 mr-3',
																selectedPrinter === printer.name
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
														{selectedPrinter === printer.name ? (
															<Badge variant="default">Selected</Badge>
														) : (
															<Button
																variant="outline"
																size="sm"
																onClick={() => handleSelectPrinter(printer)}
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
