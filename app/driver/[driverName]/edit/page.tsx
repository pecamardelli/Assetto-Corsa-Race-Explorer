import BackButton from '../../../components/BackButton';
import DriverEditForm from './DriverEditForm';
import {
  getDriverProfile,
  driverSlug,
  resolveDriverPortrait,
  resolvePlayerName,
  fallbackAiLevel,
} from '../../../lib/driver-assets';
import { promises as fs } from 'fs';
import path from 'path';

export default async function EditDriverPage({ params }: { params: Promise<{ driverName: string }> }) {
  const { driverName } = await params;
  const decodedDriverName = decodeURIComponent(driverName);

  let profile = await getDriverProfile(decodedDriverName);

  // If no profile exists, create a default one
  if (!profile) {
    profile = {
      name: decodedDriverName,
      nationality: 'Unknown',
      dateOfBirth: '1990-01-01',
      placeOfBirth: 'Unknown',
      features: 'athletic build, confident features',
      gender: 'male',
      isFictional: true,
      bio: '',
    };

    // Save the default profile
    try {
      const profilesDir = path.join(process.cwd(), 'app/lib/driver-profiles');
      await fs.mkdir(profilesDir, { recursive: true });

      const profilePath = path.join(profilesDir, `${driverSlug(decodedDriverName)}.json`);
      await fs.writeFile(profilePath, JSON.stringify(profile, null, 2), 'utf8');
    } catch (error) {
      console.error('Error creating default profile:', error);
    }
  }

  // One AI rating per driver, kept on the base profile and shared by every
  // series. The player drives for themselves and gets none.
  const isPlayer = decodedDriverName === (await resolvePlayerName());
  const aiRating = isPlayer
    ? null
    : {
        skill: profile.skill ?? null,
        aggression: profile.aggression ?? null,
        fallbackSkill: fallbackAiLevel(decodedDriverName),
      };

  // Global page: no championship, so this is the base portrait.
  const portrait = await resolveDriverPortrait(decodedDriverName);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      <div className="w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-12">
        {/* Header */}
        <div className="mb-8">
          <BackButton fallbackUrl={`/driver/${encodeURIComponent(decodedDriverName)}`}>
            Back to Profile
          </BackButton>

          <div className="mt-4">
            <h1 className="text-4xl font-bold text-white mb-2">
              Edit Profile
            </h1>
            <p className="text-zinc-400">
              Update {profile.name}&apos;s information
            </p>
          </div>
        </div>

        <DriverEditForm
          profile={profile}
          driverName={decodedDriverName}
          portrait={portrait}
          aiRating={aiRating}
        />
      </div>
    </div>
  );
}
