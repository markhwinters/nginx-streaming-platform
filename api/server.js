const express = require("express")
require("dotenv").config()

const app = express()
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.send('Server is up and running!');
});

app.listen (PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`)
})