export const formatDate = (dateString: string | Date): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    const day = date.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${day} ${month} ${year}`;
};

/**
 * Safely formats a Date object or string to YYYY-MM-DD string without timezone shifting.
 */
export const formatDateToAPI = (dateInput: Date | string): string => {
    if (!dateInput) return '';

    // If it's a string from DB (already YYYY-MM-DD), just return the date part
    if (typeof dateInput === 'string') {
        if (/^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
            return dateInput.split('T')[0];
        }
        dateInput = new Date(dateInput);
    }

    if (isNaN(dateInput.getTime())) return '';

    const year = dateInput.getFullYear();
    const month = String(dateInput.getMonth() + 1).padStart(2, '0');
    const day = String(dateInput.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
