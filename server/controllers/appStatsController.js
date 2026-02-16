import pool from '../config/db.js';

export const getDownloadCount = async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT stat_value FROM app_stats WHERE stat_name = 'download_count'"
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Download count stat not found' });
        }

        res.json({ count: result.rows[0].stat_value });
    } catch (error) {
        console.error('Error fetching download count:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const incrementDownloadCount = async (req, res) => {
    try {
        const result = await pool.query(
            "UPDATE app_stats SET stat_value = stat_value + 1, updated_at = CURRENT_TIMESTAMP WHERE stat_name = 'download_count' RETURNING stat_value"
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Download count stat not found' });
        }

        res.json({ 
            message: 'Download count incremented', 
            count: result.rows[0].stat_value 
        });
    } catch (error) {
        console.error('Error incrementing download count:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
