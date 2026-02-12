import "./page.css";
import CollegeDetailClient from "./CollegeDetailClient";

import JsonLd from "@/components/JsonLd";
import { fetchCollege } from "@/lib/api";

// Enable dynamic params for colleges not in static list
export const dynamicParams = true;

export async function generateMetadata({ params }) {
  const college = await fetchCollege(params.id);
  if (!college) return { title: "College Not Found" };

  return {
    title: college.name,
    description: `Detailed information about ${college.name}, including courses, fees, admission process, and reviews.`,
    openGraph: {
      title: college.name,
      description: `Learn more about ${college.name} on CEI.`,
      images: [college.logo || "/default-college.png"],
    },
  };
}

export default async function CollegeDetail({ params }) {
  const college = await fetchCollege(params.id);

  const jsonLd = college ? {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "name": college.name,
    "description": college.shortDescription || `Detailed information about ${college.name}`,
    "url": `https://frontend-blond-nu-51.vercel.app/college/${params.id}`,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": college.district,
      "addressRegion": college.state,
      "addressCountry": "IN"
    },
    "sameAs": [college.website]
  } : null;

  return (
    <>
      <JsonLd data={jsonLd} />
      <CollegeDetailClient id={params.id} initialData={college} />
    </>
  );
}
