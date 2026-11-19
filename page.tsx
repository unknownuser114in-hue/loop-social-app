import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthForm from "@/components/auth-form";
import { viewerId } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in · Loop" };

export default async function LoginPage() {
  if (await viewerId()) redirect("/");
  return <AuthForm signup={false} />;
}
