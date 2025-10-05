import 'dotenv/config';
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { registerRoutes } from "./routes";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// Register API routes
registerRoutes(app);
// Serve static files from public directory
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));
// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(publicPath, 'index.html'));
    }
});
const port = parseInt(process.env.PORT || '5000', 10);
app.listen(port, '0.0.0.0', () => {
    console.log(`Elite IIT Server running on port ${port}`);
});
