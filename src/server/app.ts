// ============================================================================
// DEAL OPTIMIZER WEB SERVER
// Web-based application for F&I managers
// ============================================================================

import express, { Request, Response } from 'express';
import path from 'path';
import { apiRouter } from './api';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../../public')));

// API routes
app.use('/api', apiRouter);

// Serve the main app for all other routes
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║                    UNION PARK DEAL OPTIMIZER                             ║
║                         Web Application                                  ║
╠══════════════════════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}                               ║
║                                                                          ║
║  Share this URL with other managers on your network:                     ║
║  http://YOUR_COMPUTER_IP:${PORT}                                           ║
║                                                                          ║
║  To find your IP, run: ipconfig (Windows) or ifconfig (Mac/Linux)        ║
╚══════════════════════════════════════════════════════════════════════════╝
  `);
});

export default app;
