import DashboardCharts from "@/components/Dashboard/dashboard-charts";
import ControlPanel from "@/components/Dashboard/control-panel";

type PropsType = {
  searchParams: Promise<{
    selected_time_frame?: string;
  }>;
};

export default async function Dashboard({ searchParams }: PropsType) {
  await searchParams;

  return (
    <>
      <DashboardCharts />

      <div className="mt-6">
        <ControlPanel />
      </div>
    </>
  );
}
