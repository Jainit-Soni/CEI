import { fetchExams } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const SITEMAP_LIMIT = 10000;
const TOTAL_COLLEGES_APPROX = 67000;

export async function generateSitemaps() {
    const sitemaps = [];
    const totalPages = Math.ceil(TOTAL_COLLEGES_APPROX / SITEMAP_LIMIT);

    for (let i = 0; i < totalPages; i++) {
        sitemaps.push({ id: i });
    }
    return sitemaps;
}

export default async function sitemap({ id }) {
    const baseUrl = 'https://frontend-blond-nu-51.vercel.app';
    const pageId = id === undefined ? 0 : Number(id);
    const items = [];

    // Base routes and auxiliary pages load strictly on sitemap index 0
    if (pageId === 0) {
        const staticRoutes = [
            '',
            '/colleges',
            '/exams',
            '/methodology',
            '/compare',
            '/guide',
            '/privacy',
            '/terms',
        ].map((route) => ({
            url: `${baseUrl}${route}`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: route === '' ? 1.0 : 0.8,
        }));
        items.push(...staticRoutes);

        try {
            const data = await fetchExams();
            const exams = (data || []).map((exam) => ({
                url: `${baseUrl}/exam/${exam.id}`,
                lastModified: new Date(),
                changeFrequency: 'weekly',
                priority: 0.8,
            }));
            items.push(...exams);
        } catch (error) {
            console.error("Sitemap: Failed to fetch exams", error);
        }
    }

    // Load the partitioned batch of 10,000 canonical IDs without transferring full documents
    try {
        const res = await fetch(`${API_URL}/api/sitemap-batch?page=${pageId}&limit=${SITEMAP_LIMIT}`, {
            next: { revalidate: 86400 }
        });
        if (res.ok) {
            const colleges = await res.json();
            const collegeItems = colleges.map((college) => ({
                url: `${baseUrl}/college/${college.id}`,
                lastModified: college.updatedAt ? new Date(college.updatedAt) : new Date(),
                changeFrequency: 'weekly',
                priority: 0.9,
            }));
            items.push(...collegeItems);
        }
    } catch (error) {
        console.error(`Sitemap: Failed to fetch colleges batch ${pageId}`, error);
    }

    return items;
}
