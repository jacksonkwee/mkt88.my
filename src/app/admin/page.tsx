import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME } from "../../lib/auth";
import AdminDashboard from "../../components/admin/AdminDashboard";

export const metadata = { title: "Admin - mkt88 4D" };

export default async function AdminPage() {
  const store = await cookies();
  if (!verifyToken(store.get(COOKIE_NAME)?.value)) {
    redirect("/admin/login");
  }
  return <AdminDashboard />;
}
