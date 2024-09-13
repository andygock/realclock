const express = require('express');
const rateLimit = require('express-rate-limit');

const app = express();

// Rate limiter middleware
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // limit each IP to 30 requests per minute
});

// Apply rate limiter to all requests
app.use(limiter);

// Endpoint to return current milliseconds past Unix epoch and datetime in UTC with milliseconds
app.get('/', (req, res) => {
    const now = new Date();
    const milliseconds = now.getTime();
    const datetime = now.toISOString();
    res.json({ milliseconds, datetime });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
