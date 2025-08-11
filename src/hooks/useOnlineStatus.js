import { useEffect, useState } from "react";

export default function useOnlineStatus()
{
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine: true);
    const [changedAt, setChangeAt] = useState(Date.now());

    useEffect(() =>
    {
        const goOnline = () => { setIsOnline(true); setChangeAt(Date.now());};
        const goOffline = () => { setIsOnline(false); setChangeAt(Date.now());};

        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);

        return () =>
        {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        }
    }, []);

    return {isOnline, changedAt};
}