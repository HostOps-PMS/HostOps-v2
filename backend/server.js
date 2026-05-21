const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Initialize the app
const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Allows us to parse JSON in request bodies

// Basic Route for testing
app.get('/', (req, res) => {
    res.send('API is running successfully!');
});

// Define the port (uses .env file if available, otherwise 5000)
const PORT = process.env.PORT || 5000;

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});