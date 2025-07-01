// app/client-providers.js
'use client';

import { useEffect, useState } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function ClientProviders({ children }) {
    const [companyName, setCompanyName] = useState('');

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await fetch('/api/company-profile');
                if (!res.ok) throw new Error('Failed to load profile');
                const data = await res.json();
                setCompanyName(data.company_name ?? '');
                document.title = `Zebra IMS${data.company_name ? ` | ${data.company_name}` : ''}`; // ✅ Dynamically update tab
            } catch (err) {
                console.error('[ClientProviders] Error fetching profile:', err);
            }
        };
        fetchProfile();
    }, []);

    return (
        <>
            {children}
            <ToastContainer
                position="top-right"
                autoClose={3000}
                pauseOnFocusLoss={false}
                hideProgressBar={false}
                closeOnClick
                theme="light"
            />
        </>
    );
}
