#!/bin/bash

# Ollama Image Generator - Start Script
# This script starts the application and checks dependencies

set -e

echo "🚀 Starting Ollama Image Generator..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if Ollama is running
echo "🔍 Checking Ollama connection..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✅ Ollama is running"
else
    echo "⚠️  Warning: Ollama is not running or not accessible at http://localhost:11434"
    echo "   Please start Ollama with: ollama serve"
    echo "   Continuing anyway..."
fi

# Check if port 3000 is already in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Warning: Port 3000 is already in use"
    PID=$(lsof -Pi :3000 -sTCP:LISTEN -t)
    echo "   Process using port 3000: PID $PID"
    echo "   Run ./stop.sh to stop the existing process"
    exit 1
fi

# Start the server
echo "🌐 Starting server on http://localhost:3000"
echo "📝 Logs will be written to server.log"
echo "🛑 To stop the server, run: ./stop.sh"
echo ""

# Start server in background and save PID
nohup npm start > server.log 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > .server.pid

# Wait a moment for server to start
sleep 2

# Check if server is running
if ps -p $SERVER_PID > /dev/null; then
    echo "✅ Server started successfully (PID: $SERVER_PID)"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🌐 Application URL: http://localhost:3000"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📊 View logs: tail -f server.log"
    echo "🛑 Stop server: ./stop.sh"
else
    echo "❌ Failed to start server"
    echo "Check server.log for details"
    exit 1
fi

# Made with Bob
