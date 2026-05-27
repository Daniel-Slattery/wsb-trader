import { Nav } from '../components/Nav';
import { AgentRunCard } from '@/components/AgentRunCard';
import { db, agentRuns } from '@/db';

export const revalidate = 60;

export default function AgentLogsPage() {
  const runs = db
    .select()
    .from(agentRuns)
    .orderBy(agentRuns.runAt)
    .all()
    .reverse()
    .map(r => ({
      ...r,
      topPicks: JSON.parse(r.topPicks),
    }));

  return (
    <main>
      <Nav active="agent-logs" />
      <div className="max-w-4xl mx-auto px-6 py-6">
        <h1 className="text-xl font-bold text-white mb-5">Agent Logs</h1>
        {runs.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-8">No runs yet — first cron fires at 8:30am ET on a weekday.</p>
        ) : (
          runs.map(run => <AgentRunCard key={run.id} run={run} />)
        )}
      </div>
    </main>
  );
}
