import { useEffect } from "react";
import { Bell } from "lucide-react";

import { ActivityList } from "@/components/app/ActivityList";
import { CardSection } from "@/components/app/CardSection";
import { PageHeader } from "@/components/app/PageHeader";
import { Pill } from "@/components/app/Badges";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/app/States";
import { useClientData } from "@/hooks/useClientData";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function Notifications() {
  const { activity, loading, error, refresh, markActivitySeen } =
    useClientData();

  // Opening this page is what "reading" means, so the badge clears here. The
  // marker is local — nothing is written back to the database.
  const ready = !loading && !error;
  useEffect(() => {
    if (ready) markActivitySeen();
  }, [ready, markActivitySeen]);

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState onRetry={refresh} />;

  const recent = activity.filter(
    (item) => Date.now() - new Date(item.at).getTime() < WEEK_MS,
  ).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description="A running record of everything that has happened on your projects, newest first."
      />

      {activity.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Pill>{activity.length} updates in total</Pill>
          <Pill>
            {recent} in the last 7 days
          </Pill>
        </div>
      )}

      <CardSection
        title="Recent activity"
        description="Each entry links through to the project it belongs to."
      >
        {activity.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-6 w-6" />}
            title="Nothing to report yet"
            description="As soon as we review a request, deliver files or confirm a payment, it is recorded here with its date."
          />
        ) : (
          <ActivityList
            items={activity}
            orderLink={(id) => `/dashboard/projects/${id}`}
          />
        )}
      </CardSection>
    </>
  );
}
