import { fetchColleges, fetchExams } from "../lib/api";
import HomeClient from "./HomeClient";

// Convert from dynamic Server-Rendering to Incremental Static Regeneration (ISR)
// Rebuilds the static HTML in the background once a day (86400 seconds)
export const revalidate = 86400;

export default async function Home() {
  // throw new Error("Request failed with status code 404 (SIMULATED)");
  return <HomeClient />;
}
