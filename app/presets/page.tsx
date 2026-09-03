import AssistsEditor from '../components/AssistsEditor';
import BackButton from '../components/BackButton';
import { readGlobalAssists, readGlobalTraffic } from '../lib/launch/assists';

// Always read the config from disk; this page is the editor for it.
export const dynamic = 'force-dynamic';

export default async function GlobalPresetsPage() {
  const assists = await readGlobalAssists();
  const traffic = await readGlobalTraffic();

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      <div className="w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8 xl:px-12">
        <div className="mb-8">
          <BackButton fallbackUrl="/">Back</BackButton>

          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-6">
            <h1 className="mb-2 text-4xl font-bold text-white">Game Presets</h1>
            <p className="text-zinc-400">
              Driving aids, realism settings and how busy a road in traffic gets.
              Every season uses these until it gets presets of its own.
            </p>
          </div>
        </div>

        <AssistsEditor initial={assists} initialTraffic={traffic} initialSource="global" />
      </div>
    </div>
  );
}
