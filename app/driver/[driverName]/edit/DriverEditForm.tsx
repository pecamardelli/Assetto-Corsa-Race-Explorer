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
  isFictional?: boolean;
};

interface DriverEditFormProps {
  profile: DriverProfile;
  driverName: string;
}

export default function DriverEditForm({ profile, driverName }: DriverEditFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPortrait, setIsGeneratingPortrait] = useState(false);
  const [isFetchingPortrait, setIsFetchingPortrait] = useState(false);
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portraitSuccess, setPortraitSuccess] = useState<string | null>(null);

  // Portrait generation options
  const [portraitExpression, setPortraitExpression] = useState('random');
  const [portraitAngle, setPortraitAngle] = useState('random');
  const [portraitFraming, setPortraitFraming] = useState('random');
  const [portraitSuit, setPortraitSuit] = useState('random');
  const [portraitDistance, setPortraitDistance] = useState('random');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setPortraitSuccess(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      nationality: formData.get('nationality') as string,
      dateOfBirth: formData.get('dateOfBirth') as string,
      placeOfBirth: formData.get('placeOfBirth') as string,
      gender: formData.get('gender') as string,
      features: formData.get('features') as string,
      isFictional: formData.get('isFictional') === 'true',
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

      // Show success message and stay on page
      setPortraitSuccess('Profile updated successfully!');
      router.refresh();

      // Clear success message after 3 seconds
      setTimeout(() => {
        setPortraitSuccess(null);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegeneratePortrait() {
    setIsGeneratingPortrait(true);
    setError(null);
    setPortraitSuccess(null);

    try {
      const response = await fetch(`/api/driver/${encodeURIComponent(driverName)}/portrait`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expression: portraitExpression,
          angle: portraitAngle,
          framing: portraitFraming,
          suit: portraitSuit,
          distance: portraitDistance,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate portrait');
      }

      setPortraitSuccess('Portrait generated successfully! The page will refresh to show the new portrait.');

      // Wait a moment to show the success message, then refresh
      setTimeout(() => {
        router.refresh();
        setPortraitSuccess(null);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate portrait');
    } finally {
      setIsGeneratingPortrait(false);
    }
  }

  async function handleFetchPortrait() {
    setIsFetchingPortrait(true);
    setError(null);
    setPortraitSuccess(null);

    try {
      const response = await fetch(`/api/driver/${encodeURIComponent(driverName)}/fetch-portrait`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch portrait');
      }

      const data = await response.json();
      setPortraitSuccess(`Portrait fetched successfully from ${data.source}! The page will refresh to show it.`);

      // Wait a moment to show the success message, then refresh
      setTimeout(() => {
        router.refresh();
        setPortraitSuccess(null);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch portrait from the internet');
    } finally {
      setIsFetchingPortrait(false);
    }
  }

  async function handleFetchInfo() {
    setIsFetchingInfo(true);
    setError(null);
    setPortraitSuccess(null);

    try {
      const response = await fetch(`/api/driver/${encodeURIComponent(driverName)}/fetch-info`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch information');
      }

      const data = await response.json();
      setPortraitSuccess(`All information fetched successfully from ${data.source}! The page will refresh to show updates.`);

      // Wait a moment to show the success message, then refresh
      setTimeout(() => {
        router.refresh();
        setPortraitSuccess(null);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch information from Wikipedia');
    } finally {
      setIsFetchingInfo(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {portraitSuccess && (
        <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded-lg">
          {portraitSuccess}
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

      {/* Is Fictional */}
      <div>
        <label htmlFor="isFictional" className="block text-sm font-medium text-zinc-300 mb-2">
          Driver Type
        </label>
        <div className="flex gap-2">
          <select
            id="isFictional"
            name="isFictional"
            defaultValue={profile.isFictional !== false ? 'true' : 'false'}
            required
            className="flex-1 px-4 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          >
            <option value="true">Fictional Driver</option>
            <option value="false">Real Driver</option>
          </select>
          {profile.isFictional === false && (
            <button
              type="button"
              onClick={handleFetchInfo}
              disabled={isFetchingInfo}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 whitespace-nowrap"
              title="Fetch all driver information from Wikipedia"
            >
              {isFetchingInfo ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Fetching...
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                  Auto-Fill
                </span>
              )}
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          {profile.isFictional === false
            ? 'Click "Auto-Fill" to automatically fetch all information from Wikipedia'
            : 'Mark as "Real Driver" to enable auto-filling information from Wikipedia'}
        </p>
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

      {/* Portrait Generation */}
      <div className="border-t border-zinc-700 pt-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">AI Portrait</h3>
            <p className="text-sm text-zinc-400">
              Generate a new AI portrait based on the physical features description above.
              This will use ComfyUI to create a realistic racing driver portrait.
            </p>
          </div>
        </div>

        {/* Portrait Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Expression */}
          <div>
            <label htmlFor="portraitExpression" className="block text-sm font-medium text-zinc-300 mb-2">
              Facial Expression
            </label>
            <select
              id="portraitExpression"
              value={portraitExpression}
              onChange={(e) => setPortraitExpression(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="random">Random</option>
              <option value="neutral">Neutral (No Smile)</option>
              <option value="slight-smile">Slight Smile 😊</option>
              <option value="smile-teeth">Smile with Teeth 😁</option>
              <option value="approachable">Friendly Smile 😄</option>
              <option value="calm">Calm with Smile 🙂</option>
              <option value="smirk">Smirk 😏</option>
              <option value="serious">Serious (No Smile)</option>
              <option value="determined">Determined (No Smile)</option>
              <option value="stoic">Stoic (No Smile)</option>
            </select>
          </div>

          {/* Camera Angle */}
          <div>
            <label htmlFor="portraitAngle" className="block text-sm font-medium text-zinc-300 mb-2">
              Camera Angle
            </label>
            <select
              id="portraitAngle"
              value={portraitAngle}
              onChange={(e) => setPortraitAngle(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="random">Random</option>
              <option value="front">Facing Camera Directly</option>
              <option value="45-degree">45 Degree Angle</option>
              <option value="slight-45">Slight 45 Degree</option>
              <option value="three-quarter">Three-Quarter View</option>
            </select>
          </div>

          {/* Framing */}
          <div>
            <label htmlFor="portraitFraming" className="block text-sm font-medium text-zinc-300 mb-2">
              Framing
            </label>
            <select
              id="portraitFraming"
              value={portraitFraming}
              onChange={(e) => setPortraitFraming(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="random">Random</option>
              <option value="upper-body">Upper Body Portrait</option>
              <option value="shoulders">Shoulders & Up</option>
              <option value="torso">Torso Visible</option>
              <option value="face-focus">Face Focus</option>
            </select>
          </div>

          {/* Racing Suit Color */}
          <div>
            <label htmlFor="portraitSuit" className="block text-sm font-medium text-zinc-300 mb-2">
              Racing Suit
            </label>
            <select
              id="portraitSuit"
              value={portraitSuit}
              onChange={(e) => setPortraitSuit(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="random">Random</option>
              <option value="red-white">Red with White Stripes</option>
              <option value="blue-sponsors">Blue with Sponsor Logos</option>
              <option value="black-red">Black with Red Accents</option>
              <option value="white-blue">White with Blue Details</option>
              <option value="green">Green Racing Suit</option>
              <option value="yellow-black">Yellow and Black</option>
              <option value="navy-white">Navy Blue with White Stripes</option>
              <option value="orange">Orange Racing Suit</option>
              <option value="grey-black">Grey with Black Details</option>
              <option value="red-white-2">Red and White</option>
              <option value="black-yellow">Black and Yellow</option>
              <option value="blue-white">Blue and White</option>
            </select>
          </div>

          {/* Camera Distance */}
          <div>
            <label htmlFor="portraitDistance" className="block text-sm font-medium text-zinc-300 mb-2">
              Camera Distance
            </label>
            <select
              id="portraitDistance"
              value={portraitDistance}
              onChange={(e) => setPortraitDistance(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="random">Random</option>
              <option value="medium">Medium Distance (Standard)</option>
              <option value="close">Close-up Portrait</option>
              <option value="slightly-far">Slightly Far</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={handleFetchPortrait}
            disabled={isFetchingPortrait || isGeneratingPortrait}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
          >
            {isFetchingPortrait ? (
              <span className="flex items-center gap-2 justify-center">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Fetching from Internet...
              </span>
            ) : (
              'Fetch Portrait from Internet'
            )}
          </button>

          <button
            type="button"
            onClick={handleRegeneratePortrait}
            disabled={isGeneratingPortrait || isFetchingPortrait}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
          >
            {isGeneratingPortrait ? (
              <span className="flex items-center gap-2 justify-center">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating Portrait...
              </span>
            ) : (
              'Generate Portrait with AI'
            )}
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Fetch a real portrait from Wikipedia, or generate a custom AI portrait using ComfyUI (localhost:8000).
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
