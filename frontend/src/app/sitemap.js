
import { fetchColleges, fetchExams } from '@/lib/api';

export default async function sitemap() {
    const baseUrl = 'https://frontend-blond-nu-51.vercel.app';

    // 1. Static Routes
    const staticRoutes = [
        '',
        '/colleges',
        '/exams',
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

    // 2. Dynamic College Routes (limit to 2000 for now to avoid timeout)
    let colleges = [];
    try {
        const data = await fetchColleges({ limit: 2000 });
        if (Array.isArray(data)) {
            colleges = data.map((college) => ({
                url: `${baseUrl}/college/${college.id}`,
                lastModified: new Date(),
                changeFrequency: 'weekly',
                priority: 0.9,
            }));
        } else if (data && Array.isArray(data.data)) {
            colleges = data.data.map((college) => ({
                url: `${baseUrl}/college/${college.id}`,
                lastModified: new Date(),
                changeFrequency: 'weekly',
                priority: 0.9,
            }));
        }
    } catch (error) {
        console.error("Sitemap: Failed to fetch colleges", error);
    }

    // 3. Dynamic Exam Routes
    let exams = [];
    try {
        const data = await fetchExams();
        exams = (data || []).map((exam) => ({
            url: `${baseUrl}/exam/${exam.id}`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
        }));
    } catch (error) {
        console.error("Sitemap: Failed to fetch exams", error);
    }

    return [...staticRoutes, ...colleges, ...exams];
}
