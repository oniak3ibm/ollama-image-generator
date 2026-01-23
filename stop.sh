#!/bin/bash

# Ollama Image Generator - Stop Script
# This script stops the running application

set -e

echo "🛑 Stopping Ollama Image Generator..."

# Check if PID file exists
if [ ! -f ".server.pid" ]; then
    echo "⚠️  No PID file found (.server.pid)"
    echo "   Checking for processes on port 3000..."
    
    # Try to find process by port
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        PID=$(lsof -Pi :3000 -sTCP:LISTEN -t)
        echo "   Found process on port 3000: PID $PID"
        echo "   Killing process..."
        kill $PID 2>/dev/null || kill -9 $PID 2>/dev/null
        echo "✅ Process stopped"
    else
        echo "   No process found on port 3000"
        echo "   Server may not be running"
    fi
    exit 0
fi

# Read PID from file
SERVER_PID=$(cat .server.pid)

# Check if process is running
if ps -p $SERVER_PID > /dev/null 2>&1; then
    echo "📍 Found server process (PID: $SERVER_PID)"
    echo "   Stopping server..."
    
    # Try graceful shutdown first
    kill $SERVER_PID 2>/dev/null
    
    # Wait up to 5 seconds for graceful shutdown
    for i in {1..5}; do
        if ! ps -p $SERVER_PID > /dev/null 2>&1; then
            echo "✅ Server stopped gracefully"
            rm -f .server.pid
            exit 0
        fi
        sleep 1
    done
    
    # Force kill if still running
    echo "   Forcing shutdown..."
    kill -9 $SERVER_PID 2>/dev/null
    echo "✅ Server stopped (forced)"
else
    echo "⚠️  Process $SERVER_PID is not running"
    echo "   Cleaning up PID file..."
fi

# Clean up PID file
rm -f .server.pid

# Double check port 3000
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Warning: Port 3000 is still in use by another process"
    PID=$(lsof -Pi :3000 -sTCP:LISTEN -t)
    echo "   Process: PID $PID"
else
    echo "✅ Port 3000 is now free"
fi

echo ""
echo "Server stopped successfully"

# Made with Bob
