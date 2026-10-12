# 1. Project Overview

Name: AI vs. Human Code Review Simulator
Purpose: An interactive, browser-based visualization demonstrating how AI code generation speeds create an overwhelming cognitive bottleneck during the human review phase, compared to traditional human-to-human workflows.
Target Stack: React, Tailwind CSS (for styling), Lucide React (for iconography).

## 2. Core Features & Requirements

Interactive Simulation: A real-time engine that moves "code changesets" from generation, into a review queue, and finally to deployment.
Dual Workflow Lanes:
Human Lane: Simulates manual coding and peer review.
AI Lane: Simulates AI code generation and human review.
Adjustable Parameters (Real-time):
Sliders to adjust Generation Rate (changesets/sec) for both lanes.
Sliders to adjust Review Rate (changesets/sec) for both lanes.
Global Controls: Start, Pause, and Reset functionality.
Visual Indicators:
Live counters for "Pending Review" (queue) and "Deployed" (completed).
Color-coded queue boxes that turn red and display a warning icon when the queue exceeds a manageable threshold (e.g., >15 items).

## 3. State Management Specification

The application will require the following reactive state variables:
Simulation Controls:
isRunning (boolean): Tracks if the simulation loop is active.
Rates (Inputs):
humanGenRate (number): Default 1 (range 1-10)
humanReviewRate (number): Default 3 (range 1-10)
aiGenRate (number): Default 20 (range 5-50)
aiReviewRate (number): Default 2 (range 1-10)
Simulation Data (Outputs):
humanQueue (number): Items waiting for review in the human lane.
humanDeployed (number): Items successfully reviewed in the human lane.
aiQueue (number): Items waiting for review in the AI lane.
aiDeployed (number): Items successfully reviewed in the AI lane.

## 4. Simulation Engine Logic

The simulation runs on a time-based interval loop (e.g., ticking every 100ms) to ensure smooth visual updates rather than jumping once per second.
Tick Logic (Every 100ms):
Calculate Multiplier: Since it ticks 10 times a second, multiply the per-second rates by 0.1 per tick.
Generation Phase: Add (genRate *0.1) to the respective queue state.
Review Phase:
Determine capacity: (reviewRate* 0.1).
Calculate processed items: Math.min(currentQueue, capacity) (you can only process what is actually in the queue).
Subtract processed items from the queue and add them to the deployed state.

## 5. UI/UX Layout Structure

Header:
Title and brief description.
Global Action Buttons (Start/Pause, Reset) positioned on the right.
Human Workflow Section (Top Lane):
Styling: Neutral/Blue/Green calming colors.
Left: Generation slider and User icon.
Middle: Queue visualizer (Box with number).
Right: Review slider, Eye icon, and Deployed counter.
AI Workflow Section (Bottom Lane):
Styling: High contrast, utilizing purples for AI and reds to indicate stress/bottlenecks.
Left: AI Generation slider (higher max value) and Bot icon.
Middle: Queue visualizer (designed to overflow and turn red quickly).
Right: Review slider, Eye icon (representing the human bottleneck), and Deployed counter.

## 6. Edge Cases to Handle

Queue cannot be negative: Ensure mathematical checks (Math.max(0, queue - processed)) prevent queues from dropping below zero.
Slider adjustments while running: The engine must instantly adapt to new slider values without needing to pause the simulation.

## 7. Architecture

React + tailwindcss
Prettier without semicolons
2 space indent
ES Modules, not Commonjs
