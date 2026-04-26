const express = require('express');
const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/workouts', (req, res) => res.json({ workouts: [] }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FitTrack running on ${PORT}`));
