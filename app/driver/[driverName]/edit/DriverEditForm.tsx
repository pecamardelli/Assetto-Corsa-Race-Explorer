"use client";

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

type DriverProfile = {
  name: string;
  nationality: string;
  dateOfBirth: string;
  placeOfBirth: string;
  features: string;
  gender: string;
};

interface DriverEditFormProps {
  profile: DriverProfile;
  driverName: string;
}

export default function DriverEditForm({ profile, driverName }: DriverEditFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      nationality: formData.get('nationality') as string,
      dateOfBirth: formData.get('dateOfBirth') as string,
      placeOfBirth: formData.get('placeOfBirth') as string,
      gender: formData.get('gender') as string,
      features: formData.get('features') as string,
    };

    try {
      const response = await fetch(`/api/driver/${encodeURIComponent(driverName)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }

      // Redirect to driver page on success
      router.push(`/driver/${encodeURIComponent(driverName)}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-zinc-300 mb-2">
          Driver Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          defaultValue={profile.name}
          className="w-full px-4 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          readOnly
        />
        <p className="mt-1 text-xs text-zinc-500">Driver name cannot be changed</p>
      </div>

      {/* Nationality */}
      <div>
        <label htmlFor="nationality" className="block text-sm font-medium text-zinc-300 mb-2">
          Nationality
        </label>
        <input
          type="text"
          id="nationality"
          name="nationality"
          defaultValue={profile.nationality}
          required
          className="w-full px-4 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        />
      </div>

      {/* Date of Birth */}
      <div>
        <label htmlFor="dateOfBirth" className="block text-sm font-medium text-zinc-300 mb-2">
          Date of Birth
        </label>
        <input
          type="date"
          id="dateOfBirth"
          name="dateOfBirth"
          defaultValue={profile.dateOfBirth}
          required
          className="w-full px-4 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        />
      </div>

      {/* Place of Birth */}
      <div>
        <label htmlFor="placeOfBirth" className="block text-sm font-medium text-zinc-300 mb-2">
          Place of Birth
        </label>
        <input
          type="text"
          id="placeOfBirth"
          name="placeOfBirth"
          defaultValue={profile.placeOfBirth}
          required
          className="w-full px-4 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        />
      </div>

      {/* Gender */}
      <div>
        <label htmlFor="gender" className="block text-sm font-medium text-zinc-300 mb-2">
          Gender
        </label>
        <select
          id="gender"
          name="gender"
          defaultValue={profile.gender}
          required
          className="w-full px-4 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        >
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </div>

      {/* Features */}
      <div>
        <label htmlFor="features" className="block text-sm font-medium text-zinc-300 mb-2">
          Physical Features
        </label>
        <textarea
          id="features"
          name="features"
          rows={4}
          defaultValue={profile.features}
          required
          className="w-full px-4 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
          placeholder="Describe physical characteristics..."
        />
        <p className="mt-1 text-xs text-zinc-500">
          Used for AI portrait generation
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-6 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 disabled:cursor-not-allowed text-zinc-900 font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
        <a
          href={`/driver/${encodeURIComponent(driverName)}`}
          className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-900 text-center"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
