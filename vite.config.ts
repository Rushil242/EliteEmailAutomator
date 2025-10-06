import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from 'vite' // Assuming you have this import
import react from '@vitejs/plugin-react' // Assuming you have this import

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  
  // ADD THESE TWO LINES
  base: './',
  envDir: __dirname,
  
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});