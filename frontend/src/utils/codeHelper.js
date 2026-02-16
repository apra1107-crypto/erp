export const explainCode = (code) => {
    if (!code) return '';
    return code.split('').map(char => {
        // Numbers
        if (char >= '0' && char <= '9') {
            const nums = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
            return nums[parseInt(char)];
        }

        // Uppercase letters
        if (char >= 'A' && char <= 'Z') {
            return `Capital ${char}`;
        }

        // Lowercase letters
        if (char >= 'a' && char <= 'z') {
            return `Small ${char}`;
        }

        // Fallback for special characters
        return char;
    }).join(' • ');
};
