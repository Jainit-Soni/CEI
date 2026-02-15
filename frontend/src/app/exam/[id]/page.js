import "./page.css";
import ExamDetailClient from "./ExamDetailClient";

import JsonLd from "@/components/JsonLd";
import { fetchExam } from "@/lib/api";

// Enable dynamic params for exams not in static list
export const dynamicParams = true;

export async function generateMetadata({ params }) {
  const exam = await fetchExam(params.id);
  if (!exam) return { title: "Exam Not Found" };

  return {
    title: `${exam.name} - Exam Details`,
    description: `Complete guide to ${exam.name}: syllabus, dates, eligibility, and accepting colleges.`,
    openGraph: {
      title: `${exam.name} - Exam Details`,
      description: `Everything you need to know about ${exam.name}.`,
    },
  };
}

export default async function ExamDetail({ params }) {
  const exam = await fetchExam(params.id);

  /*
    SEO DOMINANCE: Exam Events
    - Event (Shows "Exam Date" in Google)
    - EducationalOccupationalCredential
  */
  const jsonLd = exam ? {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Exam",
        "name": exam.name,
        "description": `Entrance exam for ${exam.type} courses.`,
        "url": `https://frontend-blond-nu-51.vercel.app/exam/${params.id}`,
        "provider": {
          "@type": "Organization",
          "name": exam.conductingBody || "Exam Authority"
        }
      },
      {
        "@type": "Event",
        "name": `${exam.shortName || exam.name} Exam Date ${new Date().getFullYear()}`,
        "startDate": exam.examDate || new Date().toISOString(),
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "location": {
          "@type": "Place",
          "name": "Pan India Centers",
          "address": {
            "@type": "PostalAddress",
            "addressCountry": "IN"
          }
        },
        "description": `Official exam date for ${exam.name}.`,
        "organizer": {
          "@type": "Organization",
          "name": exam.conductingBody || "Exam Authority"
        }
      }
    ]
  } : null;

  return (
    <>
      <JsonLd data={jsonLd} />
      <ExamDetailClient id={params.id} initialData={exam} />
    </>
  );
}
