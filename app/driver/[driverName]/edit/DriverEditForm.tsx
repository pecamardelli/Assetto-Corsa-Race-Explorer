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
  const [isGeneratingPortrait, setIsGeneratingPortrait] = useState(false);
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
        <select
          id="nationality"
          name="nationality"
          defaultValue={profile.nationality}
          required
          className="w-full px-4 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        >
          <option value="">Select nationality...</option>
          <option value="Afghan">Afghan</option>
          <option value="Albanian">Albanian</option>
          <option value="Algerian">Algerian</option>
          <option value="American">American</option>
          <option value="Andorran">Andorran</option>
          <option value="Angolan">Angolan</option>
          <option value="Argentine">Argentine</option>
          <option value="Armenian">Armenian</option>
          <option value="Australian">Australian</option>
          <option value="Austrian">Austrian</option>
          <option value="Azerbaijani">Azerbaijani</option>
          <option value="Bahamian">Bahamian</option>
          <option value="Bahraini">Bahraini</option>
          <option value="Bangladeshi">Bangladeshi</option>
          <option value="Barbadian">Barbadian</option>
          <option value="Belarusian">Belarusian</option>
          <option value="Belgian">Belgian</option>
          <option value="Belizean">Belizean</option>
          <option value="Beninese">Beninese</option>
          <option value="Bhutanese">Bhutanese</option>
          <option value="Bolivian">Bolivian</option>
          <option value="Bosnian">Bosnian</option>
          <option value="Brazilian">Brazilian</option>
          <option value="British">British</option>
          <option value="Bruneian">Bruneian</option>
          <option value="Bulgarian">Bulgarian</option>
          <option value="Burkinabe">Burkinabe</option>
          <option value="Burmese">Burmese</option>
          <option value="Burundian">Burundian</option>
          <option value="Cambodian">Cambodian</option>
          <option value="Cameroonian">Cameroonian</option>
          <option value="Canadian">Canadian</option>
          <option value="Cape Verdean">Cape Verdean</option>
          <option value="Central African">Central African</option>
          <option value="Chadian">Chadian</option>
          <option value="Chilean">Chilean</option>
          <option value="Chinese">Chinese</option>
          <option value="Colombian">Colombian</option>
          <option value="Comoran">Comoran</option>
          <option value="Congolese">Congolese</option>
          <option value="Costa Rican">Costa Rican</option>
          <option value="Croatian">Croatian</option>
          <option value="Cuban">Cuban</option>
          <option value="Cypriot">Cypriot</option>
          <option value="Czech">Czech</option>
          <option value="Danish">Danish</option>
          <option value="Djiboutian">Djiboutian</option>
          <option value="Dominican">Dominican</option>
          <option value="Dutch">Dutch</option>
          <option value="East Timorese">East Timorese</option>
          <option value="Ecuadorian">Ecuadorian</option>
          <option value="Egyptian">Egyptian</option>
          <option value="Emirati">Emirati</option>
          <option value="English">English</option>
          <option value="Equatorial Guinean">Equatorial Guinean</option>
          <option value="Eritrean">Eritrean</option>
          <option value="Estonian">Estonian</option>
          <option value="Ethiopian">Ethiopian</option>
          <option value="Fijian">Fijian</option>
          <option value="Finnish">Finnish</option>
          <option value="French">French</option>
          <option value="Gabonese">Gabonese</option>
          <option value="Gambian">Gambian</option>
          <option value="Georgian">Georgian</option>
          <option value="German">German</option>
          <option value="Ghanaian">Ghanaian</option>
          <option value="Greek">Greek</option>
          <option value="Grenadian">Grenadian</option>
          <option value="Guatemalan">Guatemalan</option>
          <option value="Guinean">Guinean</option>
          <option value="Guyanese">Guyanese</option>
          <option value="Haitian">Haitian</option>
          <option value="Honduran">Honduran</option>
          <option value="Hungarian">Hungarian</option>
          <option value="Icelandic">Icelandic</option>
          <option value="Indian">Indian</option>
          <option value="Indonesian">Indonesian</option>
          <option value="Iranian">Iranian</option>
          <option value="Iraqi">Iraqi</option>
          <option value="Irish">Irish</option>
          <option value="Israeli">Israeli</option>
          <option value="Italian">Italian</option>
          <option value="Ivorian">Ivorian</option>
          <option value="Jamaican">Jamaican</option>
          <option value="Japanese">Japanese</option>
          <option value="Jordanian">Jordanian</option>
          <option value="Kazakh">Kazakh</option>
          <option value="Kenyan">Kenyan</option>
          <option value="Kuwaiti">Kuwaiti</option>
          <option value="Kyrgyz">Kyrgyz</option>
          <option value="Laotian">Laotian</option>
          <option value="Latvian">Latvian</option>
          <option value="Lebanese">Lebanese</option>
          <option value="Liberian">Liberian</option>
          <option value="Libyan">Libyan</option>
          <option value="Liechtensteiner">Liechtensteiner</option>
          <option value="Lithuanian">Lithuanian</option>
          <option value="Luxembourgish">Luxembourgish</option>
          <option value="Macedonian">Macedonian</option>
          <option value="Malagasy">Malagasy</option>
          <option value="Malawian">Malawian</option>
          <option value="Malaysian">Malaysian</option>
          <option value="Maldivian">Maldivian</option>
          <option value="Malian">Malian</option>
          <option value="Maltese">Maltese</option>
          <option value="Mauritanian">Mauritanian</option>
          <option value="Mauritian">Mauritian</option>
          <option value="Mexican">Mexican</option>
          <option value="Moldovan">Moldovan</option>
          <option value="Monacan">Monacan</option>
          <option value="Mongolian">Mongolian</option>
          <option value="Montenegrin">Montenegrin</option>
          <option value="Moroccan">Moroccan</option>
          <option value="Mozambican">Mozambican</option>
          <option value="Namibian">Namibian</option>
          <option value="Nepalese">Nepalese</option>
          <option value="New Zealand">New Zealand</option>
          <option value="Nicaraguan">Nicaraguan</option>
          <option value="Nigerien">Nigerien</option>
          <option value="Nigerian">Nigerian</option>
          <option value="Norwegian">Norwegian</option>
          <option value="Omani">Omani</option>
          <option value="Pakistani">Pakistani</option>
          <option value="Panamanian">Panamanian</option>
          <option value="Papua New Guinean">Papua New Guinean</option>
          <option value="Paraguayan">Paraguayan</option>
          <option value="Peruvian">Peruvian</option>
          <option value="Philippine">Philippine</option>
          <option value="Polish">Polish</option>
          <option value="Portuguese">Portuguese</option>
          <option value="Qatari">Qatari</option>
          <option value="Romanian">Romanian</option>
          <option value="Russian">Russian</option>
          <option value="Rwandan">Rwandan</option>
          <option value="Saint Lucian">Saint Lucian</option>
          <option value="Salvadoran">Salvadoran</option>
          <option value="Samoan">Samoan</option>
          <option value="Saudi">Saudi</option>
          <option value="Scottish">Scottish</option>
          <option value="Senegalese">Senegalese</option>
          <option value="Serbian">Serbian</option>
          <option value="Seychellois">Seychellois</option>
          <option value="Sierra Leonean">Sierra Leonean</option>
          <option value="Singaporean">Singaporean</option>
          <option value="Slovak">Slovak</option>
          <option value="Slovenian">Slovenian</option>
          <option value="Somali">Somali</option>
          <option value="South African">South African</option>
          <option value="South Korean">South Korean</option>
          <option value="Spanish">Spanish</option>
          <option value="Sri Lankan">Sri Lankan</option>
          <option value="Sudanese">Sudanese</option>
          <option value="Surinamese">Surinamese</option>
          <option value="Swedish">Swedish</option>
          <option value="Swiss">Swiss</option>
          <option value="Syrian">Syrian</option>
          <option value="Taiwanese">Taiwanese</option>
          <option value="Tajik">Tajik</option>
          <option value="Tanzanian">Tanzanian</option>
          <option value="Thai">Thai</option>
          <option value="Togolese">Togolese</option>
          <option value="Trinidadian">Trinidadian</option>
          <option value="Tunisian">Tunisian</option>
          <option value="Turkish">Turkish</option>
          <option value="Turkmen">Turkmen</option>
          <option value="Ugandan">Ugandan</option>
          <option value="Ukrainian">Ukrainian</option>
          <option value="Uruguayan">Uruguayan</option>
          <option value="Uzbek">Uzbek</option>
          <option value="Venezuelan">Venezuelan</option>
          <option value="Vietnamese">Vietnamese</option>
          <option value="Welsh">Welsh</option>
          <option value="Yemeni">Yemeni</option>
          <option value="Zambian">Zambian</option>
          <option value="Zimbabwean">Zimbabwean</option>
          <option value="Unknown">Unknown</option>
        </select>
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

      {/* Portrait Generation */}
      <div className="border-t border-zinc-700 pt-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">AI Portrait</h3>
            <p className="text-sm text-zinc-400">
              Generate a new AI portrait based on the physical features description.
              This will use ComfyUI to create a realistic racing driver portrait.
            </p>
          </div>
        </div>

        {/* Physical Features */}
        <div className="mb-4">
          <label htmlFor="features" className="block text-sm font-medium text-zinc-300 mb-2">
            Physical Features
          </label>
          <textarea
            id="features"
            name="features"
            rows={4}
            defaultValue={profile.features}
            required
            className="w-full px-4 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            placeholder="Describe physical characteristics..."
          />
          <p className="mt-1 text-xs text-zinc-500">
            Describe the driver's physical characteristics for AI generation
          </p>
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

        <button
          type="button"
          onClick={handleRegeneratePortrait}
          disabled={isGeneratingPortrait}
          className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
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
        <p className="mt-2 text-xs text-zinc-500">
          Generate a custom AI portrait using ComfyUI (localhost:8000).
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
