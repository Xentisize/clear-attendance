"use client";

import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminDashboard() {
	const [user, setUser] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const router = useRouter();

	useEffect(() => {
		const checkUser = async () => {
			const supabase = await createClient();
			const {
				data: { session },
			} = await supabase.auth.getSession();

			if (!session) {
				router.push("/admin/login");
				return;
			}

			// Check if user is admin
			const { data: adminData, error: adminError } = await supabase
				.from("admins")
				.select("id, email, name")
				.eq("email", session.user.email)
				.single();

			if (adminError || !adminData) {
				// Sign out if not admin
				await supabase.auth.signOut();
				router.push("/admin/login");
				return;
			}

			setUser({
				...session.user,
				...adminData,
			});
			setLoading(false);
		};

		checkUser();
	}, [router]);

	const handleLogout = async () => {
		const supabase = await createClient();
		await supabase.auth.signOut();
		router.push("/admin/login");
		router.refresh();
	};

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<nav className="bg-white shadow">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between h-16">
						<div className="flex">
							<div className="flex-shrink-0 flex items-center">
								<h1 className="text-xl font-bold">QR Attendance Admin</h1>
							</div>
							<div className="hidden sm:ml-6 sm:flex sm:space-x-8">
								<a
									href="/admin/dashboard"
									className="border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
								>
									Dashboard
								</a>
								<a
									href="/admin/participants"
									className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
								>
									Participants
								</a>
							</div>
						</div>
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<button
									onClick={handleLogout}
									className="relative inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
									type="button"
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
					</div>
				</div>
			</nav>

			<main>
				<div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
					<div className="px-4 py-6 sm:px-0">
						<div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
							<div className="text-center">
								<h2 className="text-2xl font-bold text-gray-900 mb-4">
									Admin Dashboard
								</h2>
								<p className="text-gray-600 mb-6">
									Welcome to the QR Attendance Admin Panel
								</p>
								<div className="flex justify-center space-x-4">
									<a
										href="/admin/participants"
										className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
									>
										Manage Participants
									</a>
								</div>
							</div>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}
