#!/bin/bash

# Script to start all services locally for Listro application

echo "🚀 Starting Listro Local Development Environment"
echo "================================================"

# Check if required files exist
if [ ! -f "backend/.env" ]; then
    echo "❌ backend/.env not found!"
    exit 1
fi

if [ ! -f ".env" ]; then
    echo "❌ .env not found in root!"
    exit 1
fi

echo ""
echo "📦 Starting services..."
echo ""

# Start Node.js backend on port 4000
echo "1️⃣  Starting Node.js backend on port 4000..."
cd backend
PORT=4000 node server.js &
NODE_PID=$!
echo "   ✅ Node.js backend started (PID: $NODE_PID)"

# Wait a moment
sleep 2

# Start Python backend on port 5000
echo "2️⃣  Starting Python backend on port 5000..."
source ../venv/bin/activate
python3 python-server.py &
PYTHON_PID=$!
echo "   ✅ Python backend started (PID: $PYTHON_PID)"

# Wait a moment
sleep 2

# Start frontend
echo "3️⃣  Starting Vite frontend on port 5173..."
cd ..
npm run dev &
VITE_PID=$!
echo "   ✅ Vite frontend started (PID: $VITE_PID)"

echo ""
echo "================================================"
echo "✅ All services started successfully!"
echo ""
echo "📍 Service URLs:"
echo "   - Frontend:        http://localhost:5173"
echo "   - Node.js Backend: http://localhost:4000"
echo "   - Python Backend:  http://localhost:5000"
echo ""
echo "📝 Process IDs:"
echo "   - Node.js: $NODE_PID"
echo "   - Python:  $PYTHON_PID"
echo "   - Vite:    $VITE_PID"
echo ""
echo "🛑 To stop all services, press Ctrl+C or run:"
echo "   kill $NODE_PID $PYTHON_PID $VITE_PID"
echo "================================================"

# Wait for user interrupt
wait
