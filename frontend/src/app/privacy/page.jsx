"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Container from "@/components/Container";
import Link from "next/link";
import { Shield } from "lucide-react";

export default function PrivacyPage() {
    const router = useRouter();

    useEffect(() => {
        // Soft redirect to combined T&C
        // router.push('/terms-and-conditions');
    }, []);

    return (
        <div className="legal-page" style={{ paddingTop: '150px', paddingBottom: '100px', textAlign: 'center' }}>
            <Container>
                <Shield size={64} color="#2563eb" style={{ marginBottom: '24px' }} />
                <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '16px' }}>Privacy Policy</h1>
                <p style={{ color: '#64748b', fontSize: '1.2rem', marginBottom: '32px' }}>
                    Our Privacy Policy has been consolidated into our comprehensive Terms & Conditions.
                </p>
                <Link href="/terms-and-conditions" style={{
                    background: '#2563eb',
                    color: 'white',
                    padding: '12px 32px',
                    borderRadius: '12px',
                    fontWeight: 700,
                    textDecoration: 'none'
                }}>
                    View Terms & Conditions
                </Link>
            </Container>
        </div>
    );
}
