import { notFound } from 'next/navigation';
import BackButton from '../../../components/BackButton';
import DriverEditForm from './DriverEditForm';
import { promises as fs } from 'fs';
import path from 'path';

type DriverProfile = {
  name: string;
  nationality: string;
  dateOfBirth: string;
  placeOfBirth: string;
  features: string;
  gender: string;
  isFictional?: boolean;
  bio?: string;
};

async function getDriverProfile(driverName: string): Promise<DriverProfile | null> {
  try {
    const profilePath = path.join(process.cwd(), 'app/lib/driver-profiles', `${driverName.replace(/ /g, '_').toLowerCase()}.json`);
    const fileContents = await fs.readFile(profilePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    return null;
  }
}

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

      const profilePath = path.join(profilesDir, `${decodedDriverName.replace(/ /g, '_').toLowerCase()}.json`);
      await fs.writeFile(profilePath, JSON.stringify(profile, null, 2), 'utf8');
    } catch (error) {
      console.error('Error creating default profile:', error);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
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
              Update {profile.name}'s information
            </p>
          </div>
        </div>

        {/* Edit Form */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
          <DriverEditForm profile={profile} driverName={decodedDriverName} />
        </div>
      </div>
    </div>
  );
}
