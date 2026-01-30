#!/bin/bash

# Script to set up GitHub repository for Bethany's Spelling Game

cd "/Users/richrinka/Desktop/Bethany's Spelling Game"

echo "Initializing git repository..."
git init

echo "Adding all files..."
git add .

echo "Creating initial commit..."
git commit -m "Initial commit: Bethany's Spelling Game - Complete browser-based educational spelling game for 6th grade students"

echo "Setting main branch..."
git branch -M main

echo "Adding GitHub remote..."
git remote add origin https://github.com/Rich-Rinka15/Bethany-s-Games.git 2>&1 || git remote set-url origin https://github.com/Rich-Rinka15/Bethany-s-Games.git

echo "Remote configured:"
git remote -v

echo ""
echo "Repository is ready! To push to GitHub, run:"
echo "  git push -u origin main"
echo ""
echo "If you haven't authenticated with GitHub, you may need to:"
echo "  1. Set up a Personal Access Token, or"
echo "  2. Use GitHub CLI (gh auth login)"
