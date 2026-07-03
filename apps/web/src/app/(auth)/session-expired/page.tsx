import { redirect } from "next/navigation";

export default function SessionExpiredPage() {
  redirect("/login?reason=auth-required");
}
