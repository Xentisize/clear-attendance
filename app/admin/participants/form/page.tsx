'use client';

import ParticipantCard from '@/components/ParticipantCard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/utils/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

type Participant = {
	id: string;
	staff_id: string;
	title: string;
	first_name: string;
	last_name: string;
	email: string;
	post: string;
	department: string;
	attended: boolean;
	created_at: string;
};

type FormData = Omit<Participant, 'id' | 'created_at'>;

function SearchParamsWrapper({
	children,
}: {
	children: (editId: string | null) => React.ReactNode;
}) {
	const searchParams = useSearchParams();
	const editId = searchParams.get('edit');
	return <>{children(editId)}</>;
}

function ParticipantForm({ editId }: { editId: string | null }) {
	const [loading, setLoading] = useState(true);
	const [participant, setParticipant] = useState<Participant | null>(null);
	const [formData, setFormData] = useState<FormData>({
		staff_id: '',
		title: '',
		first_name: '',
		last_name: '',
		email: '',
		post: '',
		department: '',
		attended: false,
	});
	const [formError, setFormError] = useState<string | null>(null);
	const [formLoading, setFormLoading] = useState(false);
	const [showPreview, setShowPreview] = useState(false);
	const [previewParticipant, setPreviewParticipant] =
		useState<Participant | null>(null);

	const router = useRouter();
	const isEditing = !!editId;

	const fetchParticipant = useCallback(async (id: string) => {
		try {
			const supabase = await createClient();
			const { data, error } = await supabase
				.from('participants')
				.select('*')
				.eq('id', id)
				.single();

			if (error) throw error;

			setParticipant(data);
			setFormData({
				staff_id: data.staff_id,
				title: data.title,
				first_name: data.first_name,
				last_name: data.last_name,
				email: data.email,
				post: data.post,
				department: data.department,
				attended: data.attended,
			});
		} catch (error) {
			console.error('Error fetching participant:', error);
			setFormError('Failed to load participant data');
		}
	}, []);

	useEffect(() => {
		const checkAuth = async () => {
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
				await supabase.auth.signOut();
				router.push('/admin/login');
				return;
			}

			if (isEditing && editId) {
				await fetchParticipant(editId);
			}

			setLoading(false);
		};

		checkAuth();
	}, [router, isEditing, editId, fetchParticipant]);

	const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value, type, checked } = e.target;
		const newValue = type === 'checkbox' ? checked : value;
		setFormData((prev) => ({ ...prev, [name]: newValue }));

		// Update preview participant if preview is shown
		if (showPreview) {
			setPreviewParticipant((prev) =>
				prev ? { ...prev, [name]: newValue } : null,
			);
		}
	};

	const validateForm = () => {
		if (!formData.staff_id.trim()) {
			return 'Staff ID is required';
		}
		if (!formData.first_name.trim()) {
			return 'First name is required';
		}
		if (!formData.last_name.trim()) {
			return 'Last name is required';
		}
		return null;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setFormError(null);

		const error = validateForm();
		if (error) {
			setFormError(error);
			return;
		}

		setFormLoading(true);

		try {
			const supabase = await createClient();

			if (isEditing && participant) {
				// Update existing participant
				const { error: updateError } = await supabase
					.from('participants')
					.update(formData)
					.eq('id', participant.id);

				if (updateError) throw updateError;
			} else {
				// Add new participant
				const { error: insertError } = await supabase
					.from('participants')
					.insert([formData]);

				if (insertError) throw insertError;
			}

			// Redirect back to participants page
			router.push('/admin/participants');
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error
					? error.message
					: 'An error occurred while saving the participant.';
			setFormError(errorMessage);
		} finally {
			setFormLoading(false);
		}
	};

	const generatePreview = () => {
		const error = validateForm();
		if (error) {
			setFormError(error);
			return;
		}

		setFormError(null);
		setPreviewParticipant({
			id: `preview-${Date.now()}`,
			...formData,
			created_at: new Date().toISOString(),
		});
		setShowPreview(true);
	};

	const closePreview = () => {
		setShowPreview(false);
		setPreviewParticipant(null);
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
			<main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
				<div className="px-4 py-6 sm:px-0">
					{/* Header */}
					<div className="mb-6">
						<div className="flex items-center justify-between">
							<div>
								<h1 className="text-2xl font-bold text-gray-900">
									{isEditing ? 'Edit Participant' : 'Add New Participant'}
								</h1>
								<p className="mt-1 text-sm text-gray-500">
									{isEditing
										? 'Update participant information and preview the changes'
										: 'Enter participant information and preview before saving'}
								</p>
							</div>
							<Button
								onClick={() => router.push('/admin/participants')}
								variant="outline"
							>
								Back to Participants
							</Button>
						</div>
					</div>

					{/* Form */}
					<Card className="mb-6">
						<CardHeader>
							<CardTitle>
								{isEditing
									? 'Edit Participant Information'
									: 'Participant Information'}
							</CardTitle>
							<CardDescription>
								Fill in the required fields marked with an asterisk (*)
							</CardDescription>
						</CardHeader>
						<CardContent>
							{formError && (
								<Alert variant="destructive" className="mb-4">
									<AlertDescription>{formError}</AlertDescription>
								</Alert>
							)}

							<form
								onSubmit={handleSubmit}
								className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6"
							>
								<div className="sm:col-span-2">
									<Label htmlFor="staff_id">Staff ID *</Label>
									<Input
										type="text"
										name="staff_id"
										id="staff_id"
										value={formData.staff_id}
										onChange={handleFormChange}
										className="mt-1"
									/>
								</div>

								<div className="sm:col-span-1">
									<Label htmlFor="title">Title</Label>
									<Input
										type="text"
										name="title"
										id="title"
										value={formData.title}
										onChange={handleFormChange}
										className="mt-1"
										placeholder="Mr., Ms., Dr., etc."
									/>
								</div>

								<div className="sm:col-span-2">
									<Label htmlFor="first_name">First Name *</Label>
									<Input
										type="text"
										name="first_name"
										id="first_name"
										value={formData.first_name}
										onChange={handleFormChange}
										className="mt-1"
									/>
								</div>

								<div className="sm:col-span-2">
									<Label htmlFor="last_name">Last Name *</Label>
									<Input
										type="text"
										name="last_name"
										id="last_name"
										value={formData.last_name}
										onChange={handleFormChange}
										className="mt-1"
									/>
								</div>

								<div className="sm:col-span-3">
									<Label htmlFor="email">Email</Label>
									<Input
										type="email"
										name="email"
										id="email"
										value={formData.email}
										onChange={handleFormChange}
										className="mt-1"
										placeholder="participant@example.com"
									/>
								</div>

								<div className="sm:col-span-3">
									<Label htmlFor="post">Position/Post</Label>
									<Input
										type="text"
										name="post"
										id="post"
										value={formData.post}
										onChange={handleFormChange}
										className="mt-1"
										placeholder="Job title or position"
									/>
								</div>

								<div className="sm:col-span-6">
									<Label htmlFor="department">Department</Label>
									<Input
										type="text"
										name="department"
										id="department"
										value={formData.department}
										onChange={handleFormChange}
										className="mt-1"
										placeholder="Department or division"
									/>
								</div>

								<div className="sm:col-span-6">
									<div className="flex items-center">
										<input
											type="checkbox"
											name="attended"
											id="attended"
											checked={formData.attended}
											onChange={handleFormChange}
											className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
										/>
										<Label
											htmlFor="attended"
											className="ml-2 text-sm font-medium text-gray-700"
										>
											Mark as attended
										</Label>
									</div>
									<p className="mt-1 text-sm text-gray-500">
										Check this box if the participant has already attended the
										event
									</p>
								</div>

								<div className="sm:col-span-6 flex justify-between">
									<Button
										type="button"
										variant="outline"
										onClick={generatePreview}
										disabled={formLoading}
									>
										Preview Badge
									</Button>
									<div className="flex space-x-3">
										<Button
											type="button"
											variant="outline"
											onClick={() => router.push('/admin/participants')}
										>
											Cancel
										</Button>
										<Button type="submit" disabled={formLoading}>
											{formLoading
												? 'Saving...'
												: isEditing
													? 'Update Participant'
													: 'Add Participant'}
										</Button>
									</div>
								</div>
							</form>
						</CardContent>
					</Card>

					{/* Current Participant Preview (for editing) */}
					{/* {isEditing && participant && (
						<div className="mb-6">
							<h2 className="text-lg font-semibold text-gray-900 mb-4">
								Current Participant Information
							</h2>
							<ParticipantCard
								participant={participant}
								showActions={false}
								showLabelPreview={true}
							/>
						</div>
					)} */}
				</div>
			</main>

			{/* Preview Modal */}
			{showPreview && previewParticipant && (
				<div className="fixed z-50 inset-0 overflow-y-auto">
					<div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
						<div
							className="fixed inset-0 transition-opacity"
							aria-hidden="true"
							onClick={closePreview}
						>
							<div className="absolute inset-0 bg-gray-500 opacity-75"></div>
						</div>

						<span
							className="hidden sm:inline-block sm:align-middle sm:h-screen"
							aria-hidden="true"
						>
							&#8203;
						</span>

						<div className="inline-block align-bottom bg-gray-50 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full relative z-50 max-h-[90vh] overflow-y-auto">
							<div className="bg-gray-50 px-6 pt-6">
								<div className="flex justify-between items-center mb-4">
									<h2 className="text-xl font-semibold text-gray-900">
										Badge Preview
									</h2>
									<Button onClick={closePreview} variant="outline" size="sm">
										Close Preview
									</Button>
								</div>
								<ParticipantCard
									participant={previewParticipant}
									showActions={false}
									showLabelPreview={true}
									className="pb-6"
								/>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function LoadingFallback() {
	return (
		<div className="min-h-screen flex items-center justify-center">
			<div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
		</div>
	);
}

export default function ParticipantFormPage() {
	return (
		<Suspense fallback={<LoadingFallback />}>
			<SearchParamsWrapper>
				{(editId) => <ParticipantForm editId={editId} />}
			</SearchParamsWrapper>
		</Suspense>
	);
}
