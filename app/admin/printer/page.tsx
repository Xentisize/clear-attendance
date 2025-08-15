'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
		printSettings,
		refreshPrinters,
		selectPrinter,
		reinitialize,
		printParticipantBadge,
		updatePrintSettings,
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
			// Create test participant data using current settings
			const testParticipant = {
				title: 'Mr.',
				firstName: 'John',
				lastName: 'Doe',
				position: 'Software Engineer',
				department: 'IT Department'
			};

			await printParticipantBadge(testParticipant);
			setMessage({
				type: 'success',
				text: 'Test label printed successfully with current settings.',
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

	const handleSettingChange = (key: keyof typeof printSettings, value: string | number | boolean) => {
		updatePrintSettings({ [key]: value });
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

						{/* Print Settings */}
						<Card className="mb-6">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Settings className="h-5 w-5" />
									Print Settings
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
									{/* Paper Dimensions */}
									<div className="space-y-4">
										<h4 className="text-sm font-medium text-gray-900">Paper Dimensions (mm)</h4>
										<div className="space-y-3">
											<div>
												<Label htmlFor="paperWidth">Width</Label>
												<Input
													id="paperWidth"
													type="number"
													value={printSettings.paperWidth}
													onChange={(e) => handleSettingChange('paperWidth', Number(e.target.value))}
													min="10"
													max="200"
													step="1"
												/>
											</div>
											<div>
												<Label htmlFor="paperHeight">Height</Label>
												<Input
													id="paperHeight"
													type="number"
													value={printSettings.paperHeight}
													onChange={(e) => handleSettingChange('paperHeight', Number(e.target.value))}
													min="10"
													max="200"
													step="1"
												/>
											</div>
										</div>
									</div>

									{/* Font Settings */}
									<div className="space-y-4">
										<h4 className="text-sm font-medium text-gray-900">Font Settings</h4>
										<div className="space-y-3">
											<div>
												<Label htmlFor="eventFontSize">Event Font Size</Label>
												<Input
													id="eventFontSize"
													type="number"
													value={printSettings.eventFontSize}
													onChange={(e) => handleSettingChange('eventFontSize', Number(e.target.value))}
													min="6"
													max="24"
													step="1"
												/>
											</div>
											<div>
												<Label htmlFor="nameFontSize">Name Font Size</Label>
												<Input
													id="nameFontSize"
													type="number"
													value={printSettings.nameFontSize}
													onChange={(e) => handleSettingChange('nameFontSize', Number(e.target.value))}
													min="6"
													max="48"
													step="1"
												/>
											</div>
											<div>
												<Label htmlFor="positionFontSize">Position Font Size</Label>
												<Input
													id="positionFontSize"
													type="number"
													value={printSettings.positionFontSize}
													onChange={(e) => handleSettingChange('positionFontSize', Number(e.target.value))}
													min="6"
													max="48"
													step="1"
												/>
											</div>
											<div>
												<Label htmlFor="departmentFontSize">Department Font Size</Label>
												<Input
													id="departmentFontSize"
													type="number"
													value={printSettings.departmentFontSize}
													onChange={(e) => handleSettingChange('departmentFontSize', Number(e.target.value))}
													min="6"
													max="48"
													step="1"
												/>
											</div>
											<div>
												<Label htmlFor="fontFamily">Font Family</Label>
												<select
													id="fontFamily"
													value={printSettings.fontFamily}
													onChange={(e) => handleSettingChange('fontFamily', e.target.value)}
													className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
												>
													<option value="Arial">Arial</option>
													<option value="Times New Roman">Times New Roman</option>
													<option value="Courier New">Courier New</option>
													<option value="Helvetica">Helvetica</option>
												</select>
											</div>
											<div>
												<Label htmlFor="lineSpacing">Line Spacing</Label>
												<Input
													id="lineSpacing"
													type="number"
													value={printSettings.lineSpacing}
													onChange={(e) => handleSettingChange('lineSpacing', Number(e.target.value))}
													min="1"
													max="10"
													step="0.5"
												/>
											</div>
										</div>
									</div>

									{/* Text Content Templates */}
									<div className="space-y-4">
										<h4 className="text-sm font-medium text-gray-900">Text Content & Prefixes</h4>
										<div className="space-y-3">
											{/* Event Name Section */}
											<div className="flex items-center space-x-2">
												<input
													type="checkbox"
													id="showEventName"
													checked={printSettings.showEventName}
													onChange={(e) => handleSettingChange('showEventName', e.target.checked)}
													className="rounded border-gray-300"
												/>
												<Label htmlFor="showEventName">Show Event Name</Label>
											</div>
											{printSettings.showEventName && (
												<div>
													<Label htmlFor="eventName">Event Name</Label>
													<Input
														id="eventName"
														type="text"
														value={printSettings.eventName}
														onChange={(e) => handleSettingChange('eventName', e.target.value)}
														placeholder="Company Event 2025"
													/>
												</div>
											)}
											
											<div className="border-t pt-3">
												<h5 className="text-xs font-medium text-gray-700 mb-3">Participant Information</h5>
											</div>
											
											<div className="flex items-center space-x-2">
												<input
													type="checkbox"
													id="showNamePrefix"
													checked={printSettings.showNamePrefix}
													onChange={(e) => handleSettingChange('showNamePrefix', e.target.checked)}
													className="rounded border-gray-300"
												/>
												<Label htmlFor="showNamePrefix">Show Name Prefix</Label>
											</div>
											{printSettings.showNamePrefix && (
												<div>
													<Label htmlFor="namePrefix">Name Prefix</Label>
													<Input
														id="namePrefix"
														type="text"
														value={printSettings.namePrefix}
														onChange={(e) => handleSettingChange('namePrefix', e.target.value)}
														placeholder="Name: "
													/>
												</div>
											)}
											
											<div className="flex items-center space-x-2">
												<input
													type="checkbox"
													id="showPositionPrefix"
													checked={printSettings.showPositionPrefix}
													onChange={(e) => handleSettingChange('showPositionPrefix', e.target.checked)}
													className="rounded border-gray-300"
												/>
												<Label htmlFor="showPositionPrefix">Show Position Prefix</Label>
											</div>
											{printSettings.showPositionPrefix && (
												<div>
													<Label htmlFor="positionPrefix">Position Prefix</Label>
													<Input
														id="positionPrefix"
														type="text"
														value={printSettings.positionPrefix}
														onChange={(e) => handleSettingChange('positionPrefix', e.target.value)}
														placeholder="Position: "
													/>
												</div>
											)}
											
											<div className="flex items-center space-x-2">
												<input
													type="checkbox"
													id="showDepartmentPrefix"
													checked={printSettings.showDepartmentPrefix}
													onChange={(e) => handleSettingChange('showDepartmentPrefix', e.target.checked)}
													className="rounded border-gray-300"
												/>
												<Label htmlFor="showDepartmentPrefix">Show Department Prefix</Label>
											</div>
											{printSettings.showDepartmentPrefix && (
												<div>
													<Label htmlFor="departmentPrefix">Department Prefix</Label>
													<Input
														id="departmentPrefix"
														type="text"
														value={printSettings.departmentPrefix}
														onChange={(e) => handleSettingChange('departmentPrefix', e.target.value)}
														placeholder="Dept: "
													/>
												</div>
											)}
										</div>
									</div>
								</div>

								{/* Preview of current settings */}
								<div className="mt-6 p-4 bg-gray-50 rounded-lg">
									<h5 className="text-sm font-medium text-gray-900 mb-2">Preview (Test Print Content)</h5>
									<div className="flex justify-center">
										<div 
											className="border-2 border-gray-300 bg-white relative"
											style={{
												width: `${printSettings.paperWidth * 4}px`, // Scale for visibility
												height: `${printSettings.paperHeight * 4}px`,
												minWidth: '200px',
												minHeight: '120px'
											}}
										>
											{/* Event name at top (if enabled) */}
											{printSettings.showEventName && (
												<>
													<div 
														className="absolute w-full text-center"
														style={{
															top: '8px',
															fontSize: `${printSettings.eventFontSize}px`,
															lineHeight: printSettings.lineSpacing
														}}
													>
														{printSettings.eventName}
													</div>
													{/* Divider line */}
													<div 
														className="absolute border-t border-gray-400"
														style={{
															top: `${8 + printSettings.eventFontSize * printSettings.lineSpacing * 4}px`,
															left: '20%',
															width: '60%'
														}}
													></div>
												</>
											)}
											
											{/* Participant info centered in remaining space */}
											<div 
												className="absolute w-full flex items-center justify-center"
												style={{
													top: printSettings.showEventName 
														? `${20 + printSettings.eventFontSize * printSettings.lineSpacing * 4}px`
														: '0',
													bottom: '0',
													left: '0',
													right: '0'
												}}
											>
												<div className="text-center space-y-1">
													<div style={{
														fontSize: `${printSettings.nameFontSize}px`, 
														fontWeight: 'bold', 
														lineHeight: printSettings.lineSpacing
													}}>
														{printSettings.showNamePrefix ? printSettings.namePrefix : ''}Mr. John Doe
													</div>
													<div style={{
														fontSize: `${printSettings.positionFontSize}px`, 
														lineHeight: printSettings.lineSpacing
													}}>
														{printSettings.showPositionPrefix ? printSettings.positionPrefix : ''}Software Engineer
													</div>
													<div style={{
														fontSize: `${printSettings.departmentFontSize}px`, 
														lineHeight: printSettings.lineSpacing
													}}>
														{printSettings.showDepartmentPrefix ? printSettings.departmentPrefix : ''}IT Department
													</div>
												</div>
											</div>
										</div>
									</div>
									<div className="text-xs mt-2 text-center text-gray-500">
										Size: {printSettings.paperWidth}mm × {printSettings.paperHeight}mm | 
										Font: {printSettings.fontFamily} | 
										Layout: {printSettings.showEventName ? 'Event name + Centered content' : 'Centered content only'}
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
