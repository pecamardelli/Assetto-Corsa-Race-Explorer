"use client";

import { useRouter } from 'next/navigation';
import { FormEvent, ReactNode, useState } from 'react';
import type { DriverProfile } from '../../../lib/driver-assets';
import { Slider, Toggle } from '../../../components/SettingControls';
import DriverImage from '../../../components/DriverImage';

export type AiRating = {
  /** null = no rating stored on the profile. */
  skill: number | null;
  aggression: number | null;
  /** The stable level an unrated driver races at (see fallbackAiLevel). */
  fallbackSkill: number;
};

interface DriverEditFormProps {
  profile: DriverProfile;
  driverName: string;
  /** Portrait URL resolved on the server; null when the driver has none yet. */
  portrait: string | null;
  /** Null for the player, who drives for themselves and has no AI rating. */
  aiRating: AiRating | null;
}

const NATIONALITIES = [
  'Afghan', 'Albanian', 'Algerian', 'American', 'Andorran', 'Angolan', 'Argentine',
  'Armenian', 'Australian', 'Austrian', 'Azerbaijani', 'Bahamian', 'Bahraini',
  'Bangladeshi', 'Barbadian', 'Belarusian', 'Belgian', 'Belizean', 'Beninese',
  'Bhutanese', 'Bolivian', 'Bosnian', 'Brazilian', 'British', 'Bruneian', 'Bulgarian',
  'Burkinabe', 'Burmese', 'Burundian', 'Cambodian', 'Cameroonian', 'Canadian',
  'Cape Verdean', 'Central African', 'Chadian', 'Chilean', 'Chinese', 'Colombian',
  'Comoran', 'Congolese', 'Costa Rican', 'Croatian', 'Cuban', 'Cypriot', 'Czech',
  'Danish', 'Djiboutian', 'Dominican', 'Dutch', 'East Timorese', 'Ecuadorian',
  'Egyptian', 'Emirati', 'English', 'Equatorial Guinean', 'Eritrean', 'Estonian',
  'Ethiopian', 'Fijian', 'Finnish', 'French', 'Gabonese', 'Gambian', 'Georgian',
  'German', 'Ghanaian', 'Greek', 'Grenadian', 'Guatemalan', 'Guinean', 'Guyanese',
  'Haitian', 'Honduran', 'Hungarian', 'Icelandic', 'Indian', 'Indonesian', 'Iranian',
  'Iraqi', 'Irish', 'Israeli', 'Italian', 'Ivorian', 'Jamaican', 'Japanese',
  'Jordanian', 'Kazakh', 'Kenyan', 'Kuwaiti', 'Kyrgyz', 'Laotian', 'Latvian',
  'Lebanese', 'Liberian', 'Libyan', 'Liechtensteiner', 'Lithuanian', 'Luxembourgish',
  'Macedonian', 'Malagasy', 'Malawian', 'Malaysian', 'Maldivian', 'Malian', 'Maltese',
  'Mauritanian', 'Mauritian', 'Mexican', 'Moldovan', 'Monacan', 'Mongolian',
  'Montenegrin', 'Moroccan', 'Mozambican', 'Namibian', 'Nepalese', 'New Zealand',
  'Nicaraguan', 'Nigerien', 'Nigerian', 'Norwegian', 'Omani', 'Pakistani',
  'Panamanian', 'Papua New Guinean', 'Paraguayan', 'Peruvian', 'Philippine', 'Polish',
  'Portuguese', 'Qatari', 'Romanian', 'Russian', 'Rwandan', 'Saint Lucian',
  'Salvadoran', 'Samoan', 'Saudi', 'Scottish', 'Senegalese', 'Serbian', 'Seychellois',
  'Sierra Leonean', 'Singaporean', 'Slovak', 'Slovenian', 'Somali', 'South African',
  'South Korean', 'Spanish', 'Sri Lankan', 'Sudanese', 'Surinamese', 'Swedish',
  'Swiss', 'Syrian', 'Taiwanese', 'Tajik', 'Tanzanian', 'Thai', 'Togolese',
  'Trinidadian', 'Tunisian', 'Turkish', 'Turkmen', 'Ugandan', 'Ukrainian',
  'Uruguayan', 'Uzbek', 'Venezuelan', 'Vietnamese', 'Welsh', 'Yemeni', 'Zambian',
  'Zimbabwean', 'Unknown',
];

const inputClass =
  'w-full px-4 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent';
const portraitInputClass = inputClass.replace('focus:ring-amber-500', 'focus:ring-purple-500');
const labelClass = 'block text-sm font-medium text-zinc-300 mb-2';

function Card({
  title,
  description,
  className = '',
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 ${className}`}>
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function PortraitOption({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={portraitInputClass}
      >
        <option value="random">Random</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function DriverEditForm({ profile, driverName, portrait, aiRating }: DriverEditFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPortrait, setIsGeneratingPortrait] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portraitSuccess, setPortraitSuccess] = useState<string | null>(null);

  const [isFictional, setIsFictional] = useState(profile.isFictional ?? false);

  const [rated, setRated] = useState(
    aiRating != null && (aiRating.skill != null || aiRating.aggression != null)
  );
  const [skill, setSkill] = useState(aiRating?.skill ?? aiRating?.fallbackSkill ?? 94);
  const [aggression, setAggression] = useState(aiRating?.aggression ?? 45);

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
      isFictional,
      bio: formData.get('bio') as string,
      // A rating to store, or null to clear it back to the unrated fallback.
      // Omitted for the player, whose profile carries no rating.
      aiRating: aiRating ? (rated ? { skill, aggression } : null) : undefined,
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

      {/* Grid children stretch, so Identity and AI Rating share a row at equal height. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Identity"
          description="Who the driver is on the entry list."
          className={aiRating ? '' : 'lg:col-span-2'}
        >
          <div className="space-y-5">
            <div>
              <label htmlFor="name" className={labelClass}>
                Driver Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                defaultValue={profile.name}
                className={inputClass}
                readOnly
              />
              <p className="mt-1 text-xs text-zinc-500">Driver name cannot be changed</p>
            </div>

            <div>
              <label htmlFor="nationality" className={labelClass}>
                Nationality
              </label>
              <select
                id="nationality"
                name="nationality"
                defaultValue={profile.nationality}
                required
                className={inputClass}
              >
                <option value="">Select nationality...</option>
                {NATIONALITIES.map(nationality => (
                  <option key={nationality} value={nationality}>
                    {nationality}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="dateOfBirth" className={labelClass}>
                  Date of Birth
                </label>
                <input
                  type="date"
                  id="dateOfBirth"
                  name="dateOfBirth"
                  defaultValue={profile.dateOfBirth}
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="gender" className={labelClass}>
                  Gender
                </label>
                <select
                  id="gender"
                  name="gender"
                  defaultValue={profile.gender}
                  required
                  className={inputClass}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="placeOfBirth" className={labelClass}>
                Place of Birth
              </label>
              <input
                type="text"
                id="placeOfBirth"
                name="placeOfBirth"
                defaultValue={profile.placeOfBirth}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Driver Type</label>
              <button
                type="button"
                onClick={() => setIsFictional(!isFictional)}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg border transition-colors ${
                  isFictional
                    ? 'bg-purple-500/10 border-purple-500/50 hover:border-purple-400'
                    : 'bg-emerald-500/10 border-emerald-500/50 hover:border-emerald-400'
                }`}
              >
                <div className={`w-10 h-6 rounded-full relative transition-colors ${
                  isFictional ? 'bg-purple-600' : 'bg-emerald-600'
                }`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    isFictional ? 'left-1' : 'left-5'
                  }`} />
                </div>
                <span className={`font-medium ${isFictional ? 'text-purple-400' : 'text-emerald-400'}`}>
                  {isFictional ? 'Fictional Driver' : 'Real Driver'}
                </span>
              </button>
              <p className="mt-1 text-xs text-zinc-500">
                {isFictional
                  ? 'This is a fictional/AI driver created for the game'
                  : 'This is a real person (historical or contemporary driver)'}
              </p>
            </div>
          </div>
        </Card>

        {/* AI Rating — one per driver, shared by every series they enter */}
        {aiRating && (
          <Card
            title="AI Rating"
            description="How this driver races in every championship. An unrated driver runs at a stable fallback level and draws a fresh aggression every launch."
          >
            <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-2">
              <Toggle
                label="Rated"
                hint="Off: races at the stable fallback level with random aggression"
                value={rated}
                onChange={setRated}
              />
              {rated ? (
                <>
                  <Slider
                    label="Skill"
                    hint={
                      skill > 100
                        ? `Above 100: race.ini stays at 100 and Il Direttore raises the driver toward ${(skill / 100).toFixed(2)} on fast tracks — scaled by the track, never at Monaco`
                        : "AC's AI level — this is the driver's pace. Above 100 is Il Direttore's band."
                    }
                    value={skill}
                    onChange={setSkill}
                    min={70}
                    max={150}
                    step={1}
                    format={value => `${value}`}
                  />
                  <Slider
                    label="Aggression"
                    hint="Only shapes how the AI races you — nothing AI-vs-AI. Above ~60 it turns into punts."
                    value={aggression}
                    onChange={setAggression}
                    min={0}
                    max={100}
                    step={1}
                    format={value => `${value}`}
                  />
                </>
              ) : (
                <p className="py-2 text-xs text-zinc-500">
                  Unrated — races at {aiRating.fallbackSkill}, aggression drawn 35–55 each
                  launch.
                </p>
              )}
            </div>
          </Card>
        )}

        <Card
          title="Biography"
          description="Shown on the driver's profile page."
          className="lg:col-span-2"
        >
          <textarea
            id="bio"
            name="bio"
            rows={6}
            defaultValue={profile.bio || ''}
            className={`${inputClass} resize-none`}
            placeholder="Write a short biography for this driver..."
          />
        </Card>

        <Card
          title="Portrait"
          description="Generate a new AI portrait with ComfyUI (localhost:8000) from the physical features description."
          className="lg:col-span-2"
        >
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-shrink-0">
              <DriverImage driverName={driverName} src={portrait} />
            </div>

            <div className="flex-1 min-w-0 space-y-4">
              <div>
                <label htmlFor="features" className={labelClass}>
                  Physical Features
                </label>
                <textarea
                  id="features"
                  name="features"
                  rows={4}
                  defaultValue={profile.features}
                  required
                  className={`${portraitInputClass} resize-none`}
                  placeholder="Describe physical characteristics..."
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Describe the driver&apos;s physical characteristics for AI generation
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <PortraitOption
                  id="portraitExpression"
                  label="Facial Expression"
                  value={portraitExpression}
                  onChange={setPortraitExpression}
                  options={[
                    ['neutral', 'Neutral (No Smile)'],
                    ['slight-smile', 'Slight Smile 😊'],
                    ['smile-teeth', 'Smile with Teeth 😁'],
                    ['approachable', 'Friendly Smile 😄'],
                    ['calm', 'Calm with Smile 🙂'],
                    ['smirk', 'Smirk 😏'],
                    ['serious', 'Serious (No Smile)'],
                    ['determined', 'Determined (No Smile)'],
                    ['stoic', 'Stoic (No Smile)'],
                  ]}
                />
                <PortraitOption
                  id="portraitAngle"
                  label="Camera Angle"
                  value={portraitAngle}
                  onChange={setPortraitAngle}
                  options={[
                    ['front', 'Facing Camera Directly'],
                    ['45-degree', '45 Degree Angle'],
                    ['slight-45', 'Slight 45 Degree'],
                    ['three-quarter', 'Three-Quarter View'],
                  ]}
                />
                <PortraitOption
                  id="portraitFraming"
                  label="Framing"
                  value={portraitFraming}
                  onChange={setPortraitFraming}
                  options={[
                    ['upper-body', 'Upper Body Portrait'],
                    ['shoulders', 'Shoulders & Up'],
                    ['torso', 'Torso Visible'],
                    ['face-focus', 'Face Focus'],
                  ]}
                />
                <PortraitOption
                  id="portraitSuit"
                  label="Racing Suit"
                  value={portraitSuit}
                  onChange={setPortraitSuit}
                  options={[
                    ['red-white', 'Red with White Stripes'],
                    ['blue-sponsors', 'Blue with Sponsor Logos'],
                    ['black-red', 'Black with Red Accents'],
                    ['white-blue', 'White with Blue Details'],
                    ['green', 'Green Racing Suit'],
                    ['yellow-black', 'Yellow and Black'],
                    ['navy-white', 'Navy Blue with White Stripes'],
                    ['orange', 'Orange Racing Suit'],
                    ['grey-black', 'Grey with Black Details'],
                    ['red-white-2', 'Red and White'],
                    ['black-yellow', 'Black and Yellow'],
                    ['blue-white', 'Blue and White'],
                  ]}
                />
                <PortraitOption
                  id="portraitDistance"
                  label="Camera Distance"
                  value={portraitDistance}
                  onChange={setPortraitDistance}
                  options={[
                    ['medium', 'Medium Distance (Standard)'],
                    ['close', 'Close-up Portrait'],
                    ['slightly-far', 'Slightly Far'],
                  ]}
                />
              </div>

              <button
                type="button"
                onClick={handleRegeneratePortrait}
                disabled={isGeneratingPortrait}
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
          </div>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <a
          href={`/driver/${encodeURIComponent(driverName)}`}
          className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-900 text-center"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-8 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 disabled:cursor-not-allowed text-zinc-900 font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
