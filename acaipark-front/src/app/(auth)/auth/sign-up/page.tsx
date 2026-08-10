import Signup from "@/components/Auth/Signup";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign up",
};

export default function SignUpPage() {
  return <Signup />;
}
