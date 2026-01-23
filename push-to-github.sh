#!/bin/bash

# Ollama Image Generator - GitHub Push Script
# This script automates git operations to push changes to GitHub

set -e

echo "📤 GitHub Push Script"
echo "===================="

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "❌ Error: git is not installed"
    exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Not a git repository"
    echo "   Initialize with: git init"
    exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 Current branch: $CURRENT_BRANCH"

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
    echo ""
    echo "📝 Uncommitted changes detected:"
    git status -s
    echo ""
    
    # Ask for commit message
    read -p "Enter commit message (or press Enter for default): " COMMIT_MSG
    
    if [ -z "$COMMIT_MSG" ]; then
        COMMIT_MSG="Update: $(date '+%Y-%m-%d %H:%M:%S')"
    fi
    
    echo ""
    echo "📦 Staging all changes..."
    git add .
    
    echo "💾 Committing changes..."
    git commit -m "$COMMIT_MSG"
    echo "✅ Changes committed"
else
    echo "✅ No uncommitted changes"
fi

# Check if remote exists
if ! git remote get-url origin > /dev/null 2>&1; then
    echo ""
    echo "⚠️  No remote 'origin' configured"
    read -p "Enter GitHub repository URL: " REPO_URL
    
    if [ -z "$REPO_URL" ]; then
        echo "❌ Error: Repository URL is required"
        exit 1
    fi
    
    echo "🔗 Adding remote 'origin'..."
    git remote add origin "$REPO_URL"
    echo "✅ Remote added"
fi

# Get remote URL
REMOTE_URL=$(git remote get-url origin)
echo ""
echo "🔗 Remote: $REMOTE_URL"

# Push to remote
echo ""
echo "🚀 Pushing to $CURRENT_BRANCH..."

if git push origin "$CURRENT_BRANCH" 2>&1; then
    echo "✅ Successfully pushed to GitHub"
else
    echo ""
    echo "⚠️  Push failed. Trying with --set-upstream..."
    if git push --set-upstream origin "$CURRENT_BRANCH"; then
        echo "✅ Successfully pushed to GitHub (upstream set)"
    else
        echo "❌ Push failed"
        echo ""
        echo "Possible solutions:"
        echo "1. Check your GitHub credentials"
        echo "2. Verify repository permissions"
        echo "3. Pull remote changes first: git pull origin $CURRENT_BRANCH"
        exit 1
    fi
fi

echo ""
echo "🎉 All changes pushed successfully!"
echo "📍 Branch: $CURRENT_BRANCH"
echo "🔗 Remote: $REMOTE_URL"

# Made with Bob
