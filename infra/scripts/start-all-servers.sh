#!/bin/bash
# Start all required servers for Listro application

echo "🚀 Starting Listro Application Servers..."
echo "=========================================="

# Function to check if port is in use
check_port() {
    lsof -i:$1 > /dev/null 2>&1
    return $?
}

# Kill existing processes on our ports
echo "🧹 Cleaning up existing processes..."
if check_port 5000; then
    echo "  Killing process on port 5000 (Python server)..."
    fuser -k 5000/tcp 2>/dev/null
    sleep 1
fi

if check_port 4000; then
    echo "  Killing process on port 4000 (Node server)..."
    fuser -k 4000/tcp 2>/dev/null
    sleep 1
fi

if check_port 5173; then
    echo "  Killing process on port 5173 (Vite)..."
    fuser -k 5173/tcp 2>/dev/null
    sleep 1
fi

echo ""
echo "=========================================="
echo "1️⃣  Starting Python Scraper Server (Port 5000)..."
echo "=========================================="
cd backend && PORT=5000 python3 python-server.py > ../logs/python-server.log 2>&1 &
PYTHON_PID=$!
cd ..
sleep 2

if check_port 5000; then
    echo "  ✅ Python server running on port 5000 (PID: $PYTHON_PID)"
else
    echo "  ❌ Python server failed to start"
    exit 1
fi

echo ""
echo "=========================================="
echo "2️⃣  Starting Node.js API Server (Port 4000)..."
echo "=========================================="
cd backend && PORT=4000 node server.js > ../logs/node-server.log 2>&1 &
NODE_PID=$!
cd ..
sleep 2

if check_port 4000; then
    echo "  ✅ Node server running on port 4000 (PID: $NODE_PID)"
else
    echo "  ❌ Node server failed to start"
    exit 1
fi

echo ""
echo "=========================================="
echo "3️⃣  Starting Vite Dev Server (Port 5173)..."
echo "=========================================="
npm run dev > logs/vite-server.log 2>&1 &
VITE_PID=$!
sleep 3

if check_port 5173; then
    echo "  ✅ Vite server running on port 5173 (PID: $VITE_PID)"
else
    echo "  ❌ Vite server failed to start"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ ALL SERVERS STARTED SUCCESSFULLY!"
echo "=========================================="
echo ""
echo "Server Status:"
echo "  🐍 Python Scraper:  http://localhost:5000  (PID: $PYTHON_PID)"
echo "  🟢 Node.js API:     http://localhost:4000  (PID: $NODE_PID)"
echo "  ⚡ Vite Frontend:   http://localhost:5173  (PID: $VITE_PID)"
echo ""
echo "Logs:"
echo "  Python: tail -f logs/python-server.log"
echo "  Node:   tail -f logs/node-server.log"
echo "  Vite:   tail -f logs/vite-server.log"
echo ""
echo "To stop all servers: pkill -P $$"
echo ""
echo "=========================================="

# Keep script running
wait
