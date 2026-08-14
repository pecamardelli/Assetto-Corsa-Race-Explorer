import { notFound } from 'next/navigation';
import Image from 'next/image';
import BackButton from '../../components/BackButton';
import CarGallery from '../../components/CarGallery';
import { getCarData } from '../../lib/car-data';
import { getChampionships } from '../../lib/race-data';

export default async function CarPage({ params }: { params: Promise<{ carName: string }> }) {
  const { carName } = await params;
  const decodedCarName = decodeURIComponent(carName);

  // Get car data
  const carData = getCarData(decodedCarName);

  if (!carData) {
    notFound();
  }

  // Find championships and seasons where this car appears
  const championships = await getChampionships();
  const appearances: Array<{
    champId: string;
    champName: string;
    seasonName: string;
    seasonId: string;
    drivers: string[];
  }> = [];

  for (const champ of championships) {
    for (const season of champ.seasons) {
      const driversWithCar = season.data.opponents?.filter((o: any) => o.car === decodedCarName) || [];
      if (driversWithCar.length > 0) {
        appearances.push({
          champId: champ.id,
          champName: season.data.name,
          seasonName: season.seasonName,
          seasonId: season.seasonName.toLowerCase().replace(' ', '_'),
          drivers: driversWithCar.map((d: any) => d.name),
        });
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      <div className="w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-12">
        {/* Header */}
        <div className="mb-8">
          <BackButton>Back</BackButton>

          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden">
            {/* Car Header */}
            <div className="p-6 border-b border-zinc-700">
              <div className="flex items-start gap-6">
                <Image
                  src={`/badges/${decodedCarName}.png`}
                  alt={carData.brand || 'Car'}
                  width={120}
                  height={120}
                  className="rounded-lg"
                  unoptimized
                />
                <div className="flex-1">
                  <div className="text-sm text-zinc-500 mb-1">{carData.brand}</div>
                  <h1 className="text-4xl font-bold text-white mb-2">{carData.name}</h1>
                  <div className="flex flex-wrap gap-4 text-sm">
                    {carData.year && (
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500">Year:</span>
                        <span className="text-zinc-300 font-semibold">{carData.year}</span>
                      </div>
                    )}
                    {carData.country && (
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500">Country:</span>
                        <span className="text-zinc-300 font-semibold">{carData.country}</span>
                      </div>
                    )}
                    {carData.class && (
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500">Class:</span>
                        <span className="text-zinc-300 font-semibold capitalize">{carData.class}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-64 flex-shrink-0">
                  <CarGallery carId={decodedCarName} carName={carData.name || decodedCarName} />
                </div>
              </div>
            </div>

            {/* Description */}
            {carData.description && (
              <div className="p-6 border-b border-zinc-700">
                <h2 className="text-xl font-bold text-white mb-3">About</h2>
                <div
                  className="text-zinc-300 leading-relaxed space-y-3"
                  dangerouslySetInnerHTML={{ __html: carData.description }}
                />
              </div>
            )}

            {/* Specifications */}
            {carData.specs && Object.keys(carData.specs).length > 0 && (
              <div className="p-6 border-b border-zinc-700">
                <h2 className="text-xl font-bold text-white mb-4">Specifications</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {Object.entries(carData.specs).map(([key, value]) => (
                    <div key={key} className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-700">
                      <div className="text-xs text-zinc-500 uppercase mb-1">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div className="text-lg font-bold text-white">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mod Info */}
            {(carData.author || carData.version) && (
              <div className="p-6 bg-zinc-900/30">
                <h2 className="text-xl font-bold text-white mb-3">Mod Information</h2>
                <div className="flex flex-wrap gap-4 text-sm">
                  {carData.author && (
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500">Author:</span>
                      <span className="text-zinc-300">{carData.author}</span>
                    </div>
                  )}
                  {carData.version && (
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500">Version:</span>
                      <span className="text-zinc-300">{carData.version}</span>
                    </div>
                  )}
                  {carData.url && (
                    <div className="flex items-center gap-2">
                      <a
                        href={carData.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300 underline"
                      >
                        View Source
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Championship Appearances */}
        {appearances.length > 0 && (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden">
            <div className="px-6 py-4 bg-zinc-900/50 border-b border-zinc-700">
              <h2 className="text-xl font-bold text-white">Championship Appearances</h2>
              <p className="text-sm text-zinc-400 mt-1">
                This car has appeared in {appearances.length} championship season{appearances.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="divide-y divide-zinc-700">
              {appearances.map((appearance, index) => (
                <div key={`${appearance.champId}-${appearance.seasonId}-${index}`} className="p-6 hover:bg-zinc-800/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-1">
                        {appearance.champName} - {appearance.seasonName}
                      </h3>
                      <div className="text-sm text-zinc-400">
                        <span className="font-semibold text-purple-400">{appearance.drivers.length}</span> driver{appearance.drivers.length !== 1 ? 's' : ''}: {appearance.drivers.join(', ')}
                      </div>
                    </div>
                    <a
                      href={`/championship/${encodeURIComponent(appearance.champId)}/season/${encodeURIComponent(appearance.seasonId)}/lineup`}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                    >
                      View Lineup
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
