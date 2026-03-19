export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="dashboard-root" style={{ height: "100%" }}>{children}</div>;
}
