'use client';

import { usePrinter } from '@/contexts/PrinterContext';
import { createClient } from '@/utils/supabase/client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface User {
	id: string;
	email: string;
	name?: string;
}

export default function Navigation() {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	const router = useRouter();
	const pathname = usePathname();
	
	// Get printer status from context
	const { isConnected, isSdkInitialized, selectedPrinter, isInitializing } = usePrinter();

	useEffect(() => {
		const checkUser = async () => {
			const supabase = await createClient();
			const {
				data: { session },
			} = await supabase.auth.getSession();

			if (!session) {
				setLoading(false);
				return;
			}

			// Check if user is admin
			const { data: adminData, error: adminError } = await supabase
				.from('admins')
				.select('id, email, name')
				.eq('email', session.user.email)
				.single();

			if (adminError || !adminData) {
				setLoading(false);
				return;
			}

			setUser({
				...session.user,
				...adminData,
			});
			setLoading(false);
		};

		checkUser();
	}, []);

	const handleLogout = async () => {
		const supabase = await createClient();
		await supabase.auth.signOut();
		setUser(null);
		router.push('/admin/login');
		router.refresh();
	};

	// Don't show navigation on login/signup pages or if loading
	if (
		loading ||
		pathname?.includes('/login') ||
		pathname?.includes('/signup')
	) {
		return null;
	}

	// Don't show navigation if user is not logged in (except on main QR scanner page)
	if (!user && pathname !== '/') {
		return null;
	}

	// Show different navigation based on whether user is admin or not
	// const isAdminArea = pathname?.startsWith('/admin');
	const isAdminArea = true;

	// Determine printer status for indicator
	const getPrinterStatus = () => {
		if (isInitializing) return { color: 'bg-yellow-500', text: 'Initializing...', icon: '⏳' };
		if (!isConnected) return { color: 'bg-red-500', text: 'Disconnected', icon: '❌' };
		if (!isSdkInitialized) return { color: 'bg-orange-500', text: 'SDK Not Ready', icon: '⚠️' };
		if (!selectedPrinter) return { color: 'bg-orange-500', text: 'No Printer Selected', icon: '🖨️' };
		return { color: 'bg-green-500', text: `Connected: ${selectedPrinter}`, icon: '✅' };
	};

	const printerStatus = getPrinterStatus();

	return (
		<nav className="bg-white shadow">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex justify-between h-16">
					<div className="flex">
						<div className="flex-shrink-0 flex items-center">
							<h1 className="text-xl font-bold">
								{isAdminArea ? 'QR Attendance Admin' : 'QR Attendance System'}
							</h1>
						</div>
						{isAdminArea && user && (
							<div className="hidden sm:ml-6 sm:flex sm:space-x-8 sm:items-center">
								{/* Printer Status Indicator */}
								<div className="flex items-center gap-2 text-sm">
									<div className={`w-3 h-3 rounded-full ${printerStatus.color}`}></div>
									<span className="text-gray-600">
										{printerStatus.icon} {printerStatus.text}
									</span>
								</div>
								
								<a
									href="/admin/participants"
									className={`${
										pathname === '/admin/participants'
											? 'border-indigo-500 text-gray-900'
											: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
									} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
								>
									Participants
								</a>
								<a
									href="/"
									className={`${
										pathname === '/'
											? 'border-indigo-500 text-gray-900'
											: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
									} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
								>
									QR Scanner
								</a>
								<a
									href="/admin/printer"
									className={`${
										pathname === '/admin/printer'
											? 'border-indigo-500 text-gray-900'
											: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
									} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
								>
									Printer
								</a>
							</div>
						)}
					</div>
					{user && (
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<button
									type="button"
									onClick={handleLogout}
									className="relative inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
								>
									Logout
								</button>
							</div>
							<div className="ml-3 relative">
								<div className="text-sm text-gray-700">
									{user?.name || user?.email}
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</nav>
	);
}
