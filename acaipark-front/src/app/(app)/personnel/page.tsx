import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Personnel from "@/components/Personnel";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Personal",
};

export default function PersonnelPage() {
  return (
    <>
      <Breadcrumb pageName="Personal" />
      <Personnel />
    </>
  );
}
