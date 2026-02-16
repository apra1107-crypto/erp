export const formatIndianDate = (dateString) => {
    if (!dateString) return 'Not Set';
    const date = new Date(dateString);

    // Check if date is valid
    if (isNaN(date.getTime())) return 'Invalid Date';

    return date.toLocaleString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
};

export const getRemainingTimeText = (expiryDateString) => {
    if (!expiryDateString) return 'No active subscription';

    const now = new Date();
    const expiry = new Date(expiryDateString);
    const diffMs = expiry - now;

    if (diffMs <= 0) return 'Expired';

    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} days left`;
    if (diffHours > 0) return `${diffHours} hours left`;
    if (diffMins > 0) return `${diffMins} mins left`;
    return '< 1 min left';
};
