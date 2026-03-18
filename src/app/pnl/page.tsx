import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import PnLTracker from "../../pnl-tracker.jsx";

export default async function PnlPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return <PnLTracker />;
}